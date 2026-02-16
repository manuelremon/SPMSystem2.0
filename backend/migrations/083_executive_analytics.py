"""
Migración 083: Executive Procurement Analytics
Fecha: 2026-02-15
Descripción: Dashboard ejecutivo, KPIs configurables, benchmarking y scorecards
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS executive_kpi (
                    id SERIAL PRIMARY KEY,
                    categoria TEXT CHECK(categoria IN ('procurement','sourcing','quality','logistics','finance','sustainability')),
                    kpi_key TEXT UNIQUE NOT NULL,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    unidad TEXT,
                    formula TEXT,
                    target_value REAL,
                    warning_threshold REAL,
                    critical_threshold REAL,
                    activo INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS executive_snapshot (
                    id SERIAL PRIMARY KEY,
                    kpi_key TEXT NOT NULL,
                    periodo TEXT NOT NULL,
                    valor REAL,
                    variacion_pct REAL,
                    trend TEXT DEFAULT 'stable' CHECK(trend IN ('up','down','stable')),
                    detalles TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(kpi_key, periodo)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS benchmark (
                    id SERIAL PRIMARY KEY,
                    kpi_key TEXT NOT NULL,
                    industria TEXT,
                    region TEXT,
                    percentil_25 REAL,
                    mediana REAL,
                    percentil_75 REAL,
                    fuente TEXT,
                    periodo_dato TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS procurement_scorecard (
                    id SERIAL PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    periodo TEXT,
                    categorias_evaluadas TEXT,
                    score_total REAL,
                    fortalezas TEXT,
                    debilidades TEXT,
                    recomendaciones TEXT,
                    generado_por INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        else:
            # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS executive_kpi (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    categoria TEXT CHECK(categoria IN ('procurement','sourcing','quality','logistics','finance','sustainability')),
                    kpi_key TEXT UNIQUE NOT NULL,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    unidad TEXT,
                    formula TEXT,
                    target_value REAL,
                    warning_threshold REAL,
                    critical_threshold REAL,
                    activo INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS executive_snapshot (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kpi_key TEXT NOT NULL,
                    periodo TEXT NOT NULL,
                    valor REAL,
                    variacion_pct REAL,
                    trend TEXT DEFAULT 'stable' CHECK(trend IN ('up','down','stable')),
                    detalles TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(kpi_key, periodo)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS benchmark (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kpi_key TEXT NOT NULL,
                    industria TEXT,
                    region TEXT,
                    percentil_25 REAL,
                    mediana REAL,
                    percentil_75 REAL,
                    fuente TEXT,
                    periodo_dato TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS procurement_scorecard (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL,
                    periodo TEXT,
                    categorias_evaluadas TEXT,
                    score_total REAL,
                    fortalezas TEXT,
                    debilidades TEXT,
                    recomendaciones TEXT,
                    generado_por INTEGER,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

        # Crear índices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_kpi_categoria ON executive_kpi(categoria)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_kpi_key ON executive_kpi(kpi_key)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_snapshot_kpi ON executive_snapshot(kpi_key)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_snapshot_periodo ON executive_snapshot(periodo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_benchmark_kpi ON benchmark(kpi_key)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scorecard_periodo ON procurement_scorecard(periodo)")

        conn.commit()

    print("✅ Migración 083: Executive Analytics - Tablas executive_kpi, executive_snapshot, benchmark, procurement_scorecard creadas")


def down():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar índices primero
        cursor.execute("DROP INDEX IF EXISTS idx_scorecard_periodo")
        cursor.execute("DROP INDEX IF EXISTS idx_benchmark_kpi")
        cursor.execute("DROP INDEX IF EXISTS idx_exec_snapshot_periodo")
        cursor.execute("DROP INDEX IF EXISTS idx_exec_snapshot_kpi")
        cursor.execute("DROP INDEX IF EXISTS idx_exec_kpi_key")
        cursor.execute("DROP INDEX IF EXISTS idx_exec_kpi_categoria")

        # Eliminar tablas
        cursor.execute("DROP TABLE IF EXISTS procurement_scorecard")
        cursor.execute("DROP TABLE IF EXISTS benchmark")
        cursor.execute("DROP TABLE IF EXISTS executive_snapshot")
        cursor.execute("DROP TABLE IF EXISTS executive_kpi")

        conn.commit()

    print("✅ Migración 083: Revertida exitosamente")


if __name__ == '__main__':
    up()
