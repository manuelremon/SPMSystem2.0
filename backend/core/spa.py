"""
SPA (Single Page Application) serving helpers.

Maneja el servicio del frontend React desde Flask:
- Sirve index.html para la ruta raiz
- Sirve archivos estaticos desde frontend/dist
- Fallback a index.html para SPA routing (React Router)
- Endpoint /api para informacion de la API
"""

from __future__ import annotations

import os

from flask import Flask, jsonify, send_from_directory


def init_spa_routes(app: Flask) -> None:
    """
    Register routes for serving React SPA.

    Args:
        app: Flask application instance
    """
    # Calculate frontend paths
    current_dir = os.path.dirname(os.path.abspath(__file__))  # backend/core
    backend_dir = os.path.dirname(current_dir)  # backend
    root_dir = os.path.dirname(backend_dir)  # project root
    frontend_dist = os.path.join(root_dir, "frontend", "dist")
    index_html_path = os.path.join(frontend_dist, "index.html")

    # Debug logging
    app.logger.info(f"Frontend dist: {frontend_dist}")
    app.logger.info(f"Frontend dist exists: {os.path.exists(frontend_dist)}")
    app.logger.info(f"Index.html: {index_html_path}")
    app.logger.info(f"Index.html exists: {os.path.exists(index_html_path)}")

    def _get_api_info():
        """Return API information."""
        return (
            jsonify(
                {
                    "ok": True,
                    "message": "SPM v3.0 Backend API",
                    "version": "3.0.0",
                    "endpoints": {
                        "health": "/api/health",
                        "auth": "/api/auth/login",
                        "solicitudes": "/api/solicitudes",
                        "planificador": "/api/planificador",
                        "catalogos": "/api/catalogos",
                        "docs": "https://github.com/manuelremon/SPMV3.0",
                    },
                }
            ),
            200,
        )

    @app.route("/")
    def serve_spa_index():
        """Serve index.html for React SPA."""
        try:
            if os.path.exists(index_html_path):
                with open(index_html_path, encoding="utf-8") as f:
                    return f.read(), 200, {"Content-Type": "text/html; charset=utf-8"}
        except Exception as e:
            app.logger.error(f"Error serving index.html: {e}")

        # Fallback to API info
        app.logger.warning("Serving API info (index.html not found)")
        return _get_api_info()

    @app.route("/<path:path>", methods=["GET"])
    def serve_spa_routes(path):
        """
        Handle React SPA routes.

        Serves static files from frontend/dist, or falls back to index.html
        for client-side routing.
        """
        try:
            file_path = os.path.join(frontend_dist, path)
            # Validate that the file is inside frontend_dist (security)
            if os.path.commonpath([file_path, frontend_dist]) == frontend_dist:
                if os.path.isfile(file_path):
                    return send_from_directory(frontend_dist, path)
        except Exception as e:
            app.logger.error(f"Error serving {path}: {e}")

        # Fallback to index.html for SPA routing
        try:
            if os.path.exists(index_html_path):
                with open(index_html_path, encoding="utf-8") as f:
                    return f.read(), 200, {"Content-Type": "text/html; charset=utf-8"}
        except Exception as e:
            app.logger.error(f"Error serving index.html fallback: {e}")

        from flask import abort

        abort(404)

    @app.route("/api")
    def api_root():
        """API root endpoint."""
        return _get_api_info()

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
