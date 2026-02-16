"""
Migración 079: Production Planning (MPS)
Fecha: 2026-02-15
Descripción: Master Production Schedule, work centers, capacity planning
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, DATE
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS work_center (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                codigo TEXT UNIQUE NOT NULL,
                tipo TEXT CHECK(tipo IN ('assembly','machining','packaging','testing')),
                capacidad_diaria REAL,
                unidad TEXT DEFAULT 'horas' CHECK(unidad IN ('horas','unidades')),
                turnos INTEGER DEFAULT 1,
                eficiencia_pct REAL DEFAULT 85,
                costo_hora REAL,
                estado TEXT DEFAULT 'active' CHECK(estado IN ('active','maintenance','inactive')),
                ubicacion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_produccion (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                periodo_desde DATE,
                periodo_hasta DATE,
                estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft','publicado','en_ejecucion','completado','cancelado')),
                responsable_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_produccion_item (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER REFERENCES plan_produccion(id) ON DELETE CASCADE,
                material_codigo TEXT NOT NULL,
                work_center_id INTEGER REFERENCES work_center(id),
                fecha_programada DATE,
                cantidad_planificada REAL NOT NULL,
                cantidad_producida REAL DEFAULT 0,
                prioridad TEXT DEFAULT 'media' CHECK(prioridad IN ('baja','media','alta')),
                estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_proceso','completado','retrasado')),
                kit_bom_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS produccion_capacidad (
                id SERIAL PRIMARY KEY,
                work_center_id INTEGER REFERENCES work_center(id) ON DELETE CASCADE,
                fecha DATE NOT NULL,
                capacidad_disponible REAL,
                capacidad_utilizada REAL DEFAULT 0,
                capacidad_comprometida REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(work_center_id, fecha)
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT, TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS work_center (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                codigo TEXT UNIQUE NOT NULL,
                tipo TEXT CHECK(tipo IN ('assembly','machining','packaging','testing')),
                capacidad_diaria REAL,
                unidad TEXT DEFAULT 'horas' CHECK(unidad IN ('horas','unidades')),
                turnos INTEGER DEFAULT 1,
                eficiencia_pct REAL DEFAULT 85,
                costo_hora REAL,
                estado TEXT DEFAULT 'active' CHECK(estado IN ('active','maintenance','inactive')),
                ubicacion TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_produccion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                periodo_desde TEXT,
                periodo_hasta TEXT,
                estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft','publicado','en_ejecucion','completado','cancelado')),
                responsable_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_produccion_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER,
                material_codigo TEXT NOT NULL,
                work_center_id INTEGER,
                fecha_programada TEXT,
                cantidad_planificada REAL NOT NULL,
                cantidad_producida REAL DEFAULT 0,
                prioridad TEXT DEFAULT 'media' CHECK(prioridad IN ('baja','media','alta')),
                estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_proceso','completado','retrasado')),
                kit_bom_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (plan_id) REFERENCES plan_produccion(id) ON DELETE CASCADE,
                FOREIGN KEY (work_center_id) REFERENCES work_center(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS produccion_capacidad (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_center_id INTEGER,
                fecha TEXT NOT NULL,
                capacidad_disponible REAL,
                capacidad_utilizada REAL DEFAULT 0,
                capacidad_comprometida REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (work_center_id) REFERENCES work_center(id) ON DELETE CASCADE,
                UNIQUE(work_center_id, fecha)
            )
        """)

    # Índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_wc_codigo ON work_center(codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_wc_tipo ON work_center(tipo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_estado ON plan_produccion(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_responsable ON plan_produccion(responsable_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_item_plan ON plan_produccion_item(plan_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_item_material ON plan_produccion_item(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_item_fecha ON plan_produccion_item(fecha_programada)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_item_estado ON plan_produccion_item(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_capacidad_wc ON produccion_capacidad(work_center_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_capacidad_fecha ON produccion_capacidad(fecha)")

    conn.commit()
    conn.close()

    print("✅ Migración 079: Production Planning - Tablas work_center, plan_produccion, plan_produccion_item, produccion_capacidad creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_capacidad_fecha")
    cursor.execute("DROP INDEX IF EXISTS idx_capacidad_wc")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_item_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_item_fecha")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_item_material")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_item_plan")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_responsable")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_wc_tipo")
    cursor.execute("DROP INDEX IF EXISTS idx_wc_codigo")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS produccion_capacidad")
    cursor.execute("DROP TABLE IF EXISTS plan_produccion_item")
    cursor.execute("DROP TABLE IF EXISTS plan_produccion")
    cursor.execute("DROP TABLE IF EXISTS work_center")

    conn.commit()
    conn.close()

    print("✅ Migración 079: Revertida exitosamente")


if __name__ == '__main__':
    up()
