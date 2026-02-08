"""Migration 031: Add auto-approval columns to solicitud"""

def migrate(conn, is_postgresql=False):
    cursor = conn.cursor()
    try:
        if is_postgresql:
            cursor.execute("ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS auto_aprobado INTEGER DEFAULT 0")
            cursor.execute("ALTER TABLE solicitud ADD COLUMN IF NOT EXISTS auto_aprobado_motivo TEXT DEFAULT NULL")
        else:
            # SQLite: check if column exists first
            cursor.execute("PRAGMA table_info(solicitud)")
            columns = [row[1] for row in cursor.fetchall()]

            if 'auto_aprobado' not in columns:
                cursor.execute("ALTER TABLE solicitud ADD COLUMN auto_aprobado INTEGER DEFAULT 0")
            if 'auto_aprobado_motivo' not in columns:
                cursor.execute("ALTER TABLE solicitud ADD COLUMN auto_aprobado_motivo TEXT DEFAULT NULL")

        conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Migration 031 columns may already exist: {e}")
