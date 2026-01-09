#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test Simple de Aprobaciones - Sin caracteres especiales
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

        return {"status": resp.status_code, "data": resp.json() if resp.text else None}
    except Exception as e:
        return {"error": str(e)}


def main():
    global ADMIN_TOKEN

    print("\n" + "=" * 70)
    print("TEST: SISTEMA DE APROBACIONES")
    print("=" * 70 + "\n")

    # PASO 1: Login
    print("[1] LOGIN...")
    login_data = {"email": "admin@example.com", "password": "admin123"}

    result = test_endpoint("POST", "/api/auth/login", login_data)
    print(f"    Status: {result.get('status', 'ERROR')}")

    if result.get("status") == 200:
        data = result.get("data", {})
        ADMIN_TOKEN = data.get("token")
        user = data.get("usuario", {})
        print(f"    User: {user.get('nombre', 'N/A')}")
        print("    Token: OK [LOGIN SUCCESS]")
        print("")
    else:
        error = result.get("error", result.get("data", {}).get("message", "Unknown"))
        print(f"    ERROR: {error}")
        print("[LOGIN FAILED]\n")
        sys.exit(1)

    # PASO 2: GET Dashboard
    print("[2] GET DASHBOARD...")
    result = test_endpoint("GET", "/api/approver/dashboard")
    print(f"    Status: {result.get('status', 'ERROR')}")

    if result.get("status") == 200:
        data = result.get("data", {})
        pending = data.get("pending_count", 0)
        approved = data.get("approved_count", 0)
        rejected = data.get("rejected_count", 0)
        print(f"    Pending: {pending}")
        print(f"    Approved: {approved}")
        print(f"    Rejected: {rejected}")
        print("[DASHBOARD OK]")
        print("")
    else:
        error = result.get("error", "Unknown")
        print(f"    ERROR: {error}")
        print("[DASHBOARD FAILED]\n")

    # PASO 3: GET Lista de Solicitudes
    print("[3] GET SOLICITUDES...")
    result = test_endpoint("GET", "/api/approver/solicitudes")
    print(f"    Status: {result.get('status', 'ERROR')}")

    solicitudes = []
    if result.get("status") == 200:
        data = result.get("data", {})
        solicitudes = data.get("solicitudes", [])
        print(f"    Total: {len(solicitudes)}")

        if solicitudes:
            for sol in solicitudes[:3]:
                print(
                    f"      - ID: {sol.get('id')}, Centro: {sol.get('centro_id')}, Monto: {sol.get('monto')}"
                )

        print("[SOLICITUDES OK]")
        print("")
    else:
        error = result.get("error", "Unknown")
        print(f"    ERROR: {error}")
        print("[SOLICITUDES FAILED]\n")

    # PASO 4: GET Detalles
    if solicitudes:
        first_id = solicitudes[0]["id"]
        print(f"[4] GET DETALLES SOLICITUD #{first_id}...")
        result = test_endpoint("GET", f"/api/approver/solicitudes/{first_id}")
        print(f"    Status: {result.get('status', 'ERROR')}")

        if result.get("status") == 200:
            data = result.get("data", {})
            print(f"    Centro: {data.get('centro_id')}")
            print(f"    Sector: {data.get('sector')}")
            print(f"    Criticidad: {data.get('criticidad')}")
            print(f"    Items: {len(data.get('items', []))}")
            print("[DETALLES OK]")
            print("")
        else:
            error = result.get("error", "Unknown")
            print(f"    ERROR: {error}")
            print("[DETALLES FAILED]\n")

        # PASO 5: POST Aprobar
        print(f"[5] POST APROBAR SOLICITUD #{first_id}...")
        approve_data = {"comentario": "Aprobado por test automatico"}
        result = test_endpoint(
            "POST", f"/api/approver/solicitudes/{first_id}/approve", approve_data
        )
        print(f"    Status: {result.get('status', 'ERROR')}")

        if result.get("status") == 200:
            print("[APROBACION OK]")
            print("")
        else:
            error = result.get("error", result.get("data", {}).get("message", "Unknown"))
            print(f"    ERROR: {error}")
            print("[APROBACION FAILED]\n")

    # PASO 6: Verificar cambio
    print("[6] VERIFY CHANGES...")
    result = test_endpoint("GET", "/api/approver/dashboard")

    if result.get("status") == 200:
        data = result.get("data", {})
        print(f"    Pending: {data.get('pending_count', 0)}")
        print(f"    Approved: {data.get('approved_count', 0)}")
        print(f"    Rejected: {data.get('rejected_count', 0)}")
        print("[CHANGES VERIFIED OK]")
        print("")
    else:
        error = result.get("error", "Unknown")
        print(f"    ERROR: {error}\n")

    print("=" * 70)
    print("TEST COMPLETED")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    time.sleep(2)
    main()
