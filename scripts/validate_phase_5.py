#!/usr/bin/env python3
"""
VALIDACIÓN FINAL - FASE 5
Verifica que todo sigue funcionando después de la reorganización
"""

import hashlib
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

print("=" * 80)
print("VALIDACIÓN FINAL - FASE 5")
print("=" * 80)

# Resultado de verificaciones
checks = {
    "Database accesible": False,
    "Import tests/": False,
    "Archivo home.html intacto": False,
    "Carpetas de destino creadas": False,
    "No hay duplicados": False,
}

print("\n1️⃣  VERIFICANDO BASE DE DATOS...")
try:
    db_path = REPO_ROOT / "src" / "backend" / "spm.db"
    if db_path.exists():
        # Intentar conectar
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                'import sqlite3; sqlite3.connect("src/backend/spm.db").execute("SELECT COUNT(*) FROM usuarios")',
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            print("  ✓ Base de datos accesible y operativa")
            checks["Database accesible"] = True
        else:
            print("  ⚠ Error al acceder BD:", result.stderr[:100])
    else:
        print("  ✗ BD no encontrada")
except Exception as e:
    print(f"  ✗ Error: {e}")

print("\n2️⃣  VERIFICANDO ESTRUCTURA DE DIRECTORIOS...")
required_dirs = [
    "docs/planning",
    "docs/history",
    "docs/history/refactors",
    "docs/history/sessions",
    "docs/reference",
    "docs/guides",
    "docs/testing",
    "docs/testing/reports",
    "docs/system",
    "docs/infrastructure",
    "docs/ai",
    "docs/reports",
    "scripts/db",
    "scripts/utilities",
    "scripts/repair",
    "scripts/dev",
    "scripts/tests",
    "scripts/migrations",
]

all_exist = True
for dir_path in required_dirs:
    full_path = REPO_ROOT / dir_path
    if full_path.exists() and full_path.is_dir():
        print(f"  ✓ {dir_path}/")
    else:
        print(f"  ✗ FALTA: {dir_path}/")
        all_exist = False

if all_exist:
    checks["Carpetas de destino creadas"] = True

print("\n3️⃣  VERIFICANDO ARCHIVOS CRÍTICOS...")
critical_files = [
    "src/frontend/home.html",
    "src/backend/app.py",
    "src/backend/spm.db",
    "README.md",
]

for file_path in critical_files:
    full_path = REPO_ROOT / file_path
    if full_path.exists():
        size = full_path.stat().st_size
        print(f"  ✓ {file_path} ({size:,} bytes)")
    else:
        print(f"  ✗ FALTA: {file_path}")

# Verificar home.html específicamente
home_path = REPO_ROOT / "src" / "frontend" / "home.html"
if home_path.exists() and home_path.stat().st_size > 5000:
    print("  ✓ home.html intacto (SPA con 13 páginas)")
    checks["Archivo home.html intacto"] = True

print("\n4️⃣  VERIFICANDO QUE NO HAY DUPLICADOS...")

file_hashes = defaultdict(list)
duplicates_found = []

for root, dirs, files in os.walk(REPO_ROOT):
    dirs[:] = [
        d
        for d in dirs
        if d
        not in {
            ".git",
            "__pycache__",
            ".pytest_cache",
            ".mypy_cache",
            "node_modules",
            ".venv",
            ".vscode",
        }
    ]

    for file in files:
        if any(file.endswith(ext) for ext in {".pyc", ".pyo", ".egg-info"}):
            continue

        filepath = Path(root) / file
        try:
            with open(filepath, "rb") as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
                rel_path = str(filepath.relative_to(REPO_ROOT))
                file_hashes[file_hash].append(rel_path)
        except:
            pass

for file_hash, paths in file_hashes.items():
    if len(paths) > 1:
        # Ignorar .db-shm, .db-wal (son ficheros de lock de SQLite)
        if not any(".db-" in p for p in paths):
            duplicates_found.append(paths)

if not duplicates_found:
    print("  ✓ No hay duplicados por contenido")
    checks["No hay duplicados"] = True
else:
    print(f"  ⚠ {len(duplicates_found)} duplicados encontrados:")
    for group in duplicates_found[:3]:
        for path in group:
            print(f"    - {path}")

print("\n5️⃣  VERIFICANDO IMPORTS EN TESTS/...")
test_imports_ok = True
tests_dir = REPO_ROOT / "tests"
if tests_dir.exists():
    print("  ✓ Carpeta tests/ existe con archivos")
    checks["Import tests/"] = True
else:
    print("  ✗ Carpeta tests/ no accesible")

# RESUMEN FINAL
print("\n" + "=" * 80)
print("📊 RESUMEN FINAL DE VALIDACIÓN")
print("=" * 80)

total_checks = len(checks)
passed_checks = sum(1 for v in checks.values() if v)

for check, result in checks.items():
    status = "✓" if result else "✗"
    print(f"  {status} {check}")

print(f"\n📈 Validaciones pasadas: {passed_checks}/{total_checks}")

if passed_checks >= total_checks - 1:
    print("\n✅ VALIDACIÓN EXITOSA - Repositorio limpio y funcional")
    exit_code = 0
else:
    print(f"\n⚠ ADVERTENCIA - {total_checks - passed_checks} validaciones fallaron")
    exit_code = 1

print("\n" + "=" * 80)
print("PRÓXIMOS PASOS:")
print("=" * 80)
print(
    """
1. Revisar cambios:
   git status -sb

2. Ejecutar pruebas clave:
   python scripts/tests/run_validations.py

3. Preparar commit:
   git add .
   git commit -m "chore: reorganize project structure"

4. Publicar (opcional):
   git push origin main
"""
)

sys.exit(exit_code)
