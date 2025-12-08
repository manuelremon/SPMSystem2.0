"""
Health check endpoint
"""

from flask import Blueprint, jsonify

bp = Blueprint("health", __name__)


@bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"ok": True, "message": "SPM Backend v2.0 is running", "version": "2.0.0"}), 200
