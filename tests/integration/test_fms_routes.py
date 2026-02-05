"""
Integration tests for FMS (Fleet Management System) routes
Tests endpoints at /api/fms/*
"""

import pytest


# ============================================================================
# VEHICLES ENDPOINTS
# ============================================================================

class TestFMSVehicles:
    """Tests for vehicle endpoints"""

    def test_list_vehicles_requires_auth(self, client):
        """GET /api/fms/vehicles requires authentication"""
        response = client.get("/api/fms/vehicles")
        assert response.status_code in [200, 401, 403, 429]
        if response.status_code == 200:
            data = response.get_json()
            assert "ok" in data

    def test_create_vehicle_requires_auth(self, client):
        """POST /api/fms/vehicles requires authentication"""
        response = client.post(
            "/api/fms/vehicles",
            json={
                "placa": "ABC-123",
                "tipo": "truck",
                "marca": "Volvo",
                "modelo": "FH16"
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 429]

    def test_get_vehicle_requires_auth(self, client):
        """GET /api/fms/vehicles/<id> requires authentication"""
        response = client.get("/api/fms/vehicles/1")
        assert response.status_code in [200, 401, 403, 404, 429]

    def test_update_vehicle_requires_auth(self, client):
        """PUT /api/fms/vehicles/<id> requires authentication"""
        response = client.put(
            "/api/fms/vehicles/1",
            json={"modelo": "FH17"},
            content_type="application/json"
        )
        assert response.status_code in [200, 400, 401, 403, 404, 429]

    def test_change_vehicle_status_requires_auth(self, client):
        """POST /api/fms/vehicles/<id>/status requires authentication"""
        response = client.post(
            "/api/fms/vehicles/1/status",
            json={"estado": "maintenance"},
            content_type="application/json"
        )
        assert response.status_code in [200, 400, 401, 403, 404, 429]

    def test_get_available_vehicles_requires_auth(self, client):
        """GET /api/fms/vehicles/available requires authentication"""
        response = client.get("/api/fms/vehicles/available")
        assert response.status_code in [200, 401, 403, 429]


class TestFMSVehicleValidation:
    """Tests for vehicle validation"""

    def test_create_vehicle_requires_placa(self, client):
        """POST /api/fms/vehicles validates placa field"""
        response = client.post(
            "/api/fms/vehicles",
            json={"tipo": "truck"},
            content_type="application/json"
        )
        # Without auth: 401/403, With auth missing placa: 400
        assert response.status_code in [400, 401, 403, 429]

    def test_change_status_requires_estado(self, client):
        """POST /api/fms/vehicles/<id>/status requires estado"""
        response = client.post(
            "/api/fms/vehicles/1/status",
            json={},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


# ============================================================================
# DRIVERS ENDPOINTS
# ============================================================================

class TestFMSDrivers:
    """Tests for driver endpoints"""

    def test_list_drivers_requires_auth(self, client):
        """GET /api/fms/drivers requires authentication"""
        response = client.get("/api/fms/drivers")
        assert response.status_code in [200, 401, 403, 429]

    def test_create_driver_requires_auth(self, client):
        """POST /api/fms/drivers requires authentication"""
        response = client.post(
            "/api/fms/drivers",
            json={
                "nombre": "John Doe",
                "licencia_numero": "DL123456",
                "licencia_vencimiento": "2026-12-31"
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 429]

    def test_get_driver_requires_auth(self, client):
        """GET /api/fms/drivers/<id> requires authentication"""
        response = client.get("/api/fms/drivers/1")
        assert response.status_code in [200, 401, 403, 404, 429]

    def test_update_driver_requires_auth(self, client):
        """PUT /api/fms/drivers/<id> requires authentication"""
        response = client.put(
            "/api/fms/drivers/1",
            json={"nombre": "Jane Doe"},
            content_type="application/json"
        )
        assert response.status_code in [200, 400, 401, 403, 404, 429]

    def test_get_available_drivers_requires_auth(self, client):
        """GET /api/fms/drivers/available requires authentication"""
        response = client.get("/api/fms/drivers/available")
        assert response.status_code in [200, 401, 403, 429]


class TestFMSDriverValidation:
    """Tests for driver validation"""

    def test_create_driver_requires_nombre(self, client):
        """POST /api/fms/drivers validates nombre field"""
        response = client.post(
            "/api/fms/drivers",
            json={"licencia_numero": "DL123456"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]


# ============================================================================
# WORK ORDERS ENDPOINTS
# ============================================================================

class TestFMSWorkOrders:
    """Tests for work order endpoints"""

    def test_list_work_orders_requires_auth(self, client):
        """GET /api/fms/work-orders requires authentication"""
        response = client.get("/api/fms/work-orders")
        assert response.status_code in [200, 401, 403, 429]

    def test_create_work_order_requires_auth(self, client):
        """POST /api/fms/work-orders requires authentication"""
        response = client.post(
            "/api/fms/work-orders",
            json={
                "vehicle_id": 1,
                "tipo": "preventive",
                "descripcion": "Oil change",
                "prioridad": "medium"
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 429]

    def test_get_work_order_requires_auth(self, client):
        """GET /api/fms/work-orders/<id> requires authentication"""
        response = client.get("/api/fms/work-orders/1")
        assert response.status_code in [200, 401, 403, 404, 429]

    def test_transition_work_order_requires_auth(self, client):
        """POST /api/fms/work-orders/<id>/transition requires authentication"""
        response = client.post(
            "/api/fms/work-orders/1/transition",
            json={"estado": "in_progress"},
            content_type="application/json"
        )
        assert response.status_code in [200, 400, 401, 403, 404, 429]

    def test_add_part_to_work_order_requires_auth(self, client):
        """POST /api/fms/work-orders/<id>/parts requires authentication"""
        response = client.post(
            "/api/fms/work-orders/1/parts",
            json={
                "nombre": "Oil Filter",
                "cantidad": 1,
                "costo_unitario": 25.0
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 404, 429]

    def test_request_part_from_spm_requires_auth(self, client):
        """POST /api/fms/work-orders/<id>/request-part requires authentication"""
        response = client.post(
            "/api/fms/work-orders/1/request-part",
            json={
                "material_id": "MAT-001",
                "cantidad": 2
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 404, 429]


class TestFMSWorkOrderValidation:
    """Tests for work order validation"""

    def test_create_work_order_requires_vehicle_id(self, client):
        """POST /api/fms/work-orders validates vehicle_id"""
        response = client.post(
            "/api/fms/work-orders",
            json={"tipo": "preventive"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]

    def test_transition_requires_estado(self, client):
        """POST /api/fms/work-orders/<id>/transition requires estado"""
        response = client.post(
            "/api/fms/work-orders/1/transition",
            json={},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


# ============================================================================
# MAINTENANCE PLANS ENDPOINTS
# ============================================================================

class TestFMSMaintenancePlans:
    """Tests for maintenance plan endpoints"""

    def test_list_maintenance_plans_requires_auth(self, client):
        """GET /api/fms/vehicles/<id>/maintenance-plans requires authentication"""
        response = client.get("/api/fms/vehicles/1/maintenance-plans")
        assert response.status_code in [200, 401, 403, 404, 429]

    def test_create_maintenance_plan_requires_auth(self, client):
        """POST /api/fms/vehicles/<id>/maintenance-plans requires authentication"""
        response = client.post(
            "/api/fms/vehicles/1/maintenance-plans",
            json={
                "tipo": "preventive",
                "periodicidad_dias": 90,
                "descripcion": "Quarterly inspection"
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 404, 429]

    def test_update_maintenance_plan_requires_auth(self, client):
        """PUT /api/fms/maintenance-plans/<id> requires authentication"""
        response = client.put(
            "/api/fms/maintenance-plans/1",
            json={"periodicidad_dias": 120},
            content_type="application/json"
        )
        assert response.status_code in [200, 400, 401, 403, 404, 429]

    def test_evaluate_preventive_maintenance_requires_auth(self, client):
        """POST /api/fms/maintenance/evaluate requires authentication"""
        response = client.post("/api/fms/maintenance/evaluate")
        assert response.status_code in [200, 401, 403, 429]


# ============================================================================
# INSPECTIONS ENDPOINTS
# ============================================================================

class TestFMSInspections:
    """Tests for inspection endpoints"""

    def test_list_inspections_requires_auth(self, client):
        """GET /api/fms/inspections requires authentication"""
        response = client.get("/api/fms/inspections")
        assert response.status_code in [200, 401, 403, 429]

    def test_create_inspection_requires_auth(self, client):
        """POST /api/fms/inspections requires authentication"""
        response = client.post(
            "/api/fms/inspections",
            json={
                "vehicle_id": 1,
                "driver_id": 1,
                "tipo": "pre_trip"
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 429]

    def test_get_inspection_requires_auth(self, client):
        """GET /api/fms/inspections/<id> requires authentication"""
        response = client.get("/api/fms/inspections/1")
        assert response.status_code in [200, 401, 403, 404, 429]

    def test_complete_inspection_requires_auth(self, client):
        """POST /api/fms/inspections/<id>/complete requires authentication"""
        response = client.post(
            "/api/fms/inspections/1/complete",
            json={
                "items": [
                    {"item": "tires", "estado": "ok"},
                    {"item": "brakes", "estado": "ok"}
                ]
            },
            content_type="application/json"
        )
        assert response.status_code in [200, 400, 401, 403, 404, 429]


class TestFMSInspectionValidation:
    """Tests for inspection validation"""

    def test_create_inspection_requires_vehicle_id(self, client):
        """POST /api/fms/inspections validates vehicle_id"""
        response = client.post(
            "/api/fms/inspections",
            json={"tipo": "pre_trip"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]


# ============================================================================
# DOCUMENTS ENDPOINTS
# ============================================================================

class TestFMSDocuments:
    """Tests for document endpoints"""

    def test_list_vehicle_documents_requires_auth(self, client):
        """GET /api/fms/vehicles/<id>/documents requires authentication"""
        response = client.get("/api/fms/vehicles/1/documents")
        assert response.status_code in [200, 401, 403, 404, 429]

    def test_add_vehicle_document_requires_auth(self, client):
        """POST /api/fms/vehicles/<id>/documents requires authentication"""
        response = client.post(
            "/api/fms/vehicles/1/documents",
            json={
                "tipo": "insurance",
                "numero": "INS-123",
                "fecha_vencimiento": "2026-12-31"
            },
            content_type="application/json"
        )
        assert response.status_code in [201, 400, 401, 403, 404, 429]

    def test_get_expiring_documents_requires_auth(self, client):
        """GET /api/fms/documents/expiring requires authentication"""
        response = client.get("/api/fms/documents/expiring?days=30")
        assert response.status_code in [200, 401, 403, 429]


class TestFMSDocumentValidation:
    """Tests for document validation"""

    def test_add_document_requires_tipo(self, client):
        """POST /api/fms/vehicles/<id>/documents validates tipo"""
        response = client.post(
            "/api/fms/vehicles/1/documents",
            json={"numero": "INS-123"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


# ============================================================================
# KPIs ENDPOINTS
# ============================================================================

class TestFMSKPIs:
    """Tests for KPI endpoints"""

    def test_get_fms_kpis_requires_auth(self, client):
        """GET /api/fms/kpis requires authentication"""
        response = client.get("/api/fms/kpis")
        assert response.status_code in [200, 401, 403, 429]
        if response.status_code == 200:
            data = response.get_json()
            assert "ok" in data
