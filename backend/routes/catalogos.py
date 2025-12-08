from flask import Blueprint, jsonify

try:
    from backend.core.cache import cached, catalog_cache
    from backend.core.db import get_db_connection, get_spm_db_path
except ImportError:
    from core.cache import cached, catalog_cache
    from core.db import get_db_connection, get_spm_db_path

bp = Blueprint("catalogos", __name__)


def _fetch(query: str, mapper):
    """Ejecuta query y mapea resultados usando context manager"""
    db_path = get_spm_db_path()
    if not db_path.exists():
        return []

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(query)
        rows = cur.fetchall()
        return [mapper(row) for row in rows]


@bp.route("", methods=["GET"])
def get_catalogos():
    """Catálogo combinado desde la base real"""
    return (
        jsonify(
            {
                "centros": _centros(),
                "sectores": _sectores(),
                "almacenes": _almacenes(),
                "usuarios": _usuarios(),
            }
        ),
        200,
    )


@bp.route("/centros", methods=["GET"])
def get_centros():
    return jsonify(_centros()), 200


@bp.route("/sectores", methods=["GET"])
def get_sectores():
    return jsonify(_sectores()), 200


@bp.route("/almacenes", methods=["GET"])
def get_almacenes():
    return jsonify(_almacenes()), 200


@bp.route("/usuarios", methods=["GET"])
def get_usuarios():
    return jsonify(_usuarios()), 200


@cached(catalog_cache, "centros", ttl=600)  # 10 min TTL
def _centros():
    return _fetch(
        "SELECT codigo, nombre FROM catalog_centros WHERE activo=1",
        lambda r: {"id": r["codigo"], "nombre": r["nombre"]},
    )


@cached(catalog_cache, "sectores", ttl=600)  # 10 min TTL
def _sectores():
    return _fetch(
        "SELECT nombre FROM catalog_sectores WHERE activo=1",
        lambda r: {"id": r["nombre"], "nombre": r["nombre"]},
    )


@cached(catalog_cache, "almacenes", ttl=600)  # 10 min TTL
def _almacenes():
    return _fetch(
        "SELECT codigo, nombre FROM catalog_almacenes WHERE activo=1",
        lambda r: {"id": r["codigo"], "nombre": r["nombre"]},
    )


@cached(catalog_cache, "usuarios", ttl=300)  # 5 min TTL (changes more often)
def _usuarios():
    return _fetch(
        "SELECT id_spm, nombre, apellido, mail FROM usuarios WHERE estado_registro='Activo'",
        lambda r: {
            "id": r["id_spm"],
            "nombre": f"{r['nombre']} {r['apellido']}",
            "mail": r["mail"],
        },
    )
