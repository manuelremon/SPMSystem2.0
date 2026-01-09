#!/usr/bin/env python3
"""
Testing simple de rutas Vite - verifica accesibilidad básica (sin requests)
"""

import urllib.error
import urllib.request
from urllib.parse import urljoin

BASE_URL = "http://127.0.0.1:8080"

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
            with urllib.request.urlopen(url, timeout=5) as response:
                content_type = response.headers.get("content-type", "").lower()
                html_content = response.read().decode("utf-8")

                # Verificar estructura
                is_html = "text/html" in content_type
                has_navbar = "app-header" in html_content
                has_content = len(html_content) > 500

                if is_html and has_navbar and has_content:
                    print(f"  ✓ {route:<30} 200 OK")
                    passed += 1
                else:
                    print(
                        f"  ✗ {route:<30} Incompleto (HTML:{is_html} Navbar:{has_navbar} Content:{has_content})"
                    )
                    failed += 1
        except urllib.error.URLError as e:
            print(f"  ✗ {route:<30} NO CONECTA: {str(e)[:35]}")
            failed += 1
        except Exception as e:
            print(f"  ✗ {route:<30} ERROR: {str(e)[:35]}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Resultado: {passed}/{len(ROUTES)} rutas OK")
    print(f"{'=' * 60}\n")

    if passed == len(ROUTES):
        print("✓ TODAS LAS RUTAS ACCESIBLES")
        print("\nPróximos pasos:")
        print("  1. Abre http://localhost:5173/dashboard")
        print("  2. Verifica navbar y navegación")
        print("  3. Prueba enlaces internos")
        print("  4. Abre consola (F12) y revisa errores")
        return 0
    else:
        print(f"✗ {failed} rutas inaccesibles - verifica que Vite está corriendo")
        return 1


if __name__ == "__main__":
    import sys

    sys.exit(test_routes())
