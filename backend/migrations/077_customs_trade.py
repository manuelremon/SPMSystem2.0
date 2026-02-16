"""
Migración 077: Customs & Trade Compliance
Fecha: 2026-02-15
Descripción: Aduanas, clasificación arancelaria, operaciones de importación/exportación y acuerdos comerciales
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hs_code (
                id SERIAL PRIMARY KEY,
                codigo TEXT UNIQUE NOT NULL,
                descripcion TEXT,
                arancel_pct REAL DEFAULT 0,
                unidad_medida TEXT,
                capitulo TEXT,
                partida TEXT,
                subpartida TEXT,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS material_clasificacion_aduanera (
                id SERIAL PRIMARY KEY,
                material_codigo TEXT NOT NULL,
                hs_code_id INTEGER REFERENCES hs_code(id) ON DELETE CASCADE,
                pais_origen TEXT DEFAULT 'AR',
                pais_destino TEXT,
                certificado_origen TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(material_codigo, pais_origen, pais_destino)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operacion_aduanera (
                id SERIAL PRIMARY KEY,
                tipo TEXT CHECK(tipo IN ('importacion','exportacion')) NOT NULL,
                numero_despacho TEXT UNIQUE,
                proveedor_cuit TEXT,
                fecha_operacion DATE NOT NULL,
                estado TEXT DEFAULT 'en_proceso' CHECK(estado IN ('en_proceso','despachado','liberado','observado')),
                valor_fob REAL DEFAULT 0,
                flete REAL DEFAULT 0,
                seguro REAL DEFAULT 0,
                valor_cif REAL DEFAULT 0,
                aranceles REAL DEFAULT 0,
                impuestos_adicionales REAL DEFAULT 0,
                total_tributos REAL DEFAULT 0,
                moneda TEXT DEFAULT 'USD',
                orden_compra_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS acuerdo_comercial (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK(tipo IN ('mercosur','bilateral','gsp','otro')) NOT NULL,
                pais_socio TEXT,
                preferencia_arancelaria_pct REAL DEFAULT 0,
                fecha_vigencia_desde DATE,
                fecha_vigencia_hasta DATE,
                estado TEXT DEFAULT 'active' CHECK(estado IN ('active','expired')),
                requisitos_origen TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS hs_code (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                descripcion TEXT,
                arancel_pct REAL DEFAULT 0,
                unidad_medida TEXT,
                capitulo TEXT,
                partida TEXT,
                subpartida TEXT,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS material_clasificacion_aduanera (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                material_codigo TEXT NOT NULL,
                hs_code_id INTEGER,
                pais_origen TEXT DEFAULT 'AR',
                pais_destino TEXT,
                certificado_origen TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(material_codigo, pais_origen, pais_destino),
                FOREIGN KEY (hs_code_id) REFERENCES hs_code(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operacion_aduanera (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT CHECK(tipo IN ('importacion','exportacion')) NOT NULL,
                numero_despacho TEXT UNIQUE,
                proveedor_cuit TEXT,
                fecha_operacion TEXT NOT NULL,
                estado TEXT DEFAULT 'en_proceso' CHECK(estado IN ('en_proceso','despachado','liberado','observado')),
                valor_fob REAL DEFAULT 0,
                flete REAL DEFAULT 0,
                seguro REAL DEFAULT 0,
                valor_cif REAL DEFAULT 0,
                aranceles REAL DEFAULT 0,
                impuestos_adicionales REAL DEFAULT 0,
                total_tributos REAL DEFAULT 0,
                moneda TEXT DEFAULT 'USD',
                orden_compra_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS acuerdo_comercial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT CHECK(tipo IN ('mercosur','bilateral','gsp','otro')) NOT NULL,
                pais_socio TEXT,
                preferencia_arancelaria_pct REAL DEFAULT 0,
                fecha_vigencia_desde TEXT,
                fecha_vigencia_hasta TEXT,
                estado TEXT DEFAULT 'active' CHECK(estado IN ('active','expired')),
                requisitos_origen TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hs_code_codigo ON hs_code(codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hs_code_capitulo ON hs_code(capitulo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_material_clasificacion_material ON material_clasificacion_aduanera(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_material_clasificacion_hs ON material_clasificacion_aduanera(hs_code_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operacion_tipo ON operacion_aduanera(tipo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operacion_estado ON operacion_aduanera(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_operacion_fecha ON operacion_aduanera(fecha_operacion)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_acuerdo_estado ON acuerdo_comercial(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_acuerdo_pais ON acuerdo_comercial(pais_socio)")

    conn.commit()
    conn.close()

    print("✅ Migración 077: Customs & Trade Compliance - Tablas hs_code, material_clasificacion_aduanera, operacion_aduanera, acuerdo_comercial creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_acuerdo_pais")
    cursor.execute("DROP INDEX IF EXISTS idx_acuerdo_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_operacion_fecha")
    cursor.execute("DROP INDEX IF EXISTS idx_operacion_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_operacion_tipo")
    cursor.execute("DROP INDEX IF EXISTS idx_material_clasificacion_hs")
    cursor.execute("DROP INDEX IF EXISTS idx_material_clasificacion_material")
    cursor.execute("DROP INDEX IF EXISTS idx_hs_code_capitulo")
    cursor.execute("DROP INDEX IF EXISTS idx_hs_code_codigo")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS acuerdo_comercial")
    cursor.execute("DROP TABLE IF EXISTS operacion_aduanera")
    cursor.execute("DROP TABLE IF EXISTS material_clasificacion_aduanera")
    cursor.execute("DROP TABLE IF EXISTS hs_code")

    conn.commit()
    conn.close()

    print("✅ Migración 077: Revertida exitosamente")


if __name__ == '__main__':
    up()
