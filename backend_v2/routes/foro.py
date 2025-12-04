"""
Foro routes - Posts, respuestas y likes
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import jwt
from flask import Blueprint, jsonify, request
from jwt import InvalidTokenError

try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings


bp = Blueprint("foro", __name__)
logger = logging.getLogger(__name__)


def _db_path():
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _get_db():
    """Get database connection"""
    path = _db_path()
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_foro_tables():
    """Create foro tables if not exist"""
    conn = _get_db()
    cur = conn.cursor()

    # Tabla de posts
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS foro_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            autor_id TEXT NOT NULL,
            autor_nombre TEXT NOT NULL,
            titulo TEXT NOT NULL,
            contenido TEXT NOT NULL,
            categoria TEXT DEFAULT 'general',
            likes INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Tabla de respuestas
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS foro_respuestas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            autor_id TEXT NOT NULL,
            autor_nombre TEXT NOT NULL,
            contenido TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES foro_posts(id) ON DELETE CASCADE
        )
    """
    )

    # Tabla de likes
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS foro_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES foro_posts(id) ON DELETE CASCADE
        )
    """
    )

    conn.commit()
    conn.close()


def _get_token_from_request() -> str | None:
    """Get token from Authorization header or cookie"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.cookies.get("spm_token")


def _get_current_user() -> Dict[str, Any] | None:
    """Get current user from JWT token"""
    token = _get_token_from_request()
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None

        user_id = payload.get("user_id")
        conn = _get_db()
        cur = conn.cursor()
        cur.execute("SELECT id_spm, nombre, apellido FROM usuarios WHERE id_spm=?", (str(user_id),))
        row = cur.fetchone()
        conn.close()

        if row:
            return {"id": row["id_spm"], "nombre": row["nombre"], "apellido": row["apellido"]}
        return None
    except InvalidTokenError:
        return None


def _safe_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


@bp.route("/foro/posts", methods=["GET"])
def get_posts():
    """
    Get all forum posts with replies count
    """
    _ensure_foro_tables()

    user = _get_current_user()
    user_id = user["id"] if user else None

    categoria = request.args.get("categoria", None)
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    conn = _get_db()
    cur = conn.cursor()

    # Get posts
    if categoria:
        cur.execute(
            """
            SELECT * FROM foro_posts
            WHERE categoria = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """,
            (categoria, limit, offset),
        )
    else:
        cur.execute(
            """
            SELECT * FROM foro_posts
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """,
            (limit, offset),
        )

    posts_rows = cur.fetchall()
    posts = []

    for row in posts_rows:
        post = dict(row)

        # Get replies
        cur.execute(
            """
            SELECT * FROM foro_respuestas
            WHERE post_id = ?
            ORDER BY created_at ASC
        """,
            (post["id"],),
        )
        respuestas = [dict(r) for r in cur.fetchall()]
        post["respuestas"] = respuestas

        # Check if user liked this post
        if user_id:
            cur.execute(
                """
                SELECT 1 FROM foro_likes
                WHERE post_id = ? AND user_id = ?
            """,
                (post["id"], str(user_id)),
            )
            post["user_liked"] = cur.fetchone() is not None
        else:
            post["user_liked"] = False

        posts.append(post)

    conn.close()

    return jsonify({"ok": True, "posts": posts, "total": len(posts)}), 200


@bp.route("/foro/posts", methods=["POST"])
def create_post():
    """
    Create a new forum post
    """
    _ensure_foro_tables()

    user = _get_current_user()
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "unauthorized", "message": "Authentication required"},
                }
            ),
            401,
        )

    data = _safe_json()
    if not data:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "validation_error", "message": "Invalid JSON payload"},
                }
            ),
            400,
        )

    titulo = data.get("titulo", "").strip()
    contenido = data.get("contenido", "").strip()
    categoria = data.get("categoria", "general")

    if not titulo or not contenido:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "titulo and contenido are required",
                    },
                }
            ),
            400,
        )

    # Validate categoria
    valid_categorias = ["general", "ayuda", "sugerencias", "problemas", "anuncios"]
    if categoria not in valid_categorias:
        categoria = "general"

    user_name = (
        f"{user.get('nombre', '')} {user.get('apellido', '')}".strip() or f"Usuario {user['id']}"
    )

    conn = _get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO foro_posts (autor_id, autor_nombre, titulo, contenido, categoria, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        (str(user["id"]), user_name, titulo, contenido, categoria, datetime.utcnow().isoformat()),
    )
    post_id = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "message": "Post created successfully", "post_id": post_id}), 201


