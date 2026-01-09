"""
Foro routes - Posts, respuestas y likes
"""

from __future__ import annotations

import logging
from datetime import datetime

from flask import Blueprint, g, jsonify, request

from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id, is_using_postgresql
from backend.core.roles import is_admin, require_auth


bp = Blueprint("foro", __name__)
logger = logging.getLogger(__name__)


def _ensure_foro_tables():
    """Create foro tables if not exist"""
    with get_db_transaction() as conn:
        cur = conn.cursor()

        # PostgreSQL usa SERIAL, SQLite usa INTEGER PRIMARY KEY AUTOINCREMENT
        if is_using_postgresql():
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS foro_posts (
                    id SERIAL PRIMARY KEY,
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

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS foro_respuestas (
                    id SERIAL PRIMARY KEY,
                    post_id INTEGER NOT NULL,
                    autor_id TEXT NOT NULL,
                    autor_nombre TEXT NOT NULL,
                    contenido TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES foro_posts(id) ON DELETE CASCADE
                )
            """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS foro_likes (
                    id SERIAL PRIMARY KEY,
                    post_id INTEGER NOT NULL,
                    user_id TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(post_id, user_id),
                    FOREIGN KEY (post_id) REFERENCES foro_posts(id) ON DELETE CASCADE
                )
            """
            )
        else:
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


def _get_user_info(user_id: str) -> dict | None:
    """Get user name info from database"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id_spm, nombre, apellido FROM usuarios WHERE id_spm=?", (str(user_id),)
            )
            row = cur.fetchone()
            if row:
                return {"id": row["id_spm"], "nombre": row["nombre"], "apellido": row["apellido"]}
    except Exception:
        pass
    return None


def _safe_json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


@bp.route("/foro/posts", methods=["GET"])
def get_posts():
    """
    Get all forum posts with replies count (public endpoint)
    """
    _ensure_foro_tables()

    # Optional: get user_id if authenticated (for user_liked field)
    user_id = None
    if hasattr(g, "user") and g.user:
        user_id = g.user.get("user_id")

    categoria = request.args.get("categoria", None)
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)

    with get_db_connection() as conn:
        cur = conn.cursor()

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

    return jsonify({"ok": True, "posts": posts, "total": len(posts)}), 200


@bp.route("/foro/posts", methods=["POST"])
@require_auth
def create_post():
    """
    Create a new forum post
    """
    _ensure_foro_tables()

    user_id = g.user.get("user_id")
    user = _get_user_info(user_id) or {"id": user_id, "nombre": "", "apellido": ""}

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

    valid_categorias = ["general", "ayuda", "sugerencias", "problemas", "anuncios"]
    if categoria not in valid_categorias:
        categoria = "general"

    user_name = (
        f"{user.get('nombre', '')} {user.get('apellido', '')}".strip() or f"Usuario {user['id']}"
    )

    with get_db_transaction() as conn:
        cur = conn.cursor()
        post_id = insert_returning_id(
            cur,
            """
            INSERT INTO foro_posts (autor_id, autor_nombre, titulo, contenido, categoria, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                str(user["id"]),
                user_name,
                titulo,
                contenido,
                categoria,
                datetime.utcnow().isoformat(),
            ),
        )

    return jsonify({"ok": True, "message": "Post created successfully", "post_id": post_id}), 201


@bp.route("/foro/posts/<int:post_id>/like", methods=["POST"])
@require_auth
def toggle_like(post_id):
    """
    Toggle like on a post
    """
    _ensure_foro_tables()

    user_id = g.user.get("user_id")

    with get_db_transaction() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id, likes FROM foro_posts WHERE id = ?", (post_id,))
        post = cur.fetchone()
        if not post:
            return (
                jsonify({"ok": False, "error": {"code": "not_found", "message": "Post not found"}}),
                404,
            )

        cur.execute(
            """
            SELECT id FROM foro_likes
            WHERE post_id = ? AND user_id = ?
        """,
            (post_id, str(user_id)),
        )
        existing = cur.fetchone()

        if existing:
            cur.execute("DELETE FROM foro_likes WHERE id = ?", (existing["id"],))
            cur.execute("UPDATE foro_posts SET likes = likes - 1 WHERE id = ?", (post_id,))
            action = "unliked"
        else:
            cur.execute(
                """
                INSERT INTO foro_likes (post_id, user_id, created_at)
                VALUES (?, ?, ?)
            """,
                (post_id, str(user_id), datetime.utcnow().isoformat()),
            )
            cur.execute("UPDATE foro_posts SET likes = likes + 1 WHERE id = ?", (post_id,))
            action = "liked"

        cur.execute("SELECT likes FROM foro_posts WHERE id = ?", (post_id,))
        new_likes = cur.fetchone()["likes"]

    return jsonify({"ok": True, "action": action, "likes": new_likes}), 200


@bp.route("/foro/posts/<int:post_id>/respuestas", methods=["POST"])
@require_auth
def create_reply(post_id):
    """
    Add a reply to a post
    """
    _ensure_foro_tables()

    user_id = g.user.get("user_id")
    user = _get_user_info(user_id) or {"id": user_id, "nombre": "", "apellido": ""}

    # Validar JSON antes de abrir conexión
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

    contenido = data.get("contenido", "").strip()
    if not contenido:
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

    with get_db_transaction() as conn:
        cur = conn.cursor()

        cur.execute("SELECT id FROM foro_posts WHERE id = ?", (post_id,))
        if not cur.fetchone():
            return (
                jsonify({"ok": False, "error": {"code": "not_found", "message": "Post not found"}}),
                404,
            )

        reply_id = insert_returning_id(
            cur,
            """
            INSERT INTO foro_respuestas (post_id, autor_id, autor_nombre, contenido, created_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (post_id, str(user["id"]), user_name, contenido, datetime.utcnow().isoformat()),
        )

    return jsonify({"ok": True, "message": "Reply added successfully", "reply_id": reply_id}), 201


@bp.route("/foro/posts/<int:post_id>", methods=["DELETE"])
@require_auth
def delete_post(post_id):
    """
    Delete a post (only author or admin)
    """
    _ensure_foro_tables()

    user_id = g.user.get("user_id")
    user_rol = g.user.get("rol", "")

    with get_db_transaction() as conn:
        cur = conn.cursor()

        cur.execute("SELECT autor_id FROM foro_posts WHERE id = ?", (post_id,))
        post = cur.fetchone()

        if not post:
            return (
                jsonify({"ok": False, "error": {"code": "not_found", "message": "Post not found"}}),
                404,
            )

        # Check if user is author or admin
        user_is_admin = is_admin(user_rol)

        if post["autor_id"] != str(user_id) and not user_is_admin:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "You can only delete your own posts",
                        },
                    }
                ),
                403,
            )

        # Delete post (cascade will delete replies and likes)
        cur.execute("DELETE FROM foro_likes WHERE post_id = ?", (post_id,))
        cur.execute("DELETE FROM foro_respuestas WHERE post_id = ?", (post_id,))
        cur.execute("DELETE FROM foro_posts WHERE id = ?", (post_id,))

    return jsonify({"ok": True, "message": "Post deleted successfully"}), 200
