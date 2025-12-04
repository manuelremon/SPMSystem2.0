#!/usr/bin/env python
"""Test script to verify solicitud loading works"""

from http.cookiejar import CookieJar

import requests

# Create a session with cookie jar
session = requests.Session()
cookie_jar = CookieJar()
session.cookies = cookie_jar

# First, login
print("1. Logging in...")
login_response = session.post(
    "http://127.0.0.1:5000/api/auth/login",
    json={
        "id_spm": "usuario@spm.com",
        "contrasena": "password",  # adjust if needed
    },
)
print(f"   Login response: {login_response.status_code}")
print(f"   Response: {login_response.text[:200]}")

# Now fetch solicitudes
print("\n2. Fetching user solicitudes...")
solicitudes_response = session.get(
    "http://127.0.0.1:5000/api/solicitudes", headers={"Accept": "application/json"}
)
print(f"   Response status: {solicitudes_response.status_code}")
if solicitudes_response.ok:
    data = solicitudes_response.json()
    print(f"   Items: {len(data.get('items', []))}")
    for item in data.get("items", []):
        print(f"   - ID {item['id']}: {item['centro']} / {item['sector']}")
else:
    print(f"   Error: {solicitudes_response.text[:200]}")
