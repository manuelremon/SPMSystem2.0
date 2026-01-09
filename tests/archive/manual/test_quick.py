#!/usr/bin/env python
import time

import requests

# No unicode characters to avoid encoding issues


def test():
    url_base = "http://localhost:5000"

    print("\n" + "=" * 70)
    print("TEST: APPROVALS API")
    print("=" * 70 + "\n")

    # Test 1: Health check
    print("[0] HEALTH CHECK...")
    try:
        resp = requests.get(f"{url_base}/api/health", timeout=2)
        print(f"    Status: {resp.status_code}")
        print("[HEALTH OK]\n")
    except Exception as e:
        print(f"    ERROR: {str(e)[:100]}")
        print("[HEALTH FAILED - SERVER NOT RESPONDING]\n")
        return False

    # Test 2: Login
    print("[1] LOGIN...")
    try:
        login_data = {"email": "admin@example.com", "password": "admin123"}
        resp = requests.post(f"{url_base}/api/auth/login", json=login_data, timeout=5)
        print(f"    Status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            if token:
                print("    Token: OK")
                print("[LOGIN SUCCESS]\n")
            else:
                print("    ERROR: No token in response")
                print("[LOGIN FAILED]\n")
                return False
        else:
            print(f"    ERROR: Status {resp.status_code}")
            print(f"    Response: {resp.text[:200]}")
            print("[LOGIN FAILED]\n")
            return False
    except Exception as e:
        print(f"    ERROR: {str(e)[:100]}")
        print("[LOGIN FAILED]\n")
        return False

    # Test 3: Dashboard
    print("[2] DASHBOARD...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{url_base}/api/approver/dashboard", headers=headers, timeout=5)
        print(f"    Status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            print(f"    Pending: {data.get('pending_count', 0)}")
            print(f"    Approved: {data.get('approved_count', 0)}")
            print(f"    Rejected: {data.get('rejected_count', 0)}")
            print("[DASHBOARD OK]\n")
        else:
            print(f"    ERROR: Status {resp.status_code}")
            print("[DASHBOARD FAILED]\n")
            return False
    except Exception as e:
        print(f"    ERROR: {str(e)[:100]}")
        print("[DASHBOARD FAILED]\n")
        return False

    # Test 4: List Solicitudes
    print("[3] SOLICITUDES...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{url_base}/api/approver/solicitudes", headers=headers, timeout=5)
        print(f"    Status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            solicitudes = data.get("solicitudes", [])
            print(f"    Total: {len(solicitudes)}")
            for sol in solicitudes[:2]:
                print(f"      - ID: {sol.get('id')}, Centro: {sol.get('centro_id')}")
            print("[SOLICITUDES OK]\n")
            return True
        else:
            print(f"    ERROR: Status {resp.status_code}")
            print("[SOLICITUDES FAILED]\n")
            return False
    except Exception as e:
        print(f"    ERROR: {str(e)[:100]}")
        print("[SOLICITUDES FAILED]\n")
        return False


if __name__ == "__main__":
    time.sleep(1)
    success = test()
    if success:
        print("=" * 70)
        print("ALL TESTS PASSED - SYSTEM WORKING")
        print("=" * 70 + "\n")
    else:
        print("=" * 70)
        print("SOME TESTS FAILED")
        print("=" * 70 + "\n")
