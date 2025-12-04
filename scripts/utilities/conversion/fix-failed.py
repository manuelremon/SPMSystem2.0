#!/usr/bin/env python3
"""
Corrector de Páginas que Fallaron en Validación
"""

import re
from pathlib import Path

# Archivos que fallaron
FAILED_FILES = [
    "agregar-materiales.html",
    "mi-cuenta-page.html",
    "notificaciones-page.html",
    "preferencias-page.html",
]


def fix_file(file_path):
    """Corrige los problemas comunes en archivos HTML"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"[ERROR] {file_path.name}: {e}")
        return False

    # Corregir DOCTYPE a mayúscula
    content = re.sub(r"<!doctype\s+html>", "<!DOCTYPE html>", content, flags=re.IGNORECASE)

    # Corregir charset a UTF-8
    content = re.sub(r'charset=["\']utf-8["\']', 'charset="UTF-8"', content, flags=re.IGNORECASE)

    # Reemplazar rutas .html con rutas limpias
    content = re.sub(r'href=["\']([^"\']*?)\.html["\']', lambda m: f'href="/{m.group(1)}"', content)
    content = re.sub(r'src=["\']([^"\']*?)\.html["\']', lambda m: f'src="/{m.group(1)}"', content)

    # Mover navbar fuera de divs si está dentro
    content = re.sub(r'<div class="main-container">\s*<header', "<header", content)

    # Asegurar que /styles.css está presente
    if "/styles.css" not in content:
        content = re.sub(
            r'<link[^>]*href="[^"]*styles\.css[^"]*">',
            '<link rel="stylesheet" href="/styles.css">',
            content,
        )

    # Asegurar que /app.js está presente
    if "/app.js" not in content:
        if "</body>" in content:
            content = content.replace("</body>", '  <script src="/app.js"></script>\n</body>')

    # Escribir
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"[ERROR] No se puede escribir {file_path.name}: {e}")
        return False


def main():
    base_path = Path("d:\\GitHub\\SPMv1.0\\src\\frontend")

    success = 0
    failed = 0

    for filename in FAILED_FILES:
        file_path = base_path / filename
        if file_path.exists():
            if fix_file(file_path):
                print(f"[OK] {filename}")
                success += 1
            else:
                print(f"[FAIL] {filename}")
                failed += 1
        else:
            print(f"[SKIP] {filename} (no existe)")

    print(f"\n{'=' * 60}")
    print(f"Correcciones: {success} exitosas, {failed} fallidas")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
