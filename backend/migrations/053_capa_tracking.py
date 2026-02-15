"""
Migración 053: Tablas de CAPA (Corrective and Preventive Actions)
Fecha: 2026-02-15
Descripción: Crea tablas para seguimiento de acciones correctivas y preventivas,
             incluyendo historial de cambios de estado.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de CAPA"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS capa (
                id SERIAL PRIMARY KEY,
                numero_capa TEXT UNIQUE NOT NULL,
                ncr_id INTEGER,
                tipo TEXT CHECK(tipo IN ('corrective', 'preventive')),
                titulo TEXT NOT NULL,
                descripcion_problema TEXT,
                accion_propuesta TEXT,
                accion_implementada TEXT,
                responsable_id INTEGER,
                verificador_id INTEGER,
                fecha_objetivo TIMESTAMP,
                fecha_implementacion TIMESTAMP,
                fecha_verificacion TIMESTAMP,
                estado TEXT DEFAULT 'pending' CHECK(estado IN ('pending', 'in_progress', 'implemented', 'verified', 'closed')),
                efectividad TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS capa_historial (
                id SERIAL PRIMARY KEY,
                capa_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (capa_id) REFERENCES capa(id) ON DELETE CASCADE
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS capa (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_capa TEXT UNIQUE NOT NULL,
                ncr_id INTEGER,
                tipo TEXT CHECK(tipo IN ('corrective', 'preventive')),
                titulo TEXT NOT NULL,
                descripcion_problema TEXT,
                accion_propuesta TEXT,
                accion_implementada TEXT,
                responsable_id INTEGER,
                verificador_id INTEGER,
                fecha_objetivo TEXT,
                fecha_implementacion TEXT,
                fecha_verificacion TEXT,
                estado TEXT DEFAULT 'pending' CHECK(estado IN ('pending', 'in_progress', 'implemented', 'verified', 'closed')),
                efectividad TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS capa_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                capa_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (capa_id) REFERENCES capa(id) ON DELETE CASCADE
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_capa_estado
        ON capa(estado)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_capa_ncr
        ON capa(ncr_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_capa_responsable
        ON capa(responsable_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_capa_tipo
        ON capa(tipo)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 053: Tablas de CAPA creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_capa_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_capa_ncr")
    cursor.execute("DROP INDEX IF EXISTS idx_capa_responsable")
    cursor.execute("DROP INDEX IF EXISTS idx_capa_tipo")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS capa_historial")
    cursor.execute("DROP TABLE IF EXISTS capa")

    conn.commit()
    conn.close()

    print("✅ Migración 053: Revertida exitosamente")


if __name__ == '__main__':
    up()
