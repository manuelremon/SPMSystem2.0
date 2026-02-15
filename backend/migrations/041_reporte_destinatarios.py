"""
Migration 041: Reporte Destinatarios
Creates table for scheduled report recipients and email tracking.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS reporte_destinatario (
    id SERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    nombre TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reporte_destinatario_reporte
        FOREIGN KEY (reporte_id)
        REFERENCES reporte_programado(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reporte_destinatario_reporte_id
    ON reporte_destinatario(reporte_id);
CREATE INDEX IF NOT EXISTS idx_reporte_destinatario_email
    ON reporte_destinatario(email);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS reporte_destinatario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporte_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    nombre TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reporte_id) REFERENCES reporte_programado(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reporte_destinatario_reporte_id
    ON reporte_destinatario(reporte_id);
CREATE INDEX IF NOT EXISTS idx_reporte_destinatario_email
    ON reporte_destinatario(email);
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
    logger.info(f"[Migration 041] reporte_destinatario table created ({db_type})")
    print(f"Migration 041 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS reporte_destinatario")
    print("Migration 041 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
