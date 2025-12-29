"""
Helpers consolidados para rutas del backend.

Este modulo centraliza funciones auxiliares que estaban duplicadas
en multiples archivos de rutas.

Migracion gradual: Los archivos originales pueden importar desde aqui
en lugar de redefinir las funciones.
"""

import logging
from typing import Any, Dict

import jwt
from flask import request
from jwt.exceptions import InvalidTokenError

from backend.core.config import settings
from backend.core.db import get_db_connection
from backend.core.roles import is_admin as roles_is_admin

logger = logging.getLogger(__name__)


# =============================================================================
# Database Helpers
# =============================================================================


def row_to_dict(row, cursor=None) -> dict | None:
    """
    Convierte una fila de BD a diccionario.

    Soporta:
    - PostgreSQL wrapper (ya retorna dicts)
    - SQLite Row objects
    - None (retorna None)

    Args:
        row: Fila de la base de datos
        cursor: Cursor (no usado, mantenido por compatibilidad)

    Returns:
        dict | None: Diccionario con los datos o None
    """
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(row)


# =============================================================================
# Request Helpers
# =============================================================================


def get_token_from_request(cookie_name: str = "spm_token") -> str | None:
    """
    Obtiene el token JWT del request.

    Busca en:
    1. Header Authorization (Bearer token)
    2. Cookie especificada

    Args:
        cookie_name: Nombre de la cookie (default: spm_token)

    Returns:
        str | None: Token JWT o None si no se encuentra
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.cookies.get(cookie_name)


def safe_json() -> dict | None:
    """
    Obtiene JSON del request de forma segura.

    Returns:
        dict | None: Diccionario parseado o None si es invalido
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


# =============================================================================
# User Helpers
# =============================================================================


def get_user_id_from_token(cookie_name: str = "spm_token") -> str | None:
    """
    Extrae el user_id del token JWT.

    Args:
        cookie_name: Nombre de la cookie (default: spm_token)

    Returns:
        str | None: ID del usuario o None
    """
    token = get_token_from_request(cookie_name)
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload.get("sub") or payload.get("user_id")
    except InvalidTokenError:
        return None


def get_current_user() -> Dict[str, Any] | None:
    """
    Obtiene datos del usuario actual desde el token JWT.

    Returns:
        dict | None: Diccionario con id, nombre, apellido o None
    """
    token = get_token_from_request()
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None

        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            return None

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id_spm, nombre, apellido FROM usuarios WHERE id_spm=?",
                (str(user_id),),
            )
            row = cur.fetchone()

            if row:
                return {
                    "id": row["id_spm"] if isinstance(row, dict) else row[0],
                    "nombre": row["nombre"] if isinstance(row, dict) else row[1],
                    "apellido": row["apellido"] if isinstance(row, dict) else row[2],
                }
        return None
    except InvalidTokenError:
        return None
    except Exception as e:
        logger.error(f"Error obteniendo usuario actual: {e}")
        return None


def is_admin(user_id: str) -> bool:
    """
    Verifica si el usuario tiene rol admin.

    Args:
        user_id: ID del usuario a verificar

    Returns:
        bool: True si es admin
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT rol FROM usuarios WHERE id_spm = ?", (user_id,))
            row = cursor.fetchone()
            if row:
                rol = row["rol"] if isinstance(row, dict) else row[0]
                return roles_is_admin(rol or "")
    except Exception as e:
        logger.error(f"Error verificando rol admin: {e}")
    return False


# =============================================================================
# Response Helpers (FIX 3.3)
# =============================================================================


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Dict[str, Any] | None = None,
) -> tuple:
    """
    FIX 3.3: Genera respuesta de error estandarizada.

    Formato consistente para todos los endpoints:
    {
        "ok": false,
        "error": {
            "code": "error_code",
            "message": "Mensaje legible",
            "details": {}
        }
    }

    Args:
        code: Código de error (snake_case, ej: "invalid_input")
        message: Mensaje legible para el usuario
        status_code: HTTP status code (default 400)
        details: Detalles adicionales opcionales

    Returns:
        tuple: (jsonify response, status_code)
    """
    from flask import jsonify

    response = {
        "ok": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details:
        response["error"]["details"] = details

    return jsonify(response), status_code


def success_response(data: Dict[str, Any] | None = None, message: str | None = None) -> dict:
    """
    Genera respuesta de éxito estandarizada.

    Args:
        data: Datos a incluir en la respuesta
        message: Mensaje opcional

    Returns:
        dict: Respuesta con ok=True
    """
    response = {"ok": True}
    if message:
        response["message"] = message
    if data:
        response.update(data)
    return response


# =============================================================================
# Timestamp Helpers (FIX 3.6)
# =============================================================================


def utc_now() -> str:
    """
    FIX 3.6: Retorna timestamp UTC actual en formato ISO 8601.

    Uso centralizado para consistencia en toda la aplicación.

    Returns:
        str: Timestamp ISO 8601 (ej: "2025-12-29T10:30:00+00:00")
    """
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def utc_now_naive() -> str:
    """
    Retorna timestamp UTC sin timezone (para SQLite).

    Returns:
        str: Timestamp sin TZ (ej: "2025-12-29 10:30:00")
    """
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


# =============================================================================
# Aliases para compatibilidad con codigo existente
# =============================================================================

# Funciones con underscore (estilo interno)
_row_to_dict = row_to_dict
_get_token_from_request = get_token_from_request
_safe_json = safe_json
_get_user_from_token = get_user_id_from_token
_get_current_user = get_current_user
_is_admin = is_admin
_error_response = error_response
_success_response = success_response
_utc_now = utc_now
