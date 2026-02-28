"""
Migration 090: Fix demand planning constraints, seed data states, and production states.

Adds UNIQUE constraints needed for ON CONFLICT upsert queries in
demand_planning_service.py (generar_baseline_ml, calcular_consenso).

Also normalizes any invalid estados from seed data (demand + production).
"""

import logging

logger = logging.getLogger(__name__)


def up():
    from backend.core.db import get_db_connection

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Add unique constraint on plan_demanda_entrada (plan_id, material_codigo, fuente)
        #    Required for ON CONFLICT in generar_baseline_ml
        cursor.execute("""
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'plan_demanda_entrada'
            AND indexname = 'uq_plan_demanda_entrada_plan_material_fuente'
        """)
        if not cursor.fetchone():
            # Remove duplicate rows first (keep lowest id)
            cursor.execute("""
                DELETE FROM plan_demanda_entrada a
                USING plan_demanda_entrada b
                WHERE a.plan_id = b.plan_id
                  AND a.material_codigo = b.material_codigo
                  AND a.fuente = b.fuente
                  AND a.id > b.id
            """)
            deleted = cursor.rowcount
            if deleted:
                logger.info(f"  Removed {deleted} duplicate plan_demanda_entrada rows")

            cursor.execute("""
                CREATE UNIQUE INDEX uq_plan_demanda_entrada_plan_material_fuente
                ON plan_demanda_entrada (plan_id, material_codigo, fuente)
            """)
            logger.info("  Created unique index on plan_demanda_entrada (plan_id, material_codigo, fuente)")

        # 2. Add unique constraint on plan_demanda_consenso (plan_id, material_codigo)
        #    Required for ON CONFLICT in calcular_consenso
        cursor.execute("""
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'plan_demanda_consenso'
            AND indexname = 'uq_plan_demanda_consenso_plan_material'
        """)
        if not cursor.fetchone():
            # Remove duplicate rows first (keep lowest id)
            cursor.execute("""
                DELETE FROM plan_demanda_consenso a
                USING plan_demanda_consenso b
                WHERE a.plan_id = b.plan_id
                  AND a.material_codigo = b.material_codigo
                  AND a.id > b.id
            """)
            deleted = cursor.rowcount
            if deleted:
                logger.info(f"  Removed {deleted} duplicate plan_demanda_consenso rows")

            cursor.execute("""
                CREATE UNIQUE INDEX uq_plan_demanda_consenso_plan_material
                ON plan_demanda_consenso (plan_id, material_codigo)
            """)
            logger.info("  Created unique index on plan_demanda_consenso (plan_id, material_codigo)")

        # 3. Normalize any invalid estados (from seed data)
        cursor.execute("""
            UPDATE plan_demanda SET estado = 'collecting' WHERE estado = 'active'
        """)
        cursor.execute("""
            UPDATE plan_demanda SET estado = 'closed' WHERE estado = 'archived'
        """)

        # 4. Fix production plan states (English → Spanish)
        cursor.execute("""
            UPDATE plan_produccion SET estado = 'en_ejecucion' WHERE estado = 'in_progress'
        """)
        fixed = cursor.rowcount
        if fixed:
            logger.info(f"  Fixed {fixed} plan_produccion rows: in_progress -> en_ejecucion")

        cursor.execute("""
            UPDATE plan_produccion SET estado = 'cancelado' WHERE estado = 'cancelled'
        """)
        fixed = cursor.rowcount
        if fixed:
            logger.info(f"  Fixed {fixed} plan_produccion rows: cancelled -> cancelado")

        cursor.execute("""
            UPDATE plan_produccion SET estado = 'completado' WHERE estado = 'completed'
        """)
        fixed = cursor.rowcount
        if fixed:
            logger.info(f"  Fixed {fixed} plan_produccion rows: completed -> completado")

        # 5. Ensure at least some work centers are active
        cursor.execute("""
            UPDATE work_center SET estado = 'active'
            WHERE id IN (
                SELECT id FROM work_center
                WHERE estado != 'active'
                ORDER BY id
                LIMIT 3
            )
        """)
        fixed = cursor.rowcount
        if fixed:
            logger.info(f"  Activated {fixed} work centers")

        conn.commit()
        logger.info("Migration 090 completed successfully")

    except Exception as e:
        conn.rollback()
        logger.error(f"Migration 090 failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def down():
    from backend.core.db import get_db_connection

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("DROP INDEX IF EXISTS uq_plan_demanda_entrada_plan_material_fuente")
        cursor.execute("DROP INDEX IF EXISTS uq_plan_demanda_consenso_plan_material")
        conn.commit()
        logger.info("Migration 090 rolled back")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    up()
