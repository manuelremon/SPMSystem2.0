"""
Migración 082: Supplier Finance & Dynamic Discounting
Fecha: 2026-02-15
Descripción: Programas de descuento dinámico, ofertas de pago anticipado y gestión de términos de pago
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS programa_descuento (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    tipo TEXT NOT NULL CHECK (tipo IN ('early_payment', 'volume_rebate', 'prompt_payment')),
                    descuento_base_pct REAL NOT NULL,
                    dias_anticipacion INTEGER,
                    formula TEXT,
                    estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'paused', 'terminated')),
                    presupuesto_anual REAL,
                    utilizado_anual REAL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS oferta_descuento (
                    id SERIAL PRIMARY KEY,
                    programa_id INTEGER REFERENCES programa_descuento(id) ON DELETE CASCADE,
                    factura_id INTEGER,
                    proveedor_cuit TEXT NOT NULL,
                    monto_factura REAL NOT NULL,
                    descuento_ofrecido_pct REAL NOT NULL,
                    monto_descuento REAL NOT NULL,
                    fecha_pago_original DATE NOT NULL,
                    fecha_pago_anticipado DATE NOT NULL,
                    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'pagada')),
                    aceptada_por INTEGER,
                    fecha_aceptacion TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS terminos_pago_proveedor (
                    id SERIAL PRIMARY KEY,
                    proveedor_cuit TEXT UNIQUE NOT NULL,
                    termino_estandar_dias INTEGER DEFAULT 30,
                    termino_negociado_dias INTEGER,
                    descuento_pronto_pago_pct REAL,
                    historico_cumplimiento_pct REAL,
                    ultima_revision DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cashflow_simulacion (
                    id SERIAL PRIMARY KEY,
                    escenario TEXT NOT NULL,
                    periodo TEXT NOT NULL,
                    monto_facturas REAL NOT NULL,
                    monto_descuentos REAL NOT NULL,
                    ahorro_neto REAL NOT NULL,
                    dias_pago_promedio REAL,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        else:
            # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS programa_descuento (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    tipo TEXT NOT NULL CHECK (tipo IN ('early_payment', 'volume_rebate', 'prompt_payment')),
                    descuento_base_pct REAL NOT NULL,
                    dias_anticipacion INTEGER,
                    formula TEXT,
                    estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'paused', 'terminated')),
                    presupuesto_anual REAL,
                    utilizado_anual REAL DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS oferta_descuento (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    programa_id INTEGER,
                    factura_id INTEGER,
                    proveedor_cuit TEXT NOT NULL,
                    monto_factura REAL NOT NULL,
                    descuento_ofrecido_pct REAL NOT NULL,
                    monto_descuento REAL NOT NULL,
                    fecha_pago_original TEXT NOT NULL,
                    fecha_pago_anticipado TEXT NOT NULL,
                    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'pagada')),
                    aceptada_por INTEGER,
                    fecha_aceptacion TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (programa_id) REFERENCES programa_descuento(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS terminos_pago_proveedor (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    proveedor_cuit TEXT UNIQUE NOT NULL,
                    termino_estandar_dias INTEGER DEFAULT 30,
                    termino_negociado_dias INTEGER,
                    descuento_pronto_pago_pct REAL,
                    historico_cumplimiento_pct REAL,
                    ultima_revision TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cashflow_simulacion (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    escenario TEXT NOT NULL,
                    periodo TEXT NOT NULL,
                    monto_facturas REAL NOT NULL,
                    monto_descuentos REAL NOT NULL,
                    ahorro_neto REAL NOT NULL,
                    dias_pago_promedio REAL,
                    created_by INTEGER,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

        # Crear índices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_programa_desc_tipo ON programa_descuento(tipo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_programa_desc_estado ON programa_descuento(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_oferta_desc_programa ON oferta_descuento(programa_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_oferta_desc_proveedor ON oferta_descuento(proveedor_cuit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_oferta_desc_estado ON oferta_descuento(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_oferta_desc_factura ON oferta_descuento(factura_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_terminos_pago_cuit ON terminos_pago_proveedor(proveedor_cuit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_cashflow_sim_escenario ON cashflow_simulacion(escenario)")

        conn.commit()

    print("✅ Migración 082: Supplier Finance - Tablas programa_descuento, oferta_descuento, terminos_pago_proveedor, cashflow_simulacion creadas")


def down():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar índices primero
        cursor.execute("DROP INDEX IF EXISTS idx_cashflow_sim_escenario")
        cursor.execute("DROP INDEX IF EXISTS idx_terminos_pago_cuit")
        cursor.execute("DROP INDEX IF EXISTS idx_oferta_desc_factura")
        cursor.execute("DROP INDEX IF EXISTS idx_oferta_desc_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_oferta_desc_proveedor")
        cursor.execute("DROP INDEX IF EXISTS idx_oferta_desc_programa")
        cursor.execute("DROP INDEX IF EXISTS idx_programa_desc_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_programa_desc_tipo")

        # Eliminar tablas en orden inverso (respetando FKs)
        cursor.execute("DROP TABLE IF EXISTS cashflow_simulacion")
        cursor.execute("DROP TABLE IF EXISTS terminos_pago_proveedor")
        cursor.execute("DROP TABLE IF EXISTS oferta_descuento")
        cursor.execute("DROP TABLE IF EXISTS programa_descuento")

        conn.commit()

    print("✅ Migración 082: Revertida exitosamente")


if __name__ == '__main__':
    up()
