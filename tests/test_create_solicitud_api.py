#!/usr/bin/env python3
"""Prueba: login -> crear solicitud via API -> verificar en BD"""

import json
import sqlite3
from time import sleep

import requests

BASE = "http://127.0.0.1:5000"
LOGIN_URL = BASE + "/api/auth/login"
CREATE_URL = BASE + "/api/solicitudes"
DB_PATH = "src/backend/core/data/spm.db"

LOGIN = {"username": "2", "password": "a1"}

print("Login y crear solicitud test")

s = requests.Session()
resp = s.post(LOGIN_URL, json=LOGIN)
print("Login status:", resp.status_code)
if resp.status_code != 200:
    print(resp.text)
    raise SystemExit(1)

# Extraer token desde cookie o json
token = None
if "access_token" in s.cookies:
    token = s.cookies.get("access_token")
else:
    try:
        token = resp.json().get("access_token")
    except:
        token = None

if not token:
    print("No token found, abort")
    raise SystemExit(1)

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

payload = {
    "centro": "1008",
    "sector": "Mantenimiento",
    "justificacion": "Prueba automatizada - crear solicitud",
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

print("Creando solicitud...")
r = requests.post(CREATE_URL, json=payload, headers=headers)
print("Create status:", r.status_code)
print(r.text)

# Verificar en DB
sleep(0.5)
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
# Buscar ultima solicitud del usuario 2 con la justificacion
c.execute(
    "SELECT id, data_json, status, total_monto FROM solicitudes WHERE id_usuario = ? ORDER BY created_at DESC LIMIT 1",
    (2,),
)
row = c.fetchone()
if not row:
    print("No se encontró la solicitud en la BD")
    raise SystemExit(1)

print("Encontrado en BD:", row[0], "status=", row[2], "total=", row[3])
try:
    data = json.loads(row[1])
    print("Items in data_json:", len(data.get("items", [])))
except Exception as e:
    print("Error parsing data_json:", e)

conn.close()
