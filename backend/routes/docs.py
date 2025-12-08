"""
Endpoints para documentacion de API.
Sprint 9.1 - Sirve especificacion OpenAPI y UI interactiva.

Endpoints:
- GET /api/docs         - UI Swagger interactiva
- GET /api/docs/openapi - Especificacion OpenAPI JSON
- GET /api/docs/redoc   - UI Redoc alternativa
"""

import json

from flask import Blueprint, Response, jsonify, render_template_string

try:
    from backend.core.openapi import generate_openapi_spec, API_VERSION, API_TITLE
except ImportError:
    from core.openapi import generate_openapi_spec, API_VERSION, API_TITLE

bp = Blueprint("docs", __name__, url_prefix="/api/docs")


# ==================== SWAGGER UI TEMPLATE ====================
SWAGGER_UI_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} - API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
    <style>
        body { margin: 0; padding: 0; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { font-size: 2em; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: "{{ spec_url }}",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                persistAuthorization: true,
                displayRequestDuration: true,
                filter: true,
                showExtensions: true,
                showCommonExtensions: true
            });
        };
    </script>
</body>
</html>
"""


# ==================== REDOC UI TEMPLATE ====================
REDOC_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} - API Reference</title>
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <redoc spec-url="{{ spec_url }}"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
"""


@bp.route("", methods=["GET"])
@bp.route("/", methods=["GET"])
def swagger_ui():
    """
    Sirve UI Swagger interactiva.

    Returns:
        HTML con Swagger UI
    """
    return render_template_string(
        SWAGGER_UI_HTML,
        title=API_TITLE,
        spec_url="/api/docs/openapi"
    )


@bp.route("/openapi", methods=["GET"])
@bp.route("/openapi.json", methods=["GET"])
def openapi_spec():
    """
    Sirve especificacion OpenAPI 3.0 en JSON.

    Returns:
        JSON con especificacion OpenAPI
    """
    spec = generate_openapi_spec()
    return Response(
        json.dumps(spec, indent=2, ensure_ascii=False),
        mimetype="application/json",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
        }
    )


@bp.route("/redoc", methods=["GET"])
def redoc_ui():
    """
    Sirve UI Redoc alternativa.

    Returns:
        HTML con Redoc UI
    """
    return render_template_string(
        REDOC_HTML,
        title=API_TITLE,
        spec_url="/api/docs/openapi"
    )


@bp.route("/info", methods=["GET"])
def api_info():
    """
    Informacion basica de la API.

    Returns:
        Metadata de la API
    """
    return jsonify({
        "ok": True,
        "data": {
            "title": API_TITLE,
            "version": API_VERSION,
            "docs": {
                "swagger": "/api/docs",
                "redoc": "/api/docs/redoc",
                "openapi": "/api/docs/openapi"
            }
        }
    })
