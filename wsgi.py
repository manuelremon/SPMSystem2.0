#!/usr/bin/env python
"""WSGI entry point for Gunicorn"""

import os
import sys

# Agregar directorios al path para compatibilidad de imports
_project_root = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.join(_project_root, "backend")

# Agregar project root (para imports como backend.*)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# Agregar backend dir (para imports como core.*, routes.*, services.*)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from backend.app import create_app
from backend.core.config import settings

# Crear la aplicación
app = create_app()

# Inicializar BD en producción
if settings.ENV == "production":
    with app.app_context():
        from backend.core.db import init_db

        try:
            init_db()
            print("[WSGI] ✓ Base de datos inicializada en producción")
        except Exception as e:
            print(f"[WSGI] Error inicializando BD: {e}")

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
