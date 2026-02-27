#!/usr/bin/env python3
"""Test production endpoints after migration."""
import json
import urllib.request

BASE = "https://planifica-materiales.com/api"

# Login
data = json.dumps({"username": "1", "password": "spm-123"}).encode()
req = urllib.request.Request(
    f"{BASE}/auth/login", data=data,
    headers={"Content-Type": "application/json"}
)
resp = json.loads(urllib.request.urlopen(req).read())
token = resp["access_token"]
print(f"Login: OK (user={resp['user']['nombre']})")

headers = {"Authorization": f"Bearer {token}"}

# Solicitudes
req = urllib.request.Request(f"{BASE}/solicitudes", headers=headers)
d = json.loads(urllib.request.urlopen(req).read())
total = d.get("total", len(d.get("solicitudes", [])))
print(f"Solicitudes: {total} total")

# Catalogos
req = urllib.request.Request(f"{BASE}/catalogos", headers=headers)
d = json.loads(urllib.request.urlopen(req).read())
c = len(d.get("centros", []))
s = len(d.get("sectores", []))
a = len(d.get("almacenes", []))
print(f"Catalogos: centros={c}, sectores={s}, almacenes={a}")

# Materiales
req = urllib.request.Request(f"{BASE}/materiales?limit=5", headers=headers)
d = json.loads(urllib.request.urlopen(req).read())
total_mat = d.get("total", "?")
print(f"Materiales: {total_mat} total")

# Stock
try:
    req = urllib.request.Request(f"{BASE}/stock?limit=5", headers=headers)
    d = json.loads(urllib.request.urlopen(req).read())
    total_stock = d.get("total", len(d.get("items", d.get("stock", []))))
    print(f"Stock: {total_stock} registros")
except Exception as e:
    print(f"Stock: error - {e}")

# Presupuestos
try:
    req = urllib.request.Request(f"{BASE}/presupuestos", headers=headers)
    d = json.loads(urllib.request.urlopen(req).read())
    total_pres = len(d) if isinstance(d, list) else d.get("total", "?")
    print(f"Presupuestos: {total_pres}")
except Exception as e:
    print(f"Presupuestos: error - {e}")

print("\nAll endpoints tested!")
