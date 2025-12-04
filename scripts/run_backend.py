#!/usr/bin/env python
"""Script para iniciar Flask con PYTHONPATH correcto"""

import os
import sys
from pathlib import Path

# Configurar PYTHONPATH
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend_v2"))

os.chdir(str(root_dir))

# Importar y ejecutar
from backend_v2.app import create_app

app = create_app()

if __name__ == "__main__":
    print("[*] Iniciando servidor Flask...")
    print(f"[DIR] Directorio de trabajo: {os.getcwd()}")
    print("[URL] http://127.0.0.1:5000")
    app.run(debug=True, host="127.0.0.1", port=5000)
