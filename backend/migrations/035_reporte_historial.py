"""
Migration 035: Reporte Historial
Creates table for scheduled report history tracking.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS reporte_historial (
    id SERIAL PRIMARY KEY,
    tipo_reporte TEXT NOT NULL,
    frecuencia TEXT NOT NULL DEFAULT 'manual',
    parametros TEXT,
    resultado TEXT,
    archivo_path TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reporte_historial_tipo
    ON reporte_historial(tipo_reporte);
CREATE INDEX IF NOT EXISTS idx_reporte_historial_created
    ON reporte_historial(created_at);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS reporte_historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_reporte TEXT NOT NULL,
    frecuencia TEXT NOT NULL DEFAULT 'manual',
    parametros TEXT,
    resultado TEXT,
    archivo_path TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reporte_historial_tipo
    ON reporte_historial(tipo_reporte);
CREATE INDEX IF NOT EXISTS idx_reporte_historial_created
    ON reporte_historial(created_at);
"""


def run_migration():
    from backend.core.db import get_db_transaction, is_using_postgresql

    pg = is_using_postgresql()
    ddl = PG_DDL if pg else SQLITE_DDL

    with get_db_transaction() as conn:
        cur = conn.cursor()
        for statement in ddl.strip().split(";"):
            statement = statement.strip()
            if statement:
                cur.execute(statement)

    db_type = "PostgreSQL" if pg else "SQLite"
    logger.info(f"[Migration 035] reporte_historial table created ({db_type})")
    print(f"Migration 035 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS reporte_historial")
    print("Migration 035 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
