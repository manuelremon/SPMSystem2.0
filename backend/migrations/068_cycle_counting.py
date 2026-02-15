"""
Migración 068: Cycle Counting Programs
Fecha: 2026-02-15
Descripción: Implementa programas de conteo cíclico ABC, conteos físicos y ajustes de inventario
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycle_count_programa (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('abc', 'frequency', 'random')),
                almacen_id INTEGER,
                frecuencia_a_dias INTEGER DEFAULT 30,
                frecuencia_b_dias INTEGER DEFAULT 60,
                frecuencia_c_dias INTEGER DEFAULT 90,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'paused')),
                proximo_conteo DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycle_count (
                id SERIAL PRIMARY KEY,
                programa_id INTEGER REFERENCES cycle_count_programa(id) ON DELETE SET NULL,
                almacen_id INTEGER,
                tipo TEXT CHECK (tipo IN ('abc_scheduled', 'spot', 'full_physical')),
                estado TEXT DEFAULT 'planned' CHECK (estado IN ('planned', 'in_progress', 'completed', 'cancelled')),
                fecha_planificada TIMESTAMP,
                fecha_inicio TIMESTAMP,
                fecha_cierre TIMESTAMP,
                asignado_a INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycle_count_item (
                id SERIAL PRIMARY KEY,
                count_id INTEGER REFERENCES cycle_count(id) ON DELETE CASCADE,
                material_codigo TEXT NOT NULL,
                ubicacion TEXT,
                cantidad_sistema REAL DEFAULT 0,
                cantidad_contada REAL,
                varianza REAL,
                varianza_pct REAL,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'counted', 'verified', 'adjusted')),
                contado_por INTEGER,
                fecha_conteo TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ajuste_inventario (
                id SERIAL PRIMARY KEY,
                count_item_id INTEGER REFERENCES cycle_count_item(id) ON DELETE CASCADE,
                material_codigo TEXT NOT NULL,
                almacen_id INTEGER,
                cantidad_antes REAL,
                cantidad_despues REAL,
                tipo TEXT CHECK (tipo IN ('adjustment', 'write_off', 'recount')),
                razon TEXT,
                aprobado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycle_count_programa (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('abc', 'frequency', 'random')),
                almacen_id INTEGER,
                frecuencia_a_dias INTEGER DEFAULT 30,
                frecuencia_b_dias INTEGER DEFAULT 60,
                frecuencia_c_dias INTEGER DEFAULT 90,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'paused')),
                proximo_conteo TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycle_count (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                programa_id INTEGER,
                almacen_id INTEGER,
                tipo TEXT CHECK (tipo IN ('abc_scheduled', 'spot', 'full_physical')),
                estado TEXT DEFAULT 'planned' CHECK (estado IN ('planned', 'in_progress', 'completed', 'cancelled')),
                fecha_planificada TEXT,
                fecha_inicio TEXT,
                fecha_cierre TEXT,
                asignado_a INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (programa_id) REFERENCES cycle_count_programa(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cycle_count_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                count_id INTEGER,
                material_codigo TEXT NOT NULL,
                ubicacion TEXT,
                cantidad_sistema REAL DEFAULT 0,
                cantidad_contada REAL,
                varianza REAL,
                varianza_pct REAL,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'counted', 'verified', 'adjusted')),
                contado_por INTEGER,
                fecha_conteo TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (count_id) REFERENCES cycle_count(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ajuste_inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                count_item_id INTEGER,
                material_codigo TEXT NOT NULL,
                almacen_id INTEGER,
                cantidad_antes REAL,
                cantidad_despues REAL,
                tipo TEXT CHECK (tipo IN ('adjustment', 'write_off', 'recount')),
                razon TEXT,
                aprobado_por INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (count_item_id) REFERENCES cycle_count_item(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cc_programa_estado ON cycle_count_programa(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cc_count_estado ON cycle_count(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cc_count_almacen ON cycle_count(almacen_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cc_item_count ON cycle_count_item(count_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cc_item_material ON cycle_count_item(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cc_ajuste_item ON ajuste_inventario(count_item_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 068: Cycle Counting - Tablas cycle_count_programa, cycle_count, cycle_count_item, ajuste_inventario creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_cc_ajuste_item")
    cursor.execute("DROP INDEX IF EXISTS idx_cc_item_material")
    cursor.execute("DROP INDEX IF EXISTS idx_cc_item_count")
    cursor.execute("DROP INDEX IF EXISTS idx_cc_count_almacen")
    cursor.execute("DROP INDEX IF EXISTS idx_cc_count_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_cc_programa_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS ajuste_inventario")
    cursor.execute("DROP TABLE IF EXISTS cycle_count_item")
    cursor.execute("DROP TABLE IF EXISTS cycle_count")
    cursor.execute("DROP TABLE IF EXISTS cycle_count_programa")

    conn.commit()
    conn.close()

    print("✅ Migración 068: Revertida exitosamente")


if __name__ == '__main__':
    up()
