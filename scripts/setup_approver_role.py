#!/usr/bin/env python3
"""Setup script to add Aprobador role and assign to users"""

import sqlite3

conn = sqlite3.connect("database/spm.db")
c = conn.cursor()

print("=" * 60)
print("SETUP: Agregar rol 'Aprobador' y asignar usuarios")
print("=" * 60)

# Check if Aprobador role exists
c.execute("SELECT id_rol, nombre_rol FROM roles WHERE nombre_rol LIKE '%Aprobador%'")
existing = c.fetchall()

if existing:
    print(f"\nRol Aprobador ya existe: {existing}")
    aprobador_id = existing[0][0]
else:
    print("\nCreando rol 'Aprobador'...")
    c.execute("INSERT INTO roles (nombre_rol) VALUES ('Aprobador')")
    conn.commit()
    aprobador_id = c.lastrowid
    print(f"✓ Rol creado con ID: {aprobador_id}")

# Assign aprobador role to specific users
test_users = [
    "admin@spm.com",  # Admin user
]

print("\nAsignando rol Aprobador a usuarios...")
for user_id in test_users:
    # Check if user exists
    c.execute("SELECT id_spm FROM usuarios WHERE id_spm = ?", (user_id,))
    if not c.fetchone():
        print(f"  ✗ Usuario no existe: {user_id}")
        continue

    # Check if user already has Aprobador role
    c.execute(
        "SELECT id_usuario_rol FROM usuario_roles WHERE usuario_id = ? AND rol_id = ?",
        (user_id, aprobador_id),
    )

    if c.fetchone():
        print(f"  ✓ Usuario ya tiene rol: {user_id}")
    else:
        # Assign role
        c.execute(
            "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)", (user_id, aprobador_id)
        )
        conn.commit()
        print(f"  ✓ Asignado rol a: {user_id}")

# Display all roles for all users
print("\n" + "=" * 60)
print("USUARIOS Y SUS ROLES:")
print("=" * 60)

c.execute(
    """
    SELECT u.id_spm, u.nombre, u.apellido, GROUP_CONCAT(r.nombre_rol, ', ') as roles
    FROM usuarios u
    LEFT JOIN usuario_roles ur ON u.id_spm = ur.usuario_id
    LEFT JOIN roles r ON ur.rol_id = r.id_rol
    GROUP BY u.id_spm
    ORDER BY u.id_spm
"""
)

for row in c.fetchall():
    user_id, nombre, apellido, roles = row
    print(f"{user_id}: {nombre} {apellido}")
    print(f"  Roles: {roles or 'NINGUNO'}")

conn.close()
print("\n✓ Setup completado")
