#!/usr/bin/env python3
"""
Script para inicializar tabla usuarios en la BD
"""

import sqlite3
from pathlib import Path

# Crear BD en la ruta correcta
db_path = Path("../spm_staging.db")
print(f"Inicializando base de datos en: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Crear tabla usuarios
cursor.execute(
    """
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_spm TEXT UNIQUE NOT NULL,
    mail TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT,
    apellido TEXT,
    rol TEXT DEFAULT 'user',
    activo INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""
)

# Insertar usuario de prueba
cursor.execute(
    """
INSERT OR IGNORE INTO usuarios (id_spm, mail, password, nombre, apellido, rol)
VALUES (?, ?, ?, ?, ?, ?)
""",
    (
        "test",
        "test@example.com",
        "$2b$12$K7XzNb2PpCHp.p1CkLCPxOoYxJD5YhBpHFM7qL1eYJmhLzEeM6vBC",  # "password"
        "Test",
        "User",
        "admin",
    ),
)

conn.commit()

# Verificar
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print(f"\n✓ Tablas creadas: {[t[0] for t in tables]}")

cursor.execute("SELECT COUNT(*) FROM usuarios")
count = cursor.fetchone()[0]
print(f"✓ Usuarios en BD: {count}")

conn.close()
print("\n✅ Base de datos inicializada correctamente")
