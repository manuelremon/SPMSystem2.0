"""
Tests unitarios para el módulo Security Headers
backend_v2/core/security_headers.py

Generado por Sugar Autonomous System
"""

import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend_v2.core.security_headers import init_security_headers


class TestSecurityHeadersInitialization:
    """Tests para la inicialización de headers de seguridad"""

    @pytest.fixture
    def app(self):
        """Crear aplicación Flask de prueba"""
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        return app

    @pytest.fixture
    def app_with_headers(self, app):
        """Aplicación con headers de seguridad inicializados"""
        init_security_headers(app)
        return app

    def test_init_security_headers_returns_app(self, app):
        """init_security_headers debe retornar la aplicación"""
        result = init_security_headers(app)
        assert result is app

    def test_init_security_headers_registers_after_request(self, app):
        """init_security_headers debe registrar un after_request handler"""
        before_count = len(app.after_request_funcs.get(None, []))
        init_security_headers(app)
        after_count = len(app.after_request_funcs.get(None, []))

        assert after_count == before_count + 1


class TestStrictTransportSecurity:
    """Tests para el header HSTS"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_hsts_header_present(self, client):
        """El header Strict-Transport-Security debe estar presente"""
        response = client.get("/test")
        assert "Strict-Transport-Security" in response.headers

    def test_hsts_max_age(self, client):
        """HSTS debe tener max-age de 1 año (31536000 segundos)"""
        response = client.get("/test")
        hsts = response.headers.get("Strict-Transport-Security")
        assert "max-age=31536000" in hsts

    def test_hsts_include_subdomains(self, client):
        """HSTS debe incluir subdominios"""
        response = client.get("/test")
        hsts = response.headers.get("Strict-Transport-Security")
        assert "includeSubDomains" in hsts


class TestContentTypeOptions:
    """Tests para X-Content-Type-Options"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_content_type_options_present(self, client):
        """El header X-Content-Type-Options debe estar presente"""
        response = client.get("/test")
        assert "X-Content-Type-Options" in response.headers

    def test_content_type_options_nosniff(self, client):
        """X-Content-Type-Options debe ser 'nosniff'"""
        response = client.get("/test")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"


class TestFrameOptions:
    """Tests para X-Frame-Options (protección clickjacking)"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_frame_options_present(self, client):
        """El header X-Frame-Options debe estar presente"""
        response = client.get("/test")
        assert "X-Frame-Options" in response.headers

    def test_frame_options_deny(self, client):
        """X-Frame-Options debe ser 'DENY'"""
        response = client.get("/test")
        assert response.headers.get("X-Frame-Options") == "DENY"


class TestXSSProtection:
    """Tests para X-XSS-Protection"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_xss_protection_present(self, client):
        """El header X-XSS-Protection debe estar presente"""
        response = client.get("/test")
        assert "X-XSS-Protection" in response.headers

    def test_xss_protection_enabled(self, client):
        """X-XSS-Protection debe estar habilitado con mode=block"""
        response = client.get("/test")
        xss = response.headers.get("X-XSS-Protection")
        assert "1" in xss
        assert "mode=block" in xss


class TestContentSecurityPolicy:
    """Tests para Content-Security-Policy"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_csp_header_present(self, client):
        """El header Content-Security-Policy debe estar presente"""
        response = client.get("/test")
        assert "Content-Security-Policy" in response.headers

    def test_csp_default_src(self, client):
        """CSP debe tener default-src 'self'"""
        response = client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "default-src 'self'" in csp

    def test_csp_script_src(self, client):
        """CSP debe tener script-src configurado"""
        response = client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "script-src 'self'" in csp

    def test_csp_style_src(self, client):
        """CSP debe tener style-src configurado"""
        response = client.get("/test")
        csp = response.headers.get("Content-Security-Policy")
        assert "style-src 'self'" in csp


class TestReferrerPolicy:
    """Tests para Referrer-Policy"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_referrer_policy_present(self, client):
        """El header Referrer-Policy debe estar presente"""
        response = client.get("/test")
        assert "Referrer-Policy" in response.headers

    def test_referrer_policy_strict(self, client):
        """Referrer-Policy debe ser 'strict-no-referrer'"""
        response = client.get("/test")
        assert response.headers.get("Referrer-Policy") == "strict-no-referrer"


class TestPermissionsPolicy:
    """Tests para Permissions-Policy"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_permissions_policy_present(self, client):
        """El header Permissions-Policy debe estar presente"""
        response = client.get("/test")
        assert "Permissions-Policy" in response.headers

    def test_permissions_policy_camera_disabled(self, client):
        """Permissions-Policy debe deshabilitar camera"""
        response = client.get("/test")
        policy = response.headers.get("Permissions-Policy")
        assert "camera=()" in policy

    def test_permissions_policy_microphone_disabled(self, client):
        """Permissions-Policy debe deshabilitar microphone"""
        response = client.get("/test")
        policy = response.headers.get("Permissions-Policy")
        assert "microphone=()" in policy

    def test_permissions_policy_geolocation_disabled(self, client):
        """Permissions-Policy debe deshabilitar geolocation"""
        response = client.get("/test")
        policy = response.headers.get("Permissions-Policy")
        assert "geolocation=()" in policy


class TestHeadersOnAllMethods:
    """Tests para verificar headers en diferentes métodos HTTP"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test", methods=["GET", "POST", "PUT", "DELETE"])
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_headers_on_get(self, client):
        """Headers deben estar presentes en GET"""
        response = client.get("/test")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_post(self, client):
        """Headers deben estar presentes en POST"""
        response = client.post("/test")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_put(self, client):
        """Headers deben estar presentes en PUT"""
        response = client.put("/test")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers

    def test_headers_on_delete(self, client):
        """Headers deben estar presentes en DELETE"""
        response = client.delete("/test")
        assert "X-Frame-Options" in response.headers
        assert "X-Content-Type-Options" in response.headers


class TestHeadersOnErrorResponses:
    """Tests para verificar headers en respuestas de error"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/error")
        def error_route():
            return "Error", 500

        @app.route("/not-found")
        def not_found():
            return "Not Found", 404

        init_security_headers(app)
        return app.test_client()

    def test_headers_on_500_error(self, client):
        """Headers deben estar presentes en errores 500"""
        response = client.get("/error")
        assert response.status_code == 500
        assert "X-Frame-Options" in response.headers
        assert "Strict-Transport-Security" in response.headers

    def test_headers_on_404_error(self, client):
        """Headers deben estar presentes en errores 404"""
        response = client.get("/not-found")
        assert response.status_code == 404
        assert "X-Frame-Options" in response.headers
        assert "Strict-Transport-Security" in response.headers


class TestOWASPCompliance:
    """Tests para verificar cumplimiento OWASP"""

    @pytest.fixture
    def client(self):
        app = Flask(__name__)
        app.config["TESTING"] = True

        @app.route("/test")
        def test_route():
            return "OK"

        init_security_headers(app)
        return app.test_client()

    def test_all_owasp_headers_present(self, client):
        """Todos los headers OWASP recomendados deben estar presentes"""
        response = client.get("/test")

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

    def test_no_server_header_exposure(self, client):
        """El header Server no debe revelar información sensible"""
        response = client.get("/test")
        server = response.headers.get("Server", "")
        # No debe revelar versiones específicas
        assert "Python" not in server or "Werkzeug" not in server


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
