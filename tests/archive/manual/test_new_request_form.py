#!/usr/bin/env python3
"""
Test: Verificar que el formulario de Nueva Solicitud funciona
- Loguearse
- Navegar a Nueva Solicitud
- Verificar que el formulario esté presente
"""

import os
import sys

import requests

# Agregar el directorio src al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

BASE_URL = "http://127.0.0.1:5000"


def test_new_request_form():
    print("=" * 60)
    print("TEST: Formulario de Nueva Solicitud")
    print("=" * 60)

    session = requests.Session()

    # 1. Login
    print("\n1️⃣ Intentando login...")
    login_response = session.post(
        f"{BASE_URL}/api/auth/login", json={"username": "Juan", "password": "a1"}
    )

    if login_response.status_code != 200:
        print(f"❌ Login fallido: {login_response.status_code}")
        print(login_response.text)
        return False

    print(f"✅ Login exitoso: {login_response.status_code}")
    user_data = login_response.json()
    print(f"   Usuario: {user_data.get('nombre')} ({user_data.get('rol')})")

    # 2. Obtener home.html
    print("\n2️⃣ Obteniendo home.html...")
    home_response = session.get(f"{BASE_URL}/home")

    if home_response.status_code != 200:
        print(f"❌ Error obteniendo home: {home_response.status_code}")
        return False

    html = home_response.text

    # Verificar que el formulario está presente
    checks = {
        "page-new-request": 'id="page-new-request"' in html,
        "form-step-1": 'id="form-step-1"' in html,
        "form-step-2": 'id="form-step-2"' in html,
        "form-step-3": 'id="form-step-3"' in html,
        "newReqCentro": 'id="newReqCentro"' in html,
        "newReqAlmacen": 'id="newReqAlmacen"' in html,
        "materialSelect": 'id="materialSelect"' in html,
        "navigateFormStep": "navigateFormStep" in html,
        "addMaterialToList": "addMaterialToList" in html,
        "submitNewRequest": "submitNewRequest" in html,
    }

    print("✅ Verificando elementos del formulario:")
    all_present = True
    for name, present in checks.items():
        status = "✅" if present else "❌"
        print(f"   {status} {name}")
        if not present:
            all_present = False

    if not all_present:
        print("\n❌ Faltan elementos del formulario")
        return False

    # 3. Verificar catálogos API
    print("\n3️⃣ Verificando API de catálogos...")
    catalogs_response = session.get(
        f"{BASE_URL}/api/catalogos", headers={"Accept": "application/json"}
    )

    if catalogs_response.status_code != 200:
        print(f"❌ Error obteniendo catálogos: {catalogs_response.status_code}")
        print(catalogs_response.text)
        return False

    catalogs = catalogs_response.json()
    print("✅ Catálogos cargados:")
    print(f"   - Centros: {len(catalogs.get('centros', []))}")
    print(f"   - Almacenes: {len(catalogs.get('almacenes', []))}")
    print(f"   - Materiales: {len(catalogs.get('materiales', []))}")

    print("\n" + "=" * 60)
    print("✅ PRUEBA EXITOSA: Formulario está listo")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = test_new_request_form()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error durante la prueba: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
