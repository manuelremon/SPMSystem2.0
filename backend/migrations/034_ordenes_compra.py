"""
Migration 034: Ordenes de Compra
Creates tables for purchase order management.

Tables:
- orden_compra: Main purchase order header
- orden_compra_item: Line items per purchase order
- orden_compra_historial: Status change history
- recepcion: Goods receipt header
- recepcion_item: Goods receipt line items

Fecha: 2026-02-14
"""

import logging
import sys
import os

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)


# =============================================================================
# DDL Statements - PostgreSQL
# =============================================================================

PG_DDL = [
    # 1. orden_compra
    """
    CREATE TABLE IF NOT EXISTS orden_compra (
        id SERIAL PRIMARY KEY,
        numero_oc TEXT UNIQUE NOT NULL,
        solicitud_id INTEGER REFERENCES solicitudes(id),
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
    """,
    # 2. orden_compra_item
    """
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
    """,
    # 3. orden_compra_historial
    """
    CREATE TABLE IF NOT EXISTS orden_compra_historial (
        id SERIAL PRIMARY KEY,
        orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id),
        estado_anterior TEXT NOT NULL,
        estado_nuevo TEXT NOT NULL,
        actor_id INTEGER NOT NULL,
        razon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # 4. recepcion
    """
    CREATE TABLE IF NOT EXISTS recepcion (
        id SERIAL PRIMARY KEY,
        orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id),
        numero_recepcion TEXT UNIQUE NOT NULL,
        fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recibido_por INTEGER NOT NULL,
        notas TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # 5. recepcion_item
    """
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
    """,
]

PG_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_oc_estado ON orden_compra(estado)",
    "CREATE INDEX IF NOT EXISTS idx_oc_solicitud ON orden_compra(solicitud_id)",
    "CREATE INDEX IF NOT EXISTS idx_oc_proveedor ON orden_compra(proveedor_cuit)",
    "CREATE INDEX IF NOT EXISTS idx_oc_creado_por ON orden_compra(creado_por)",
    "CREATE INDEX IF NOT EXISTS idx_oc_item_material ON orden_compra_item(material_codigo)",
    "CREATE INDEX IF NOT EXISTS idx_recepcion_oc ON recepcion(orden_compra_id)",
]

# =============================================================================
# DDL Statements - SQLite
# =============================================================================

SQLITE_DDL = [
    # 1. orden_compra
    """
    CREATE TABLE IF NOT EXISTS orden_compra (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_oc TEXT UNIQUE NOT NULL,
        solicitud_id INTEGER REFERENCES solicitudes(id),
        proveedor_cuit TEXT NOT NULL,
        proveedor_nombre TEXT NOT NULL,
        centro TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'borrador'
            CHECK(estado IN (
                'borrador', 'pendiente_aprobacion', 'aprobada',
                'enviada', 'recepcion_parcial', 'completada', 'cancelada'
            )),
        monto_total REAL DEFAULT 0,
        moneda TEXT DEFAULT 'ARS',
        fecha_emision TEXT,
        fecha_entrega_estimada TEXT,
        fecha_entrega_real TEXT,
        notas TEXT,
        creado_por INTEGER NOT NULL,
        aprobado_por INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # 2. orden_compra_item
    """
    CREATE TABLE IF NOT EXISTS orden_compra_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id) ON DELETE CASCADE,
        material_codigo TEXT NOT NULL,
        material_descripcion TEXT,
        cantidad REAL NOT NULL,
        cantidad_recibida REAL DEFAULT 0,
        precio_unitario REAL NOT NULL,
        precio_total REAL NOT NULL,
        unidad TEXT DEFAULT 'UN',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # 3. orden_compra_historial
    """
    CREATE TABLE IF NOT EXISTS orden_compra_historial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id),
        estado_anterior TEXT NOT NULL,
        estado_nuevo TEXT NOT NULL,
        actor_id INTEGER NOT NULL,
        razon TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # 4. recepcion
    """
    CREATE TABLE IF NOT EXISTS recepcion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_compra_id INTEGER NOT NULL REFERENCES orden_compra(id),
        numero_recepcion TEXT UNIQUE NOT NULL,
        fecha_recepcion TEXT DEFAULT CURRENT_TIMESTAMP,
        recibido_por INTEGER NOT NULL,
        notas TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    # 5. recepcion_item
    """
    CREATE TABLE IF NOT EXISTS recepcion_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recepcion_id INTEGER NOT NULL REFERENCES recepcion(id) ON DELETE CASCADE,
        orden_compra_item_id INTEGER NOT NULL REFERENCES orden_compra_item(id),
        cantidad_recibida REAL NOT NULL,
        estado_calidad TEXT DEFAULT 'aceptado'
            CHECK(estado_calidad IN ('aceptado', 'rechazado', 'parcial')),
        notas TEXT
    )
    """,
]

SQLITE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_oc_estado ON orden_compra(estado)",
    "CREATE INDEX IF NOT EXISTS idx_oc_solicitud ON orden_compra(solicitud_id)",
    "CREATE INDEX IF NOT EXISTS idx_oc_proveedor ON orden_compra(proveedor_cuit)",
    "CREATE INDEX IF NOT EXISTS idx_oc_creado_por ON orden_compra(creado_por)",
    "CREATE INDEX IF NOT EXISTS idx_oc_item_material ON orden_compra_item(material_codigo)",
    "CREATE INDEX IF NOT EXISTS idx_recepcion_oc ON recepcion(orden_compra_id)",
]

# Tables in dependency order (children first for rollback)
TABLES = [
    "recepcion_item",
    "recepcion",
    "orden_compra_historial",
    "orden_compra_item",
    "orden_compra",
]


def run_migration():
    """
    Execute migration 034: create purchase order tables.

    Dual-compatible: uses PostgreSQL in production, SQLite in development.
    """
    from backend.core.db import get_db_transaction, is_using_postgresql

    use_pg = is_using_postgresql()
    engine_name = "PostgreSQL" if use_pg else "SQLite"
    ddl_statements = PG_DDL if use_pg else SQLITE_DDL
    index_statements = PG_INDEXES if use_pg else SQLITE_INDEXES

    logger.info("=" * 60)
    logger.info("Migration 034: Ordenes de Compra (%s)", engine_name)
    logger.info("=" * 60)

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Create tables
            table_names = [
                "orden_compra",
                "orden_compra_item",
                "orden_compra_historial",
                "recepcion",
                "recepcion_item",
            ]
            for i, ddl in enumerate(ddl_statements):
                cursor.execute(ddl)
                logger.info("  + Table %s created", table_names[i])

            # Create indexes
            for idx_sql in index_statements:
                cursor.execute(idx_sql)
            logger.info("  + %d indexes created", len(index_statements))

        logger.info("Migration 034 completed successfully (%s)", engine_name)
        return True

    except Exception as e:
        logger.error("Migration 034 failed: %s", e)
        import traceback

        traceback.print_exc()
        return False


def rollback_migration():
    """
    Rollback migration 034: drop all purchase order tables.

    Drops tables in reverse dependency order to respect foreign keys.
    """
    from backend.core.db import get_db_transaction, is_using_postgresql

    engine_name = "PostgreSQL" if is_using_postgresql() else "SQLite"
    logger.info("Rollback 034: Dropping purchase order tables (%s)...", engine_name)

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            for table in TABLES:
                cursor.execute(f"DROP TABLE IF EXISTS {table}")
                logger.info("  - Table %s dropped", table)

        logger.info("Rollback 034 completed successfully")
        return True

    except Exception as e:
        logger.error("Rollback 034 failed: %s", e)
        return False


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_migration()
    else:
        run_migration()
