#!/usr/bin/env python3
"""
Migración: Crear tabla de mensajes bidireccionales

Esta tabla soporta:
- Mensajes entre usuarios (solicitantes, planificadores, admins)
- Threads de conversación (replies mediante parent_id)
- Asociación con solicitudes
- Tracking de lectura
"""

import sqlite3
from pathlib import Path

# Ubicación de la BD
DB_PATH = Path("backend_v2/spm.db")

CREATE_MENSAJES_TABLE = """
CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remitente_id TEXT NOT NULL,
    destinatario_id TEXT NOT NULL,
    solicitud_id INTEGER,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    parent_id INTEGER,
    leido INTEGER DEFAULT 0,
    tipo TEXT DEFAULT 'mensaje',
    metadata_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(remitente_id) REFERENCES usuarios(id_spm),
    FOREIGN KEY(destinatario_id) REFERENCES usuarios(id_spm),
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id),
    FOREIGN KEY(parent_id) REFERENCES mensajes(id)
);
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_mensajes_remitente ON mensajes(remitente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario ON mensajes(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_solicitud ON mensajes(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_parent ON mensajes(parent_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_leido ON mensajes(leido);
CREATE INDEX IF NOT EXISTS idx_mensajes_created ON mensajes(created_at DESC);
"""


def run_migration():
    """Ejecutar migración"""
    print(f">> Conectando a {DB_PATH}...")

    if not DB_PATH.exists():
        print(f"ERROR: Base de datos no encontrada en {DB_PATH}")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print(">> Creando tabla mensajes...")
        cursor.execute(CREATE_MENSAJES_TABLE)

        print(">> Creando indices...")
        cursor.executescript(CREATE_INDEXES)

        conn.commit()

        # Verificar
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mensajes';")
        if cursor.fetchone():
            print("OK: Tabla mensajes creada exitosamente!")

            # Contar registros
            cursor.execute("SELECT COUNT(*) FROM mensajes")
            count = cursor.fetchone()[0]
            print(f">> Registros actuales: {count}")

            return True
        else:
            print("ERROR: Tabla no fue creada")
            return False

    except Exception as e:
        print(f"ERROR durante migracion: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
        print(">> Conexion cerrada")


def main():
    print("=" * 60)
    print("  MIGRACION: Crear tabla de mensajes bidireccionales")
    print("=" * 60)
    print()

    success = run_migration()

    print()
    if success:
        print("OK: Migracion completada con exito!")
    else:
        print("ERROR: Migracion fallo. Revisa los errores arriba.")
    print()


if __name__ == "__main__":
    main()
