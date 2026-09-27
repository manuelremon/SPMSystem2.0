"""
Stock management endpoints.
Provides stock data with filters, inmovilizado and MRP indicators.

Uses materialized view `stock_vista` (migrations 094/103) for fast queries.
Inmovilizado: definicion unica en backend/services/inmovilizado_service.py.
Falls back to raw tables if the view doesn't exist.
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.helpers import safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.core.search_utils import build_description_search_with_catalog
from backend.services import inmovilizado_service

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
    Get stock data with server-side pagination (una fila por material+centro+almacen).

    Query params:
    - centro, almacen, material, descripcion: filters
    - inmovilizado, mrp: true/false filter
    - limit: page size (default 100, max 500)
    - offset: pagination offset
    - sort: column name (default stock_valorizado)
    - order: asc/desc (default desc)

    Inmovilizado = sin consumo en los 12 meses previos a la fecha de corte del
    stock (ver backend/services/inmovilizado_service.py). La marca SAP viene
    como `inmovilizado_sap` (informativa). `dias_sin_movimiento` es null si la
    clave nunca tuvo consumo.

    Returns:
    {
        ok: true,
        data: [rows],
        total: count,
        fecha_corte: "YYYY-MM-DD",
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

    if sort_col not in inmovilizado_service.COLUMNAS_ORDEN:
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

            # Fallback: tablas crudas (SQLite dev / PG sin la vista)
            corte = inmovilizado_service.fecha_corte(cur)
            results, total = inmovilizado_service.listar_stock(
                cur, centro, almacen, material, descripcion,
                inmovilizado_filter, mrp_filter, limit, offset,
                sort_col, sort_order, corte=corte)

            cur.execute("SELECT DISTINCT centro FROM stock WHERE stock > 0 ORDER BY centro")
            centros = [row["centro"] for row in cur.fetchall()]
            cur.execute("SELECT DISTINCT almacen FROM stock WHERE stock > 0 ORDER BY almacen")
            almacenes = [row["almacen"] for row in cur.fetchall()]

            return jsonify({
                "ok": True,
                "data": results,
                "total": total,
                "fecha_corte": corte.isoformat(),
                "filtros": {"centros": centros, "almacenes": almacenes}
            })

    except Exception as e:
        return safe_error_response(e, logger, context="stock.get_stock")


def _fecha_corte_vista(cur):
    """Fecha de corte con la que se calculo stock_vista (migracion 103)."""
    cur.execute("SELECT MAX(fecha_corte) FROM stock_vista")
    fila = cur.fetchone()
    return inmovilizado_service.a_fecha(fila[0] if fila else None) or inmovilizado_service.fecha_corte(cur)


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

    order_clause = inmovilizado_service.orden_sql(sort_col, sort_order, alias="sv")
    cur.execute(f"""
        SELECT material, descripcion, centro, centro_descripcion, almacen,
               stock, um, precio, stock_valorizado, inmovilizado, inmovilizado_sap,
               mrp, ultimo_consumo
        FROM stock_vista sv
        WHERE {where_sql}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
    """, params + [limit, offset])
    rows = cur.fetchall()

    corte = _fecha_corte_vista(cur)
    results = [inmovilizado_service.fila_stock(row, corte) for row in rows]

    # Filter options (cached in vista)
    cur.execute("SELECT DISTINCT centro FROM stock_vista ORDER BY centro")
    centros = [r["centro"] for r in cur.fetchall()]
    cur.execute("SELECT DISTINCT almacen FROM stock_vista ORDER BY almacen")
    almacenes = [r["almacen"] for r in cur.fetchall()]

    return jsonify({
        "ok": True,
        "data": results,
        "total": total,
        "fecha_corte": corte.isoformat(),
        "filtros": {"centros": centros, "almacenes": almacenes}
    })


@bp.route("/resumen", methods=["GET"])
@require_auth
def get_stock_resumen():
    """
    Get stock summary statistics (por material+centro+almacen).

    Query params:
    - centro: filter by plant code
    - almacen: filter by warehouse code

    Returns:
    {
        ok: true,
        data: {
            total_items, stock_total, valor_total,
            inmovilizado_items, inmovilizado_valor,
            mrp_items,
            sin_consumo_365d,   # sin consumo en los 12 meses al corte (= inmovilizado)
            fecha_corte         # "YYYY-MM-DD"
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

            data = inmovilizado_service.resumen_stock(cur, centro, almacen)
            return jsonify({"ok": True, "data": data})

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
            COUNT(*) FILTER (WHERE mrp = true) as mrp_items
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
            # Sin consumo en los 12 meses al corte (= inmovilizado)
            "sin_consumo_365d": row[3],
            "fecha_corte": _fecha_corte_vista(cur).isoformat(),
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
