"""
Migración 056: Tablas de Supplier Risk Management
Fecha: 2026-02-15
Descripción: Crea tablas para gestión de riesgo de proveedores, incluyendo múltiples
             dimensiones de riesgo y historial de cambios de score.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de Supplier Risk"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_riesgo (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                score_riesgo REAL DEFAULT 0,
                nivel TEXT DEFAULT 'low' CHECK(nivel IN ('low', 'medium', 'high', 'critical')),
                riesgo_financiero REAL DEFAULT 0,
                riesgo_entrega REAL DEFAULT 0,
                riesgo_calidad REAL DEFAULT 0,
                riesgo_dependencia REAL DEFAULT 0,
                riesgo_geografico REAL DEFAULT 0,
                es_fuente_unica INTEGER DEFAULT 0,
                materiales_exclusivos TEXT,
                pais TEXT,
                provincia TEXT,
                evaluado_por INTEGER,
                fecha_evaluacion TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_riesgo_historial (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                score_anterior REAL,
                score_nuevo REAL,
                nivel_anterior TEXT,
                nivel_nuevo TEXT,
                periodo TEXT,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_riesgo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                score_riesgo REAL DEFAULT 0,
                nivel TEXT DEFAULT 'low' CHECK(nivel IN ('low', 'medium', 'high', 'critical')),
                riesgo_financiero REAL DEFAULT 0,
                riesgo_entrega REAL DEFAULT 0,
                riesgo_calidad REAL DEFAULT 0,
                riesgo_dependencia REAL DEFAULT 0,
                riesgo_geografico REAL DEFAULT 0,
                es_fuente_unica INTEGER DEFAULT 0,
                materiales_exclusivos TEXT,
                pais TEXT,
                provincia TEXT,
                evaluado_por INTEGER,
                fecha_evaluacion TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_riesgo_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                score_anterior REAL,
                score_nuevo REAL,
                nivel_anterior TEXT,
                nivel_nuevo TEXT,
                periodo TEXT,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_proveedor_riesgo_cuit
        ON proveedor_riesgo(proveedor_cuit)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_proveedor_riesgo_nivel
        ON proveedor_riesgo(nivel)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_proveedor_riesgo_hist_cuit
        ON proveedor_riesgo_historial(proveedor_cuit)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 056: Tablas de Supplier Risk creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_proveedor_riesgo_cuit")
    cursor.execute("DROP INDEX IF EXISTS idx_proveedor_riesgo_nivel")
    cursor.execute("DROP INDEX IF EXISTS idx_proveedor_riesgo_hist_cuit")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS proveedor_riesgo_historial")
    cursor.execute("DROP TABLE IF EXISTS proveedor_riesgo")

    conn.commit()
    conn.close()

    print("✅ Migración 056: Revertida exitosamente")


if __name__ == '__main__':
    up()
