#!/usr/bin/env python3
"""
Script de validación de enlaces en HTML
Verifica que los links internos sean válidos
"""

import re
from pathlib import Path


def extract_links(content):
    """Extrae todos los links href/src de un archivo HTML"""
    # Buscar href y src
    href_pattern = r'href=["\']([^"\']+)["\']'
    src_pattern = r'src=["\']([^"\']+)["\']'

    hrefs = re.findall(href_pattern, content)
    srcs = re.findall(src_pattern, content)

    return {"hrefs": hrefs, "srcs": srcs}


def check_links(filepath):
    """Valida los links en un archivo HTML"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return None, f"Error: {e}"

    links = extract_links(content)

    # Validar que no haya links .html (deben ser rutas limpias)
    invalid_hrefs = [h for h in links["hrefs"] if h.endswith(".html") and not h.startswith("http")]

    # Validar que los scripts sean /app.js
    valid_scripts = all(s.startswith("/") or s.startswith("http") for s in links["srcs"])

    return {
        "file": Path(filepath).name,
        "total_hrefs": len(links["hrefs"]),
        "total_srcs": len(links["srcs"]),
        "invalid_hrefs": invalid_hrefs,
        "all_scripts_absolute": valid_scripts,
        "hrefs": links["hrefs"],
        "srcs": links["srcs"],
    }


# Archivos a verificar
files = [
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\dashboard.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\mis-solicitudes.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\crear-solicitud.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\materiales.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\admin-dashboard.html",
]

print("=" * 70)
print("🔗 VALIDACIÓN DE ENLACES HTML")
print("=" * 70)

all_pass = True
for filepath in files:
    result = check_links(filepath)

    if result is None:
        print(f"\n❌ {filepath}")
        all_pass = False
        continue

    print(f"\n📄 {result['file']}")
    print(f"   Links <a>: {result['total_hrefs']} | Scripts <script>: {result['total_srcs']}")

    if result["invalid_hrefs"]:
        print("   ❌ Links .html encontrados (deben ser rutas limpias):")
        for href in result["invalid_hrefs"]:
            print(f"      - {href}")
        all_pass = False
    else:
        print("   ✅ Todos los href son rutas limpias (no .html)")

    if not result["all_scripts_absolute"]:
        print("   ❌ Scripts no son rutas absolutas")
        all_pass = False
    else:
        print("   ✅ Todos los scripts son rutas absolutas")

    # Mostrar muestra de enlaces
    print("   📍 Muestra de enlaces:")
    for href in result["hrefs"][:3]:
        print(f"      → {href}")

print("\n" + "=" * 70)
if all_pass:
    print("✅ VALIDACIÓN DE ENLACES COMPLETADA SIN ERRORES")
else:
    print("⚠️  ALGUNOS ENLACES NECESITAN REVISIÓN")
print("=" * 70)
