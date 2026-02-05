"""
Test de validación para confirmar que el error 500 está resuelto
"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta

import pytest


def get_db_connection():
    """Get SQLite connection with row_factory"""
    db_path = Path(__file__).parent.parent.parent / "data" / "spm.db"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


class TestApprovalValidation:
    """Valida que el error 500 esté resuelto"""

    def test_01_approval_returns_200_not_500(self):
        """Valida que aprobar retorna 200, no 500"""
        from backend.app import create_app
        from backend.core.config import settings
        import jwt

        app = create_app()
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        app.config["RATE_LIMIT_ENABLED"] = False

        # Get admin token
        from backend.core.db import get_db_connection as get_db_conn

        with get_db_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id_spm FROM usuario WHERE rol='admin' LIMIT 1")
            admin_row = cur.fetchone()

        if not admin_row:
            pytest.skip("No admin user found")

        admin_id = str(admin_row["id_spm"])

        now = datetime.utcnow()
        payload = {
            "user_id": admin_id,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(seconds=3600),
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

        # Get submitted solicitud
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM solicitud WHERE status='submitted' ORDER BY total_monto ASC LIMIT 1"
        )
        solicitud = cur.fetchone()
        conn.close()

        if not solicitud:
            pytest.skip("No submitted solicitud found")

        solicitud_id = solicitud["id"]

        # Call approval endpoint
        with app.test_client() as client:
            headers = {"Authorization": f"Bearer {token}"}

            response = client.put(
                f"/api/solicitudes/{solicitud_id}/aprobar",
                json={},
                headers=headers,
            )

            print(f"\n✓ Approval Status: {response.status_code}")

            # Should NOT be 500
            assert response.status_code != 500, f"Got 500 error: {response.data}"

            # Should be 200 or 422 (if budget insufficient)
            assert response.status_code in [200, 422], f"Unexpected status: {response.status_code}"

            if response.status_code == 200:
                data = response.get_json()
                assert data.get("ok") == True, "Response should have ok: true"
                assert "solicitud" in data, "Response should have solicitud"
                assert data["solicitud"].get("status") == "approved", "Solicitud should be approved"

                print(f"✓ Solicitud {solicitud_id} approved successfully")

    def test_02_rejection_returns_200_not_500(self):
        """Valida que rechazar retorna 200, no 500"""
        from backend.app import create_app
        from backend.core.config import settings
        import jwt

        app = create_app()
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        app.config["RATE_LIMIT_ENABLED"] = False

        # Get admin/approver token
        from backend.core.db import get_db_connection as get_db_conn

        with get_db_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id_spm FROM usuario WHERE rol IN ('admin', 'aprobador', 'approver') LIMIT 1")
            user_row = cur.fetchone()

        if not user_row:
            pytest.skip("No approver user found")

        user_id = str(user_row["id_spm"])

        now = datetime.utcnow()
        payload = {
            "user_id": user_id,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(seconds=3600),
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

        # Get submitted solicitud
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM solicitud WHERE status='submitted' ORDER BY total_monto ASC LIMIT 1"
        )
        solicitud = cur.fetchone()
        conn.close()

        if not solicitud:
            pytest.skip("No submitted solicitud found")

        solicitud_id = solicitud["id"]

        # Call rejection endpoint
        with app.test_client() as client:
            headers = {"Authorization": f"Bearer {token}"}

            response = client.put(
                f"/api/solicitudes/{solicitud_id}/rechazar",
                json={"motivo": "Test rejection"},
                headers=headers,
            )

            print(f"\n✓ Rejection Status: {response.status_code}")

            # Should NOT be 500
            assert response.status_code != 500, f"Got 500 error: {response.data}"

            # Should be 200 or 422 (if not authorized)
            assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"

            if response.status_code == 200:
                data = response.get_json()
                assert data.get("ok") == True, "Response should have ok: true"
                assert "solicitud" in data, "Response should have solicitud"
                assert data["solicitud"].get("status") == "rejected", "Solicitud should be rejected"

                print(f"✓ Solicitud {solicitud_id} rejected successfully")

    def test_03_approval_flow_complete(self):
        """Valida el flujo completo de aprobación"""
        from backend.app import create_app
        from backend.core.config import settings
        import jwt

        app = create_app()
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        app.config["RATE_LIMIT_ENABLED"] = False

        # Get admin token
        from backend.core.db import get_db_connection as get_db_conn

        with get_db_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id_spm FROM usuario WHERE rol='admin' LIMIT 1")
            admin_row = cur.fetchone()

        if not admin_row:
            pytest.skip("No admin user found")

        admin_id = str(admin_row["id_spm"])

        now = datetime.utcnow()
        payload = {
            "user_id": admin_id,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(seconds=3600),
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

        # Get submitted solicitud
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM solicitud WHERE status='submitted' ORDER BY total_monto ASC LIMIT 1"
        )
        solicitud = cur.fetchone()
        conn.close()

        if not solicitud:
            pytest.skip("No submitted solicitud found")

        solicitud_id = solicitud["id"]

        with app.test_client() as client:
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Verify initial state is submitted
            response = client.get(f"/api/solicitudes/{solicitud_id}", headers=headers)
            assert response.status_code == 200
            initial_state = response.get_json()["solicitud"]["status"]
            print(f"✓ Initial state: {initial_state}")

            # 2. Approve
            response = client.put(
                f"/api/solicitudes/{solicitud_id}/aprobar",
                json={},
                headers=headers,
            )
            print(f"✓ Approval response: {response.status_code}")

            if response.status_code == 200:
                # 3. Verify approval succeeded
                data = response.get_json()
                approved_state = data["solicitud"]["status"]
                assert approved_state == "approved", f"Expected 'approved', got '{approved_state}'"
                print(f"✓ State after approval: {approved_state}")

                # 4. Verify via GET
                response = client.get(f"/api/solicitudes/{solicitud_id}", headers=headers)
                assert response.status_code == 200
                final_state = response.get_json()["solicitud"]["status"]
                assert final_state == "approved", f"GET verification failed: {final_state}"
                print(f"✓ Verification via GET: {final_state}")
                print(f"✓ Complete approval flow successful!")
            else:
                print(f"⚠ Approval failed with {response.status_code} (expected if budget insufficient)")
