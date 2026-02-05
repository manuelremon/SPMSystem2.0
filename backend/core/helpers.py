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


def get_user_id_from_context() -> str:
    """
    Obtiene el user_id del contexto de Flask (g).

    Busca en orden:
    1. g.user (set por auth middleware moderno)
    2. g.user_id (legacy)
    3. g.current_user (legacy alternativo)

    Returns:
        str: ID del usuario o string vacio si no autenticado
    """
    from flask import g

    # Formato moderno: g.user es un dict con datos del usuario
    user = getattr(g, "user", None)
    if user and isinstance(user, dict):
        return user.get("id_spm", "")

    # Formatos legacy
    user_id = getattr(g, "user_id", None)
    if user_id:
        return str(user_id)

    current_user = getattr(g, "current_user", None)
    if current_user and isinstance(current_user, dict):
        return current_user.get("id_spm", "")

    return ""


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
                "SELECT id_spm, nombre, apellido FROM usuario WHERE id_spm=?",
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
            cursor.execute("SELECT rol FROM usuario WHERE id_spm = ?", (user_id,))
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
# Catalog Helpers (SPRINT 2.2)
# =============================================================================


def resolve_sector_name(sector_value: str) -> str:
    """
    SPRINT 2.2: Resuelve el nombre del sector dado un ID o nombre.

    Centraliza la normalización de sector ID -> nombre para
    consistencia en todo el sistema de presupuestos.

    Si es numérico, busca en catalogo_sector.
    Si no encuentra, devuelve el valor original.

    Args:
        sector_value: ID numérico o nombre del sector

    Returns:
        str: Nombre del sector o valor original si no se encuentra
    """
    if not sector_value:
        return sector_value

    # Si es numérico, intentar buscar por ID
    if str(sector_value).isdigit():
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT nombre FROM catalogo_sector WHERE id = ?",
                    (int(sector_value),)
                )
                row = cur.fetchone()
                if row:
                    return row.get("nombre") if isinstance(row, dict) else row[0]
        except Exception as e:
            logger.warning(f"Error resolviendo sector {sector_value}: {e}")

    return sector_value


# =============================================================================
# Almacen Helpers (SPRINT 25 - Auditoría Post-Migración)
# =============================================================================


def get_user_almacenes(user_id: str) -> list[str]:
    """
    Obtiene la lista de almacenes permitidos para un usuario.

    El campo 'almacenes' puede estar en varios formatos:
    - JSON array: '["AA001", "II003"]'
    - CSV string: 'AA001,II003'
    - Single value: 'AA001'
    - Null/empty: sin restricción (acceso a todos)

    Args:
        user_id: ID del usuario

    Returns:
        list[str]: Lista de códigos de almacén permitidos.
                   Lista vacía significa acceso a todos los almacenes.
    """
    import json

    if not user_id:
        return []

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT almacenes, rol FROM usuario WHERE id_spm = ?",
                (str(user_id),)
            )
            row = cur.fetchone()

            if not row:
                return []

            almacenes_raw = row["almacenes"] if isinstance(row, dict) else row[0]
            rol = row["rol"] if isinstance(row, dict) else row[1]

            # Admins tienen acceso a todos los almacenes
            if roles_is_admin(rol or ""):
                return []  # Lista vacía = sin restricción

            if not almacenes_raw:
                return []

            almacenes_str = str(almacenes_raw).strip()
            if not almacenes_str:
                return []

            # Intentar parsear como JSON array
            if almacenes_str.startswith("["):
                try:
                    parsed = json.loads(almacenes_str)
                    if isinstance(parsed, list):
                        return [str(a).strip().upper() for a in parsed if a]
                except json.JSONDecodeError:
                    pass

            # Parsear como CSV
            if "," in almacenes_str:
                return [a.strip().upper() for a in almacenes_str.split(",") if a.strip()]

            # Valor único
            return [almacenes_str.upper()]

    except Exception as e:
        logger.error(f"Error obteniendo almacenes del usuario {user_id}: {e}")
        return []


def validate_almacen_access(user_id: str, almacen: str) -> bool:
    """
    Valida si un usuario tiene acceso a un almacén específico.

    Args:
        user_id: ID del usuario
        almacen: Código de almacén a validar

    Returns:
        bool: True si tiene acceso, False si no
    """
    if not almacen:
        return True  # Sin filtro específico, permitir

    almacenes_permitidos = get_user_almacenes(user_id)

    # Lista vacía significa acceso a todos (admin o sin restricción)
    if not almacenes_permitidos:
        return True

    # Normalizar y comparar
    almacen_upper = str(almacen).strip().upper()
    return almacen_upper in almacenes_permitidos


def get_user_almacenes_from_context() -> list[str]:
    """
    Obtiene almacenes permitidos del usuario actual desde el contexto Flask.

    Returns:
        list[str]: Lista de almacenes permitidos (vacía = sin restricción)
    """
    user_id = get_user_id_from_context()
    if not user_id:
        return []
    return get_user_almacenes(user_id)


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
_resolve_sector_name = resolve_sector_name
_get_user_id = get_user_id_from_context
_get_user_almacenes = get_user_almacenes
_validate_almacen_access = validate_almacen_access
_get_user_almacenes_from_context = get_user_almacenes_from_context
