#!/usr/bin/env python3
"""
Migracion 011: Indices de Rendimiento

Esta migracion:
1. Crea indice compuesto en solicitudes(status, created_at)
2. Crea indices adicionales para consultas frecuentes
"""

import os
import sys

# Soporte para PostgreSQL en produccion
try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

try:
    import sqlite3
    HAS_SQLITE = True
except ImportError:
    HAS_SQLITE = False

from pathlib import Path

DB_PATH = Path("data/spm.db")


def get_connection():
    """Obtiene conexion a la base de datos (PostgreSQL o SQLite)."""
    database_url = os.environ.get("DATABASE_URL")

    if database_url and HAS_PSYCOPG2:
        # PostgreSQL
        return psycopg2.connect(database_url), "postgresql"
    elif HAS_SQLITE and DB_PATH.exists():
        # SQLite
        return sqlite3.connect(DB_PATH), "sqlite"
    else:
        return None, None


# =============================================================================
# Indices de rendimiento
# =============================================================================

INDEXES_POSTGRESQL = [
    # Indice principal para consultas de solicitudes por estado
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_status_fecha
    ON solicitudes(status, created_at DESC)
    """,
    # Indice para busquedas por usuario
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_fecha
    ON solicitudes(id_usuario, created_at DESC)
    """,
    # Indice para historial de estados
    """
    CREATE INDEX IF NOT EXISTS idx_historial_estados_solicitud
    ON historial_estados(solicitud_id, created_at DESC)
    """,
    # Indice para notificaciones no leidas
    """
    CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
    ON notificaciones(user_id, leida, created_at DESC)
    """,
]

INDEXES_SQLITE = [
    # Indice principal para consultas de solicitudes por estado
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_status_fecha
    ON solicitudes(status, created_at DESC)
    """,
    # Indice para busquedas por usuario
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_fecha
    ON solicitudes(id_usuario, created_at DESC)
    """,
    # Indice para historial de estados
    """
    CREATE INDEX IF NOT EXISTS idx_historial_estados_solicitud
    ON historial_estados(solicitud_id, created_at DESC)
    """,
    # Indice para notificaciones no leidas
    """
    CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
    ON notificaciones(user_id, leida, created_at DESC)
    """,
]


def run_migration(db_path: Path = DB_PATH) -> bool:
    """
    Ejecuta la migracion.

    Args:
        db_path: Ruta a la base de datos (solo para SQLite)

    Returns:
        True si la migracion fue exitosa
    """
    conn, db_type = get_connection()

    if not conn:
        print("No se pudo conectar a la base de datos")
        return False

    try:
        cursor = conn.cursor()
        indexes = INDEXES_POSTGRESQL if db_type == "postgresql" else INDEXES_SQLITE

        for idx_sql in indexes:
            idx_name = idx_sql.split("idx_")[1].split()[0] if "idx_" in idx_sql else "unknown"
            print(f"Creando indice idx_{idx_name}...")
            try:
                cursor.execute(idx_sql)
            except Exception as e:
                # El indice puede ya existir
                print(f"  Nota: {e}")

        conn.commit()
        print(f"Migracion 011 completada exitosamente ({db_type})")
        return True

    except Exception as e:
        print(f"Error en migracion: {e}")
        return False
    finally:
        conn.close()


def rollback(db_path: Path = DB_PATH) -> bool:
    """Revierte la migracion."""
    conn, db_type = get_connection()

    if not conn:
        print("No se pudo conectar a la base de datos")
        return False

    try:
        cursor = conn.cursor()

        indexes_to_drop = [
            "idx_solicitudes_status_fecha",
            "idx_solicitudes_usuario_fecha",
            "idx_historial_estados_solicitud",
            "idx_notificaciones_usuario_leida",
        ]

        for idx_name in indexes_to_drop:
            print(f"Eliminando indice {idx_name}...")
            try:
                cursor.execute(f"DROP INDEX IF EXISTS {idx_name}")
            except Exception as e:
                print(f"  Nota: {e}")

        conn.commit()
        print("Rollback de migracion 011 completado")
        return True

    except Exception as e:
        print(f"Error en rollback: {e}")
        return False
    finally:
        conn.close()


def check_status(db_path: Path = DB_PATH) -> dict:
    """Verifica el estado de la migracion."""
    conn, db_type = get_connection()

    if not conn:
        return {"error": "No se pudo conectar a la base de datos"}

    try:
        cursor = conn.cursor()

        if db_type == "postgresql":
            cursor.execute("""
                SELECT indexname FROM pg_indexes
                WHERE tablename IN ('solicitudes', 'historial_estados', 'notificaciones')
                AND indexname LIKE 'idx_%'
            """)
        else:
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='index' AND name LIKE 'idx_%'
            """)

        existing_indexes = [row[0] for row in cursor.fetchall()]

        expected = [
            "idx_solicitudes_status_fecha",
            "idx_solicitudes_usuario_fecha",
            "idx_historial_estados_solicitud",
            "idx_notificaciones_usuario_leida",
        ]

        found = [idx for idx in expected if idx in existing_indexes]
        missing = [idx for idx in expected if idx not in existing_indexes]

        return {
            "status": "applied" if len(missing) == 0 else "partial",
            "db_type": db_type,
            "found_indexes": found,
            "missing_indexes": missing,
        }

    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "rollback":
            rollback()
        elif command == "status":
            status = check_status()
            print(f"Estado de migracion 011: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 011_performance_indexes.py [rollback|status]")
    else:
        run_migration()
