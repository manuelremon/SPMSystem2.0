#!/usr/bin/env python
"""
Production-ready staging server launcher
No debug mode, proper WSGI configuration
"""

import os
import sys
from pathlib import Path

# Setup paths
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend_v2"))
os.chdir(str(root_dir))

# Set staging environment
os.environ["FLASK_ENV"] = "staging"
os.environ["ENV"] = "staging"

# Load .env.staging if exists
env_staging = root_dir / ".env.staging"
if env_staging.exists():
    with open(env_staging) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

from backend_v2.app import create_app

app = create_app()

if __name__ == "__main__":
    print("[*] Starting Staging Server...")
    print(f"[*] Environment: {os.environ.get('FLASK_ENV', 'unknown')}")
    print("[*] Server: http://127.0.0.1:5000")
    print("[*] Debug: False")
    print()

    # Run production-like server
    app.run(
        debug=False,
        host="127.0.0.1",
        port=5000,
        use_reloader=False,
        use_debugger=False,
        threaded=True,
    )
