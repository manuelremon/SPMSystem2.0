"""
CORS (Cross-Origin Resource Sharing) configuration and helpers.

Maneja CORS manualmente para soportar wildcards con credentials.
Flask-CORS no soporta funciones callable, asi que usamos @after_request.

Seguridad:
- Usa fullmatch() para patrones regex (no permite coincidencias parciales)
- Valida origen vacio (retorna False)
- Solo habilita credentials para origenes permitidos
"""

from __future__ import annotations

from flask import Flask, make_response, request

from backend.core.config import settings


def init_cors(app: Flask) -> None:
    """
    Initialize CORS handling for the Flask app.

    Reads allowed origins from CORS_ORIGINS environment variable.
    Supports both exact origins and regex patterns (wildcards).

    Args:
        app: Flask application instance
    """
    cors_origins = settings.get_cors_origins()
    allowed_exact: set[str] = {o for o in cors_origins if isinstance(o, str)}
    allowed_regex: list = [o for o in cors_origins if hasattr(o, "match")]

    def is_origin_allowed(origin: str | None) -> bool:
        """
        Validate if the origin is allowed.

        Args:
            origin: The Origin header value from the request

        Returns:
            True if origin is allowed, False otherwise
        """
        if not origin:
            return False
        # Check exact origins
        if origin in allowed_exact:
            return True
        # Check regex patterns (wildcards) - use fullmatch for security
        for pattern in allowed_regex:
            if pattern.fullmatch(origin):
                return True
        return False

    @app.after_request
    def add_cors_headers(response):
        """Add CORS headers dynamically based on the origin."""
        origin = request.headers.get("Origin")
        if origin:
            is_allowed = is_origin_allowed(origin)
            app.logger.info(f"CORS DEBUG (After): Origin={origin} Allowed={is_allowed}")
            
            if is_allowed:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Headers"] = (
                    "Content-Type, Authorization, X-CSRF-Token, bypass-tunnel-reminder"
                )
                response.headers["Access-Control-Allow-Methods"] = (
                    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                )
                response.headers["Access-Control-Max-Age"] = "86400"
        return response

    @app.before_request
    def handle_preflight():
        """Respond to preflight OPTIONS requests."""
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin")
            if origin:
                is_allowed = is_origin_allowed(origin)
                app.logger.info(f"CORS DEBUG (Preflight): Origin={origin} Allowed={is_allowed}")
                if is_allowed:
                    response = make_response()
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                    response.headers["Access-Control-Allow-Headers"] = (
                        "Content-Type, Authorization, X-CSRF-Token, bypass-tunnel-reminder"
                    )
                    response.headers["Access-Control-Allow-Methods"] = (
                        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                    )
                    response.headers["Access-Control-Max-Age"] = "86400"
                    return response
