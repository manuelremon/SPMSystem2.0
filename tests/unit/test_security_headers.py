"""
Tests unitarios para el modulo Security Headers
backend/core/security_headers.py

Separados en 3 clases:
- TestSecurityHeadersCommon: Headers que siempre se aplican
- TestSecurityHeadersDevelopment: Comportamiento en desarrollo
- TestSecurityHeadersProduction: Comportamiento en produccion (mockeado)
"""

import os
import sys
from unittest.mock import patch

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.security_headers import init_security_headers

# ============================================================================
# Fixtures compartidos
# ============================================================================


@pytest.fixture
def dev_app():
    """Aplicacion Flask en modo desarrollo"""
    app = Flask(__name__)
    app.config["TESTING"] = True

    @app.route("/test")
    def test_route():
        return "OK"

    @app.route("/error")
    def error_route():
        return "Error", 500

    @app.route("/not-found")
    def not_found():
        return "Not Found", 404

    @app.route("/test-methods", methods=["GET", "POST", "PUT", "DELETE"])
    def test_methods():
        return "OK"

    return app


@pytest.fixture
def dev_client(dev_app):
    """Cliente de prueba en modo desarrollo"""
    init_security_headers(dev_app)
    return dev_app.test_client()


@pytest.fixture
def prod_client():
    """Cliente de prueba con ambiente de produccion mockeado"""
    # Importar settings para mockear
    from backend.core import config

    # Crear app dentro del patch
    # Nota: RENDER=true simula hosting directo (sin Nginx) donde Flask maneja headers
    with patch.object(config.settings, "ENV", "production"), \
         patch.dict("os.environ", {"RENDER": "true"}):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        @app.route("/error")
        def error_route():
            return "Error", 500

        @app.route("/not-found")
        def not_found():
            return "Not Found", 404

        init_security_headers(app)
        yield app.test_client()


# ============================================================================
# Tests de inicializacion
# ============================================================================


class TestSecurityHeadersInitialization:
    """Tests para la inicializacion de headers de seguridad"""

    def test_init_security_headers_returns_app(self, dev_app):
        """init_security_headers debe retornar la aplicacion"""
        result = init_security_headers(dev_app)
        assert result is dev_app

    def test_init_security_headers_registers_after_request(self, dev_app):
        """init_security_headers debe registrar un after_request handler"""
        before_count = len(dev_app.after_request_funcs.get(None, []))
        init_security_headers(dev_app)
        after_count = len(dev_app.after_request_funcs.get(None, []))

        assert after_count == before_count + 1


# ============================================================================
# Tests de headers comunes (aplican en TODOS los ambientes)
# ============================================================================


class TestSecurityHeadersCommon:
    """Headers que se aplican en TODOS los ambientes"""

    def test_content_type_options_present(self, dev_client):
        """El header X-Content-Type-Options debe estar presente"""
        response = dev_client.get("/test")
        assert "X-Content-Type-Options" in response.headers

    def test_content_type_options_nosniff(self, dev_client):
        """X-Content-Type-Options debe ser 'nosniff'"""
        response = dev_client.get("/test")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    def test_referrer_policy_present(self, dev_client):
        """El header Referrer-Policy debe estar presente"""
        response = dev_client.get("/test")
        assert "Referrer-Policy" in response.headers

    def test_referrer_policy_value(self, dev_client):
        """Referrer-Policy debe ser 'strict-origin-when-cross-origin' (OWASP)"""
        response = dev_client.get("/test")
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    def test_permissions_policy_present(self, dev_client):
        """El header Permissions-Policy debe estar presente"""
        response = dev_client.get("/test")
        assert "Permissions-Policy" in response.headers

    def test_permissions_policy_camera_disabled(self, dev_client):
        """Permissions-Policy debe deshabilitar camera"""
        response = dev_client.get("/test")
        policy = response.headers.get("Permissions-Policy")
        assert "camera=()" in policy

    def test_permissions_policy_microphone_disabled(self, dev_client):
        """Permissions-Policy debe deshabilitar microphone"""
        response = dev_client.get("/test")
        policy = response.headers.get("Permissions-Policy")
        assert "microphone=()" in policy

    def test_permissions_policy_geolocation_disabled(self, dev_client):
        """Permissions-Policy debe deshabilitar geolocation"""
        response = dev_client.get("/test")
        policy = response.headers.get("Permissions-Policy")
        assert "geolocation=()" in policy

    def test_csp_header_present(self, dev_client):
        """El header Content-Security-Policy debe estar presente"""
        response = dev_client.get("/test")
        assert "Content-Security-Policy" in response.headers

    def test_frame_options_present(self, dev_client):
        """El header X-Frame-Options debe estar presente"""
        response = dev_client.get("/test")
        assert "X-Frame-Options" in response.headers


# ============================================================================
# Tests de headers en DESARROLLO
# ============================================================================


