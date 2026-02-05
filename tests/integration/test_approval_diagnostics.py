"""
Test Diagnóstico para Error 500 en Aprobaciones
Sprint: Diagnosis - Error 500 approval endpoints
"""

import json
import sqlite3
import traceback
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


def get_db_connection():
    """Get SQLite connection with row_factory"""
    db_path = Path(__file__).parent.parent.parent / "data" / "spm.db"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


class TestApprovalDiagnostics:
    """Pruebas de diagnóstico para identificar error 500"""

    def test_01_database_state_check(self):
        """Verificar estado actual de la BD"""
        conn = get_db_connection()
        cur = conn.cursor()

        # Check submitted solicitudes
        cur.execute(
            "SELECT id, status, id_usuario, aprobador_id, total_monto FROM solicitud WHERE status='submitted' LIMIT 1"
        )
        submitted = cur.fetchone()

        print("\n=== DATABASE STATE ===")
        print(f"Submitted Solicitudes Found: {submitted is not None}")
        if submitted:
            print(f"  ID: {submitted['id']}")
            print(f"  Usuario: {submitted['id_usuario']}")
            print(f"  Aprobador: {submitted['aprobador_id']}")
            print(f"  Monto: {submitted['total_monto']}")

        # Check usuarios
        cur.execute("SELECT COUNT(*) as cnt FROM usuario WHERE rol LIKE '%aprobador%'")
        aprobadores = cur.fetchone()["cnt"]
        print(f"Aprobadores en BD: {aprobadores}")

        cur.execute("SELECT COUNT(*) as cnt FROM usuario WHERE rol = 'admin'")
        admins = cur.fetchone()["cnt"]
        print(f"Admins en BD: {admins}")

        # Check presupuesto table structure
        cur.execute("PRAGMA table_info(presupuesto)")
        cols = cur.fetchall()
        print(f"\nPresupuesto Table Columns: {[col['name'] for col in cols]}")

        # Check presupuesto_ledger table structure
        cur.execute("PRAGMA table_info(presupuesto_ledger)")
        cols = cur.fetchall()
        print(f"Presupuesto_Ledger Table Columns: {[col['name'] for col in cols]}")

        conn.close()
        assert submitted is not None, "No hay solicitudes submitted en la BD"

    def test_02_get_solicitud_endpoint_direct_call(self):
        """Probar endpoint GET /solicitudes/<id> directamente"""
        try:
            from backend.app import create_app
            from backend.core.config import settings
            from datetime import datetime, timedelta
            import jwt

            app = create_app()
            app.config["TESTING"] = True
            app.config["WTF_CSRF_ENABLED"] = False
            app.config["RATE_LIMIT_ENABLED"] = False

            # Crear token JWT de prueba (admin)
            from backend.core.db import get_db_connection as get_db_conn

            with get_db_conn() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id_spm FROM usuario WHERE rol='admin' LIMIT 1")
                admin_row = cur.fetchone()

            if not admin_row:
                pytest.skip("No admin user found in database")

            admin_id = admin_row["id_spm"]

            # Crear JWT correctamente
            now = datetime.utcnow()
            payload = {
                "user_id": str(admin_id),
                "type": "access",
                "iat": now,
                "exp": now + timedelta(seconds=3600),
            }
            token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

            # Obtener una solicitud submitted
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT id FROM solicitud WHERE status='submitted' LIMIT 1")
            solicitud = cur.fetchone()
            conn.close()

            if not solicitud:
                pytest.skip("No submitted solicitud found")

            solicitud_id = solicitud["id"]

            # Test GET endpoint (token en cookie)
            with app.test_client() as client:
                client.set_cookie("access_token", token, path="/")
                response = client.get(f"/api/solicitudes/{solicitud_id}")

                print(f"\n=== GET SOLICITUD RESPONSE ===")
                print(f"Status: {response.status_code}")
                print(f"Content-Type: {response.content_type}")

                if response.status_code == 200:
                    data = response.get_json()
                    print(f"OK: {data.get('ok')}")
                    if data.get("solicitud"):
                        solicitud_data = data["solicitud"]
                        print(f"Solicitud ID: {solicitud_data.get('id')}")
                        print(f"Status: {solicitud_data.get('status')}")
                        print(f"Items Count: {len(solicitud_data.get('items', []))}")
                        print(f"Total Monto: {solicitud_data.get('total_monto')}")
                else:
                    print(f"Error: {response.data}")

                assert response.status_code == 200, f"GET failed with {response.status_code}"

        except Exception as e:
            print(f"\n=== EXCEPTION IN GET SOLICITUD ===")
            print(f"Error: {e}")
            print(traceback.format_exc())
            raise

    def test_03_approval_flow_step_by_step(self):
        """Probar flujo de aprobación paso a paso"""
        try:
            from backend.app import create_app
            from backend.core.config import settings
            from datetime import datetime, timedelta
            import jwt

            app = create_app()
            app.config["TESTING"] = True
            app.config["WTF_CSRF_ENABLED"] = False
            app.config["RATE_LIMIT_ENABLED"] = False

            # 1. Get admin token
            from backend.core.db import get_db_connection as get_db_conn

            with get_db_conn() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id_spm, rol FROM usuario WHERE rol='admin' LIMIT 1")
                admin_row = cur.fetchone()

            if not admin_row:
                pytest.skip("No admin user found")

            admin_id = str(admin_row["id_spm"])
            admin_rol = admin_row["rol"]

            print(f"\n=== APPROVAL FLOW TEST ===")
            print(f"Admin ID: {admin_id}")
            print(f"Admin Rol: {admin_rol}")

            now = datetime.utcnow()
            payload = {
                "user_id": admin_id,
                "type": "access",
                "iat": now,
                "exp": now + timedelta(seconds=3600),
            }
            token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

            # 2. Get submitted solicitud with small amount (less than available budget)
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "SELECT id, status, id_usuario, total_monto, data_json FROM solicitud WHERE status='submitted' ORDER BY total_monto ASC LIMIT 5"
            )
            rows = cur.fetchall()
            conn.close()

            # Find first one that might fit budget
            solicitud = rows[0] if rows else None

            if not solicitud:
                pytest.skip("No submitted solicitud found")

            solicitud_id = solicitud["id"]
            print(f"Solicitud ID: {solicitud_id}")
            print(f"Status: {solicitud['status']}")
            print(f"Monto: {solicitud['total_monto']}")

            # 3. Call approval endpoint
            with app.test_client() as client:
                print("\n--- Calling PUT /api/solicitudes/<id>/aprobar ---")

                # Use Bearer token (exempt from CSRF)
                headers = {"Authorization": f"Bearer {token}"}

                response = client.put(
                    f"/api/solicitudes/{solicitud_id}/aprobar",
                    json={},
                    headers=headers,
                )

                print(f"Response Status: {response.status_code}")
                print(f"Content-Type: {response.content_type}")

                try:
                    data = response.get_json()
                    print(f"Response Data: {json.dumps(data, indent=2)}")
                except Exception as e:
                    print(f"Could not parse JSON: {e}")
                    print(f"Raw Data: {response.data[:500]}")

                if response.status_code != 200:
                    print(f"\n!!! APPROVAL FAILED WITH STATUS {response.status_code}")
                    if response.status_code == 500:
                        print("ERROR 500 DETECTED - This is the bug we're looking for!")

        except Exception as e:
            print(f"\n=== EXCEPTION IN APPROVAL FLOW ===")
            print(f"Error: {e}")
            print(traceback.format_exc())
            raise

    def test_04_fsm_cambiar_estado_direct(self):
        """Probar cambiar_estado() directamente sin HTTP"""
        try:
            from backend.core.fsm import cambiar_estado, EstadoSolicitud
            from backend.core.db import get_db_connection as get_db_conn

            print("\n=== FSM CAMBIAR_ESTADO DIRECT TEST ===")

            # Get submitted solicitud
            with get_db_conn() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id FROM solicitud WHERE status='submitted' LIMIT 1")
                solicitud = cur.fetchone()

            if not solicitud:
                pytest.skip("No submitted solicitud")

            solicitud_id = solicitud["id"]
            print(f"Solicitud ID: {solicitud_id}")

            # Attempt cambiar_estado
            print("Calling cambiar_estado(submitted -> approved)...")
            try:
                result = cambiar_estado(
                    solicitud_id=solicitud_id,
                    nuevo_estado=EstadoSolicitud.APPROVED,
                    actor_id="test-admin",
                    razon="Test approval",
                    metadata={"test": True},
                )
                print(f"Result: {result}")
            except Exception as e:
                print(f"Exception: {e}")
                print(traceback.format_exc())
                raise

        except Exception as e:
            print(f"\n=== EXCEPTION IN FSM TEST ===")
            print(f"Error: {e}")
            print(traceback.format_exc())
            raise

    def test_05_budget_service_direct(self):
        """Probar budget_service.aprobar_solicitud_con_presupuesto() directamente"""
        try:
            from backend.services.budget_service import aprobar_solicitud_con_presupuesto
            from backend.core.db import get_db_connection as get_db_conn

            print("\n=== BUDGET SERVICE DIRECT TEST ===")

            # Get submitted solicitud
            with get_db_conn() as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, id_usuario, centro, sector, total_monto FROM solicitud WHERE status='submitted' LIMIT 1"
                )
                row = cur.fetchone()
                solicitud = dict(row) if row else None

            if not solicitud:
                pytest.skip("No submitted solicitud")

            solicitud_id = solicitud["id"]
            print(f"Solicitud ID: {solicitud_id}")
            print(f"Monto: {solicitud.get('total_monto')}")
            print(f"Centro: {solicitud.get('centro')}")
            print(f"Sector: {solicitud.get('sector')}")

            # Call budget service
            print("Calling aprobar_solicitud_con_presupuesto()...")
            try:
                result = aprobar_solicitud_con_presupuesto(
                    solicitud_id=solicitud_id,
                    solicitud=solicitud,
                    aprobador_id="test-admin",
                    aprobador_rol="admin",
                    actor_ip="127.0.0.1",
                )
                print(f"Result: {result}")
            except Exception as e:
                print(f"Exception: {e}")
                print(traceback.format_exc())
                raise

        except Exception as e:
            print(f"\n=== EXCEPTION IN BUDGET SERVICE TEST ===")
            print(f"Error: {e}")
            print(traceback.format_exc())
            raise

    def test_06_check_imports_and_dependencies(self):
        """Verificar que todas las importaciones necesarias estén disponibles"""
        print("\n=== CHECKING IMPORTS ===")

        errors = []

        # Test critical imports
        imports_to_test = [
            ("backend.core.fsm", "cambiar_estado"),
            ("backend.services.budget_service", "aprobar_solicitud_con_presupuesto"),
            ("backend.routes.solicitudes", "aprobar_solicitud"),
            ("backend.core.db", "get_db_connection"),
            ("backend.services.sla_service", "resolver_alertas_solicitud"),
        ]

        for module_name, func_name in imports_to_test:
            try:
                module = __import__(module_name, fromlist=[func_name])
                func = getattr(module, func_name)
                print(f"✓ {module_name}.{func_name}")
            except Exception as e:
                msg = f"✗ {module_name}.{func_name}: {e}"
                print(msg)
                errors.append(msg)

        assert not errors, f"Import errors found:\n" + "\n".join(errors)
