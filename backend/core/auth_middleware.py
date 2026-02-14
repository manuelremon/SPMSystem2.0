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
from backend.core.db import get_db_connection

logger = logging.getLogger(__name__)


def _get_user_by_id(user_id: str) -> dict | None:
    """Fetch user from database with caching (PostgreSQL/SQLite compatible)"""
    # Try cache first
    cache_key = f"user:{user_id}"
    cached_user = user_cache.get(cache_key)
    if cached_user is not None:
        return cached_user

    # Cache miss - fetch from DB (uses get_db_connection for PG/SQLite compatibility)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id_spm, nombre, apellido, rol, mail, centros, sector, posicion FROM usuario WHERE id_spm = ?",
                (str(user_id),),
            )
            row = cur.fetchone()

        if not row:
            return None

        # Convert row to dict (compatible with both PostgreSQL dict and SQLite tuple)
        if isinstance(row, dict):
            user = row
        else:
            user = {
                "id_spm": row[0],
                "nombre": row[1],
                "apellido": row[2],
                "rol": row[3],
                "mail": row[4],
                "centros": row[5],
                "sector": row[6],
                "posicion": row[7],
            }

        # Add user_id alias for backward compatibility with routes using g.user.get("user_id")
        user["user_id"] = user.get("id_spm")

        # Cache the result
        user_cache.set(cache_key, user, ttl=120)  # 2 min TTL
        return user

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

        user = _get_user_by_id(user_id)
        if user:
            g.user = user
            logger.debug(f"Authenticated user: {user.get('id_spm')}")


def init_auth_middleware(app: Flask) -> AuthMiddleware:
    """Factory function to initialize auth middleware"""
    return AuthMiddleware(app)
