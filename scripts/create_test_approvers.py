#!/usr/bin/env python
"""
Crear usuarios aprobadores de prueba con contraseña hasheada (bcrypt)
"""

import sqlite3
import bcrypt
import sys

db_path = "data/spm.db"

# Usuarios a crear
approvers = [
    {
        "id_spm": "100",
        "nombre": "Test Aprobador 1",
        "email": "aprobador1@test.local",
        "password": "password123",
        "rol": "Aprobador_solicitudes, Aprobador_presupuestos"
    },
    {
        "id_spm": "101",
        "nombre": "Test Aprobador 2",
        "email": "aprobador2@test.local",
        "password": "password123",
        "rol": "Aprobador_solicitudes"
    },
    {
        "id_spm": "102",
        "nombre": "Test Coordinador",
        "email": "coordinador@test.local",
        "password": "password123",
        "rol": "Coordinador, Aprobador_presupuestos"
    }
]

try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print(f"Creando {len(approvers)} usuarios de prueba con bcrypt...")

    for approver in approvers:
        # Hash password con bcrypt
        password_hash = bcrypt.hashpw(
            approver["password"].encode(),
            bcrypt.gensalt()
        ).decode()

        # Insertar usuario
        try:
            cur.execute("""
                INSERT OR REPLACE INTO usuario
                (id_spm, nombre, apellido, mail, contrasena, rol, estado_registro, posicion, centros)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                approver["id_spm"],
                approver["nombre"],
                "",
                approver["email"],
                password_hash,
                approver["rol"],
                "Activo",
                "jefe",  # Posición necesaria para ser seleccionado como aprobador
                "AA101,AA102,AA103,AA104,AA105,AA106"  # Centros disponibles
            ))
            print(f"✓ {approver['nombre']} creado")
            print(f"  ID: {approver['id_spm']}")
            print(f"  Email: {approver['email']}")
            print(f"  Password: {approver['password']}")
            print(f"  Rol: {approver['rol']}")
            print()
        except Exception as e:
            print(f"✗ Error creando {approver['nombre']}: {e}")

    conn.commit()
    print("✅ Usuarios creados exitosamente")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
finally:
    conn.close()
