"""
Migration 042: Webhooks Outbound
Creates tables for webhook endpoints and delivery log.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS webhook (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    eventos TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_delivery (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL,
    evento TEXT NOT NULL,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    response_body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES webhook(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_activo ON webhook(activo);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook_created
    ON webhook_delivery(webhook_id, created_at DESC);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS webhook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    eventos TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_delivery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    evento TEXT NOT NULL,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    response_body TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (webhook_id) REFERENCES webhook(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_activo ON webhook(activo);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook_created
    ON webhook_delivery(webhook_id, created_at DESC);
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
    logger.info(f"[Migration 042] webhook tables created ({db_type})")
    print(f"Migration 042 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS webhook_delivery")
        cur.execute("DROP TABLE IF EXISTS webhook")
    print("Migration 042 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
