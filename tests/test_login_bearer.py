#!/usr/bin/env python
"""
Test: Login real, extraer token de cookie, enviar como Bearer.
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

from src.backend.routes.auth_routes import bp as auth_bp
from src.backend.routes.solicitudes import bp as solicitudes_bp

app.register_blueprint(solicitudes_bp)
app.register_blueprint(auth_bp)

print("=" * 60)
print("TEST: LOGIN + EXTRAE TOKEN + ENVÍA COMO BEARER")
print("=" * 60)

with app.app_context():
    client = app.test_client()

    # 1. Login
    print("\n1. Realizando login...")
    login_response = client.post(
        "/api/auth/login",
        json={"username": "2", "password": "a1"},
        headers={"Content-Type": "application/json"},
    )
    print(f"   Status: {login_response.status_code}")

    if login_response.status_code == 200:
        # 2. Extraer token de Set-Cookie header
        print("\n2. Extrayendo token de cookie...")
        set_cookie_header = login_response.headers.get("Set-Cookie", "")
        print(f"   Set-Cookie header: {set_cookie_header[:80]}...")

        # Parsear la cookie
        cookie = http.cookies.SimpleCookie()
        cookie.load(set_cookie_header)
        token = cookie.get("access_token")
        if token:
            token_value = token.value
            print(f"   ✓ Token extraído: {token_value[:30]}...")

            # 3. Aprobar solicitud con Bearer token
            print("\n3. Aprobando solicitud 14 con Bearer token...")
            approve_response = client.post(
                "/api/solicitudes/14/decidir",
                json={"accion": "aprobar", "comentario": "Aprobada por Juan"},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token_value}",
                },
            )
            print(f"   Status: {approve_response.status_code}")
            approve_data = approve_response.get_json()
            print(f"   Response: {json.dumps(approve_data, indent=2, ensure_ascii=False)}")

            # 4. Verificar estado en BD
            if approve_response.status_code == 200:
                print("\n4. Verificando estado en BD...")
                DB_PATH = "src/backend/core/data/spm.db"
                with sqlite3.connect(DB_PATH) as con:
                    con.row_factory = lambda cursor, row: {
                        col[0]: row[idx] for idx, col in enumerate(cursor.description)
                    }
                    sol = con.execute(
                        "SELECT id, id_usuario, aprobador_id, planner_id, status FROM solicitudes WHERE id=14"
                    ).fetchone()
                    print(f"\n   {json.dumps(sol, indent=2, default=str)}")

                    # Ver si data_json tiene la decisión
                    full_sol = con.execute(
                        "SELECT data_json FROM solicitudes WHERE id=14"
                    ).fetchone()
                    if full_sol:
                        data_json = json.loads(full_sol["data_json"])
                        if "decision" in data_json:
                            print("\n   Decision en data_json:")
                            print(
                                f"   {json.dumps(data_json['decision'], indent=2, ensure_ascii=False)}"
                            )
        else:
            print("   ✗ No se pudo extraer token de la cookie")
    else:
        print("   ✗ Login falló")

print("\n✓ Test completado")
