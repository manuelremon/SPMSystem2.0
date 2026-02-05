"""
Test para capturar el error 500 completo con stack trace
"""

import json
import logging
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
import traceback
import sys

import pytest


def get_db_connection():
    """Get SQLite connection with row_factory"""
    db_path = Path(__file__).parent.parent.parent / "data" / "spm.db"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


class TestApprovalErrorCapture:
    """Captura el error 500 completo con stack trace"""

    def test_capture_full_error_500(self, caplog):
        """Captura el error 500 con stack trace completo"""
        from backend.app import create_app
        from backend.core.config import settings
        import jwt

        # Habilitar logging de ERROR
        caplog.set_level(logging.ERROR)

        app = create_app()
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        app.config["RATE_LIMIT_ENABLED"] = False
        app.config["PROPAGATE_EXCEPTIONS"] = True  # Propagar excepciones

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
            "SELECT id, status, id_usuario, total_monto, data_json, centro, sector FROM solicitud WHERE status='submitted' ORDER BY total_monto ASC LIMIT 1"
        )
        solicitud = cur.fetchone()
        conn.close()

        if not solicitud:
            pytest.skip("No submitted solicitud found")

        solicitud_id = solicitud["id"]

        print(f"\n\n{'=' * 100}")
        print(f"CAPTURE ERROR 500 TEST")
        print(f"{'=' * 100}")
        print(f"Solicitud ID: {solicitud_id}")
        print(f"Monto: {solicitud['total_monto']}")
        print(f"Centro: {solicitud['centro']}")
        print(f"Sector: {solicitud['sector']}")

        # Call approval endpoint
        with app.test_client() as client:
            # Enable exception propagation for test client
            app.config["PROPAGATE_EXCEPTIONS"] = True

            headers = {"Authorization": f"Bearer {token}"}

            print(f"\nCalling PUT /api/solicitudes/{solicitud_id}/aprobar...")

            response = client.put(
                f"/api/solicitudes/{solicitud_id}/aprobar",
                json={},
                headers=headers,
            )

            print(f"Response Status: {response.status_code}")

            if response.status_code == 500:
                print(f"\n{'=' * 100}")
                print(f"ERROR 500 CAPTURED!")
                print(f"{'=' * 100}")

                try:
                    data = response.get_json()
                    print(f"Response Data: {json.dumps(data, indent=2)}")
                except:
                    print(f"Response Data (raw): {response.data[:1000]}")

        # Print captured logs
        print(f"\n{'=' * 100}")
        print(f"CAPTURED LOGS")
        print(f"{'=' * 100}")
        for record in caplog.records:
            if record.levelname in ["ERROR", "CRITICAL"]:
                print(f"[{record.levelname}] {record.name}: {record.message}")
                if record.exc_info:
                    print(f"Exception: {record.exc_info[1]}")
                    print(f"Traceback:")
                    traceback.print_exception(*record.exc_info)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "-o", "log_cli=true", "-o", "log_cli_level=ERROR"])
