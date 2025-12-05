"""
Authentication Middleware - Sets g.user from Bearer token

This middleware runs before every request and:
1. Extracts Bearer token from Authorization header or cookie
2. Decodes and validates the JWT
3. Fetches user from database
4. Sets g.user for use by route decorators like @require_auth
"""

import logging
import sqlite3
from pathlib import Path

import jwt
from flask import Flask, g, request
from jwt import InvalidTokenError

try:
    from backend_v2.core.cache import user_cache
    from backend_v2.core.config import settings
except ImportError:
    from core.cache import user_cache
    from core.config import settings


logger = logging.getLogger(__name__)


def _db_path() -> Path:
    """Get database path from settings"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _get_user_by_id(user_id: str) -> dict | None:
    """Fetch user from database with caching"""
    # Try cache first
    cache_key = f"user:{user_id}"
    cached_user = user_cache.get(cache_key)
    if cached_user is not None:
        return cached_user

    # Cache miss - fetch from DB
    path = _db_path()
    if not path.exists():
        return None

    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (str(user_id),))
        row = cur.fetchone()
        conn.close()
        user = dict(row) if row else None

        # Cache the result
        if user:
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
