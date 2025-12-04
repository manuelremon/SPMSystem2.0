#!/usr/bin/env python3
"""
Testing Navegacional Automatizado - SPM v1.0
Valida que las paginas convertidas cargan correctamente
"""

import re
import sys
from pathlib import Path

# URLs a testear
PAGES = {
    "dashboard": "/dashboard",
    "mis-solicitudes": "/mis-solicitudes",
    "crear-solicitud": "/crear-solicitud",
    "materiales": "/materiales",
    "admin": "/admin",
}


def print_header(text):
    """Imprime encabezado"""
    print(f"\n{'=' * 60}")
    print(f"{text:^60}")
    print(f"{'=' * 60}\n")


def print_success(text):
    print(f"[OK] {text}")


def print_error(text):
    print(f"[ERROR] {text}")


def print_info(text):
    print(f"[INFO] {text}")


def check_html_structure(page_name, page_path):
    """Verifica la estructura HTML de una pagina"""
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
    """Extrae todos los enlaces de una pagina"""
    file_path = Path(f"d:\\GitHub\\SPMv1.0\\src\\frontend{page_path}.html")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        href_pattern = r'href=["\']([^"\']*)["\']'
        src_pattern = r'src=["\']([^"\']*)["\']'

        hrefs = re.findall(href_pattern, content)
        srcs = re.findall(src_pattern, content)

        return hrefs + srcs
    except:
        return []


def validate_links(page_name, page_path):
    """Valida que los enlaces no tengan .html"""
    print_info(f"Validando enlaces en {page_name}...")

    links = extract_links(page_path)

    if not links:
        print("[WARNING] No se encontraron enlaces")
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
    """Funcion principal"""
    print_header("TESTING NAVEGACIONAL AUTOMATIZADO - SPM v1.0")

    # 1. Verificar estructura HTML
    print_header("Fase 1: Validar Estructura HTML")
    html_results = {}
    for page_name, page_path in PAGES.items():
        print(f"\n{page_name.upper()}")
        result = check_html_structure(page_name, page_path)
        html_results[page_name] = result

    # 2. Validar enlaces
    print_header("Fase 2: Validar Enlaces")
    link_results = {}
    for page_name, page_path in PAGES.items():
        print(f"\n{page_name.upper()}")
        result = validate_links(page_name, page_path)
        link_results[page_name] = result

    # 3. Resumen
    print_header("RESUMEN DE RESULTADOS")

    html_passed = sum(1 for v in html_results.values() if v)
    link_passed = sum(1 for v in link_results.values() if v)
    total_pages = len(PAGES)

    print(f"Estructura HTML:  {html_passed}/{total_pages} paginas OK")
    print(f"Enlaces limpios:  {link_passed}/{total_pages} paginas OK")

    all_passed = html_passed == total_pages and link_passed == total_pages

    if all_passed:
        print("\n[SUCCESS] TODOS LOS TESTS PASARON\n")
        print("Proximos pasos:")
        print("  1. Abre http://localhost:5173/dashboard en tu navegador")
        print("  2. Verifica que la navbar persiste")
        print("  3. Prueba los enlaces")
        print("  4. Abre la consola (F12) para verificar que no hay errores\n")
        return 0
    else:
        print("\n[FAILURE] ALGUNOS TESTS FALLARON\n")
        print("Revisa los errores arriba y corrige.\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
