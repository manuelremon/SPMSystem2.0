#!/usr/bin/env python3
"""
Migracion 029: Indices de Rendimiento Adicionales

Esta migracion:
1. Crea indice compuesto en solicitud(status, updated_at)
2. Crea indice en solicitud(planner_id)
3. Crea indice en solicitud(centro, sector)
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
# Indices de rendimiento adicionales
# =============================================================================

INDEXES_POSTGRESQL = [
    # Indice para consultas de solicitudes por estado y fecha de actualizacion
    """
    CREATE INDEX IF NOT EXISTS idx_solicitud_status_updated
    ON solicitud(status, updated_at DESC)
    """,
    # Indice para busquedas por planificador asignado
    """
    CREATE INDEX IF NOT EXISTS idx_solicitud_planner_id
    ON solicitud(planner_id)
    """,
    # Indice para filtros por centro y sector
    """
    CREATE INDEX IF NOT EXISTS idx_solicitud_centro_sector
    ON solicitud(centro, sector)
    """,
]

INDEXES_SQLITE = [
    # Indice para consultas de solicitudes por estado y fecha de actualizacion (plural para SQLite dev)
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_status_updated
    ON solicitudes(status, updated_at DESC)
    """,
    # Indice para busquedas por planificador asignado (plural para SQLite dev)
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_planner_id
    ON solicitudes(planner_id)
    """,
    # Indice para filtros por centro y sector (plural para SQLite dev)
    """
    CREATE INDEX IF NOT EXISTS idx_solicitudes_centro_sector
    ON solicitudes(centro, sector)
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

    # PostgreSQL requiere autocommit para CREATE INDEX sin transaccion
    if db_type == "postgresql":
        conn.autocommit = True

    try:
        cursor = conn.cursor()
        indexes = INDEXES_POSTGRESQL if db_type == "postgresql" else INDEXES_SQLITE
        success_count = 0

        for idx_sql in indexes:
            idx_name = idx_sql.split("idx_")[1].split()[0] if "idx_" in idx_sql else "unknown"
            print(f"Creando indice idx_{idx_name}...")
            try:
                cursor.execute(idx_sql)
                success_count += 1
                print("  OK")
            except Exception as e:
                # La tabla puede no existir o el indice ya existe
                print(f"  Saltado: {e}")

        if db_type != "postgresql":
            conn.commit()

        print(f"Migracion 029 completada: {success_count}/{len(indexes)} indices creados ({db_type})")
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

        # PostgreSQL uses singular, SQLite uses plural
        if db_type == "postgresql":
            indexes_to_drop = [
                "idx_solicitud_status_updated",
                "idx_solicitud_planner_id",
                "idx_solicitud_centro_sector",
            ]
        else:
            indexes_to_drop = [
                "idx_solicitudes_status_updated",
                "idx_solicitudes_planner_id",
                "idx_solicitudes_centro_sector",
            ]

        for idx_name in indexes_to_drop:
            print(f"Eliminando indice {idx_name}...")
            try:
                cursor.execute(f"DROP INDEX IF EXISTS {idx_name}")
            except Exception as e:
                print(f"  Nota: {e}")

        conn.commit()
        print("Rollback de migracion 029 completado")
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
                WHERE tablename = 'solicitud'
                AND indexname LIKE 'idx_%'
            """)
            expected = [
                "idx_solicitud_status_updated",
                "idx_solicitud_planner_id",
                "idx_solicitud_centro_sector",
            ]
        else:
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='index' AND name LIKE 'idx_%'
            """)
            expected = [
                "idx_solicitudes_status_updated",
                "idx_solicitudes_planner_id",
                "idx_solicitudes_centro_sector",
            ]

        existing_indexes = [row[0] for row in cursor.fetchall()]

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
            print(f"Estado de migracion 029: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 029_performance_indexes.py [rollback|status]")
    else:
        run_migration()
