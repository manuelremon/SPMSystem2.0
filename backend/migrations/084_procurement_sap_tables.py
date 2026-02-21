"""
Migración 084: SAP Procurement Base Tables
Fecha: 2026-02-20
Descripción: Crea las 3 tablas base de procurement SAP que faltan:
  - sap_solpeds (requisiciones SAP)
  - sap_purchase_orders (órdenes de compra SAP)
  - sap_import_log (historial de importaciones)
Estas tablas son requeridas por procurement_service.py y sus vistas asociadas.
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sap_solpeds (
                    id SERIAL PRIMARY KEY,
                    solped_id TEXT NOT NULL,
                    posicion TEXT,
                    material_codigo TEXT,
                    material_descripcion TEXT,
                    centro TEXT,
                    fecha_creacion TIMESTAMP,
                    cantidad REAL,
                    precio_unitario REAL,
                    importe_total REAL,
                    moneda TEXT DEFAULT 'USD',
                    estrategia_liberacion TEXT,
                    fecha_entrega_solicitada TIMESTAMP,
                    creado_por TEXT,
                    solicitante TEXT,
                    UNIQUE(solped_id, posicion)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sap_purchase_orders (
                    id SERIAL PRIMARY KEY,
                    pedido_id TEXT NOT NULL,
                    solped_id TEXT,
                    solped_posicion TEXT,
                    proveedor_cuit TEXT,
                    proveedor_nombre TEXT,
                    centro TEXT,
                    material_codigo TEXT,
                    cantidad_pedida REAL,
                    cantidad_recepcionada REAL,
                    valor_pedido REAL,
                    valor_recibido REAL,
                    fecha_pedido TIMESTAMP,
                    fecha_recepcion TIMESTAMP,
                    moneda_pedido TEXT DEFAULT 'USD'
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sap_import_log (
                    id SERIAL PRIMARY KEY,
                    filename TEXT,
                    user_id TEXT,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    finished_at TIMESTAMP,
                    records_inserted INTEGER DEFAULT 0,
                    records_updated INTEGER DEFAULT 0,
                    records_error INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'in_progress',
                    error_message TEXT
                )
            """)

        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sap_solpeds (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    solped_id TEXT NOT NULL,
                    posicion TEXT,
                    material_codigo TEXT,
                    material_descripcion TEXT,
                    centro TEXT,
                    fecha_creacion TEXT,
                    cantidad REAL,
                    precio_unitario REAL,
                    importe_total REAL,
                    moneda TEXT DEFAULT 'USD',
                    estrategia_liberacion TEXT,
                    fecha_entrega_solicitada TEXT,
                    creado_por TEXT,
                    solicitante TEXT,
                    UNIQUE(solped_id, posicion)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sap_purchase_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pedido_id TEXT NOT NULL,
                    solped_id TEXT,
                    solped_posicion TEXT,
                    proveedor_cuit TEXT,
                    proveedor_nombre TEXT,
                    centro TEXT,
                    material_codigo TEXT,
                    cantidad_pedida REAL,
                    cantidad_recepcionada REAL,
                    valor_pedido REAL,
                    valor_recibido REAL,
                    fecha_pedido TEXT,
                    fecha_recepcion TEXT,
                    moneda_pedido TEXT DEFAULT 'USD'
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sap_import_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT,
                    user_id TEXT,
                    started_at TEXT DEFAULT (datetime('now')),
                    finished_at TEXT,
                    records_inserted INTEGER DEFAULT 0,
                    records_updated INTEGER DEFAULT 0,
                    records_error INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'in_progress',
                    error_message TEXT
                )
            """)

        # Índices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_solpeds_solped_id ON sap_solpeds(solped_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_solpeds_material ON sap_solpeds(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_solpeds_centro ON sap_solpeds(centro)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_solpeds_fecha ON sap_solpeds(fecha_creacion)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_solpeds_liberacion ON sap_solpeds(estrategia_liberacion)")

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_po_pedido_id ON sap_purchase_orders(pedido_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_po_solped ON sap_purchase_orders(solped_id, solped_posicion)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_po_proveedor ON sap_purchase_orders(proveedor_cuit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_po_fecha_pedido ON sap_purchase_orders(fecha_pedido)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_po_recepcion ON sap_purchase_orders(fecha_recepcion)")

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_import_status ON sap_import_log(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sap_import_started ON sap_import_log(started_at)")

        conn.commit()

    print("Migración 084: SAP Procurement Base Tables - sap_solpeds, sap_purchase_orders, sap_import_log creadas")


def down():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar índices
        cursor.execute("DROP INDEX IF EXISTS idx_sap_import_started")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_import_status")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_po_recepcion")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_po_fecha_pedido")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_po_proveedor")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_po_solped")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_po_pedido_id")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_solpeds_liberacion")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_solpeds_fecha")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_solpeds_centro")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_solpeds_material")
        cursor.execute("DROP INDEX IF EXISTS idx_sap_solpeds_solped_id")

        # Eliminar tablas (orden inverso por dependencias lógicas)
        cursor.execute("DROP TABLE IF EXISTS sap_import_log")
        cursor.execute("DROP TABLE IF EXISTS sap_purchase_orders")
        cursor.execute("DROP TABLE IF EXISTS sap_solpeds")

        conn.commit()

    print("Migración 084: Revertida exitosamente")


if __name__ == '__main__':
    up()
