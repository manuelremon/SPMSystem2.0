#!/usr/bin/env python3
"""
Script para crear/corregir tabla usuarios en backend_v2/spm.db
"""

import sqlite3
from pathlib import Path

# Base de datos correcta
db_path = Path("../backend_v2/spm.db")
print(f"Trabajando con: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ver tablas existentes
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print(f"Tablas existentes: {[t[0] for t in tables]}")

# Ver si existe usuarios
if "usuarios" in [t[0] for t in tables]:
    cursor.execute("PRAGMA table_info(usuarios)")
    cols = cursor.fetchall()
    print(f"Columnas de usuarios: {[c[1] for c in cols]}")

    # Verificar usuarios
    cursor.execute("SELECT * FROM usuarios LIMIT 3")
    rows = cursor.fetchall()
    print(f"Usuarios existentes: {rows}")
else:
    print("Tabla usuarios NO existe, creándola...")

# Crear tabla si no existe (con columna 'contrasena' como espera el código)
cursor.execute(
    """
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_spm TEXT UNIQUE NOT NULL,
    mail TEXT UNIQUE NOT NULL,
    contrasena TEXT NOT NULL,
    nombre TEXT,
    apellido TEXT,
    rol TEXT DEFAULT 'user',
    activo INTEGER DEFAULT 1,
    sector TEXT,
    centros TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""
)

# Insertar usuario de prueba (bcrypt hash de "password")
cursor.execute(
    """
INSERT OR REPLACE INTO usuarios (id_spm, mail, contrasena, nombre, apellido, rol)
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

# También agregar usuario admin con password simple para pruebas
cursor.execute(
    """
INSERT OR IGNORE INTO usuarios (id_spm, mail, contrasena, nombre, apellido, rol)
VALUES (?, ?, ?, ?, ?, ?)
""",
    (
        "admin",
        "admin@spm.com",
        "admin123",  # password plano para pruebas rápidas
        "Admin",
        "SPM",
        "admin",
    ),
)

conn.commit()

# Verificar
cursor.execute("SELECT id_spm, mail, contrasena, rol FROM usuarios")
rows = cursor.fetchall()
print("\n✓ Usuarios en BD:")
for row in rows:
    print(f"  - {row[0]} | {row[1]} | {row[2][:20]}... | {row[3]}")

conn.close()
print("\n✅ Base de datos configurada correctamente")
print("\n📝 Credenciales de prueba:")
print("   Usuario: test    Password: password")
print("   Usuario: admin   Password: admin123")
