"""
Migration 089: Admin schema fixes

1. Add UNIQUE(centro, almacen) constraint to config_almacenes
   - Required for ON CONFLICT(centro, almacen) in POST /api/admin/config/almacenes
2. Add missing columns to budget_history
   - Original SQLite migration 023 had these columns, but they were lost
     when the table was recreated in PostgreSQL

Fecha: 2026-02-27
"""

import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

BUDGET_HISTORY_COLUMNS = [
    ("saldo_anterior_usd", "REAL"),
    ("saldo_nuevo_usd", "REAL"),
    ("solicitante_nombre", "TEXT"),
    ("aprobador_nombre", "TEXT"),
    ("justificacion", "TEXT"),
    ("bur_id", "TEXT"),
]


def up():
    from backend.core.db import get_db_transaction

    logger.info("=" * 60)
    logger.info("Migration 089: Admin schema fixes")
    logger.info("=" * 60)

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # 1. Add UNIQUE constraint on config_almacenes(centro, almacen)
            logger.info("[1/2] Adding UNIQUE(centro, almacen) to config_almacenes...")

            # First remove any duplicates (keep lowest id)
            cursor.execute("""
                DELETE FROM config_almacenes
                WHERE id NOT IN (
                    SELECT MIN(id) FROM config_almacenes
                    GROUP BY centro, almacen
                )
            """)

            cursor.execute("SAVEPOINT unique_check")
            try:
                cursor.execute("""
                    ALTER TABLE config_almacenes
                    ADD CONSTRAINT config_almacenes_centro_almacen_key
                    UNIQUE (centro, almacen)
                """)
                cursor.execute("RELEASE SAVEPOINT unique_check")
                logger.info("  + Added UNIQUE(centro, almacen)")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info("  ~ UNIQUE constraint already exists, skipping")
                    cursor.execute("ROLLBACK TO SAVEPOINT unique_check")
                else:
                    raise

            # 2. Add missing columns to budget_history
            logger.info("[2/2] Adding missing columns to budget_history...")
            added = 0
            for col_name, col_type in BUDGET_HISTORY_COLUMNS:
                cursor.execute("SAVEPOINT col_check")
                try:
                    cursor.execute(
                        f"ALTER TABLE budget_history ADD COLUMN {col_name} {col_type}"
                    )
                    cursor.execute("RELEASE SAVEPOINT col_check")
                    logger.info("  + Added column %s", col_name)
                    added += 1
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                        logger.info("  ~ Column %s already exists, skipping", col_name)
                        cursor.execute("ROLLBACK TO SAVEPOINT col_check")
                    else:
                        raise

            logger.info("Migration 089 completed: %d budget_history columns added", added)
        return True
    except Exception as e:
        logger.error("Migration 089 failed: %s", e)
        import traceback
        traceback.print_exc()
        return False


def down():
    from backend.core.db import get_db_transaction

    logger.info("Rollback 089: Removing admin schema fixes")

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Drop UNIQUE constraint
            try:
                cursor.execute("""
                    ALTER TABLE config_almacenes
                    DROP CONSTRAINT IF EXISTS config_almacenes_centro_almacen_key
                """)
                logger.info("  - Dropped UNIQUE(centro, almacen)")
            except Exception as e:
                logger.warning("  ~ Could not drop constraint: %s", e)

            # Drop added columns
            for col_name, _ in BUDGET_HISTORY_COLUMNS:
                try:
                    cursor.execute(
                        f"ALTER TABLE budget_history DROP COLUMN IF EXISTS {col_name}"
                    )
                    logger.info("  - Dropped column %s", col_name)
                except Exception as e:
                    logger.warning("  ~ Could not drop %s: %s", col_name, e)

        logger.info("Rollback 089 completed")
        return True
    except Exception as e:
        logger.error("Rollback 089 failed: %s", e)
        return False


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        down()
    else:
        up()
