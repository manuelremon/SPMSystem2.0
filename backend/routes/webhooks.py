"""
Webhooks Routes
Admin-only endpoints for managing outbound webhooks.
"""
import logging

from flask import Blueprint, g, jsonify, request

from backend.core.roles import require_admin
from backend.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)

bp = Blueprint("webhooks", __name__, url_prefix="/api/webhooks")


@bp.route("/", methods=["GET"])
@require_admin
def list_webhooks():
    """List all webhooks."""
    try:
        activo_only = request.args.get("activo_only", "true").lower() == "true"
        webhooks = WebhookService.get_all(activo_only=activo_only)
        return jsonify({"ok": True, "webhooks": webhooks})
    except Exception as e:
        logger.error(f"[Webhooks] Error listing webhooks: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/", methods=["POST"])
@require_admin
def create_webhook():
    """Create a new webhook."""
    try:
        data = request.get_json()

        url = data.get("url")
        if not url:
            return jsonify({"ok": False, "error": "URL is required"}), 400

        # Generate secret or use provided one
        secret = data.get("secret") or WebhookService.generate_secret()

        eventos = data.get("eventos", [])
        if not eventos or not isinstance(eventos, list):
            return jsonify({"ok": False, "error": "eventos must be a non-empty list"}), 400

        created_by = str(g.user.get("id"))

        webhook_id = WebhookService.create(
            url=url, secret=secret, eventos=eventos, created_by=created_by
        )

        return jsonify({"ok": True, "webhook_id": webhook_id, "secret": secret}), 201

    except Exception as e:
        logger.error(f"[Webhooks] Error creating webhook: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/<int:webhook_id>", methods=["PUT"])
@require_admin
def update_webhook(webhook_id: int):
    """Update a webhook."""
    try:
        data = request.get_json()

        allowed_fields = {"url", "secret", "eventos", "activo"}
        updates = {k: v for k, v in data.items() if k in allowed_fields}

        if not updates:
            return jsonify({"ok": False, "error": "No valid fields to update"}), 400

        WebhookService.update(webhook_id, **updates)

        return jsonify({"ok": True})

    except Exception as e:
        logger.error(f"[Webhooks] Error updating webhook {webhook_id}: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/<int:webhook_id>", methods=["DELETE"])
@require_admin
def delete_webhook(webhook_id: int):
    """Delete a webhook."""
    try:
        WebhookService.delete(webhook_id)
        return jsonify({"ok": True})
    except Exception as e:
        logger.error(f"[Webhooks] Error deleting webhook {webhook_id}: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/<int:webhook_id>/deliveries", methods=["GET"])
@require_admin
def get_deliveries(webhook_id: int):
    """Get delivery log for a webhook."""
    try:
        limit = request.args.get("limit", 20, type=int)
        deliveries = WebhookService.get_deliveries(webhook_id, limit=limit)
        return jsonify({"ok": True, "deliveries": deliveries})
    except Exception as e:
        logger.error(f"[Webhooks] Error getting deliveries for webhook {webhook_id}: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/<int:webhook_id>/test", methods=["POST"])
@require_admin
def test_webhook(webhook_id: int):
    """Send a test event to a webhook."""
    try:
        result = WebhookService.test_webhook(webhook_id)
        return jsonify({"ok": result.get("success", False), **result})
    except Exception as e:
        logger.error(f"[Webhooks] Error testing webhook {webhook_id}: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500
