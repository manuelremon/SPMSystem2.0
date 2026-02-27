"""
Migration 087: Fix ordenes_compra schema

1. Drop view 'orden_compra' (legacy mapping to purchase_orders)
2. Drop old 'orden_compra_item' table (wrong schema, empty)
3. Recreate tables from migration 034 with correct schema
4. Make estado_anterior nullable in orden_compra_historial (first
   history entry on order creation has no previous state)

Fecha: 2026-02-25
"""

import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)


def up():
    from backend.core.db import get_db_transaction, is_using_postgresql

    if not is_using_postgresql():
        logger.info("Migration 087: SQLite - skipping (tables created by 034)")
        return True

    logger.info("=" * 60)
    logger.info("Migration 087: Fix ordenes_compra schema (PostgreSQL)")
    logger.info("=" * 60)

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Step 1: Drop the view 'orden_compra' (maps to purchase_orders)
            cursor.execute("DROP VIEW IF EXISTS orden_compra CASCADE")
            logger.info("  - Dropped view orden_compra")

            # Step 2: Drop old orden_compra_item (wrong schema)
            cursor.execute("DROP TABLE IF EXISTS orden_compra_item CASCADE")
            logger.info("  - Dropped old orden_compra_item")

            # Step 3: Create orden_compra as a real table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orden_compra (
                    id SERIAL PRIMARY KEY,
                    numero_oc TEXT UNIQUE NOT NULL,
                    solicitud_id INTEGER,
                    contrato_id INTEGER,
                    proveedor_cuit TEXT NOT NULL,
                    proveedor_nombre TEXT NOT NULL,
                    centro TEXT NOT NULL,
                    estado TEXT NOT NULL DEFAULT 'borrador',
                    monto_total REAL DEFAULT 0,
                    moneda TEXT DEFAULT 'ARS',
                    fecha_emision TIMESTAMP,
                    fecha_entrega_estimada TIMESTAMP,
                    fecha_entrega_real TIMESTAMP,
                    notas TEXT,
                    creado_por INTEGER NOT NULL,
                    aprobado_por INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT chk_oc_estado CHECK (estado IN (
                        'borrador', 'pendiente_aprobacion', 'aprobada',
                        'enviada', 'recepcion_parcial', 'completada', 'cancelada'
                    ))
                )
            """)
            logger.info("  + Created table orden_compra")

            # Step 4: Create orden_compra_item with correct schema
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orden_compra_item (
                    id SERIAL PRIMARY KEY,
                    orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id) ON DELETE CASCADE,
                    material_codigo TEXT NOT NULL,
                    material_descripcion TEXT,
                    cantidad REAL NOT NULL,
                    cantidad_recibida REAL DEFAULT 0,
                    precio_unitario REAL NOT NULL,
                    precio_total REAL NOT NULL,
                    unidad TEXT DEFAULT 'UN',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("  + Created table orden_compra_item")

            # Step 5: Create orden_compra_historial with nullable estado_anterior
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orden_compra_historial (
                    id SERIAL PRIMARY KEY,
                    orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id),
                    estado_anterior TEXT,
                    estado_nuevo TEXT NOT NULL,
                    actor_id INTEGER NOT NULL,
                    razon TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("  + Created table orden_compra_historial")

            # Step 6: Create recepcion
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recepcion (
                    id SERIAL PRIMARY KEY,
                    orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id),
                    numero_recepcion TEXT UNIQUE NOT NULL,
                    fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    recibido_por INTEGER NOT NULL,
                    notas TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("  + Created table recepcion")

            # Step 7: Create recepcion_item
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recepcion_item (
                    id SERIAL PRIMARY KEY,
                    recepcion_id INTEGER NOT NULL REFERENCES recepcion(id) ON DELETE CASCADE,
                    orden_compra_item_id INTEGER NOT NULL REFERENCES orden_compra_item(id),
                    cantidad_recibida REAL NOT NULL,
                    estado_calidad TEXT DEFAULT 'aceptado',
                    notas TEXT,
                    CONSTRAINT chk_ri_calidad CHECK (estado_calidad IN (
                        'aceptado', 'rechazado', 'parcial'
                    ))
                )
            """)
            logger.info("  + Created table recepcion_item")

            # Step 8: Create indexes
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_oc_estado ON orden_compra(estado)",
                "CREATE INDEX IF NOT EXISTS idx_oc_solicitud ON orden_compra(solicitud_id)",
                "CREATE INDEX IF NOT EXISTS idx_oc_proveedor ON orden_compra(proveedor_cuit)",
                "CREATE INDEX IF NOT EXISTS idx_oc_creado_por ON orden_compra(creado_por)",
                "CREATE INDEX IF NOT EXISTS idx_oc_contrato ON orden_compra(contrato_id)",
                "CREATE INDEX IF NOT EXISTS idx_oc_item_material ON orden_compra_item(material_codigo)",
                "CREATE INDEX IF NOT EXISTS idx_recepcion_oc ON recepcion(orden_compra_id)",
            ]
            for idx_sql in indexes:
                cursor.execute(idx_sql)
            logger.info("  + %d indexes created", len(indexes))

        logger.info("Migration 087 completed successfully")
        return True
    except Exception as e:
        logger.error("Migration 087 failed: %s", e)
        import traceback
        traceback.print_exc()
        return False


def down():
    from backend.core.db import get_db_transaction, is_using_postgresql

    if not is_using_postgresql():
        return True

    logger.info("Rollback 087: Dropping OC tables and restoring view")

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Drop in reverse dependency order
            for table in ["recepcion_item", "recepcion", "orden_compra_historial",
                          "orden_compra_item", "orden_compra"]:
                cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
                logger.info("  - Dropped table %s", table)

            # Restore the original view
            cursor.execute("""
                CREATE VIEW orden_compra AS
                SELECT id, solped_id, solicitud_id, proveedor_email,
                       proveedor_nombre, numero, status, subtotal,
                       moneda, created_by, updated_at, created_at
                FROM purchase_orders
            """)
            logger.info("  + Restored view orden_compra")

        logger.info("Rollback 087 completed successfully")
        return True
    except Exception as e:
        logger.error("Rollback 087 failed: %s", e)
        return False


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        down()
    else:
        up()
