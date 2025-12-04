#!/usr/bin/env python3
"""
Script temporal para crear la tabla notificaciones
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("backend_v2/spm.db")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinatario_id TEXT NOT NULL,
    solicitud_id INTEGER,
    mensaje TEXT NOT NULL,
    tipo TEXT DEFAULT 'info',
    leido INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id),
    FOREIGN KEY(destinatario_id) REFERENCES usuarios(id_spm)
);
"""

CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_notif_destinatario ON notificaciones(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_notif_solicitud ON notificaciones(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_notif_leido ON notificaciones(leido);
"""


def main():
    print(f"Conectando a {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Creando tabla notificaciones...")
    cursor.execute(CREATE_TABLE_SQL)

    print("Creando índices...")
    cursor.executescript(CREATE_INDEX_SQL)

    conn.commit()

    # Verificar
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notificaciones';")
    if cursor.fetchone():
        print("Tabla notificaciones creada exitosamente!")
    else:
        print("ERROR: Tabla no fue creada")

    # Contar registros
    cursor.execute("SELECT COUNT(*) FROM notificaciones")
    count = cursor.fetchone()[0]
    print(f"Registros actuales: {count}")

    conn.close()
    print("Listo!")


if __name__ == "__main__":
    main()
