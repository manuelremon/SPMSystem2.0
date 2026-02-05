"""
Tests de integración para endpoints de parametrización MRP - Sprint 25
Verifica que los endpoints funcionen correctamente con la BD.
"""

import pytest
import json
from backend.app import create_app
from backend.core.db import get_db_connection


@pytest.fixture
def app():
    """Crea app con contexto de test"""
    app = create_app()
    app.config["TESTING"] = True

    # Preparar contexto de BD
    with app.app_context():
        # Crear tablas si no existen
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Verificar que existen las tablas (no crear en test, asumir existentes)
            try:
                cursor.execute("SELECT 1 FROM mrp_configuracion LIMIT 1")
                cursor.fetchone()
            except Exception:
                pytest.skip("Tablas MRP no existen en BD de test")
            conn.close()

    yield app


@pytest.fixture
def client(app):
    """Cliente HTTP de test"""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Headers con token de autenticación válido"""
    # Nota: En test real, usar un usuario planificador válido
    return {
        "Authorization": "Bearer test-token-valido",
        "Content-Type": "application/json",
    }


# =============================================================================
# TEST: Obtener Configuración Global
# =============================================================================


class TestObtenerConfiguracion:
    """Tests para GET /mrp/configuracion"""

    def test_obtener_configuracion_exitoso(self, client, auth_headers):
        """GET /mrp/configuracion retorna configuración disponible"""
        response = client.get("/mrp/configuracion", headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["ok"] is True
        assert "configuracion" in data
        assert isinstance(data["configuracion"], dict)

    def test_configuracion_incluye_defaults(self, client, auth_headers):
        """Configuración incluye valores por defecto"""
        response = client.get("/mrp/configuracion", headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)
        config = data["configuracion"]

        # Verificar que existen valores por defecto
        assert "lead_time_default" in config
        assert config["lead_time_default"] == 30

        assert "costo_orden_default" in config
        assert config["costo_orden_default"] == 100.0

        assert "nivel_servicio_default" in config
        assert config["nivel_servicio_default"] == 0.95

    def test_configuracion_sin_autenticacion(self, client):
        """GET /mrp/configuracion rechaza sin autenticación"""
        response = client.get("/mrp/configuracion")

        assert response.status_code in [401, 403]  # Unauthorized o Forbidden


# =============================================================================
# TEST: Calcular Parámetros
# =============================================================================


class TestCalcularParametros:
    """Tests para POST /mrp/parametros/calcular"""

    def test_calcular_un_material(self, client, auth_headers):
        """POST /mrp/parametros/calcular calcula parámetros para 1 material"""
        body = {
            "materiales": [
                {
                    "material_codigo": "10000123",
                    "centro": "1000",
                    "almacen": "0001",
                    "demanda_anual": 1200,
                    "lead_time_dias": 30,
                    "nivel_servicio": 0.95,
                }
            ]
        }

        response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(body),
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["ok"] is True
        assert len(data["resultados"]) == 1
        assert data["total_procesados"] == 1
        assert data["total_exitosos"] == 1

    def test_calcular_multiples_materiales(self, client, auth_headers):
        """POST /mrp/parametros/calcular calcula para múltiples materiales"""
        body = {
            "materiales": [
                {
                    "material_codigo": f"1000012{i}",
                    "centro": "1000",
                    "almacen": "0001",
                    "demanda_anual": 1200 + i * 100,
                }
                for i in range(5)
            ]
        }

        response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(body),
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["total_procesados"] == 5
        assert data["total_exitosos"] == 5

    def test_calcular_con_configuracion_global(self, client, auth_headers):
        """POST /mrp/parametros/calcular respeta configuración global"""
        body = {
            "materiales": [
                {
                    "material_codigo": "10000999",
                    "centro": "1000",
                    "almacen": "0001",
                    "demanda_anual": 1200,
                }
            ],
            "configuracion_global": {
                "lead_time_default": 45,  # Override
                "nivel_servicio_default": 0.99,  # Override
            },
        }

        response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(body),
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        resultado = data["resultados"][0]

        # Lead time debe ser el override
        assert resultado["lead_time_dias"] == 45
        # Nivel servicio debe ser el override
        assert resultado["nivel_servicio"] == 0.99

    def test_calcular_valida_campos_requeridos(self, client, auth_headers):
        """POST /mrp/parametros/calcular rechaza sin campos requeridos"""
        body = {
            "materiales": [
                {
                    "material_codigo": "10000123",
                    # Falta centro
                    "almacen": "0001",
                    "demanda_anual": 1200,
                }
            ]
        }

        response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(body),
            headers=auth_headers,
        )

        # Debe haber errores
        data = json.loads(response.data)
        assert len(data["errores"]) > 0

    def test_calcular_lista_vacia(self, client, auth_headers):
        """POST /mrp/parametros/calcular rechaza lista vacía"""
        body = {"materiales": []}

        response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(body),
            headers=auth_headers,
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["ok"] is False

    def test_calcular_calcula_campos_correctos(self, client, auth_headers):
        """POST /mrp/parametros/calcular devuelve todos los campos calculados"""
        body = {
            "materiales": [
                {
                    "material_codigo": "TEST-123",
                    "centro": "1000",
                    "almacen": "0001",
                    "demanda_anual": 1200,
                }
            ]
        }

        response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(body),
            headers=auth_headers,
        )

        data = json.loads(response.data)
        resultado = data["resultados"][0]

        # Verificar que todos los campos calculados existen
        campos_esperados = [
            "material_codigo", "centro", "almacen",
            "demanda_anual", "demanda_diaria",
            "stock_seguridad", "punto_pedido", "stock_maximo",
            "cantidad_pedido_eoq",
            "cobertura_ss_dias", "cobertura_eoq_dias",
            "factor_z", "pedidos_anuales", "costo_total_anual",
        ]

        for campo in campos_esperados:
            assert campo in resultado, f"Falta campo calculado: {campo}"


# =============================================================================
# TEST: Guardar Parámetros
# =============================================================================


class TestGuardarParametros:
    """Tests para POST /mrp/parametros/guardar"""

    def test_guardar_parametros_exitoso(self, client, auth_headers):
        """POST /mrp/parametros/guardar guarda parámetros en BD"""
        # Primero calcular
        calc_body = {
            "materiales": [
                {
                    "material_codigo": "10000800",
                    "centro": "1000",
                    "almacen": "0001",
                    "demanda_anual": 1200,
                }
            ]
        }

        calc_response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(calc_body),
            headers=auth_headers,
        )

        calc_data = json.loads(calc_response.data)
        parametros = calc_data["resultados"]

        # Luego guardar
        save_body = {"parametros": parametros}

        save_response = client.post(
            "/mrp/parametros/guardar",
            data=json.dumps(save_body),
            headers=auth_headers,
        )

        assert save_response.status_code == 200
        save_data = json.loads(save_response.data)
        assert save_data["ok"] is True
        assert save_data["guardados"] > 0

    def test_guardar_multiples_parametros(self, client, auth_headers):
        """POST /mrp/parametros/guardar guarda múltiples registros"""
        # Calcular varios
        calc_body = {
            "materiales": [
                {
                    "material_codigo": f"1000090{i}",
                    "centro": "1000",
                    "almacen": "0001",
                    "demanda_anual": 1200 + i * 100,
                }
                for i in range(3)
            ]
        }

        calc_response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(calc_body),
            headers=auth_headers,
        )

        calc_data = json.loads(calc_response.data)
        parametros = calc_data["resultados"]

        # Guardar todos
        save_body = {"parametros": parametros}

        save_response = client.post(
            "/mrp/parametros/guardar",
            data=json.dumps(save_body),
            headers=auth_headers,
        )

        save_data = json.loads(save_response.data)
        assert save_data["guardados"] == 3

    def test_guardar_valida_autorizacion(self, client):
        """POST /mrp/parametros/guardar requiere autenticación"""
        body = {"parametros": []}

        response = client.post(
            "/mrp/parametros/guardar",
            data=json.dumps(body),
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code in [401, 403]


# =============================================================================
# TEST: Flujo Completo E2E
# =============================================================================


class TestFlujoCompletoE2E:
    """Tests del flujo completo: Calcular → Guardar → Verificar"""

    def test_flujo_importacion_calculo_guardado(self, client, auth_headers):
        """Flujo E2E: Importar (Excel simulado) → Calcular → Guardar"""

        # Paso 1: Simular importación Excel (datos en JSON)
        materiales_importados = [
            {
                "codigo_material": "SAP-10001",
                "centro": "1000",
                "almacen": "0001",
                "demanda_anual": 1500,
                "lead_time_dias": 30,
                "nivel_servicio": 0.95,
            },
            {
                "codigo_material": "SAP-10002",
                "centro": "1000",
                "almacen": "0001",
                "demanda_anual": 800,
                "lead_time_dias": 45,
                "nivel_servicio": 0.90,
            },
        ]

        # Paso 2: Calcular parámetros
        calc_body = {"materiales": materiales_importados}
        calc_response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(calc_body),
            headers=auth_headers,
        )

        assert calc_response.status_code == 200
        calc_data = json.loads(calc_response.data)
        assert len(calc_data["resultados"]) == 2

        # Paso 3: Guardar parámetros
        save_body = {"parametros": calc_data["resultados"]}
        save_response = client.post(
            "/mrp/parametros/guardar",
            data=json.dumps(save_body),
            headers=auth_headers,
        )

        assert save_response.status_code == 200
        save_data = json.loads(save_response.data)
        assert save_data["guardados"] == 2

    def test_flujo_con_errores_parciales(self, client, auth_headers):
        """Flujo E2E con algunos materiales con error"""
        # Mezclar válidos e inválidos
        materiales = [
            {
                "codigo_material": "VALIDO-1",
                "centro": "1000",
                "almacen": "0001",
                "demanda_anual": 1200,
            },
            {
                "codigo_material": "INVALIDO-1",
                "centro": "1000",
                # Falta almacen
                "demanda_anual": 1200,
            },
            {
                "codigo_material": "VALIDO-2",
                "centro": "2000",
                "almacen": "0002",
                "demanda_anual": 800,
            },
        ]

        calc_body = {"materiales": materiales}
        calc_response = client.post(
            "/mrp/parametros/calcular",
            data=json.dumps(calc_body),
            headers=auth_headers,
        )

        calc_data = json.loads(calc_response.data)

        # Debe haber 2 exitosos y 1 error
        assert calc_data["total_exitosos"] >= 2
        assert calc_data["total_errores"] >= 1

        # Guardar solo los exitosos
        if calc_data["resultados"]:
            save_body = {"parametros": calc_data["resultados"]}
            save_response = client.post(
                "/mrp/parametros/guardar",
                data=json.dumps(save_body),
                headers=auth_headers,
            )

            assert save_response.status_code == 200
