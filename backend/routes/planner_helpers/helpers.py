"""
Planner Helpers - Funciones auxiliares compartidas
"""

import json
import logging

from flask import jsonify

from backend.core.db import get_db_connection
from backend.core.errors import error_forbidden, error_not_found
from backend.core.user_helpers import get_user_by_id
from backend.routes.auth import _decode_token

logger = logging.getLogger(__name__)

# Alias para compatibilidad
_get_user = get_user_by_id


def _table_exists(conn, name: str) -> bool:
    """Verifica si una tabla existe en la BD (compatible PostgreSQL y SQLite)"""
    from backend.core.db import is_using_postgresql

    cur = conn.cursor()
    try:
        if is_using_postgresql():
            cur.execute(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)",
                (name,),
            )
            result = cur.fetchone()
            if not result:
                return False
            if hasattr(result, "get"):
                return bool(result.get("exists", False))
            return bool(result[0]) if result else False
        else:
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)
            )
            return cur.fetchone() is not None
    except Exception:
        return False


def _current_user():
    """Obtiene el usuario actual desde el token JWT"""
    payload = _decode_token("access", "spm_token")
    if isinstance(payload, tuple):
        return payload
    user = _get_user(payload.get("user_id"))
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            404,
        )
    return user


def _require_planner_role(user: dict):
    """
    Verifica que el usuario tenga rol de planificador o administrador.

    Returns:
        tuple: (error_response, is_admin)
            - (None, True) si es admin
            - (None, False) si es planificador
            - (error_response, False) si no tiene permisos
    """
    user_rol = user.get("rol", "")

    # Parsear roles (puede ser string simple o JSON array)
    roles = []
    if isinstance(user_rol, str):
        if user_rol.startswith("["):
            try:
                parsed = json.loads(user_rol)
                roles = parsed if isinstance(parsed, list) else [user_rol]
            except Exception:
                roles = [user_rol]
        else:
            roles = [user_rol]

    # Verificar si es Admin (tiene acceso total)
    is_admin = any("admin" in str(r).lower() for r in roles)
    if is_admin:
        return None, True

    # Verificar si es Planificador
    is_planner = any("planificador" in str(r).lower() or "planner" in str(r).lower() for r in roles)
    if is_planner:
        return None, False

    return error_forbidden("Rol requerido: planificador o administrador"), False


def _require_solicitud_access(solicitud_id: int):
    """Verifica acceso a una solicitud específica"""
    user = _current_user()
    if isinstance(user, tuple):
        return user, None
    guard, is_admin = _require_planner_role(user)
    if guard:
        return guard, None
    if is_admin:
        return None, user

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT planner_id FROM solicitud WHERE id=?", (solicitud_id,))
        row = cur.fetchone()

    if not row:
        return error_not_found("Solicitud", solicitud_id), None
    planner_id = (row["planner_id"] or "").strip()
    if planner_id and planner_id != str(
        user.get("id_spm") or user.get("usuario") or user.get("id")
    ):
        return error_forbidden("No tiene permiso para operar esta solicitud"), None
    return None, user


def _norm_codigo(val: str) -> str:
    """Normaliza código de material (quita espacios y ceros a la izquierda)"""
    base = (val or "").strip()
    if base.endswith(".0"):
        base = base[:-2]
    return base.lstrip("0")
