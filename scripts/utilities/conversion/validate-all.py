#!/usr/bin/env python3
"""
Validación Completa de Todas las Páginas
Verifica estructura HTML y enlaces en todas las páginas convertidas
"""

import re
from pathlib import Path


def check_html_structure(file_path):
    """Verifica la estructura HTML de una página"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except:
        return None, "No se puede leer"

    checks = {
        "DOCTYPE": bool(re.search(r"<!DOCTYPE html>", content, re.IGNORECASE)),
        "lang": bool(re.search(r'lang=["\']es["\']', content)),
        "charset": bool(re.search(r'charset=["\']UTF-8["\']', content)),
        "navbar": bool(re.search(r'<header[^>]*class=["\']app-header["\']', content)),
        "app.js": bool(re.search(r'<script[^>]*src=["\']*/app\.js["\']', content)),
        "styles": bool(re.search(r'<link[^>]*href=["\']*/styles\.css["\']', content)),
        "no-html": not bool(re.search(r'href=["\'][^"\']*\.html["\']', content)),
    }

    passed = sum(1 for v in checks.values() if v)
    return passed, len(checks)


def main():
    base_path = Path("d:\\GitHub\\SPMv1.0\\src\\frontend")

    # Excluir backups y _layout
    files = sorted(
        [
            f
            for f in base_path.glob("*.html")
            if not f.name.startswith("_") and "backup" not in f.name
        ]
    )

    print(f"\n{'=' * 70}")
    print(f"{'VALIDACION DE TODAS LAS PAGINAS':^70}")
    print(f"{'=' * 70}\n")

    all_passed = 0
    all_failed = 0
    results = []

    for file_path in files:
        passed, total = check_html_structure(file_path)
        status = "✓" if passed == total else "✗"

        if passed == total:
            all_passed += 1
            results.append((file_path.name, f"{passed}/{total}", "OK"))
        else:
            all_failed += 1
            results.append((file_path.name, f"{passed}/{total}", "FAIL"))

    # Mostrar tabla
    print(f"{'Archivo':<30} {'Checks':<10} {'Estado':<8}")
    print(f"{'-' * 50}")

    for name, checks, status in results:
        if status == "OK":
            print(f"{name:<30} {checks:<10} {status:<8}")
        else:
            print(f"{name:<30} {checks:<10} {status:<8}")

    print(f"\n{'=' * 70}")
    print(f"Páginas validadas: {all_passed} exitosas, {all_failed} fallidas")
    print(f"Total: {len(files)} páginas")
    print(f"Éxito: {(all_passed / len(files) * 100):.0f}%")
    print(f"{'=' * 70}\n")


if __name__ == "__main__":
    main()
