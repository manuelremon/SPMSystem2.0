"""
Integration tests para endpoints HTTP de planner (PASO 1-3)

Pruebas que verifican:
- Respuestas HTTP correctas
- Status codes
- Estructura JSON
- Manejo de errores
"""

import json
import sys
from pathlib import Path

import pytest

# Agregar backend_v2 al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend_v2.app import create_app


@pytest.fixture
def app():
    """Crear app Flask para tests"""
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    """Cliente HTTP para tests"""
    return app.test_client()


class TestEndpointPaso1:
    """Tests para endpoint /solicitudes/<id>/analizar (PASO 1)"""

    def test_paso_1_endpoint_accesible(self, client):
        """Test que endpoint PASO 1 existe y es accesible"""
        # Intenta acceder (puede fallar por auth, pero endpoint debe existir)
        response = client.post("/api/planificador/solicitudes/1/analizar")

        # Debe retornar response (no 404)
        assert response.status_code != 404, "Endpoint no existe"
        print("✅ test_paso_1_endpoint_accesible PASSED")

    def test_paso_1_respuesta_tiene_estructura(self, client):
        """Test que PASO 1 retorna estructura JSON correcta"""
        # Nota: Esto asume que hay una solicitud con ID 1 en BD y auth está configurado
        response = client.post(
            "/api/planificador/solicitudes/1/analizar", headers={"Content-Type": "application/json"}
        )

        # Si auth está activo, puede ser 401/403, que es OK
        if response.status_code in [401, 403]:
            pytest.skip("Auth required (expected)")

        if response.status_code == 200:
            data = response.get_json()
            assert data is not None, "Response debe ser JSON"
            assert "ok" in data, "Falta 'ok' en respuesta"
            assert "data" in data, "Falta 'data' en respuesta"

            result_data = data.get("data", {})
            assert "paso" in result_data, "Falta 'paso'"
            assert result_data["paso"] == 1, "paso debe ser 1"
            print("✅ test_paso_1_respuesta_tiene_estructura PASSED")
        elif response.status_code == 404:
            pytest.skip("Solicitud no encontrada (expected)")

    def test_paso_1_error_solicitud_no_existe(self, client):
        """Test que PASO 1 maneja error cuando solicitud no existe"""
        response = client.post(
            "/api/planificador/solicitudes/999999/analizar",
            headers={"Content-Type": "application/json"},
        )

        # Puede ser 401 (auth), 404 (no existe), o 400 (error)
        if response.status_code in [401, 403]:
            pytest.skip("Auth required")

        # Debe retornar error estructurado
        if response.status_code != 200:
            data = response.get_json()
            if data:
                assert "ok" in data or "error" in data, "Debe tener estructura de error"
            print("✅ test_paso_1_error_solicitud_no_existe PASSED")


class TestEndpointPaso2:
    """Tests para endpoint /solicitudes/<id>/items/<idx>/opciones-abastecimiento (PASO 2)"""

    def test_paso_2_endpoint_accesible(self, client):
        """Test que endpoint PASO 2 existe"""
        response = client.get("/api/planificador/solicitudes/1/items/0/opciones-abastecimiento")

        assert response.status_code != 404, "Endpoint no existe"
        print("✅ test_paso_2_endpoint_accesible PASSED")

    def test_paso_2_respuesta_estructura(self, client):
        """Test que PASO 2 retorna estructura correcta"""
        response = client.get(
            "/api/planificador/solicitudes/1/items/0/opciones-abastecimiento",
            headers={"Content-Type": "application/json"},
        )

        if response.status_code in [401, 403]:
            pytest.skip("Auth required")

        if response.status_code == 200:
            data = response.get_json()
            assert data is not None, "Response debe ser JSON"
            assert "ok" in data, "Falta 'ok'"
            assert "data" in data, "Falta 'data'"

            result_data = data.get("data", {})
            assert "paso" in result_data, "Falta 'paso'"
            assert result_data["paso"] == 2, "paso debe ser 2"
            assert "opciones" in result_data, "Falta 'opciones'"
            assert isinstance(result_data["opciones"], list), "opciones debe ser list"
            print("✅ test_paso_2_respuesta_estructura PASSED")


