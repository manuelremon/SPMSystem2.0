"""
Migración 073: AI Copilot for Procurement
Fecha: 2026-02-15
Descripción: Conversaciones con IA, sugerencias inteligentes y aprendizaje continuo para procurement
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_conversacion (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER,
                titulo TEXT,
                contexto_tipo TEXT DEFAULT 'procurement' CHECK (contexto_tipo IN ('procurement', 'sourcing', 'spend', 'inventory')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_mensaje (
                id SERIAL PRIMARY KEY,
                conversacion_id INTEGER REFERENCES copilot_conversacion(id) ON DELETE CASCADE,
                rol TEXT CHECK (rol IN ('user', 'assistant')),
                contenido TEXT,
                metadata TEXT,
                tokens_used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_sugerencia (
                id SERIAL PRIMARY KEY,
                conversacion_id INTEGER,
                tipo TEXT CHECK (tipo IN ('sourcing_strategy', 'rfq_draft', 'supplier_recommendation', 'cost_optimization', 'risk_alert')),
                titulo TEXT,
                contenido TEXT,
                datos_soporte TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'accepted', 'rejected', 'implemented')),
                material_codigo TEXT,
                proveedor_cuit TEXT,
                feedback_usuario TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_learning (
                id SERIAL PRIMARY KEY,
                sugerencia_id INTEGER REFERENCES copilot_sugerencia(id) ON DELETE CASCADE,
                accion TEXT CHECK (accion IN ('accepted', 'rejected', 'modified')),
                feedback TEXT,
                contexto TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_conversacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER,
                titulo TEXT,
                contexto_tipo TEXT DEFAULT 'procurement' CHECK (contexto_tipo IN ('procurement', 'sourcing', 'spend', 'inventory')),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_mensaje (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversacion_id INTEGER,
                rol TEXT CHECK (rol IN ('user', 'assistant')),
                contenido TEXT,
                metadata TEXT,
                tokens_used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (conversacion_id) REFERENCES copilot_conversacion(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_sugerencia (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversacion_id INTEGER,
                tipo TEXT CHECK (tipo IN ('sourcing_strategy', 'rfq_draft', 'supplier_recommendation', 'cost_optimization', 'risk_alert')),
                titulo TEXT,
                contenido TEXT,
                datos_soporte TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'accepted', 'rejected', 'implemented')),
                material_codigo TEXT,
                proveedor_cuit TEXT,
                feedback_usuario TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS copilot_learning (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sugerencia_id INTEGER,
                accion TEXT CHECK (accion IN ('accepted', 'rejected', 'modified')),
                feedback TEXT,
                contexto TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (sugerencia_id) REFERENCES copilot_sugerencia(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_conv_usuario ON copilot_conversacion(usuario_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_msg_conv ON copilot_mensaje(conversacion_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_sug_tipo ON copilot_sugerencia(tipo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_sug_estado ON copilot_sugerencia(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_copilot_learn_sug ON copilot_learning(sugerencia_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 073: AI Copilot - Tablas copilot_conversacion, copilot_mensaje, copilot_sugerencia, copilot_learning creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_copilot_learn_sug")
    cursor.execute("DROP INDEX IF EXISTS idx_copilot_sug_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_copilot_sug_tipo")
    cursor.execute("DROP INDEX IF EXISTS idx_copilot_msg_conv")
    cursor.execute("DROP INDEX IF EXISTS idx_copilot_conv_usuario")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS copilot_learning")
    cursor.execute("DROP TABLE IF EXISTS copilot_sugerencia")
    cursor.execute("DROP TABLE IF EXISTS copilot_mensaje")
    cursor.execute("DROP TABLE IF EXISTS copilot_conversacion")

    conn.commit()
    conn.close()

    print("✅ Migración 073: Revertida exitosamente")


if __name__ == '__main__':
    up()
