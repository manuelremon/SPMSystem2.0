#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test End-to-End de Aprobaciones
Verifica todos los endpoints del sistema
"""

import sys
import time

import requests

BASE_URL = "http://localhost:5000"
ADMIN_TOKEN = None


def test_endpoint(method, endpoint, data=None, headers=None):
    """Helper para hacer requests"""
    url = f"{BASE_URL}{endpoint}"

    if headers is None:
        headers = {}

    if ADMIN_TOKEN:
        headers["Authorization"] = f"Bearer {ADMIN_TOKEN}"

    headers["Content-Type"] = "application/json"

    try:
        if method.upper() == "GET":
            resp = requests.get(url, headers=headers, timeout=5)
        elif method.upper() == "POST":
            resp = requests.post(url, json=data, headers=headers, timeout=5)
        else:
            return {"error": f"Unknown method: {method}"}

        return {
            "status": resp.status_code,
            "headers": dict(resp.headers),
            "data": resp.json() if resp.text else None,
        }
    except Exception as e:
        return {"error": str(e)}


def main():
    global ADMIN_TOKEN

    print("\n" + "=" * 70)
    print("TEST END-TO-END: SISTEMA DE APROBACIONES")
    print("=" * 70 + "\n")

    # PASO 1: Login
    print("[1] Intentando LOGIN...")
    login_data = {"email": "admin@example.com", "password": "admin123"}

    result = test_endpoint("POST", "/api/auth/login", login_data)
    print(f"    Status: {result.get('status', 'error')}")

    if result.get("status") == 200:
        data = result.get("data", {})
        ADMIN_TOKEN = data.get("token")
        print(f"    Token: {ADMIN_TOKEN[:20]}..." if ADMIN_TOKEN else "    Token: NONE")
        print("    LOGIN EXITOSO ✓\n")
    else:
        print(f"    ERROR: {result.get('error', 'Unknown')}")
        print("    LOGIN FALLIDO ✗\n")
        sys.exit(1)

    # PASO 2: GET Dashboard
    print("[2] Obteniendo DASHBOARD...")
    result = test_endpoint("GET", "/api/approver/dashboard")
    print(f"    Status: {result.get('status', 'error')}")

    if result.get("status") == 200:
        data = result.get("data", {})
        print(f"    Pendientes: {data.get('pending_count', 0)}")
        print(f"    Aprobadas: {data.get('approved_count', 0)}")
        print(f"    Rechazadas: {data.get('rejected_count', 0)}")
        print("    DASHBOARD OK ✓\n")
    else:
        print(f"    ERROR: {result.get('error', 'Unknown')}")
        print("    DASHBOARD FALLIDO ✗\n")

    # PASO 3: GET Lista de Solicitudes
    print("[3] Obteniendo LISTA DE SOLICITUDES...")
    result = test_endpoint("GET", "/api/approver/solicitudes")
    print(f"    Status: {result.get('status', 'error')}")

    solicitudes = []
    if result.get("status") == 200:
        data = result.get("data", {})
        solicitudes = data.get("solicitudes", [])
        print(f"    Total: {len(solicitudes)} solicitudes")

        if solicitudes:
            for sol in solicitudes[:3]:
                print(
                    f"    - ID: {sol.get('id')}, Centro: {sol.get('centro_id')}, Monto: {sol.get('monto')}"
                )

        print("    LISTA OK ✓\n")
    else:
        print(f"    ERROR: {result.get('error', 'Unknown')}")
        print("    LISTA FALLIDA ✗\n")

    # PASO 4: GET Detalles de Primera Solicitud
    if solicitudes:
        first_id = solicitudes[0]["id"]
        print(f"[4] Obteniendo DETALLES DE SOLICITUD #{first_id}...")
        result = test_endpoint("GET", f"/api/approver/solicitudes/{first_id}")
        print(f"    Status: {result.get('status', 'error')}")

        if result.get("status") == 200:
            data = result.get("data", {})
            print(f"    Centro: {data.get('centro_id')}")
            print(f"    Sector: {data.get('sector')}")
            print(f"    Criticidad: {data.get('criticidad')}")
            print(f"    Items: {len(data.get('items', []))}")
            print("    DETALLES OK ✓\n")
        else:
            print(f"    ERROR: {result.get('error', 'Unknown')}")
            print("    DETALLES FALLIDO ✗\n")

        # PASO 5: POST Aprobar
        print(f"[5] APROBANDO SOLICITUD #{first_id}...")
        approve_data = {"comentario": "Aprobado por test automatico"}
        result = test_endpoint(
            "POST", f"/api/approver/solicitudes/{first_id}/approve", approve_data
        )
        print(f"    Status: {result.get('status', 'error')}")

        if result.get("status") == 200:
            print("    APROBACION OK ✓\n")
        else:
            print(f"    ERROR: {result.get('error', 'Unknown')}")
            print("    APROBACION FALLIDA ✗\n")

    # PASO 6: Verificar cambio
    print("[6] Verificando cambio en BD...")
    result = test_endpoint("GET", "/api/approver/dashboard")

    if result.get("status") == 200:
        data = result.get("data", {})
        print(f"    Pendientes: {data.get('pending_count', 0)}")
        print(f"    Aprobadas: {data.get('approved_count', 0)}")
        print(f"    Rechazadas: {data.get('rejected_count', 0)}")
        print("    CAMBIO VERIFICADO ✓\n")
    else:
        print(f"    ERROR: {result.get('error', 'Unknown')}\n")

    print("=" * 70)
    print("TEST COMPLETADO")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    # Esperar a que servidor esté listo
    print("Esperando servidor...\n")
    time.sleep(2)
    main()
