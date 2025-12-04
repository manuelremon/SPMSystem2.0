#!/usr/bin/env python3
"""Simula aprobación de una solicitud usando Flask test_client."""

import json
import os

os.environ["AUTH_BYPASS"] = "1"
from src.backend.app import create_app

app = create_app()

# Payload para decidir (aprobar)
payload = {"accion": "aprobar", "comentario": "Solicitud aprobada en prueba automática"}

with app.test_client() as client:
    # Intentar aprobar la solicitud 13
    r = client.post("/api/solicitudes/13/decidir", json=payload)
    print("Decidir status:", r.status_code)
    print("Response:", json.dumps(r.get_json(), indent=2, default=str)[:500])

# Verificar en BD
import sqlite3

db_path = os.path.join(os.path.dirname(__file__), "src", "backend", "core", "data", "spm.db")
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
c = conn.cursor()

sol = c.execute(
    "SELECT id, status, aprobador_id, planner_id FROM solicitudes WHERE id=13"
).fetchone()
if sol:
    print("\n✓ Estado en BD después de aprobación:")
    print(
        f"  ID: {sol['id']}, Status: {sol['status']}, Aprobador: {sol['aprobador_id']}, Planner: {sol['planner_id']}"
    )
else:
    print("✗ Solicitud 13 no encontrada")

conn.close()
