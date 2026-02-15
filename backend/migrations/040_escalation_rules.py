"""
Migration 040: Escalation Rules

Creates table for configurable approval escalation rules.
When a solicitud stays in 'submitted' state beyond timeout_dias,
it gets escalated to a higher role.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS regla_escalacion (
    id SERIAL PRIMARY KEY,
    centro TEXT,
    criticidad TEXT NOT NULL DEFAULT 'media',
    timeout_dias INTEGER NOT NULL DEFAULT 3,
    escalate_to_role TEXT NOT NULL DEFAULT 'admin',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regla_escalacion_activo
    ON regla_escalacion(activo);
CREATE INDEX IF NOT EXISTS idx_regla_escalacion_centro
    ON regla_escalacion(centro);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS regla_escalacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro TEXT,
    criticidad TEXT NOT NULL DEFAULT 'media',
    timeout_dias INTEGER NOT NULL DEFAULT 3,
    escalate_to_role TEXT NOT NULL DEFAULT 'admin',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_regla_escalacion_activo
    ON regla_escalacion(activo);
CREATE INDEX IF NOT EXISTS idx_regla_escalacion_centro
    ON regla_escalacion(centro);
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
    logger.info(f"[Migration 040] regla_escalacion table created ({db_type})")
    print(f"Migration 040 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS regla_escalacion")
    print("Migration 040 rolled back")
