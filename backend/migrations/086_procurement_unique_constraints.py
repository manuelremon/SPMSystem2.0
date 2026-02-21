"""
Migracion 086: Agregar UNIQUE constraints a tablas SAP de procurement.

La migracion 084 definio UNIQUE(solped_id, posicion) en CREATE TABLE,
pero si las tablas fueron creadas antes sin ella (ej. pg_dump import),
los constraints no existen. Esta migracion los agrega de forma idempotente.

Constraints:
  - sap_solpeds: UNIQUE(solped_id, posicion)
  - sap_purchase_orders: UNIQUE(pedido_id, solped_id, solped_posicion)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.core.db import get_db_connection, is_using_postgresql  # noqa: E402


def up():
    with get_db_connection() as conn:
        cur = conn.cursor()

        if is_using_postgresql():
            # sap_solpeds: UNIQUE(solped_id, posicion)
            cur.execute("""
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'sap_solpeds'::regclass
                  AND contype = 'u'
                  AND conname LIKE '%solped_id%posicion%'
            """)
            if not cur.fetchone():
                try:
                    cur.execute("""
                        ALTER TABLE sap_solpeds
                        ADD CONSTRAINT uq_sap_solpeds_solped_pos
                        UNIQUE (solped_id, posicion)
                    """)
                except Exception:
                    # Constraint may already exist with different name
                    conn.rollback()
                    cur = conn.cursor()

            # Check for uq_sap_solpeds_solped_pos specifically
            cur.execute("""
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'sap_solpeds'::regclass
                  AND conname = 'uq_sap_solpeds_solped_pos'
            """)
            if cur.fetchone():
                print("  sap_solpeds: UNIQUE(solped_id, posicion) OK")
            else:
                print("  sap_solpeds: UNIQUE constraint already exists (different name)")

            # sap_purchase_orders: UNIQUE(pedido_id, solped_id, solped_posicion)
            cur.execute("""
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'sap_purchase_orders'::regclass
                  AND contype = 'u'
            """)
            if not cur.fetchone():
                cur.execute("""
                    ALTER TABLE sap_purchase_orders
                    ADD CONSTRAINT uq_sap_po_pedido_solped
                    UNIQUE (pedido_id, solped_id, solped_posicion)
                """)
                print("  sap_purchase_orders: UNIQUE(pedido_id, solped_id, solped_posicion) added")
            else:
                print("  sap_purchase_orders: UNIQUE constraint already exists")

        else:
            # SQLite: use CREATE UNIQUE INDEX IF NOT EXISTS
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_sap_solpeds_solped_pos
                ON sap_solpeds(solped_id, posicion)
            """)
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_sap_po_pedido_solped
                ON sap_purchase_orders(pedido_id, solped_id, solped_posicion)
            """)
            print("  SQLite: UNIQUE indexes created")

        conn.commit()

    print("Migracion 086: UNIQUE constraints de procurement agregados")


def down():
    with get_db_connection() as conn:
        cur = conn.cursor()

        if is_using_postgresql():
            cur.execute("ALTER TABLE sap_purchase_orders DROP CONSTRAINT IF EXISTS uq_sap_po_pedido_solped")
            cur.execute("ALTER TABLE sap_solpeds DROP CONSTRAINT IF EXISTS uq_sap_solpeds_solped_pos")
        else:
            cur.execute("DROP INDEX IF EXISTS uq_sap_po_pedido_solped")
            cur.execute("DROP INDEX IF EXISTS uq_sap_solpeds_solped_pos")

        conn.commit()

    print("Migracion 086: Revertida exitosamente")


if __name__ == '__main__':
    up()
