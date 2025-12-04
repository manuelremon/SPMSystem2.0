#!/usr/bin/env python3
"""
ANALIZADOR EXHAUSTIVO DEL REPOSITORIO
Identifica duplicados, obsoletos, desorganización
"""

import hashlib
import os
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path("d:/GitHub/SPMv1.0")

# Patrones a ignorar
IGNORE_DIRS = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "node_modules",
    ".venv",
    ".vscode",
    "venv",
}
IGNORE_EXTENSIONS = {".pyc", ".pyo", ".egg-info", ".DS_Store"}
TEMP_PATTERNS = {"~", ".bak", ".tmp", ".old", "_backup", "_old", "_obsolete", ".swp"}

print("=" * 80)
print("ANÁLISIS EXHAUSTIVO DEL REPOSITORIO SPM")
print("=" * 80)

# 1. MAPEAR ESTRUCTURA
print("\n1️⃣  MAPEANDO ESTRUCTURA COMPLETA...")
structure = {}
file_count = 0
dir_count = 0

for root, dirs, files in os.walk(REPO_ROOT):
    # Filtrar directorios ignorados
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    rel_path = Path(root).relative_to(REPO_ROOT)
    if rel_path == Path("."):
        level = 0
    else:
        level = len(rel_path.parts)

    if level <= 4:  # Mostrar hasta 4 niveles
        print(f"  {'  ' * level}{Path(root).name}/ ({len(files)} archivos)")
        dir_count += 1
        file_count += len(files)

print(f"\n✓ Total directorios: {dir_count}")
print(f"✓ Total archivos (sin cachés): {file_count}")

# 2. ENCONTRAR DUPLICADOS
print("\n2️⃣  BUSCANDO DUPLICADOS...")
file_hashes = defaultdict(list)
duplicates = []

for root, dirs, files in os.walk(REPO_ROOT):
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    for file in files:
        if any(file.endswith(ext) for ext in IGNORE_EXTENSIONS):
            continue

        filepath = Path(root) / file
        try:
            with open(filepath, "rb") as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
                rel_path = str(filepath.relative_to(REPO_ROOT))
                file_hashes[file_hash].append(rel_path)
        except:
            pass

# Encontrar duplicados por hash
for file_hash, paths in file_hashes.items():
    if len(paths) > 1:
        duplicates.append(paths)

if duplicates:
    print(f"\n⚠️  ENCONTRADOS {len(duplicates)} GRUPOS DE DUPLICADOS:")
    for i, group in enumerate(duplicates, 1):
        print(f"\n  Grupo {i}:")
        for path in group:
            print(f"    - {path}")
else:
    print("✓ No hay duplicados por contenido")

# 3. ENCONTRAR ARCHIVOS OBSOLETOS
print("\n3️⃣  BUSCANDO ARCHIVOS OBSOLETOS...")
obsolete = []
temp = []

for root, dirs, files in os.walk(REPO_ROOT):
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    for file in files:
        filepath = Path(root) / file
        rel_path = str(filepath.relative_to(REPO_ROOT))

        # Archivos con patrones obsoletos
        if any(pattern in rel_path for pattern in TEMP_PATTERNS):
            obsolete.append(rel_path)

        # Backups viejos
        if file.endswith((".bak", ".backup", ".old", ".orig")):
            obsolete.append(rel_path)

if obsolete:
    print(f"\n⚠️  ENCONTRADOS {len(obsolete)} ARCHIVOS OBSOLETOS:")
    for path in sorted(obsolete)[:20]:
        print(f"    - {path}")
    if len(obsolete) > 20:
        print(f"    ... y {len(obsolete) - 20} más")
else:
    print("✓ No hay archivos obsoletos detectados")

# 4. ANALIZAR DIRECTORIOS DESORGANIZADOS
print("\n4️⃣  ANALIZANDO ORGANIZACIÓN...")

problem_dirs = {}

# Revisar directorios raíz con muchos archivos variados
for item in os.listdir(REPO_ROOT):
    item_path = REPO_ROOT / item
    if item_path.is_dir() and item not in IGNORE_DIRS:
        python_files = []
        js_files = []
        doc_files = []
        other_files = []

        for file in os.listdir(item_path):
            if os.path.isfile(item_path / file):
                if file.endswith(".py"):
                    python_files.append(file)
                elif file.endswith(".js"):
                    js_files.append(file)
                elif file.endswith((".md", ".txt", ".md")):
                    doc_files.append(file)
                else:
                    other_files.append(file)

        mixed = sum([bool(python_files), bool(js_files), bool(doc_files), bool(other_files)])
        if mixed > 2:
            problem_dirs[item] = {
                "python": len(python_files),
                "javascript": len(js_files),
                "docs": len(doc_files),
                "other": len(other_files),
            }

if problem_dirs:
    print(f"\n⚠️  ENCONTRADAS {len(problem_dirs)} CARPETAS DESORGANIZADAS:")
    for dir_name, counts in problem_dirs.items():
        print(f"\n  {dir_name}/:")
        if counts["python"] > 0:
            print(f"    Python: {counts['python']} archivos")
        if counts["javascript"] > 0:
            print(f"    JavaScript: {counts['javascript']} archivos")
        if counts["docs"] > 0:
            print(f"    Documentación: {counts['docs']} archivos")
        if counts["other"] > 0:
            print(f"    Otros: {counts['other']} archivos")

# 5. ARCHIVOS SIN CATEGORIZAR EN RAÍZ
print("\n5️⃣  ARCHIVOS EN RAÍZ SIN CATEGORIZAR...")
root_files = []
for item in os.listdir(REPO_ROOT):
    item_path = REPO_ROOT / item
    if item_path.is_file():
        root_files.append(item)

print(f"\n✓ {len(root_files)} archivos en raíz:")
for file in sorted(root_files):
    print(f"    - {file}")

# 6. BÚSQUEDA DE PROBLEMAS ESPECÍFICOS
print("\n6️⃣  BÚSQUEDA DE PATRONES PROBLEMÁTICOS...")

issues = {
    "test_*.py fuera de tests/": [],
    "requirements*.txt múltiples": [],
    "config files desorden": [],
    "documentación dispersa": [],
}

for root, dirs, files in os.walk(REPO_ROOT):
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    rel_root = str(Path(root).relative_to(REPO_ROOT))

    for file in files:
        # Tests fuera de carpeta tests
        if file.startswith("test_") and "tests" not in rel_root:
            issues["test_*.py fuera de tests/"].append(f"{rel_root}/{file}")

        # Requirements duplicados
        if "requirements" in file and file.endswith(".txt"):
            issues["requirements*.txt múltiples"].append(f"{rel_root}/{file}")

        # Archivos de config
        if file in ("config.py", "settings.py", ".env", ".env.example"):
            if "config" not in rel_root:
                issues["config files desorden"].append(f"{rel_root}/{file}")

        # Documentación
        if file.endswith((".md", ".rst")):
            if "docs" not in rel_root and rel_root not in ("", "."):
                issues["documentación dispersa"].append(f"{rel_root}/{file}")

for issue_type, files in issues.items():
    if files:
        print(f"\n⚠️  {issue_type}: {len(files)} archivos")
        for file in files[:5]:
            print(f"    - {file}")
        if len(files) > 5:
            print(f"    ... y {len(files) - 5} más")

print("\n" + "=" * 80)
print("ANÁLISIS COMPLETADO")
print("=" * 80)
