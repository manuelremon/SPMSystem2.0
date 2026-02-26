"""
Rutas para búsqueda de materiales.

Busca en master_materiales.db que contiene:
- catalogo_materiales: Catálogo de materiales SAP real
- materiales_mrp: Parámetros MRP por material
- materiales_equivalencias: Equivalencias entre materiales
"""

from flask import Blueprint, g, jsonify, request

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.roles import require_auth
from backend.core.search_utils import build_description_search

bp = Blueprint("materiales", __name__, url_prefix="/api/materiales")

# Tabla y conexión - en producción PG usa vistas de compatibilidad
_TABLA = "catalogo_materiales"
_DB = "master_materiales"
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


def _build_desc_query(q_desc: str, q_codigo: str, q_grupo: str, limit: int):
    """Build a smart description search query.

    Combines descripcion (short) + descripcion_larga (long) but avoids
    false positives from kits that merely mention a material as a
    sub-component.

    Strategy:
      - Match in descripcion (words with AND) → always included
      - Match in descripcion_larga only if the phrase appears at the
        START of the text (i.e. it describes the material itself, not
        a sub-component)
      - Results are sorted: descripcion matches first, then
        descripcion_larga starts-with matches, then by codigo.
    """
    from backend.core.search_utils import build_description_search, normalize_search_term

    normalized = normalize_search_term(q_desc)
    words = [w for w in normalized.split() if len(w) >= 2]
    if not words:
        return None, None

    phrase = " ".join(words)

    conditions = []
    params = []

    # Condition A: words match in descripcion (short)
    search_desc = build_description_search(q_desc, ["descripcion"])
    if search_desc:
        conditions.append(search_desc.where_clause)
        params.extend(search_desc.params)

    # Condition B: descripcion_larga STARTS WITH the phrase
    conditions.append("UPPER(descripcion_larga) LIKE ?")
    params.append(f"{phrase}%")

    desc_filter = "(" + " OR ".join(conditions) + ")"

    # Also add codigo filter if present
    filters = []
    if q_codigo:
        filters.append(f"UPPER({_COL_ID}) LIKE UPPER(?)")
        params.insert(0, f"%{q_codigo}%")
        # codigo OR description
        filters = ["(" + " OR ".join([filters[0], desc_filter]) + ")"]
    else:
        filters.append(desc_filter)

    if q_grupo:
        filters.append(f"UPPER({_COL_GRUPO}) LIKE UPPER(?)")
        params.append(f"%{q_grupo}%")

    where = "WHERE " + " AND ".join(filters)

    # Ranking: descripcion match = 0 (best), descripcion_larga starts-with = 1
    rank_parts = []
    rank_params = []
    if search_desc:
        rank_parts.append(f"CASE WHEN {search_desc.where_clause} THEN 0 ELSE 1 END")
        rank_params.extend(search_desc.params)
    else:
        rank_parts.append("1")

    order_by = f"ORDER BY {rank_parts[0]}, {_COL_ID} ASC"
    all_params = params + rank_params + [limit]

    query = f"""
        SELECT {_COL_ID} AS codigo, descripcion, descripcion_larga,
               {_COL_GRUPO} AS grupo_articulos, unidad_medida, precio_usd
        FROM {_TABLA}
        {where}
        {order_by}
        LIMIT ?
    """
    return query, tuple(all_params)


def _fallback_broad(q_desc: str, q_grupo: str, limit: int) -> list[dict]:
    """Broadest fallback: all words in descripcion OR descripcion_larga.

    Only used when the smart query returns 0 results.  Results where
    descripcion_larga starts with the phrase are sorted first.
    """
    from backend.core.search_utils import build_description_search, normalize_search_term

    normalized = normalize_search_term(q_desc)
    words = [w for w in normalized.split() if len(w) >= 2]
    if not words:
        return []

    phrase = " ".join(words)

    search = build_description_search(q_desc, ["descripcion", "descripcion_larga"])
    if not search:
        return []

    grupo_clause = ""
    grupo_params: list = []
    if q_grupo:
        grupo_clause = f" AND UPPER({_COL_GRUPO}) LIKE UPPER(?)"
        grupo_params = [f"%{q_grupo}%"]

    query = f"""
        SELECT {_COL_ID} AS codigo, descripcion, descripcion_larga,
               {_COL_GRUPO} AS grupo_articulos, unidad_medida, precio_usd
        FROM {_TABLA}
        WHERE {search.where_clause}{grupo_clause}
        ORDER BY (CASE WHEN UPPER(descripcion_larga) LIKE ? THEN 0 ELSE 1 END),
                 {_COL_ID} ASC
        LIMIT ?
    """
    params = list(search.params) + grupo_params + [f"{phrase}%", limit]
    return _fetch_catalogo(query, tuple(params))


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

    try:
        if q_desc:
            # Smart search: descripcion + descripcion_larga starts-with
            query, params = _build_desc_query(q_desc, q_codigo, q_grupo, limit)
            if query:
                rows = _fetch_catalogo(query, params)
                # If 0 results, broaden to all words in descripcion+descripcion_larga
                if not rows and not q_codigo:
                    rows = _fallback_broad(q_desc, q_grupo, limit)
                return jsonify({"ok": True, "data": rows, "total": len(rows)}), 200

        # Code-only or group-only search (no description)
        filters = []
        params = []
        if q_codigo:
            filters.append(f"UPPER({_COL_ID}) LIKE UPPER(?)")
            params.append(f"%{q_codigo}%")
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
            cur.execute(f"SELECT COUNT(DISTINCT {_COL_GRUPO}) FROM {_TABLA} WHERE {_COL_GRUPO} IS NOT NULL")
            stats["grupos_unicos"] = get_val(cur.fetchone(), 0)

        return jsonify({"ok": True, "data": stats}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "error", "message": str(e)}}), 500


