#!/usr/bin/env python
"""Simple Flask server starter - Windows compatible"""

import sys
from pathlib import Path

# Ensure project root (two levels up) is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from src.backend.app import app

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("SPM BACKEND SERVER")
    print("=" * 60)
    print("URL: http://localhost:5000")
    print("=" * 60 + "\n")

    # Run with threaded mode to handle multiple requests
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False, threaded=True)
