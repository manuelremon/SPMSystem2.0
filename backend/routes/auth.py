"""
Authentication routes
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict

import bcrypt
import jwt
from flask import Blueprint, g, jsonify, request
from jwt import InvalidTokenError

try:
    from backend.core.cache import user_cache
    from backend.core.config import settings
    from backend.core.db import get_db_connection, get_spm_db_path, is_using_postgresql
    from backend.core.roles import format_user_response, is_admin, normalize_roles
except ImportError:
    from core.cache import user_cache
    from core.config import settings
    from core.db import get_db_connection, get_spm_db_path, is_using_postgresql
    from core.roles import format_user_response, is_admin, normalize_roles

bp = Blueprint("auth", __name__)


# =============================================================================
# Rate Limiting Simple (en memoria)
# =============================================================================
class RateLimiter:
    """
    Rate limiter simple basado en ventana deslizante.
    Limita intentos de login por IP para prevenir ataques de fuerza bruta.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, list] = defaultdict(list)

    def _cleanup(self, key: str) -> None:
        """Elimina intentos fuera de la ventana de tiempo"""
        cutoff = time.time() - self.window_seconds
        self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]

    def is_rate_limited(self, key: str) -> bool:
        """Verifica si la clave (IP) está limitada"""
        self._cleanup(key)
        return len(self._attempts[key]) >= self.max_attempts

    def record_attempt(self, key: str) -> None:
        """Registra un intento de login"""
        self._cleanup(key)
        self._attempts[key].append(time.time())

    def get_remaining_time(self, key: str) -> int:
        """Retorna segundos hasta que se pueda intentar de nuevo"""
        if not self._attempts[key]:
            return 0
        oldest = min(self._attempts[key])
        return max(0, int(self.window_seconds - (time.time() - oldest)))

    def reset(self, key: str) -> None:
        """Resetea intentos para una clave (después de login exitoso)"""
        self._attempts.pop(key, None)


# Rate limiter global: 10 intentos cada 5 minutos por IP
_login_limiter = RateLimiter(max_attempts=10, window_seconds=300)


def _get_user(username: str):
    """Busca por id_spm o mail"""
    # Para SQLite, verificar que el archivo existe
    if not is_using_postgresql():
        db_path = get_spm_db_path()
        if not db_path.exists():
            return None

    with get_db_connection() as conn:
        cur = conn.cursor()
        # Usar siempre ? - el wrapper convierte automáticamente a %s para PostgreSQL
        cur.execute(
            "SELECT * FROM usuarios WHERE id_spm=? OR mail=?",
            (username, username),
        )
        row = cur.fetchone()
        if row is None:
            return None
        # El wrapper ya retorna dict para PostgreSQL, SQLite retorna Row
        if isinstance(row, dict):
            return row
        return dict(row)


def _get_user_by_id(user_id: str):
    """Get user by ID with caching (for /me endpoint)"""
    # Try cache first
    cache_key = f"user:{user_id}"
    cached_user = user_cache.get(cache_key)
    if cached_user is not None:
        return cached_user

    # Cache miss - fetch from DB
    # Para SQLite, verificar que el archivo existe
    if not is_using_postgresql():
        db_path = get_spm_db_path()
        if not db_path.exists():
            return None

    user = None
    with get_db_connection() as conn:
        cur = conn.cursor()
        # Usar siempre ? - el wrapper convierte automáticamente a %s para PostgreSQL
        cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (str(user_id),))
        row = cur.fetchone()
        if row:
            # El wrapper ya retorna dict para PostgreSQL, SQLite retorna Row
            user = row if isinstance(row, dict) else dict(row)

    # Cache the result (including None to avoid repeated DB queries)
    if user:
        user_cache.set(cache_key, user, ttl=120)  # 2 min TTL

    return user


def generate_tokens(user_id: str) -> dict:
    """Generate access and refresh tokens"""
    now = datetime.utcnow()

    access_payload = {
        "user_id": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=settings.JWT_ACCESS_TOKEN_EXPIRES),
    }
    refresh_payload = {
        "user_id": user_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(seconds=settings.JWT_REFRESH_TOKEN_EXPIRES),
    }

    access_token = jwt.encode(access_payload, settings.JWT_SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, settings.JWT_SECRET_KEY, algorithm="HS256")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


