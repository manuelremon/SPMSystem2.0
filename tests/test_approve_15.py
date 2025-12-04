#!/usr/bin/env python
"""
Test: Aprobar solicitud 15 - que sí tiene planificador asignado.
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
print("TEST: APROBAR SOLICITUD 15 (CON PLANIFICADOR AUTOMÁTICO)")
print("=" * 60)

with app.test_client() as client:
    # Login
    print("\n1. Login...")
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "2", "password": "a1"},
        headers={"Content-Type": "application/json"},
    )

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
    print("   ✓ Login exitoso")

    # Aprobar solicitud 15
    print("\n2. Aprobando solicitud 15...")
    approve_resp = client.post(
        "/api/solicitudes/15/decidir",
        json={"accion": "aprobar", "comentario": "Aprobada con planificador"},
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token_value}"},
    )

    print(f"   Status: {approve_resp.status_code}")

    if approve_resp.status_code == 200:
        resp_data = approve_resp.get_json()
        print("   ✓ Aprobación exitosa")
        print(f"   Response: {json.dumps(resp_data, indent=2, ensure_ascii=False)}")

        # Verificar en BD
        print("\n3. Verificando en BD...")
        DB_PATH = "src/backend/core/data/spm.db"
        with sqlite3.connect(DB_PATH) as con:
            con.row_factory = lambda cursor, row: {
                col[0]: row[idx] for idx, col in enumerate(cursor.description)
            }
            sol = con.execute(
                "SELECT id, id_usuario, aprobador_id, planner_id, status FROM solicitudes WHERE id=15"
            ).fetchone()
            print(f"\n   {json.dumps(sol, indent=2, default=str)}")

            # Ver datos de planificador asignado
            if sol.get("planner_id"):
                planner = con.execute(
                    "SELECT id_spm, nombre, sector FROM usuarios WHERE id_spm=?",
                    (sol["planner_id"],),
                ).fetchone()
                print("\n   Planificador asignado:")
                print(f"   {json.dumps(planner, indent=2, ensure_ascii=False)}")
    else:
        resp_data = approve_resp.get_json()
        print("   ✗ Error:")
        print(f"   {json.dumps(resp_data, indent=2, ensure_ascii=False)}")
