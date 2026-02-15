"""
Migración 069: Multi-Currency Support
Fecha: 2026-02-15
Descripción: Soporte para múltiples monedas con tipos de cambio históricos y registro de conversiones
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tipo_cambio (
                id SERIAL PRIMARY KEY,
                moneda_origen TEXT NOT NULL,
                moneda_destino TEXT NOT NULL,
                tasa REAL NOT NULL,
                fecha DATE,
                fuente TEXT DEFAULT 'manual' CHECK (fuente IN ('manual', 'api', 'banco_central')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(moneda_origen, moneda_destino, fecha)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversion_log (
                id SERIAL PRIMARY KEY,
                entidad_tipo TEXT CHECK (entidad_tipo IN ('orden_compra', 'factura', 'contrato')),
                entidad_id INTEGER,
                moneda_original TEXT,
                moneda_destino TEXT,
                monto_original REAL,
                monto_convertido REAL,
                tasa_aplicada REAL,
                fecha_conversion TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tipo_cambio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                moneda_origen TEXT NOT NULL,
                moneda_destino TEXT NOT NULL,
                tasa REAL NOT NULL,
                fecha TEXT,
                fuente TEXT DEFAULT 'manual' CHECK (fuente IN ('manual', 'api', 'banco_central')),
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(moneda_origen, moneda_destino, fecha)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversion_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entidad_tipo TEXT CHECK (entidad_tipo IN ('orden_compra', 'factura', 'contrato')),
                entidad_id INTEGER,
                moneda_original TEXT,
                moneda_destino TEXT,
                monto_original REAL,
                monto_convertido REAL,
                tasa_aplicada REAL,
                fecha_conversion TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tipo_cambio_par ON tipo_cambio(moneda_origen, moneda_destino)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tipo_cambio_fecha ON tipo_cambio(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversion_log_entidad ON conversion_log(entidad_tipo, entidad_id)")

    # Agregar columnas a tablas existentes
    # Intentar agregar columnas con try/except para evitar errores si ya existen
    try:
        cursor.execute("ALTER TABLE orden_compra ADD COLUMN moneda TEXT DEFAULT 'ARS'")
    except Exception:
        pass  # Columna ya existe

    try:
        cursor.execute("ALTER TABLE factura_proveedor ADD COLUMN moneda_original TEXT")
    except Exception:
        pass  # Columna ya existe

    try:
        cursor.execute("ALTER TABLE contrato ADD COLUMN moneda TEXT DEFAULT 'ARS'")
    except Exception:
        pass  # Columna ya existe

    conn.commit()
    conn.close()

    print("✅ Migración 069: Multi-Currency - Tablas tipo_cambio, conversion_log creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_conversion_log_entidad")
    cursor.execute("DROP INDEX IF EXISTS idx_tipo_cambio_fecha")
    cursor.execute("DROP INDEX IF EXISTS idx_tipo_cambio_par")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS conversion_log")
    cursor.execute("DROP TABLE IF EXISTS tipo_cambio")

    # Nota: No eliminamos las columnas agregadas a tablas existentes
    # para evitar pérdida de datos. Las columnas quedarán huérfanas.

    conn.commit()
    conn.close()

    print("✅ Migración 069: Revertida exitosamente")


if __name__ == '__main__':
    up()
