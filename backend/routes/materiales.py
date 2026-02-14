"""
Rutas para búsqueda de materiales.

Busca en master_materiales.db que contiene:
- catalogo_materiales: Catálogo de materiales SAP real
- materiales_mrp: Parámetros MRP por material
- materiales_equivalencias: Equivalencias entre materiales
"""

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.roles import require_auth
from backend.core.search_utils import build_description_search

bp = Blueprint("materiales", __name__, url_prefix="/api/materiales")

# Tabla y conexión según entorno
_PG = is_using_postgresql()
_TABLA = "cat_materiales" if _PG else "catalogo_materiales"
_DB = "spm" if _PG else "master_materiales"
# Columnas
_COL_ID = "codigo"
_COL_GRUPO = "grupo_articulos"


def _fetch_catalogo(query: str, params: tuple) -> list[dict]:
    """Ejecuta una query en la BD de catálogo y retorna lista de diccionarios."""
    with get_db_connection(_DB) as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()

    return [dict(row) for row in rows]


@bp.route("", methods=["GET"])
@require_auth
def search_materiales():
    """
    Búsqueda rápida de materiales por código o descripción.

    Busca en tabla catalogo_materiales de master_materiales.db

    Query params:
        codigo: Buscar por código de material (parcial)
        descripcion: Buscar por descripción (parcial)
        grupo: Buscar por grupo de artículos (parcial)
        limit: Máximo de resultados (default 500, max 500)

    Returns:
        Lista de materiales con: codigo, descripcion, descripcion_larga,
        grupo_articulos, unidad_medida, precio_usd
    """
    q_codigo = (request.args.get("codigo") or "").strip()
    q_desc = (request.args.get("descripcion") or "").strip()
    q_grupo = (request.args.get("grupo") or "").strip()
    limit = min(request.args.get("limit", 500, type=int), 500)

    filters = []
    params = []

    # Búsqueda por código o descripción (OR)
    search_conditions = []
    if q_codigo:
        search_conditions.append(f"UPPER({_COL_ID}) LIKE UPPER(?)")
        params.append(f"%{q_codigo}%")
    if q_desc:
        search = build_description_search(q_desc, ["descripcion", "descripcion_larga"])
        if search:
            search_conditions.append(search.where_clause)
            params.extend(search.params)

    if search_conditions:
        filters.append("(" + " OR ".join(search_conditions) + ")")

    # Filtro por grupo de artículos (AND)
    if q_grupo:
        filters.append(f"UPPER({_COL_GRUPO}) LIKE UPPER(?)")
        params.append(f"%{q_grupo}%")

    where = "WHERE " + " AND ".join(filters) if filters else ""

    query = f"""
        SELECT {_COL_ID} AS codigo, descripcion, descripcion_larga,
               {_COL_GRUPO} AS grupo_articulos, unidad_medida, precio_usd
        FROM {_TABLA}
        {where}
        ORDER BY {_COL_ID} ASC
        LIMIT ?
    """
    params.append(limit)

    try:
        rows = _fetch_catalogo(query, tuple(params))
        return jsonify({"ok": True, "data": rows, "total": len(rows)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "search_error", "message": str(e)}}), 500


@bp.route("/<codigo>", methods=["GET"])
@require_auth
def get_material(codigo: str):
    """
    Obtiene un material específico por su código desde master_materiales.db.

    Returns:
        Material completo o 404 si no existe
    """
    query = f"""
        SELECT
            {_COL_ID} AS codigo,
            descripcion,
            descripcion_larga,
            {_COL_GRUPO} AS grupo_articulos,
            unidad_medida,
            precio_usd
        FROM {_TABLA}
        WHERE {_COL_ID} = ?
    """

    try:
        rows = _fetch_catalogo(query, (codigo,))

        if not rows:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "not_found", "message": "Material no encontrado"}}
                ),
                404,
            )

        return jsonify({"ok": True, "data": rows[0]}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "error", "message": str(e)}}), 500


@bp.route("/grupos", methods=["GET"])
@require_auth
def get_grupos():
    """
    Obtiene la lista de grupos de artículos únicos desde master_materiales.db.

    Query params:
        q: Filtro de búsqueda parcial (opcional)
        limit: Máximo de resultados (default 100)

    Returns:
        Lista de grupos de artículos únicos
    """
    q = (request.args.get("q") or "").strip()
    limit = min(request.args.get("limit", 100, type=int), 100)

    where = ""
    params = []

    if q:
        where = f"WHERE UPPER({_COL_GRUPO}) LIKE UPPER(?)"
        params.append(f"%{q}%")

    query = f"""
        SELECT DISTINCT {_COL_GRUPO} AS grupo
        FROM {_TABLA}
        {where}
        ORDER BY {_COL_GRUPO} ASC
        LIMIT ?
    """
    params.append(limit)

    try:
        rows = _fetch_catalogo(query, tuple(params))
        # Convertir a formato esperado por frontend
        data = [row["grupo"] for row in rows if row.get("grupo")]
        return jsonify({"ok": True, "data": data, "total": len(data)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "search_error", "message": str(e)}}), 500


@bp.route("/stats", methods=["GET"])
@require_auth
def get_stats():
    """
    Obtiene estadísticas del catálogo de materiales desde master_materiales.db.

    Returns:
        Estadísticas del catálogo (total, con precio, precios min/max, grupos únicos)
    """
    try:
        with get_db_connection(_DB) as conn:
            cur = conn.cursor()

            stats = {}

            # Helper para acceso compatible con SQLite
            def get_val(row, idx):
                return row[idx] if row else 0

            # Total de materiales
            cur.execute(f"SELECT COUNT(*) FROM {_TABLA}")
            stats["total"] = get_val(cur.fetchone(), 0)

            # Materiales con precio
            cur.execute(f"SELECT COUNT(*) FROM {_TABLA} WHERE precio_usd > 0")
            stats["con_precio"] = get_val(cur.fetchone(), 0)

            # Precios min/max
            cur.execute(f"SELECT COALESCE(MIN(precio_usd), 0), COALESCE(MAX(precio_usd), 0) FROM {_TABLA}")
            row = cur.fetchone()
            stats["precio_min"] = get_val(row, 0)
            stats["precio_max"] = get_val(row, 1)

            # Grupos únicos
            cur.execute(f"SELECT COUNT(DISTINCT {_COL_GRUPO}) FROM {_TABLA} WHERE {_COL_GRUPO} IS NOT NULL AND {_COL_GRUPO} != ''")
            stats["grupos_unicos"] = get_val(cur.fetchone(), 0)

        return jsonify({"ok": True, "data": stats}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "error", "message": str(e)}}), 500
