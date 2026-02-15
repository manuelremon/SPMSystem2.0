"""
Migración 061: Inventory Optimization - Transfers & Service Levels
Fecha: 2026-02-15
Descripción: Implementa transferencias entre almacenes y cálculo de niveles de servicio objetivo
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transferencia_inventario (
                id SERIAL PRIMARY KEY,
                numero_transferencia TEXT UNIQUE NOT NULL,
                material_codigo TEXT NOT NULL,
                almacen_origen TEXT NOT NULL,
                almacen_destino TEXT NOT NULL,
                cantidad REAL NOT NULL,
                estado TEXT DEFAULT 'proposed' CHECK (estado IN ('proposed', 'approved', 'in_transit', 'received', 'cancelled')),
                prioridad TEXT DEFAULT 'normal',
                razon TEXT,
                propuesto_por INTEGER,
                aprobado_por INTEGER,
                fecha_envio TIMESTAMP,
                fecha_recepcion TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nivel_servicio_objetivo (
                id SERIAL PRIMARY KEY,
                material_codigo TEXT NOT NULL,
                almacen TEXT NOT NULL,
                nivel_servicio REAL DEFAULT 0.95,
                stock_seguridad_calculado REAL DEFAULT 0,
                punto_reorden_calculado REAL DEFAULT 0,
                clasificacion_abc TEXT,
                ultimo_calculo TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(material_codigo, almacen)
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transferencia_inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_transferencia TEXT UNIQUE NOT NULL,
                material_codigo TEXT NOT NULL,
                almacen_origen TEXT NOT NULL,
                almacen_destino TEXT NOT NULL,
                cantidad REAL NOT NULL,
                estado TEXT DEFAULT 'proposed' CHECK (estado IN ('proposed', 'approved', 'in_transit', 'received', 'cancelled')),
                prioridad TEXT DEFAULT 'normal',
                razon TEXT,
                propuesto_por INTEGER,
                aprobado_por INTEGER,
                fecha_envio TEXT,
                fecha_recepcion TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nivel_servicio_objetivo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                material_codigo TEXT NOT NULL,
                almacen TEXT NOT NULL,
                nivel_servicio REAL DEFAULT 0.95,
                stock_seguridad_calculado REAL DEFAULT 0,
                punto_reorden_calculado REAL DEFAULT 0,
                clasificacion_abc TEXT,
                ultimo_calculo TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(material_codigo, almacen)
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transferencia_inv_estado ON transferencia_inventario(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transferencia_inv_material ON transferencia_inventario(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_nivel_servicio_material ON nivel_servicio_objetivo(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_nivel_servicio_almacen ON nivel_servicio_objetivo(almacen)")

    conn.commit()
    conn.close()

    print("✅ Migración 061: Inventory Optimization - Tablas transferencia_inventario, nivel_servicio_objetivo creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_nivel_servicio_almacen")
    cursor.execute("DROP INDEX IF EXISTS idx_nivel_servicio_material")
    cursor.execute("DROP INDEX IF EXISTS idx_transferencia_inv_material")
    cursor.execute("DROP INDEX IF EXISTS idx_transferencia_inv_estado")

    # Eliminar tablas en orden inverso
    cursor.execute("DROP TABLE IF EXISTS nivel_servicio_objetivo")
    cursor.execute("DROP TABLE IF EXISTS transferencia_inventario")

    conn.commit()
    conn.close()

    print("✅ Migración 061: Revertida exitosamente")


if __name__ == '__main__':
    up()
