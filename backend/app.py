"""
Backend v2.0 - Flask Application Factory

API REST limpia con CORS, blueprints, error handlers.
Refactorizado para mejor legibilidad y testabilidad.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from flask import Flask, jsonify

# Asegurar que el directorio raiz este en sys.path para imports relativos
_project_root = Path(__file__).parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# ruff: noqa: E402
from backend.core.auth_middleware import init_auth_middleware
from backend.core.blueprints import register_blueprints
from backend.core.config import settings
from backend.core.cors import init_cors
from backend.core.csrf import init_csrf_protection
from backend.core.db import db, init_db
from backend.core.db_optimization import create_indexes
from backend.core.errors import register_spm_error_handler
from backend.core.observability import init_observability
from backend.core.rate_limit import init_rate_limiting
from backend.core.request_validation import init_request_validation
from backend.core.security_headers import init_security_headers
from backend.core.spa import init_spa_routes


def create_app(config_override: dict | None = None) -> Flask:
    """
    Factory para crear aplicación Flask.

    Args:
        config_override: Configuración custom para tests (opcional)

    Returns:
        Instancia de Flask configurada
    """
    # Calcular rutas
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(current_dir)
    static_dir = os.path.join(root_dir, "frontend", "dist")

    app = Flask(
        __name__,
        static_folder=static_dir,
        static_url_path="",
    )

    # Configuración
    app.config.from_mapping(
        SECRET_KEY=settings.SECRET_KEY,
        DEBUG=settings.DEBUG,
        ENV=settings.ENV,
        SESSION_COOKIE_SECURE=settings.JWT_COOKIE_SECURE,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE=settings.JWT_COOKIE_SAMESITE,
        SQLALCHEMY_DATABASE_URI=settings.DATABASE_URL,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    if config_override:
        app.config.update(config_override)

    # ==================== INICIALIZACION ====================

    # Logging y Observabilidad
    _configure_logging(app)
    init_observability(app)

    # Database
    db.init_app(app)

    # Security middleware (orden importante)
    init_auth_middleware(app)  # Sets g.user from Bearer token
    init_csrf_protection(app)
    init_security_headers(app)

    # Rate limiting
    rate_limit_disabled = os.environ.get("DISABLE_RATE_LIMIT") == "1"
    if not rate_limit_disabled and app.config.get("RATE_LIMIT_ENABLED", True) and settings.ENV != "test":
        init_rate_limiting(app)
    elif rate_limit_disabled:
        app.logger.warning("Rate limiting DESHABILITADO por variable de entorno")

    # Request validation (sanitizacion de inputs)
    init_request_validation(app, max_content_length=10 * 1024 * 1024)  # 10MB max

    # CORS (manejo manual para wildcards con credentials)
    init_cors(app)

    # ==================== DATABASE ====================

    # Inicializar DB (siempre, init_db verifica si ya existe)
    with app.app_context():
        init_db()
        try:
            create_indexes()
        except Exception as e:
            app.logger.warning(f"No se pudieron crear indices: {e}")

    # ==================== BLUEPRINTS ====================

    register_blueprints(app)

    # ==================== SPA & FRONTEND ====================

    init_spa_routes(app)

    # ==================== ERROR HANDLERS ====================

    _register_error_handlers(app)
    register_spm_error_handler(app)

    # Logging de inicio
    app.logger.info(f"SPM Backend v2.0 initialized (ENV={settings.ENV})")

    return app


def _configure_logging(app: Flask) -> None:
    """Configura logging según entorno, evitando handlers duplicados."""
    # Limpiar handlers previos (por si hay reload)
    for handler in app.logger.handlers[:]:
        app.logger.removeHandler(handler)

    log_level = getattr(logging, settings.LOG_LEVEL.upper())

    # Formato de logs
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s in %(module)s: %(message)s")

    # Handler de archivo (solo si no es test)
    if settings.ENV != "test":
        log_file = Path(settings.LOG_FILE)
        log_file.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)
        app.logger.addHandler(file_handler)

    # Handler de consola
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    app.logger.addHandler(console_handler)

    app.logger.setLevel(log_level)


def _register_error_handlers(app: Flask) -> None:
    """Registra handlers para errores HTTP comunes."""

    @app.errorhandler(404)
    def not_found(error):
        from flask import request

        # Si es una solicitud GET y la ruta no es de API, devolver index.html (SPA routing)
        if request.method == "GET" and not request.path.startswith("/api"):
            try:
                static_folder = app.static_folder
                if static_folder:
                    index_file = Path(static_folder) / "index.html"
                    if index_file.exists():
                        with open(index_file, encoding="utf-8") as f:
                            return f.read(), 200
            except Exception as e:
                app.logger.error(f"Error serving index.html: {e}")

        # Para API requests, devolver JSON error
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "Resource not found"}}),
            404,
        )

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal error: {error}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "internal_error", "message": "Internal server error"},
                }
            ),
            500,
        )

    @app.errorhandler(405)
    def method_not_allowed(error):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "method_not_allowed", "message": "Method not allowed"},
                }
            ),
            405,
        )


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=True)
