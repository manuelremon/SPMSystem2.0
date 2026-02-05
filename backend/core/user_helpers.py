"""
User helpers - Funciones centralizadas para obtener usuarios

Este módulo centraliza la lógica de obtención de usuarios para evitar
duplicación en routes/admin.py, routes/budget.py, routes/planner.py, etc.
"""

from typing import Optional

from backend.core.db import get_db_connection


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


def user_exists(user_id: str) -> bool:
    """
    Verifica si un usuario existe.

    Args:
        user_id: ID del usuario (id_spm)

    Returns:
        True si el usuario existe, False en caso contrario
    """
    return get_user_by_id(user_id) is not None
