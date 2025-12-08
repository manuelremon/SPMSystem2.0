"""
CSRF protection - token generation and validation
"""

import hashlib
import hmac
import secrets

from flask import current_app, g, jsonify, request


class CSRFProtection:
    """Handle CSRF protection with real validation"""

    def __init__(self, app=None):
        self.app = app
        if app:
            self.init_app(app)

    def init_app(self, app):
        """Bind hooks to the Flask app"""
        self.app = app
        app.before_request(self.before_request)
        app.after_request(self.after_request)

    @staticmethod
    def generate_token() -> str:
        """Generate a random CSRF token"""
        return secrets.token_urlsafe(32)

    @staticmethod
    def sign_token(token: str, secret: str) -> str:
        """Sign a CSRF token"""
        signature = hmac.new(secret.encode(), token.encode(), hashlib.sha256).digest()
        return token + "." + signature.hex()

    @staticmethod
    def unsign_token(signed_token: str, secret: str) -> str | None:
        """Return the token if the signature is valid"""
        try:
            token, signature = signed_token.rsplit(".", 1)
            expected = hmac.new(secret.encode(), token.encode(), hashlib.sha256).digest().hex()
            if hmac.compare_digest(signature, expected):
                return token
        except (ValueError, AttributeError):
            return None
        return None

    def before_request(self):
        """Middleware before each request"""
        raw_cookie = request.cookies.get("spm_csrf")
        token = (
            self.unsign_token(raw_cookie, current_app.config["SECRET_KEY"]) if raw_cookie else None
        )

        if not token:
            token = self.generate_token()
            g._csrf_new_token = True

        g.csrf_token = token

        # Endpoints excluidos de validación CSRF (public endpoints)
        exempt_paths = {
            "/api/auth/login",
            "/api/auth/csrf",
            "/api/auth/register",
            "/api/auth/logout",
            "/api/health",
        }

        # Validate on state-changing methods (excepto en endpoints públicos)
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if request.path not in exempt_paths:
                # Si hay Bearer token, el usuario está autenticado de forma segura
                # CSRF protege contra ataques que explotan cookies, no Bearer tokens
                auth_header = request.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    # Usuario autenticado con Bearer token, CSRF no es necesario
                    return None

                header_token = request.headers.get("X-CSRF-Token")
                if not header_token or header_token != token:
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "csrf_error",
                                    "message": "Invalid or missing CSRF token",
                                },
                            }
                        ),
                        403,
                    )

    def after_request(self, response):
        """Middleware after each response"""
        if hasattr(g, "csrf_token"):
            response.headers["X-CSRF-Token"] = g.csrf_token

            if getattr(g, "_csrf_new_token", False):
                signed = self.sign_token(g.csrf_token, current_app.config["SECRET_KEY"])
                response.set_cookie(
                    "spm_csrf",
                    signed,
                    secure=current_app.config.get("SESSION_COOKIE_SECURE", False),
                    httponly=False,  # client must read it to include in header
                    samesite=current_app.config.get("SESSION_COOKIE_SAMESITE", "Lax"),
                    path="/",
                )
        return response


def init_csrf_protection(app):
    """Factory to initialize CSRF protection"""
    csrf = CSRFProtection(app)
    return csrf
