#!/usr/bin/env python3
"""
Script de validación rápida de HTML convertidos
Verifica que cada página tenga la estructura correcta
"""

import os


def check_html_file(filepath):
    """Valida un archivo HTML convertido"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return False, f"Error leyendo archivo: {e}"

    checks = {
        "DOCTYPE": "<!DOCTYPE html>" in content,
        "HTML lang": 'lang="es"' in content,
        "Meta charset": "charset=" in content,
        "Navbar header": '<header class="app-header"' in content,
        "App logo": 'class="app-logo"' in content,
        "Main container": '<div class="main-container">' in content,
        "App.js script": 'src="/app.js"' in content,
        "No fetch navbar": "fetch('/components/navbar.html')" not in content,
    }

    passed = sum(1 for v in checks.values() if v)
    total = len(checks)

    results = []
    for check, status in checks.items():
        symbol = "✅" if status else "❌"
        results.append(f"  {symbol} {check}")

    return passed == total, f"{filepath}: {passed}/{total}\n" + "\n".join(results)


# Archivos a verificar
files = [
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\dashboard.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\mis-solicitudes.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\crear-solicitud.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\materiales.html",
    "d:\\GitHub\\SPMv1.0\\src\\frontend\\admin-dashboard.html",
]

print("=" * 70)
print("🔍 VALIDACIÓN DE ARCHIVOS HTML CONVERTIDOS")
print("=" * 70)

all_pass = True
for filepath in files:
    if not os.path.exists(filepath):
        print(f"\n❌ ARCHIVO NO EXISTE: {filepath}")
        all_pass = False
        continue

    passed, result = check_html_file(filepath)
    print(f"\n{result}")
    if not passed:
        all_pass = False

print("\n" + "=" * 70)
if all_pass:
    print("✅ TODAS LAS VALIDACIONES PASARON")
else:
    print("⚠️  ALGUNOS ARCHIVOS NECESITAN REVISIÓN")
print("=" * 70)
