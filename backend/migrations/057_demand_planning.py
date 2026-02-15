"""
Migración 057: Tablas de Demand Planning Colaborativo
Fecha: 2026-02-15
Descripción: Crea tablas para planificación de demanda colaborativa, permitiendo múltiples
             entradas por fuente y generación de consenso basado en ML y inputs manuales.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de Demand Planning"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_demanda (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                periodo_desde TEXT,
                periodo_hasta TEXT,
                estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'collecting', 'review', 'consensus', 'approved', 'closed')),
                creado_por INTEGER,
                aprobado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_demanda_entrada (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                usuario_id INTEGER,
                fuente TEXT CHECK(fuente IN ('ml_baseline', 'sales', 'operations', 'finance', 'manual')),
                cantidad_pronosticada REAL NOT NULL,
                confianza REAL,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES plan_demanda(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_demanda_consenso (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                cantidad_consenso REAL,
                cantidad_ml_baseline REAL,
                cantidad_promedio_entradas REAL,
                ajuste_manual REAL DEFAULT 0,
                aprobado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES plan_demanda(id) ON DELETE CASCADE
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_demanda (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                periodo_desde TEXT,
                periodo_hasta TEXT,
                estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'collecting', 'review', 'consensus', 'approved', 'closed')),
                creado_por INTEGER,
                aprobado_por INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_demanda_entrada (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                usuario_id INTEGER,
                fuente TEXT CHECK(fuente IN ('ml_baseline', 'sales', 'operations', 'finance', 'manual')),
                cantidad_pronosticada REAL NOT NULL,
                confianza REAL,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES plan_demanda(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_demanda_consenso (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                cantidad_consenso REAL,
                cantidad_ml_baseline REAL,
                cantidad_promedio_entradas REAL,
                ajuste_manual REAL DEFAULT 0,
                aprobado_por INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES plan_demanda(id) ON DELETE CASCADE
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_plan_demanda_estado
        ON plan_demanda(estado)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_plan_demanda_entrada_plan
        ON plan_demanda_entrada(plan_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_plan_demanda_entrada_material
        ON plan_demanda_entrada(material_codigo)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_plan_demanda_consenso_plan
        ON plan_demanda_consenso(plan_id)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 057: Tablas de Demand Planning creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_plan_demanda_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_demanda_entrada_plan")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_demanda_entrada_material")
    cursor.execute("DROP INDEX IF EXISTS idx_plan_demanda_consenso_plan")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS plan_demanda_consenso")
    cursor.execute("DROP TABLE IF EXISTS plan_demanda_entrada")
    cursor.execute("DROP TABLE IF EXISTS plan_demanda")

    conn.commit()
    conn.close()

    print("✅ Migración 057: Revertida exitosamente")


if __name__ == '__main__':
    up()
