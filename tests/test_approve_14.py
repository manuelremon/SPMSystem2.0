#!/usr/bin/env python
"""
Test: Aprobar solicitud 14 como usuario 2 (Juan, el aprobador).
"""

import json
import os
import sqlite3
import sys

# Cambiar a directorio correcto
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

from flask import Flask

# Crear app Flask mínima
app = Flask(__name__)
app.config["DATABASE"] = "src/backend/core/data/spm.db"

# Importar y registrar blueprints
from src.backend.routes.auth_routes import bp as auth_bp
from src.backend.routes.solicitudes import bp as solicitudes_bp

app.register_blueprint(solicitudes_bp)
app.register_blueprint(auth_bp)

print("=" * 60)
print("TEST: APROBAR SOLICITUD 14 COMO USUARIO 2 (APROBADOR)")
print("=" * 60)

with app.app_context():
    # Usar test_client
    client = app.test_client()

    # Intentar aprobar solicitud 14 como usuario 2 (con AUTH_BYPASS)
    print("\n1. Intentando aprobar solicitud 14...")
    print("   Usuario: 2 (Juan - aprobador asignado)")
    print("   Acción: aprobar")

    os.environ["AUTH_BYPASS"] = "1"
    os.environ["AUTH_BYPASS_UID"] = "2"

    response = client.post(
        "/api/solicitudes/14/decidir",
        json={"accion": "aprobar", "comentario": "Solicitud aprobada en prueba automática"},
        headers={"Content-Type": "application/json"},
    )

    print(f"\n   Status: {response.status_code}")
    try:
        data = response.get_json()
        print(f"   Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
    except:
        print(f"   Response (text): {response.data.decode()}")

    # Verificar estado en BD
    print("\n2. Verificando estado en BD...")
    DB_PATH = "src/backend/core/data/spm.db"
    with sqlite3.connect(DB_PATH) as con:
        con.row_factory = lambda cursor, row: {
            col[0]: row[idx] for idx, col in enumerate(cursor.description)
        }
        sol = con.execute(
            "SELECT id, id_usuario, aprobador_id, planner_id, status FROM solicitudes WHERE id=14"
        ).fetchone()
        print(f"   {json.dumps(sol, indent=2, ensure_ascii=False, default=str)}")

    os.environ.pop("AUTH_BYPASS", None)
    os.environ.pop("AUTH_BYPASS_UID", None)

print("\n✓ Test completado")
