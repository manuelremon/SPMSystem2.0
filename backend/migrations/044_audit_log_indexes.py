"""
Migration 044: Audit Log Indexes

Adds performance indexes to the audit_log table for the Audit Log UI Viewer.

Indexes:
- (created_at DESC) - For date range filtering
- (actor_id) - For user filtering
- (accion) - For action type filtering
- (entidad, entidad_id, created_at DESC) - For entity timeline queries

Fecha: 2026-02-15
"""

import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_entidad_timeline ON audit_log(entidad, entidad_id, created_at DESC)",
]

SQLITE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_entidad_timeline ON audit_log(entidad, entidad_id, created_at DESC)",
]


def run_migration():
    """Execute migration 044: add audit log indexes."""
    from backend.core.db import get_db_transaction, is_using_postgresql

    use_pg = is_using_postgresql()
    engine_name = "PostgreSQL" if use_pg else "SQLite"
    indexes = PG_INDEXES if use_pg else SQLITE_INDEXES

    logger.info("=" * 60)
    logger.info("Migration 044: Audit Log Indexes (%s)", engine_name)
    logger.info("=" * 60)

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            for idx_sql in indexes:
                try:
                    cursor.execute(idx_sql)
                except Exception as e:
                    logger.warning("  Index may already exist: %s", e)
            logger.info("  + %d indexes created/verified", len(indexes))

        logger.info("Migration 044 completed successfully (%s)", engine_name)
        return True

    except Exception as e:
        logger.error("Migration 044 failed: %s", e)
        import traceback
        traceback.print_exc()
        return False


def rollback_migration():
    """Rollback migration 044: drop audit log indexes."""
    from backend.core.db import get_db_transaction

    logger.info("Rollback 044: Dropping audit log indexes...")

    index_names = [
        "idx_audit_log_created_at",
        "idx_audit_log_actor_id",
        "idx_audit_log_accion",
        "idx_audit_log_entidad_timeline",
    ]

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            for idx_name in index_names:
                cursor.execute(f"DROP INDEX IF EXISTS {idx_name}")
                logger.info("  - Index %s dropped", idx_name)

        logger.info("Rollback 044 completed successfully")
        return True

    except Exception as e:
        logger.error("Rollback 044 failed: %s", e)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_migration()
    else:
        run_migration()
