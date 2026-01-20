"""
Tests para validacion de CORS.

Verifica que la logica de CORS manual en app.py funciona correctamente:
- Origenes exactos permitidos
- Origenes regex (wildcards) permitidos
- Origenes desconocidos rechazados
- Origenes vacios rechazados
"""

from __future__ import annotations

import pytest


class TestCORSValidation:
    """Tests para la validacion de origenes CORS."""

    def test_cors_exact_origin_allowed(self, client):
        """Origen exacto 'http://localhost:5173' debe ser permitido."""
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )

        # Debe tener header CORS con el origen
        assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
        assert response.headers.get("Access-Control-Allow-Credentials") == "true"

    def test_cors_localhost_variations_allowed(self, client):
        """Variaciones de localhost deben ser permitidas."""
        # localhost:5173 es el frontend de desarrollo
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )
        assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"

        # localhost:5000 es el backend
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5000"}
        )
        assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5000"

    def test_cors_unknown_origin_rejected(self, client):
        """Origen desconocido no debe tener headers CORS."""
        response = client.get(
            "/api/health",
            headers={"Origin": "https://malicious-site.com"}
        )

        # No debe tener header Access-Control-Allow-Origin
        assert response.headers.get("Access-Control-Allow-Origin") is None

    def test_cors_empty_origin_rejected(self, client):
        """Peticion sin Origin no debe tener headers CORS."""
        response = client.get("/api/health")

        # No debe tener header Access-Control-Allow-Origin
        assert response.headers.get("Access-Control-Allow-Origin") is None

    def test_cors_preflight_options_request(self, client):
        """OPTIONS request debe responder correctamente para origenes permitidos."""
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )

        # Preflight debe tener todos los headers CORS
        assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
        assert response.headers.get("Access-Control-Allow-Methods") is not None
        assert "GET" in response.headers.get("Access-Control-Allow-Methods", "")

    def test_cors_preflight_rejected_for_unknown_origin(self, client):
        """OPTIONS request para origen desconocido no debe tener headers CORS."""
        response = client.options(
            "/api/health",
            headers={
                "Origin": "https://attacker.com",
                "Access-Control-Request-Method": "GET"
            }
        )

        # No debe tener header Access-Control-Allow-Origin
        assert response.headers.get("Access-Control-Allow-Origin") is None

    def test_cors_credentials_header_present(self, client):
        """Header Access-Control-Allow-Credentials debe estar presente."""
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )

        # Credentials deben estar habilitadas para origenes permitidos
        assert response.headers.get("Access-Control-Allow-Credentials") == "true"

    def test_cors_allowed_headers_include_csrf(self, client):
        """Headers permitidos deben incluir X-CSRF-Token."""
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "X-CSRF-Token"
            }
        )

        allowed_headers = response.headers.get("Access-Control-Allow-Headers", "")
        assert "X-CSRF-Token" in allowed_headers
