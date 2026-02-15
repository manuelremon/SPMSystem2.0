"""
Migration 039: Fix presupuesto_ledger tipo_movimiento CHECK constraint

Adds 'bur_revertido' to the allowed tipo_movimiento values.
SQLite: recreate table (cannot ALTER CHECK constraints).
PostgreSQL: DROP and re-ADD constraint.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_SQL = """
ALTER TABLE presupuesto_ledger DROP CONSTRAINT IF EXISTS presupuesto_ledger_tipo_movimiento_check;
ALTER TABLE presupuesto_ledger ADD CONSTRAINT presupuesto_ledger_tipo_movimiento_check
    CHECK (tipo_movimiento IN (
        'consumo_aprobacion', 'reversion_rechazo', 'ajuste_manual',
        'bur_aprobado', 'bur_revertido'
    ));
"""

SQLITE_SQL = [
    # 1. Create new table with updated constraint
    """CREATE TABLE presupuesto_ledger_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT UNIQUE NOT NULL,
        centro TEXT NOT NULL,
        sector TEXT NOT NULL,
        tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN (
            'consumo_aprobacion', 'reversion_rechazo', 'ajuste_manual',
            'bur_aprobado', 'bur_revertido'
        )),
        monto_cents INTEGER NOT NULL,
        saldo_anterior_cents INTEGER NOT NULL,
        saldo_posterior_cents INTEGER NOT NULL,
        referencia_tipo TEXT,
        referencia_id INTEGER,
        actor_id TEXT NOT NULL,
        actor_rol TEXT,
        motivo TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )""",
    # 2. Copy data
    "INSERT INTO presupuesto_ledger_new SELECT * FROM presupuesto_ledger",
    # 3. Drop old table
    "DROP TABLE presupuesto_ledger",
    # 4. Rename new table
    "ALTER TABLE presupuesto_ledger_new RENAME TO presupuesto_ledger",
    # 5. Recreate indexes
    "CREATE INDEX IF NOT EXISTS idx_ledger_centro_sector ON presupuesto_ledger(centro, sector)",
    "CREATE INDEX IF NOT EXISTS idx_ledger_tipo ON presupuesto_ledger(tipo_movimiento)",
    "CREATE INDEX IF NOT EXISTS idx_ledger_referencia ON presupuesto_ledger(referencia_tipo, referencia_id)",
    "CREATE INDEX IF NOT EXISTS idx_ledger_actor ON presupuesto_ledger(actor_id)",
    "CREATE INDEX IF NOT EXISTS idx_ledger_fecha ON presupuesto_ledger(created_at DESC)",
]


def run_migration():
    from backend.core.db import get_db_transaction, is_using_postgresql

    pg = is_using_postgresql()

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if pg:
            for statement in PG_SQL.strip().split(";"):
                statement = statement.strip()
                if statement:
                    cur.execute(statement)
        else:
            for statement in SQLITE_SQL:
                cur.execute(statement)

    db_type = "PostgreSQL" if pg else "SQLite"
    logger.info(
        f"[Migration 039] presupuesto_ledger constraint fixed ({db_type})"
    )
    print(f"Migration 039 applied successfully ({db_type})")


def rollback_migration():
    print("Migration 039 rollback: no-op (constraint is additive)")
