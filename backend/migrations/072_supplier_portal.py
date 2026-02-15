"""
Migración 072: Supplier Portal & Advanced Shipment Notification (ASN)
Fecha: 2026-02-15
Descripción: Portal para proveedores con ASN, visibilidad de forecast y log de accesos
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portal_proveedor_usuario (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                nombre TEXT,
                password_hash TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('active', 'inactive', 'pending')),
                ultimo_login TIMESTAMP,
                token_reset TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portal_acceso_log (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES portal_proveedor_usuario(id),
                accion TEXT CHECK (accion IN ('login', 'view_po', 'ack_po', 'create_asn', 'view_forecast', 'upload_doc')),
                entidad_tipo TEXT,
                entidad_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS asn (
                id SERIAL PRIMARY KEY,
                numero_asn TEXT UNIQUE NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                orden_compra_id INTEGER,
                fecha_envio_estimada TIMESTAMP,
                transportista TEXT,
                guia_despacho TEXT,
                cantidad_total REAL DEFAULT 0,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'in_transit', 'received', 'cancelled')),
                notas TEXT,
                creado_por_portal INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS asn_item (
                id SERIAL PRIMARY KEY,
                asn_id INTEGER REFERENCES asn(id) ON DELETE CASCADE,
                orden_compra_item_id INTEGER,
                material_codigo TEXT,
                cantidad_enviada REAL,
                numero_lote TEXT,
                fecha_vencimiento TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forecast_compartido (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT,
                material_codigo TEXT,
                periodo TEXT,
                cantidad_forecast REAL,
                fuente TEXT DEFAULT 'manual' CHECK (fuente IN ('demand_plan', 'manual')),
                compartido_por INTEGER,
                fecha_compartido TIMESTAMP,
                visto_por_proveedor INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portal_proveedor_usuario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                nombre TEXT,
                password_hash TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('active', 'inactive', 'pending')),
                ultimo_login TEXT,
                token_reset TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portal_acceso_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER,
                accion TEXT CHECK (accion IN ('login', 'view_po', 'ack_po', 'create_asn', 'view_forecast', 'upload_doc')),
                entidad_tipo TEXT,
                entidad_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (usuario_id) REFERENCES portal_proveedor_usuario(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS asn (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_asn TEXT UNIQUE NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                orden_compra_id INTEGER,
                fecha_envio_estimada TEXT,
                transportista TEXT,
                guia_despacho TEXT,
                cantidad_total REAL DEFAULT 0,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'in_transit', 'received', 'cancelled')),
                notas TEXT,
                creado_por_portal INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS asn_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asn_id INTEGER,
                orden_compra_item_id INTEGER,
                material_codigo TEXT,
                cantidad_enviada REAL,
                numero_lote TEXT,
                fecha_vencimiento TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (asn_id) REFERENCES asn(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS forecast_compartido (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT,
                material_codigo TEXT,
                periodo TEXT,
                cantidad_forecast REAL,
                fuente TEXT DEFAULT 'manual' CHECK (fuente IN ('demand_plan', 'manual')),
                compartido_por INTEGER,
                fecha_compartido TEXT,
                visto_por_proveedor INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_portal_user_proveedor ON portal_proveedor_usuario(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_portal_user_email ON portal_proveedor_usuario(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_portal_log_usuario ON portal_acceso_log(usuario_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_asn_proveedor ON asn(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_asn_estado ON asn(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_asn_oc ON asn(orden_compra_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_asn_item_asn ON asn_item(asn_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_forecast_comp_proveedor ON forecast_compartido(proveedor_cuit)")

    conn.commit()
    conn.close()

    print("✅ Migración 072: Supplier Portal - Tablas portal_proveedor_usuario, portal_acceso_log, asn, asn_item, forecast_compartido creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_forecast_comp_proveedor")
    cursor.execute("DROP INDEX IF EXISTS idx_asn_item_asn")
    cursor.execute("DROP INDEX IF EXISTS idx_asn_oc")
    cursor.execute("DROP INDEX IF EXISTS idx_asn_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_asn_proveedor")
    cursor.execute("DROP INDEX IF EXISTS idx_portal_log_usuario")
    cursor.execute("DROP INDEX IF EXISTS idx_portal_user_email")
    cursor.execute("DROP INDEX IF EXISTS idx_portal_user_proveedor")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS forecast_compartido")
    cursor.execute("DROP TABLE IF EXISTS asn_item")
    cursor.execute("DROP TABLE IF EXISTS asn")
    cursor.execute("DROP TABLE IF EXISTS portal_acceso_log")
    cursor.execute("DROP TABLE IF EXISTS portal_proveedor_usuario")

    conn.commit()
    conn.close()

    print("✅ Migración 072: Revertida exitosamente")


if __name__ == '__main__':
    up()
