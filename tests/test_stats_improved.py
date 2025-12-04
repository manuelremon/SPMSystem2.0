#!/usr/bin/env python3
"""Script para probar el endpoint /api/auth/dashboard/stats con manejo correcto de cookies"""

import requests

print("=" * 70)
print("PROBANDO ENDPOINT CON MANEJO CORRECTO DE COOKIES/HEADERS")
print("=" * 70)

BASE_URL = "http://127.0.0.1:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
STATS_URL = f"{BASE_URL}/api/auth/dashboard/stats"
CHART_URL = f"{BASE_URL}/api/auth/dashboard/chart-data"

LOGIN_DATA = {"username": "2", "password": "a1"}

session = requests.Session()

# PASO 1: Login
print("\n1. INTENTANDO LOGIN")
print("-" * 70)
try:
    response = session.post(LOGIN_URL, json=LOGIN_DATA)
    print(f"   Status: {response.status_code}")
    print(f"   Cookies después de login: {dict(session.cookies)}")

    if response.status_code == 200:
        login_data = response.json()
        print("   ✓ Login exitoso")

        # Extraer token de la cookie
        token = session.cookies.get("access_token")
        if token:
            print(f"   Token en cookie: {token[:30]}...")

            # PASO 2: Intentar acceder con session (debería tener cookie)
            print("\n2. CONSULTANDO CON SESSION (usando cookies)")
            print("-" * 70)
            stats_response = session.get(STATS_URL)
            print(f"   Status: {stats_response.status_code}")

            if stats_response.status_code == 200:
                stats_data = stats_response.json()
                print("   ✓ Stats obtenidos")
                if "stats" in stats_data:
                    stats = stats_data["stats"]
                    print(f"   Pendientes: {stats.get('pending', 0)}")
                    print(f"   Aprobadas: {stats.get('approved', 0)}")
            else:
                print(f"   ✗ Error: {stats_response.json()}")

            # PASO 3: Intentar acceder con Bearer token explícito
            print("\n3. CONSULTANDO CON BEARER TOKEN EN HEADER")
            print("-" * 70)
            headers = {"Authorization": f"Bearer {token}"}
            stats_response = requests.get(STATS_URL, headers=headers)
            print(f"   Status: {stats_response.status_code}")

            if stats_response.status_code == 200:
                stats_data = stats_response.json()
                print("   ✓ Stats obtenidos CON BEARER TOKEN")
                if "stats" in stats_data:
                    stats = stats_data["stats"]
                    print(f"   Pendientes: {stats.get('pending', 0)}")
                    print(f"   Aprobadas: {stats.get('approved', 0)}")
                if "activity" in stats_data:
                    print(f"   Actividades: {len(stats_data.get('activity', []))} items")
                if "chart_data" in stats_data:
                    chart = stats_data["chart_data"]
                    print(f"   Gráficos - Estados: {len(chart.get('states', []))}")
            else:
                print(f"   ✗ Error: {stats_response.json()}")
        else:
            print("   ✗ No se encontró token en la cookie")
    else:
        print(f"   ✗ Error: {response.json()}")

except Exception as e:
    print(f"   ✗ Error: {e}")
    import traceback

    traceback.print_exc()

print("\n" + "=" * 70)
print("PRUEBA COMPLETADA")
print("=" * 70)
