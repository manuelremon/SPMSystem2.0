#!/usr/bin/env python
"""
Test: Login real, usar token Bearer, todo en un único flujo.
"""

import http.cookies
import json
import os
import sqlite3
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

from flask import Flask

app = Flask(__name__)
app.config["DATABASE"] = "src/backend/core/data/spm.db"
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

from src.backend.routes.auth_routes import bp as auth_bp
from src.backend.routes.solicitudes import bp as solicitudes_bp

app.register_blueprint(solicitudes_bp)
app.register_blueprint(auth_bp)

print("=" * 60)
print("TEST: FLUJO COMPLETO DE LOGIN Y APROBACIÓN")
print("=" * 60)

with app.test_client() as client:
    # Login con usuario 2
    print("\n1. Login...")
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "2", "password": "a1"},
        headers={"Content-Type": "application/json"},
    )
    print(f"   Status: {login_resp.status_code}")

    if login_resp.status_code != 200:
        print("   ✗ Login falló")
        sys.exit(1)

    # Extraer token
    set_cookie = login_resp.headers.get("Set-Cookie", "")
    cookie = http.cookies.SimpleCookie()
    cookie.load(set_cookie)
    token = cookie.get("access_token")
    if not token:
        print("   ✗ No se pudo extraer token")
        sys.exit(1)

    token_value = token.value
    print(f"   ✓ Token: {token_value[:40]}...")

    # Usar token para aprobar solicitud
    print("\n2. Aprobando solicitud 14...")
    approve_resp = client.post(
        "/api/solicitudes/14/decidir",
        json={"accion": "aprobar", "comentario": "Aprobada"},
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token_value}"},
    )
    print(f"   Status: {approve_resp.status_code}")

    resp_data = approve_resp.get_json()
    print(f"   Response: {json.dumps(resp_data, indent=2, ensure_ascii=False)}")

    if approve_resp.status_code == 200:
        print("\n   ✓ Aprobación exitosa!")

        # Verificar en BD
        print("\n3. Verificando en BD...")
        DB_PATH = "src/backend/core/data/spm.db"
        with sqlite3.connect(DB_PATH) as con:
            con.row_factory = lambda cursor, row: {
                col[0]: row[idx] for idx, col in enumerate(cursor.description)
            }
            sol = con.execute(
                "SELECT id, id_usuario, aprobador_id, planner_id, status FROM solicitudes WHERE id=14"
            ).fetchone()
            print(f"   {json.dumps(sol, indent=2, default=str)}")
    else:
        print(f"\n   ✗ Error: status {approve_resp.status_code}")
