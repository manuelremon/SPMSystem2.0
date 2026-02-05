"""
Stock management endpoints.
Provides stock data with filters, inmovilizado and MRP indicators.
"""

from flask import Blueprint, jsonify, request, g
from datetime import datetime, timedelta

from backend.core.db import get_db_connection
from backend.core.roles import require_auth

bp = Blueprint("stock", __name__, url_prefix="/api/stock")


@bp.route("", methods=["GET"])
@require_auth
def get_stock():
    """
    Get stock data with filters.

    Query params:
    - centro: filter by plant code
    - almacen: filter by warehouse code
    - material: filter by material code (partial match)
    - descripcion: filter by description (partial match)
    - inmovilizado: filter by inmovilizado status (true/false)
    - mrp: filter by MRP planned status (true/false)
    - limit: max results (default 500, max 2000)
    - offset: pagination offset

    Returns:
    {
        ok: true,
        data: [{
            material, descripcion, centro, centro_descripcion,
            almacen, stock, um, precio, stock_valorizado,
            inmovilizado, mrp, ultimo_consumo, dias_sin_movimiento
        }],
        total: count,
        filtros: {centros: [], almacenes: []}
    }
    """
    # Get query params
    centro = request.args.get("centro", "").strip()
    almacen = request.args.get("almacen", "").strip()
    material = request.args.get("material", "").strip()
    descripcion = request.args.get("descripcion", "").strip()
    inmovilizado_filter = request.args.get("inmovilizado", "").strip().lower()
    mrp_filter = request.args.get("mrp", "").strip().lower()
    limit = min(int(request.args.get("limit", 500)), 999999)
    offset = int(request.args.get("offset", 0))

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Build WHERE clauses
            where_clauses = ["s.stock > 0"]
            params = []

            if centro:
                where_clauses.append("s.centro = ?")
                params.append(centro)

            if almacen:
                where_clauses.append("s.almacen = ?")
                params.append(almacen)

            if material:
                where_clauses.append("s.material LIKE ?")
                params.append(f"%{material}%")

            if descripcion:
                where_clauses.append("s.material_descripcion LIKE ?")
                params.append(f"%{descripcion}%")

            where_sql = " AND ".join(where_clauses)

            # Main query with subqueries for inmovilizado and MRP
            # Calculate date 365 days ago
            fecha_limite = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

            query = f"""
                SELECT
                    s.material,
                    s.material_descripcion as descripcion,
                    s.centro,
                    s.centro_descripcion,
                    s.almacen,
                    SUM(s.stock) as stock,
                    s.um,
                    s.precio,
                    SUM(s.stock_valorizado) as stock_valorizado,
                    -- Inmovilizado: lote especial o sin consumo en ultimo año
                    CASE
                        WHEN s.lote IN ('G-INSPE', 'G-REZAG', 'G-REPAR', 'G-AREPA', 'G-SOBRA') THEN 1
                        WHEN NOT EXISTS (
                            SELECT 1 FROM consumo_historico ch
                            WHERE ch.material = s.material
                            AND ch.centro = s.centro
                            AND ch.almacen = s.almacen
                            AND ch.fecha >= ?
                        ) THEN 1
                        ELSE 0
                    END as inmovilizado,
                    -- MRP: existe en materiales_bbdd con punto_de_pedido > 0
                    CASE
                        WHEN EXISTS (
                            SELECT 1 FROM materiales_bbdd m
                            WHERE m.codigo_material = s.material
                            AND m.centro = s.centro
                            AND m.almacen = s.almacen
                            AND (m.punto_de_pedido > 0 OR m.stock_de_seguridad > 0)
                        ) THEN 1
                        ELSE 0
                    END as mrp,
                    -- Ultimo consumo
                    (
                        SELECT MAX(fecha) FROM consumo_historico ch
                        WHERE ch.material = s.material
                        AND ch.centro = s.centro
                        AND ch.almacen = s.almacen
                    ) as ultimo_consumo
                FROM stock s
                WHERE {where_sql}
                GROUP BY s.material, s.centro, s.almacen
            """

            # Add HAVING clauses for inmovilizado/mrp filters
            having_clauses = []
            if inmovilizado_filter == "true":
                having_clauses.append("inmovilizado = 1")
            elif inmovilizado_filter == "false":
                having_clauses.append("inmovilizado = 0")

            if mrp_filter == "true":
                having_clauses.append("mrp = 1")
            elif mrp_filter == "false":
                having_clauses.append("mrp = 0")

            if having_clauses:
                query += " HAVING " + " AND ".join(having_clauses)

            query += " ORDER BY s.stock_valorizado DESC"

            # Add fecha_limite as first param
            all_params = [fecha_limite] + params

            # Get total count
            count_query = f"SELECT COUNT(*) as total FROM ({query})"
            cur.execute(count_query, all_params)
            total = cur.fetchone()["total"]

            # Get paginated results
            query += f" LIMIT {limit} OFFSET {offset}"
            cur.execute(query, all_params)

            results = []
            for row in cur.fetchall():
                item = dict(row)
                # Calculate dias_sin_movimiento
                if item.get("ultimo_consumo"):
                    try:
                        ultimo = datetime.strptime(item["ultimo_consumo"], "%Y-%m-%d")
                        item["dias_sin_movimiento"] = (datetime.now() - ultimo).days
                    except (ValueError, TypeError):
                        item["dias_sin_movimiento"] = None
                else:
                    item["dias_sin_movimiento"] = 999  # Never consumed

                # Convert boolean fields
                item["inmovilizado"] = bool(item.get("inmovilizado", 0))
                item["mrp"] = bool(item.get("mrp", 0))

                results.append(item)

            # Get filter options (unique centros and almacenes)
            cur.execute("SELECT DISTINCT centro FROM stock WHERE stock > 0 ORDER BY centro")
            centros = [row["centro"] for row in cur.fetchall()]

            cur.execute("SELECT DISTINCT almacen FROM stock WHERE stock > 0 ORDER BY almacen")
            almacenes = [row["almacen"] for row in cur.fetchall()]

            return jsonify({
                "ok": True,
                "data": results,
                "total": total,
                "filtros": {
                    "centros": centros,
                    "almacenes": almacenes
                }
            })

    except Exception as e:
        import logging
        logging.error(f"Error in get_stock: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/resumen", methods=["GET"])
