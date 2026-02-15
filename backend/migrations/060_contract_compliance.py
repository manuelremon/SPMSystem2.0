"""
Migración 060: Contract Compliance & Rebate Programs
Fecha: 2026-02-15
Descripción: Implementa tracking de compliance contractual y programas de rebates/descuentos por volumen
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS compliance_check (
                id SERIAL PRIMARY KEY,
                contrato_id INTEGER,
                orden_compra_id INTEGER,
                material_codigo TEXT,
                precio_contrato REAL,
                precio_real REAL,
                cantidad REAL,
                es_compliant INTEGER DEFAULT 1,
                desviacion_porcentaje REAL DEFAULT 0,
                razon_desviacion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rebate_programa (
                id SERIAL PRIMARY KEY,
                contrato_id INTEGER,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('volume', 'growth', 'flat')),
                umbral_cantidad REAL DEFAULT 0,
                umbral_monto REAL DEFAULT 0,
                porcentaje_rebate REAL DEFAULT 0,
                monto_fijo REAL DEFAULT 0,
                periodo_inicio TIMESTAMP,
                periodo_fin TIMESTAMP,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'paused', 'expired')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rebate_calculo (
                id SERIAL PRIMARY KEY,
                programa_id INTEGER REFERENCES rebate_programa(id) ON DELETE CASCADE,
                periodo TEXT,
                monto_base REAL DEFAULT 0,
                cantidad_comprada REAL DEFAULT 0,
                monto_rebate REAL DEFAULT 0,
                estado TEXT DEFAULT 'calculated' CHECK (estado IN ('calculated', 'claimed', 'approved', 'paid')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS compliance_check (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contrato_id INTEGER,
                orden_compra_id INTEGER,
                material_codigo TEXT,
                precio_contrato REAL,
                precio_real REAL,
                cantidad REAL,
                es_compliant INTEGER DEFAULT 1,
                desviacion_porcentaje REAL DEFAULT 0,
                razon_desviacion TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rebate_programa (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contrato_id INTEGER,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('volume', 'growth', 'flat')),
                umbral_cantidad REAL DEFAULT 0,
                umbral_monto REAL DEFAULT 0,
                porcentaje_rebate REAL DEFAULT 0,
                monto_fijo REAL DEFAULT 0,
                periodo_inicio TEXT,
                periodo_fin TEXT,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'paused', 'expired')),
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rebate_calculo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                programa_id INTEGER,
                periodo TEXT,
                monto_base REAL DEFAULT 0,
                cantidad_comprada REAL DEFAULT 0,
                monto_rebate REAL DEFAULT 0,
                estado TEXT DEFAULT 'calculated' CHECK (estado IN ('calculated', 'claimed', 'approved', 'paid')),
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (programa_id) REFERENCES rebate_programa(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_compliance_check_contrato ON compliance_check(contrato_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_compliance_check_oc ON compliance_check(orden_compra_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rebate_programa_contrato ON rebate_programa(contrato_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rebate_programa_estado ON rebate_programa(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rebate_calculo_programa ON rebate_calculo(programa_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 060: Contract Compliance - Tablas compliance_check, rebate_programa, rebate_calculo creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_rebate_calculo_programa")
    cursor.execute("DROP INDEX IF EXISTS idx_rebate_programa_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_rebate_programa_contrato")
    cursor.execute("DROP INDEX IF EXISTS idx_compliance_check_oc")
    cursor.execute("DROP INDEX IF EXISTS idx_compliance_check_contrato")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS rebate_calculo")
    cursor.execute("DROP TABLE IF EXISTS rebate_programa")
    cursor.execute("DROP TABLE IF EXISTS compliance_check")

    conn.commit()
    conn.close()

    print("✅ Migración 060: Revertida exitosamente")


if __name__ == '__main__':
    up()
