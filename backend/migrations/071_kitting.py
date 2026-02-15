"""
Migración 071: Kitting & Bill of Materials (BOM)
Fecha: 2026-02-15
Descripción: Gestión de kits, BOMs y órdenes de ensamblaje con asignación de componentes
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_bom (
                id SERIAL PRIMARY KEY,
                kit_codigo TEXT UNIQUE NOT NULL,
                nombre TEXT,
                descripcion TEXT,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('active', 'inactive', 'draft')),
                version INTEGER DEFAULT 1,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_bom_componente (
                id SERIAL PRIMARY KEY,
                kit_bom_id INTEGER REFERENCES kit_bom(id) ON DELETE CASCADE,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                unidad TEXT,
                es_opcional INTEGER DEFAULT 0,
                alternativa_material TEXT,
                secuencia INTEGER DEFAULT 0,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_orden (
                id SERIAL PRIMARY KEY,
                numero_orden TEXT UNIQUE NOT NULL,
                kit_bom_id INTEGER REFERENCES kit_bom(id),
                cantidad_kits INTEGER DEFAULT 1,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'released', 'in_progress', 'completed', 'cancelled')),
                prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta')),
                almacen_id INTEGER,
                solicitante_id INTEGER,
                fecha_requerida TIMESTAMP,
                fecha_inicio TIMESTAMP,
                fecha_completado TIMESTAMP,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_componente_asignacion (
                id SERIAL PRIMARY KEY,
                orden_id INTEGER REFERENCES kit_orden(id) ON DELETE CASCADE,
                componente_id INTEGER REFERENCES kit_bom_componente(id),
                lote_id INTEGER,
                cantidad_requerida REAL,
                cantidad_asignada REAL DEFAULT 0,
                cantidad_consumida REAL DEFAULT 0,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'allocated', 'picked', 'consumed', 'short')),
                ubicacion_origen TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_bom (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kit_codigo TEXT UNIQUE NOT NULL,
                nombre TEXT,
                descripcion TEXT,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('active', 'inactive', 'draft')),
                version INTEGER DEFAULT 1,
                created_by INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_bom_componente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kit_bom_id INTEGER,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                unidad TEXT,
                es_opcional INTEGER DEFAULT 0,
                alternativa_material TEXT,
                secuencia INTEGER DEFAULT 0,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (kit_bom_id) REFERENCES kit_bom(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_orden (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_orden TEXT UNIQUE NOT NULL,
                kit_bom_id INTEGER,
                cantidad_kits INTEGER DEFAULT 1,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'released', 'in_progress', 'completed', 'cancelled')),
                prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta')),
                almacen_id INTEGER,
                solicitante_id INTEGER,
                fecha_requerida TEXT,
                fecha_inicio TEXT,
                fecha_completado TEXT,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (kit_bom_id) REFERENCES kit_bom(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kit_componente_asignacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orden_id INTEGER,
                componente_id INTEGER,
                lote_id INTEGER,
                cantidad_requerida REAL,
                cantidad_asignada REAL DEFAULT 0,
                cantidad_consumida REAL DEFAULT 0,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'allocated', 'picked', 'consumed', 'short')),
                ubicacion_origen TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (orden_id) REFERENCES kit_orden(id) ON DELETE CASCADE,
                FOREIGN KEY (componente_id) REFERENCES kit_bom_componente(id)
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kit_bom_estado ON kit_bom(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kit_comp_bom ON kit_bom_componente(kit_bom_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kit_orden_estado ON kit_orden(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kit_orden_bom ON kit_orden(kit_bom_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kit_asig_orden ON kit_componente_asignacion(orden_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kit_asig_comp ON kit_componente_asignacion(componente_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 071: Kitting - Tablas kit_bom, kit_bom_componente, kit_orden, kit_componente_asignacion creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_kit_asig_comp")
    cursor.execute("DROP INDEX IF EXISTS idx_kit_asig_orden")
    cursor.execute("DROP INDEX IF EXISTS idx_kit_orden_bom")
    cursor.execute("DROP INDEX IF EXISTS idx_kit_orden_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_kit_comp_bom")
    cursor.execute("DROP INDEX IF EXISTS idx_kit_bom_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS kit_componente_asignacion")
    cursor.execute("DROP TABLE IF EXISTS kit_orden")
    cursor.execute("DROP TABLE IF EXISTS kit_bom_componente")
    cursor.execute("DROP TABLE IF EXISTS kit_bom")

    conn.commit()
    conn.close()

    print("✅ Migración 071: Revertida exitosamente")


if __name__ == '__main__':
    up()
