#!/usr/bin/env python3
"""
Script para crear un usuario planificador demo
"""

import os
import sys

# Agregar src al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from backend.core.db import get_connection
from backend.services.db.security import hash_password


def create_planner_demo():
    """Crea un usuario planificador demo con contraseña a1"""

    try:
        # Hash de la contraseña "a1"
        password_hash = hash_password("a1")

        print("[*] Creando usuario planificador demo...")
        print("    Username: planificador")
        print("    Contraseña: a1")
        print("    Rol: Planificador")

        with get_connection() as con:
            # Verificar si ya existe
            existing = con.execute(
                "SELECT id_spm FROM usuarios WHERE id_spm = ?", ("planificador",)
            ).fetchone()

            if existing:
                print("    ⚠️  Usuario 'planificador' ya existe, eliminando...")
                con.execute("DELETE FROM usuarios WHERE id_spm = ?", ("planificador",))

            # Insertar usuario nuevo
            con.execute(
                """
                INSERT INTO usuarios (
                    id_spm, nombre, apellido, rol, contrasena, mail,
                    posicion, sector, estado_registro
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    "planificador",  # id_spm
                    "Demo",  # nombre
                    "Planificador",  # apellido
                    "Planificador",  # rol
                    password_hash,  # contrasena (hasheada)
                    "planificador@demo.local",  # mail
                    "Planificador Demo",  # posicion
                    "Planificación",  # sector
                    "activo",  # estado_registro
                ),
            )

            con.commit()

        print("    ✅ Usuario creado exitosamente!")
        print()
        print("Credenciales de login:")
        print("  Username: planificador")
        print("  Password: a1")
        print()
        print("Puedes usar estas credenciales para:")
        print("  1. Iniciar sesión en http://localhost:5000/home.html")
        print("  2. Acceder al módulo de Planificación")
        print("  3. Ver y gestionar solicitudes de materiales")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = create_planner_demo()
    sys.exit(0 if success else 1)