# ═══════════════════════════════════════════════════════════════════════════
# FAVORITOS
# ═══════════════════════════════════════════════════════════════════════════


@bp.route("/favoritos", methods=["GET"])
@require_auth
def get_favoritos():
    """
    Obtiene la lista de materiales favoritos del usuario.

    Returns:
        Lista de favoritos con información del material desde catalogo_materiales
    """
    user_id = g.user.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": {"code": "unauthorized", "message": "Usuario no autenticado"}}), 401

    try:
        # Get favorite material codes
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material_codigo, created_at
                FROM user_material_favorito
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                (str(user_id),),
            )
            rows = cur.fetchall()

        if not rows:
            return jsonify({"ok": True, "data": []}), 200

        # Get material details from catalog
        codigos = [row[0] for row in rows]
        placeholders = ",".join(["?"] * len(codigos))

        query = f"""
            SELECT {_COL_ID} AS codigo, descripcion, descripcion_larga,
                   {_COL_GRUPO} AS grupo_articulos, unidad_medida, precio_usd
            FROM {_TABLA}
            WHERE {_COL_ID} IN ({placeholders})
        """

        material_data = _fetch_catalogo(query, tuple(codigos))
        material_map = {m["codigo"]: m for m in material_data}

        # Combine favorites with material info
        favoritos = []
        for row in rows:
            codigo = row[0]
            created_at = row[1]
            material = material_map.get(codigo, {})
            favoritos.append({
                "codigo": codigo,
                "created_at": created_at,
                "descripcion": material.get("descripcion", ""),
                "descripcion_larga": material.get("descripcion_larga", ""),
                "grupo_articulos": material.get("grupo_articulos", ""),
                "unidad_medida": material.get("unidad_medida", ""),
                "precio_usd": material.get("precio_usd", 0),
            })

        return jsonify({"ok": True, "data": favoritos}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "error", "message": str(e)}}), 500


@bp.route("/favoritos", methods=["POST"])
@require_auth
def add_favorito():
    """
    Agrega un material a favoritos del usuario.

    Body:
        material_codigo: Código del material a agregar

    Returns:
        Confirmación de adición
    """
    user_id = g.user.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": {"code": "unauthorized", "message": "Usuario no autenticado"}}), 401

    data = request.get_json() or {}
    material_codigo = (data.get("material_codigo") or "").strip()

    if not material_codigo:
        return jsonify({"ok": False, "error": {"code": "invalid_input", "message": "material_codigo es requerido"}}), 400

    try:
        # Verify material exists
        query = f"SELECT {_COL_ID} FROM {_TABLA} WHERE {_COL_ID} = ?"
        material_exists = _fetch_catalogo(query, (material_codigo,))

        if not material_exists:
            return jsonify({"ok": False, "error": {"code": "not_found", "message": "Material no encontrado"}}), 404

        # Add to favorites
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO user_material_favorito (user_id, material_codigo)
                VALUES (?, ?)
                ON CONFLICT (user_id, material_codigo) DO NOTHING
                """,
                (str(user_id), material_codigo),
            )

        return jsonify({"ok": True, "message": "Material agregado a favoritos"}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "error", "message": str(e)}}), 500


@bp.route("/favoritos/<codigo>", methods=["DELETE"])
@require_auth
def remove_favorito(codigo: str):
    """
    Elimina un material de favoritos del usuario.

    Args:
        codigo: Código del material a eliminar

    Returns:
        Confirmación de eliminación
    """
    user_id = g.user.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": {"code": "unauthorized", "message": "Usuario no autenticado"}}), 401

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                DELETE FROM user_material_favorito
                WHERE user_id = ? AND material_codigo = ?
                """,
                (str(user_id), codigo),
            )
            deleted = cur.rowcount > 0

        if not deleted:
            return jsonify({"ok": False, "error": {"code": "not_found", "message": "Favorito no encontrado"}}), 404

        return jsonify({"ok": True, "message": "Material eliminado de favoritos"}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "error", "message": str(e)}}), 500
