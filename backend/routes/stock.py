"""
Stock management endpoints.
Provides stock data with filters, inmovilizado and MRP indicators.

Uses materialized view `stock_vista` (migration 094) for fast queries.
Falls back to raw tables if the view doesn't exist.
"""

import logging
from datetime import datetime, timedelta, date

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.helpers import safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.core.search_utils import build_description_search_with_catalog

logger = logging.getLogger(__name__)

bp = Blueprint("stock", __name__, url_prefix="/api/stock")


def _has_stock_vista(cur):
    """Check if stock_vista materialized view exists."""
    try:
        cur.execute(
            "SELECT 1 FROM pg_matviews WHERE matviewname = 'stock_vista' LIMIT 1"
        )
        return cur.fetchone() is not None
    except Exception:
        return False


def _build_stock_where(centro, almacen, material, descripcion,
                       inmovilizado_filter, mrp_filter, alias="sv"):
    """Build WHERE clauses and params for stock_vista queries."""
    clauses = []
    params = []

    if centro:
        clauses.append(f"{alias}.centro = ?")
        params.append(centro)
    if almacen:
        clauses.append(f"{alias}.almacen = ?")
        params.append(almacen)
    if material:
        clauses.append(f"{alias}.material LIKE ?")
        params.append(f"%{material}%")
    if descripcion:
        search = build_description_search_with_catalog(
            descripcion, [f"{alias}.descripcion"], f"{alias}.material"
        )
        if search:
            clauses.append(search.where_clause)
            params.extend(search.params)
    if inmovilizado_filter == "true":
        clauses.append(f"{alias}.inmovilizado = true")
    elif inmovilizado_filter == "false":
        clauses.append(f"{alias}.inmovilizado = false")
    if mrp_filter == "true":
        clauses.append(f"{alias}.mrp = true")
    elif mrp_filter == "false":
        clauses.append(f"{alias}.mrp = false")

    return " AND ".join(clauses) if clauses else "1=1", params


@bp.route("", methods=["GET"])
@require_auth
def get_stock():
    """
    Get stock data with server-side pagination.

    Query params:
    - centro, almacen, material, descripcion: filters
    - inmovilizado, mrp: true/false filter
    - limit: page size (default 100, max 500)
    - offset: pagination offset
    - sort: column name (default stock_valorizado)
    - order: asc/desc (default desc)

    Returns:
    {
        ok: true,
        data: [rows],
        total: count,
        filtros: {centros: [], almacenes: []}
    }
    """
    centro = request.args.get("centro", "").strip()
    almacen = request.args.get("almacen", "").strip()
    material = request.args.get("material", "").strip()
    descripcion = request.args.get("descripcion", "").strip()
    inmovilizado_filter = request.args.get("inmovilizado", "").strip().lower()
    mrp_filter = request.args.get("mrp", "").strip().lower()
    limit = min(int(request.args.get("limit", 100)), 500)
    offset = int(request.args.get("offset", 0))
    sort_col = request.args.get("sort", "stock_valorizado").strip()
    sort_order = request.args.get("order", "desc").strip().lower()

    # Whitelist sortable columns
    allowed_sorts = {
        "material", "descripcion", "centro", "almacen", "stock",
        "stock_valorizado", "dias_sin_movimiento", "inmovilizado", "mrp",
    }
    if sort_col not in allowed_sorts:
        sort_col = "stock_valorizado"
    if sort_order not in ("asc", "desc"):
        sort_order = "desc"

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            if is_using_postgresql() and _has_stock_vista(cur):
                return _get_stock_from_vista(
                    cur, centro, almacen, material, descripcion,
                    inmovilizado_filter, mrp_filter, limit, offset,
                    sort_col, sort_order)

            # Fallback: original query for environments without the view
            return _get_stock_legacy(
                cur, centro, almacen, material, descripcion,
                inmovilizado_filter, mrp_filter, limit, offset)

    except Exception as e:
        return safe_error_response(e, logger, context="stock.get_stock")


