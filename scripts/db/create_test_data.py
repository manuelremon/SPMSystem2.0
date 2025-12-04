#!/usr/bin/env python3
"""
Script para crear datos de prueba en la BD
"""

import sqlite3

from werkzeug.security import generate_password_hash

DB_PATH = "database/spm.db"

print("🔧 Insertando datos de prueba...")

try:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Crear roles
    print("  • Creando roles...")
    roles = [
        ("Administrador",),
        ("Planificador",),
        ("Usuario",),
    ]
    for (nombre_rol,) in roles:
        cursor.execute("INSERT INTO roles (nombre_rol) VALUES (?)", (nombre_rol,))

    # 2. Crear centros
    print("  • Creando centros...")
    centros = [
        ("CENTRO001", "Centro Principal", "Buenos Aires"),
        ("CENTRO002", "Centro Secundario", "Cordoba"),
        ("CENTRO003", "Centro Regional", "Rosario"),
    ]
    for id_centro, nombre, ubicacion in centros:
        cursor.execute(
            "INSERT INTO centros (id_centro, nombre, ubicacion) VALUES (?, ?, ?)",
            (id_centro, nombre, ubicacion),
        )

    # 3. Crear almacenes
    print("  • Creando almacenes...")
    almacenes = [
        ("ALM001", "CENTRO001", "Almacén Central"),
        ("ALM002", "CENTRO002", "Almacén Secundario"),
    ]
    for id_almacen, id_centro, nombre in almacenes:
        cursor.execute(
            "INSERT INTO almacenes (id_almacen, id_centro, nombre) VALUES (?, ?, ?)",
            (id_almacen, id_centro, nombre),
        )

    # 4. Crear usuarios
    print("  • Creando usuarios...")
    usuarios = [
        ("admin@spm.com", "Admin", "System", generate_password_hash("admin123")),
        ("planificador@spm.com", "Planificador", "SPM", generate_password_hash("plan123")),
        ("usuario@spm.com", "Usuario", "Normal", generate_password_hash("user123")),
    ]
    for id_spm, nombre, apellido, contrasena in usuarios:
        cursor.execute(
            """INSERT INTO usuarios (id_spm, nombre, apellido, contrasena)
               VALUES (?, ?, ?, ?)""",
            (id_spm, nombre, apellido, contrasena),
        )

    # 5. Asignar roles a usuarios
    print("  • Asignando roles...")
    cursor.execute("SELECT id_rol FROM roles WHERE nombre_rol = ?", ("Administrador",))
    admin_role = cursor.fetchone()["id_rol"]
    cursor.execute("SELECT id_rol FROM roles WHERE nombre_rol = ?", ("Planificador",))
    planner_role = cursor.fetchone()["id_rol"]
    cursor.execute("SELECT id_rol FROM roles WHERE nombre_rol = ?", ("Usuario",))
    user_role = cursor.fetchone()["id_rol"]

    cursor.execute(
        "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)",
        ("admin@spm.com", admin_role),
    )
    cursor.execute(
        "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)",
        ("planificador@spm.com", planner_role),
    )
    cursor.execute(
        "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (?, ?)",
        ("usuario@spm.com", user_role),
    )

    # 6. Crear algunos materiales
    print("  • Creando materiales...")
    materiales = [
        ("MAT001", 'Tornillos 1/4"', "CENTRO001"),
        ("MAT002", 'Tuercas 1/4"', "CENTRO001"),
        ("MAT003", "Arandelas", "CENTRO002"),
        ("MAT004", "Pernos", "CENTRO002"),
    ]
    for codigo, descripcion, centro in materiales:
        cursor.execute(
            "INSERT INTO materiales (codigo, descripcion, centro) VALUES (?, ?, ?)",
            (codigo, descripcion, centro),
        )

    # 7. Crear algunas solicitudes de prueba
    print("  • Creando solicitudes de prueba...")
    solicitudes = [
        ("admin@spm.com", "CENTRO001", "Sector A", "Se necesitan tornillos", "pending_approval"),
        ("usuario@spm.com", "CENTRO002", "Sector B", "Repuestos para equipos", "draft"),
        ("admin@spm.com", "CENTRO001", "Sector C", "Materiales varios", "approved"),
    ]
    for id_usuario, centro, sector, justificacion, status in solicitudes:
        cursor.execute(
            """INSERT INTO solicitudes
               (id_usuario, centro, sector, justificacion, status, criticidad)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (id_usuario, centro, sector, justificacion, status, "Normal"),
        )

    conn.commit()
    print("\n✅ Datos de prueba insertados exitosamente!")

    # Verificar
    print("\n📊 Verificación:")
    cursor.execute("SELECT COUNT(*) as count FROM usuarios")
    print(f"  • Usuarios: {cursor.fetchone()['count']}")
    cursor.execute("SELECT COUNT(*) as count FROM solicitudes")
    print(f"  • Solicitudes: {cursor.fetchone()['count']}")
    cursor.execute("SELECT COUNT(*) as count FROM materiales")
    print(f"  • Materiales: {cursor.fetchone()['count']}")
    cursor.execute("SELECT COUNT(*) as count FROM centros")
    print(f"  • Centros: {cursor.fetchone()['count']}")
    cursor.execute("SELECT COUNT(*) as count FROM roles")
    print(f"  • Roles: {cursor.fetchone()['count']}")

    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback

    traceback.print_exc()
    exit(1)

print("\n✅ LISTO! Sistema de prueba configurado.")
print("\nCredenciales de prueba:")
print("  • Admin:        admin@spm.com / admin123")
print("  • Planificador: planificador@spm.com / plan123")
print("  • Usuario:      usuario@spm.com / user123")
