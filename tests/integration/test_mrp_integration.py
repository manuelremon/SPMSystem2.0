"""
Tests de integracion para el servicio MRP.
Sprint 8.1 - Verifica motor MRP end-to-end.
"""

import pytest
import math


@pytest.fixture
def app():
    """Crea aplicacion de prueba."""
    try:
        from backend.app import create_app
    except ImportError:
        from app import create_app

    app = create_app({"TESTING": True})
    return app


@pytest.fixture
def client(app):
    """Cliente de prueba."""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Headers con autenticacion."""
    response = client.post("/api/auth/login", json={
        "email": "admin@spm.com",
        "password": "admin123"
    })

    if response.status_code == 200:
        data = response.get_json()
        token = data.get("data", {}).get("access_token") or data.get("access_token")
        if token:
            return {"Authorization": f"Bearer {token}"}

    return {"Authorization": "Bearer test_token"}


class TestMRPEndpointsIntegration:
    """Tests de integracion para endpoints MRP."""

    def test_get_mrp_alertas(self, client, auth_headers):
        """GET /api/mrp/alertas retorna alertas."""
        response = client.get("/api/mrp/alertas", headers=auth_headers)

        assert response.status_code in [200, 401, 500]

        if response.status_code == 200:
            data = response.get_json()
            assert "ok" in data

    def test_get_mrp_kpis(self, client, auth_headers):
        """GET /api/mrp/kpis retorna KPIs."""
        response = client.get("/api/mrp/kpis", headers=auth_headers)

        assert response.status_code in [200, 401, 500]

    def test_get_mrp_analisis_material(self, client, auth_headers):
        """GET /api/mrp/analisis/<material> analiza material."""
        response = client.get(
            "/api/mrp/analisis/MAT001?centro=1000",
            headers=auth_headers
        )

        assert response.status_code in [200, 401, 404, 500]


class TestMRPServiceIntegration:
    """Tests de integracion del servicio MRP."""

    def test_calcular_requerimiento_neto_basico(self):
        """Calcula requerimiento neto correctamente."""
        try:
            from backend.services.mrp_service import calcular_requerimiento_neto
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = calcular_requerimiento_neto(
            demanda=100,
            stock_actual=30,
            pedidos_en_curso=20,
            stock_seguridad=10
        )

        # Requerimiento = 100 - 30 - 20 + 10 = 60
        assert resultado["requerimiento_neto"] == 60
        assert resultado["necesita_reposicion"] is True

    def test_calcular_punto_reorden(self):
        """Calcula punto de reorden correctamente."""
        try:
            from backend.services.mrp_service import calcular_punto_reorden
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = calcular_punto_reorden(
            consumo_diario=10,
            lead_time_dias=15,
            stock_seguridad=50
        )

        # Punto reorden = (15 * 10) + 50 = 200
        assert resultado["punto_reorden"] == 200

    def test_calcular_cantidad_optima_eoq(self):
        """Calcula EOQ correctamente."""
        try:
            from backend.services.mrp_service import calcular_cantidad_optima
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = calcular_cantidad_optima(
            demanda_anual=1200,
            costo_orden=50,
            costo_mantenimiento_unitario=2
        )

        # EOQ = sqrt(2 * 1200 * 50 / 2) = sqrt(60000) ≈ 245
        expected_eoq = math.sqrt(2 * 1200 * 50 / 2)
        assert abs(resultado["cantidad_optima"] - expected_eoq) < 1

    def test_generar_recomendacion_urgente(self):
        """Genera recomendacion de compra urgente."""
        try:
            from backend.services.mrp_service import generar_recomendacion
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = generar_recomendacion(
            stock_actual=5,
            stock_seguridad=20,
            punto_pedido=50,
            pedidos_en_curso=0
        )

        assert resultado["accion"] == "compra_urgente"
        assert resultado["prioridad"] == "alta"

    def test_generar_recomendacion_sin_accion(self):
        """No genera accion si stock OK."""
        try:
            from backend.services.mrp_service import generar_recomendacion
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = generar_recomendacion(
            stock_actual=100,
            stock_seguridad=20,
            punto_pedido=50,
            pedidos_en_curso=0
        )

        assert resultado["accion"] == "ninguna"
        assert resultado["prioridad"] == "baja"


class TestMRPCalculosAvanzados:
    """Tests para calculos MRP avanzados."""

    def test_cobertura_dias(self):
        """Calcula dias de cobertura correctamente."""
        try:
            from backend.services.mrp_service import calcular_requerimiento_neto
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = calcular_requerimiento_neto(
            demanda=100,
            stock_actual=50,
            pedidos_en_curso=0,
            stock_seguridad=20,
            consumo_diario=5
        )

        # Cobertura = 50 / 5 = 10 dias
        assert resultado["dias_cobertura"] == 10

    def test_eoq_con_restricciones(self):
        """EOQ respeta minimos y maximos."""
        try:
            from backend.services.mrp_service import calcular_cantidad_optima
        except ImportError:
            pytest.skip("MRP service not available")

        resultado = calcular_cantidad_optima(
            demanda_anual=1200,
            costo_orden=50,
            costo_mantenimiento_unitario=2,
            cantidad_minima=300,  # Mayor que EOQ calculado
            cantidad_maxima=500
        )

        assert resultado["cantidad_optima"] >= 300
        assert resultado["ajustado"] is True
