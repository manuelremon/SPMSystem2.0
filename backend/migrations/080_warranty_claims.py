"""
Migración 080: Warranty & Claims Management
Fecha: 2026-02-15
Descripción: Gestión de garantías de proveedores y reclamos de calidad
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS garantia (
                id SERIAL PRIMARY KEY,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                lote_id INTEGER,
                orden_compra_id INTEGER,
                tipo TEXT DEFAULT 'standard' CHECK (tipo IN ('standard', 'extended', 'special')),
                duracion_meses INTEGER NOT NULL,
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                condiciones TEXT,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'expired', 'voided')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reclamo_garantia (
                id SERIAL PRIMARY KEY,
                numero_reclamo TEXT UNIQUE NOT NULL,
                garantia_id INTEGER REFERENCES garantia(id) ON DELETE SET NULL,
                tipo TEXT CHECK (tipo IN ('defecto', 'falta', 'dano', 'incumplimiento')),
                descripcion TEXT NOT NULL,
                cantidad_afectada REAL,
                costo_estimado REAL,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'resolved')),
                resolucion TEXT CHECK (resolucion IN ('reemplazo', 'credito', 'reparacion', 'rechazo')),
                monto_recuperado REAL DEFAULT 0,
                responsable_id INTEGER,
                fecha_resolucion TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reclamo_historial (
                id SERIAL PRIMARY KEY,
                reclamo_id INTEGER REFERENCES reclamo_garantia(id) ON DELETE CASCADE,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reclamo_documento (
                id SERIAL PRIMARY KEY,
                reclamo_id INTEGER REFERENCES reclamo_garantia(id) ON DELETE CASCADE,
                nombre TEXT NOT NULL,
                path TEXT,
                tipo TEXT CHECK (tipo IN ('foto', 'factura', 'informe', 'otro')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS garantia (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                lote_id INTEGER,
                orden_compra_id INTEGER,
                tipo TEXT DEFAULT 'standard' CHECK (tipo IN ('standard', 'extended', 'special')),
                duracion_meses INTEGER NOT NULL,
                fecha_inicio TEXT NOT NULL,
                fecha_fin TEXT NOT NULL,
                condiciones TEXT,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'expired', 'voided')),
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reclamo_garantia (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_reclamo TEXT UNIQUE NOT NULL,
                garantia_id INTEGER,
                tipo TEXT CHECK (tipo IN ('defecto', 'falta', 'dano', 'incumplimiento')),
                descripcion TEXT NOT NULL,
                cantidad_afectada REAL,
                costo_estimado REAL,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'resolved')),
                resolucion TEXT CHECK (resolucion IN ('reemplazo', 'credito', 'reparacion', 'rechazo')),
                monto_recuperado REAL DEFAULT 0,
                responsable_id INTEGER,
                fecha_resolucion TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (garantia_id) REFERENCES garantia(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reclamo_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reclamo_id INTEGER,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (reclamo_id) REFERENCES reclamo_garantia(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reclamo_documento (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reclamo_id INTEGER,
                nombre TEXT NOT NULL,
                path TEXT,
                tipo TEXT CHECK (tipo IN ('foto', 'factura', 'informe', 'otro')),
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (reclamo_id) REFERENCES reclamo_garantia(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_garantia_material ON garantia(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_garantia_proveedor ON garantia(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_garantia_estado ON garantia(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_garantia_fecha_fin ON garantia(fecha_fin)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reclamo_numero ON reclamo_garantia(numero_reclamo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reclamo_garantia ON reclamo_garantia(garantia_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reclamo_estado ON reclamo_garantia(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reclamo_tipo ON reclamo_garantia(tipo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reclamo_hist_reclamo ON reclamo_historial(reclamo_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reclamo_doc_reclamo ON reclamo_documento(reclamo_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 080: Warranty & Claims - Tablas garantia, reclamo_garantia, reclamo_historial, reclamo_documento creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_reclamo_doc_reclamo")
    cursor.execute("DROP INDEX IF EXISTS idx_reclamo_hist_reclamo")
    cursor.execute("DROP INDEX IF EXISTS idx_reclamo_tipo")
    cursor.execute("DROP INDEX IF EXISTS idx_reclamo_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_reclamo_garantia")
    cursor.execute("DROP INDEX IF EXISTS idx_reclamo_numero")
    cursor.execute("DROP INDEX IF EXISTS idx_garantia_fecha_fin")
    cursor.execute("DROP INDEX IF EXISTS idx_garantia_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_garantia_proveedor")
    cursor.execute("DROP INDEX IF EXISTS idx_garantia_material")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS reclamo_documento")
    cursor.execute("DROP TABLE IF EXISTS reclamo_historial")
    cursor.execute("DROP TABLE IF EXISTS reclamo_garantia")
    cursor.execute("DROP TABLE IF EXISTS garantia")

    conn.commit()
    conn.close()

    print("✅ Migración 080: Revertida exitosamente")


if __name__ == '__main__':
    up()
