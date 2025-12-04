#!/usr/bin/env python3
"""Script para probar el endpoint /api/auth/dashboard/stats"""

import requests

# Primero, hacer login para obtener token
print("=" * 70)
print("PROBANDO ENDPOINT /api/auth/dashboard/stats")
print("=" * 70)

LOGIN_URL = "http://127.0.0.1:5000/api/auth/login"
STATS_URL = "http://127.0.0.1:5000/api/auth/dashboard/stats"
CHART_URL = "http://127.0.0.1:5000/api/auth/dashboard/chart-data"

# Credenciales de prueba (usuario de la BD)
# Todos los usuarios tienen contraseña "a1"
LOGIN_DATA = {
    "username": "2",  # id_spm del usuario Juan Levi
    "password": "a1",
}

print(f"\n1. INTENTANDO LOGIN como '{LOGIN_DATA['username']}'")
print("-" * 70)

session = requests.Session()
try:
    response = session.post(LOGIN_URL, json=LOGIN_DATA)
    print(f"   Status: {response.status_code}")

    if response.status_code == 200:
        login_data = response.json()
        print("   ✓ Login exitoso")
        print(f"   Token: {login_data.get('access_token', 'N/A')[:30]}...")

        # Ahora traer stats
        print("\n2. CONSULTANDO /api/auth/dashboard/stats")
        print("-" * 70)

        stats_response = session.get(STATS_URL)
        print(f"   Status: {stats_response.status_code}")

        if stats_response.status_code == 200:
            stats_data = stats_response.json()
            print("   ✓ Stats obtenidos")

            if "stats" in stats_data:
                stats = stats_data["stats"]
                print("\n   Estadísticas del usuario:")
                print(f"     - Solicitudes pendientes: {stats.get('pending', 0)}")
                print(f"     - Solicitudes aprobadas: {stats.get('approved', 0)}")
                print(f"     - Solicitudes en proceso: {stats.get('in_process', 0)}")
                print(f"     - Solicitudes rechazadas: {stats.get('rejected', 0)}")
                print(f"     - Total de materiales: {stats.get('total_materials', 0)}")
                print(f"     - Tasa de aprobación: {stats.get('approval_rate', 0)}%")

            if "activity" in stats_data:
                activity = stats_data["activity"]
                print(f"\n   Últimas actividades ({len(activity)} items):")
                for item in activity[:3]:
                    print(f"     - ID {item.get('id')}: {item.get('title', 'N/A')[:40]}")

            if "chart_data" in stats_data:
                chart = stats_data["chart_data"]
                print("\n   Datos de gráficos:")
                print(f"     - Estados: {len(chart.get('states', []))} encontrados")
                print(f"     - Tendencia: {len(chart.get('trend', []))} días")
                print(f"     - Centros: {len(chart.get('centers', []))} encontrados")
        else:
            print(f"   ✗ Error: {stats_response.text}")

        # Ahora traer chart data
        print("\n3. CONSULTANDO /api/auth/dashboard/chart-data")
        print("-" * 70)

        chart_response = session.get(CHART_URL)
        print(f"   Status: {chart_response.status_code}")

        if chart_response.status_code == 200:
            chart_data = chart_response.json()
            print("   ✓ Chart data obtenidos")

            if "data" in chart_data:
                data = chart_data["data"]
                if "states" in data:
                    print("\n   Distribución por estado:")
                    for state in data["states"]:
                        print(f"     - {state.get('name', 'N/A')}: {state.get('count', 0)}")

                if "centers" in data:
                    print("\n   Top 5 centros:")
                    for center in data["centers"][:5]:
                        print(f"     - {center.get('name', 'N/A')}: {center.get('count', 0)}")
        else:
            print(f"   ✗ Error: {chart_response.text}")

    else:
        print(f"   ✗ Error en login: {response.status_code}")
        print(f"   {response.text[:200]}")

except Exception as e:
    print(f"   ✗ Error de conexión: {e}")
    import traceback

    traceback.print_exc()

print("\n" + "=" * 70)
print("PRUEBA COMPLETADA")
print("=" * 70)