@bp.route("/foro/posts/<int:post_id>/like", methods=["POST"])
def toggle_like(post_id):
    """
    Toggle like on a post
    """
    _ensure_foro_tables()

    user = _get_current_user()
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "unauthorized", "message": "Authentication required"},
                }
            ),
            401,
        )

    conn = _get_db()
    cur = conn.cursor()

    # Check if post exists
    cur.execute("SELECT id, likes FROM foro_posts WHERE id = ?", (post_id,))
    post = cur.fetchone()
    if not post:
        conn.close()
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "Post not found"}}),
            404,
        )

    # Check if already liked
    cur.execute(
        """
        SELECT id FROM foro_likes
        WHERE post_id = ? AND user_id = ?
    """,
        (post_id, str(user["id"])),
    )
    existing = cur.fetchone()

    if existing:
        # Remove like
        cur.execute("DELETE FROM foro_likes WHERE id = ?", (existing["id"],))
        cur.execute("UPDATE foro_posts SET likes = likes - 1 WHERE id = ?", (post_id,))
        action = "unliked"
    else:
        # Add like
        cur.execute(
            """
            INSERT INTO foro_likes (post_id, user_id, created_at)
            VALUES (?, ?, ?)
        """,
            (post_id, str(user["id"]), datetime.utcnow().isoformat()),
        )
        cur.execute("UPDATE foro_posts SET likes = likes + 1 WHERE id = ?", (post_id,))
        action = "liked"

    conn.commit()

    # Get updated likes count
    cur.execute("SELECT likes FROM foro_posts WHERE id = ?", (post_id,))
    new_likes = cur.fetchone()["likes"]
    conn.close()

    return jsonify({"ok": True, "action": action, "likes": new_likes}), 200


@bp.route("/foro/posts/<int:post_id>/respuestas", methods=["POST"])
def create_reply(post_id):
    """
    Add a reply to a post
    """
    _ensure_foro_tables()

    user = _get_current_user()
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "unauthorized", "message": "Authentication required"},
                }
            ),
            401,
        )

    conn = _get_db()
    cur = conn.cursor()

    # Check if post exists
    cur.execute("SELECT id FROM foro_posts WHERE id = ?", (post_id,))
    if not cur.fetchone():
        conn.close()
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "Post not found"}}),
            404,
        )

    data = _safe_json()
    if not data:
        conn.close()
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "validation_error", "message": "Invalid JSON payload"},
                }
            ),
            400,
        )

    contenido = data.get("contenido", "").strip()
    if not contenido:
        conn.close()
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "validation_error", "message": "contenido is required"},
                }
            ),
            400,
        )

    user_name = (
        f"{user.get('nombre', '')} {user.get('apellido', '')}".strip() or f"Usuario {user['id']}"
    )

    cur.execute(
        """
        INSERT INTO foro_respuestas (post_id, autor_id, autor_nombre, contenido, created_at)
        VALUES (?, ?, ?, ?, ?)
    """,
        (post_id, str(user["id"]), user_name, contenido, datetime.utcnow().isoformat()),
    )
    reply_id = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "message": "Reply added successfully", "reply_id": reply_id}), 201


@bp.route("/foro/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    """
    Delete a post (only author or admin)
    """
    _ensure_foro_tables()

    user = _get_current_user()
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "unauthorized", "message": "Authentication required"},
                }
            ),
            401,
        )

    conn = _get_db()
    cur = conn.cursor()

    # Check if post exists and user is author
    cur.execute("SELECT autor_id FROM foro_posts WHERE id = ?", (post_id,))
    post = cur.fetchone()

    if not post:
        conn.close()
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "Post not found"}}),
            404,
        )

    # Check if user is admin
    cur.execute("SELECT rol FROM usuarios WHERE id_spm = ?", (str(user["id"]),))
    user_row = cur.fetchone()
    is_admin = user_row and "admin" in str(user_row["rol"]).lower()

    if post["autor_id"] != str(user["id"]) and not is_admin:
        conn.close()
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "forbidden", "message": "You can only delete your own posts"},
                }
            ),
            403,
        )

    # Delete post (cascade will delete replies and likes)
    cur.execute("DELETE FROM foro_likes WHERE post_id = ?", (post_id,))
    cur.execute("DELETE FROM foro_respuestas WHERE post_id = ?", (post_id,))
    cur.execute("DELETE FROM foro_posts WHERE id = ?", (post_id,))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "message": "Post deleted successfully"}), 200
