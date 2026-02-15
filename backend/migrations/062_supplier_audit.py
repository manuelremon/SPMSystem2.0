"""
Migración 062: Supplier Audit & Certification Tracking
Fecha: 2026-02-15
Descripción: Implementa tracking de certificaciones de proveedores y auditorías on-site/remote
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_certificacion (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('ISO_9001', 'ISO_14001', 'ISO_45001', 'HACCP', 'custom')),
                nombre TEXT NOT NULL,
                numero_certificado TEXT,
                organismo_certificador TEXT,
                fecha_emision TIMESTAMP,
                fecha_vencimiento TIMESTAMP,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'expired', 'revoked', 'pending_renewal')),
                documento_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auditoria_proveedor (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('on_site', 'remote', 'documentary')),
                titulo TEXT NOT NULL,
                auditor_id INTEGER,
                fecha_programada TIMESTAMP,
                fecha_realizada TIMESTAMP,
                estado TEXT DEFAULT 'scheduled' CHECK (estado IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
                resultado TEXT CHECK (resultado IN ('pass', 'conditional_pass', 'fail')) DEFAULT NULL,
                score REAL,
                hallazgos_criticos INTEGER DEFAULT 0,
                hallazgos_mayores INTEGER DEFAULT 0,
                hallazgos_menores INTEGER DEFAULT 0,
                plan_accion TEXT,
                proxima_auditoria TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auditoria_hallazgo (
                id SERIAL PRIMARY KEY,
                auditoria_id INTEGER REFERENCES auditoria_proveedor(id) ON DELETE CASCADE,
                tipo TEXT CHECK (tipo IN ('critical', 'major', 'minor', 'observation')),
                descripcion TEXT NOT NULL,
                area TEXT,
                accion_requerida TEXT,
                estado TEXT DEFAULT 'open' CHECK (estado IN ('open', 'in_progress', 'resolved', 'closed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_certificacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('ISO_9001', 'ISO_14001', 'ISO_45001', 'HACCP', 'custom')),
                nombre TEXT NOT NULL,
                numero_certificado TEXT,
                organismo_certificador TEXT,
                fecha_emision TEXT,
                fecha_vencimiento TEXT,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'expired', 'revoked', 'pending_renewal')),
                documento_path TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auditoria_proveedor (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('on_site', 'remote', 'documentary')),
                titulo TEXT NOT NULL,
                auditor_id INTEGER,
                fecha_programada TEXT,
                fecha_realizada TEXT,
                estado TEXT DEFAULT 'scheduled' CHECK (estado IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
                resultado TEXT CHECK (resultado IN ('pass', 'conditional_pass', 'fail')) DEFAULT NULL,
                score REAL,
                hallazgos_criticos INTEGER DEFAULT 0,
                hallazgos_mayores INTEGER DEFAULT 0,
                hallazgos_menores INTEGER DEFAULT 0,
                plan_accion TEXT,
                proxima_auditoria TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auditoria_hallazgo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                auditoria_id INTEGER,
                tipo TEXT CHECK (tipo IN ('critical', 'major', 'minor', 'observation')),
                descripcion TEXT NOT NULL,
                area TEXT,
                accion_requerida TEXT,
                estado TEXT DEFAULT 'open' CHECK (estado IN ('open', 'in_progress', 'resolved', 'closed')),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (auditoria_id) REFERENCES auditoria_proveedor(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_proveedor_cert_cuit ON proveedor_certificacion(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_proveedor_cert_estado ON proveedor_certificacion(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_proveedor_cert_vencimiento ON proveedor_certificacion(fecha_vencimiento)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auditoria_prov_cuit ON auditoria_proveedor(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auditoria_prov_estado ON auditoria_proveedor(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auditoria_hallazgo_auditoria ON auditoria_hallazgo(auditoria_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_auditoria_hallazgo_estado ON auditoria_hallazgo(estado)")

    conn.commit()
    conn.close()

    print("✅ Migración 062: Supplier Audit - Tablas proveedor_certificacion, auditoria_proveedor, auditoria_hallazgo creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_auditoria_hallazgo_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_auditoria_hallazgo_auditoria")
    cursor.execute("DROP INDEX IF EXISTS idx_auditoria_prov_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_auditoria_prov_cuit")
    cursor.execute("DROP INDEX IF EXISTS idx_proveedor_cert_vencimiento")
    cursor.execute("DROP INDEX IF EXISTS idx_proveedor_cert_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_proveedor_cert_cuit")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS auditoria_hallazgo")
    cursor.execute("DROP TABLE IF EXISTS auditoria_proveedor")
    cursor.execute("DROP TABLE IF EXISTS proveedor_certificacion")

    conn.commit()
    conn.close()

    print("✅ Migración 062: Revertida exitosamente")


if __name__ == '__main__':
    up()