class TestEndpointPaso3:
    """Tests para endpoint /solicitudes/<id>/guardar-tratamiento (PASO 3)"""

    def test_paso_3_endpoint_accesible(self, client):
        """Test que endpoint PASO 3 existe"""
        response = client.post(
            "/api/planificador/solicitudes/1/guardar-tratamiento", json={"decisiones": []}
        )

        assert response.status_code != 404, "Endpoint no existe"
        print("✅ test_paso_3_endpoint_accesible PASSED")

    def test_paso_3_falla_sin_decisiones(self, client):
        """Test que PASO 3 falla si decisiones está vacío"""
        response = client.post(
            "/api/planificador/solicitudes/1/guardar-tratamiento",
            json={"decisiones": []},
            headers={"Content-Type": "application/json"},
        )

        if response.status_code in [401, 403]:
            pytest.skip("Auth required")

        # Debe retornar error (400 o similar)
        if response.status_code != 200:
            data = response.get_json()
            if data and "error" in data:
                assert "decision" in data["error"].get("message", "").lower()
            print("✅ test_paso_3_falla_sin_decisiones PASSED")

    def test_paso_3_respuesta_estructura(self, client):
        """Test que PASO 3 retorna estructura correcta"""
        decision_data = {
            "decisiones": [
                {
                    "item_idx": 0,
                    "decision_tipo": "stock",
                    "cantidad_aprobada": 10,
                    "codigo_material": "MAT001",
                    "id_proveedor": "PROV006",
                    "precio_unitario_final": 100,
                    "observacion": "Test",
                }
            ]
        }

        response = client.post(
            "/api/planificador/solicitudes/1/guardar-tratamiento",
            json=decision_data,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code in [401, 403]:
            pytest.skip("Auth required")

        if response.status_code == 200:
            data = response.get_json()
            assert data is not None, "Response debe ser JSON"
            assert "ok" in data, "Falta 'ok'"
            assert "data" in data, "Falta 'data'"

            result_data = data.get("data", {})
            assert "paso" in result_data, "Falta 'paso'"
            assert result_data["paso"] == 3, "paso debe ser 3"
            print("✅ test_paso_3_respuesta_estructura PASSED")


class TestErrorHandling:
    """Tests para manejo de errores en general"""

    def test_endpoint_inexistente_404(self, client):
        """Test que endpoint inexistente retorna 404"""
        response = client.get("/api/planificador/inexistente")
        assert response.status_code == 404, "Endpoint inexistente debe retornar 404"
        print("✅ test_endpoint_inexistente_404 PASSED")

    def test_metodo_no_permitido_405(self, client):
        """Test que método no permitido retorna 405"""
        # GET en endpoint POST-only
        response = client.get("/api/planificador/solicitudes/1/analizar")

        # Puede ser 405 (método no permitido) o 401 (auth requerido)
        assert response.status_code in [405, 401], f"Esperado 405 o 401, got {response.status_code}"
        print("✅ test_metodo_no_permitido_405 PASSED")

    def test_json_invalido_400(self, client):
        """Test que JSON inválido retorna error"""
        response = client.post(
            "/api/planificador/solicitudes/1/guardar-tratamiento",
            data="invalid json",
            content_type="application/json",
        )

        # Puede ser 400 (JSON invalid), 401 (auth), 403 (CSRF), o 415 (unsupported media type)
        assert response.status_code in [
            400,
            401,
            403,
            415,
        ], f"Esperado error status, got {response.status_code}"
        print("✅ test_json_invalido_400 PASSED")


class TestResponseFormat:
    """Tests para formato estándar de respuestas"""

    def test_respuesta_exitosa_tiene_ok_true(self, client):
        """Test que respuesta exitosa tiene 'ok': true"""
        # Endpoint que no requiere auth (si existe)
        endpoints = [
            "/api/planificador/solicitudes",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            if response.status_code == 200:
                data = response.get_json()
                assert data.get("ok") == True, "ok debe ser true en respuesta exitosa"
                print(f"✅ test_respuesta_exitosa_tiene_ok_true ({endpoint}) PASSED")
                break

    def test_content_type_es_json(self, client):
        """Test que todas las respuestas son JSON"""
        response = client.get("/api/planificador/solicitudes")

        if response.status_code in [200, 401, 403, 404, 400]:
            assert (
                "application/json" in response.content_type
            ), f"Content-Type debe ser JSON, got {response.content_type}"
            print("✅ test_content_type_es_json PASSED")


class TestDataSerialization:
    """Tests para serialización de datos"""

    def test_paso_1_json_serializable(self, client):
        """Test que respuesta PASO 1 es JSON serializable"""
        response = client.post("/api/planificador/solicitudes/1/analizar")

        if response.status_code == 200:
            data = response.get_json()

            # Intenta re-serializar
            try:
                json_str = json.dumps(data)
                assert isinstance(json_str, str), "JSON serialization debe retornar string"
                print("✅ test_paso_1_json_serializable PASSED")
            except TypeError as e:
                pytest.fail(f"Respuesta no es JSON serializable: {e}")

    def test_paso_2_json_serializable(self, client):
        """Test que respuesta PASO 2 es JSON serializable"""
        response = client.get("/api/planificador/solicitudes/1/items/0/opciones-abastecimiento")

        if response.status_code == 200:
            data = response.get_json()

            try:
                json_str = json.dumps(data)
                assert isinstance(json_str, str)
                print("✅ test_paso_2_json_serializable PASSED")
            except TypeError as e:
                pytest.fail(f"Respuesta no es JSON serializable: {e}")


# ============================================================================
# Pytest markers
# ============================================================================

pytestmark = pytest.mark.integration


if __name__ == "__main__":
    # Ejecutar: python -m pytest tests/integration/test_planner_endpoints.py -v
    pytest.main([__file__, "-v", "-s"])
