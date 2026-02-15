"""
Migración 049: Documentos de contratos
Fecha: 2026-02-15
Sprints: 54-56

Crea la tabla de documentos adjuntos a contratos (términos, specs, enmiendas, etc.).
"""

from backend.core.db import get_db_transaction, is_using_postgresql


def up():
    """Crear tabla de documentos de contratos"""
    with get_db_transaction() as (conn, cursor):
        is_pg = is_using_postgresql()

        # Tabla: contrato_documento
        if is_pg:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato_documento (
                    id SERIAL PRIMARY KEY,
                    contrato_id INTEGER NOT NULL,
                    tipo TEXT NOT NULL CHECK(tipo IN ('terms', 'specs', 'amendment', 'other')),
                    nombre_archivo TEXT NOT NULL,
                    ruta_archivo TEXT NOT NULL,
                    tamanio_bytes INTEGER,
                    mime_type TEXT,
                    subido_por INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato_documento (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contrato_id INTEGER NOT NULL,
                    tipo TEXT NOT NULL CHECK(tipo IN ('terms', 'specs', 'amendment', 'other')),
                    nombre_archivo TEXT NOT NULL,
                    ruta_archivo TEXT NOT NULL,
                    tamanio_bytes INTEGER,
                    mime_type TEXT,
                    subido_por INTEGER NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
                )
            """)

        # Índices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_doc_contrato ON contrato_documento(contrato_id)")

        conn.commit()
        print("✓ Migración 049: Tabla de documentos de contratos creada")


def down():
    """Revertir tabla de documentos de contratos"""
    with get_db_transaction() as (conn, cursor):
        cursor.execute("DROP TABLE IF EXISTS contrato_documento")
        conn.commit()
        print("✓ Migración 049: Tabla de documentos de contratos eliminada")


if __name__ == "__main__":
    up()
