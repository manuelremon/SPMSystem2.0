"""
Migración 076: Consignment Inventory
Fecha: 2026-02-15
Descripción: Tablas para inventario en consignación (supplier-owned inventory at customer location)
"""


def up():
    from backend.core.db import get_db_connection, is_using_postgresql

    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_programa (
                    id SERIAL PRIMARY KEY,
                    proveedor_cuit TEXT NOT NULL,
                    almacen_id INTEGER,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    estado TEXT DEFAULT 'active' CHECK(estado IN ('active', 'suspended', 'terminated')),
                    condiciones_pago TEXT,
                    porcentaje_margen REAL,
                    periodo_reconciliacion TEXT DEFAULT 'mensual' CHECK(periodo_reconciliacion IN ('mensual', 'quincenal')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_stock (
                    id SERIAL PRIMARY KEY,
                    programa_id INTEGER REFERENCES consignment_programa(id) ON DELETE CASCADE,
                    material_codigo TEXT NOT NULL,
                    cantidad_disponible REAL DEFAULT 0,
                    cantidad_consumida_acumulada REAL DEFAULT 0,
                    valor_unitario REAL,
                    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(programa_id, material_codigo)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_consumo (
                    id SERIAL PRIMARY KEY,
                    stock_id INTEGER REFERENCES consignment_stock(id) ON DELETE CASCADE,
                    cantidad REAL NOT NULL,
                    solicitud_id INTEGER,
                    usuario_id INTEGER,
                    fecha_consumo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    facturado INTEGER DEFAULT 0,
                    factura_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_reconciliacion (
                    id SERIAL PRIMARY KEY,
                    programa_id INTEGER REFERENCES consignment_programa(id) ON DELETE CASCADE,
                    periodo TEXT NOT NULL,
                    cantidad_consumida_total REAL,
                    monto_total REAL,
                    estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'enviado', 'confirmado', 'facturado')),
                    fecha_envio TIMESTAMP,
                    fecha_confirmacion TIMESTAMP,
                    notas TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(programa_id, periodo)
                )
            """)

        else:
            # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_programa (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    proveedor_cuit TEXT NOT NULL,
                    almacen_id INTEGER,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    estado TEXT DEFAULT 'active' CHECK(estado IN ('active', 'suspended', 'terminated')),
                    condiciones_pago TEXT,
                    porcentaje_margen REAL,
                    periodo_reconciliacion TEXT DEFAULT 'mensual' CHECK(periodo_reconciliacion IN ('mensual', 'quincenal')),
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_stock (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    programa_id INTEGER,
                    material_codigo TEXT NOT NULL,
                    cantidad_disponible REAL DEFAULT 0,
                    cantidad_consumida_acumulada REAL DEFAULT 0,
                    valor_unitario REAL,
                    ultima_actualizacion TEXT DEFAULT (datetime('now')),
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (programa_id) REFERENCES consignment_programa(id) ON DELETE CASCADE,
                    UNIQUE(programa_id, material_codigo)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_consumo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    stock_id INTEGER,
                    cantidad REAL NOT NULL,
                    solicitud_id INTEGER,
                    usuario_id INTEGER,
                    fecha_consumo TEXT DEFAULT (datetime('now')),
                    facturado INTEGER DEFAULT 0,
                    factura_id INTEGER,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (stock_id) REFERENCES consignment_stock(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS consignment_reconciliacion (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    programa_id INTEGER,
                    periodo TEXT NOT NULL,
                    cantidad_consumida_total REAL,
                    monto_total REAL,
                    estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'enviado', 'confirmado', 'facturado')),
                    fecha_envio TEXT,
                    fecha_confirmacion TEXT,
                    notas TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (programa_id) REFERENCES consignment_programa(id) ON DELETE CASCADE,
                    UNIQUE(programa_id, periodo)
                )
            """)

        # Crear índices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_prog_proveedor ON consignment_programa(proveedor_cuit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_prog_estado ON consignment_programa(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_stock_prog ON consignment_stock(programa_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_stock_material ON consignment_stock(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_consumo_stock ON consignment_consumo(stock_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_consumo_facturado ON consignment_consumo(facturado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_recon_prog ON consignment_reconciliacion(programa_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_consignment_recon_estado ON consignment_reconciliacion(estado)")

        conn.commit()

    print("✅ Migración 076: Consignment Inventory - Tablas consignment_programa, consignment_stock, consignment_consumo, consignment_reconciliacion creadas")


def down():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar índices primero
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_recon_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_recon_prog")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_consumo_facturado")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_consumo_stock")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_stock_material")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_stock_prog")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_prog_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_consignment_prog_proveedor")

        # Eliminar tablas en orden inverso (respetando FKs)
        cursor.execute("DROP TABLE IF EXISTS consignment_reconciliacion")
        cursor.execute("DROP TABLE IF EXISTS consignment_consumo")
        cursor.execute("DROP TABLE IF EXISTS consignment_stock")
        cursor.execute("DROP TABLE IF EXISTS consignment_programa")

        conn.commit()

    print("✅ Migración 076: Revertida exitosamente")


if __name__ == '__main__':
    up()
