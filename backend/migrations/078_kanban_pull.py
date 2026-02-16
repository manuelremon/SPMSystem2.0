"""
Migración 078: Kanban & Pull Replenishment
Fecha: 2026-02-15
Descripción: Sistema kanban visual y reposición pull basada en señales
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_tablero (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    almacen_id INTEGER,
                    centro_id INTEGER,
                    descripcion TEXT,
                    estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'inactive')),
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_tarjeta (
                    id SERIAL PRIMARY KEY,
                    tablero_id INTEGER REFERENCES kanban_tablero(id) ON DELETE CASCADE,
                    material_codigo TEXT NOT NULL,
                    tipo TEXT CHECK (tipo IN ('produccion', 'transporte', 'proveedor')),
                    estado TEXT DEFAULT 'full' CHECK (estado IN ('empty', 'in_transit', 'full')),
                    cantidad_contenedor REAL NOT NULL,
                    punto_reorden INTEGER DEFAULT 1,
                    lead_time_horas INTEGER,
                    ubicacion_supermarket TEXT,
                    proveedor_cuit TEXT,
                    ciclos_totales INTEGER DEFAULT 0,
                    ultimo_ciclo_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_senal (
                    id SERIAL PRIMARY KEY,
                    tarjeta_id INTEGER REFERENCES kanban_tarjeta(id) ON DELETE CASCADE,
                    tipo TEXT CHECK (tipo IN ('reposicion', 'produccion', 'compra')),
                    estado TEXT DEFAULT 'generada' CHECK (estado IN ('generada', 'en_proceso', 'completada', 'cancelada')),
                    cantidad_solicitada REAL,
                    cantidad_entregada REAL DEFAULT 0,
                    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fecha_completado TIMESTAMP,
                    orden_asociada_id INTEGER,
                    ejecutado_por INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_historial (
                    id SERIAL PRIMARY KEY,
                    tarjeta_id INTEGER REFERENCES kanban_tarjeta(id) ON DELETE CASCADE,
                    estado_anterior TEXT,
                    estado_nuevo TEXT,
                    senal_id INTEGER,
                    actor_id INTEGER,
                    notas TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        else:
            # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_tablero (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    almacen_id INTEGER,
                    centro_id INTEGER,
                    descripcion TEXT,
                    estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'inactive')),
                    created_by INTEGER,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_tarjeta (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tablero_id INTEGER,
                    material_codigo TEXT NOT NULL,
                    tipo TEXT CHECK (tipo IN ('produccion', 'transporte', 'proveedor')),
                    estado TEXT DEFAULT 'full' CHECK (estado IN ('empty', 'in_transit', 'full')),
                    cantidad_contenedor REAL NOT NULL,
                    punto_reorden INTEGER DEFAULT 1,
                    lead_time_horas INTEGER,
                    ubicacion_supermarket TEXT,
                    proveedor_cuit TEXT,
                    ciclos_totales INTEGER DEFAULT 0,
                    ultimo_ciclo_at TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (tablero_id) REFERENCES kanban_tablero(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_senal (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tarjeta_id INTEGER,
                    tipo TEXT CHECK (tipo IN ('reposicion', 'produccion', 'compra')),
                    estado TEXT DEFAULT 'generada' CHECK (estado IN ('generada', 'en_proceso', 'completada', 'cancelada')),
                    cantidad_solicitada REAL,
                    cantidad_entregada REAL DEFAULT 0,
                    fecha_generacion TEXT DEFAULT (datetime('now')),
                    fecha_completado TEXT,
                    orden_asociada_id INTEGER,
                    ejecutado_por INTEGER,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (tarjeta_id) REFERENCES kanban_tarjeta(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kanban_historial (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tarjeta_id INTEGER,
                    estado_anterior TEXT,
                    estado_nuevo TEXT,
                    senal_id INTEGER,
                    actor_id INTEGER,
                    notas TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (tarjeta_id) REFERENCES kanban_tarjeta(id) ON DELETE CASCADE
                )
            """)

        # Crear índices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_tablero_estado ON kanban_tablero(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_tarjeta_tablero ON kanban_tarjeta(tablero_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_tarjeta_estado ON kanban_tarjeta(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_tarjeta_material ON kanban_tarjeta(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_senal_tarjeta ON kanban_senal(tarjeta_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_senal_estado ON kanban_senal(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_kanban_historial_tarjeta ON kanban_historial(tarjeta_id)")

        conn.commit()

    print("✅ Migración 078: Kanban & Pull Replenishment - Tablas kanban_tablero, kanban_tarjeta, kanban_senal, kanban_historial creadas")


def down():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar índices primero
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_historial_tarjeta")
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_senal_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_senal_tarjeta")
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_tarjeta_material")
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_tarjeta_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_tarjeta_tablero")
        cursor.execute("DROP INDEX IF EXISTS idx_kanban_tablero_estado")

        # Eliminar tablas en orden inverso (respetando FKs)
        cursor.execute("DROP TABLE IF EXISTS kanban_historial")
        cursor.execute("DROP TABLE IF EXISTS kanban_senal")
        cursor.execute("DROP TABLE IF EXISTS kanban_tarjeta")
        cursor.execute("DROP TABLE IF EXISTS kanban_tablero")

        conn.commit()

    print("✅ Migración 078: Revertida exitosamente")


if __name__ == '__main__':
    up()
