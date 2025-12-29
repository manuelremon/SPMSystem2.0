"""
Funciones base para conexión a bases de datos.
Compartidas por todos los repositorios.
"""

import logging
import sqlite3
from pathlib import Path
from typing import Any

from backend.core.config import settings
from backend.core.db import is_using_postgresql, _get_postgres_connection

logger = logging.getLogger(__name__)


def _db_path() -> Path:
    """Obtiene ruta a base de datos desde configuración"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    # Para PostgreSQL, retorna path al directorio data para BDs secundarias
    return Path("data/spm.db")


def _connect():
    """Crea conexión a BD con row factory habilitado

    Retorna conexión PostgreSQL cuando está configurado, SQLite en caso contrario.
    Ambos retornan rows tipo dict para compatibilidad.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn, table_name: str) -> bool:
    """Verifica si una tabla existe (compatible PostgreSQL y SQLite)"""
    cur = conn.cursor()
    try:
        if is_using_postgresql():
            cur.execute(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)",
                (table_name,),
            )
            result = cur.fetchone()
            if not result:
                return False
            # PostgresCursorWrapper retorna dict-like, accedemos por clave 'exists'
            if hasattr(result, 'get'):
                return bool(result.get('exists', False))
            return bool(result[0]) if result else False
        else:
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,),
            )
            return cur.fetchone() is not None
    except Exception:
        return False


def _connect_catalogo():
    """Crea conexión a BD de catálogo de materiales

    En producción (PostgreSQL), todos los datos están en la misma BD.
    En desarrollo (SQLite), conecta a catalogo_materiales.db separado.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    catalogo_path = _db_path().parent / "catalogo_materiales.db"
    conn = sqlite3.connect(catalogo_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_equivalentes():
    """Crea conexión a BD de equivalencias

    En producción (PostgreSQL), todos los datos están en la misma BD.
    En desarrollo (SQLite), conecta a equivalentes.db separado.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    equiv_path = _db_path().parent / "equivalentes.db"
    conn = sqlite3.connect(equiv_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_sap_data():
    """Crea conexión a BD de datos SAP

    En producción (PostgreSQL), todos los datos están en la misma BD.
    En desarrollo (SQLite), conecta a sap_data.db separado.
    """
    if is_using_postgresql():
        # En PostgreSQL, stock y demás tablas están en la BD principal
        return _get_postgres_connection()
    sap_path = _db_path().parent / "sap_data.db"
    conn = sqlite3.connect(sap_path)
    conn.row_factory = sqlite3.Row
    return conn
