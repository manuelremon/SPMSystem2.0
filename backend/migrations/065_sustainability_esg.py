"""
Migración 065: Sustainability & ESG Tracking
Fecha: 2026-02-15
Descripción: Implementa tracking de emisiones de carbono, scores ESG de proveedores y metas de sostenibilidad
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emision_carbono (
                id SERIAL PRIMARY KEY,
                origen_tipo TEXT CHECK (origen_tipo IN ('material', 'envio', 'proveedor', 'orden_compra')),
                origen_id INTEGER,
                scope TEXT CHECK (scope IN ('scope_1', 'scope_2', 'scope_3')),
                categoria TEXT CHECK (categoria IN ('transporte', 'fabricacion', 'energia', 'residuos')),
                cantidad REAL,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                envio_id INTEGER,
                periodo TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_esg_score (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                periodo TEXT NOT NULL,
                environmental_score REAL DEFAULT 0,
                social_score REAL DEFAULT 0,
                governance_score REAL DEFAULT 0,
                overall_score REAL DEFAULT 0,
                certificaciones_activas INTEGER DEFAULT 0,
                incidentes_ambientales INTEGER DEFAULT 0,
                incidentes_sociales INTEGER DEFAULT 0,
                evaluado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(proveedor_cuit, periodo)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meta_sostenibilidad (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('reduccion_emisiones', 'energia_renovable', 'residuo_cero', 'packaging_sostenible')),
                valor_meta REAL,
                unidad TEXT,
                fecha_inicio TIMESTAMP,
                fecha_objetivo TIMESTAMP,
                responsable_id INTEGER,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'achieved', 'cancelled')),
                progreso_actual REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS material_huella_carbono (
                id SERIAL PRIMARY KEY,
                material_codigo TEXT UNIQUE NOT NULL,
                huella_base REAL,
                unidad_base TEXT,
                fuente_dato TEXT,
                fecha_actualizacion TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emision_carbono (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                origen_tipo TEXT CHECK (origen_tipo IN ('material', 'envio', 'proveedor', 'orden_compra')),
                origen_id INTEGER,
                scope TEXT CHECK (scope IN ('scope_1', 'scope_2', 'scope_3')),
                categoria TEXT CHECK (categoria IN ('transporte', 'fabricacion', 'energia', 'residuos')),
                cantidad REAL,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                envio_id INTEGER,
                periodo TEXT,
                metadata TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proveedor_esg_score (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                periodo TEXT NOT NULL,
                environmental_score REAL DEFAULT 0,
                social_score REAL DEFAULT 0,
                governance_score REAL DEFAULT 0,
                overall_score REAL DEFAULT 0,
                certificaciones_activas INTEGER DEFAULT 0,
                incidentes_ambientales INTEGER DEFAULT 0,
                incidentes_sociales INTEGER DEFAULT 0,
                evaluado_por INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(proveedor_cuit, periodo)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meta_sostenibilidad (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK (tipo IN ('reduccion_emisiones', 'energia_renovable', 'residuo_cero', 'packaging_sostenible')),
                valor_meta REAL,
                unidad TEXT,
                fecha_inicio TEXT,
                fecha_objetivo TEXT,
                responsable_id INTEGER,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'achieved', 'cancelled')),
                progreso_actual REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS material_huella_carbono (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                material_codigo TEXT UNIQUE NOT NULL,
                huella_base REAL,
                unidad_base TEXT,
                fuente_dato TEXT,
                fecha_actualizacion TEXT
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_emision_origen ON emision_carbono(origen_tipo, origen_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_emision_scope ON emision_carbono(scope)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_emision_periodo ON emision_carbono(periodo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_esg_proveedor ON proveedor_esg_score(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_meta_estado ON meta_sostenibilidad(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_material_huella ON material_huella_carbono(material_codigo)")

    conn.commit()
    conn.close()

    print("✅ Migración 065: Sustainability & ESG - Tablas emision_carbono, proveedor_esg_score, meta_sostenibilidad, material_huella_carbono creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_material_huella")
    cursor.execute("DROP INDEX IF EXISTS idx_meta_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_esg_proveedor")
    cursor.execute("DROP INDEX IF EXISTS idx_emision_periodo")
    cursor.execute("DROP INDEX IF EXISTS idx_emision_scope")
    cursor.execute("DROP INDEX IF EXISTS idx_emision_origen")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS material_huella_carbono")
    cursor.execute("DROP TABLE IF EXISTS meta_sostenibilidad")
    cursor.execute("DROP TABLE IF EXISTS proveedor_esg_score")
    cursor.execute("DROP TABLE IF EXISTS emision_carbono")

    conn.commit()
    conn.close()

    print("✅ Migración 065: Revertida exitosamente")


if __name__ == '__main__':
    up()
