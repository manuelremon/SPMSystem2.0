#!/usr/bin/env python
"""Debug script to test Flask startup on port 5000"""

import logging
import os
import sys

# Ensure we're in the right directory
os.chdir(r"d:\GitHub\SPMv1.0")
sys.path.insert(0, os.getcwd())

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG, format="[%(asctime)s] %(levelname)s in %(name)s: %(message)s"
)

print("=" * 60)
print("DEBUG: Starting Flask debug script")
print("=" * 60)

try:
    print("\n[1] Importing Flask...")
    print("    ✓ Flask imported")

    print("\n[2] Importing create_app from src.backend.app...")
    from src.backend.app import create_app

    print("    ✓ create_app imported")

    print("\n[3] Creating Flask application...")
    app = create_app()
    print("    ✓ Flask app created")
    print(f"    ✓ App has {len(app.url_map._rules)} routes")

    print("\n[4] Checking Flask configuration...")
    print(f"    - DEBUG: {app.debug}")
    print(f"    - TESTING: {app.config.get('TESTING', False)}")
    print(f"    - ENV: {app.env}")

    print("\n[5] Starting Flask server on port 5000...")
    print("    " + "=" * 50)

    # Use app.run() directly with specific parameters
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        use_reloader=False,
        use_debugger=False,
        threaded=True,
    )

except Exception as e:
    print(f"\n❌ ERROR: {type(e).__name__}")
    print(f"   Message: {str(e)}")
    import traceback

    traceback.print_exc()
    sys.exit(1)
