"""
Migracion 022: Tablas para Vertex IA

Crea las tablas necesarias para el sistema de chat Vertex IA:
- vertex_conversations: Conversaciones de chat
- vertex_messages: Mensajes de cada conversacion
- vertex_user_memory: Memoria de largo plazo por usuario
- vertex_proactive_alerts: Alertas proactivas

Fecha: 2026-01-17
"""

import os
import sys


def run_migration_sqlite():
    """Ejecuta la migracion en SQLite (desarrollo local)."""
    import sqlite3

    db_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "spm.db")
    db_path = os.path.abspath(db_path)

    print(f"Conectando a SQLite: {db_path}")

    if not os.path.exists(db_path):
        print(f"ERROR: Base de datos no encontrada: {db_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Tabla: vertex_conversations
        print("\n=== Creando tabla vertex_conversations ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT DEFAULT (lower(hex(randomblob(16)))),
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                context TEXT DEFAULT '{}',
                summary TEXT,
                FOREIGN KEY (user_id) REFERENCES usuario(id_spm) ON DELETE CASCADE
            );
        """)
        print("  Tabla vertex_conversations creada")

        # Indices para vertex_conversations
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_conv_user
            ON vertex_conversations(user_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_conv_session
            ON vertex_conversations(session_id);
        """)
        print("  Indices creados para vertex_conversations")

        # Tabla: vertex_messages
        print("\n=== Creando tabla vertex_messages ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT DEFAULT '{}',
                FOREIGN KEY (conversation_id) REFERENCES vertex_conversations(id) ON DELETE CASCADE
            );
        """)
        print("  Tabla vertex_messages creada")

        # Indices para vertex_messages
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_msg_conv
            ON vertex_messages(conversation_id);
        """)
        print("  Indices creados para vertex_messages")

        # Tabla: vertex_user_memory
        print("\n=== Creando tabla vertex_user_memory ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_user_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                fact_key TEXT NOT NULL,
                fact_value TEXT NOT NULL,
                learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                confidence REAL DEFAULT 1.0,
                expires_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES usuario(id_spm) ON DELETE CASCADE,
                UNIQUE(user_id, fact_key)
            );
        """)
        print("  Tabla vertex_user_memory creada")

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_memory_user
            ON vertex_user_memory(user_id);
        """)
        print("  Indice creado para vertex_user_memory")

        # Tabla: vertex_proactive_alerts
        print("\n=== Creando tabla vertex_proactive_alerts ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_proactive_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                context TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                shown_at TIMESTAMP,
                dismissed_at TIMESTAMP,
                actioned_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES usuario(id_spm) ON DELETE CASCADE
            );
        """)
        print("  Tabla vertex_proactive_alerts creada")

        # Indices para vertex_proactive_alerts
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_alerts_user
            ON vertex_proactive_alerts(user_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_alerts_priority
            ON vertex_proactive_alerts(priority, created_at);
        """)
        print("  Indices creados para vertex_proactive_alerts")

        # Commit
        print("\n=== Guardando cambios ===")
        conn.commit()
        conn.close()
        print("Migracion 022 (SQLite) completada exitosamente!")
        return True

    except Exception as e:
        print(f"ERROR en migracion SQLite: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_migration_postgresql():
    """Ejecuta la migracion en PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL")

    print(f"DATABASE_URL presente: {bool(database_url)}")

    if not database_url:
        print("ERROR: DATABASE_URL no configurada")
        return False

    if not database_url.startswith("postgresql://"):
        print(f"DATABASE_URL no es PostgreSQL: {database_url[:20]}...")
        return False

    try:
        import psycopg2

        print("Conectando a PostgreSQL...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # Habilitar extension uuid-ossp si no existe
        print("\n=== Habilitando extension uuid-ossp ===")
        try:
            cursor.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
            print("  Extension uuid-ossp habilitada")
        except Exception as e:
            print(f"  Nota: {e}")

        # Tabla: vertex_conversations
        print("\n=== Creando tabla vertex_conversations ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_conversations (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id UUID DEFAULT uuid_generate_v4(),
                started_at TIMESTAMP DEFAULT NOW(),
                ended_at TIMESTAMP,
                context JSONB DEFAULT '{}',
                summary TEXT,
                CONSTRAINT fk_vertex_conv_user
                    FOREIGN KEY (user_id) REFERENCES usuario(id_spm) ON DELETE CASCADE
            );
        """)
        print("  Tabla vertex_conversations creada")

        # Indices para vertex_conversations
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_conv_user
            ON vertex_conversations(user_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_conv_session
            ON vertex_conversations(session_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_conv_started
            ON vertex_conversations(started_at DESC);
        """)
        print("  Indices creados para vertex_conversations")

        # Tabla: vertex_messages
        print("\n=== Creando tabla vertex_messages ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                metadata JSONB DEFAULT '{}',
                CONSTRAINT fk_vertex_msg_conv
                    FOREIGN KEY (conversation_id) REFERENCES vertex_conversations(id) ON DELETE CASCADE
            );
        """)
        print("  Tabla vertex_messages creada")

        # Indices para vertex_messages
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_msg_conv
            ON vertex_messages(conversation_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_msg_created
            ON vertex_messages(created_at);
        """)
        print("  Indices creados para vertex_messages")

        # Tabla: vertex_user_memory
        print("\n=== Creando tabla vertex_user_memory ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_user_memory (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                fact_key VARCHAR(100) NOT NULL,
                fact_value JSONB NOT NULL,
                learned_at TIMESTAMP DEFAULT NOW(),
                confidence FLOAT DEFAULT 1.0,
                expires_at TIMESTAMP,
                CONSTRAINT fk_vertex_memory_user
                    FOREIGN KEY (user_id) REFERENCES usuario(id_spm) ON DELETE CASCADE,
                CONSTRAINT uq_vertex_memory_user_key
                    UNIQUE(user_id, fact_key)
            );
        """)
        print("  Tabla vertex_user_memory creada")

        # Indice para vertex_user_memory
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_memory_user
            ON vertex_user_memory(user_id);
        """)
        print("  Indice creado para vertex_user_memory")

        # Tabla: vertex_proactive_alerts
        print("\n=== Creando tabla vertex_proactive_alerts ===")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vertex_proactive_alerts (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                alert_type VARCHAR(50) NOT NULL,
                priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                context JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                shown_at TIMESTAMP,
                dismissed_at TIMESTAMP,
                actioned_at TIMESTAMP,
                CONSTRAINT fk_vertex_alerts_user
                    FOREIGN KEY (user_id) REFERENCES usuario(id_spm) ON DELETE CASCADE
            );
        """)
        print("  Tabla vertex_proactive_alerts creada")

        # Indices para vertex_proactive_alerts
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_alerts_user
            ON vertex_proactive_alerts(user_id, shown_at);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_alerts_priority
            ON vertex_proactive_alerts(priority, created_at);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vertex_alerts_pending
            ON vertex_proactive_alerts(user_id)
            WHERE shown_at IS NULL;
        """)
        print("  Indices creados para vertex_proactive_alerts")

        # Commit
        print("\n=== Guardando cambios ===")
        conn.commit()
        conn.close()
        print("Migracion 022 completada exitosamente!")
        return True

    except ImportError:
        print("ERROR: psycopg2 no instalado")
        return False
    except Exception as e:
        print(f"ERROR en migracion: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_migration():
    """Ejecuta la migracion completa."""
    print("=" * 60)
    print("MIGRACION 022: Tablas Vertex IA")
    print("=" * 60)

    database_url = os.environ.get("DATABASE_URL")

    if database_url and database_url.startswith("postgresql://"):
        print("Detectado: PostgreSQL (produccion)")
        return run_migration_postgresql()
    else:
        print("Detectado: SQLite (desarrollo local)")
        return run_migration_sqlite()


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
