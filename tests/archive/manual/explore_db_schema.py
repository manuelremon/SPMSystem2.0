#!/usr/bin/env python
"""Script para explorar el esquema de la BD"""

import sqlite3

con = sqlite3.connect("./src/backend/core/data/spm.db")
cursor = con.cursor()

# Obtener el esquema de usuarios
cursor.execute("PRAGMA table_info(usuarios);")
columns = cursor.fetchall()

print("\nEsquema de tabla 'usuarios':")
print("-" * 60)
for col in columns:
    col_id, col_name, col_type, notnull, default, pk = col
    print(f"  {col_name:20s} {col_type:15s} (pk={pk}, nn={notnull})")

# Obtener un usuario de muestra
cursor.execute("SELECT * FROM usuarios LIMIT 1")
user = cursor.fetchone()

print("\nUsuario de muestra:")
print("-" * 60)
for col in columns:
    col_name = col[1]
    print(f"  {col_name}: {user[col[0]]}")

con.close()
