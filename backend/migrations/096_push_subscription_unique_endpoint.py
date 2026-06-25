"""
Migration 096: Agregar UNIQUE(endpoint) a la tabla de suscripciones push.

PROBLEMA:
  push_service.subscribe() ejecuta un INSERT ... ON CONFLICT(endpoint) DO UPDATE.
  En PostgreSQL, ON CONFLICT(endpoint) requiere una constraint UNIQUE (o indice
  unico) sobre la columna endpoint. _ensure_table() define `endpoint TEXT UNIQUE`,
  pero usa CREATE TABLE IF NOT EXISTS, por lo que NO modifica una tabla que ya
  existe. El schema de produccion se importo desde pg_dump SIN constraints (ver
  migracion 085), por lo que la columna endpoint quedo sin UNIQUE y cada
  POST /api/push/subscribe devuelve 500:
    "there is no unique or exclusion constraint matching the ON CONFLICT
     specification"

SOLUCION:
  Agregar UNIQUE(endpoint) de forma idempotente, deduplicando primero las filas
  con endpoint repetido (se conserva la de menor id).

NOTA: La tabla puede llamarse `notificacion_push_suscripcion` (nombre original)
  o `push_subscriptions` (renombrada por el dump SQLite->PG). Se detecta cual
  existe y se opera sobre ella.

Fecha: 2026-06-25
"""

import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

# Posibles nombres de la tabla (orden de preferencia)
CANDIDATE_TABLES = ["notificacion_push_suscripcion", "push_subscriptions"]


def _find_table(cursor, is_pg):
    """Devuelve el nombre de la tabla de suscripciones push que existe, o None."""
    for name in CANDIDATE_TABLES:
        if is_pg:
            cursor.execute(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
                """,
                (name,),
            )
        else:
            cursor.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                (name,),
            )
        if cursor.fetchone():
            return name
    return None


def up():
    from backend.core.db import get_db_transaction, is_using_postgresql

    logger.info("=" * 60)
    logger.info("Migration 096: UNIQUE(endpoint) en suscripciones push")
    logger.info("=" * 60)

    is_pg = is_using_postgresql()

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            table = _find_table(cursor, is_pg)
            if table is None:
                # La tabla aun no existe (la crea _ensure_table en runtime ya con
                # UNIQUE). Nada que arreglar.
                logger.info("  ~ Tabla de suscripciones push no existe todavia, skip")
                return True

            logger.info("  Tabla detectada: %s", table)

            # 1. Deduplicar endpoints (conservar el id mas bajo)
            cursor.execute(
                f"""
                DELETE FROM {table}
                WHERE id NOT IN (
                    SELECT MIN(id) FROM {table} GROUP BY endpoint
                )
                """
            )
            removed = cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else 0
            if removed:
                logger.info("  + Eliminados %d endpoints duplicados", removed)

            # 2. Agregar la constraint/indice UNIQUE de forma idempotente
            if is_pg:
                constraint = f"uq_{table}_endpoint"
                cursor.execute("SAVEPOINT unique_check")
                try:
                    cursor.execute(
                        f"""
                        ALTER TABLE {table}
                        ADD CONSTRAINT {constraint}
                        UNIQUE (endpoint)
                        """
                    )
                    cursor.execute("RELEASE SAVEPOINT unique_check")
                    logger.info("  + Agregada constraint UNIQUE(endpoint)")
                except Exception as e:
                    if "already exists" in str(e).lower():
                        logger.info("  ~ UNIQUE(endpoint) ya existe, skip")
                        cursor.execute("ROLLBACK TO SAVEPOINT unique_check")
                    else:
                        raise
            else:
                cursor.execute(
                    f"""
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_{table}_endpoint
                    ON {table}(endpoint)
                    """
                )
                logger.info("  + Indice UNIQUE(endpoint) creado")

        logger.info("Migration 096 completada")
        return True
    except Exception as e:
        logger.error("Migration 096 failed: %s", e)
        import traceback

        traceback.print_exc()
        return False


def down():
    from backend.core.db import get_db_transaction, is_using_postgresql

    logger.info("Rollback 096: Eliminando UNIQUE(endpoint) de suscripciones push")

    is_pg = is_using_postgresql()

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            table = _find_table(cursor, is_pg)
            if table is None:
                return True

            if is_pg:
                cursor.execute(
                    f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS uq_{table}_endpoint"
                )
            else:
                cursor.execute(f"DROP INDEX IF EXISTS uq_{table}_endpoint")

        logger.info("Rollback 096 completado")
        return True
    except Exception as e:
        logger.error("Rollback 096 failed: %s", e)
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
