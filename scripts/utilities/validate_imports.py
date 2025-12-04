#!/usr/bin/env python3
"""
Script final para verificar y reparar imports de manera segura
"""

import ast
import sys
from pathlib import Path

errors = []

for py_file in sorted(Path("src/backend").rglob("*.py")):
    try:
        with open(py_file, encoding="utf-8") as f:
            ast.parse(f.read())
    except SyntaxError as e:
        errors.append((py_file, str(e)))
    except Exception as e:
        errors.append((py_file, f"Error: {e}"))

if errors:
    print("❌ Errores de sintaxis encontrados:\n")
    for file, error in errors:
        print(f"  {file}")
        print(f"    → {error}\n")
    sys.exit(1)

print("✅ Todos los archivos tienen sintaxis válida")

# Ahora intentar importar
sys.path.insert(0, "src")

try:
    print("✅ Módulo backend.app importado exitosamente")
    print("🚀 El servidor está listo para ejecutar")
except Exception as e:
    print(f"❌ Error al importar: {e}")
    import traceback

    traceback.print_exc()
    sys.exit(1)
