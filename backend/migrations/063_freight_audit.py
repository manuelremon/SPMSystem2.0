"""
Migración 063: Freight Audit & Payment - Invoice Validation
Fecha: 2026-02-15
Descripción: Implementa auditoría de facturas de flete, tarifas de referencia y validación de pagos
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factura_flete (
                id SERIAL PRIMARY KEY,
                numero_factura TEXT UNIQUE NOT NULL,
                transportista_cuit TEXT NOT NULL,
                envio_id INTEGER,
                monto_facturado REAL NOT NULL,
                concepto TEXT CHECK (concepto IN ('flete', 'seguro', 'almacenaje', 'demora', 'recargo_combustible', 'peaje', 'otros')),
                fecha_factura TIMESTAMP,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'audited', 'approved', 'disputed', 'paid')),
                monto_aprobado REAL,
                diferencia REAL DEFAULT 0,
                razon_disputa TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS freight_tarifa (
                id SERIAL PRIMARY KEY,
                transportista_cuit TEXT NOT NULL,
                ruta_origen TEXT,
                ruta_destino TEXT,
                tipo_vehiculo TEXT,
                tarifa_base REAL DEFAULT 0,
                tarifa_por_km REAL DEFAULT 0,
                tarifa_por_kg REAL DEFAULT 0,
                vigencia_desde TIMESTAMP,
                vigencia_hasta TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS freight_audit_detalle (
                id SERIAL PRIMARY KEY,
                factura_flete_id INTEGER REFERENCES factura_flete(id) ON DELETE CASCADE,
                concepto TEXT,
                monto_facturado REAL,
                monto_esperado REAL,
                tarifa_id INTEGER,
                es_correcto INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factura_flete (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_factura TEXT UNIQUE NOT NULL,
                transportista_cuit TEXT NOT NULL,
                envio_id INTEGER,
                monto_facturado REAL NOT NULL,
                concepto TEXT CHECK (concepto IN ('flete', 'seguro', 'almacenaje', 'demora', 'recargo_combustible', 'peaje', 'otros')),
                fecha_factura TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'audited', 'approved', 'disputed', 'paid')),
                monto_aprobado REAL,
                diferencia REAL DEFAULT 0,
                razon_disputa TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS freight_tarifa (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transportista_cuit TEXT NOT NULL,
                ruta_origen TEXT,
                ruta_destino TEXT,
                tipo_vehiculo TEXT,
                tarifa_base REAL DEFAULT 0,
                tarifa_por_km REAL DEFAULT 0,
                tarifa_por_kg REAL DEFAULT 0,
                vigencia_desde TEXT,
                vigencia_hasta TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS freight_audit_detalle (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                factura_flete_id INTEGER,
                concepto TEXT,
                monto_facturado REAL,
                monto_esperado REAL,
                tarifa_id INTEGER,
                es_correcto INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (factura_flete_id) REFERENCES factura_flete(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_factura_flete_estado ON factura_flete(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_factura_flete_transportista ON factura_flete(transportista_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_factura_flete_envio ON factura_flete(envio_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_freight_tarifa_transportista ON freight_tarifa(transportista_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_freight_audit_detalle_factura ON freight_audit_detalle(factura_flete_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 063: Freight Audit - Tablas factura_flete, freight_tarifa, freight_audit_detalle creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_freight_audit_detalle_factura")
    cursor.execute("DROP INDEX IF EXISTS idx_freight_tarifa_transportista")
    cursor.execute("DROP INDEX IF EXISTS idx_factura_flete_envio")
    cursor.execute("DROP INDEX IF EXISTS idx_factura_flete_transportista")
    cursor.execute("DROP INDEX IF EXISTS idx_factura_flete_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS freight_audit_detalle")
    cursor.execute("DROP TABLE IF EXISTS freight_tarifa")
    cursor.execute("DROP TABLE IF EXISTS factura_flete")

    conn.commit()
    conn.close()

    print("✅ Migración 063: Revertida exitosamente")


if __name__ == '__main__':
    up()
