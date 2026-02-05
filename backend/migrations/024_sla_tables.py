"""
Migración 024: Crear tablas y columnas SLA

Añade:
- Columna sla_estado en tabla solicitudes
- Columna sla_fecha_limite en tabla solicitudes
- Tabla sla_alertas para gestión de alertas SLA
"""

import sqlite3
import os
from datetime import datetime

def get_db_path():
    """Obtener path de la base de datos"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, 'data', 'spm.db')

def migrate():
    """Ejecutar migración"""
    db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Añadir columna sla_estado a solicitudes si no existe
        cursor.execute("PRAGMA table_info(solicitudes)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'sla_estado' not in columns:
            cursor.execute("""
                ALTER TABLE solicitudes
                ADD COLUMN sla_estado TEXT DEFAULT NULL
            """)
            print("✓ Columna sla_estado añadida a solicitudes")
        else:
            print("- Columna sla_estado ya existe")

        if 'sla_fecha_limite' not in columns:
            cursor.execute("""
                ALTER TABLE solicitudes
                ADD COLUMN sla_fecha_limite TEXT DEFAULT NULL
            """)
            print("✓ Columna sla_fecha_limite añadida a solicitudes")
        else:
            print("- Columna sla_fecha_limite ya existe")

        # 2. Crear tabla sla_alertas si no existe
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sla_alertas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                solicitud_id INTEGER NOT NULL,
                tipo TEXT NOT NULL CHECK(tipo IN ('warning', 'breach', 'escalated')),
                mensaje TEXT,
                tiempo_objetivo_horas REAL,
                tiempo_transcurrido_horas REAL,
                resuelta INTEGER DEFAULT 0,
                resuelta_por TEXT,
                resuelta_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id)
            )
        """)
        print("✓ Tabla sla_alertas creada o ya existía")

        # 3. Crear índices para rendimiento
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sla_alertas_solicitud
            ON sla_alertas(solicitud_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sla_alertas_tipo
            ON sla_alertas(tipo)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sla_alertas_resuelta
            ON sla_alertas(resuelta)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_solicitudes_sla_estado
            ON solicitudes(sla_estado)
        """)
        print("✓ Índices SLA creados")

        conn.commit()
        print("\n✅ Migración 024_sla_tables completada exitosamente")
        return True

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error en migración: {e}")
        return False
    finally:
        conn.close()

def rollback():
    """Revertir migración"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # SQLite no soporta DROP COLUMN directamente
        # Solo podemos eliminar la tabla sla_alertas
        cursor.execute("DROP TABLE IF EXISTS sla_alertas")
        print("✓ Tabla sla_alertas eliminada")

        # Los índices se eliminan automáticamente con la tabla

        conn.commit()
        print("\n✅ Rollback completado (nota: columnas en solicitudes no se pueden eliminar en SQLite)")
        return True
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error en rollback: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == 'rollback':
        rollback()
    else:
        migrate()
