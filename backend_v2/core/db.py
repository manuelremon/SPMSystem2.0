"""
Inicialización de la base de datos con SQLAlchemy y schema SQL
"""

import sqlite3
from pathlib import Path

from flask_sqlalchemy import SQLAlchemy

try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings

db = SQLAlchemy()


def _get_db_path() -> Path:
    """Obtiene la ruta del archivo de base de datos"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _get_schema_path() -> Path:
    """Obtiene la ruta del archivo schema.sql"""
    return Path(__file__).parent / "schema.sql"


def _is_db_empty(db_path: Path) -> bool:
    """Verifica si la BD necesita inicialización (no existe o sin usuarios)"""
    if not db_path.exists():
        return True

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Verificar si la tabla usuarios existe Y tiene al menos un registro
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
        if cursor.fetchone() is None:
            conn.close()
            return True
        # La tabla existe, verificar si tiene datos
        cursor.execute("SELECT COUNT(*) FROM usuarios")
        count = cursor.fetchone()[0]
        conn.close()
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

    db_path = _get_db_path()
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

        # Ejecutar schema SQL
        try:
            schema_sql = schema_path.read_text(encoding="utf-8")
            conn = sqlite3.connect(db_path)
            conn.executescript(schema_sql)
            conn.commit()
            conn.close()
            current_app.logger.info("Database initialized from schema.sql")
        except Exception as e:
            current_app.logger.error(f"Error initializing database: {e}")
            raise
    else:
        current_app.logger.info("Database already initialized")
