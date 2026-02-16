"""
User helpers - Funciones centralizadas para obtener usuarios

Este módulo centraliza la lógica de obtención de usuarios para evitar
duplicación en routes y services.
"""

import logging
from typing import Optional

from flask import g

from backend.core.db import get_db_connection

logger = logging.getLogger(__name__)


def get_user_by_id(user_id: str) -> Optional[dict]:
    """
    Obtiene un usuario por su ID (id_spm).

    Args:
        user_id: ID del usuario (id_spm)

    Returns:
        Diccionario con datos del usuario o None si no existe
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuario WHERE id_spm=?", (str(user_id),))
        row = cur.fetchone()
        if row is None:
            return None
        return row if isinstance(row, dict) else dict(row)


def get_user_by_username(username: str) -> Optional[dict]:
    """
    Obtiene un usuario por su nombre de usuario.

    Args:
        username: Nombre de usuario

    Returns:
        Diccionario con datos del usuario o None si no existe
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuario WHERE usuario=?", (username,))
        row = cur.fetchone()
        if row is None:
            return None
        return row if isinstance(row, dict) else dict(row)


def get_user_by_email(email: str) -> Optional[dict]:
    """
    Obtiene un usuario por su email.

    Args:
        email: Email del usuario

    Returns:
        Diccionario con datos del usuario o None si no existe
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuario WHERE mail=?", (email,))
        row = cur.fetchone()
        if row is None:
            return None
        return row if isinstance(row, dict) else dict(row)


def get_user_by_id_or_email(identifier: str) -> Optional[dict]:
    """
    Obtiene un usuario por su ID (id_spm) o email.
    Útil para login donde el usuario puede ingresar cualquiera de los dos.

    Args:
        identifier: ID del usuario o email

    Returns:
        Diccionario con datos del usuario o None si no existe
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM usuario WHERE id_spm=? OR mail=?",
            (identifier, identifier),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return row if isinstance(row, dict) else dict(row)


def get_user_name(user_id: str) -> str:
    """
    Obtiene el nombre completo de un usuario.

    Args:
        user_id: ID del usuario (id_spm)

    Returns:
        Nombre completo ("Nombre Apellido") o el user_id si no se encuentra
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT nombre, apellido FROM usuario WHERE id_spm=?",
                (str(user_id),),
            )
            row = cur.fetchone()
            if row:
                row_dict = row if isinstance(row, dict) else dict(row)
                return f"{row_dict['nombre']} {row_dict['apellido']}".strip()
    except Exception:
        pass
    return str(user_id)


def get_current_user_id() -> Optional[str]:
    """
    Obtiene el ID del usuario autenticado actual desde Flask g.user.

    Returns:
        ID del usuario o None si no hay usuario autenticado
    """
    user = getattr(g, "user", None)
    if not user:
        return None
    if isinstance(user, dict):
        return user.get("user_id") or user.get("id_spm") or user.get("id")
    return getattr(user, "user_id", None) or getattr(user, "id_spm", None)


def user_exists(user_id: str) -> bool:
    """
    Verifica si un usuario existe.

    Args:
        user_id: ID del usuario (id_spm)

    Returns:
        True si el usuario existe, False en caso contrario
    """
    return get_user_by_id(user_id) is not None
