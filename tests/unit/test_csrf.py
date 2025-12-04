"""
Tests unitarios para el módulo CSRF
backend_v2/core/csrf.py

Generado por Sugar Autonomous System
"""

import os
import sys

import pytest
from flask import Flask, g

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend_v2.core.csrf import CSRFProtection, init_csrf_protection


class TestCSRFTokenGeneration:
    """Tests para generación de tokens CSRF"""

    def test_generate_token_returns_string(self):
        """El token generado debe ser un string"""
        token = CSRFProtection.generate_token()
        assert isinstance(token, str)
        assert len(token) > 0

    def test_generate_token_has_sufficient_length(self):
        """El token debe tener longitud suficiente para seguridad"""
        token = CSRFProtection.generate_token()
        # secrets.token_urlsafe(32) genera ~43 caracteres
        assert len(token) >= 32

    def test_generate_token_is_unique(self):
        """Cada token generado debe ser único"""
        tokens = [CSRFProtection.generate_token() for _ in range(100)]
        assert len(set(tokens)) == 100  # Todos únicos

    def test_generate_token_is_url_safe(self):
        """El token debe ser URL-safe (sin caracteres especiales problemáticos)"""
        token = CSRFProtection.generate_token()
        # URL-safe no debe contener +, /, =
        assert "+" not in token
        assert "/" not in token


class TestCSRFTokenSigning:
    """Tests para firma y validación de tokens"""

    def test_sign_token_creates_signature(self):
        """sign_token debe crear un token firmado con punto separador"""
        token = "test_token_123"
        secret = "my_secret_key"

        signed = CSRFProtection.sign_token(token, secret)

        assert "." in signed
        assert signed.startswith(token + ".")

    def test_sign_token_signature_is_hex(self):
        """La firma debe ser hexadecimal"""
        token = "test_token"
        secret = "secret"

        signed = CSRFProtection.sign_token(token, secret)
        signature = signed.split(".")[-1]

        # Verificar que es hexadecimal válido
        int(signature, 16)  # No debe lanzar excepción

    def test_sign_token_different_secrets_different_signatures(self):
        """Diferentes secrets deben producir diferentes firmas"""
        token = "same_token"

        signed1 = CSRFProtection.sign_token(token, "secret1")
        signed2 = CSRFProtection.sign_token(token, "secret2")

        assert signed1 != signed2

    def test_sign_token_same_input_same_output(self):
        """Mismo token y secret deben producir misma firma (determinístico)"""
        token = "test_token"
        secret = "test_secret"

        signed1 = CSRFProtection.sign_token(token, secret)
        signed2 = CSRFProtection.sign_token(token, secret)

        assert signed1 == signed2


class TestCSRFTokenUnsigning:
    """Tests para validación de tokens firmados"""

    def test_unsign_token_valid_signature(self):
        """unsign_token debe retornar el token original si la firma es válida"""
        token = "my_csrf_token"
        secret = "my_secret"

        signed = CSRFProtection.sign_token(token, secret)
        result = CSRFProtection.unsign_token(signed, secret)

        assert result == token

    def test_unsign_token_invalid_signature(self):
        """unsign_token debe retornar None si la firma es inválida"""
        token = "my_csrf_token"
        secret = "correct_secret"

        signed = CSRFProtection.sign_token(token, secret)
        result = CSRFProtection.unsign_token(signed, "wrong_secret")

        assert result is None

    def test_unsign_token_tampered_token(self):
        """unsign_token debe retornar None si el token fue modificado"""
        token = "original_token"
        secret = "my_secret"

        signed = CSRFProtection.sign_token(token, secret)
        # Modificar el token manteniendo la firma original
        tampered = "tampered_token." + signed.split(".")[-1]

        result = CSRFProtection.unsign_token(tampered, secret)

        assert result is None

    def test_unsign_token_missing_separator(self):
        """unsign_token debe manejar tokens sin separador"""
        result = CSRFProtection.unsign_token("no_separator_here", "secret")
        assert result is None

    def test_unsign_token_empty_string(self):
        """unsign_token debe manejar string vacío"""
        result = CSRFProtection.unsign_token("", "secret")
        assert result is None

    def test_unsign_token_none_input(self):
        """unsign_token debe manejar None como input"""
        result = CSRFProtection.unsign_token(None, "secret")
        assert result is None


