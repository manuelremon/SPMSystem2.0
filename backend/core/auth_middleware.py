"""
Authentication Middleware - Sets g.user from Bearer token

This middleware runs before every request and:
1. Extracts Bearer token from Authorization header or cookie
2. Decodes and validates the JWT
3. Fetches user from database
4. Sets g.user for use by route decorators like @require_auth
"""

import logging

import jwt
from flask import Flask, g, request
from jwt import InvalidTokenError

from backend.core.cache import user_cache
from backend.core.config import settings
from backend.core.user_helpers import get_user_by_id

logger = logging.getLogger(__name__)


def _get_user_by_id_cached(user_id: str) -> dict | None:
    """Fetch user from database with caching for auth middleware.

    Uses a lightweight SELECT (8 columns) + cache for the hot path
    that runs on every request. Falls back to get_user_by_id from
    user_helpers for the actual DB query.
    """
    cache_key = f"user:{user_id}"
    cached_user = user_cache.get(cache_key)
    if cached_user is not None:
        return cached_user

    try:
        user = get_user_by_id(user_id)
        if not user:
            return None

        # Build lightweight dict with only the fields needed for auth
        auth_user = {
            "id_spm": user.get("id_spm"),
            "nombre": user.get("nombre"),
            "apellido": user.get("apellido"),
            "rol": user.get("rol"),
            "mail": user.get("mail"),
            "centros": user.get("centros"),
            "sector": user.get("sector"),
            "posicion": user.get("posicion"),
        }

        # Add user_id alias for backward compatibility with routes using g.user.get("user_id")
        auth_user["user_id"] = auth_user.get("id_spm")

        # Cache the result
        user_cache.set(cache_key, auth_user, ttl=120)  # 2 min TTL
        return auth_user

    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {e}")
        return None


def _extract_token() -> str | None:
    """Extract JWT token from Authorization header or cookie"""
    # First try Authorization header (Bearer token)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()

    # Fallback to cookie
    return request.cookies.get("spm_token")


def _decode_access_token(token: str) -> dict | None:
    """Decode and validate JWT access token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        # Only accept access tokens
        if payload.get("type") != "access":
            return None
        return payload
    except InvalidTokenError:
        return None


class AuthMiddleware:
    """
    Authentication middleware that sets g.user on each request.

    This enables decorators like @require_auth to check g.user
    without each route needing to manually decode the JWT.
    """

    def __init__(self, app: Flask = None):
        self.app = app
        if app:
            self.init_app(app)

    def init_app(self, app: Flask) -> None:
        """Register before_request hook with Flask app"""
        self.app = app
        app.before_request(self.before_request)

    def before_request(self) -> None:
        """
        Before each request:
        - Try to extract and validate JWT token
        - If valid, set g.user with user data
        - If invalid or missing, g.user will be None
        """
        # Initialize g.user as None
        g.user = None

        # Try to get token
        token = _extract_token()
        if not token:
            return

        # Try to decode token
        payload = _decode_access_token(token)
        if not payload:
            return

        # Try to fetch user
        user_id = payload.get("user_id")
        if not user_id:
            return

        user = _get_user_by_id_cached(user_id)
        if user:
            g.user = user
            logger.debug(f"Authenticated user: {user.get('id_spm')}")


def init_auth_middleware(app: Flask) -> AuthMiddleware:
    """Factory function to initialize auth middleware"""
    return AuthMiddleware(app)
