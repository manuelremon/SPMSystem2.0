"""
Rutas para búsqueda de materiales.

Usa la BD separada catalogo_materiales.db que contiene 44,461 materiales
importados desde el catálogo Excel de SAP.
"""

from flask import Blueprint, jsonify, request

try:
    from backend.core.db import get_db_connection
except ImportError:
    from core.db import get_db_connection

bp = Blueprint("materiales", __name__, url_prefix="/api/materiales")

# Nombre de la BD de catálogo de materiales
CATALOGO_DB = "catalogo_materiales"


def _fetch_catalogo(query: str, params: tuple) -> list[dict]:
    """Ejecuta una query en la BD de catálogo y retorna lista de diccionarios."""
    with get_db_connection(CATALOGO_DB) as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        rows = cur.fetchall()

    return [dict(row) for row in rows]


@bp.route("", methods=["GET"])
def search_materiales():
    """
    Búsqueda rápida de materiales por código o descripción.

    Query params:
        codigo: Buscar por código de material (parcial)
        descripcion: Buscar por descripción (parcial)
        limit: Máximo de resultados (default 500, max 500)

    Returns:
        Lista de materiales con: codigo, descripcion, descripcion_larga,
        grupo_articulos, unidad_medida, precio_usd
    """
    q_codigo = (request.args.get("codigo") or "").strip()
    q_desc = (request.args.get("descripcion") or "").strip()
    limit = min(request.args.get("limit", 500, type=int), 500)

    filters = ["activo = 1"]
    params = []

    # Use OR between codigo and descripcion (user may search by either)
    search_conditions = []
    if q_codigo:
        search_conditions.append("codigo LIKE ?")
        params.append(f"%{q_codigo}%")
    if q_desc:
        search_conditions.append("descripcion LIKE ?")
        params.append(f"%{q_desc}%")

    if search_conditions:
        filters.append("(" + " OR ".join(search_conditions) + ")")

    where = "WHERE " + " AND ".join(filters)

    query = f"""
        SELECT codigo, descripcion, descripcion_larga,
               grupo_articulos, unidad_medida, precio_usd
        FROM cat_materiales
        {where}
        ORDER BY codigo ASC
        LIMIT ?
    """
    params.append(limit)
    rows = _fetch_catalogo(query, tuple(params))
    return jsonify({"ok": True, "data": rows, "total": len(rows)}), 200


@bp.route("/<codigo>", methods=["GET"])
def get_material(codigo: str):
    """
    Obtiene un material específico por su código.

    Returns:
        Material completo o 404 si no existe
    """
    query = """
        SELECT codigo, descripcion, descripcion_larga,
               grupo_articulos, unidad_medida, precio_usd, activo
        FROM cat_materiales
        WHERE codigo = ?
    """
    rows = _fetch_catalogo(query, (codigo,))

    if not rows:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Material no encontrado"}}
            ),
            404,
        )

    return jsonify({"ok": True, "data": rows[0]}), 200


@bp.route("/stats", methods=["GET"])
def get_stats():
    """
    Obtiene estadísticas del catálogo de materiales.

    Returns:
        Conteo total, con precio, grupos únicos, etc.
    """
    with get_db_connection(CATALOGO_DB) as conn:
        cur = conn.cursor()

        stats = {}

        # Helper para acceso compatible PostgreSQL (dict) y SQLite (tuple)
        def get_val(row, key, idx):
            return row[key] if isinstance(row, dict) else row[idx]

        cur.execute("SELECT COUNT(*) as cnt FROM cat_materiales WHERE activo = 1")
        stats["total"] = get_val(cur.fetchone(), "cnt", 0)

        cur.execute("SELECT COUNT(*) as cnt FROM cat_materiales WHERE precio_usd IS NOT NULL AND activo = 1")
        stats["con_precio"] = get_val(cur.fetchone(), "cnt", 0)

        cur.execute("SELECT MIN(precio_usd) as min_p, MAX(precio_usd) as max_p FROM cat_materiales WHERE activo = 1")
        row = cur.fetchone()
        stats["precio_min"] = get_val(row, "min_p", 0)
        stats["precio_max"] = get_val(row, "max_p", 1)

        cur.execute("SELECT COUNT(DISTINCT grupo_articulos) as cnt FROM cat_materiales WHERE activo = 1")
        stats["grupos_unicos"] = get_val(cur.fetchone(), "cnt", 0)

    return jsonify({"ok": True, "data": stats}), 200