def _get_token_from_request(cookie_name: str) -> str | None:
    """Get token from Authorization header or cookie"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.cookies.get(cookie_name)


def _decode_token(expected_type: str, cookie_name: str) -> Dict[str, Any] | tuple:
    token = _get_token_from_request(cookie_name)
    if not token:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "unauthorized", "message": "Missing token"},
                }
            ),
            401,
        )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != expected_type:
            raise InvalidTokenError("Invalid token type")
        return payload
    except InvalidTokenError:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "unauthorized", "message": "Invalid token"},
                }
            ),
            401,
        )


def _safe_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


@bp.route("/login", methods=["POST"])
def login():
    """Login endpoint con rate limiting"""
    # Rate limiting por IP
    client_ip = request.remote_addr or "unknown"
    if _login_limiter.is_rate_limited(client_ip):
        remaining = _login_limiter.get_remaining_time(client_ip)
        logging.getLogger(__name__).warning(f"Rate limit alcanzado para IP {client_ip}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "rate_limited",
                        "message": f"Demasiados intentos. Intenta de nuevo en {remaining} segundos.",
                    },
                }
            ),
            429,
        )

    data = _safe_json()
    if data is None:
        logging.getLogger(__name__).error(
            f"LOGIN DEBUG: Invalid JSON payload - raw: {request.data[:200] if request.data else 'empty'}"
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Invalid JSON payload",
                    },
                }
            ),
            400,
        )

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Username and password are required",
                    },
                }
            ),
            400,
        )

    # Registrar intento antes de verificar credenciales
    _login_limiter.record_attempt(client_ip)

    user = _get_user(username)
    if not user:
        logging.getLogger(__name__).warning(
            f"LOGIN DEBUG: User not found for username='{username}'"
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_credentials",
                        "message": "Invalid username or password",
                    },
                }
            ),
            401,
        )

    pwd = str(user.get("contrasena") or "")

    # SEGURIDAD: Solo permitir contraseñas hasheadas con bcrypt
    if not pwd:
        logging.getLogger(__name__).warning(f"Usuario {username} sin contraseña configurada")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_credentials",
                        "message": "Invalid username or password",
                    },
                }
            ),
            401,
        )

    # SEGURIDAD: Solo permitir contraseñas hasheadas con bcrypt
    # Las contraseñas DEBEN comenzar con $2b$ o $2a$ (formato bcrypt)
    if not (pwd.startswith("$2b$") or pwd.startswith("$2a$")):
        # Contraseña en texto plano detectada - SIEMPRE rechazar
        logging.getLogger(__name__).error(
            f"SEGURIDAD: Usuario {username} tiene contraseña en texto plano. "
            f"Ejecutar: python scripts/migrate_passwords.py para migrar a bcrypt."
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_credentials",
                        "message": "Invalid username or password",
                    },
                }
            ),
            401,
        )

    # Verificar contraseña con bcrypt
    try:
        if not bcrypt.checkpw(password.encode(), pwd.encode()):
            logging.getLogger(__name__).warning(
                f"LOGIN DEBUG: Password mismatch for username='{username}'"
            )
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "invalid_credentials",
                            "message": "Invalid username or password",
                        },
                    }
                ),
                401,
            )
    except Exception as e:
        logging.getLogger(__name__).error(f"LOGIN DEBUG: bcrypt error for {username}: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_credentials",
                        "message": "Invalid username or password",
                    },
                }
            ),
            401,
        )

    user_id = user.get("id_spm") or user.get("id")

    # Login exitoso: resetear rate limiter para esta IP
    _login_limiter.reset(client_ip)

    tokens = generate_tokens(str(user_id))

    response = jsonify(
        {
            "ok": True,
            "message": "Login successful",
            "user": format_user_response(user),
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
        }
    )

    response.set_cookie(
        "spm_token",
        tokens["access_token"],
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRES,
    )
    response.set_cookie(
        "spm_token_refresh",
        tokens["refresh_token"],
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRES,
    )

    return response, 200


@bp.route("/me", methods=["GET"])
def get_me():
    """Get current user with normalized roles"""
    payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(payload, tuple):
        return payload

    user = _get_user_by_id(payload.get("user_id"))
    if not user:
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "User not found"}}),
            404,
        )

    return jsonify({"ok": True, "user": format_user_response(user)}), 200


@bp.route("/refresh", methods=["POST"])
def refresh():
    """Refresh access token"""
    payload = _decode_token(expected_type="refresh", cookie_name="spm_token_refresh")
    if isinstance(payload, tuple):
        return payload

    tokens = generate_tokens(payload["user_id"])

    response = jsonify(
        {
            "ok": True,
            "message": "Token refreshed",
            "access_token": tokens["access_token"],
        }
    )

    response.set_cookie(
        "spm_token",
        tokens["access_token"],
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRES,
    )

    return response, 200


@bp.route("/logout", methods=["POST"])
def logout():
    """Logout"""
    response = jsonify({"ok": True, "message": "Logged out successfully"})

    response.set_cookie("spm_token", "", max_age=0)
    response.set_cookie("spm_token_refresh", "", max_age=0)
    response.set_cookie("spm_csrf", "", max_age=0)

    return response, 200


@bp.route("/register", methods=["POST"])
def register():
    """
    Registro de nuevos usuarios - acceso inmediato

    Crea un usuario con rol 'Solicitante' y lo autentica automáticamente.
    """
    data = _safe_json()
    if data is None:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "validation_error", "message": "Invalid JSON payload"},
                }
            ),
            400,
        )

    email = (data.get("email") or "").strip().lower()
    nombre = (data.get("nombre") or "").strip()
    password = data.get("password") or ""

    # Validar campos requeridos
    if not email or not nombre or not password:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Email, nombre y contraseña son requeridos",
                    },
                }
            ),
            400,
        )

    # Validar formato email básico
    if "@" not in email or "." not in email.split("@")[-1]:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "validation_error", "message": "Formato de email inválido"},
                }
            ),
            400,
        )

    # Verificar email único
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_spm FROM usuarios WHERE mail=?", (email,))
        if cur.fetchone():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "duplicate_email",
                            "message": "Este email ya está registrado",
                        },
                    }
                ),
                409,
            )

    # Generar ID y hashear password
    user_id = str(uuid.uuid4())[:8]
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    # Insertar usuario con rol Solicitante
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, estado_registro)
               VALUES (?, ?, '', 'Solicitante', ?, ?, 'Activo')""",
            (user_id, nombre, password_hash, email),
        )
        conn.commit()

    logging.getLogger(__name__).info(f"Nuevo usuario registrado: {email} (ID: {user_id})")

    # Auto-login: generar tokens
    tokens = generate_tokens(user_id)
    user_response = {
        "id_spm": user_id,
        "nombre": nombre,
        "apellido": "",
        "mail": email,
        "rol": "Solicitante",
        "roles": ["Solicitante"],
    }

    response = jsonify(
        {
            "ok": True,
            "message": "Registro exitoso",
            "user": user_response,
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
        }
    )

    # Establecer cookies (igual que login)
    response.set_cookie(
        "spm_token",
        tokens["access_token"],
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRES,
    )
    response.set_cookie(
        "spm_token_refresh",
        tokens["refresh_token"],
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRES,
    )

    return response, 201