class TestSecurityHeadersDevelopment:
    """Headers en ambiente de DESARROLLO"""

    def test_frame_options_sameorigin_in_dev(self, dev_client):
        """X-Frame-Options debe ser 'SAMEORIGIN' en desarrollo"""
        response = dev_client.get("/test")
        assert response.headers.get("X-Frame-Options") == "SAMEORIGIN"

    def test_no_hsts_in_dev(self, dev_client):
        """HSTS no debe estar presente en desarrollo"""
        response = dev_client.get("/test")
        assert "Strict-Transport-Security" not in response.headers

    def test_no_xss_protection_in_dev(self, dev_client):
        """X-XSS-Protection no se aplica en desarrollo"""
        response = dev_client.get("/test")
        # En desarrollo, este header no se agrega
        assert "X-XSS-Protection" not in response.headers

    def test_csp_allows_localhost_in_dev(self, dev_client):
        """CSP debe permitir localhost en desarrollo"""
        response = dev_client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "localhost" in csp


# ============================================================================
# Tests de headers en PRODUCCION
# ============================================================================


class TestSecurityHeadersProduction:
    """Headers en ambiente de PRODUCCION"""

    def test_hsts_present_in_prod(self, prod_client):
        """El header Strict-Transport-Security debe estar presente en produccion"""
        response = prod_client.get("/test")
        assert "Strict-Transport-Security" in response.headers

    def test_hsts_max_age(self, prod_client):
        """HSTS debe tener max-age de 1 anio (31536000 segundos)"""
        response = prod_client.get("/test")
        hsts = response.headers.get("Strict-Transport-Security")
        assert "max-age=31536000" in hsts

    def test_hsts_include_subdomains(self, prod_client):
        """HSTS debe incluir subdominios"""
        response = prod_client.get("/test")
        hsts = response.headers.get("Strict-Transport-Security")
        assert "includeSubDomains" in hsts

    def test_frame_options_deny_in_prod(self, prod_client):
        """X-Frame-Options debe ser 'DENY' en produccion"""
        response = prod_client.get("/test")
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_xss_protection_present_in_prod(self, prod_client):
        """El header X-XSS-Protection debe estar presente en produccion"""
        response = prod_client.get("/test")
        assert "X-XSS-Protection" in response.headers

    def test_xss_protection_enabled(self, prod_client):
        """X-XSS-Protection debe estar habilitado con mode=block"""
        response = prod_client.get("/test")
        xss = response.headers.get("X-XSS-Protection")
        assert "1" in xss
        assert "mode=block" in xss

    def test_csp_default_src(self, prod_client):
        """CSP debe tener default-src 'self' en produccion"""
        response = prod_client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "default-src 'self'" in csp

    def test_csp_script_src(self, prod_client):
        """CSP debe tener script-src configurado"""
        response = prod_client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "script-src 'self'" in csp

    def test_csp_style_src(self, prod_client):
        """CSP debe tener style-src configurado"""
        response = prod_client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "style-src 'self'" in csp


# ============================================================================
# Tests en diferentes metodos HTTP
# ============================================================================


class TestHeadersOnAllMethods:
    """Tests para verificar headers en diferentes metodos HTTP"""

    def test_headers_on_get(self, dev_client):
        """Headers deben estar presentes en GET"""
        response = dev_client.get("/test-methods")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_post(self, dev_client):
        """Headers deben estar presentes en POST"""
        response = dev_client.post("/test-methods")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_put(self, dev_client):
        """Headers deben estar presentes en PUT"""
        response = dev_client.put("/test-methods")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_delete(self, dev_client):
        """Headers deben estar presentes en DELETE"""
        response = dev_client.delete("/test-methods")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers


# ============================================================================
# Tests en respuestas de error
# ============================================================================


class TestHeadersOnErrorResponses:
    """Tests para verificar headers en respuestas de error"""

    def test_headers_on_500_error(self, dev_client):
        """Headers deben estar presentes en errores 500"""
        response = dev_client.get("/error")
        assert response.status_code == 500
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_404_error(self, dev_client):
        """Headers deben estar presentes en errores 404"""
        response = dev_client.get("/not-found")
        assert response.status_code == 404
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_500_error_prod(self, prod_client):
        """Headers de produccion en errores 500"""
        response = prod_client.get("/error")
        assert response.status_code == 500
        assert "Strict-Transport-Security" in response.headers
        assert "X-Frame-Options" in response.headers

    def test_headers_on_404_error_prod(self, prod_client):
        """Headers de produccion en errores 404"""
        response = prod_client.get("/not-found")
        assert response.status_code == 404
        assert "Strict-Transport-Security" in response.headers
        assert "X-Frame-Options" in response.headers


# ============================================================================
# Tests de cumplimiento OWASP
# ============================================================================


class TestOWASPCompliance:
    """Tests para verificar cumplimiento OWASP en produccion"""

    def test_all_owasp_headers_present_in_prod(self, prod_client):
        """Todos los headers OWASP recomendados deben estar presentes en produccion"""
        response = prod_client.get("/test")

        required_headers = [
            "Strict-Transport-Security",
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Content-Security-Policy",
            "Referrer-Policy",
            "Permissions-Policy",
        ]

        for header in required_headers:
            assert header in response.headers, f"Missing OWASP header: {header}"

    def test_common_headers_in_dev(self, dev_client):
        """Headers comunes deben estar en desarrollo"""
        response = dev_client.get("/test")

        # Estos headers siempre deben estar
        always_present = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "Content-Security-Policy",
            "Referrer-Policy",
            "Permissions-Policy",
        ]

        for header in always_present:
            assert header in response.headers, f"Missing header in dev: {header}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
