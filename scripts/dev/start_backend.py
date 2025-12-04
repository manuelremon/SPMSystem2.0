#!/usr/bin/env python
"""Flask backend launcher"""

import os
import sys
from pathlib import Path

# Aseguramos que el directorio raíz esté en el path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

if __name__ == "__main__":
    # Import and run the app
    from src.backend.app import app

    # Get host and port from environment or use defaults
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))

    print(f"\n{'=' * 60}")
    print("INICIANDO BACKEND SPM")
    print(f"{'=' * 60}")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"URL: http://{host}:{port}")
    print(f"{'=' * 60}\n")

    # Run Flask development server
    try:
        app.run(
            host=host, port=port, debug=False, use_reloader=False, threaded=True, use_evalex=False
        )
    except KeyboardInterrupt:
        print("\n\nServidor detenido")
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)
