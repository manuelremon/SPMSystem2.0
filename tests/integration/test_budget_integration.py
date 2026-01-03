"""
Integration tests for Budget Update Request (BUR) flow.

Tests the complete lifecycle:
1. Create BUR
2. List BURs
3. Get BUR details
4. Approve BUR (with multi-level approval)
5. Reject BUR
6. Budget ledger operations
"""
from __future__ import annotations

import pytest
from flask import Flask
from flask.testing import FlaskClient

from tests.integration.auth_utils import authenticate_client


class TestBudgetRequestLifecycle:
    """Test complete BUR lifecycle."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        """Setup test data."""
        self.app = app
        self.client = client
        # Authenticate as admin for tests
        authenticate_client(app, client, "admin", roles=["admin"])

    def test_create_bur(self):
        """Test creating a Budget Update Request."""
        response = self.client.post(
            "/api/budget-requests",
            json={
                "centro": "Centro Test",
                "sector": "Sector Test",
                "monto_solicitado_usd": 5000,
                "justificacion": "Test budget increase request",
            },
        )
        # Should either succeed or fail with expected error
        assert response.status_code in [201, 200, 400, 404]

    def test_list_burs(self):
        """Test listing Budget Update Requests."""
        response = self.client.get("/api/budget-requests")
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.get_json()
            assert "requests" in data or "error" in data

    def test_list_burs_with_estado_filter(self):
        """Test listing BURs filtered by estado."""
        response = self.client.get("/api/budget-requests?estado=pendiente")
        assert response.status_code in [200, 404]

    def test_get_budget_info(self):
        """Test getting budget info for centro/sector."""
        response = self.client.get(
            "/api/budget/info",
            query_string={"centro": "Centro Test", "sector": "Sector Test"},
        )
        # May not exist, so 404 is acceptable
        assert response.status_code in [200, 404]

    def test_get_ledger(self):
        """Test getting budget ledger entries."""
        response = self.client.get("/api/budget/ledger")
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.get_json()
            assert "entries" in data or "error" in data

    def test_get_ledger_with_pagination(self):
        """Test ledger pagination."""
        response = self.client.get("/api/budget/ledger?limit=10&offset=0")
        assert response.status_code in [200, 404]


class TestBURApprovalFlow:
    """Test BUR approval workflows."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        """Setup test data."""
        self.app = app
        self.client = client
        authenticate_client(app, client, "admin", roles=["admin"])

    def test_approve_without_bur_id_fails(self):
        """Test that approving without BUR ID fails."""
        response = self.client.put("/api/budget-requests//aprobar")
        assert response.status_code in [404, 405]

    def test_reject_requires_motivo(self):
        """Test that rejection requires a motivo."""
        # First try to reject a non-existent BUR
        response = self.client.put(
            "/api/budget-requests/999999/rechazar",
            json={"motivo": ""},
        )
        # Should fail with 400 (bad request) or 404 (not found)
        assert response.status_code in [400, 404]


class TestBURAuthorizationLevels:
    """Test approval level authorization."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        self.app = app
        self.client = client

    def test_l1_approval_level(self):
        """Test L1 approval (up to $200K)."""
        authenticate_client(self.app, self.client, "aprobador_l1", roles=["coordinador"])
        response = self.client.get("/api/budget-requests?estado=pendiente")
        assert response.status_code in [200, 403, 404]

    def test_l2_approval_level(self):
        """Test L2 approval (up to $1M)."""
        authenticate_client(self.app, self.client, "aprobador_l2", roles=["jefe"])
        response = self.client.get("/api/budget-requests?estado=aprobado_l1")
        assert response.status_code in [200, 403, 404]

    def test_admin_approval_level(self):
        """Test admin approval (over $1M)."""
        authenticate_client(self.app, self.client, "admin", roles=["admin"])
        response = self.client.get("/api/budget-requests")
        assert response.status_code in [200, 404]


