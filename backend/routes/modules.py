"""
System Modules Routes - Enable/disable system modules.

Endpoints:
- GET  /api/admin/modules - List all modules (authenticated users)
- PUT  /api/admin/modules - Update module enabled state (admin only)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.roles import require_admin, require_auth

logger = logging.getLogger(__name__)

bp = Blueprint("modules", __name__, url_prefix="/api/admin/modules")


@bp.route("", methods=["GET"])
@require_auth
def get_modules():
    """List all system modules."""
    try:
        from backend.services.module_service import get_modules as svc_get_modules

        modules = svc_get_modules()
        return jsonify({"modules": modules})
    except Exception as e:
        return safe_error_response(e, logger, "get_modules")


@bp.route("", methods=["PUT"])
@require_auth
@require_admin
def update_modules():
    """Update module enabled/disabled state. Admin only."""
    try:
        from backend.services.module_service import update_modules as svc_update

        data = request.get_json()
        if not data or "modules" not in data:
            return jsonify({"error": "Se requiere el campo 'modules'"}), 400

        modules_data = data["modules"]
        if not isinstance(modules_data, list):
            return jsonify({"error": "'modules' debe ser una lista"}), 400

        updated = svc_update(modules_data)
        return jsonify({"modules": updated, "message": "Modulos actualizados"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, "update_modules")
