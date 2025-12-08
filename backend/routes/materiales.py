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

    if q_codigo:
        filters.append("codigo LIKE ?")
        params.append(f"%{q_codigo}%")
    if q_desc:
        filters.append("descripcion LIKE ?")
        params.append(f"%{q_desc}%")

    where = "WHERE " + " AND ".join(filters)

    query = f"""
        SELECT codigo, descripcion, descripcion_larga,
               grupo_articulos, unidad_medida, precio_usd
        FROM materiales
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
        FROM materiales
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

        cur.execute("SELECT COUNT(*) FROM materiales WHERE activo = 1")
        stats["total"] = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM materiales WHERE precio_usd IS NOT NULL AND activo = 1")
        stats["con_precio"] = cur.fetchone()[0]

        cur.execute("SELECT MIN(precio_usd), MAX(precio_usd) FROM materiales WHERE activo = 1")
        row = cur.fetchone()
        stats["precio_min"] = row[0]
        stats["precio_max"] = row[1]

        cur.execute("SELECT COUNT(DISTINCT grupo_articulos) FROM materiales WHERE activo = 1")
        stats["grupos_unicos"] = cur.fetchone()[0]

    return jsonify({"ok": True, "data": stats}), 200
