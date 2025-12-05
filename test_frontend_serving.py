#!/usr/bin/env python
"""Test rápido: Verificar que Flask sirve frontend correctamente"""

import sys
from pathlib import Path

# Setup path
sys.path.insert(0, str(Path(__file__).parent))

from backend_v2.app import create_app

# Crear app
app = create_app()

print("\n" + "="*60)
print("TEST: Flask serviendo Frontend React")
print("="*60)

# Test client
with app.test_client() as client:
    # Test 1: GET /
    print("\n1. GET / (raíz - React SPA)")
    resp = client.get("/")
    print(f"   Status: {resp.status_code}")
    print(f"   Content-Type: {resp.content_type}")
    print(f"   Tamaño: {len(resp.data)} bytes")
    print(f"   Contiene 'index.html': {'<!DOCTYPE html>' in resp.get_data(as_text=True)}")
    
    # Test 2: GET /assets/index-xxx.js (archivo estático existente)
    print("\n2. GET /assets/* (archivos estáticos)")
    # Buscar un archivo JavaScript que exista
    dist_path = Path(__file__).parent / "frontend" / "dist" / "assets"
    js_files = list(dist_path.glob("index-*.js"))
    if js_files:
        js_file = js_files[0]
        asset_path = f"/assets/{js_file.name}"
        resp = client.get(asset_path)
        print(f"   Archivo: {js_file.name}")
        print(f"   Status: {resp.status_code}")
        print(f"   Tamaño: {len(resp.data)} bytes")
    
    # Test 3: GET /health (endpoint API)
    print("\n3. GET /health (API health check)")
    resp = client.get("/health")
    print(f"   Status: {resp.status_code}")
    print(f"   Respuesta: {resp.get_json()}")
    
    # Test 4: GET /api (root API info)
    print("\n4. GET /api (API info)")
    resp = client.get("/api")
    print(f"   Status: {resp.status_code}")
    data = resp.get_json()
    print(f"   Message: {data.get('message')}")
    
    # Test 5: GET /ruta-inexistente (SPA routing)
    print("\n5. GET /ruta-inexistente (SPA routing fallback)")
    resp = client.get("/ruta-inexistente")
    print(f"   Status: {resp.status_code}")
    print(f"   Devuelve index.html: {'<!DOCTYPE html>' in resp.get_data(as_text=True)}")

print("\n" + "="*60)
print("✅ TESTS COMPLETADOS")
print("="*60 + "\n")