def _get_stock_from_vista(cur, centro, almacen, material, descripcion,
                          inmovilizado_filter, mrp_filter, limit, offset,
                          sort_col, sort_order):
    """Fast path: query from pre-computed materialized view."""
    where_sql, params = _build_stock_where(
        centro, almacen, material, descripcion,
        inmovilizado_filter, mrp_filter, alias="sv")

    # Total count
    cur.execute(f"SELECT COUNT(*) FROM stock_vista sv WHERE {where_sql}", params)
    total = cur.fetchone()[0]

    # Paginated data
    order_clause = f"{sort_col} {sort_order}"
    if sort_col == "dias_sin_movimiento":
        order_clause = f"ultimo_consumo {'ASC' if sort_order == 'desc' else 'DESC'} NULLS FIRST"

    cur.execute(f"""
        SELECT material, descripcion, centro, centro_descripcion, almacen,
               stock, um, precio, stock_valorizado, inmovilizado, mrp,
               ultimo_consumo
        FROM stock_vista sv
        WHERE {where_sql}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
    """, params + [limit, offset])

    today = datetime.now()
    results = []
    for row in cur.fetchall():
        item = dict(row)
        uc = item.get("ultimo_consumo")
        if uc:
            if isinstance(uc, (date, datetime)):
                delta = today - datetime.combine(uc, datetime.min.time()) if isinstance(uc, date) else today - uc
                item["dias_sin_movimiento"] = delta.days
            else:
                try:
                    item["dias_sin_movimiento"] = (today - datetime.strptime(str(uc), "%Y-%m-%d")).days
                except (ValueError, TypeError):
                    item["dias_sin_movimiento"] = None
        else:
            item["dias_sin_movimiento"] = 999
        # Ensure booleans
        item["inmovilizado"] = bool(item.get("inmovilizado", False))
        item["mrp"] = bool(item.get("mrp", False))
        results.append(item)

    # Filter options (cached in vista)
    cur.execute("SELECT DISTINCT centro FROM stock_vista ORDER BY centro")
    centros = [r["centro"] for r in cur.fetchall()]
    cur.execute("SELECT DISTINCT almacen FROM stock_vista ORDER BY almacen")
    almacenes = [r["almacen"] for r in cur.fetchall()]

    return jsonify({
        "ok": True,
        "data": results,
        "total": total,
        "filtros": {"centros": centros, "almacenes": almacenes}
    })


