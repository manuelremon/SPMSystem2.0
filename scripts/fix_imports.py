#!/usr/bin/env python
"""
Script para corregir todos los imports relativos en backend_v2
Convierte: from core.X import Y -> try/except para backend_v2.core.X y core.X
"""

import re
from pathlib import Path


def fix_imports_in_file(filepath):
    """Actualiza imports en un archivo"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # Patrón para encontrar imports: from core.X import Y o from core import X
    # Buscar todas las líneas con "from core."
    lines = content.split("\n")
    new_lines = []
    import_block_start = None
    import_block = []

    for i, line in enumerate(lines):
        if line.strip().startswith("from core.") or line.strip().startswith("import core"):
            if import_block_start is None:
                import_block_start = len(new_lines)
            import_block.append(line)
        else:
            if import_block and not (
                line.strip().startswith("from core") or line.strip().startswith("import core")
            ):
                # Fin del bloque de imports
                _convert_imports(import_block, new_lines)
                import_block = []
                import_block_start = None

            new_lines.append(line)

    # Procesar últimos imports si hay
    if import_block:
        _convert_imports(import_block, new_lines)

    new_content = "\n".join(new_lines)

    if new_content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"✅ {filepath}")
        return True
    return False


def _convert_imports(import_block, new_lines):
    """Convierte un bloque de imports relativos a try/except"""
    if not import_block:
        return

    # Extraer módulos importados
    absolute_imports = []
    relative_imports = []

    for line in import_block:
        # from core.X import Y -> backend_v2.core.X y core.X
        match = re.match(r"from (core\..+?) import (.+)$", line.strip())
        if match:
            module = match.group(1)
            items = match.group(2)
            absolute_imports.append(f"from backend_v2.{module} import {items}")
            relative_imports.append(f"from {module} import {items}")
        else:
            # Otros imports
            new_lines.append(line)

    if absolute_imports and relative_imports:
        # Crear try/except
        new_lines.append("try:")
        for imp in absolute_imports:
            new_lines.append("    " + imp)
        new_lines.append("except ImportError:")
        for imp in relative_imports:
            new_lines.append("    " + imp)


def main():
    """Corregir todos los archivos Python en backend_v2"""
    backend_path = Path("../backend_v2")
    py_files = list(backend_path.glob("**/*.py"))

    fixed = 0
    for py_file in sorted(py_files):
        if fix_imports_in_file(py_file):
            fixed += 1

    print(f"\n✅ Total archivos corregidos: {fixed}")


if __name__ == "__main__":
    main()
