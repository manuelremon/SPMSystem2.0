"""
Configuracion global de pytest para SPM System.

Este archivo asegura que el path este configurado correctamente
para todos los tests, permitiendo imports como:
    from backend.core.X import Y
"""

import os
import sys

# Configurar path al inicio de los tests
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# Importar fixtures comunes si existen
# from tests.fixtures import *  # Descomentar cuando se agreguen fixtures
