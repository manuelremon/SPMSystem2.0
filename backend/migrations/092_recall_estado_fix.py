"""
Migracion 092: Fix recall_lote estado_recuperacion + add recall.costo_estimado
Fecha: 2026-02-28
Descripcion:
  - Update CHECK constraint to include 'recovered' (used by frontend)
  - Convert existing 'retrieved' values to 'recovered'
  - Add costo_estimado column to recall table (missing from original schema)
"""


def up():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Drop old CHECK constraint on recall_lote.estado_recuperacion
        cursor.execute("""
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'recall_lote'::regclass
            AND contype = 'c'
            AND conname LIKE '%estado_recuperacion%'
        """)
        row = cursor.fetchone()
        if row:
            conname = row[0] if isinstance(row, (list, tuple)) else row["conname"]
            cursor.execute(f'ALTER TABLE recall_lote DROP CONSTRAINT "{conname}"')

        # 2. Add updated CHECK constraint with 'recovered' added
        cursor.execute("""
            ALTER TABLE recall_lote ADD CONSTRAINT recall_lote_estado_recuperacion_check
            CHECK (estado_recuperacion IN ('pending', 'identified', 'retrieved', 'recovered', 'disposed'))
        """)

        # 3. Convert existing 'retrieved' values to 'recovered'
        cursor.execute("""
            UPDATE recall_lote SET estado_recuperacion = 'recovered'
            WHERE estado_recuperacion = 'retrieved'
        """)

        # 4. Add costo_estimado column to recall table if missing
        cursor.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'recall' AND column_name = 'costo_estimado'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE recall ADD COLUMN costo_estimado NUMERIC(14,2) DEFAULT 0
            """)

        # 5. Add plan_accion column to recall table if missing (alias for accion_requerida)
        cursor.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'recall' AND column_name = 'plan_accion'
        """)
        if not cursor.fetchone():
            cursor.execute("""
                ALTER TABLE recall ADD COLUMN plan_accion TEXT
            """)
            # Copy existing accion_requerida values
            cursor.execute("""
                UPDATE recall SET plan_accion = accion_requerida
                WHERE accion_requerida IS NOT NULL AND plan_accion IS NULL
            """)

        conn.commit()
        print("Migration 092: recall schema fixes applied")


def down():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE recall_lote SET estado_recuperacion = 'retrieved'
            WHERE estado_recuperacion = 'recovered'
        """)

        cursor.execute("""
            ALTER TABLE recall_lote DROP CONSTRAINT IF EXISTS recall_lote_estado_recuperacion_check
        """)

        cursor.execute("""
            ALTER TABLE recall_lote ADD CONSTRAINT recall_lote_estado_recuperacion_check
            CHECK (estado_recuperacion IN ('pending', 'identified', 'retrieved', 'disposed'))
        """)

        cursor.execute("ALTER TABLE recall DROP COLUMN IF EXISTS costo_estimado")
        cursor.execute("ALTER TABLE recall DROP COLUMN IF EXISTS plan_accion")

        conn.commit()
        print("Migration 092 rolled back")


if __name__ == "__main__":
    up()
