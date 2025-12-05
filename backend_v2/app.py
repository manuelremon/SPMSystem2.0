"""
Backend v2.0 - Flask Application Factory
API REST limpia con CORS, blueprints, error handlers
"""

from __future__ import annotations

import logging
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS

try:
    from backend_v2.agent import agent_bp
    from backend_v2.core.config import settings
    from backend_v2.core.csrf import init_csrf_protection
    from backend_v2.core.db import db, init_db
    from backend_v2.core.security_headers import init_security_headers
    from backend_v2.routes import (admin, auth, budget, catalogos, foro,
                                   health, materiales, materiales_detalle,
                                   mensajes, mi_cuenta, notificaciones)
    from backend_v2.routes import planner
    from backend_v2.routes import planner as planner_new
    from backend_v2.routes import solicitudes, trivias
except ImportError:
    from agent import agent_bp
    from core.config import settings
    from core.csrf import init_csrf_protection
    from core.db import db, init_db
    from core.security_headers import init_security_headers
    from routes import (admin, auth, budget, catalogos, foro, health,
                        materiales, materiales_detalle, mensajes, mi_cuenta,
                        notificaciones)
    from routes import planner as planner_new
    from routes import solicitudes, trivias


def create_app(config_override: dict | None = None) -> Flask:
    """
    Factory para crear aplicación Flask.

    Args:
        config_override: Configuración custom para tests (opcional)

    Returns:
        Instancia de Flask configurada
    """
    app = Flask(__name__)

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

    # Logging
    _configure_logging(app)

    # Inicializar DB
    db.init_app(app)

    # Protección CSRF
    init_csrf_protection(app)

    # Security headers
    init_security_headers(app)

    # CORS
    CORS(
        app,
        origins=settings.get_cors_origins(),
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # Inicializar DB (solo en dev/test)
    if settings.ENV in ["development", "test"]:
        with app.app_context():
            init_db()

    # Registrar blueprints
    app.register_blueprint(health.bp)
    app.register_blueprint(auth.bp, url_prefix="/api/auth")
    app.register_blueprint(solicitudes.bp)
    app.register_blueprint(planner_new.bp, url_prefix="/api/planificador")
    app.register_blueprint(catalogos.bp, url_prefix="/api/catalogos")
    app.register_blueprint(mi_cuenta.bp, url_prefix="/api")
    app.register_blueprint(materiales.bp)
    app.register_blueprint(materiales_detalle.bp_detalle)
    app.register_blueprint(admin.bp)
    app.register_blueprint(notificaciones.bp)  # Notifications real-time system
    app.register_blueprint(mensajes.bp)  # Bidirectional messaging system
    app.register_blueprint(agent_bp)  # Agent routes registered at /api/agent
    app.register_blueprint(budget.bp)  # Budget/BUR management at /api
    app.register_blueprint(trivias.bp, url_prefix="/api")  # Trivias: games, rankings, scores
    app.register_blueprint(foro.bp, url_prefix="/api")  # Forum: posts, replies, likes

    @app.route("/")
    def index():
        """Información sobre la API"""
        return (
            jsonify(
                {
                    "ok": True,
                    "message": "SPM v2.0 Backend API",
                    "version": "2.0.0",
                    "endpoints": {
                        "health": "/api/health",
                        "auth": "/api/auth/login",
                        "solicitudes": "/api/solicitudes",
                        "planificador": "/api/planificador",
                        "catalogos": "/api/catalogos",
                        "docs": "https://github.com/manuelremon/SPMSystem2.0",
                    },
                }
            ),
            200,
        )

    @app.route("/favicon.ico")
    def favicon():
        """Serve a tiny SVG favicon to avoid 404 noise."""
        svg = (
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
            "<rect width='64' height='64' rx='12' fill='#2563eb'/>"
            "<path d='M16 44l8-24h8l-8 24h-8Zm16 0 8-24h8l-8 24h-8Z' fill='#e5e7eb'/>"
            "</svg>"
        )
        return app.response_class(svg, mimetype="image/svg+xml")

    # Error handlers
    _register_error_handlers(app)

    # Logging de inicio
    app.logger.info(f"SPM Backend v2.0 initialized (ENV={settings.ENV})")

    return app


def _configure_logging(app: Flask) -> None:
    """Configura logging según entorno, evitando handlers duplicados"""
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
    """Registra handlers para errores HTTP comunes"""

    @app.errorhandler(404)
    def not_found(error):
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
