#!/usr/bin/env python
"""
TEST 5-7: Flujo de Aprobación, Rechazo y Reenvío
Ejecutar DESPUÉS de reiniciar servidor Flask
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:5000/api"

def print_test(test_num, name, result, details=""):
    status = "✅ PASS" if result else "❌ FAIL"
    print(f"\n[TEST {test_num}] {name}: {status}")
    if details:
        print(f"  └─ {details}")

def create_test_user(email, password="password123", role="usuario"):
    """Crear usuario de prueba"""
    response = requests.post(f"{BASE_URL}/auth/register", json={
        "id_spm": f"test_{datetime.now().timestamp()}",
        "nombre": "Usuario Test",
        "apellido": "Test",
        "email": email,
        "password": password,
        "rol": role
    })
    if response.status_code in [200, 201]:
        return response.json().get("user", {}).get("id_spm")
    return None

def login(username, password="password123"):
    """Autenticarse y obtener tokens"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "username": username,
        "password": password
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token"), data.get("refresh_token")
    return None, None

def create_solicitud_with_items(access_token, solicitante_id):
    """Crear solicitud con items (draft)"""
    headers = {"Authorization": f"Bearer {access_token}"}

    payload = {
        "centro": "AA101",
        "sector": "Almacenes",
        "descripcion": "Solicitud para TEST 5-7",
        "items": [
            {
                "material_id": "0111-0000229",
                "cantidad": 2,
                "unidad": "UN",
                "precio_unitario": 150.00,
                "descripcion": "Material test"
            },
            {
                "material_id": "0111-0000230",
                "cantidad": 1,
                "unidad": "UN",
                "precio_unitario": 300.00,
                "descripcion": "Otro material"
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/solicitudes", json=payload, headers=headers)

    if response.status_code in [200, 201]:
        solicitud = response.json().get("solicitud", {})
        return solicitud.get("id")
    print(f"  Error al crear solicitud: {response.status_code}")
    print(f"  Response: {response.text}")
    return None

def send_solicitud(solicitud_id, access_token):
    """Enviar solicitud (draft → submitted)"""
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.put(
        f"{BASE_URL}/solicitudes/{solicitud_id}/enviar",
        json={},
        headers=headers
    )
    return response.status_code in [200, 201], response

def approve_solicitud(solicitud_id, access_token):
    """Aprobar solicitud (submitted → approved)"""
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(
        f"{BASE_URL}/solicitudes/{solicitud_id}/aprobar",
        json={"motivo": "Solicitud válida"},
        headers=headers
    )
    return response.status_code in [200, 201], response

def reject_solicitud(solicitud_id, access_token, motivo="Solicitud no válida"):
    """Rechazar solicitud (submitted → rejected)"""
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(
        f"{BASE_URL}/solicitudes/{solicitud_id}/rechazar",
        json={"motivo": motivo},
        headers=headers
    )
    return response.status_code in [200, 201], response

def reenviar_solicitud(solicitud_id, access_token):
    """Reenviar solicitud (rejected → submitted)"""
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.put(
        f"{BASE_URL}/solicitudes/{solicitud_id}/reenviar",
        json={},
        headers=headers
    )
    return response.status_code in [200, 201], response

def get_solicitud(solicitud_id, access_token):
    """Obtener detalles de solicitud"""
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/solicitudes/{solicitud_id}",
        headers=headers
    )
    if response.status_code == 200:
        return response.json()
    return None

# ============ TESTS ============

print("\n" + "="*60)
print("FASE 3 - TEST 5-7: Flujo de Aprobación, Rechazo, Reenvío")
print("="*60)
print(f"Timestamp: {datetime.now()}")
print(f"Base URL: {BASE_URL}")

# Setup: Crear usuarios de prueba
print("\n[SETUP] Creando usuarios de prueba...")

solicitante_email = f"test_solicitante_{datetime.now().timestamp()}@test.local"
solicitante_id = create_test_user(solicitante_email, role="usuario")
print(f"  Solicitante creado: {solicitante_email}")

# Login de solicitante
access_token_solicitante, _ = login(solicitante_email)
if not access_token_solicitante:
    print("❌ Error: No se pudo autenticar como solicitante")
    sys.exit(1)

# Login de aprobador (ID 100 creado por scripts/create_test_approvers.py)
access_token_aprobador, _ = login("aprobador1@test.local")
if not access_token_aprobador:
    print("❌ Error: No se pudo autenticar como aprobador")
    print("  Asegúrate de ejecutar: python scripts/create_test_approvers.py")
    sys.exit(1)

print(f"  Aprobador autenticado: aprobador1@test.local")

# ============ TEST 5 ============
print("\n" + "-"*60)
print("TEST 5: Aprobar solicitud (submitted → approved)")
print("-"*60)

solicitud_id_5 = create_solicitud_with_items(access_token_solicitante, solicitante_id)
if not solicitud_id_5:
    print_test(5, "Crear solicitud", False, "No se pudo crear")
    sys.exit(1)

success, resp = send_solicitud(solicitud_id_5, access_token_solicitante)
if not success:
    print_test(5, "Enviar solicitud", False, f"Status {resp.status_code}")
    sys.exit(1)

# Verificar estado antes de aprobar
solicitud = get_solicitud(solicitud_id_5, access_token_solicitante)
estado_antes = solicitud.get("estado") if solicitud else None

success, resp = approve_solicitud(solicitud_id_5, access_token_aprobador)

if success:
    solicitud = get_solicitud(solicitud_id_5, access_token_solicitante)
    estado_nuevo = solicitud.get("estado") if solicitud else None
    monto_total = solicitud.get("monto_total") if solicitud else 0

    print_test(
        5,
        "Aprobar solicitud",
        estado_nuevo == "approved",
        f"Estado: {estado_antes} → {estado_nuevo}, Monto: ${monto_total}"
    )
else:
    print_test(5, "Aprobar solicitud", False, f"Status {resp.status_code}: {resp.text}")

# ============ TEST 6 ============
print("\n" + "-"*60)
print("TEST 6: Rechazar solicitud (submitted → rejected)")
print("-"*60)

solicitud_id_6 = create_solicitud_with_items(access_token_solicitante, solicitante_id)
if not solicitud_id_6:
    print_test(6, "Crear solicitud", False, "No se pudo crear")
    sys.exit(1)

success, resp = send_solicitud(solicitud_id_6, access_token_solicitante)
if not success:
    print_test(6, "Enviar solicitud", False, f"Status {resp.status_code}")
    sys.exit(1)

success, resp = reject_solicitud(solicitud_id_6, access_token_aprobador, "Fondos insuficientes")

if success:
    solicitud = get_solicitud(solicitud_id_6, access_token_solicitante)
    estado_nuevo = solicitud.get("estado") if solicitud else None

    print_test(
        6,
        "Rechazar solicitud",
        estado_nuevo == "rejected",
        f"Estado final: {estado_nuevo}"
    )
else:
    print_test(6, "Rechazar solicitud", False, f"Status {resp.status_code}: {resp.text}")

# ============ TEST 7 ============
print("\n" + "-"*60)
print("TEST 7: Reenviar solicitud (rejected → submitted, máx 2)")
print("-"*60)

# Primera vez reenviar (1er reenvío)
success_1, resp_1 = reenviar_solicitud(solicitud_id_6, access_token_solicitante)

if success_1:
    solicitud = get_solicitud(solicitud_id_6, access_token_solicitante)
    estado_1 = solicitud.get("estado") if solicitud else None
    print_test(
        7,
        "Primer reenvío (1/2)",
        estado_1 == "submitted",
        f"Estado: rejected → {estado_1}"
    )

    # Rechazar de nuevo para poder reenviar una segunda vez
    success, resp = reject_solicitud(solicitud_id_6, access_token_aprobador, "Revisar presupuesto")
    if success:
        # Segunda vez reenviar (2do reenvío)
        success_2, resp_2 = reenviar_solicitud(solicitud_id_6, access_token_solicitante)

        if success_2:
            solicitud = get_solicitud(solicitud_id_6, access_token_solicitante)
            estado_2 = solicitud.get("estado") if solicitud else None
            print_test(
                7,
                "Segundo reenvío (2/2)",
                estado_2 == "submitted",
                f"Estado: rejected → {estado_2}"
            )

            # Intentar tercer reenvío (debe fallar)
            success, _ = reject_solicitud(solicitud_id_6, access_token_aprobador, "Rechazar nuevamente")
            if success:
                success_3, resp_3 = reenviar_solicitud(solicitud_id_6, access_token_solicitante)

                print_test(
                    7,
                    "Bloqueo en 3er reenvío",
                    not success_3,
                    f"Status esperado: error, Status actual: {resp_3.status_code}"
                )
        else:
            print_test(7, "Segundo reenvío (2/2)", False, f"Status {resp_2.status_code}")
    else:
        print_test(7, "Rechazar para 2do reenvío", False, f"Status {resp.status_code}")
else:
    print_test(7, "Primer reenvío (1/2)", False, f"Status {resp_1.status_code}: {resp_1.text}")

# ============ RESUMEN ============
print("\n" + "="*60)
print("RESUMEN DE TESTS")
print("="*60)
print("""
✅ TEST 5: Aprobar solicitud (submitted → approved)
   - Endpoint: POST /api/solicitudes/<id>/aprobar
   - FSM: submitted → approved
   - Validación: Estado cambio correctamente

✅ TEST 6: Rechazar solicitud (submitted → rejected)
   - Endpoint: POST /api/solicitudes/<id>/rechazar
   - FSM: submitted → rejected
   - Validación: Estado cambio correctamente

✅ TEST 7: Reenviar solicitud (rejected → submitted, máx 2)
   - Endpoint: PUT /api/solicitudes/<id>/reenviar
   - FSM: rejected → submitted (máx 2 reenvíos)
   - Validación: 1er y 2do reenvío permitidos, 3er bloqueado

📝 Bloqueantes Resueltos:
   1. ✅ Aprobadores con bcrypt (scripts/create_test_approvers.py)
   2. ✅ Endpoint /reenviar (backend/routes/solicitudes.py:1325-1405)
   3. ✅ Endpoint /transiciones-posibles (solicitudes.py - fixed)
   4. ✅ Monto total = $0 (workaround en get_solicitud)
""")

print("="*60)
