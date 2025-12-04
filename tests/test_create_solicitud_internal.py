#!/usr/bin/env python3
"""Crea una solicitud usando Flask test_client con AUTH_BYPASS=1 para evitar login (dev mode)."""

import os
from time import sleep

from src.backend.app import create_app

os.environ["AUTH_BYPASS"] = "1"
app = create_app()

payload = {
    "centro": "1008",
    "sector": "Mantenimiento",
    "justificacion": "Prueba interna - crear solicitud",
    "centro_costos": "CC-1008",
    "almacen_virtual": "ALM-1008",
    "fecha_necesidad": "2025-10-31",
    "items": [
        {
            "codigo": "1000562340",
            "descripcion": "ABRAZADERA 6X10",
            "cantidad": 10,
            "precio_unitario": 1500.0,
            "comentario": "",
        },
        {
            "codigo": "1000028839",
            "descripcion": "RODAMIENTO NSK",
            "cantidad": 2,
            "precio_unitario": 5000.0,
            "comentario": "",
        },
    ],
}

with app.test_client() as client:
    # POST para crear solicitud
    r = client.post("/api/solicitudes", json=payload)
    print("Create status:", r.status_code)
    try:
        print("Response:", r.get_json())
    except Exception:
        print("Response text:", r.data[:100])

    # buscar la última solicitud del usuario admin (bypass user id 'admin')
    # la ruta /api/solicitudes devuelve lista, usémosla.
    r2 = client.get("/api/solicitudes")
    print("List solicitudes status:", r2.status_code)
    data = r2.get_json() or {}
    total = len(data.get("items", []) if isinstance(data, dict) else (data or []))
    print("Total solicitudes list length (approx):", total)

    if isinstance(data, dict) and data.get("items"):
        recent = data["items"][0]
        print(
            "Most recent:",
            {k: recent.get(k) for k in ("id", "status", "justificacion", "total_monto")},
        )

# small sleep to ensure DB commit
sleep(0.2)
