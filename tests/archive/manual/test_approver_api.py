import requests  # !/usr/bin/env python3

import json"""

Test script to verify approver workflow via API

BASE = "http://localhost:5000""""



# 1. Loginimport requests

print("1. Intentando login como admin...")import json

r = requests.post(f"{BASE}/api/auth/login", json={from urllib3.exceptions import InsecureRequestWarning

    "email": "manuelremon@live.com.ar",

    "password": "Admin123!"# Disable SSL warnings for local testing

})requests.packages.urllib3.disable_warnings(InsecureRequestWarning)



if r.status_code == 200:BASE_URL = "http://localhost:5000"

    data = r.json()SESSION = requests.Session()

    token = data.get('token')SESSION.verify = False

    print(f"✓ Login exitoso, token: {token[:20]}...")

    def test_approver_workflow():

    # 2. Acceder a dashboard de aprobador    print("=" * 70)

    headers = {'Authorization': f'Bearer {token}'}    print("TEST: Approver Workflow")

        print("=" * 70)

    print("\n2. Accediendo a /api/approver/dashboard...")

    r = requests.get(f"{BASE}/api/approver/dashboard", headers=headers)    # Test 1: Login as admin (who is also Aprobador)

    print(f"Status: {r.status_code}")    print("\n1. LOGIN AS ADMIN...")

    print(f"Response: {json.dumps(r.json(), indent=2)}")    login_data = {

            "username": "admin@spm.com",

    # 3. Acceder a lista de solicitudes        "password": "admin"

    print("\n3. Accediendo a /api/approver/solicitudes...")    }

    r = requests.get(f"{BASE}/api/approver/solicitudes", headers=headers)

    print(f"Status: {r.status_code}")    resp = SESSION.post(f"{BASE_URL}/api/auth/login", json=login_data)

    print(f"Response: {json.dumps(r.json(), indent=2)}")    print(f"  Status: {resp.status_code}")

else:    if resp.status_code != 200:

    print(f"✗ Login fallido: {r.status_code}")        print(f"  ERROR: {resp.text}")

    print(f"Response: {r.text}")        return


    print("  ✓ Logged in successfully")

    # Test 2: Get current user info
    print("\n2. GET CURRENT USER...")
    resp = SESSION.get(f"{BASE_URL}/api/me")
    print(f"  Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        user = data.get("usuario", {})
        print(f"  ✓ User: {user.get('nombre')} {user.get('apellido')}")
        print(f"    Email: {user.get('mail')}")
        print(f"    Rol (combined): {user.get('rol')}")
        print(f"    Roles (list): {user.get('roles')}")
    else:
        print(f"  ERROR: {resp.text}")
        return

    # Test 3: Check approver dashboard
    print("\n3. GET APPROVER DASHBOARD...")
    resp = SESSION.get(f"{BASE_URL}/api/approver/dashboard")
    print(f"  Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        print(f"  ✓ Dashboard loaded:")
        print(f"    Pending: {data.get('pending', 0)}")
        print(f"    Approved: {data.get('approved', 0)}")
        print(f"    Rejected: {data.get('rejected', 0)}")
    else:
        print(f"  ERROR: {resp.text}")
        return

    # Test 4: Get pending solicitudes
    print("\n4. GET PENDING SOLICITUDES...")
    resp = SESSION.get(f"{BASE_URL}/api/approver/solicitudes")
    print(f"  Status: {resp.status_code}")

    if resp.status_code == 200:
        data = resp.json()
        items = data.get("items", [])
        print(f"  ✓ Found {len(items)} solicitudes")
        for item in items[:3]:
            print(f"    - ID: {item.get('id')}, Centro: {item.get('centro')}, Status: {item.get('status')}")
    else:
        print(f"  ERROR: {resp.text}")
        return

    print("\n" + "=" * 70)
    print("✓ ALL TESTS PASSED")
    print("=" * 70)

if __name__ == "__main__":
    test_approver_workflow()
