#!/usr/bin/env python
"""
Script mejorado para ejecutar el backend con mejor manejo de errores
"""

import logging
import os
import sys
from pathlib import Path

# Configurar logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Aseguramos que el directorio raíz del repositorio esté disponible en PYTHONPATH
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

logger.info(f"Root directory: {PROJECT_ROOT}")
logger.info(f"Python version: {sys.version}")
logger.info(f"Python path: {sys.path[:3]}")

try:
    logger.info("Importando aplicación Flask...")
    from src.backend.app import app

    logger.info("✓ Aplicación Flask importada exitosamente")

except Exception as e:
    logger.error(f"✗ Error importando aplicación: {e}", exc_info=True)
    sys.exit(1)

if __name__ == "__main__":
    try:
        host = os.environ.get("HOST", "0.0.0.0")
        port = int(os.environ.get("PORT", "5000"))

        logger.info(f"Iniciando servidor en {host}:{port}...")
        logger.info("Debug mode: ON")
        logger.info("Reloader: OFF")

        app.run(host=host, port=port, debug=True, use_reloader=False, threaded=True)

    except Exception as e:
        logger.error(f"✗ Error iniciando servidor: {e}", exc_info=True)
        sys.exit(1)
