#!/usr/bin/env python3
"""
Script para crear solicitudes de prueba con estado pendiente de aprobación
"""

import sqlite3
from datetime import datetime

conn = sqlite3.connect("database/spm.db")
c = conn.cursor()

print("=" * 70)
print("CREAR SOLICITUDES DE PRUEBA PARA APROBADOR")
print("=" * 70)

# Primero, verificar usuarios y centros
print("\n1. Verificar usuarios...")
c.execute(
    "SELECT id_spm, nombre FROM usuarios WHERE id_spm LIKE '%admin%' OR id_spm LIKE '%usuario%'"
)
users = c.fetchall()
for user in users:
    print(f"  - {user[0]}: {user[1]}")

print("\n2. Verificar centros...")
c.execute("SELECT id_centro, nombre FROM centros LIMIT 5")
centros = c.fetchall()
for centro in centros:
    print(f"  - {centro[0]}: {centro[1]}")

print("\n3. Verificar almacenes...")
c.execute("SELECT id_almacen, nombre FROM almacenes LIMIT 5")
almacenes = c.fetchall()
for almacen in almacenes:
    print(f"  - {almacen[0]}: {almacen[1]}")

# Crear una solicitud de prueba
print("\n4. Creando solicitud de prueba...")

try:
    # Usar admin como solicitante
    id_usuario = "admin@spm.com"
    aprobador_id = None  # Dejar sin asignar para que aprobador pueda asignarse
    centro = "CENTRO001"
    sector = "Sector A"
    criticidad = "alta"
    fecha_necesidad = "2025-11-10"
    justificacion = "Solicitud de prueba para verificar workflow de aprobación"
    total_monto = 1500.00
    status = "pending_approval"  # ← Usar valor en inglés (DB constraint lo requiere)

    # Insertar solicitud (sin data_json que no está en la tabla)
    c.execute(
        """
        INSERT INTO solicitudes
        (id_usuario, aprobador_id, centro, sector, criticidad,
         fecha_necesidad, justificacion, total_monto, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            id_usuario,
            aprobador_id,
            centro,
            sector,
            criticidad,
            fecha_necesidad,
            justificacion,
            total_monto,
            status,
            datetime.now().isoformat(),
            datetime.now().isoformat(),
        ),
    )

    solicitud_id = c.lastrowid
    conn.commit()
    print(f"  ✓ Solicitud creada con ID: {solicitud_id}")

    # Insertar items de prueba
    # NOTA: Simplificar - solo crear la solicitud sin items por ahora
    # El schema de solicitud_items es complejo y puede fallar

    conn.commit()
    print("  ✓ Solicitud creada exitosamente")

except Exception as e:
    print(f"  ✗ Error: {e}")
    conn.rollback()

# Verificar solicitudes pendientes
print("\n5. Verificando solicitudes pendientes de aprobación...")
c.execute(
    """
    SELECT id, id_usuario, aprobador_id, centro, sector, status, total_monto, created_at
    FROM solicitudes
    WHERE status IN ('pending_approval', 'pendiente_de_aprobacion')
    ORDER BY id DESC
    LIMIT 10
"""
)

solicitudes = c.fetchall()
if solicitudes:
    print(f"  ✓ Encontradas {len(solicitudes)} solicitudes pendientes:")
    for sol in solicitudes:
        print(
            f"    ID: {sol[0]}, Usuario: {sol[1]}, Aprobador: {sol[2]}, Centro: {sol[3]}, Estado: {sol[5]}"
        )
else:
    print("  ✗ No hay solicitudes pendientes")

conn.close()
print("\n" + "=" * 70)
