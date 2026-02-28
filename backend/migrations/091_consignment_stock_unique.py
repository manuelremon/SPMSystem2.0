"""
Migración 091: Add missing UNIQUE constraint to consignment_stock
Fecha: 2026-02-28
Descripción: The migration 076 defined UNIQUE(programa_id, material_codigo) but
it was not applied in some environments. This ensures it exists.
"""


def up():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check if constraint already exists
        cursor.execute("""
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'consignment_stock'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) LIKE '%programa_id%material_codigo%'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE consignment_stock
                ADD CONSTRAINT uq_consignment_stock_prog_mat
                UNIQUE (programa_id, material_codigo)
            """)
            print("  Added UNIQUE(programa_id, material_codigo) to consignment_stock")
        else:
            print("  UNIQUE constraint already exists, skipping")

        conn.commit()

    print("✅ Migración 091: consignment_stock UNIQUE constraint ensured")


def down():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE consignment_stock DROP CONSTRAINT IF EXISTS uq_consignment_stock_prog_mat")
        conn.commit()

    print("✅ Migración 091: Revertida")


if __name__ == '__main__':
    up()