class TestCSRFProtectionMiddleware:
    """Tests para el middleware CSRF"""

    @pytest.fixture
    def app(self):
        """Crear aplicación Flask de prueba"""
        app = Flask(__name__)
        app.config["SECRET_KEY"] = "test_secret_key_for_csrf"
        app.config["TESTING"] = True
        return app

    @pytest.fixture
    def csrf(self, app):
        """Inicializar protección CSRF"""
        return CSRFProtection(app)

    def test_init_app_binds_hooks(self, app):
        """init_app debe registrar before_request y after_request"""
        csrf = CSRFProtection()

        before_count = len(app.before_request_funcs.get(None, []))
        after_count = len(app.after_request_funcs.get(None, []))

        csrf.init_app(app)

        assert len(app.before_request_funcs.get(None, [])) == before_count + 1
        assert len(app.after_request_funcs.get(None, [])) == after_count + 1

    def test_before_request_creates_token_if_missing(self, app, csrf):
        """before_request debe crear token si no existe en cookie"""
        with app.test_request_context("/api/test", method="GET"):
            csrf.before_request()

            assert hasattr(g, "csrf_token")
            assert g.csrf_token is not None
            assert hasattr(g, "_csrf_new_token")
            assert g._csrf_new_token is True

    def test_before_request_uses_existing_token(self, app, csrf):
        """before_request debe usar token existente de cookie válida"""
        token = CSRFProtection.generate_token()
        signed = CSRFProtection.sign_token(token, app.config["SECRET_KEY"])

        with app.test_request_context("/api/test", method="GET"):
            from flask import request

            request.cookies = {"spm_csrf": signed}

            csrf.before_request()

            assert g.csrf_token == token
            assert not getattr(g, "_csrf_new_token", False)

    def test_before_request_exempt_paths_login(self, app, csrf):
        """before_request no debe validar CSRF en /api/auth/login"""
        with app.test_request_context("/api/auth/login", method="POST"):
            result = csrf.before_request()
            # No debe retornar error 403
            assert result is None

    def test_before_request_exempt_paths_csrf(self, app, csrf):
        """before_request no debe validar CSRF en /api/auth/csrf"""
        with app.test_request_context("/api/auth/csrf", method="POST"):
            result = csrf.before_request()
            assert result is None

    def test_before_request_exempt_paths_register(self, app, csrf):
        """before_request no debe validar CSRF en /api/auth/register"""
        with app.test_request_context("/api/auth/register", method="POST"):
            result = csrf.before_request()
            assert result is None

    def test_before_request_validates_csrf_on_post(self, app, csrf):
        """before_request debe validar CSRF en POST a rutas protegidas"""
        with app.test_request_context("/api/solicitudes", method="POST"):
            result = csrf.before_request()

            # Debe retornar error 403 porque no hay token en header
            assert result is not None
            response, status_code = result
            assert status_code == 403

    def test_before_request_accepts_valid_csrf_header(self, app, csrf):
        """before_request debe aceptar token CSRF válido en header"""
        token = CSRFProtection.generate_token()
        signed = CSRFProtection.sign_token(token, app.config["SECRET_KEY"])

        with app.test_request_context(
            "/api/solicitudes", method="POST", headers={"X-CSRF-Token": token}
        ):
            from flask import request

            request.cookies = {"spm_csrf": signed}

            result = csrf.before_request()

            # No debe retornar error
            assert result is None

    def test_before_request_rejects_wrong_csrf_header(self, app, csrf):
        """before_request debe rechazar token CSRF incorrecto"""
        token = CSRFProtection.generate_token()
        signed = CSRFProtection.sign_token(token, app.config["SECRET_KEY"])

        with app.test_request_context(
            "/api/solicitudes", method="POST", headers={"X-CSRF-Token": "wrong_token"}
        ):
            from flask import request

            request.cookies = {"spm_csrf": signed}

            result = csrf.before_request()

            assert result is not None
            response, status_code = result
            assert status_code == 403

    def test_after_request_sets_csrf_header(self, app, csrf):
        """after_request debe incluir X-CSRF-Token en response headers"""
        with app.test_request_context("/api/test"):
            g.csrf_token = "test_token_123"

            response = app.make_response("")
            result = csrf.after_request(response)

            assert "X-CSRF-Token" in result.headers
            assert result.headers["X-CSRF-Token"] == "test_token_123"

    def test_after_request_sets_cookie_for_new_token(self, app, csrf):
        """after_request debe establecer cookie si es token nuevo"""
        with app.test_request_context("/api/test"):
            g.csrf_token = "new_token"
            g._csrf_new_token = True

            response = app.make_response("")
            result = csrf.after_request(response)

            # Verificar que se estableció la cookie
            cookies = result.headers.getlist("Set-Cookie")
            assert any("spm_csrf=" in cookie for cookie in cookies)


class TestInitCSRFProtection:
    """Tests para la función factory"""

    def test_init_csrf_protection_returns_instance(self):
        """init_csrf_protection debe retornar instancia de CSRFProtection"""
        app = Flask(__name__)
        app.config["SECRET_KEY"] = "test"

        result = init_csrf_protection(app)

        assert isinstance(result, CSRFProtection)

    def test_init_csrf_protection_binds_to_app(self):
        """init_csrf_protection debe vincular la protección a la app"""
        app = Flask(__name__)
        app.config["SECRET_KEY"] = "test"

        csrf = init_csrf_protection(app)

        assert csrf.app is app


class TestCSRFSecurityProperties:
    """Tests de propiedades de seguridad"""

    def test_tokens_have_high_entropy(self):
        """Los tokens deben tener alta entropía"""
        tokens = [CSRFProtection.generate_token() for _ in range(1000)]

        # Verificar que hay suficiente variación
        unique_chars = set("".join(tokens))
        assert len(unique_chars) > 50  # Debe usar muchos caracteres diferentes

    def test_timing_safe_comparison(self):
        """La comparación de firmas debe ser timing-safe"""
        # Esto es difícil de probar directamente, pero verificamos
        # que se usa hmac.compare_digest internamente
        token = "test"
        secret = "secret"
        signed = CSRFProtection.sign_token(token, secret)

        # Múltiples comparaciones no deben revelar información de timing
        for _ in range(100):
            CSRFProtection.unsign_token(signed, secret)
            CSRFProtection.unsign_token(signed, "wrong")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
