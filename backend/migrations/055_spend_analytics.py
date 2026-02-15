"""
Migración 055: Tablas de Spend Analytics
Fecha: 2026-02-15
Descripción: Crea tablas para analítica de gasto por categoría, incluyendo snapshots
             periódicos y clasificación de gasto por contrato vs maverick.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de Spend Analytics"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS spend_categoria (
                id SERIAL PRIMARY KEY,
                nombre TEXT UNIQUE NOT NULL,
                descripcion TEXT,
                grupo_material TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS spend_snapshot (
                id SERIAL PRIMARY KEY,
                periodo TEXT NOT NULL,
                categoria_id INTEGER,
                gasto_total REAL DEFAULT 0,
                gasto_contrato REAL DEFAULT 0,
                gasto_maverick REAL DEFAULT 0,
                num_proveedores INTEGER DEFAULT 0,
                num_ordenes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (categoria_id) REFERENCES spend_categoria(id) ON DELETE SET NULL
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS spend_categoria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT UNIQUE NOT NULL,
                descripcion TEXT,
                grupo_material TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS spend_snapshot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                periodo TEXT NOT NULL,
                categoria_id INTEGER,
                gasto_total REAL DEFAULT 0,
                gasto_contrato REAL DEFAULT 0,
                gasto_maverick REAL DEFAULT 0,
                num_proveedores INTEGER DEFAULT 0,
                num_ordenes INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (categoria_id) REFERENCES spend_categoria(id) ON DELETE SET NULL
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_spend_snapshot_periodo
        ON spend_snapshot(periodo)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_spend_snapshot_categoria
        ON spend_snapshot(categoria_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_spend_categoria_grupo
        ON spend_categoria(grupo_material)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 055: Tablas de Spend Analytics creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_spend_snapshot_periodo")
    cursor.execute("DROP INDEX IF EXISTS idx_spend_snapshot_categoria")
    cursor.execute("DROP INDEX IF EXISTS idx_spend_categoria_grupo")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS spend_snapshot")
    cursor.execute("DROP TABLE IF EXISTS spend_categoria")

    conn.commit()
    conn.close()

    print("✅ Migración 055: Revertida exitosamente")


if __name__ == '__main__':
    up()
