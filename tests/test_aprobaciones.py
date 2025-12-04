"""
Pruebas de aprobación/rechazo:
- Solicitud pasa de pendiente -> aprobada
- Solicitud pasa de pendiente -> rechazada
"""

import os
import sqlite3

import pytest
from src.backend.app import create_app

DB_PATH = "src/backend/core/data/spm.db"


@pytest.fixture(scope="module")
def client():
    os.environ["AUTH_BYPASS"] = "1"
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def _seed_aprobador(sol_id: int, approver_id: str):
    con = sqlite3.connect(DB_PATH)
    con.execute("UPDATE solicitudes SET aprobador_id=? WHERE id=?", (approver_id, sol_id))
    con.commit()
    con.close()


def _crear_solicitud_pendiente(client):
    base_payload = {
        "centro": "1008",
        "sector": "Mantenimiento",
        "justificacion": "Test aprobaciones",
        "centro_costos": "CC-APROB",
        "almacen_virtual": "ALM-01",
        "criticidad": "Normal",
        "fecha_necesidad": "2025-12-31",
        "items": [
            {
                "codigo": "1000000006",
                "descripcion": "ITEM APROB",
                "cantidad": 1,
                "precio_unitario": 10.0,
            }
        ],
        "total_monto": 10.0,
    }
    r = client.post("/api/solicitudes", json=base_payload)
    assert r.status_code == 200
    sol_id = r.get_json()["id"]
    return sol_id


def test_aprobar_solicitud_pendiente(client):
    sol_id = _crear_solicitud_pendiente(client)
    # fuerza que el aprobador asignado sea el propio usuario (AUTH_BYPASS user id "1")
    _seed_aprobador(sol_id, "1")

    r = client.post(f"/api/solicitudes/{sol_id}/decidir", json={"accion": "aprobar"})
    assert r.status_code == 200
    data = r.get_json()
    assert data["ok"] is True
    assert data["status"] in ("en_tratamiento", "aprobada")
    decision = data.get("decision", {})
    assert decision.get("decided_by") == "1"
    assert "decided_at" in decision


def test_rechazar_solicitud_pendiente(client):
    sol_id = _crear_solicitud_pendiente(client)
    _seed_aprobador(sol_id, "1")

    r = client.post(
        f"/api/solicitudes/{sol_id}/decidir",
        json={"accion": "rechazar", "comentario": "No procede"},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert data["ok"] is True
    assert data["status"] == "rechazada"
    decision = data.get("decision", {})
    assert decision.get("decided_by") == "1"
    assert "decided_at" in decision
