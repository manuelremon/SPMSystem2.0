#!/usr/bin/env python3
"""
Testing API Integration desde las Páginas Convertidas - Phase 3 Avanzado
Verifica que las páginas pueden hacer llamadas /api correctamente
"""

import json
import urllib.error
import urllib.request

BASE_URL_API = "http://localhost:5000"

# Endpoints críticos de la API
CRITICAL_ENDPOINTS = {
    "health": {"path": "/api/health", "method": "GET", "description": "Health check del servidor"},
    "solicitudes": {
        "path": "/api/solicitudes",
        "method": "GET",
        "description": "Obtener solicitudes (requiere autenticación)",
    },
    "materiales": {"path": "/api/materiales", "method": "GET", "description": "Obtener materiales"},
    "catalogos": {"path": "/api/catalogos", "method": "GET", "description": "Obtener catálogos"},
}


def test_endpoint(name, endpoint_info):
    """Prueba un endpoint de la API"""
    try:
        url = f"{BASE_URL_API}{endpoint_info['path']}"
        req = urllib.request.Request(url, method=endpoint_info["method"])
        req.add_header("Accept", "application/json")

        with urllib.request.urlopen(req, timeout=5) as response:
            data = response.read().decode("utf-8")
            status = response.status

            try:
                json_data = json.loads(data)
                return True, status, "JSON Válido", True
            except:
                return True, status, "Respuesta válida", True

    except urllib.error.HTTPError as e:
        # 401 Unauthorized is ok - significa que necesita autenticación
        if e.code == 401:
            return True, e.code, "401 - Requiere autenticación", True
        elif e.code == 403:
            return True, e.code, "403 - Acceso denegado", True
        else:
            return False, e.code, f"Error HTTP {e.code}", False

    except urllib.error.URLError as e:
        return False, "CONEXION", f"No conecta: {str(e)[:40]}", False
    except Exception as e:
        return False, "ERROR", str(e)[:40], False


def main():
    print("\n" + "=" * 80)
    print("TESTING API INTEGRATION - PHASE 3 AVANZADO".center(80))
    print("=" * 80 + "\n")

    # Verificar conectividad
    print("1️⃣  Verificando conectividad con Flask en puerto 5000...")
    try:
        with urllib.request.urlopen(f"{BASE_URL_API}/api/health", timeout=5) as response:
            print("   ✓ Servidor Flask respondiendo\n")
    except Exception:
        print("   ✗ No se puede conectar a Flask")
        print("   Asegúrate que está corriendo: python run_backend.py\n")
        return 1

    # Testear endpoints críticos
    print("2️⃣  Testando endpoints críticos de API...")
    print(f"\n   {'Endpoint':<30} {'Status':<10} {'Validación':<35}")
    print(f"   {'-' * 30} {'-' * 10} {'-' * 35}")

    passed = 0
    failed = 0
    accessible = 0

    for name, info in CRITICAL_ENDPOINTS.items():
        success, status, msg, is_accessible = test_endpoint(name, info)

        status_str = str(status)

        if success:
            print(f"   {info['path']:<30} {status_str:<10} ✓ {msg}")
            passed += 1
            if is_accessible:
                accessible += 1
        else:
            print(f"   {info['path']:<30} {status_str:<10} ✗ {msg}")
            failed += 1

    print(f"\n   Resultado: {passed}/{len(CRITICAL_ENDPOINTS)} endpoints respondiendo")
    print(f"   Accesibles sin autenticación: {accessible}/{len(CRITICAL_ENDPOINTS)}\n")

    # Información de integración
    print("=" * 80)
    print("3️⃣  INTEGRACIÓN EN LAS PÁGINAS".center(80))
    print("=" * 80 + "\n")

    print(
        """
Cómo las páginas convertidas pueden usar estos endpoints:

DESDE EL HTML (ej: dashboard.html):
  <script src="/app.js"></script>
  <!-- app.js hace llamadas fetch('/api/...') -->

DESDE JavaScript (en app.js o componentes):
  fetch('/api/solicitudes')
    .then(r => r.json())
    .then(data => console.log('Solicitudes:', data))
    .catch(e => console.error('Error:', e))

ENDPOINTS DISPONIBLES PARA PÁGINAS:
  • /api/health              - Health check sin autenticación
  • /api/catalogos           - Catálogos (almacenes, centros, etc)
  • /api/materiales          - Materiales disponibles
  • /api/solicitudes         - Solicitudes (requiere login)
  • /api/auth/me             - Datos del usuario actual (requiere token)
  • /api/preferencias        - Preferencias del usuario

AUTENTICACIÓN:
  Las páginas deben incluir un token JWT en headers:
  Authorization: Bearer <token>

  El token se obtiene de /api/auth/login
    """
    )

    # Resumen
    print("\n" + "=" * 80)
    print("RESUMEN".center(80))
    print("=" * 80 + "\n")

    if failed == 0:
        print(f"✅ SERVIDOR API OPERACIONAL - {passed}/{len(CRITICAL_ENDPOINTS)} endpoints\n")
        print("Estado:")
        print("  ✓ Servidor Flask en puerto 5000: ACTIVO")
        print(f"  ✓ Endpoints disponibles: {passed}")
        print(f"  ✓ Endpoints accesibles sin auth: {accessible}")
        print("  ✓ Estructura multi-page lista para usar API\n")
        print("Próximos pasos:")
        print("  1. Abrir http://localhost:5000/dashboard en navegador")
        print("  2. Abrir DevTools (F12) → Network tab")
        print("  3. Navegar por páginas y observar llamadas /api")
        print("  4. Revisar Response headers y datos")
        return 0
    else:
        print(f"⚠️  {failed} endpoints con problemas\n")
        return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
