"""
Migration 038: Auto-Approval Rules
Creates table for configurable auto-approval rules.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS regla_auto_aprobacion (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    condiciones_json TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    centro_id TEXT,
    prioridad INTEGER NOT NULL DEFAULT 100,
    creado_por INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regla_auto_aprobacion_activo_prioridad
    ON regla_auto_aprobacion(activo, prioridad);
CREATE INDEX IF NOT EXISTS idx_regla_auto_aprobacion_centro
    ON regla_auto_aprobacion(centro_id);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS regla_auto_aprobacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    condiciones_json TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    centro_id TEXT,
    prioridad INTEGER NOT NULL DEFAULT 100,
    creado_por INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_regla_auto_aprobacion_activo_prioridad
    ON regla_auto_aprobacion(activo, prioridad);
CREATE INDEX IF NOT EXISTS idx_regla_auto_aprobacion_centro
    ON regla_auto_aprobacion(centro_id);
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
    logger.info(f"[Migration 038] regla_auto_aprobacion table created ({db_type})")
    print(f"Migration 038 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS regla_auto_aprobacion")
    print("Migration 038 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
