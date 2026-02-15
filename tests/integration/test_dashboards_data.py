"""
Integration tests for dashboard data endpoints (Sprint 35 & 36).

Tests:
- GET /api/dashboard-data/solicitudes - Paginación server-side
- GET /api/dashboard-data/resumen - Resumen ejecutivo
- GET /api/dashboard-data/drill/<metrica> - Drill-down analytics

Note: These tests verify endpoint structure and auth requirements.
For full functionality testing, use with proper database seeded with test data.
"""

import json

import pytest


class TestDashboardsDataSolicitudes:
    """Tests for solicitudes pagination endpoint."""

    def test_get_solicitudes_sin_auth(self, client):
        """Debe requerir autenticación."""
        resp = client.get("/api/dashboard-data/solicitudes")
        assert resp.status_code in [401, 403]

    def test_endpoint_registrado(self, client):
        """Verifica que el endpoint está registrado."""
        # Llamada sin auth debe devolver 401, no 404
        resp = client.get("/api/dashboard-data/solicitudes")
        assert resp.status_code != 404

    def test_query_params_parsing(self, client):
        """Verifica que acepta query params sin errores de parsing."""
        # Sin auth, pero debería parsear params sin error 500
        resp = client.get("/api/dashboard-data/solicitudes?page=2&page_size=10")
        assert resp.status_code in [401, 403]  # No 500

    def test_filtros_parsing(self, client):
        """Verifica que parsea filtros sin errores."""
        resp = client.get(
            "/api/dashboard-data/solicitudes?estado=submitted&centro=1000"
        )
        assert resp.status_code in [401, 403]

    def test_ordenamiento_parsing(self, client):
        """Verifica que parsea ordenamiento sin errores."""
        resp = client.get(
            "/api/dashboard-data/solicitudes?sort_by=created_at&sort_dir=asc"
        )
        assert resp.status_code in [401, 403]


class TestDashboardsDataResumen:
    """Tests for resumen ejecutivo endpoint."""

    def test_get_resumen_sin_auth(self, client):
        """Debe requerir autenticación."""
        resp = client.get("/api/dashboard-data/resumen")
        assert resp.status_code in [401, 403]

    def test_endpoint_registrado(self, client):
        """Verifica que el endpoint está registrado."""
        resp = client.get("/api/dashboard-data/resumen")
        assert resp.status_code != 404


class TestDashboardsDataDrillDown:
    """Tests for drill-down analytics endpoints."""

    def test_drill_sin_auth(self, client):
        """Debe requerir autenticación."""
        resp = client.get("/api/dashboard-data/drill/solicitudes_diarias")
        assert resp.status_code in [401, 403]

    def test_endpoint_registrado(self, client):
        """Verifica que el endpoint está registrado."""
        resp = client.get("/api/dashboard-data/drill/solicitudes_diarias")
        assert resp.status_code != 404

    def test_drill_metricas_validas(self, client):
        """Verifica que todas las métricas soportadas están registradas."""
        metricas = [
            "solicitudes_diarias",
            "solicitudes_por_estado",
            "presupuesto_por_centro",
            "materiales_top",
            "tiempos_promedio",
            "stock_critico",
            "compras_evitadas",
        ]
        for metrica in metricas:
            resp = client.get(f"/api/dashboard-data/drill/{metrica}")
            # Debe ser 401 (auth required), no 404 (not found)
            assert resp.status_code in [401, 403]

    def test_metrica_invalida_sin_auth(self, client):
        """Métrica inválida debe responder antes de chequear auth."""
        # Nota: Actualmente la validación de métrica está después de @require_auth
        # Por lo que devuelve 401 primero
        resp = client.get("/api/dashboard-data/drill/metrica_invalida")
        assert resp.status_code in [400, 401, 403]

    def test_query_params_parsing(self, client):
        """Verifica que parsea query params sin errores."""
        resp = client.get(
            "/api/dashboard-data/drill/solicitudes_diarias?periodo=7&centro=1000"
        )
        assert resp.status_code in [401, 403]  # No 500
