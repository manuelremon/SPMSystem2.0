#!/usr/bin/env python3
"""
Migracion 030: Columnas de Scoring IA en Solicitudes

Agrega columnas para almacenar el score y prioridad calculados por IA:
- ai_score: Score numerico (0-1) calculado por ScoringPipeline
- ai_priority: Texto de prioridad ('Critica', 'Alta', 'Media', 'Baja')
"""

import os
import sys

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
        return psycopg2.connect(database_url), "postgresql"
    elif HAS_SQLITE and DB_PATH.exists():
        return sqlite3.connect(DB_PATH), "sqlite"
    else:
        return None, None


ALTER_POSTGRESQL = [
    "ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS ai_score REAL DEFAULT NULL",
    "ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS ai_priority TEXT DEFAULT NULL",
    "CREATE INDEX IF NOT EXISTS idx_solicitud_ai_score ON solicitud(ai_score DESC)",
]

ALTER_SQLITE = [
    # SQLite no tiene IF NOT EXISTS para ALTER TABLE, usamos try/except
    "ALTER TABLE solicitud ADD COLUMN ai_score REAL DEFAULT NULL",
    "ALTER TABLE solicitud ADD COLUMN ai_priority TEXT DEFAULT NULL",
    "CREATE INDEX IF NOT EXISTS idx_solicitud_ai_score ON solicitud(ai_score DESC)",
]


def run_migration(db_path: Path = DB_PATH) -> bool:
    """Ejecuta la migracion."""
    conn, db_type = get_connection()

    if not conn:
        print("No se pudo conectar a la base de datos")
        return False

    try:
        cursor = conn.cursor()
        statements = ALTER_POSTGRESQL if db_type == "postgresql" else ALTER_SQLITE
        success_count = 0

        for sql in statements:
            try:
                cursor.execute(sql)
                success_count += 1
                print(f"  OK: {sql[:60]}...")
            except Exception as e:
                # Columna ya existe u otro error no critico
                print(f"  Saltado: {e}")
                success_count += 1  # Contar como OK si ya existe

        conn.commit()
        print(f"Migracion 030 completada: {success_count}/{len(statements)} ({db_type})")
        return True

    except Exception as e:
        print(f"Error en migracion: {e}")
        conn.rollback()
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

        cursor.execute("DROP INDEX IF EXISTS idx_solicitud_ai_score")

        if db_type == "postgresql":
            cursor.execute("ALTER TABLE solicitud DROP COLUMN IF EXISTS ai_score")
            cursor.execute("ALTER TABLE solicitud DROP COLUMN IF EXISTS ai_priority")
        else:
            # SQLite no soporta DROP COLUMN en versiones antiguas
            print("Nota: SQLite no soporta DROP COLUMN, las columnas quedan en la tabla")

        conn.commit()
        print("Rollback de migracion 030 completado")
        return True

    except Exception as e:
        print(f"Error en rollback: {e}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback()
    else:
        run_migration()
