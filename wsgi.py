#!/usr/bin/env python
"""WSGI entry point for Gunicorn"""

import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend_v2.app import create_app
from backend_v2.core.config import settings

# Crear la aplicación
app = create_app()

# Inicializar BD en producción
if settings.ENV == "production":
    with app.app_context():
        from backend_v2.core.db import init_db
        try:
            init_db()
            print("[WSGI] ✓ Base de datos inicializada en producción")
        except Exception as e:
            print(f"[WSGI] Error inicializando BD: {e}")

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

