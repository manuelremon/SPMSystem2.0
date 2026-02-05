#!/usr/bin/env python
"""
TEST 5-7: Versión Simple
Directamente desde Python - acceso a BD para obtener credenciales del aprobador
"""

import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
from datetime import datetime
from backend.core.db import get_db_connection

BASE_URL = "http://localhost:5000/api"

def test_fase3_5_7():
    print("\n" + "="*60)
    print("FASE 3 - TEST 5-7: Versión Simple")
    print("="*60)
    print(f"Timestamp: {datetime.now()}\n")

    # 1. Crear usuario solicitante
    print("[1] Creando usuario solicitante...")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "id_spm": f"sol_{int(datetime.now().timestamp())}",
        "nombre": "Solicitante",
        "apellido": "Test",
        "email": f"sol_{int(datetime.now().timestamp())}@test.local",
        "password": "password123",
        "rol": "usuario"
    })

    if resp.status_code not in [200, 201]:
        print(f"❌ Error crear solicitante: {resp.status_code}")
        return False

    token_solicitante = resp.json().get("access_token")
    print(f"✓ Solicitante creado")

    # 2. Crear solicitud
    print("\n[2] Creando solicitud...")
    resp = requests.post(f"{BASE_URL}/solicitudes", json={
        "centro": "AA101",
        "sector": "Almacenes",
        "descripcion": "Test",
        "items": [{
            "material_id": "0111-0000229",
            "cantidad": 2,
            "unidad": "UN",
            "precio_unitario": 150.00
        }]
    }, headers={"Authorization": f"Bearer {token_solicitante}"})

    if resp.status_code not in [200, 201]:
        print(f"❌ Error crear solicitud: {resp.status_code}")
        return False

    solicitud_id = resp.json().get("solicitud", {}).get("id")
    print(f"✓ Solicitud {solicitud_id} creada")

    # 3. Enviar solicitud
    print("\n[3] Enviando solicitud...")
    resp = requests.put(
        f"{BASE_URL}/solicitudes/{solicitud_id}/enviar",
        json={},
        headers={"Authorization": f"Bearer {token_solicitante}"}
    )

    if resp.status_code not in [200, 201]:
        print(f"❌ Error enviar solicitud: {resp.status_code}")
        return False

    print(f"✓ Solicitud enviada (status: {resp.status_code})")

    # 4. Obtener solicitud y aprobador asignado
    print("\n[4] Obteniendo aprobador asignado...")
    resp = requests.get(
        f"{BASE_URL}/solicitudes/{solicitud_id}",
        headers={"Authorization": f"Bearer {token_solicitante}"}
    )

    solicitud = resp.json().get("solicitud", {})
    aprobador_id = solicitud.get("aprobador_id")
    print(f"✓ Aprobador asignado: {aprobador_id}")

    # 5. Obtener email del aprobador desde BD
    print("\n[5] Obteniendo email del aprobador...")
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT mail FROM usuario WHERE id_spm = ?", (str(aprobador_id),))
        row = cur.fetchone()
        if row:
            email_aprobador = row["mail"] if isinstance(row, dict) else row[0]
            print(f"✓ Email del aprobador: {email_aprobador}")
        else:
            print(f"❌ No encontrado usuario {aprobador_id} en BD")
            return False

    # 6. Login como aprobador
    print("\n[6] Autenticando como aprobador...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": email_aprobador,
        "password": "password123"
    })

    if resp.status_code != 200:
        print(f"❌ Error login: {resp.status_code} - {resp.text}")
        return False

    token_aprobador = resp.json().get("access_token")
    print(f"✓ Aprobador autenticado")

    # ============ TEST 5: APROBAR ============
    print("\n" + "-"*60)
    print("TEST 5: Aprobar solicitud")
    print("-"*60)

    resp = requests.post(
        f"{BASE_URL}/solicitudes/{solicitud_id}/aprobar",
        json={"motivo": "Aprobada"},
        headers={"Authorization": f"Bearer {token_aprobador}"}
    )

    if resp.status_code in [200, 201]:
        print(f"✅ TEST 5 PASS - Solicitud aprobada")
        estado = resp.json().get("solicitud", {}).get("status")
        print(f"   Estado: {estado}")
    else:
        error = resp.json().get("error", {}).get("message", "Error desconocido")
        print(f"❌ TEST 5 FAIL - {error}")
        print(f"   Status: {resp.status_code}")
        return False

    # ============ TEST 6: RECHAZAR ============
    print("\n" + "-"*60)
    print("TEST 6: Rechazar solicitud")
    print("-"*60)

    # Crear nueva solicitud
    resp = requests.post(f"{BASE_URL}/solicitudes", json={
        "centro": "AA101",
        "sector": "Almacenes",
        "descripcion": "Test 2",
        "items": [{
            "material_id": "0111-0000229",
            "cantidad": 1,
            "unidad": "UN",
            "precio_unitario": 100.00
        }]
    }, headers={"Authorization": f"Bearer {token_solicitante}"})

    solicitud_id_2 = resp.json().get("solicitud", {}).get("id")

    # Enviar
    requests.put(
        f"{BASE_URL}/solicitudes/{solicitud_id_2}/enviar",
        json={},
        headers={"Authorization": f"Bearer {token_solicitante}"}
    )

    # Obtener aprobador
    resp = requests.get(
        f"{BASE_URL}/solicitudes/{solicitud_id_2}",
        headers={"Authorization": f"Bearer {token_solicitante}"}
    )
    aprobador_id_2 = resp.json().get("solicitud", {}).get("aprobador_id")

    # Obtener email y login
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT mail FROM usuario WHERE id_spm = ?", (str(aprobador_id_2),))
        row = cur.fetchone()
        email_aprobador_2 = row["mail"] if isinstance(row, dict) else row[0]

    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": email_aprobador_2,
        "password": "password123"
    })
    token_aprobador_2 = resp.json().get("access_token")

    # Rechazar
    resp = requests.post(
        f"{BASE_URL}/solicitudes/{solicitud_id_2}/rechazar",
        json={"motivo": "Fondos insuficientes"},
        headers={"Authorization": f"Bearer {token_aprobador_2}"}
    )

    if resp.status_code in [200, 201]:
        print(f"✅ TEST 6 PASS - Solicitud rechazada")
        estado = resp.json().get("solicitud", {}).get("status")
        print(f"   Estado: {estado}")
    else:
        error = resp.json().get("error", {}).get("message", "Error desconocido")
        print(f"❌ TEST 6 FAIL - {error}")
        print(f"   Status: {resp.status_code}")
        return False

    # ============ TEST 7: REENVIAR ============
    print("\n" + "-"*60)
    print("TEST 7: Reenviar solicitud")
    print("-"*60)

    # Reenviar como solicitante
    resp = requests.put(
        f"{BASE_URL}/solicitudes/{solicitud_id_2}/reenviar",
        json={},
        headers={"Authorization": f"Bearer {token_solicitante}"}
    )

    if resp.status_code in [200, 201]:
        print(f"✅ TEST 7 PASS - Solicitud reenviada")
        estado = resp.json().get("solicitud", {}).get("status")
        print(f"   Estado: {estado}")
    else:
        error = resp.json().get("error", {}).get("message", "Error desconocido")
        print(f"❌ TEST 7 FAIL - {error}")
        print(f"   Status: {resp.status_code}")
        return False

    # Resumen
    print("\n" + "="*60)
    print("✅ TODOS LOS TESTS PASARON")
    print("="*60)

    return True

if __name__ == "__main__":
    try:
        success = test_fase3_5_7()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
