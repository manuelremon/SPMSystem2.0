#!/usr/bin/env python3
"""Test que los endpoints de usuario están registrados y funcionan"""

from src.backend.app import create_app

app = create_app()

print("=" * 80)
print("VERIFICAR RUTAS REGISTRADAS EN FLASK")
print("=" * 80)

# Listar todas las rutas
with app.app_context():
    routes = []
    for rule in app.url_map.iter_rules():
        if "/api" in rule.rule:
            routes.append(f"{rule.rule:60} {str(rule.methods):20}")

    # Filtrar rutas relevantes
    print("\n📍 Rutas de USUARIOS (/api/me, /api/usuarios):")
    for route in sorted(routes):
        if "/me" in route or "/usuarios" in route:
            print(f"  {route}")

    print("\n📍 Rutas de AUTH (/api/auth):")
    for route in sorted(routes):
        if "/auth" in route:
            print(f"  {route}")

print("\n" + "=" * 80)
print("TEST DE ENDPOINTS")
print("=" * 80)

# Test directo
with app.test_client() as client:
    # Login primero
    print("\n1. Intentando login...")
    resp = client.post(
        "/api/auth/login", json={"username": "admin@spm.com", "password": "admin123"}
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        print("   ✓ Login exitoso")
        cookies = resp.headers.getlist("Set-Cookie")
        if cookies:
            print("   ✓ Cookie establecida")
    else:
        print(f"   ✗ Login fallido: {resp.get_json()}")

    # Test /api/me
    print("\n2. Test GET /api/me...")
    resp = client.get("/api/me")
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        print("   ✓ /api/me funciona")
        print(f"   Datos: {list(resp.get_json().keys())}")
    else:
        print(f"   ✗ Error: {resp.get_json()}")

    # Test /api/auth/me
    print("\n3. Test GET /api/auth/me...")
    resp = client.get("/api/auth/me")
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        print("   ✓ /api/auth/me funciona")
    else:
        print(f"   ✗ Error: {resp.get_json()}")

print("\n" + "=" * 80)
