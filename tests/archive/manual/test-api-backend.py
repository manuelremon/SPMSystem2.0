#!/usr/bin/env python3
"""
Testing API/Backend Integration - Phase 3
Verifica que las llamadas /api funcionan desde las páginas convertidas
"""

import json
import urllib.error
import urllib.request

BASE_URL = "http://localhost:5000"

# Endpoints API a testear
API_ENDPOINTS = {
    "health": "/api/health",
    "system_status": "/api/system/status",
    "solicitudes": "/api/solicitudes",
}


def test_api_endpoint(name, endpoint):
    """Prueba un endpoint de la API"""
    try:
        url = f"{BASE_URL}{endpoint}"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = response.read().decode("utf-8")
            status = response.status

            # Intentar parsear JSON
            try:
                json_data = json.loads(data)
                return True, status, "JSON válido", json_data
            except:
                return True, status, f"Respuesta: {data[:100]}", None

    except urllib.error.HTTPError as e:
        return False, e.code, str(e), None
    except urllib.error.URLError as e:
        return False, "CONEXION", f"No se puede conectar: {str(e)[:50]}", None
    except Exception as e:
        return False, "ERROR", str(e)[:50], None


def main():
    print("\n" + "=" * 70)
    print("TESTING API/BACKEND INTEGRATION - PHASE 3".center(70))
    print("=" * 70 + "\n")

    # Verificar conectividad
    print("1. Verificando conectividad con Flask en puerto 5000...")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/", timeout=5) as response:
            print("   ✓ Servidor Flask respondiendo\n")
    except Exception as e:
        print("   ✗ No se puede conectar a Flask")
        print(f"   Error: {str(e)[:60]}")
        print("   Asegúrate que está corriendo: python run_backend.py\n")
        return 1

    # Testear endpoints
    print("2. Testando endpoints de API...")
    print(f"   {'Endpoint':<25} {'Status':<10} {'Resultado':<40}")
    print(f"   {'-' * 25} {'-' * 10} {'-' * 40}")

    passed = 0
    failed = 0

    for name, endpoint in API_ENDPOINTS.items():
        success, status, msg, data = test_api_endpoint(name, endpoint)

        status_str = str(status) if status else "ERROR"

        if success:
            print(f"   {endpoint:<25} {status_str:<10} ✓ OK")
            passed += 1
        else:
            print(f"   {endpoint:<25} {status_str:<10} ✗ {msg[:30]}")
            failed += 1

    print(f"\n   Resultado: {passed}/{len(API_ENDPOINTS)} endpoints OK\n")

    # Resumen
    print("=" * 70)
    print("RESUMEN".center(70))
    print("=" * 70)

    if failed == 0:
        print("\n✓ TODOS LOS ENDPOINTS ESTÁN ACCESIBLES\n")
        print("Próximos pasos:")
        print("  1. Testear desde navegador (abrir DevTools)")
        print("  2. Verificar Network tab para ver llamadas /api")
        print("  3. Revisar Response headers y datos")
        print("  4. Validar autenticación (tokens, cookies)")
        return 0
    else:
        print(f"\n✗ {failed} ENDPOINTS CON PROBLEMAS\n")
        return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
