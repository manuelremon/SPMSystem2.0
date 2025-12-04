#!/usr/bin/env python
"""Script para ejecutar tests de validaciones Fase 1"""

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if __name__ == "__main__":
    # Ejecutar pytest desde la raíz del proyecto
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_solicitud_validations.py", "-v", "--tb=short"],
        capture_output=False,
        cwd=PROJECT_ROOT,
        check=False,
    )
    sys.exit(result.returncode)
