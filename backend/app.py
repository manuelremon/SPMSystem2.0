"""
Backend v3.0 - Flask Application Factory

API REST limpia con CORS, blueprints, error handlers.
Refactorizado para mejor legibilidad y testabilidad.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
from pathlib import Path

from flask import Flask, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

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

    # Respetar cabeceras del proxy inverso (nginx): X-Forwarded-Proto/Host.
    # Sin esto, Flask genera redirects (p.ej. /api/lots -> /api/lots/ por
    # strict_slashes) con esquema http://, que el navegador bloquea por CSP.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

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

    # Sentry error tracking (production only)
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if sentry_dsn and settings.ENV == "production":
        try:
            import sentry_sdk
            from sentry_sdk.integrations.flask import FlaskIntegration

            sentry_sdk.init(
                dsn=sentry_dsn,
                integrations=[FlaskIntegration()],
                traces_sample_rate=0.1,
                environment="production",
                release=os.environ.get("SPM_VERSION", "unknown"),
            )
            app.logger.info("Sentry error tracking enabled")
        except ImportError:
            app.logger.warning("sentry-sdk not installed, Sentry disabled")

    # Logging y Observabilidad
    _configure_logging(app)
    init_observability(app)

    # Database
    db.init_app(app)

    # Security middleware (orden importante)
    init_auth_middleware(app)  # Sets g.user from Bearer token
    init_csrf_protection(app)
    init_security_headers(app)

    # Rate limiting (deshabilitado en desarrollo)
    rate_limit_disabled = os.environ.get("DISABLE_RATE_LIMIT") == "1" or settings.ENV == "development"
    if not rate_limit_disabled and app.config.get("RATE_LIMIT_ENABLED", True) and settings.ENV != "test":
        init_rate_limiting(app)
    elif rate_limit_disabled:
        if settings.ENV == "development":
            app.logger.warning("Rate limiting DESHABILITADO en desarrollo")
        else:
            app.logger.warning("Rate limiting DESHABILITADO por variable de entorno")

    # Request validation (sanitizacion de inputs)
    init_request_validation(app, max_content_length=None)  # Sin limite de tamanio

    # CORS (manejo manual para wildcards con credentials)
    init_cors(app)

    # ==================== CACHE ====================

    # Initialize Redis L2 cache if REDIS_URL is available (production)
    import os as _os
    redis_url = _os.environ.get("REDIS_URL")
    if redis_url:
        from backend.core.cache import init_redis_cache
        if init_redis_cache(redis_url):
            app.logger.info("Redis L2 cache enabled (shared across workers)")

    # ==================== DATABASE ====================

    # Inicializar DB (siempre, init_db verifica si ya existe)
    with app.app_context():
        init_db()
        try:
            create_indexes()
        except Exception as e:
            app.logger.warning(f"No se pudieron crear indices: {e}")

        # Ensure Vertex IA tables exist (idempotent, PostgreSQL only)
        try:
            from backend.routes.vertex_ia import ensure_vertex_tables
            ensure_vertex_tables()
        except Exception as e:
            app.logger.warning(f"Vertex tables check skipped: {e}")

        # Ensure SAP procurement views exist (idempotent, PostgreSQL only)
        try:
            from backend.routes.procurement import ensure_procurement_views
            ensure_procurement_views()
        except Exception as e:
            app.logger.warning(f"Procurement views check skipped: {e}")

    # ==================== SCHEDULED JOBS ====================

    if settings.ENV != "test" and not config_override:
        try:
            from backend.core.background_jobs import get_scheduler

            scheduler = get_scheduler()

            # Revisión MRP cada 4 horas (14400 seg)
            def _run_mrp_alerts():
                with app.app_context():
                    from backend.services.mrp_service import ejecutar_revision_alertas
                    ejecutar_revision_alertas()

            scheduler.add_schedule(
                name="mrp_alerts_review",
                func=_run_mrp_alerts,
                interval_seconds=14400,
                run_on_start=False,
            )

            # Verificación de presupuestos cada 1 hora (3600 seg)
            def _run_budget_check():
                with app.app_context():
                    from backend.services.budget_service import verificar_umbrales_presupuesto
                    verificar_umbrales_presupuesto()

            scheduler.add_schedule(
                name="budget_threshold_check",
                func=_run_budget_check,
                interval_seconds=3600,
                run_on_start=False,
            )

            # Limpieza de notificaciones antiguas cada 24 horas (86400 seg)
            def _run_notification_cleanup():
                with app.app_context():
                    from backend.services.notification_service import cleanup_old_notifications
                    cleanup_old_notifications(days_old=30)

            scheduler.add_schedule(
                name="notification_cleanup",
                func=_run_notification_cleanup,
                interval_seconds=86400,
                run_on_start=False,
            )

            scheduler.start()
            app.logger.info(f"ScheduledJobRunner started with {len(scheduler.get_status())} jobs")
        except Exception as e:
            app.logger.warning(f"ScheduledJobRunner init failed: {e}")

    # ==================== BLUEPRINTS ====================

    register_blueprints(app)

    # ==================== SPA & FRONTEND ====================

    init_spa_routes(app)

    # ==================== ERROR HANDLERS ====================

    _register_error_handlers(app)
    register_spm_error_handler(app)

    # Logging de inicio
    app.logger.info(f"SPM Backend v3.0 initialized (ENV={settings.ENV})")

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

        file_handler = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=3
        )
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
