#!/usr/bin/env python
"""
Test: Login con usuario real y aprobar solicitud.
"""

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
print("TEST: LOGIN Y APROBACIÓN CON USUARIO REAL")
print("=" * 60)

with app.app_context():
    # Usar test_client con use_cookies=True (default)
    client = app.test_client()

    # 1. Ver qué contraseña tiene usuario 2
    print("\n1. Verificando usuario 2 en BD...")
    DB_PATH = "src/backend/core/data/spm.db"
    with sqlite3.connect(DB_PATH) as con:
        con.row_factory = lambda cursor, row: {
            col[0]: row[idx] for idx, col in enumerate(cursor.description)
        }
        user = con.execute(
            "SELECT id_spm, nombre, rol, contrasena FROM usuarios WHERE id_spm='2'"
        ).fetchone()
        print(
            f"   Usuario: {json.dumps({k: v for k, v in user.items() if k != 'contrasena'}, indent=2)}"
        )
        pwd = user.get("contrasena")
        print(f"   Contraseña (hash): {pwd[:20]}..." if pwd else "   Sin contraseña")

    # 2. Intentar login con usuario 2
    print("\n2. Intentando login con usuario 2...")
    login_response = client.post(
        "/api/auth/login",
        json={"username": "2", "password": "a1"},
        headers={"Content-Type": "application/json"},
    )
    print(f"   Status: {login_response.status_code}")
    login_data = login_response.get_json()
    print(f"   Response (sin user): ok={login_data.get('ok')}")

    if login_response.status_code == 200:
        print("   ✓ Login exitoso")
        print("   El test_client mantiene cookies automáticamente")

        # 3. Usar la misma sesión para aprobar solicitud 14 (cookies se envían automáticamente)
        print("\n3. Aprobando solicitud 14...")
        approve_response = client.post(
            "/api/solicitudes/14/decidir",
            json={"accion": "aprobar", "comentario": "Aprobada por Juan"},
            headers={"Content-Type": "application/json"},
        )
        print(f"   Status: {approve_response.status_code}")
        approve_data = approve_response.get_json()
        print(f"   Response: {json.dumps(approve_data, indent=2, ensure_ascii=False)}")

        # 4. Verificar estado en BD
        print("\n4. Verificando estado en BD...")
        with sqlite3.connect(DB_PATH) as con:
            con.row_factory = lambda cursor, row: {
                col[0]: row[idx] for idx, col in enumerate(cursor.description)
            }
            sol = con.execute(
                "SELECT id, aprobador_id, planner_id, status FROM solicitudes WHERE id=14"
            ).fetchone()
            print(f"   {json.dumps(sol, indent=2, default=str)}")
    else:
        print("   ✗ Login falló, no se puede continuar con la aprobación")

print("\n✓ Test completado")
