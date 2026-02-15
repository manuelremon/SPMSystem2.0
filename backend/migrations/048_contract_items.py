"""
Migración 048: Items de contratos
Fecha: 2026-02-15
Sprints: 54-56

Crea la tabla de items/líneas de contratos y vincula ordenes de compra a contratos.
"""

from backend.core.db import get_db_transaction, is_using_postgresql


def up():
    """Crear tabla de items de contrato y vincular OCs"""
    with get_db_transaction() as (conn, cursor):
        is_pg = is_using_postgresql()

        # Tabla: contrato_item
        if is_pg:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato_item (
                    id SERIAL PRIMARY KEY,
                    contrato_id INTEGER NOT NULL,
                    material_codigo TEXT NOT NULL,
                    material_descripcion TEXT,
                    precio_unitario REAL NOT NULL,
                    moneda TEXT DEFAULT 'ARS',
                    cantidad_comprometida REAL,
                    cantidad_consumida REAL DEFAULT 0,
                    unidad TEXT DEFAULT 'UN',
                    fecha_vigencia_desde TIMESTAMP,
                    fecha_vigencia_hasta TIMESTAMP,
                    activo INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato_item (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contrato_id INTEGER NOT NULL,
                    material_codigo TEXT NOT NULL,
                    material_descripcion TEXT,
                    precio_unitario REAL NOT NULL,
                    moneda TEXT DEFAULT 'ARS',
                    cantidad_comprometida REAL,
                    cantidad_consumida REAL DEFAULT 0,
                    unidad TEXT DEFAULT 'UN',
                    fecha_vigencia_desde TEXT,
                    fecha_vigencia_hasta TEXT,
                    activo INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
                )
            """)

        # Índices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_item_contrato ON contrato_item(contrato_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_item_material ON contrato_item(material_codigo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_item_activo ON contrato_item(activo)")

        # ALTER TABLE orden_compra ADD COLUMN contrato_id (idempotente)
        try:
            cursor.execute("ALTER TABLE orden_compra ADD COLUMN contrato_id INTEGER")
            conn.commit()
            print("✓ Columna contrato_id agregada a orden_compra")
        except Exception as e:
            # Columna ya existe o tabla no existe
            conn.rollback()
            print(f"  Columna contrato_id en orden_compra: {str(e)}")

        conn.commit()
        print("✓ Migración 048: Tabla de items de contrato creada")


def down():
    """Revertir tabla de items de contrato"""
    with get_db_transaction() as (conn, cursor):
        # No intentamos eliminar columna de orden_compra (no todos los DBMS lo soportan fácilmente)
        cursor.execute("DROP TABLE IF EXISTS contrato_item")
        conn.commit()
        print("✓ Migración 048: Tabla de items de contrato eliminada")


if __name__ == "__main__":
    up()
