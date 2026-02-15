"""
Migración 054: Tablas de Invoice Matching (3-way matching)
Fecha: 2026-02-15
Descripción: Crea tablas para matching de facturas contra órdenes de compra y recepciones,
             incluyendo lógica de 3-way matching y tolerancias configurables.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de Invoice Matching"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factura_proveedor (
                id SERIAL PRIMARY KEY,
                numero_factura TEXT UNIQUE NOT NULL,
                orden_compra_id INTEGER,
                proveedor_cuit TEXT NOT NULL,
                monto_total REAL NOT NULL,
                moneda TEXT DEFAULT 'ARS',
                fecha_factura TIMESTAMP NOT NULL,
                fecha_vencimiento_pago TIMESTAMP,
                estado TEXT DEFAULT 'pending' CHECK(estado IN ('pending', 'matched', 'partial_match', 'disputed', 'approved', 'paid')),
                recepcion_id INTEGER,
                tipo_comprobante TEXT,
                subido_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (orden_compra_id) REFERENCES orden_compra(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factura_item (
                id SERIAL PRIMARY KEY,
                factura_id INTEGER NOT NULL,
                orden_compra_item_id INTEGER,
                material_codigo TEXT NOT NULL,
                cantidad_facturada REAL NOT NULL,
                precio_unitario REAL NOT NULL,
                precio_total REAL NOT NULL,
                FOREIGN KEY (factura_id) REFERENCES factura_proveedor(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS matching_resultado (
                id SERIAL PRIMARY KEY,
                factura_id INTEGER NOT NULL,
                orden_compra_id INTEGER,
                recepcion_id INTEGER,
                estado TEXT DEFAULT 'match' CHECK(estado IN ('match', 'quantity_mismatch', 'price_mismatch', 'both_mismatch', 'no_receipt')),
                diferencia_cantidad REAL DEFAULT 0,
                diferencia_precio REAL DEFAULT 0,
                tolerancia_aplicada REAL DEFAULT 0,
                aprobado_por INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (factura_id) REFERENCES factura_proveedor(id) ON DELETE CASCADE
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factura_proveedor (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_factura TEXT UNIQUE NOT NULL,
                orden_compra_id INTEGER,
                proveedor_cuit TEXT NOT NULL,
                monto_total REAL NOT NULL,
                moneda TEXT DEFAULT 'ARS',
                fecha_factura TEXT NOT NULL,
                fecha_vencimiento_pago TEXT,
                estado TEXT DEFAULT 'pending' CHECK(estado IN ('pending', 'matched', 'partial_match', 'disputed', 'approved', 'paid')),
                recepcion_id INTEGER,
                tipo_comprobante TEXT,
                subido_por INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (orden_compra_id) REFERENCES orden_compra(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factura_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                factura_id INTEGER NOT NULL,
                orden_compra_item_id INTEGER,
                material_codigo TEXT NOT NULL,
                cantidad_facturada REAL NOT NULL,
                precio_unitario REAL NOT NULL,
                precio_total REAL NOT NULL,
                FOREIGN KEY (factura_id) REFERENCES factura_proveedor(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS matching_resultado (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                factura_id INTEGER NOT NULL,
                orden_compra_id INTEGER,
                recepcion_id INTEGER,
                estado TEXT DEFAULT 'match' CHECK(estado IN ('match', 'quantity_mismatch', 'price_mismatch', 'both_mismatch', 'no_receipt')),
                diferencia_cantidad REAL DEFAULT 0,
                diferencia_precio REAL DEFAULT 0,
                tolerancia_aplicada REAL DEFAULT 0,
                aprobado_por INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (factura_id) REFERENCES factura_proveedor(id) ON DELETE CASCADE
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_factura_proveedor_estado
        ON factura_proveedor(estado)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_factura_proveedor_oc
        ON factura_proveedor(orden_compra_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_factura_proveedor_cuit
        ON factura_proveedor(proveedor_cuit)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_factura_item_factura
        ON factura_item(factura_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_matching_resultado_factura
        ON matching_resultado(factura_id)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 054: Tablas de Invoice Matching creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_factura_proveedor_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_factura_proveedor_oc")
    cursor.execute("DROP INDEX IF EXISTS idx_factura_proveedor_cuit")
    cursor.execute("DROP INDEX IF EXISTS idx_factura_item_factura")
    cursor.execute("DROP INDEX IF EXISTS idx_matching_resultado_factura")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS matching_resultado")
    cursor.execute("DROP TABLE IF EXISTS factura_item")
    cursor.execute("DROP TABLE IF EXISTS factura_proveedor")

    conn.commit()
    conn.close()

    print("✅ Migración 054: Revertida exitosamente")


if __name__ == '__main__':
    up()
