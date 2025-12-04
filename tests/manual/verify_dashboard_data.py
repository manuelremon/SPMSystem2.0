#!/usr/bin/env python3
"""
Script para hacer login automático y capturar la respuesta del dashboard
"""

import requests

print("=" * 80)
print("VERIFICANDO DASHBOARD CON DATOS REALES")
print("=" * 80)

BASE_URL = "http://127.0.0.1:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
STATS_URL = f"{BASE_URL}/api/auth/dashboard/stats"
CHART_URL = f"{BASE_URL}/api/auth/dashboard/chart-data"

# Intentar con diferentes usuarios de la BD
test_users = [
    {"id_spm": "2", "nombre": "Juan Levi", "password": "Pass1234!"},
    {"id_spm": "3", "nombre": "Pedro Mamani", "password": "Pass1234!"},
    {"id_spm": "4", "nombre": "Roberto Rosas", "password": "Pass1234!"},
    {"id_spm": "1", "nombre": "Usuario 1", "password": "Pass1234!"},
]

session = requests.Session()
logged_in = False

for user in test_users:
    print(f"\n{'─' * 80}")
    print(f"Intentando login con usuario ID: {user['id_spm']} ({user['nombre']})")
    print(f"{'─' * 80}")

    try:
        # Intentar login
        login_response = session.post(
            LOGIN_URL, json={"username": user["id_spm"], "password": user["password"]}, timeout=5
        )

        if login_response.status_code == 200:
            print("✓ LOGIN EXITOSO")
            logged_in = True
            user_id = user["id_spm"]
            break
        else:
            print(f"✗ Login falló: {login_response.status_code}")
            if login_response.text:
                print(f"  Respuesta: {login_response.text[:100]}")
    except Exception as e:
        print(f"✗ Error de conexión: {e}")
        continue

if not logged_in:
    print("\n" + "=" * 80)
    print("✗ NO SE PUDO HACER LOGIN CON NINGÚN USUARIO")
    print("=" * 80)
    exit(1)

print(f"\n{'─' * 80}")
print(f"CONSULTANDO ENDPOINTS CON USUARIO: {user_id}")
print(f"{'─' * 80}")

# 1. Obtener stats
print(f"\n1. GET {STATS_URL}")
print(f"{'─' * 80}")

try:
    stats_response = session.get(STATS_URL, timeout=5)
    print(f"Status: {stats_response.status_code}")

    if stats_response.status_code == 200:
        data = stats_response.json()
        print("\n✓ DATOS DEL DASHBOARD:")

        if "stats" in data:
            stats = data["stats"]
            print("\n📊 ESTADÍSTICAS:")
            print(f"   Solicitudes pendientes: {stats.get('pending', 0)}")
            print(f"   Solicitudes aprobadas: {stats.get('approved', 0)}")
            print(f"   Solicitudes en proceso: {stats.get('in_process', 0)}")
            print(f"   Solicitudes rechazadas: {stats.get('rejected', 0)}")
            print(f"   Total materiales: {stats.get('total_materials', 0):,}")
            print(f"   Tasa de aprobación: {stats.get('approval_rate', 0)}%")

        if "activity" in data:
            activity = data["activity"]
            print(f"\n📝 ACTIVIDADES RECIENTES ({len(activity)} items):")
            for i, item in enumerate(activity[:5], 1):
                print(f"   {i}. ID: {item.get('id')}, Status: {item.get('status', 'N/A')}")
                print(f"      Título: {item.get('title', 'N/A')[:50]}")
                print(f"      Fecha: {item.get('date', 'N/A')[:10]}")

        if "chart_data" in data:
            chart = data["chart_data"]
            print("\n📈 DATOS DE GRÁFICOS:")

            if "states" in chart:
                print(f"   Estados ({len(chart['states'])} encontrados):")
                for state in chart["states"]:
                    print(f"     - {state.get('name', 'N/A')}: {state.get('count', 0)}")

            if "centers" in chart:
                print("\n   Centros Top 5:")
                for center in chart["centers"][:5]:
                    print(f"     - {center.get('name', 'N/A')}: {center.get('count', 0)}")
    else:
        print(f"✗ Error: {stats_response.status_code}")
        print(f"Response: {stats_response.text[:300]}")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback

    traceback.print_exc()

# 2. Obtener chart data
print(f"\n{'─' * 80}")
print(f"2. GET {CHART_URL}")
print(f"{'─' * 80}")

try:
    chart_response = session.get(CHART_URL, timeout=5)
    print(f"Status: {chart_response.status_code}")

    if chart_response.status_code == 200:
        data = chart_response.json()
        print("✓ Chart data recibido correctamente")
    else:
        print(f"✗ Error: {chart_response.status_code}")

except Exception as e:
    print(f"✗ Error: {e}")

print(f"\n{'=' * 80}")
print("VERIFICACIÓN COMPLETADA")
print(f"{'=' * 80}")
