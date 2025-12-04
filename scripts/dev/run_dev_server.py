#!/usr/bin/env python
"""Simple Flask development server with error handling"""

import os
import sys
import threading
import time
from pathlib import Path

# Garantizamos que el directorio raíz del proyecto esté accesible
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

from src.backend.app import app
from werkzeug.serving import make_server

if __name__ == "__main__":
    host = "127.0.0.1"
    port = 5000

    print("\n" + "=" * 60)
    print("INICIANDO BACKEND SPM")
    print("=" * 60)
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"URL: http://{host}:{port}")
    print("=" * 60 + "\n")

    try:
        # Create Werkzeug server
        server = make_server(host, port, app, threaded=True)

        # Run in a thread with daemon=False so it stays alive
        server_thread = threading.Thread(target=server.serve_forever, daemon=False)
        server_thread.start()

        print("Servidor corriendo. Presiona CTRL+C para detener.\n")

        # Keep main thread alive
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\nServidor detenido por usuario")
        server.shutdown()
    except Exception as e:
        print(f"\nError fatal: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
