#!/usr/bin/env python
"""
Script simple para probar que el API está respondiendo
"""

import sys
import time

import requests


def test_api():
    """Test si el API está respondiendo"""

    # Esperar a que el servidor inicie
    print("Esperando a que el servidor inicie...")
    time.sleep(2)

    url = "http://localhost:5000/api/health"

    try:
        print(f"Haciendo request a {url}...")
        response = requests.get(url, timeout=5)

        print(f"✅ Status Code: {response.status_code}")
        print(f"✅ Response: {response.text}")

        return True

    except requests.exceptions.ConnectionError:
        print(f"❌ Error: No se puede conectar a {url}")
        print("   Asegúrate que el backend está corriendo en http://localhost:5000")
        return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    success = test_api()
    sys.exit(0 if success else 1)
