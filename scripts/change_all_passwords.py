#!/usr/bin/env python
"""
Script para cambiar todas las contraseñas de usuarios a "spm123"
Uso: python scripts/change_all_passwords.py
"""

import sys
from pathlib import Path

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

import bcrypt
from backend.core.db import get_db_connection

def main():
    """Cambia todas las contraseñas a spm123"""

    # Generar hash de spm123
    new_password = "spm123"
    password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()

    print(f"Hash generado: {password_hash}")
    print(f"Contraseña nueva: {new_password}")
    print("\n" + "="*60)

    # Conectarse a la BD
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Obtener todos los usuarios
        cur.execute("SELECT id_spm, nombre, mail FROM usuario")
        usuarios = cur.fetchall()

        if not usuarios:
            print("❌ No hay usuarios en la base de datos")
            return

        print(f"✓ Encontrados {len(usuarios)} usuarios")
        print("\nUsuarios a actualizar:")
        for user in usuarios:
            user_dict = dict(user) if hasattr(user, 'keys') else {
                'id_spm': user[0],
                'nombre': user[1],
                'mail': user[2]
            }
            print(f"  - {user_dict['id_spm']}: {user_dict['nombre']} ({user_dict['mail']})")

        # Confirmar antes de actualizar
        print("\n" + "="*60)

        # Actualizar todas las contraseñas
        cur.execute("UPDATE usuario SET contrasena = ?", (password_hash,))
        conn.commit()

        # Verificar que se actualizaron
        cur.execute("SELECT COUNT(*) as total FROM usuario WHERE contrasena = ?", (password_hash,))
        result = cur.fetchone()
        count = result['total'] if isinstance(result, dict) else result[0]

        print(f"\n✓ ¡Actualizado exitosamente!")
        print(f"✓ {count} usuarios actualizados con contraseña: {new_password}")
        print("\nPuedes usar estas credenciales para acceder:")
        print(f"  Usuario: cualquier id_spm o email")
        print(f"  Contraseña: {new_password}")

if __name__ == "__main__":
    main()
