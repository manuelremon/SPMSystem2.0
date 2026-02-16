"""
Migración 081: Advanced Packaging & Shipping Labels
Fecha: 2026-02-15
Descripción: Templates de empaque, packing lists, optimización de bultos y generación de etiquetas
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packaging_template (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('caja', 'pallet', 'contenedor')),
                largo REAL,
                ancho REAL,
                alto REAL,
                peso_max REAL,
                unidad_medida TEXT DEFAULT 'cm' CHECK (unidad_medida IN ('cm', 'in')),
                material_empaque TEXT,
                costo_unitario REAL DEFAULT 0,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'inactive')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packing_list (
                id SERIAL PRIMARY KEY,
                numero TEXT UNIQUE NOT NULL,
                envio_id INTEGER,
                orden_compra_id INTEGER,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'empacado', 'despachado')),
                peso_total REAL DEFAULT 0,
                bultos_total INTEGER DEFAULT 0,
                notas TEXT,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packing_item (
                id SERIAL PRIMARY KEY,
                packing_list_id INTEGER REFERENCES packing_list(id) ON DELETE CASCADE,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                lote_id INTEGER,
                template_id INTEGER REFERENCES packaging_template(id),
                bulto_numero INTEGER,
                peso_item REAL,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shipping_label (
                id SERIAL PRIMARY KEY,
                packing_list_id INTEGER REFERENCES packing_list(id) ON DELETE CASCADE,
                bulto_numero INTEGER,
                tipo TEXT DEFAULT 'shipping' CHECK (tipo IN ('shipping', 'return', 'hazmat', 'customs')),
                contenido TEXT,
                formato TEXT DEFAULT 'pdf' CHECK (formato IN ('pdf', 'zpl', 'png')),
                url_label TEXT,
                impreso INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packaging_template (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('caja', 'pallet', 'contenedor')),
                largo REAL,
                ancho REAL,
                alto REAL,
                peso_max REAL,
                unidad_medida TEXT DEFAULT 'cm' CHECK (unidad_medida IN ('cm', 'in')),
                material_empaque TEXT,
                costo_unitario REAL DEFAULT 0,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'inactive')),
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packing_list (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero TEXT UNIQUE NOT NULL,
                envio_id INTEGER,
                orden_compra_id INTEGER,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'empacado', 'despachado')),
                peso_total REAL DEFAULT 0,
                bultos_total INTEGER DEFAULT 0,
                notas TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packing_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                packing_list_id INTEGER,
                material_codigo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                lote_id INTEGER,
                template_id INTEGER,
                bulto_numero INTEGER,
                peso_item REAL,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (packing_list_id) REFERENCES packing_list(id) ON DELETE CASCADE,
                FOREIGN KEY (template_id) REFERENCES packaging_template(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shipping_label (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                packing_list_id INTEGER,
                bulto_numero INTEGER,
                tipo TEXT DEFAULT 'shipping' CHECK (tipo IN ('shipping', 'return', 'hazmat', 'customs')),
                contenido TEXT,
                formato TEXT DEFAULT 'pdf' CHECK (formato IN ('pdf', 'zpl', 'png')),
                url_label TEXT,
                impreso INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (packing_list_id) REFERENCES packing_list(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packaging_template_tipo ON packaging_template(tipo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packaging_template_estado ON packaging_template(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packing_list_numero ON packing_list(numero)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packing_list_estado ON packing_list(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packing_list_oc ON packing_list(orden_compra_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packing_item_packing ON packing_item(packing_list_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packing_item_material ON packing_item(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_shipping_label_packing ON shipping_label(packing_list_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 081: Packaging & Shipping Labels - Tablas packaging_template, packing_list, packing_item, shipping_label creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_shipping_label_packing")
    cursor.execute("DROP INDEX IF EXISTS idx_packing_item_material")
    cursor.execute("DROP INDEX IF EXISTS idx_packing_item_packing")
    cursor.execute("DROP INDEX IF EXISTS idx_packing_list_oc")
    cursor.execute("DROP INDEX IF EXISTS idx_packing_list_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_packing_list_numero")
    cursor.execute("DROP INDEX IF EXISTS idx_packaging_template_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_packaging_template_tipo")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS shipping_label")
    cursor.execute("DROP TABLE IF EXISTS packing_item")
    cursor.execute("DROP TABLE IF EXISTS packing_list")
    cursor.execute("DROP TABLE IF EXISTS packaging_template")

    conn.commit()
    conn.close()

    print("✅ Migración 081: Revertida exitosamente")


if __name__ == '__main__':
    up()