@require_auth
def get_stock_resumen():
    """
    Get stock summary statistics.

    Query params:
    - centro: filter by plant code
    - almacen: filter by warehouse code

    Returns:
    {
        ok: true,
        data: {
            total_items: int,
            stock_total: float,
            valor_total: float,
            inmovilizado_items: int,
            inmovilizado_valor: float,
            mrp_items: int,
            sin_consumo_365d: int
        }
    }
    """
    centro = request.args.get("centro", "").strip()
    almacen = request.args.get("almacen", "").strip()

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            where_clauses = ["stock > 0"]
            params = []

            if centro:
                where_clauses.append("centro = ?")
                params.append(centro)

            if almacen:
                where_clauses.append("almacen = ?")
                params.append(almacen)

            where_sql = " AND ".join(where_clauses)
            fecha_limite = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

            # Total stock
            cur.execute(f"""
                SELECT
                    COUNT(DISTINCT material || '-' || centro || '-' || almacen) as total_items,
                    COALESCE(SUM(stock), 0) as stock_total,
                    COALESCE(SUM(stock_valorizado), 0) as valor_total
                FROM stock
                WHERE {where_sql}
            """, params)
            totals = dict(cur.fetchone())

            # Inmovilizado (lotes especiales)
            cur.execute(f"""
                SELECT
                    COUNT(DISTINCT material || '-' || centro || '-' || almacen) as items,
                    COALESCE(SUM(stock_valorizado), 0) as valor
                FROM stock
                WHERE {where_sql}
                AND lote IN ('G-INSPE', 'G-REZAG', 'G-REPAR', 'G-AREPA', 'G-SOBRA')
            """, params)
            inmovilizado = dict(cur.fetchone())

            # Sin consumo en ultimo año
            cur.execute(f"""
                SELECT COUNT(DISTINCT s.material || '-' || s.centro || '-' || s.almacen) as items
                FROM stock s
                WHERE {where_sql.replace('stock', 's.stock').replace('centro', 's.centro').replace('almacen', 's.almacen')}
                AND NOT EXISTS (
                    SELECT 1 FROM consumo_historico ch
                    WHERE ch.material = s.material
                    AND ch.centro = s.centro
                    AND ch.almacen = s.almacen
                    AND ch.fecha >= ?
                )
            """, params + [fecha_limite])
            sin_consumo = cur.fetchone()["items"]

            # MRP items
            cur.execute(f"""
                SELECT COUNT(DISTINCT s.material || '-' || s.centro || '-' || s.almacen) as items
                FROM stock s
                WHERE {where_sql.replace('stock', 's.stock').replace('centro', 's.centro').replace('almacen', 's.almacen')}
                AND EXISTS (
                    SELECT 1 FROM materiales_bbdd m
                    WHERE m.codigo_material = s.material
                    AND m.centro = s.centro
                    AND m.almacen = s.almacen
                    AND (m.punto_de_pedido > 0 OR m.stock_de_seguridad > 0)
                )
            """, params)
            mrp_items = cur.fetchone()["items"]

            return jsonify({
                "ok": True,
                "data": {
                    "total_items": totals["total_items"],
                    "stock_total": totals["stock_total"],
                    "valor_total": totals["valor_total"],
                    "inmovilizado_items": inmovilizado["items"],
                    "inmovilizado_valor": inmovilizado["valor"],
                    "mrp_items": mrp_items,
                    "sin_consumo_365d": sin_consumo
                }
            })

    except Exception as e:
        import logging
        logging.error(f"Error in get_stock_resumen: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500
