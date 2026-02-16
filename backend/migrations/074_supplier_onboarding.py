"""
Migración 074: Supplier Onboarding & Development
Fecha: 2026-02-15
Descripción: Tablas para onboarding estructurado de proveedores, documentación y evaluación
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS supplier_onboarding (
                id SERIAL PRIMARY KEY,
                razon_social TEXT NOT NULL,
                cuit TEXT UNIQUE NOT NULL,
                rubro TEXT,
                contacto_nombre TEXT,
                contacto_email TEXT,
                contacto_telefono TEXT,
                direccion TEXT,
                ciudad TEXT,
                provincia TEXT,
                pais TEXT DEFAULT 'Argentina',
                sitio_web TEXT,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'under_review', 'approved', 'active', 'suspended', 'rejected')),
                score_calificacion REAL,
                evaluado_por INTEGER,
                notas_rechazo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_documento (
                id SERIAL PRIMARY KEY,
                onboarding_id INTEGER REFERENCES supplier_onboarding(id) ON DELETE CASCADE,
                tipo_documento TEXT CHECK (tipo_documento IN ('inscripcion_afip', 'constancia_cuit', 'seguro', 'iso_cert', 'balance', 'ref_comercial', 'otro')),
                nombre_archivo TEXT,
                path TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'approved', 'rejected', 'expired')),
                fecha_vencimiento DATE,
                revisado_por INTEGER,
                notas_revision TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_evaluacion (
                id SERIAL PRIMARY KEY,
                onboarding_id INTEGER REFERENCES supplier_onboarding(id) ON DELETE CASCADE,
                criterio TEXT CHECK (criterio IN ('capacidad_tecnica', 'solidez_financiera', 'experiencia', 'calidad', 'precio', 'plazo_entrega')),
                puntaje REAL CHECK (puntaje >= 0 AND puntaje <= 100),
                peso REAL,
                evaluador_id INTEGER,
                comentarios TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_historial (
                id SERIAL PRIMARY KEY,
                onboarding_id INTEGER REFERENCES supplier_onboarding(id) ON DELETE CASCADE,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS supplier_onboarding (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                razon_social TEXT NOT NULL,
                cuit TEXT UNIQUE NOT NULL,
                rubro TEXT,
                contacto_nombre TEXT,
                contacto_email TEXT,
                contacto_telefono TEXT,
                direccion TEXT,
                ciudad TEXT,
                provincia TEXT,
                pais TEXT DEFAULT 'Argentina',
                sitio_web TEXT,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'submitted', 'under_review', 'approved', 'active', 'suspended', 'rejected')),
                score_calificacion REAL,
                evaluado_por INTEGER,
                notas_rechazo TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_documento (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                onboarding_id INTEGER,
                tipo_documento TEXT CHECK (tipo_documento IN ('inscripcion_afip', 'constancia_cuit', 'seguro', 'iso_cert', 'balance', 'ref_comercial', 'otro')),
                nombre_archivo TEXT,
                path TEXT,
                estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending', 'approved', 'rejected', 'expired')),
                fecha_vencimiento TEXT,
                revisado_por INTEGER,
                notas_revision TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (onboarding_id) REFERENCES supplier_onboarding(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_evaluacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                onboarding_id INTEGER,
                criterio TEXT CHECK (criterio IN ('capacidad_tecnica', 'solidez_financiera', 'experiencia', 'calidad', 'precio', 'plazo_entrega')),
                puntaje REAL CHECK (puntaje >= 0 AND puntaje <= 100),
                peso REAL,
                evaluador_id INTEGER,
                comentarios TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (onboarding_id) REFERENCES supplier_onboarding(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS onboarding_historial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                onboarding_id INTEGER,
                estado_anterior TEXT,
                estado_nuevo TEXT,
                actor_id INTEGER,
                notas TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (onboarding_id) REFERENCES supplier_onboarding(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_onboarding_estado ON supplier_onboarding(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_onboarding_rubro ON supplier_onboarding(rubro)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_onboarding_doc_onb ON onboarding_documento(onboarding_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_onboarding_doc_estado ON onboarding_documento(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_onboarding_eval_onb ON onboarding_evaluacion(onboarding_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_onboarding_hist_onb ON onboarding_historial(onboarding_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 074: Supplier Onboarding - Tablas supplier_onboarding, onboarding_documento, onboarding_evaluacion, onboarding_historial creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_onboarding_hist_onb")
    cursor.execute("DROP INDEX IF EXISTS idx_onboarding_eval_onb")
    cursor.execute("DROP INDEX IF EXISTS idx_onboarding_doc_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_onboarding_doc_onb")
    cursor.execute("DROP INDEX IF EXISTS idx_onboarding_rubro")
    cursor.execute("DROP INDEX IF EXISTS idx_onboarding_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS onboarding_historial")
    cursor.execute("DROP TABLE IF EXISTS onboarding_evaluacion")
    cursor.execute("DROP TABLE IF EXISTS onboarding_documento")
    cursor.execute("DROP TABLE IF EXISTS supplier_onboarding")

    conn.commit()
    conn.close()

    print("✅ Migración 074: Revertida exitosamente")


if __name__ == '__main__':
    up()