def _get_stock_legacy(cur, centro, almacen, material, descripcion,
                      inmovilizado_filter, mrp_filter, limit, offset):
    """Fallback: original query with correlated subqueries."""
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
    fecha_limite = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    query = f"""
        SELECT
            s.material,
            s.material_descripcion as descripcion,
            s.centro, s.centro_descripcion, s.almacen,
            SUM(s.stock) as stock, s.um, s.precio,
            SUM(s.stock_valorizado) as stock_valorizado,
            CASE
                WHEN s.inmovilizado = 'INMOVILIZADO' THEN 1
                WHEN NOT EXISTS (
                    SELECT 1 FROM consumo_historico ch
                    WHERE ch.material = s.material AND ch.centro = s.centro
                    AND ch.almacen = s.almacen AND ch.fecha >= ?
                ) THEN 1 ELSE 0
            END as inmovilizado,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM materiales_bbdd m
                    WHERE m.codigo_material = s.material AND m.centro = s.centro
                    AND m.almacen = s.almacen
                    AND (m.punto_de_pedido > 0 OR m.stock_de_seguridad > 0)
                ) THEN 1 ELSE 0
            END as mrp,
            (SELECT MAX(fecha) FROM consumo_historico ch
             WHERE ch.material = s.material AND ch.centro = s.centro
             AND ch.almacen = s.almacen) as ultimo_consumo
        FROM stock s
        WHERE {where_sql}
        GROUP BY s.material, s.material_descripcion, s.centro,
                 s.centro_descripcion, s.almacen, s.um, s.precio, s.inmovilizado
    """

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

    query += " ORDER BY stock_valorizado DESC"
    all_params = [fecha_limite] + params

    count_query = f"SELECT COUNT(*) as total FROM ({query}) sub"
    cur.execute(count_query, all_params)
    total = cur.fetchone()["total"]

    query += f" LIMIT {limit} OFFSET {offset}"
    cur.execute(query, all_params)

    results = []
    for row in cur.fetchall():
        item = dict(row)
        if item.get("ultimo_consumo"):
            try:
                ultimo = datetime.strptime(item["ultimo_consumo"], "%Y-%m-%d")
                item["dias_sin_movimiento"] = (datetime.now() - ultimo).days
            except (ValueError, TypeError):
                item["dias_sin_movimiento"] = None
        else:
            item["dias_sin_movimiento"] = 999
        item["inmovilizado"] = bool(item.get("inmovilizado", 0))
        item["mrp"] = bool(item.get("mrp", 0))
        results.append(item)

    cur.execute("SELECT DISTINCT centro FROM stock WHERE stock > 0 ORDER BY centro")
    centros = [row["centro"] for row in cur.fetchall()]
    cur.execute("SELECT DISTINCT almacen FROM stock WHERE stock > 0 ORDER BY almacen")
    almacenes = [row["almacen"] for row in cur.fetchall()]

    return jsonify({
        "ok": True,
        "data": results,
        "total": total,
        "filtros": {"centros": centros, "almacenes": almacenes}
    })


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
            total_items, stock_total, valor_total,
            inmovilizado_items, inmovilizado_valor,
            mrp_items, sin_consumo_365d
        }
    }
    """
    centro = request.args.get("centro", "").strip()
    almacen = request.args.get("almacen", "").strip()

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            if is_using_postgresql() and _has_stock_vista(cur):
                return _get_resumen_from_vista(cur, centro, almacen)

            return _get_resumen_legacy(cur, centro, almacen)

    except Exception as e:
        return safe_error_response(e, logger, context="stock.get_stock_resumen")


def _get_resumen_from_vista(cur, centro, almacen):
    """Fast path: single query on materialized view."""
    clauses = []
    params = []
    if centro:
        clauses.append("centro = ?")
        params.append(centro)
    if almacen:
        clauses.append("almacen = ?")
        params.append(almacen)
    where_sql = " AND ".join(clauses) if clauses else "1=1"

    cur.execute(f"""
        SELECT
            COUNT(*) as total_items,
            COALESCE(SUM(stock), 0) as stock_total,
            COALESCE(SUM(stock_valorizado), 0) as valor_total,
            COUNT(*) FILTER (WHERE inmovilizado = true) as inmovilizado_items,
            COALESCE(SUM(stock_valorizado) FILTER (WHERE inmovilizado = true), 0) as inmovilizado_valor,
            COUNT(*) FILTER (WHERE mrp = true) as mrp_items,
            COUNT(*) FILTER (WHERE ultimo_consumo IS NULL
                OR ultimo_consumo < CURRENT_DATE - INTERVAL '365 days') as sin_consumo_365d
        FROM stock_vista
        WHERE {where_sql}
    """, params)
    row = cur.fetchone()

    return jsonify({
        "ok": True,
        "data": {
            "total_items": row[0],
            "stock_total": float(row[1]),
            "valor_total": float(row[2]),
            "inmovilizado_items": row[3],
            "inmovilizado_valor": float(row[4]),
            "mrp_items": row[5],
            "sin_consumo_365d": row[6]
        }
    })


def _get_resumen_legacy(cur, centro, almacen):
    """Fallback: multiple queries on raw tables."""
    base_clauses = ["s.stock > 0"]
    params = []
    if centro:
        base_clauses.append("s.centro = ?")
        params.append(centro)
    if almacen:
        base_clauses.append("s.almacen = ?")
        params.append(almacen)

    where_sql = " AND ".join(base_clauses)
    where_sql_no_alias = where_sql.replace("s.", "")
    fecha_limite = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    cur.execute(f"""
        SELECT
            COUNT(DISTINCT material || '-' || centro || '-' || almacen) as total_items,
            COALESCE(SUM(stock), 0) as stock_total,
            COALESCE(SUM(stock_valorizado), 0) as valor_total
        FROM stock WHERE {where_sql_no_alias}
    """, params)
    totals = dict(cur.fetchone())

    cur.execute(f"""
        SELECT
            COUNT(DISTINCT material || '-' || centro || '-' || almacen) as items,
            COALESCE(SUM(stock_valorizado), 0) as valor
        FROM stock WHERE {where_sql_no_alias} AND inmovilizado = 'INMOVILIZADO'
    """, params)
    inmovilizado = dict(cur.fetchone())

    cur.execute(f"""
        SELECT COUNT(DISTINCT s.material || '-' || s.centro || '-' || s.almacen) as items
        FROM stock s WHERE {where_sql}
        AND NOT EXISTS (
            SELECT 1 FROM consumo_historico ch
            WHERE ch.material = s.material AND ch.centro = s.centro
            AND ch.almacen = s.almacen AND ch.fecha >= ?
        )
    """, params + [fecha_limite])
    sin_consumo = cur.fetchone()["items"]

    cur.execute(f"""
        SELECT COUNT(DISTINCT s.material || '-' || s.centro || '-' || s.almacen) as items
        FROM stock s WHERE {where_sql}
        AND EXISTS (
            SELECT 1 FROM materiales_bbdd m
            WHERE m.codigo_material = s.material AND m.centro = s.centro
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


@bp.route("/refresh-vista", methods=["POST"])
@require_admin
def refresh_stock_vista():
    """Refresh the stock_vista materialized view after SAP data import."""
    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            if not is_using_postgresql() or not _has_stock_vista(cur):
                return jsonify({"ok": False, "error": "Vista no disponible"}), 400
            cur.execute("REFRESH MATERIALIZED VIEW stock_vista")
            conn.commit()
            return jsonify({"ok": True, "message": "Vista actualizada"})
    except Exception as e:
        return safe_error_response(e, logger, context="stock.refresh_vista")


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
