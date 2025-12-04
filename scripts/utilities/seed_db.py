#!/usr/bin/env python3
"""
Script para generar datos iniciales en la base de datos SPM.
Esto creará datos mínimos para prueba de la aplicación.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

db_path = Path("src/backend/core/data/spm.db")

if not db_path.exists():
    print(f"❌ Base de datos no encontrada: {db_path}")
    exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

print("\n" + "=" * 80)
print("GENERADOR DE DATOS INICIALES - SPM")
print("=" * 80 + "\n")

# 1. Agregar usuarios de prueba
print("1. Insertando usuarios de prueba...")

usuarios = [
    (
        "admin001",
        "Administrador",
        "Sistema",
        "admin",
        "1234",
        "admin@spm.local",
        "Administrador",
        None,
        None,
        None,
        None,
        None,
        None,
        "activo",
        None,
    ),
    (
        "empl001",
        "Juan",
        "Pérez",
        "empleado",
        "1234",
        "juan@spm.local",
        "Empleado",
        "IT",
        "C001",
        None,
        None,
        None,
        None,
        "activo",
        None,
    ),
    (
        "empl002",
        "María",
        "García",
        "empleado",
        "1234",
        "maria@spm.local",
        "Empleado",
        "RRHH",
        "C001",
        None,
        None,
        None,
        None,
        "activo",
        None,
    ),
    (
        "aprobador001",
        "Carlos",
        "López",
        "aprobador",
        "1234",
        "carlos@spm.local",
        "Aprobador",
        None,
        None,
        None,
        None,
        None,
        None,
        "activo",
        None,
    ),
    (
        "planificador001",
        "Ana",
        "Martínez",
        "planificador",
        "1234",
        "ana@spm.local",
        "Planificador",
        None,
        None,
        None,
        None,
        None,
        None,
        "activo",
        None,
    ),
]

try:
    cursor.executemany(
        """
        INSERT OR IGNORE INTO usuarios
        (id_spm, nombre, apellido, rol, contrasena, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        usuarios,
    )
    conn.commit()
    print(f"   ✓ {len(usuarios)} usuarios insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 2. Agregar catálogo de centros
print("\n2. Insertando centros...")

centros = [
    (1, "C001", "Centro Principal", "Oficina central de operaciones", "Planta principal", 1),
    (2, "C002", "Centro Secundario", "Sucursal de operaciones", "Planta secundaria", 1),
    (3, "C003", "Centro Logístico", "Centro de distribución", "Almacén central", 1),
]

now = datetime.now().isoformat()

try:
    for idx, cod, nom, desc, notas, activo in centros:
        cursor.execute(
            """
            INSERT OR IGNORE INTO catalog_centros
            (codigo, nombre, descripcion, notas, activo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (cod, nom, desc, notas, activo, now, now),
        )
    conn.commit()
    print(f"   ✓ {len(centros)} centros insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 3. Agregar sectores
print("\n3. Insertando sectores...")

sectores = [
    ("IT", "Tecnología e Informática", "Departamento de sistemas", 1),
    ("RRHH", "Recursos Humanos", "Gestión de personal", 1),
    ("FINANZAS", "Finanzas", "Gestión financiera", 1),
    ("OPERACIONES", "Operaciones", "Gestión operacional", 1),
    ("MANTENIMIENTO", "Mantenimiento", "Mantenimiento de equipos", 1),
]

try:
    for nom, desc, _, activo in sectores:
        cursor.execute(
            """
            INSERT OR IGNORE INTO catalog_sectores
            (nombre, descripcion, activo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (nom, desc, activo, now, now),
        )
    conn.commit()
    print(f"   ✓ {len(sectores)} sectores insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 4. Agregar almacenes
print("\n4. Insertando almacenes...")

almacenes = [
    ("ALM001", "Almacén Central", "C001", "Almacén principal de inventario", 1),
    ("ALM002", "Almacén Secundario", "C002", "Almacén de respaldo", 1),
    ("ALM003", "Almacén Temporal", "C003", "Almacén temporal de tránsito", 1),
]

try:
    for cod, nom, cent, desc, activo in almacenes:
        cursor.execute(
            """
            INSERT OR IGNORE INTO catalog_almacenes
            (codigo, nombre, centro_codigo, descripcion, activo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (cod, nom, cent, desc, activo, now, now),
        )
    conn.commit()
    print(f"   ✓ {len(almacenes)} almacenes insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 5. Agregar roles
print("\n5. Insertando roles...")

roles = [
    ("admin", "Administrador del sistema", 1),
    ("empleado", "Empleado regular", 1),
    ("aprobador", "Aprobador de solicitudes", 1),
    ("planificador", "Planificador de compras", 1),
    ("jefe_centro", "Jefe de centro", 1),
]

try:
    for nom, desc, activo in roles:
        cursor.execute(
            """
            INSERT OR IGNORE INTO catalog_roles
            (nombre, descripcion, activo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (nom, desc, activo, now, now),
        )
    conn.commit()
    print(f"   ✓ {len(roles)} roles insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 6. Agregar puestos
print("\n6. Insertando puestos...")

puestos = [
    ("Técnico", "Técnico de sistemas", 1),
    ("Especialista", "Especialista en tecnología", 1),
    ("Gerente", "Gerente de proyecto", 1),
    ("Operario", "Operario de almacén", 1),
]

try:
    for nom, desc, activo in puestos:
        cursor.execute(
            """
            INSERT OR IGNORE INTO catalog_puestos
            (nombre, descripcion, activo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (nom, desc, activo, now, now),
        )
    conn.commit()
    print(f"   ✓ {len(puestos)} puestos insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 7. Agregar materiales
print("\n7. Insertando materiales...")

materiales = [
    (
        "MAT001",
        "Computadora Portátil",
        "Laptop marca XYZ 15 pulgadas",
        "C001",
        "IT",
        "UNIDAD",
        1200.00,
    ),
    ("MAT002", "Monitor LED", "Monitor 24 pulgadas Full HD", "C001", "IT", "UNIDAD", 300.00),
    (
        "MAT003",
        "Teclado Inalámbrico",
        "Teclado mecánico inalámbrico",
        "C001",
        "IT",
        "UNIDAD",
        80.00,
    ),
    ("MAT004", "Mouse Óptico", "Mouse óptico con USB", "C001", "IT", "UNIDAD", 25.00),
    ("MAT005", "Cable HDMI", "Cable HDMI 5 metros", "C001", "IT", "UNIDAD", 15.00),
    ("MAT006", "Papel Bond", "Resma de papel bond A4", "C002", "RRHH", "RESMA", 5.00),
    ("MAT007", "Bolígrafos", "Caja de 50 bolígrafos azules", "C002", "RRHH", "CAJA", 10.00),
]

try:
    for cod, desc, desc_larga, centro, sector, unidad, precio in materiales:
        cursor.execute(
            """
            INSERT OR IGNORE INTO materiales
            (codigo, descripcion, descripcion_larga, centro, sector, unidad, precio_usd)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (cod, desc, desc_larga, centro, sector, unidad, precio),
        )
    conn.commit()
    print(f"   ✓ {len(materiales)} materiales insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 8. Agregar presupuestos
print("\n8. Insertando presupuestos...")

presupuestos = [
    ("C001", "IT", 50000.00, 50000.00),
    ("C001", "RRHH", 10000.00, 10000.00),
    ("C002", "OPERACIONES", 30000.00, 30000.00),
    ("C003", "MANTENIMIENTO", 15000.00, 15000.00),
]

try:
    for centro, sector, monto, saldo in presupuestos:
        cursor.execute(
            """
            INSERT OR IGNORE INTO presupuestos
            (centro, sector, monto_usd, saldo_usd)
            VALUES (?, ?, ?, ?)
        """,
            (centro, sector, monto, saldo),
        )
    conn.commit()
    print(f"   ✓ {len(presupuestos)} presupuestos insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

# 9. Agregar planificadores
print("\n9. Insertando planificadores...")

planificadores = [
    ("planificador001", "Planificador Principal", 1),
]

try:
    for user_id, nombre, activo in planificadores:
        cursor.execute(
            """
            INSERT OR IGNORE INTO planificadores
            (usuario_id, nombre, activo, created_at)
            VALUES (?, ?, ?, ?)
        """,
            (user_id, nombre, activo, now),
        )
    conn.commit()
    print(f"   ✓ {len(planificadores)} planificadores insertados")
except Exception as e:
    print(f"   ✗ Error: {e}")
    conn.rollback()

conn.close()

print("\n" + "=" * 80)
print("✅ Datos iniciales generados exitosamente")
print("=" * 80 + "\n")

# Mostrar resumen
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

print("📊 RESUMEN DE DATOS:")
cursor.execute("SELECT COUNT(*) FROM usuarios")
print(f"  • Usuarios: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_centros")
print(f"  • Centros: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_sectores")
print(f"  • Sectores: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_almacenes")
print(f"  • Almacenes: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM materiales")
print(f"  • Materiales: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM presupuestos")
print(f"  • Presupuestos: {cursor.fetchone()[0]}")

conn.close()

print("\n" + "=" * 80)
print("Ahora puedes probar la aplicación con estos datos iniciales")
print("=" * 80 + "\n")
