"""
Migration 088: Add stock consulta columns to decision_abastecimiento_fuentes

Adds columns needed for stock consultation workflow:
- estado_consulta: Track consultation status (pendiente/confirmado/rechazado/parcial)
- cantidad_confirmada: Confirmed quantity from warehouse
- fecha_disponibilidad: Expected availability date
- respuesta_comentario: Response notes
- respondido_por: User who responded
- respondido_at: Response timestamp

These columns were defined in migration 012 (SQLite-only) but never
applied to PostgreSQL.

Fecha: 2026-02-25
"""

import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

COLUMNS = [
    ("estado_consulta", "TEXT DEFAULT 'pendiente'"),
    ("cantidad_confirmada", "REAL"),
    ("fecha_disponibilidad", "TEXT"),
    ("respuesta_comentario", "TEXT"),
    ("respondido_por", "TEXT"),
    ("respondido_at", "TIMESTAMP"),
]


def up():
    from backend.core.db import get_db_transaction

    logger.info("=" * 60)
    logger.info("Migration 088: Add stock consulta columns")
    logger.info("=" * 60)

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            added = 0
            for col_name, col_type in COLUMNS:
                cursor.execute("SAVEPOINT col_check")
                try:
                    cursor.execute(
                        f"ALTER TABLE decision_abastecimiento_fuentes "
                        f"ADD COLUMN {col_name} {col_type}"
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

            logger.info("Migration 088 completed: %d columns added", added)
        return True
    except Exception as e:
        logger.error("Migration 088 failed: %s", e)
        import traceback
        traceback.print_exc()
        return False


def down():
    from backend.core.db import get_db_transaction, is_using_postgresql

    if not is_using_postgresql():
        logger.info("Rollback 088: SQLite does not support DROP COLUMN easily, skipping")
        return True

    logger.info("Rollback 088: Dropping consulta columns")

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            for col_name, _ in COLUMNS:
                try:
                    cursor.execute(
                        f"ALTER TABLE decision_abastecimiento_fuentes "
                        f"DROP COLUMN IF EXISTS {col_name}"
                    )
                    logger.info("  - Dropped column %s", col_name)
                except Exception as e:
                    logger.warning("  ~ Could not drop %s: %s", col_name, e)

        logger.info("Rollback 088 completed")
        return True
    except Exception as e:
        logger.error("Rollback 088 failed: %s", e)
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
