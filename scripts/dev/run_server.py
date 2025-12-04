#!/usr/bin/env python
"""Flask backend launcher with better connection handling"""

import os
import signal
import sys
from pathlib import Path

# Aseguramos que el directorio raíz del repositorio esté disponible
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)


def signal_handler(sig, frame):
    print("\n\n⏹️  Servidor detenido")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)

    # Import and run the app
    from src.backend.app import app

    # Get host and port from environment or use defaults
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))

    print(f"\n{'=' * 60}")
    print("🚀 INICIANDO BACKEND SPM")
    print(f"{'=' * 60}")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"URL: http://{host}:{port}")
    print(f"{'=' * 60}\n")

    # Run Flask development server with connection pooling
    app.run(host=host, port=port, debug=False, use_reloader=False, threaded=True, use_evalex=False)
