"""
Migración 052: Tablas de Inspección de Calidad y NCR
Fecha: 2026-02-15
Descripción: Crea tablas para inspecciones de entrada, items inspeccionados,
             NCR (Non-Conformance Reports) e historial de NCR.
"""

from backend.core.db import get_db_connection, is_using_postgresql


def up():
    """Crear tablas de inspección de calidad y NCR"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inspeccion_entrada (
                id SERIAL PRIMARY KEY,
                recepcion_id INTEGER,
                numero_inspeccion TEXT UNIQUE NOT NULL,
                tipo TEXT CHECK(tipo IN ('sample', 'full')),
                inspector_id INTEGER,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resultado TEXT CHECK(resultado IN ('pass', 'fail', 'partial')),
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inspeccion_item (
                id SERIAL PRIMARY KEY,
                inspeccion_id INTEGER NOT NULL,
                recepcion_item_id INTEGER,
                cantidad_inspeccionada REAL,
                cantidad_aprobada REAL DEFAULT 0,
                cantidad_rechazada REAL DEFAULT 0,
                resultado TEXT CHECK(resultado IN ('pass', 'fail', 'partial')),
                defectos TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspeccion_id) REFERENCES inspeccion_entrada(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ncr (
                id SERIAL PRIMARY KEY,
                numero_ncr TEXT UNIQUE NOT NULL,
                inspeccion_id INTEGER,
                proveedor_cuit TEXT,
                material_codigo TEXT,
                cantidad_afectada REAL,
                descripcion TEXT,
                severidad TEXT CHECK(severidad IN ('critical', 'major', 'minor')),
                estado TEXT DEFAULT 'open' CHECK(estado IN ('open', 'under_investigation', 'resolved', 'closed')),
                reportado_por INTEGER,
                asignado_a INTEGER,
                fecha_resolucion TIMESTAMP,
                accion_correctiva TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspeccion_id) REFERENCES inspeccion_entrada(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ncr_historial (
                id SERIAL PRIMARY KEY,
                ncr_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE CASCADE
            )
        """)

    else:
        # SQLite
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inspeccion_entrada (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recepcion_id INTEGER,
                numero_inspeccion TEXT UNIQUE NOT NULL,
                tipo TEXT CHECK(tipo IN ('sample', 'full')),
                inspector_id INTEGER,
                fecha TEXT DEFAULT CURRENT_TIMESTAMP,
                resultado TEXT CHECK(resultado IN ('pass', 'fail', 'partial')),
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inspeccion_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspeccion_id INTEGER NOT NULL,
                recepcion_item_id INTEGER,
                cantidad_inspeccionada REAL,
                cantidad_aprobada REAL DEFAULT 0,
                cantidad_rechazada REAL DEFAULT 0,
                resultado TEXT CHECK(resultado IN ('pass', 'fail', 'partial')),
                defectos TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspeccion_id) REFERENCES inspeccion_entrada(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ncr (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_ncr TEXT UNIQUE NOT NULL,
                inspeccion_id INTEGER,
                proveedor_cuit TEXT,
                material_codigo TEXT,
                cantidad_afectada REAL,
                descripcion TEXT,
                severidad TEXT CHECK(severidad IN ('critical', 'major', 'minor')),
                estado TEXT DEFAULT 'open' CHECK(estado IN ('open', 'under_investigation', 'resolved', 'closed')),
                reportado_por INTEGER,
                asignado_a INTEGER,
                fecha_resolucion TEXT,
                accion_correctiva TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (inspeccion_id) REFERENCES inspeccion_entrada(id) ON DELETE SET NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ncr_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ncr_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE CASCADE
            )
        """)

    # Crear índices
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_inspeccion_recepcion
        ON inspeccion_entrada(recepcion_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_inspeccion_resultado
        ON inspeccion_entrada(resultado)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_ncr_estado
        ON ncr(estado)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_ncr_severidad
        ON ncr(severidad)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_ncr_proveedor
        ON ncr(proveedor_cuit)
    """)

    conn.commit()
    conn.close()

    print("✅ Migración 052: Tablas de inspección de calidad y NCR creadas exitosamente")


def down():
    """Revertir migración"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices
    cursor.execute("DROP INDEX IF EXISTS idx_inspeccion_recepcion")
    cursor.execute("DROP INDEX IF EXISTS idx_inspeccion_resultado")
    cursor.execute("DROP INDEX IF EXISTS idx_ncr_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_ncr_severidad")
    cursor.execute("DROP INDEX IF EXISTS idx_ncr_proveedor")

    # Eliminar tablas en orden inverso por FKs
    cursor.execute("DROP TABLE IF EXISTS ncr_historial")
    cursor.execute("DROP TABLE IF EXISTS ncr")
    cursor.execute("DROP TABLE IF EXISTS inspeccion_item")
    cursor.execute("DROP TABLE IF EXISTS inspeccion_entrada")

    conn.commit()
    conn.close()

    print("✅ Migración 052: Revertida exitosamente")


if __name__ == '__main__':
    up()
