"""
Pruebas de flujo completo de solicitudes:
- Crear borrador
- Agregar materiales (PATCH draft)
- Finalizar (PUT) a pendiente_de_aprobacion
Incluye validación de materiales inválidos.
"""

import os

import pytest
from src.backend.app import create_app


@pytest.fixture(scope="module")
def client():
    # Habilita bypass de auth en dev/test
    os.environ["AUTH_BYPASS"] = "1"
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def _sum_total(items):
    return round(sum(i["cantidad"] * i["precio_unitario"] for i in items), 2)


def test_crear_agregar_finalizar_solicitud(client):
    base_payload = {
        "centro": "1008",
        "sector": "Mantenimiento",
        "justificacion": "Test flujo completo",
        "centro_costos": "CC-001",
        "almacen_virtual": "ALM-01",
        "criticidad": "Normal",
        "fecha_necesidad": "2025-12-31",
    }
    items = [
        {
            "codigo": "1000000006",
            "descripcion": "ITEM TEST 1",
            "cantidad": 2,
            "precio_unitario": 10.0,
            "unidad": "UN",
        },
        {
            "codigo": "1000000006",
            "descripcion": "ITEM TEST 2",
            "cantidad": 1,
            "precio_unitario": 5.5,
            "unidad": "UN",
        },
    ]
    total = _sum_total(items)

    # 1) Crear borrador
    r = client.post("/api/solicitudes/drafts", json=base_payload)
    assert r.status_code == 200
    data = r.get_json()
    assert data["ok"] is True
    sol_id = data["id"]
    assert data["status"] == "draft"

    # 2) PATCH draft con items
    r = client.patch(
        f"/api/solicitudes/{sol_id}/draft", json={"items": items, "total_monto": total}
    )
    assert r.status_code == 200
    patched = r.get_json()
    assert patched["ok"] is True
    assert patched["solicitud"]["status"] == "draft"
    assert patched["solicitud"]["total_monto"] == pytest.approx(total)

    # 3) Finalizar (PUT) a pendiente_de_aprobacion
    r = client.put(f"/api/solicitudes/{sol_id}", json={"items": items, "total_monto": total})
    assert r.status_code == 200
    finalized = r.get_json()
    assert finalized["ok"] is True
    assert finalized["solicitud"]["status"] == "pendiente_de_aprobacion"
    assert finalized["solicitud"]["total_monto"] == pytest.approx(total)


def test_materiales_invalidos_rechazados(client):
    base_payload = {
        "centro": "1008",
        "sector": "Mantenimiento",
        "justificacion": "Test materiales invalidos",
        "centro_costos": "CC-002",
        "almacen_virtual": "ALM-01",
        "criticidad": "Normal",
        "fecha_necesidad": "2025-12-31",
    }
    invalid_items = [
        {
            "codigo": "XYZ_NO_EXISTE",
            "descripcion": "INVALIDO",
            "cantidad": 1,
            "precio_unitario": 1.0,
        },
    ]

    r = client.post("/api/solicitudes/drafts", json=base_payload)
    assert r.status_code == 200
    sol_id = r.get_json()["id"]

    # PATCH con material inválido debe fallar 400
    r = client.patch(
        f"/api/solicitudes/{sol_id}/draft", json={"items": invalid_items, "total_monto": 1.0}
    )
    assert r.status_code == 400
    err = r.get_json()
    assert err["ok"] is False
    assert "material" in (err.get("error", {}).get("message", "").lower())
