"""
Migración 058: Tablas de Returns Management (RMA)
Fecha: 2026-02-15
Descripción: Crea tablas para gestión de devoluciones a proveedores, incluyendo RMA
             (Return Merchandise Authorization) y seguimiento de créditos esperados.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de Returns RMA"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devolucion (
                id SERIAL PRIMARY KEY,
                numero_rma TEXT UNIQUE NOT NULL,
                tipo TEXT CHECK(tipo IN ('to_supplier', 'from_customer', 'internal_transfer')),
                orden_compra_id INTEGER,
                ncr_id INTEGER,
                proveedor_cuit TEXT,
                motivo TEXT CHECK(motivo IN ('quality_defect', 'wrong_item', 'excess_quantity', 'damaged', 'expired', 'other')),
                estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'pending_approval', 'approved', 'in_transit', 'received_by_supplier', 'credit_issued', 'closed', 'cancelled')),
                monto_credito_esperado REAL DEFAULT 0,
                monto_credito_recibido REAL DEFAULT 0,
                creado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devolucion_item (
                id SERIAL PRIMARY KEY,
                devolucion_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                motivo_detalle TEXT,
                FOREIGN KEY (devolucion_id) REFERENCES devolucion(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devolucion_historial (
                id SERIAL PRIMARY KEY,
                devolucion_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (devolucion_id) REFERENCES devolucion(id) ON DELETE CASCADE
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devolucion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_rma TEXT UNIQUE NOT NULL,
                tipo TEXT CHECK(tipo IN ('to_supplier', 'from_customer', 'internal_transfer')),
                orden_compra_id INTEGER,
                ncr_id INTEGER,
                proveedor_cuit TEXT,
                motivo TEXT CHECK(motivo IN ('quality_defect', 'wrong_item', 'excess_quantity', 'damaged', 'expired', 'other')),
                estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'pending_approval', 'approved', 'in_transit', 'received_by_supplier', 'credit_issued', 'closed', 'cancelled')),
                monto_credito_esperado REAL DEFAULT 0,
                monto_credito_recibido REAL DEFAULT 0,
                creado_por INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devolucion_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                devolucion_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                motivo_detalle TEXT,
                FOREIGN KEY (devolucion_id) REFERENCES devolucion(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS devolucion_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                devolucion_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (devolucion_id) REFERENCES devolucion(id) ON DELETE CASCADE
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_devolucion_estado
        ON devolucion(estado)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_devolucion_proveedor
        ON devolucion(proveedor_cuit)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_devolucion_oc
        ON devolucion(orden_compra_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_devolucion_item_dev
        ON devolucion_item(devolucion_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_devolucion_hist_dev
        ON devolucion_historial(devolucion_id)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 058: Tablas de Returns RMA creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_devolucion_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_devolucion_proveedor")
    cursor.execute("DROP INDEX IF EXISTS idx_devolucion_oc")
    cursor.execute("DROP INDEX IF EXISTS idx_devolucion_item_dev")
    cursor.execute("DROP INDEX IF EXISTS idx_devolucion_hist_dev")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS devolucion_historial")
    cursor.execute("DROP TABLE IF EXISTS devolucion_item")
    cursor.execute("DROP TABLE IF EXISTS devolucion")

    conn.commit()
    conn.close()

    print("✅ Migración 058: Revertida exitosamente")


if __name__ == '__main__':
    up()
