"""
Migración 075: Price Management & Price Lists
Fecha: 2026-02-15
Descripción: Gestión de listas de precios, precios por proveedor, negociaciones y historial
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    using_pg = is_using_postgresql()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        if using_pg:
            # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS lista_precios (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    proveedor_cuit TEXT,
                    moneda TEXT DEFAULT 'ARS',
                    fecha_vigencia_desde DATE,
                    fecha_vigencia_hasta DATE,
                    estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'active', 'expired')),
                    notas TEXT,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precio_item (
                    id SERIAL PRIMARY KEY,
                    lista_id INTEGER REFERENCES lista_precios(id) ON DELETE CASCADE,
                    material_codigo TEXT NOT NULL,
                    precio_unitario REAL NOT NULL,
                    unidad TEXT,
                    cantidad_minima INTEGER DEFAULT 1,
                    cantidad_maxima INTEGER,
                    descuento_pct REAL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(lista_id, material_codigo, cantidad_minima)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precio_negociacion (
                    id SERIAL PRIMARY KEY,
                    material_codigo TEXT NOT NULL,
                    proveedor_cuit TEXT,
                    precio_anterior REAL,
                    precio_nuevo REAL NOT NULL,
                    descuento_negociado_pct REAL DEFAULT 0,
                    negociado_por INTEGER,
                    fecha DATE,
                    notas TEXT,
                    estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'approved', 'rejected')),
                    aprobado_por INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precio_historial (
                    id SERIAL PRIMARY KEY,
                    material_codigo TEXT NOT NULL,
                    proveedor_cuit TEXT,
                    precio REAL NOT NULL,
                    fecha_desde DATE,
                    fecha_hasta DATE,
                    fuente TEXT CHECK (fuente IN ('lista_precios', 'negociacion', 'contrato', 'manual')),
                    referencia_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        else:
            # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS lista_precios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    proveedor_cuit TEXT,
                    moneda TEXT DEFAULT 'ARS',
                    fecha_vigencia_desde TEXT,
                    fecha_vigencia_hasta TEXT,
                    estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'active', 'expired')),
                    notas TEXT,
                    created_by INTEGER,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precio_item (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lista_id INTEGER,
                    material_codigo TEXT NOT NULL,
                    precio_unitario REAL NOT NULL,
                    unidad TEXT,
                    cantidad_minima INTEGER DEFAULT 1,
                    cantidad_maxima INTEGER,
                    descuento_pct REAL DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (lista_id) REFERENCES lista_precios(id) ON DELETE CASCADE,
                    UNIQUE(lista_id, material_codigo, cantidad_minima)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precio_negociacion (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    material_codigo TEXT NOT NULL,
                    proveedor_cuit TEXT,
                    precio_anterior REAL,
                    precio_nuevo REAL NOT NULL,
                    descuento_negociado_pct REAL DEFAULT 0,
                    negociado_por INTEGER,
                    fecha TEXT,
                    notas TEXT,
                    estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'approved', 'rejected')),
                    aprobado_por INTEGER,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS precio_historial (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    material_codigo TEXT NOT NULL,
                    proveedor_cuit TEXT,
                    precio REAL NOT NULL,
                    fecha_desde TEXT,
                    fecha_hasta TEXT,
                    fuente TEXT CHECK (fuente IN ('lista_precios', 'negociacion', 'contrato', 'manual')),
                    referencia_id INTEGER,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

        # Crear índices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_lista_proveedor ON lista_precios(proveedor_cuit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_lista_estado ON lista_precios(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_precio_item_lista ON precio_item(lista_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_precio_item_material ON precio_item(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_precio_neg_material ON precio_negociacion(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_precio_neg_estado ON precio_negociacion(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_precio_hist_material ON precio_historial(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_precio_hist_proveedor ON precio_historial(proveedor_cuit)")

        conn.commit()

    print("✅ Migración 075: Price Management - Tablas lista_precios, precio_item, precio_negociacion, precio_historial creadas")


def down():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar índices primero
        cursor.execute("DROP INDEX IF EXISTS idx_precio_hist_proveedor")
        cursor.execute("DROP INDEX IF EXISTS idx_precio_hist_material")
        cursor.execute("DROP INDEX IF EXISTS idx_precio_neg_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_precio_neg_material")
        cursor.execute("DROP INDEX IF EXISTS idx_precio_item_material")
        cursor.execute("DROP INDEX IF EXISTS idx_precio_item_lista")
        cursor.execute("DROP INDEX IF EXISTS idx_lista_estado")
        cursor.execute("DROP INDEX IF EXISTS idx_lista_proveedor")

        # Eliminar tablas en orden inverso (respetando FKs)
        cursor.execute("DROP TABLE IF EXISTS precio_historial")
        cursor.execute("DROP TABLE IF EXISTS precio_negociacion")
        cursor.execute("DROP TABLE IF EXISTS precio_item")
        cursor.execute("DROP TABLE IF EXISTS lista_precios")

        conn.commit()

    print("✅ Migración 075: Revertida exitosamente")


if __name__ == '__main__':
    up()