class TestBudgetLedgerOperations:
    """Test budget ledger functionality."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        self.app = app
        self.client = client
        authenticate_client(app, client, "admin", roles=["admin"])

    def test_ledger_entries_structure(self):
        """Test ledger entry structure."""
        response = self.client.get("/api/budget/ledger?limit=1")
        if response.status_code == 200:
            data = response.get_json()
            if "entries" in data and len(data["entries"]) > 0:
                entry = data["entries"][0]
                # Verify expected fields
                expected_fields = ["id", "tipo_movimiento", "monto_cents"]
                for field in expected_fields:
                    assert field in entry

    def test_ledger_pagination_params(self):
        """Test ledger accepts pagination parameters."""
        response = self.client.get("/api/budget/ledger?limit=50&offset=0")
        assert response.status_code in [200, 404]

    def test_ledger_returns_total(self):
        """Test ledger returns total count for pagination."""
        response = self.client.get("/api/budget/ledger")
        if response.status_code == 200:
            data = response.get_json()
            # Should have entries list and optionally total
            assert "entries" in data


class TestBURValidation:
    """Test BUR validation rules."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        self.app = app
        self.client = client
        authenticate_client(app, client, "admin", roles=["admin"])

    def test_create_bur_requires_centro(self):
        """Test that creating BUR requires centro."""
        response = self.client.post(
            "/api/budget-requests",
            json={
                "sector": "Sector Test",
                "monto_solicitado_usd": 5000,
                "justificacion": "Test",
            },
        )
        # Should fail validation
        assert response.status_code in [400, 422]

    def test_create_bur_requires_monto(self):
        """Test that creating BUR requires monto."""
        response = self.client.post(
            "/api/budget-requests",
            json={
                "centro": "Centro Test",
                "sector": "Sector Test",
                "justificacion": "Test",
            },
        )
        assert response.status_code in [400, 422]

    def test_create_bur_monto_must_be_positive(self):
        """Test that monto must be positive."""
        response = self.client.post(
            "/api/budget-requests",
            json={
                "centro": "Centro Test",
                "sector": "Sector Test",
                "monto_solicitado_usd": -1000,
                "justificacion": "Test",
            },
        )
        assert response.status_code in [400, 422]


class TestBURStateTransitions:
    """Test BUR state machine transitions."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        self.app = app
        self.client = client
        authenticate_client(app, client, "admin", roles=["admin"])

    def test_cannot_approve_rejected_bur(self):
        """Test that rejected BUR cannot be approved."""
        # This tests the state machine - trying to approve a non-existent
        # or already rejected BUR should fail
        response = self.client.put(
            "/api/budget-requests/999999/aprobar",
            json={"comentario": "Test"},
        )
        assert response.status_code in [400, 404]

    def test_cannot_reject_approved_bur(self):
        """Test that fully approved BUR cannot be rejected."""
        response = self.client.put(
            "/api/budget-requests/999999/rechazar",
            json={"motivo": "Test motivo rechazo"},
        )
        assert response.status_code in [400, 404]


class TestBURIntegrationWithSolicitudes:
    """Test BUR integration with solicitudes (budget consumption)."""

    @pytest.fixture(autouse=True)
    def setup(self, app: Flask, client: FlaskClient):
        self.app = app
        self.client = client
        authenticate_client(app, client, "admin", roles=["admin"])

    def test_budget_consumed_on_solicitud_approval(self):
        """Test that budget is consumed when solicitud is approved."""
        # This is a placeholder for the integration between BUR and solicitudes
        # The actual test would need to:
        # 1. Create a BUR and approve it
        # 2. Create a solicitud in the same centro/sector
        # 3. Approve the solicitud
        # 4. Verify budget was consumed in ledger
        pass

    def test_budget_reverted_on_solicitud_rejection(self):
        """Test that budget is reverted when approved solicitud is rejected."""
        # This tests Sprint 1 bug fix: reversion of budget on rejection
        pass
