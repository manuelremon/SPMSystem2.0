#!/usr/bin/env python3
"""
🧪 Testing Navegacional Automatizado - SPM v1.0
Valida que las páginas convertidas cargan correctamente
y que la navegación funciona sin errores.
"""

import re
import sys
from pathlib import Path

# Colores para output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"

# URLs a testear
BASE_URL = "http://localhost:5173"
PAGES = {
    "dashboard": "/dashboard",
    "mis-solicitudes": "/mis-solicitudes",
    "crear-solicitud": "/crear-solicitud",
    "materiales": "/materiales",
    "admin": "/admin",
}


def print_header(text):
    """Imprime encabezado formateado"""
    print(f"\n{BOLD}{BLUE}{'=' * 60}{RESET}")
    print(f"{BOLD}{BLUE}{text:^60}{RESET}")
    print(f"{BOLD}{BLUE}{'=' * 60}{RESET}\n")


def print_success(text):
    """Imprime mensaje de éxito"""
    print(f"{GREEN}✓ {text}{RESET}")


def print_error(text):
    """Imprime mensaje de error"""
    print(f"{RED}✗ {text}{RESET}")


def print_warning(text):
    """Imprime mensaje de advertencia"""
    print(f"{YELLOW}⚠ {text}{RESET}")


def print_info(text):
    """Imprime mensaje informativo"""
    print(f"{BLUE}ℹ {text}{RESET}")


def check_server_running(url):
    """Verifica que el servidor está activo"""
    print_info(f"Verificando servidor en {url}...")
    try:
        import urllib.request

        urllib.request.urlopen(url, timeout=5)
        print_success("Servidor activo (HTTP 200)")
        return True
    except Exception as e:
        print_error(f"No se puede conectar al servidor: {e}")
        return False


def check_html_structure(page_name, page_path):
    """Verifica la estructura HTML de una página"""
    print_info(f"Verificando estructura HTML de {page_name}...")

    file_path = Path(f"d:\\GitHub\\SPMv1.0\\src\\frontend{page_path}.html")

    if not file_path.exists():
        print_error(f"Archivo no encontrado: {file_path}")
        return False

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        checks = {
            "DOCTYPE HTML5": bool(re.search(r"<!DOCTYPE html>", content, re.IGNORECASE)),
            "lang='es'": bool(re.search(r'lang=["\']es["\']', content)),
            "Navbar header": bool(re.search(r'<header[^>]*class=["\']app-header["\']', content)),
            "app.js cargado": bool(re.search(r'<script[^>]*src=["\']*/app\.js["\']', content)),
            "styles.css cargado": bool(
                re.search(r'<link[^>]*href=["\']*/styles\.css["\']', content)
            ),
            "Sin .html en href": not bool(re.search(r'href=["\'][^"\']*\.html["\']', content)),
            "Sin fetch navbar": not bool(
                re.search(r'fetch\(["\'].*navbar', content, re.IGNORECASE)
            ),
        }

        passed = sum(1 for v in checks.values() if v)
        total = len(checks)

        for check, result in checks.items():
            if result:
                print_success(f"{check}")
            else:
                print_error(f"{check}")

        print_info(f"Resultado: {passed}/{total} checks")
        return passed == total

    except Exception as e:
        print_error(f"Error al procesar {page_name}: {e}")
        return False


def extract_links(page_path):
    """Extrae todos los enlaces de una página"""
    file_path = Path(f"d:\\GitHub\\SPMv1.0\\src\\frontend{page_path}.html")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Busca href y src
        href_pattern = r'href=["\']([^"\']*)["\']'
        src_pattern = r'src=["\']([^"\']*)["\']'

        hrefs = re.findall(href_pattern, content)
        srcs = re.findall(src_pattern, content)

        return hrefs + srcs
    except:
        return []


def validate_links(page_name, page_path):
    """Valida que los enlaces no tengan .html y sean rutas limpias"""
    print_info(f"Validando enlaces en {page_name}...")

    links = extract_links(page_path)

    if not links:
        print_warning("No se encontraron enlaces")
        return True

    bad_links = []
    for link in links:
        if ".html" in link and not link.startswith("#"):
            bad_links.append(link)

    if bad_links:
        print_error(f"Encontrados {len(bad_links)} enlaces con .html:")
        for link in bad_links:
            print(f"  - {link}")
        return False
    else:
        print_success(f"Todos los enlaces son limpios ({len(links)} verificados)")
        return True


def main():
    """Función principal de testing"""
    print_header("🧪 TESTING NAVEGACIONAL AUTOMATIZADO - SPM v1.0")

    # 1. Verificar servidor
    print_header("Fase 1: Verificar Servidor")
    if not check_server_running(BASE_URL):
        print_error("Servidor no está disponible. Inicia con: npm run dev")
        sys.exit(1)

    # 2. Verificar estructura HTML
    print_header("Fase 2: Validar Estructura HTML")
    html_results = {}
    for page_name, page_path in PAGES.items():
        print(f"\n{BOLD}{page_name.upper()}{RESET}")
        result = check_html_structure(page_name, page_path)
        html_results[page_name] = result

    # 3. Validar enlaces
    print_header("Fase 3: Validar Enlaces")
    link_results = {}
    for page_name, page_path in PAGES.items():
        print(f"\n{BOLD}{page_name.upper()}{RESET}")
        result = validate_links(page_name, page_path)
        link_results[page_name] = result

    # 4. Resumen final
    print_header("📊 RESUMEN DE RESULTADOS")

    html_passed = sum(1 for v in html_results.values() if v)
    link_passed = sum(1 for v in link_results.values() if v)
    total_pages = len(PAGES)

    print(f"Estructura HTML:  {html_passed}/{total_pages} páginas ✓")
    print(f"Enlaces limpios:  {link_passed}/{total_pages} páginas ✓")

    all_passed = html_passed == total_pages and link_passed == total_pages

    if all_passed:
        print_success("\n🎉 TODOS LOS TESTS PASARON\n")
        print("Próximos pasos:")
        print(f"  1. Abre {BASE_URL}/dashboard en tu navegador")
        print("  2. Verifica que la navbar persiste")
        print("  3. Prueba los enlaces")
        print("  4. Abre la consola (F12) para verificar que no hay errores\n")
        return 0
    else:
        print_error("\n❌ ALGUNOS TESTS FALLARON\n")
        print("Revisa los errores arriba y corrige.\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
