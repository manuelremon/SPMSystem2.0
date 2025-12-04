#!/usr/bin/env python3
"""
Testing simple de rutas Vite - verifica accesibilidad básica
"""

from urllib.parse import urljoin

import requests

BASE_URL = "http://localhost:5173"

# Rutas críticas a testear
ROUTES = [
    "/dashboard",
    "/mi-cuenta",
    "/mis-solicitudes",
    "/crear-solicitud",
    "/materiales",
    "/admin",
]


def test_routes():
    print("\n" + "=" * 60)
    print("TESTING RUTAS VITE".center(60))
    print("=" * 60 + "\n")

    print("Testing accesibilidad de rutas...")
    passed = 0
    failed = 0

    for route in ROUTES:
        try:
            url = urljoin(BASE_URL, route)
            response = requests.get(url, timeout=5, allow_redirects=True)

            # Verificar que es HTML
            is_html = "text/html" in response.headers.get("content-type", "").lower()
            has_navbar = "app-header" in response.text
            has_content = len(response.text) > 500

            if response.status_code == 200 and is_html and has_navbar and has_content:
                print(f"  ✓ {route:<30} 200 OK (HTML + Navbar + Contenido)")
                passed += 1
            else:
                print(f"  ✗ {route:<30} 200 OK pero estructura incompleta")
                print(f"     - HTML: {is_html}, Navbar: {has_navbar}, Contenido: {has_content}")
                failed += 1
        except requests.exceptions.ConnectionError:
            print(f"  ✗ {route:<30} NO CONECTA - ¿Vite corriendo?")
            failed += 1
        except Exception as e:
            print(f"  ✗ {route:<30} ERROR: {str(e)[:40]}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Resultado: {passed}/{len(ROUTES)} rutas accesibles")
    print(f"{'=' * 60}\n")

    if passed == len(ROUTES):
        print("✓ TODAS LAS RUTAS FUNCIONAN CORRECTAMENTE")
        return 0
    else:
        print(f"✗ {failed} rutas con problemas")
        return 1


if __name__ == "__main__":
    import sys

    sys.exit(test_routes())
