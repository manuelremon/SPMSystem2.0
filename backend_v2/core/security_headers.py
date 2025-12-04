"""
Security Headers - OWASP compliant

Diferencia headers según el entorno:
- Production: Headers estrictos (HSTS, CSP sin unsafe-inline)
- Development: Headers relajados para facilitar desarrollo
"""

from flask import Flask

try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings


def init_security_headers(app: Flask):
    """
    Inicializa headers de seguridad OWASP.

    En produccion aplica headers estrictos.
    En desarrollo relaja algunos para facilitar pruebas.
    """
    is_production = settings.ENV == "production"

    @app.after_request
    def set_security_headers(response):
        # Prevent MIME sniffing - siempre
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer Policy - siempre
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy - siempre
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        if is_production:
            # HSTS - Solo en produccion (requiere HTTPS)
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

            # Clickjacking protection
            response.headers["X-Frame-Options"] = "DENY"

            # XSS Protection (legacy, CSP lo reemplaza)
            response.headers["X-XSS-Protection"] = "1; mode=block"

            # Content Security Policy ESTRICTO - sin unsafe-inline
            # Usa nonces o hashes para scripts inline si los necesitas
            csp = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
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
                "style-src 'self' 'unsafe-inline' localhost:* 127.0.0.1:*; "
                "img-src 'self' data: blob: localhost:* 127.0.0.1:*; "
                "font-src 'self' data: localhost:* 127.0.0.1:*; "
                "connect-src 'self' ws: wss: localhost:* 127.0.0.1:*;"
            )
            response.headers["Content-Security-Policy"] = csp_dev

        return response

    return app
