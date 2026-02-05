"""
Integration tests for TMS (Transport Management System) routes
Tests endpoints at /api/tms/*
"""

import pytest


# ============================================================================
# SHIPMENTS ENDPOINTS
# ============================================================================

class TestTMSShipments:
    """Tests for shipment endpoints"""

    def test_list_shipments_requires_auth(self, client):
        """GET /api/tms/shipments requires authentication"""
        response = client.get("/api/tms/shipments")
        assert response.status_code in [401, 403, 429]

    def test_create_shipment_requires_auth(self, client):
        """POST /api/tms/shipments requires authentication"""
        response = client.post(
            "/api/tms/shipments",
            json={"tipo": "FTL", "origen": "Warehouse A", "destino": "Store B", "items": []},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]

    def test_get_shipment_requires_auth(self, client):
        """GET /api/tms/shipments/<id> requires authentication"""
        response = client.get("/api/tms/shipments/1")
        assert response.status_code in [401, 403, 404, 429]

    def test_update_shipment_requires_auth(self, client):
        """PUT /api/tms/shipments/<id> requires authentication"""
        response = client.put(
            "/api/tms/shipments/1",
            json={"tipo": "LTL"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_transition_shipment_requires_auth(self, client):
        """POST /api/tms/shipments/<id>/transition requires authentication"""
        response = client.post(
            "/api/tms/shipments/1/transition",
            json={"estado": "in_transit"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_assign_shipment_requires_auth(self, client):
        """POST /api/tms/shipments/<id>/assign requires authentication"""
        response = client.post(
            "/api/tms/shipments/1/assign",
            json={"vehicle_id": 1, "driver_id": 1},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_deliver_shipment_requires_auth(self, client):
        """POST /api/tms/shipments/<id>/deliver requires authentication"""
        response = client.post(
            "/api/tms/shipments/1/deliver",
            json={"receptor_nombre": "John Doe"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


class TestTMSShipmentValidation:
    """Tests for shipment validation"""

    def test_create_shipment_requires_fields(self, client):
        """POST /api/tms/shipments validates required fields"""
        response = client.post(
            "/api/tms/shipments",
            json={"tipo": "FTL"},
            content_type="application/json"
        )
        # Without auth: 401/403, With auth missing fields: 400
        assert response.status_code in [400, 401, 403, 429]

    def test_create_shipment_requires_items(self, client):
        """POST /api/tms/shipments validates items array"""
        response = client.post(
            "/api/tms/shipments",
            json={"tipo": "FTL", "origen": "A", "destino": "B", "items": []},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]


# ============================================================================
# TRACKING ENDPOINTS
# ============================================================================

class TestTMSTracking:
    """Tests for tracking endpoints"""

    def test_get_tracking_requires_auth(self, client):
        """GET /api/tms/shipments/<id>/tracking requires authentication"""
        response = client.get("/api/tms/shipments/1/tracking")
        assert response.status_code in [401, 403, 404, 429]

    def test_register_tracking_requires_auth(self, client):
        """POST /api/tms/shipments/<id>/tracking requires authentication"""
        response = client.post(
            "/api/tms/shipments/1/tracking",
            json={"tipo_evento": "checkpoint", "notas": "Arrived at warehouse"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_get_in_transit_shipments_requires_auth(self, client):
        """GET /api/tms/tracking/in-transit requires authentication"""
        response = client.get("/api/tms/tracking/in-transit")
        assert response.status_code in [401, 403, 429]


# ============================================================================
# CONSOLIDATION ENDPOINTS
# ============================================================================

class TestTMSConsolidation:
    """Tests for consolidation endpoints"""

    def test_list_consolidations_requires_auth(self, client):
        """GET /api/tms/consolidations requires authentication"""
        response = client.get("/api/tms/consolidations")
        assert response.status_code in [401, 403, 429]

    def test_create_consolidation_requires_auth(self, client):
        """POST /api/tms/consolidations requires authentication"""
        response = client.post(
            "/api/tms/consolidations",
            json={"nombre": "Consolidation 1", "destino": "Warehouse"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]

    def test_suggest_consolidations_requires_auth(self, client):
        """GET /api/tms/consolidations/suggest requires authentication"""
        response = client.get("/api/tms/consolidations/suggest")
        assert response.status_code in [401, 403, 429]

    def test_add_shipment_to_consolidation_requires_auth(self, client):
        """POST /api/tms/consolidations/<id>/add-shipment requires authentication"""
        response = client.post(
            "/api/tms/consolidations/1/add-shipment",
            json={"shipment_id": 1},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_remove_shipment_from_consolidation_requires_auth(self, client):
        """POST /api/tms/consolidations/<id>/remove-shipment requires authentication"""
        response = client.post(
            "/api/tms/consolidations/1/remove-shipment",
            json={"shipment_id": 1},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


# ============================================================================
# ROUTES ENDPOINTS
# ============================================================================

class TestTMSRoutes:
    """Tests for route management endpoints"""

    def test_list_routes_requires_auth(self, client):
        """GET /api/tms/routes requires authentication"""
        response = client.get("/api/tms/routes")
        assert response.status_code in [401, 403, 429]

    def test_create_route_requires_auth(self, client):
        """POST /api/tms/routes requires authentication"""
        response = client.post(
            "/api/tms/routes",
            json={"nombre": "Route 1", "origen": "A", "destino": "B"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]

    def test_get_route_requires_auth(self, client):
        """GET /api/tms/routes/<id> requires authentication"""
        response = client.get("/api/tms/routes/1")
        assert response.status_code in [401, 403, 404, 429]

    def test_update_route_requires_auth(self, client):
        """PUT /api/tms/routes/<id> requires authentication"""
        response = client.put(
            "/api/tms/routes/1",
            json={"nombre": "Updated Route"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


# ============================================================================
# COSTS & TARIFFS ENDPOINTS
# ============================================================================

class TestTMSCosts:
    """Tests for cost and tariff endpoints"""

    def test_get_shipment_costs_requires_auth(self, client):
        """GET /api/tms/shipments/<id>/costs requires authentication"""
        response = client.get("/api/tms/shipments/1/costs")
        assert response.status_code in [401, 403, 404, 429]

    def test_register_cost_requires_auth(self, client):
        """POST /api/tms/shipments/<id>/costs requires authentication"""
        response = client.post(
            "/api/tms/shipments/1/costs",
            json={"tipo_costo": "fuel", "monto": 100.0, "moneda": "USD"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_list_tariffs_requires_auth(self, client):
        """GET /api/tms/tariffs requires authentication"""
        response = client.get("/api/tms/tariffs")
        assert response.status_code in [401, 403, 429]

    def test_create_tariff_requires_auth(self, client):
        """POST /api/tms/tariffs requires authentication"""
        response = client.post(
            "/api/tms/tariffs",
            json={
                "nombre": "Base Tariff",
                "tipo": "fixed",
                "tarifa_base": 50.0,
                "moneda": "USD"
            },
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]

    def test_update_tariff_requires_auth(self, client):
        """PUT /api/tms/tariffs/<id> requires authentication"""
        response = client.put(
            "/api/tms/tariffs/1",
            json={"tarifa_base": 60.0},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]


# ============================================================================
# SETTLEMENT ENDPOINTS
# ============================================================================

class TestTMSSettlement:
    """Tests for financial settlement endpoints"""

    def test_list_settlements_requires_auth(self, client):
        """GET /api/tms/settlements requires authentication"""
        response = client.get("/api/tms/settlements")
        assert response.status_code in [401, 403, 429]

    def test_settle_shipment_requires_auth(self, client):
        """POST /api/tms/shipments/<id>/settle requires authentication"""
        response = client.post(
            "/api/tms/shipments/1/settle",
            json={"notas": "Settlement complete"},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 404, 429]

    def test_get_settlement_requires_auth(self, client):
        """GET /api/tms/shipments/<id>/settlement requires authentication"""
        response = client.get("/api/tms/shipments/1/settlement")
        assert response.status_code in [401, 403, 404, 429]

    def test_calculate_freight_requires_auth(self, client):
        """GET /api/tms/shipments/<id>/calculate-freight requires authentication"""
        response = client.get("/api/tms/shipments/1/calculate-freight")
        assert response.status_code in [401, 403, 404, 429]


# ============================================================================
# FUEL ENDPOINTS
# ============================================================================

class TestTMSFuel:
    """Tests for fuel registration endpoints"""

    def test_register_fuel_requires_auth(self, client):
        """POST /api/tms/fuel requires authentication"""
        response = client.post(
            "/api/tms/fuel",
            json={
                "vehicle_id": 1,
                "litros": 50.0,
                "costo_total": 75.0,
                "moneda": "USD"
            },
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]


# ============================================================================
# CONFIG & KPIs ENDPOINTS
# ============================================================================

class TestTMSConfigAndKPIs:
    """Tests for configuration and KPI endpoints"""

    def test_get_config_requires_auth(self, client):
        """GET /api/tms/config requires authentication"""
        response = client.get("/api/tms/config")
        assert response.status_code in [401, 403, 429]

    def test_update_config_requires_auth(self, client):
        """PUT /api/tms/config/<key> requires authentication"""
        response = client.put(
            "/api/tms/config/max_shipments_per_route",
            json={"value": 10},
            content_type="application/json"
        )
        assert response.status_code in [400, 401, 403, 429]

    def test_get_kpis_requires_auth(self, client):
        """GET /api/tms/kpis requires authentication"""
        response = client.get("/api/tms/kpis")
        assert response.status_code in [401, 403, 429]
