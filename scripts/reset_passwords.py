#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para cambiar la contraseña de todos los usuarios a "a"
"""

import sqlite3
import sys
from pathlib import Path

import bcrypt

# Configurar encoding para Windows
if sys.platform == "win32":
    import codecs

    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "strict")
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer, "strict")

# Ruta de la base de datos (buscar en varios lugares)
possible_paths = [
    Path("spm.db"),
    Path("backend_v2/spm.db"),
    Path("../spm.db"),
]

db_path = None
for path in possible_paths:
    if path.exists():
        db_path = path
        break

if db_path is None:
    print("[ERROR] No se encuentra la base de datos")
    print("        Se buscó en: spm.db, backend_v2/spm.db")
    print("        Asegurate de ejecutar este script desde la raiz del proyecto")
    exit(1)

print(f"[INFO] Usando base de datos: {db_path}")

# Generar hash de la contraseña "a"
password = "a"
password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

print(f"[INFO] Hash generado para contraseña '{password}': {password_hash[:30]}...")

# Conectar a la base de datos
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Verificar cuántos usuarios hay
cursor.execute("SELECT COUNT(*) FROM usuarios")
user_count = cursor.fetchone()[0]
print(f"\n[INFO] Usuarios encontrados: {user_count}")

if user_count == 0:
    print("[WARN] No hay usuarios en la base de datos.")
    conn.close()
    exit(0)

# Listar usuarios antes de cambiar
print("\n[INFO] Usuarios actuales:")
cursor.execute("SELECT id_spm, mail, nombre, apellido, rol FROM usuarios")
users = cursor.fetchall()
for user in users:
    nombre_completo = f"{user[2] or ''} {user[3] or ''}".strip() or "Sin nombre"
    print(f"   - {user[0]} ({user[1]}) - {nombre_completo} - Rol: {user[4]}")

# Confirmar cambio
print(f"\n[WARN] Se cambiara la contraseña de TODOS los usuarios a: '{password}'")
response = input("Continuar? (s/n): ").lower()

if response != "s":
    print("[INFO] Operacion cancelada.")
    conn.close()
    exit(0)

# Actualizar todas las contraseñas
try:
    cursor.execute(
        """
        UPDATE usuarios
        SET contrasena = ?
    """,
        (password_hash,),
    )

    rows_affected = cursor.rowcount
    conn.commit()

    print("\n[OK] Contraseñas actualizadas exitosamente!")
    print(f"     {rows_affected} usuarios actualizados")
    print(f"\n[INFO] Nueva contraseña para todos los usuarios: '{password}'")

except Exception as e:
    print(f"\n[ERROR] Error al actualizar contraseñas: {e}")
    conn.rollback()
    exit(1)
finally:
    conn.close()

print("\n" + "=" * 60)
print("USUARIOS ACTUALIZADOS:")
print("=" * 60)
for user in users:
    print(f"Usuario: {user[0]}")
    print(f"Email:   {user[1]}")
    print("Password: a")
    print("-" * 60)
