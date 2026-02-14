"""
Trivias routes - Juegos y ranking
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict

import jwt
from flask import Blueprint, jsonify, request
from jwt import InvalidTokenError

from backend.core.config import settings
from backend.core.db import get_db_connection, get_db_transaction
from backend.core.helpers import safe_json as _safe_json
from backend.core.roles import require_auth

bp = Blueprint("trivias", __name__)
logger = logging.getLogger(__name__)


def _ensure_trivias_table():
    """Create trivia_score table if not exists"""
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS trivia_score (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                game_mode TEXT NOT NULL,
                score INTEGER NOT NULL,
                correct_answers INTEGER DEFAULT 0,
                total_questions INTEGER DEFAULT 0,
                time_spent INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """
        )


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
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id_spm, nombre, apellido FROM usuario WHERE id_spm=?", (str(user_id),)
            )
            row = cur.fetchone()

            if row:
                return {"id": row["id_spm"], "nombre": row["nombre"], "apellido": row["apellido"]}
        return None
    except InvalidTokenError:
        return None


@bp.route("/trivias/rankings", methods=["GET"])
@require_auth
def get_rankings():
    """
    Get trivia rankings - top players by total score
    Supports filtering by game_mode query param
    Also includes current user's stats (my_stats)
    """
    _ensure_trivias_table()

    game_mode = request.args.get("game_mode", None)
    limit = request.args.get("limit", 20, type=int)

    # Get current user for my_stats
    user = _get_current_user()
    my_stats = {"total_score": 0, "games_played": 0}

    with get_db_connection() as conn:
        cur = conn.cursor()

        if game_mode:
            # Rankings for specific game mode
            cur.execute(
                """
                SELECT
                    user_id,
                    user_name,
                    game_mode,
                    SUM(score) as total_score,
                    COUNT(*) as games_played,
                    MAX(score) as best_score,
                    SUM(correct_answers) as total_correct,
                    SUM(total_questions) as total_questions
                FROM trivia_score
                WHERE game_mode = ?
                GROUP BY user_id, user_name, game_mode
                ORDER BY total_score DESC
                LIMIT ?
            """,
                (game_mode, limit),
            )
        else:
            # Global rankings (all game modes combined)
            cur.execute(
                """
                SELECT
                    user_id,
                    user_name,
                    SUM(score) as total_score,
                    COUNT(*) as games_played,
                    MAX(score) as best_score,
                    SUM(correct_answers) as total_correct,
                    SUM(total_questions) as total_questions
                FROM trivia_score
                GROUP BY user_id, user_name
                ORDER BY total_score DESC
                LIMIT ?
            """,
                (limit,),
            )

        rows = cur.fetchall()

        # Get current user's stats if authenticated
        if user:
            cur.execute(
                """
                SELECT
                    COALESCE(SUM(score), 0) as total_score,
                    COUNT(*) as games_played
                FROM trivia_score
                WHERE user_id = ?
            """,
                (str(user["id"]),),
            )
            user_stats = cur.fetchone()
            if user_stats:
                my_stats = {
                    "total_score": user_stats["total_score"] or 0,
                    "games_played": user_stats["games_played"] or 0,
                }

    rankings = []
    for idx, row in enumerate(rows, 1):
        rankings.append(
            {
                "rank": idx,
                "user_id": row["user_id"],
                "user_name": row["user_name"],
                "total_score": row["total_score"],
                "games_played": row["games_played"],
                "best_score": row["best_score"],
                "total_correct": row["total_correct"],
                "total_questions": row["total_questions"],
                "accuracy": (
                    round((row["total_correct"] / row["total_questions"]) * 100, 1)
                    if row["total_questions"] > 0
                    else 0
                ),
            }
        )

    return (
        jsonify({
            "ok": True,
            "rankings": rankings,
            "my_stats": my_stats,
            "game_mode": game_mode,
            "total": len(rankings)
        }),
        200,
    )


