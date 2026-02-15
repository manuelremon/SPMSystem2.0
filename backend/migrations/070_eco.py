"""
Migración 070: Engineering Change Orders (ECO)
Fecha: 2026-02-15
Descripción: Gestión de órdenes de cambio de ingeniería para materiales, especificaciones y proveedores
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco (
                id SERIAL PRIMARY KEY,
                numero_eco TEXT UNIQUE NOT NULL,
                titulo TEXT,
                descripcion TEXT,
                tipo TEXT CHECK (tipo IN ('material_change', 'specification_change', 'supplier_change', 'process_change')),
                prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
                material_codigo TEXT,
                solicitante_id INTEGER,
                aprobador_id INTEGER,
                fecha_efectividad DATE,
                costo_estimado REAL DEFAULT 0,
                impacto_inventario TEXT,
                impacto_proveedores TEXT,
                justificacion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco_cambio (
                id SERIAL PRIMARY KEY,
                eco_id INTEGER REFERENCES eco(id) ON DELETE CASCADE,
                tipo_cambio TEXT CHECK (tipo_cambio IN ('replace_material', 'modify_spec', 'add_supplier', 'remove_supplier', 'change_price')),
                campo_afectado TEXT,
                valor_anterior TEXT,
                valor_nuevo TEXT,
                material_codigo_anterior TEXT,
                material_codigo_nuevo TEXT,
                proveedor_cuit_anterior TEXT,
                proveedor_cuit_nuevo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco_aprobacion (
                id SERIAL PRIMARY KEY,
                eco_id INTEGER REFERENCES eco(id) ON DELETE CASCADE,
                aprobador_id INTEGER,
                rol_aprobador TEXT,
                decision TEXT DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected')),
                comentarios TEXT,
                fecha_decision TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco_historial (
                id SERIAL PRIMARY KEY,
                eco_id INTEGER REFERENCES eco(id) ON DELETE CASCADE,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_eco TEXT UNIQUE NOT NULL,
                titulo TEXT,
                descripcion TEXT,
                tipo TEXT CHECK (tipo IN ('material_change', 'specification_change', 'supplier_change', 'process_change')),
                prioridad TEXT DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
                material_codigo TEXT,
                solicitante_id INTEGER,
                aprobador_id INTEGER,
                fecha_efectividad TEXT,
                costo_estimado REAL DEFAULT 0,
                impacto_inventario TEXT,
                impacto_proveedores TEXT,
                justificacion TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco_cambio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eco_id INTEGER,
                tipo_cambio TEXT CHECK (tipo_cambio IN ('replace_material', 'modify_spec', 'add_supplier', 'remove_supplier', 'change_price')),
                campo_afectado TEXT,
                valor_anterior TEXT,
                valor_nuevo TEXT,
                material_codigo_anterior TEXT,
                material_codigo_nuevo TEXT,
                proveedor_cuit_anterior TEXT,
                proveedor_cuit_nuevo TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (eco_id) REFERENCES eco(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco_aprobacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eco_id INTEGER,
                aprobador_id INTEGER,
                rol_aprobador TEXT,
                decision TEXT DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected')),
                comentarios TEXT,
                fecha_decision TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (eco_id) REFERENCES eco(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS eco_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eco_id INTEGER,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (eco_id) REFERENCES eco(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eco_estado ON eco(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eco_material ON eco(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eco_solicitante ON eco(solicitante_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eco_cambio_eco ON eco_cambio(eco_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eco_aprobacion_eco ON eco_aprobacion(eco_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_eco_historial_eco ON eco_historial(eco_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 070: ECO - Tablas eco, eco_cambio, eco_aprobacion, eco_historial creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_eco_historial_eco")
    cursor.execute("DROP INDEX IF EXISTS idx_eco_aprobacion_eco")
    cursor.execute("DROP INDEX IF EXISTS idx_eco_cambio_eco")
    cursor.execute("DROP INDEX IF EXISTS idx_eco_solicitante")
    cursor.execute("DROP INDEX IF EXISTS idx_eco_material")
    cursor.execute("DROP INDEX IF EXISTS idx_eco_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS eco_historial")
    cursor.execute("DROP TABLE IF EXISTS eco_aprobacion")
    cursor.execute("DROP TABLE IF EXISTS eco_cambio")
    cursor.execute("DROP TABLE IF EXISTS eco")

    conn.commit()
    conn.close()

    print("✅ Migración 070: Revertida exitosamente")


if __name__ == '__main__':
    up()
