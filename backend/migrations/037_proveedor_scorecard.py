"""
Migration 037: Proveedor Scorecard Persistente
Creates tables for persistent provider evaluation and metadata tracking.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS proveedor_evaluacion (
    id SERIAL PRIMARY KEY,
    proveedor_id TEXT NOT NULL,
    proveedor_nombre TEXT,
    periodo TEXT NOT NULL,
    calidad_score REAL DEFAULT 0,
    entrega_score REAL DEFAULT 0,
    precio_score REAL DEFAULT 0,
    servicio_score REAL DEFAULT 0,
    score_global REAL DEFAULT 0,
    evaluado_por INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proveedor_evaluacion_proveedor
    ON proveedor_evaluacion(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluacion_periodo
    ON proveedor_evaluacion(periodo);
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluacion_proveedor_periodo
    ON proveedor_evaluacion(proveedor_id, periodo);

CREATE TABLE IF NOT EXISTS proveedor_meta (
    id SERIAL PRIMARY KEY,
    proveedor_id TEXT NOT NULL,
    meta_key TEXT NOT NULL,
    meta_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proveedor_meta_proveedor
    ON proveedor_meta(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_meta_key
    ON proveedor_meta(proveedor_id, meta_key);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS proveedor_evaluacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id TEXT NOT NULL,
    proveedor_nombre TEXT,
    periodo TEXT NOT NULL,
    calidad_score REAL DEFAULT 0,
    entrega_score REAL DEFAULT 0,
    precio_score REAL DEFAULT 0,
    servicio_score REAL DEFAULT 0,
    score_global REAL DEFAULT 0,
    evaluado_por INTEGER,
    notas TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proveedor_evaluacion_proveedor
    ON proveedor_evaluacion(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluacion_periodo
    ON proveedor_evaluacion(periodo);
CREATE INDEX IF NOT EXISTS idx_proveedor_evaluacion_proveedor_periodo
    ON proveedor_evaluacion(proveedor_id, periodo);

CREATE TABLE IF NOT EXISTS proveedor_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id TEXT NOT NULL,
    meta_key TEXT NOT NULL,
    meta_value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proveedor_meta_proveedor
    ON proveedor_meta(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_proveedor_meta_key
    ON proveedor_meta(proveedor_id, meta_key);
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
    logger.info(f"[Migration 037] proveedor_evaluacion and proveedor_meta tables created ({db_type})")
    print(f"Migration 037 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS proveedor_evaluacion")
        cur.execute("DROP TABLE IF EXISTS proveedor_meta")
    print("Migration 037 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