@bp.route("/trivias/score", methods=["POST"])
@require_auth
def save_score():
    """
    Save a trivia game score
    Requires authentication
    """
    _ensure_trivias_table()

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

    game_mode = data.get("game_mode")
    score = data.get("score")
    correct_answers = data.get("correct_answers", 0)
    total_questions = data.get("total_questions", 0)
    time_spent = data.get("time_spent", 0)

    if not game_mode or score is None:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "game_mode and score are required",
                    },
                }
            ),
            400,
        )

    # Validate game mode
    valid_modes = ["quiz", "material", "precio", "categorias"]
    if game_mode not in valid_modes:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": f"Invalid game_mode. Must be one of: {valid_modes}",
                    },
                }
            ),
            400,
        )

    user_name = (
        f"{user.get('nombre', '')} {user.get('apellido', '')}".strip() or f"Usuario {user['id']}"
    )

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO trivia_score (user_id, user_name, game_mode, score, correct_answers, total_questions, time_spent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                str(user["id"]),
                user_name,
                game_mode,
                score,
                correct_answers,
                total_questions,
                time_spent,
                datetime.utcnow().isoformat(),
            ),
        )

        cur.execute(
            """
            SELECT COUNT(*) + 1 as rank
            FROM (
                SELECT user_id, SUM(score) as total_score
                FROM trivia_score
                GROUP BY user_id
                HAVING total_score > (
                    SELECT COALESCE(SUM(score), 0) FROM trivia_score WHERE user_id = ?
                )
            )
        """,
            (str(user["id"]),),
        )
        rank_row = cur.fetchone()
        new_rank = rank_row["rank"] if rank_row else 1

        cur.execute(
            """
            SELECT SUM(score) as total_score, COUNT(*) as games_played
            FROM trivia_score
            WHERE user_id = ?
        """,
            (str(user["id"]),),
        )
        stats_row = cur.fetchone()

    return (
        jsonify(
            {
                "ok": True,
                "message": "Score saved successfully",
                "score_saved": score,
                "new_rank": new_rank,
                "total_score": stats_row["total_score"] if stats_row else score,
                "games_played": stats_row["games_played"] if stats_row else 1,
            }
        ),
        201,
    )


@bp.route("/trivias/my-stats", methods=["GET"])
@require_auth
def get_my_stats():
    """
    Get current user's trivia statistics
    """
    _ensure_trivias_table()

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

    with get_db_connection() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                SUM(score) as total_score,
                COUNT(*) as games_played,
                MAX(score) as best_score,
                SUM(correct_answers) as total_correct,
                SUM(total_questions) as total_questions,
                AVG(score) as avg_score
            FROM trivia_score
            WHERE user_id = ?
        """,
            (str(user["id"]),),
        )
        overall = cur.fetchone()

        # Get stats by game mode
        cur.execute(
            """
            SELECT
                game_mode,
                SUM(score) as total_score,
                COUNT(*) as games_played,
                MAX(score) as best_score,
                SUM(correct_answers) as total_correct,
                SUM(total_questions) as total_questions
            FROM trivia_score
            WHERE user_id = ?
            GROUP BY game_mode
        """,
            (str(user["id"]),),
        )
        by_mode = cur.fetchall()

        cur.execute(
            """
            SELECT COUNT(*) + 1 as rank
            FROM (
                SELECT user_id, SUM(score) as total_score
                FROM trivia_score
                GROUP BY user_id
                HAVING total_score > (
                    SELECT COALESCE(SUM(score), 0) FROM trivia_score WHERE user_id = ?
                )
            )
        """,
            (str(user["id"]),),
        )
        rank_row = cur.fetchone()

    modes_stats = {}
    for row in by_mode:
        modes_stats[row["game_mode"]] = {
            "total_score": row["total_score"],
            "games_played": row["games_played"],
            "best_score": row["best_score"],
            "accuracy": (
                round((row["total_correct"] / row["total_questions"]) * 100, 1)
                if row["total_questions"] > 0
                else 0
            ),
        }

    return (
        jsonify(
            {
                "ok": True,
                "stats": {
                    "total_score": overall["total_score"] or 0,
                    "games_played": overall["games_played"] or 0,
                    "best_score": overall["best_score"] or 0,
                    "avg_score": round(overall["avg_score"] or 0, 1),
                    "accuracy": (
                        round((overall["total_correct"] / overall["total_questions"]) * 100, 1)
                        if overall["total_questions"] and overall["total_questions"] > 0
                        else 0
                    ),
                    "rank": rank_row["rank"] if rank_row else 1,
                    "by_mode": modes_stats,
                },
            }
        ),
        200,
    )
