"""
Migración 045: Tablas de ahorro de costos
Fecha: 2026-02-15
Descripción: Añade tablas para tracking de ahorros y metas
"""

from backend.core.db import get_db_transaction, is_using_postgresql


def run_migration():
    """Ejecuta la migración para crear tablas de ahorro de costos."""
    with get_db_transaction() as (conn, cursor):
        if is_using_postgresql():
            # PostgreSQL DDL
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ahorro_costo (
                    id SERIAL PRIMARY KEY,
                    categoria TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    monto REAL NOT NULL,
                    moneda TEXT DEFAULT 'ARS',
                    material_codigo TEXT,
                    proveedor_cuit TEXT,
                    solicitud_id INTEGER,
                    descripcion TEXT,
                    registrado_por INTEGER NOT NULL,
                    fecha_realizacion TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CHECK (categoria IN ('negotiated', 'contract', 'rfq', 'bulk', 'other')),
                    CHECK (tipo IN ('hard', 'soft')),
                    CHECK (monto >= 0),
                    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL,
                    FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meta_ahorro (
                    id SERIAL PRIMARY KEY,
                    categoria TEXT NOT NULL,
                    periodo TEXT NOT NULL,
                    meta_monto REAL NOT NULL,
                    buyer_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CHECK (categoria IN ('negotiated', 'contract', 'rfq', 'bulk', 'other')),
                    CHECK (meta_monto >= 0),
                    CHECK (periodo ~ '^[0-9]{6}$'),
                    FOREIGN KEY (buyer_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                    UNIQUE (categoria, periodo, buyer_id)
                )
            """)

            # Índices PostgreSQL
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_categoria
                ON ahorro_costo(categoria)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_tipo
                ON ahorro_costo(tipo)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_fecha
                ON ahorro_costo(fecha_realizacion)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_registrado_por
                ON ahorro_costo(registrado_por)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_meta_periodo
                ON meta_ahorro(periodo)
            """)

        else:
            # SQLite DDL
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ahorro_costo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    categoria TEXT NOT NULL CHECK (categoria IN ('negotiated', 'contract', 'rfq', 'bulk', 'other')),
                    tipo TEXT NOT NULL CHECK (tipo IN ('hard', 'soft')),
                    monto REAL NOT NULL CHECK (monto >= 0),
                    moneda TEXT DEFAULT 'ARS',
                    material_codigo TEXT,
                    proveedor_cuit TEXT,
                    solicitud_id INTEGER,
                    descripcion TEXT,
                    registrado_por INTEGER NOT NULL,
                    fecha_realizacion TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL,
                    FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS meta_ahorro (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    categoria TEXT NOT NULL CHECK (categoria IN ('negotiated', 'contract', 'rfq', 'bulk', 'other')),
                    periodo TEXT NOT NULL,
                    meta_monto REAL NOT NULL CHECK (meta_monto >= 0),
                    buyer_id INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (buyer_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                    UNIQUE (categoria, periodo, buyer_id)
                )
            """)

            # Índices SQLite
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_categoria
                ON ahorro_costo(categoria)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_tipo
                ON ahorro_costo(tipo)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_fecha
                ON ahorro_costo(fecha_realizacion)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_ahorro_registrado_por
                ON ahorro_costo(registrado_por)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_meta_periodo
                ON meta_ahorro(periodo)
            """)

        conn.commit()
        print("✓ Migración 045: Tablas de ahorro de costos creadas exitosamente")


def rollback_migration():
    """Revierte la migración eliminando las tablas de ahorro de costos."""
    with get_db_transaction() as (conn, cursor):
        # Eliminar índices
        cursor.execute("DROP INDEX IF EXISTS idx_ahorro_categoria")
        cursor.execute("DROP INDEX IF EXISTS idx_ahorro_tipo")
        cursor.execute("DROP INDEX IF EXISTS idx_ahorro_fecha")
        cursor.execute("DROP INDEX IF EXISTS idx_ahorro_registrado_por")
        cursor.execute("DROP INDEX IF EXISTS idx_meta_periodo")

        # Eliminar tablas (orden inverso por FKs)
        cursor.execute("DROP TABLE IF EXISTS meta_ahorro")
        cursor.execute("DROP TABLE IF EXISTS ahorro_costo")

        conn.commit()
        print("✓ Migración 045: Rollback completado exitosamente")


if __name__ == "__main__":
    run_migration()
