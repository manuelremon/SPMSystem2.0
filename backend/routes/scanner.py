"""
Scanner blueprint - pairing sessions for mobile barcode scanning.

Endpoints:
  POST   /api/scanner/session           (auth) - create pairing session + QR
  POST   /api/scanner/session/<id>/code (public) - mobile submits scanned code
  GET    /api/scanner/session/<id>/codes (auth) - PC polls for new codes
  DELETE /api/scanner/session/<id>       (auth) - close session
"""

import base64
import io

from flask import Blueprint, g, jsonify, request

from backend.core.roles import require_auth
from backend.services import scanner_service

scanner_bp = Blueprint("scanner", __name__, url_prefix="/api/scanner")


@scanner_bp.route("/session", methods=["POST"])
@require_auth
def create_session():
    """Create a new scanner pairing session and return a QR code."""
    user_id = g.user["id_spm"]
    result = scanner_service.create_session(user_id)

    # Build the scan URL that the mobile will open
    origin = request.host_url.rstrip("/")
    scan_url = f"{origin}/scan/{result['session_id']}"

    # Generate QR as base64 PNG
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=2)
        qr.add_data(scan_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        qr_data_uri = "data:image/png;base64," + base64.b64encode(buf.read()).decode()
    except ImportError:
        qr_data_uri = None

    return jsonify({
        "ok": True,
        "session_id": result["session_id"],
        "scan_url": scan_url,
        "qr_data_uri": qr_data_uri,
        "expires_in": result["expires_in"],
    }), 201


@scanner_bp.route("/session/<session_id>/code", methods=["POST"])
def submit_code(session_id):
    """Mobile device submits a scanned barcode (public, no auth required)."""
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if not code:
        return jsonify({"ok": False, "error": "code is required"}), 400

    result = scanner_service.submit_code(session_id, code)
    if not result["ok"]:
        status = 404 if result["error"] == "session_not_found" else 429
        return jsonify({"ok": False, "error": result["error"]}), status

    return jsonify(result), 200


@scanner_bp.route("/session/<session_id>/codes", methods=["GET"])
@require_auth
def poll_codes(session_id):
    """PC polls for codes submitted by the mobile device."""
    user_id = g.user["id_spm"]
    result = scanner_service.poll_codes(session_id, user_id)
    if not result["ok"]:
        status = 404 if result["error"] == "session_not_found" else 403
        return jsonify({"ok": False, "error": result["error"]}), status

    return jsonify(result), 200


@scanner_bp.route("/session/<session_id>", methods=["DELETE"])
@require_auth
def delete_session(session_id):
    """Close/delete a scanner session."""
    user_id = g.user["id_spm"]
    result = scanner_service.delete_session(session_id, user_id)
    if not result["ok"]:
        status = 404 if result["error"] == "session_not_found" else 403
        return jsonify({"ok": False, "error": result["error"]}), status

    return jsonify(result), 200
