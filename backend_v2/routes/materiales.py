import sqlite3
from pathlib import Path

from flask import Blueprint, jsonify, request

try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings

bp = Blueprint("materiales", __name__, url_prefix="/api/materiales")


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _fetch(query: str, params: tuple) -> list[dict]:
    path = _db_path()
    if not path.exists():
        return []
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]


@bp.route("", methods=["GET"])
def search_materiales():
    """Búsqueda rápida de materiales por código o descripción breve."""
    q_codigo = (request.args.get("codigo") or "").strip()
    q_desc = (request.args.get("descripcion") or "").strip()
    limit = min(request.args.get("limit", 500, type=int), 500)

    filters = []
    params = []
    if q_codigo:
        filters.append("codigo LIKE ?")
        params.append(f"%{q_codigo}%")
    if q_desc:
        filters.append("descripcion LIKE ?")
        params.append(f"%{q_desc}%")

    where = "WHERE activo=1" if "activo" in _material_columns() else "WHERE 1=1"
    if filters:
        where += " AND " + " AND ".join(filters)

    query = f"""
        SELECT codigo, descripcion, descripcion_larga, unidad, precio_usd
        FROM materiales
        {where}
        ORDER BY codigo ASC
        LIMIT ?
    """
    params.append(limit)
    rows = _fetch(query, tuple(params))
    return jsonify(rows), 200


def _material_columns():
    path = _db_path()
    if not path.exists():
        return []
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(materiales)")
    cols = [r[1] for r in cur.fetchall()]
    conn.close()
    return cols
