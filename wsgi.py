#!/usr/bin/env python
"""WSGI entry point for Gunicorn"""

import os
import sys

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend_v2.app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
