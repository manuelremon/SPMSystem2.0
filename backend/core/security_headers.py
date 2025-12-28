"""
Security Headers - OWASP compliant

Diferencia headers según el entorno:
- Production: Headers estrictos (HSTS, CSP con dominios externos permitidos)
- Development: Headers relajados para facilitar desarrollo
"""

import os

from flask import Flask

try:
    from backend.core.config import settings
except ImportError:
    from core.config import settings


def init_security_headers(app: Flask):
    """
    Inicializa headers de seguridad OWASP.

    En produccion con Docker/Nginx: NO duplica headers (Nginx los maneja).
    En produccion directa (Render): Aplica headers estrictos.
    En desarrollo: Relaja algunos para facilitar pruebas.
    """
    is_production = settings.ENV == "production"

    # Detectar si estamos en Render u otro hosting directo (sin Nginx)
    is_render = os.getenv("RENDER", "") == "true"

    # Detectar si estamos detras de Nginx (Docker prod)
    # Nginx ya maneja los security headers, evitar duplicacion
    is_behind_nginx = is_production and not is_render

    @app.after_request
    def set_security_headers(response):
        # En produccion con Docker/Nginx, NO duplicar headers
        # Nginx ya los configura en default.conf
        if is_behind_nginx:
            return response

        # Prevent MIME sniffing - siempre (dev/Render)
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer Policy - siempre (dev/Render)
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy - siempre (dev/Render)
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        if is_render:
            # Render (produccion directa sin Nginx)
            # HSTS - Solo en produccion (requiere HTTPS)
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

            # Clickjacking protection
            response.headers["X-Frame-Options"] = "DENY"

            # XSS Protection (legacy, CSP lo reemplaza)
            response.headers["X-XSS-Protection"] = "1; mode=block"

            # Content Security Policy para PRODUCCION
            # Permite Google Fonts y conexiones al propio dominio
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "form-action 'self'; "
                "base-uri 'self';"
            )
            response.headers["Content-Security-Policy"] = csp
        else:
            # Development: headers relajados
            # Permite hot-reload, devtools, etc.
            response.headers["X-Frame-Options"] = "SAMEORIGIN"

            # CSP permisivo para desarrollo (incluye unsafe-inline para HMR)
            csp_dev = (
                "default-src 'self' localhost:* 127.0.0.1:*; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* 127.0.0.1:*; "
                "style-src 'self' 'unsafe-inline' localhost:* 127.0.0.1:* https://fonts.googleapis.com; "
                "img-src 'self' data: blob: localhost:* 127.0.0.1:*; "
                "font-src 'self' data: localhost:* 127.0.0.1:* https://fonts.gstatic.com; "
                "connect-src 'self' ws: wss: localhost:* 127.0.0.1:*;"
            )
            response.headers["Content-Security-Policy"] = csp_dev

        return response

    return app
