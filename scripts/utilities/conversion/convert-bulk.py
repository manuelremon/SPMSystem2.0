#!/usr/bin/env python3
"""
Conversor de Páginas SPA a Multi-Page
Automatiza la conversión de HTML con navbar integrada
"""

import re
import sys
from pathlib import Path

# Navbar template simplificada
NAVBAR_TEMPLATE = """  <header class="app-header">
    <a href="/dashboard">Dashboard</a>
    <nav>
      <a href="/mi-cuenta">Mi Cuenta</a>
      <a href="/preferencias">Preferencias</a>
      <a href="/mis-solicitudes">Mis Solicitudes</a>
      <a href="/crear-solicitud">Crear Solicitud</a>
      <a href="/materiales">Materiales</a>
      <a href="/notificaciones">Notificaciones</a>
      <a href="/presupuesto">Presupuesto</a>
      <a href="/admin">Admin</a>
    </nav>
  </header>"""


def get_title_from_file(filename):
    """Genera un título basado en el nombre del archivo"""
    name = filename.replace(".html", "").replace("-", " ").title()
    return f"{name} - SPM"


def convert_file(input_path, output_path):
    """Convierte un archivo HTML al formato multi-page"""

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"[ERROR] No se puede leer {input_path}: {e}")
        return False

    # Obtener título
    title_match = re.search(r"<title>([^<]+)</title>", content)
    title = title_match.group(1) if title_match else get_title_from_file(input_path.name)

    # Extraer body content (entre <body> y </body>)
    body_match = re.search(r"<body[^>]*>(.*?)</body>", content, re.DOTALL)
    body_content = body_match.group(1) if body_match else "<p>Contenido</p>"

    # Limpiar contenido de body
    body_content = re.sub(r"<header[^>]*>.*?</header>", "", body_content, flags=re.DOTALL)
    body_content = re.sub(r"<nav[^>]*>.*?</nav>", "", body_content, flags=re.DOTALL)
    body_content = body_content.strip()

    # Reemplazar rutas .html con rutas limpias
    body_content = re.sub(
        r'href=["\']([^"\']*?)\.html["\']', lambda m: f'href="/{m.group(1)}"', body_content
    )
    body_content = re.sub(
        r'href=["\']([^"\']*?)/["\']', lambda m: f'href="/{m.group(1)}"', body_content
    )

    # Construir HTML nuevo
    new_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
{NAVBAR_TEMPLATE}
  <main class="main-container">
{body_content}
  </main>
  <script src="/app.js"></script>
</body>
</html>"""

    # Escribir archivo
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(new_html)
        return True
    except Exception as e:
        print(f"[ERROR] No se puede escribir {output_path}: {e}")
        return False


def main():
    base_path = Path("d:\\GitHub\\SPMv1.0\\src\\frontend")

    # Páginas a convertir (excluye las ya convertidas y backups)
    exclude_patterns = [
        "dashboard",
        "mis-solicitudes",
        "crear-solicitud",
        "materiales",
        "admin",
        "ayuda",
        "_layout",
        "backup",
    ]

    files = sorted(
        [
            f
            for f in base_path.glob("*.html")
            if not any(pattern in f.name for pattern in exclude_patterns)
        ]
    )

    print(f"\nConvertirá {len(files)} páginas...\n")

    success = 0
    failed = 0

    for file_path in files:
        # Crear nombre del archivo (remover _page si existe)
        output_name = file_path.name.replace("-page.html", ".html")
        output_path = base_path / output_name

        # No sobreescribir si ya fue procesado
        if output_path != file_path and output_path.exists():
            # Crear backup
            backup_path = output_path.with_suffix(".html.backup-auto")
            if backup_path.exists():
                backup_path.unlink()  # Eliminar backup anterior si existe
            output_path.rename(backup_path)

        if convert_file(file_path, output_path):
            print(f"[OK] {file_path.name}")
            success += 1
        else:
            print(f"[FAIL] {file_path.name}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Conversion completada: {success} exitosas, {failed} fallidas")
    print(f"{'=' * 60}\n")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
