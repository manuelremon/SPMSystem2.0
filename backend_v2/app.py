"""
Backend v2.0 - Flask Application Factory
API REST limpia con CORS, blueprints, error handlers
"""

from __future__ import annotations

import logging
from pathlib import Path

from flask import Flask, jsonify, send_from_directory, render_template_string
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
    # Determinar rutas de archivos estáticos
    base_dir = Path(__file__).parent.parent  # Directorio raíz del proyecto
    static_dir = base_dir / "frontend" / "dist"
    
    # Crear app con rutas de archivos estáticos
    app = Flask(
        __name__,
        static_folder=str(static_dir),
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

    # ==================== SERVIR FRONTEND REACT ====================
    # Intentar cargar index.html para SPA routing
    static_dir = Path(app.static_folder)
    index_file = static_dir / "index.html"
    
    @app.route("/")
    def serve_spa_index():
        """Servir index.html para React SPA"""
        if index_file.exists():
            with open(index_file) as f:
                return f.read()
        # Fallback a la API info si no existe index.html
        return api_info()

    @app.route("/<path:path>", methods=["GET"])
    def serve_spa_routes(path):
        """
        Manejar rutas de React SPA.
        Si el archivo existe (assets, imágenes, etc), servirlo.
        Si no existe, devolver index.html para que React maneje el routing.
        """
        # Intentar servir archivo estático
        file_path = static_dir / path
        if file_path.exists() and file_path.is_file():
            return send_from_directory(str(static_dir), path)
        
        # Si es una ruta que no existe, servir index.html (SPA routing)
        if index_file.exists():
            with open(index_file) as f:
                return f.read()
        
        from flask import abort
        abort(404)

    def api_info():
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

    # ==================== RUTAS ANTIGUAS ====================
    # Mantener compatibilidad
    @app.route("/api")
    def api_root():
        """Endpoint API raíz"""
        return api_info()

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
        from flask import request
        
        # Si es una solicitud GET y la ruta no es de API, devolver index.html (SPA routing)
        if request.method == "GET" and not request.path.startswith("/api"):
            static_dir = Path(app.static_folder)
            index_file = static_dir / "index.html"
            if index_file.exists():
                with open(index_file) as f:
                    return f.read(), 200
        
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
