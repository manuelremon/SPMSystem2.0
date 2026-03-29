"""
Script para crear usuario ID 200 con rol Compartidos.
Ejecutar en producción: python scripts/create_user_compartidos.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from backend.core.db import get_db_connection


def create_user():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar si ya existe
    cursor.execute("SELECT id_spm FROM usuario WHERE id_spm = ?", ("200",))
    if cursor.fetchone():
        print("Usuario 200 ya existe, actualizando rol y contraseña...")
        password_hash = bcrypt.hashpw("a123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute(
            "UPDATE usuario SET rol = ?, contrasena = ? WHERE id_spm = ?",
            ("compartidos", password_hash, "200"),
        )
    else:
        print("Creando usuario 200...")
        password_hash = bcrypt.hashpw("a123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        cursor.execute(
            """INSERT INTO usuario (id_spm, nombre, apellido, rol, contrasena, estado_registro)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("200", "Compartidos", "", "compartidos", password_hash, "Activo"),
        )

    conn.commit()
    conn.close()
    print("Usuario 200 creado/actualizado con rol 'compartidos' y contraseña 'a123456'")


if __name__ == "__main__":
    create_user()
