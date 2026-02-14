"""
Stock management endpoints.
Provides stock data with filters, inmovilizado and MRP indicators.
"""

from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.roles import require_auth
from backend.core.search_utils import build_description_search_with_catalog

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
                search = build_description_search_with_catalog(
                    descripcion, ["s.material_descripcion"], "s.material"
                )
                if search:
                    where_clauses.append(search.where_clause)
                    params.extend(search.params)

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
                    -- Inmovilizado: columna SAP o sin consumo en último año
                    CASE
                        WHEN s.inmovilizado = 'INMOVILIZADO' THEN 1
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

            # Build WHERE clauses with explicit aliases for reuse
            base_clauses = ["s.stock > 0"]
            params = []

            if centro:
                base_clauses.append("s.centro = ?")
                params.append(centro)

            if almacen:
                base_clauses.append("s.almacen = ?")
                params.append(almacen)

            where_sql = " AND ".join(base_clauses)
            # Non-aliased version for simple queries
            where_sql_no_alias = where_sql.replace("s.", "")
            fecha_limite = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

            # Total stock
            cur.execute(f"""
                SELECT
                    COUNT(DISTINCT material || '-' || centro || '-' || almacen) as total_items,
                    COALESCE(SUM(stock), 0) as stock_total,
                    COALESCE(SUM(stock_valorizado), 0) as valor_total
                FROM stock
                WHERE {where_sql_no_alias}
            """, params)
            totals = dict(cur.fetchone())

            # Inmovilizado (columna SAP)
            cur.execute(f"""
                SELECT
                    COUNT(DISTINCT material || '-' || centro || '-' || almacen) as items,
                    COALESCE(SUM(stock_valorizado), 0) as valor
                FROM stock
                WHERE {where_sql_no_alias}
                AND inmovilizado = 'INMOVILIZADO'
            """, params)
            inmovilizado = dict(cur.fetchone())

            # Sin consumo en ultimo año
            cur.execute(f"""
                SELECT COUNT(DISTINCT s.material || '-' || s.centro || '-' || s.almacen) as items
                FROM stock s
                WHERE {where_sql}
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
                WHERE {where_sql}
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


@bp.route('/health', methods=['GET'])
@require_auth
def get_inventory_health():
    """
    Feature 4.3: Dashboard de salud de inventario - semáforo por material.

    Query params:
        - centro: Filtrar por centro
        - categoria: Filtrar por categoría ABC (A, B, C)

    Returns:
        Resumen y materiales con semáforo de estado
    """
    try:
        centro = request.args.get('centro')
        categoria = request.args.get('categoria')

        conditions = []
        params = []

        if centro:
            conditions.append("m.centro = ?")
            params.append(centro)
        if categoria:
            conditions.append("UPPER(m.categoria_abc) = ?")
            params.append(categoria.upper())

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            cur.execute(f"""
                SELECT
                    m.codigo_material,
                    m.descripcion,
                    m.centro,
                    m.stock_actual,
                    m.stock_seguridad,
                    m.punto_pedido,
                    m.stock_maximo,
                    m.consumo_promedio_mensual,
                    m.lead_time_dias,
                    m.categoria_abc,
                    m.critico
                FROM materiales_mrp m
                {where_clause}
                ORDER BY
                    CASE
                        WHEN m.stock_actual <= 0 THEN 0
                        WHEN m.stock_actual < COALESCE(m.stock_seguridad, 0) THEN 1
                        WHEN m.stock_actual < COALESCE(m.punto_pedido, 0) THEN 2
                        WHEN m.stock_actual > COALESCE(m.stock_maximo, 99999999) THEN 3
                        ELSE 4
                    END,
                    m.codigo_material
                LIMIT 500
            """, params)
            rows = cur.fetchall()

        materiales = []
        resumen = {"quiebre": 0, "critico": 0, "bajo_rop": 0, "exceso": 0, "normal": 0, "total": 0}

        for row in rows:
            r = dict(row) if hasattr(row, 'keys') else {
                'codigo_material': row[0], 'descripcion': row[1], 'centro': row[2],
                'stock_actual': row[3], 'stock_seguridad': row[4], 'punto_pedido': row[5],
                'stock_maximo': row[6], 'consumo_promedio_mensual': row[7],
                'lead_time_dias': row[8], 'categoria_abc': row[9], 'critico': row[10]
            }
            stock = r.get('stock_actual') or 0
            ss = r.get('stock_seguridad') or 0
            pp = r.get('punto_pedido') or 0
            smax = r.get('stock_maximo') or 999999999
            consumo = r.get('consumo_promedio_mensual') or 0
            consumo_diario = consumo / 30 if consumo > 0 else 0
            cobertura = round(stock / consumo_diario, 1) if consumo_diario > 0 else None

            if stock <= 0:
                semaforo = "rojo"
                estado = "quiebre"
                resumen["quiebre"] += 1
            elif stock < ss:
                semaforo = "rojo"
                estado = "critico"
                resumen["critico"] += 1
            elif stock < pp:
                semaforo = "amarillo"
                estado = "bajo_rop"
                resumen["bajo_rop"] += 1
            elif stock > smax:
                semaforo = "naranja"
                estado = "exceso"
                resumen["exceso"] += 1
            else:
                semaforo = "verde"
                estado = "normal"
                resumen["normal"] += 1

            resumen["total"] += 1

            materiales.append({
                "codigo": r.get('codigo_material'),
                "descripcion": r.get('descripcion'),
                "centro": r.get('centro'),
                "stock_actual": stock,
                "stock_seguridad": ss,
                "punto_pedido": pp,
                "stock_maximo": smax if smax < 999999999 else None,
                "cobertura_dias": cobertura,
                "categoria_abc": r.get('categoria_abc'),
                "critico": bool(r.get('critico')),
                "semaforo": semaforo,
                "estado": estado
            })

        return jsonify({
            "resumen": resumen,
            "materiales": materiales
        })

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error en inventory health: {e}")
        return jsonify({"error": "Error al obtener salud del inventario"}), 500