@bp.route("/csrf", methods=["GET"])
def get_csrf_token():
    """Return CSRF token for clients"""
    token = getattr(g, "csrf_token", None)
    if not token:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "csrf_error",
                        "message": "Unable to generate CSRF token",
                    },
                }
            ),
            500,
        )

    return jsonify({"ok": True, "csrf_token": token}), 200


@bp.route("/mi-acceso", methods=["GET"])
def mi_acceso():
    """
    Permisos del usuario actual para catálogos.

    Usa el módulo de roles normalizado para determinar acceso.
    """
    # Usar _decode_token estándar (soporta header y cookie)
    payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(payload, tuple):
        return payload

    user_id = payload.get("user_id")
    user = _get_user_by_id(user_id)

    if not user:
        return (
            jsonify(
                {
                    "centros_permitidos": [],
                    "sectores_permitidos": [],
                    "almacenes_permitidos": [],
                    "all_access": False,
                }
            ),
            200,
        )

    # Usar módulo de roles normalizado
    user_is_admin = is_admin(user.get("rol", ""))

    if user_is_admin:
        return (
            jsonify(
                {
                    "centros_permitidos": [],
                    "sectores_permitidos": [],
                    "almacenes_permitidos": [],
                    "all_access": True,
                    "roles": normalize_roles(user.get("rol", "")),
                    "is_admin": True,
                }
            ),
            200,
        )

    # Parsear permisos específicos del usuario desde sus campos
    # centros: CSV como "1008,1050" -> ["1008", "1050"]
    centros_raw = user.get("centros") or ""
    centros_permitidos = [c.strip() for c in centros_raw.split(",") if c.strip()]

    # sector: valor único como "Mantenimiento" -> ["Mantenimiento"]
    sector_raw = user.get("sector") or ""
    sectores_permitidos = [sector_raw.strip()] if sector_raw.strip() else []

    # almacenes: puede ser JSON array '["0001","0101"]' o CSV "0001,0101" o None -> []
    almacenes_raw = user.get("almacenes") or ""
    almacenes_permitidos = []
    if almacenes_raw:
        # Intentar parsear como JSON primero
        if almacenes_raw.startswith("["):
            try:
                parsed = json.loads(almacenes_raw)
                if isinstance(parsed, list):
                    almacenes_permitidos = [str(a).strip() for a in parsed if a]
            except (json.JSONDecodeError, TypeError):
                pass
        # Fallback a CSV
        if not almacenes_permitidos:
            almacenes_permitidos = [a.strip() for a in almacenes_raw.split(",") if a.strip()]

    return (
        jsonify(
            {
                "centros_permitidos": centros_permitidos,
                "sectores_permitidos": sectores_permitidos,
                "almacenes_permitidos": almacenes_permitidos,
                "all_access": False,
                "roles": normalize_roles(user.get("rol", "")),
                "is_admin": False,
            }
        ),
        200,
    )
