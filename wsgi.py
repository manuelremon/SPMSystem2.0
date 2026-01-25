#!/usr/bin/env python
"""WSGI entry point for Gunicorn"""

import os
import sys

# Cargar variables de entorno desde .env (desarrollo local)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv no instalado, las variables deben estar en el entorno
    pass

# Path setup para imports de backend
# -----------------------------------------------------------------------------
# Este "path hacking" es necesario porque el proyecto no es un paquete instalable.
# Agrega tanto el root (para `backend.*`) como backend/ (para `core.*`, `routes.*`).
# Funciona correctamente con Gunicorn en produccion (Cloud Run) y en desarrollo.
# Alternativa seria convertir a paquete con pyproject.toml, pero el riesgo de
# romper la configuracion actual supera el beneficio.
# -----------------------------------------------------------------------------
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
