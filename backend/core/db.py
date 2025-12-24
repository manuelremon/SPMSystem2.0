"""
Inicialización de la base de datos con SQLAlchemy y schema SQL.

Provee:
- Context managers para conexiones SQLite/PostgreSQL seguras
- Funciones helper centralizadas para acceso a BD
- Inicialización automática de schema
- Soporte dual: PostgreSQL (produccion) + SQLite (desarrollo/catalogs)
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
# Deteccion de tipo de BD
# =============================================================================


def is_using_postgresql() -> bool:
    """Detecta si la BD principal usa PostgreSQL"""
    return settings.DATABASE_URL.startswith("postgresql://")


# =============================================================================
# Helpers para Compatibilidad SQL SQLite/PostgreSQL
# =============================================================================


def sql_datetime_now() -> str:
    """
    Retorna expresión SQL para timestamp actual.

    Returns:
        'NOW()' para PostgreSQL, "datetime('now')" para SQLite
    """
    if is_using_postgresql():
        return "NOW()"
    return "datetime('now')"


def sql_now_minus(interval: str) -> str:
    """
    Retorna expresión SQL para NOW() - interval.

    Args:
        interval: Intervalo en formato "5 seconds", "90 days", etc.

    Returns:
        Expresión SQL compatible con el motor actual

    Example:
        >>> sql_now_minus("5 seconds")
        # PostgreSQL: "NOW() - INTERVAL '5 seconds'"
        # SQLite: "datetime('now', '-5 seconds')"
    """
    if is_using_postgresql():
        return f"NOW() - INTERVAL '{interval}'"
    return f"datetime('now', '-{interval}')"


def insert_returning_id(cursor, sql: str, params: tuple = None) -> int:
    """
    Ejecuta INSERT y retorna el ID generado.

    Para PostgreSQL agrega RETURNING id automáticamente.
    Para SQLite usa lastrowid.

    Args:
        cursor: Cursor de base de datos
        sql: Query INSERT (sin RETURNING para SQLite)
        params: Parámetros del query

    Returns:
        ID del registro insertado

    Example:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            new_id = insert_returning_id(
                cur,
                "INSERT INTO posts (titulo, contenido) VALUES (?, ?)",
                (titulo, contenido)
            )
    """
    if is_using_postgresql():
        # Agregar RETURNING id si no está presente
        if "RETURNING" not in sql.upper():
            sql = sql.rstrip(";").rstrip() + " RETURNING id"
        cursor.execute(sql, params)
        row = cursor.fetchone()
        if row is None:
            return None
        return row["id"] if isinstance(row, dict) else row[0]
    else:
        cursor.execute(sql, params)
        return cursor.lastrowid


class PostgresCursorWrapper:
    """Wrapper para cursor PostgreSQL que convierte ? a %s automaticamente"""

    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql, params=None):
        # Convertir ? a %s para compatibilidad con SQLite syntax
        sql = sql.replace("?", "%s")
        return self._cursor.execute(sql, params)

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        # Convertir a dict-like para compatibilidad con sqlite3.Row
        if hasattr(self._cursor, "description") and self._cursor.description:
            cols = [desc[0] for desc in self._cursor.description]
            return dict(zip(cols, row))
        return row

    def fetchall(self):
        rows = self._cursor.fetchall()
        if not rows:
            return []
        if hasattr(self._cursor, "description") and self._cursor.description:
            cols = [desc[0] for desc in self._cursor.description]
            return [dict(zip(cols, row)) for row in rows]
        return rows

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class PostgresConnectionWrapper:
    """Wrapper para conexion PostgreSQL que retorna cursor compatible"""

    def __init__(self, conn, pool=None):
        self._conn = conn
        self._pool = pool

    def cursor(self):
        return PostgresCursorWrapper(self._conn.cursor())

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        """Devuelve la conexión al pool en lugar de cerrarla"""
        if self._pool:
            self._pool.putconn(self._conn)
        else:
            self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)


# =============================================================================
# Connection Pool para PostgreSQL
# =============================================================================

_pg_pool = None


def _init_pg_pool():
    """Inicializa el pool de conexiones PostgreSQL (singleton)"""
    global _pg_pool
    if _pg_pool is None:
        import psycopg2.pool

        _pg_pool = psycopg2.pool.SimpleConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=settings.DATABASE_URL,
        )
    return _pg_pool


def close_pg_pool():
    """Cierra el pool de conexiones PostgreSQL (llamar al cerrar la app)"""
    global _pg_pool
    if _pg_pool:
        _pg_pool.closeall()
        _pg_pool = None


def _get_postgres_connection():
    """Obtiene conexion a PostgreSQL desde el pool con wrapper compatible"""
    try:
        pool = _init_pg_pool()
        conn = pool.getconn()
        return PostgresConnectionWrapper(conn, pool)
    except ImportError:
        raise ImportError("psycopg2-binary no instalado. Ejecuta: pip install psycopg2-binary")


# =============================================================================
# Context Managers para Conexiones SQLite/PostgreSQL
# =============================================================================


@contextmanager
def get_db_connection(db_name: str = "spm") -> Generator:
    """
    Context manager para conexiones de BD seguras.

    Soporta:
    - PostgreSQL para BD principal (spm) en produccion
    - SQLite para BDs secundarias (equivalentes, sap_data, catalogo)
    - SQLite para desarrollo local

    Garantiza que la conexión se cierre automáticamente, incluso si hay excepciones.

    Args:
        db_name: Nombre de la base de datos ("spm", "equivalentes", "sap_data")

    Yields:
        Conexion con row_factory/cursor configurado

    Example:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM usuarios")
            rows = cur.fetchall()
        # conn se cierra automáticamente aquí
    """
    conn = None
    try:
        # BDs secundarias SIEMPRE usan SQLite (son de solo lectura)
        if db_name in ("equivalentes", "sap_data", "catalogo_materiales"):
            db_path = get_db_path(db_name)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
        # BD principal: PostgreSQL o SQLite segun configuracion
        elif db_name == "spm" and is_using_postgresql():
            conn = _get_postgres_connection()
        else:
            db_path = get_db_path(db_name)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
        yield conn
    finally:
        if conn:
            conn.close()


@contextmanager
def get_db_transaction(db_name: str = "spm") -> Generator:
    """
    Context manager para transacciones con commit automático.

    Soporta PostgreSQL y SQLite.
    Si no hay excepciones, hace commit. Si hay excepción, hace rollback.

    Args:
        db_name: Nombre de la base de datos

    Yields:
        Conexion con row_factory/cursor configurado

    Example:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("INSERT INTO tabla VALUES (?)", (valor,))
        # commit automático si no hay error
    """
    conn = None
    try:
        # BDs secundarias SIEMPRE usan SQLite
        if db_name in ("equivalentes", "sap_data", "catalogo_materiales"):
            db_path = get_db_path(db_name)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
        # BD principal: PostgreSQL o SQLite segun configuracion
        elif db_name == "spm" and is_using_postgresql():
            conn = _get_postgres_connection()
        else:
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

    Nota: Solo aplica a SQLite. PostgreSQL se inicializa externamente.
    """
    from flask import current_app

    # Si es PostgreSQL, no inicializar con schema.sql
    # PostgreSQL se inicializa con migrations o manualmente
    if is_using_postgresql():
        current_app.logger.info("Usando PostgreSQL - saltando init_db() de SQLite")
        return

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
