import sqlite3
from pathlib import Path

from flask import Blueprint, jsonify

try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings

bp = Blueprint("catalogos", __name__)


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _fetch(query: str, mapper):
    path = _db_path()
    if not path.exists():
        return []
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query)
    rows = cur.fetchall()
    conn.close()
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


def _centros():
    return _fetch(
        "SELECT codigo, nombre FROM catalog_centros WHERE activo=1",
        lambda r: {"id": r["codigo"], "nombre": r["nombre"]},
    )


def _sectores():
    return _fetch(
        "SELECT nombre FROM catalog_sectores WHERE activo=1",
        lambda r: {"id": r["nombre"], "nombre": r["nombre"]},
    )


def _almacenes():
    return _fetch(
        "SELECT codigo, nombre FROM catalog_almacenes WHERE activo=1",
        lambda r: {"id": r["codigo"], "nombre": r["nombre"]},
    )


def _usuarios():
    return _fetch(
        "SELECT id_spm, nombre, apellido, mail FROM usuarios WHERE estado_registro='Activo'",
        lambda r: {
            "id": r["id_spm"],
            "nombre": f"{r['nombre']} {r['apellido']}",
            "mail": r["mail"],
        },
    )
