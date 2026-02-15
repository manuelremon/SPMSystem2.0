"""
Migración 059: Warehouse Operations - Dock Management & Putaway
Fecha: 2026-02-15
Descripción: Implementa gestión de docks de recepción y tareas de putaway para optimizar operaciones de almacén
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dock_recepcion (
                id SERIAL PRIMARY KEY,
                numero_dock TEXT NOT NULL,
                almacen TEXT,
                estado TEXT DEFAULT 'available' CHECK (estado IN ('available', 'occupied', 'maintenance')),
                capacidad_pallets INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recepcion_dock (
                id SERIAL PRIMARY KEY,
                recepcion_id INTEGER,
                dock_id INTEGER REFERENCES dock_recepcion(id) ON DELETE CASCADE,
                hora_llegada TIMESTAMP,
                hora_inicio_descarga TIMESTAMP,
                hora_fin_descarga TIMESTAMP,
                asignado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS putaway_tarea (
                id SERIAL PRIMARY KEY,
                recepcion_item_id INTEGER,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                ubicacion_destino TEXT,
                almacen TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'in_progress', 'completed', 'cancelled')),
                asignado_a INTEGER,
                prioridad TEXT DEFAULT 'normal' CHECK (prioridad IN ('low', 'normal', 'high', 'urgent')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dock_recepcion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_dock TEXT NOT NULL,
                almacen TEXT,
                estado TEXT DEFAULT 'available' CHECK (estado IN ('available', 'occupied', 'maintenance')),
                capacidad_pallets INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recepcion_dock (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recepcion_id INTEGER,
                dock_id INTEGER,
                hora_llegada TEXT,
                hora_inicio_descarga TEXT,
                hora_fin_descarga TEXT,
                asignado_por INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (dock_id) REFERENCES dock_recepcion(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS putaway_tarea (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recepcion_item_id INTEGER,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                ubicacion_destino TEXT,
                almacen TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'in_progress', 'completed', 'cancelled')),
                asignado_a INTEGER,
                prioridad TEXT DEFAULT 'normal' CHECK (prioridad IN ('low', 'normal', 'high', 'urgent')),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dock_recepcion_estado ON dock_recepcion(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dock_recepcion_almacen ON dock_recepcion(almacen)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_recepcion_dock_recepcion ON recepcion_dock(recepcion_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_putaway_tarea_estado ON putaway_tarea(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_putaway_tarea_almacen ON putaway_tarea(almacen)")

    conn.commit()
    conn.close()

    print("✅ Migración 059: Warehouse Operations - Tablas dock_recepcion, recepcion_dock, putaway_tarea creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_putaway_tarea_almacen")
    cursor.execute("DROP INDEX IF EXISTS idx_putaway_tarea_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_recepcion_dock_recepcion")
    cursor.execute("DROP INDEX IF EXISTS idx_dock_recepcion_almacen")
    cursor.execute("DROP INDEX IF EXISTS idx_dock_recepcion_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS putaway_tarea")
    cursor.execute("DROP TABLE IF EXISTS recepcion_dock")
    cursor.execute("DROP TABLE IF EXISTS dock_recepcion")

    conn.commit()
    conn.close()

    print("✅ Migración 059: Revertida exitosamente")


if __name__ == '__main__':
    up()
