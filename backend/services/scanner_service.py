"""
Scanner session service - in-memory store for mobile barcode pairing.

Sessions allow a PC browser to display a QR code that a mobile device scans
to open a camera page. The mobile sends scanned codes back via the API and
the PC polls for new codes.
"""

import secrets
import threading
from datetime import datetime, timedelta, timezone

SESSION_TTL_MINUTES = 10
MAX_CODES_PER_SESSION = 10

_sessions: dict = {}
_lock = threading.Lock()


def _cleanup_expired():
    """Remove expired sessions (called inside lock)."""
    now = datetime.now(timezone.utc)
    expired = [sid for sid, s in _sessions.items() if s["expires_at"] < now]
    for sid in expired:
        del _sessions[sid]


def create_session(user_id: int) -> dict:
    """Create a new pairing session for *user_id*. Returns session metadata."""
    session_id = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    with _lock:
        _cleanup_expired()
        _sessions[session_id] = {
            "user_id": user_id,
            "created_at": now.isoformat(),
            "expires_at": now + timedelta(minutes=SESSION_TTL_MINUTES),
            "codes": [],
        }
    return {
        "session_id": session_id,
        "expires_in": SESSION_TTL_MINUTES * 60,
    }


def session_exists(session_id: str) -> bool:
    """Check if a session exists and is not expired."""
    with _lock:
        _cleanup_expired()
        return session_id in _sessions


def submit_code(session_id: str, code: str) -> dict:
    """Add a scanned code to the session (called from mobile). Returns status."""
    with _lock:
        _cleanup_expired()
        session = _sessions.get(session_id)
        if not session:
            return {"ok": False, "error": "session_not_found"}
        if len(session["codes"]) >= MAX_CODES_PER_SESSION:
            return {"ok": False, "error": "max_codes_reached"}
        session["codes"].append({
            "code": code,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"ok": True, "total": len(session["codes"])}


def poll_codes(session_id: str, user_id: int) -> dict:
    """Return and clear pending codes for the session owner."""
    with _lock:
        _cleanup_expired()
        session = _sessions.get(session_id)
        if not session:
            return {"ok": False, "error": "session_not_found"}
        if session["user_id"] != user_id:
            return {"ok": False, "error": "unauthorized"}
        codes = session["codes"][:]
        session["codes"].clear()
        return {"ok": True, "codes": codes}


def delete_session(session_id: str, user_id: int) -> dict:
    """Delete a session (owner only)."""
    with _lock:
        session = _sessions.get(session_id)
        if not session:
            return {"ok": False, "error": "session_not_found"}
        if session["user_id"] != user_id:
            return {"ok": False, "error": "unauthorized"}
        del _sessions[session_id]
        return {"ok": True}
