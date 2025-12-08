"""
Inicialización de la base de datos con SQLAlchemy y schema SQL.

Provee:
- Context managers para conexiones SQLite seguras
- Funciones helper centralizadas para acceso a BD
- Inicialización automática de schema
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from flask_sqlalchemy import SQLAlchemy

try:
    from backend.core.config import settings
except ImportError:
    from core.config import settings

db = SQLAlchemy()


# =============================================================================
# Context Managers para Conexiones SQLite
# =============================================================================


@contextmanager
def get_db_connection(db_name: str = "spm") -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager para conexiones SQLite seguras.

    Garantiza que la conexión se cierre automáticamente, incluso si hay excepciones.

    Args:
        db_name: Nombre de la base de datos ("spm", "equivalentes", "sap_data")

    Yields:
        sqlite3.Connection con row_factory configurado

    Example:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM usuarios")
            rows = cur.fetchall()
        # conn se cierra automáticamente aquí
    """
    conn = None
    try:
        db_path = get_db_path(db_name)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        yield conn
    finally:
        if conn:
            conn.close()


@contextmanager
def get_db_transaction(db_name: str = "spm") -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager para transacciones SQLite con commit automático.

    Si no hay excepciones, hace commit. Si hay excepción, hace rollback.

    Args:
        db_name: Nombre de la base de datos

    Yields:
        sqlite3.Connection con row_factory configurado

    Example:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO tabla VALUES (?)", (valor,))
        # commit automático si no hay error
    """
    conn = None
    try:
        db_path = get_db_path(db_name)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        yield conn
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


# =============================================================================
# Funciones Helper para Rutas de BD
# =============================================================================


def get_db_path(db_name: str = "spm") -> Path:
    """
    Obtiene la ruta del archivo de base de datos.

    Args:
        db_name: Nombre de la BD ("spm", "equivalentes", "sap_data")

    Returns:
        Path al archivo .db
    """
    # Directorio base de datos
    if settings.DATABASE_URL.startswith("sqlite:///"):
        base_path = Path(settings.DATABASE_URL.split("sqlite:///", 1)[1]).parent
    else:
        base_path = Path("data")

    # Mapeo de nombres a archivos
    db_files = {
        "spm": "spm.db",
        "equivalentes": "equivalentes.db",
        "sap_data": "sap_data.db",
        "catalogo_materiales": "catalogo_materiales.db",
    }

    filename = db_files.get(db_name, f"{db_name}.db")
    return base_path / filename


def get_spm_db_path() -> Path:
    """Obtiene la ruta a la BD principal (spm.db)"""
    return get_db_path("spm")


def get_equivalentes_db_path() -> Path:
    """Obtiene la ruta a la BD de equivalencias (equivalentes.db)"""
    return get_db_path("equivalentes")


def get_sap_data_db_path() -> Path:
    """Obtiene la ruta a la BD de datos SAP (sap_data.db)"""
    return get_db_path("sap_data")


def get_catalogo_materiales_db_path() -> Path:
    """Obtiene la ruta a la BD del catálogo de materiales (catalogo_materiales.db)"""
    return get_db_path("catalogo_materiales")


# =============================================================================
# Funciones Internas para Inicialización
# =============================================================================


def _get_schema_path() -> Path:
    """Obtiene la ruta del archivo schema.sql"""
    return Path(__file__).parent / "schema.sql"


def _is_db_empty(db_path: Path) -> bool:
    """Verifica si la BD necesita inicialización (no existe o sin usuarios)"""
    if not db_path.exists():
        return True

    try:
        # Usamos conexión directa aquí porque necesitamos verificar existencia primero
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            # Verificar si la tabla usuarios existe
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
            if cursor.fetchone() is None:
                return True
            # La tabla existe, verificar si tiene datos
            cursor.execute("SELECT COUNT(*) FROM usuarios")
            count = cursor.fetchone()[0]
            return count == 0  # Vacía = necesita inicialización
    except Exception:
        return True


def init_db():
    """
    Inicializa la base de datos.

    Si la BD no existe o está vacía (sin usuarios), elimina y recrea
    desde schema.sql con todas las tablas y datos iniciales.
    """
    from flask import current_app

    db_path = get_spm_db_path()
    schema_path = _get_schema_path()

    # Verificar si necesitamos inicializar
    needs_init = _is_db_empty(db_path)

    if needs_init:
        current_app.logger.info(f"BD no encontrada o vacía: {db_path}")

        if not schema_path.exists():
            current_app.logger.error(f"Schema no encontrado: {schema_path}")
            return

        # Si la BD existe pero está vacía, eliminarla para empezar limpio
        if db_path.exists():
            current_app.logger.info(f"Eliminando BD vacía para reinicializar: {db_path}")
            db_path.unlink()

        # Asegurar que el directorio existe
        db_path.parent.mkdir(parents=True, exist_ok=True)

        # Ejecutar schema SQL usando context manager nativo de sqlite3
        try:
            schema_sql = schema_path.read_text(encoding="utf-8")
            with sqlite3.connect(db_path) as conn:
                conn.executescript(schema_sql)
                conn.commit()
            current_app.logger.info("Database initialized from schema.sql")
        except Exception as e:
            current_app.logger.error(f"Error initializing database: {e}")
            raise
    else:
        current_app.logger.info("Database already initialized")
