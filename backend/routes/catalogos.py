from flask import Blueprint, jsonify

from backend.core.cache import cached, catalog_cache
from backend.core.db import get_db_connection

bp = Blueprint("catalogos", __name__)


def _fetch(query: str, mapper):
    """Ejecuta query y mapea resultados usando context manager"""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(query)
        rows = cur.fetchall()
        # El wrapper ya retorna dicts para PostgreSQL
        return [mapper(row if isinstance(row, dict) else dict(row)) for row in rows]


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


def _activo_condition():
    """Retorna la condición de activo correcta para la BD"""
    # Usar =1 para ambos porque la columna es INTEGER en ambas BDs
    return "activo=1"


@cached(catalog_cache, "centros", ttl=600)  # 10 min TTL
def _centros():
    return _fetch(
        f"SELECT codigo, nombre FROM catalog_centros WHERE {_activo_condition()}",
        lambda r: {"id": r["codigo"], "nombre": r["nombre"]},
    )


@cached(catalog_cache, "sectores", ttl=600)  # 10 min TTL
def _sectores():
    return _fetch(
        f"SELECT nombre FROM catalog_sectores WHERE {_activo_condition()}",
        lambda r: {"id": r["nombre"], "nombre": r["nombre"]},
    )


@cached(catalog_cache, "almacenes", ttl=600)  # 10 min TTL
def _almacenes():
    return _fetch(
        f"SELECT codigo, nombre FROM catalog_almacenes WHERE {_activo_condition()}",
        lambda r: {"id": r["codigo"], "nombre": r["nombre"] or r["codigo"]},
    )


@cached(catalog_cache, "usuarios", ttl=300)  # 5 min TTL (changes more often)
def _usuarios():
    return _fetch(
        "SELECT id_spm, nombre, apellido, mail, posicion FROM usuarios WHERE estado_registro='Activo'",
        lambda r: {
            "id": r["id_spm"],
            "nombre": f"{r['nombre']} {r['apellido']}",
            "mail": r["mail"] or "",
            "posicion": r.get("posicion") or "",
        },
    )
