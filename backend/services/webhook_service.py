"""
Webhook Service
Manages webhook endpoints and dispatches events to registered URLs.
"""
import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Any, Dict, List, Optional

import requests

from backend.core.db import get_db_connection, get_db_transaction

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for managing and dispatching webhooks."""

    @staticmethod
    def get_all(activo_only: bool = True) -> List[Dict[str, Any]]:
        """
        Get all webhook endpoints.

        Args:
            activo_only: If True, return only active webhooks

        Returns:
            List of webhook dicts
        """
        with get_db_connection() as conn:
            cur = conn.cursor()
            if activo_only:
                cur.execute(
                    """
                    SELECT id, url, secret, eventos, activo, created_by, created_at, updated_at
                    FROM webhook
                    WHERE activo = 1
                    ORDER BY created_at DESC
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT id, url, secret, eventos, activo, created_by, created_at, updated_at
                    FROM webhook
                    ORDER BY created_at DESC
                    """
                )
            rows = cur.fetchall()

        return [dict(row) for row in rows]

    @staticmethod
    def create(url: str, secret: str, eventos: List[str], created_by: str) -> int:
        """
        Create a new webhook.

        Args:
            url: Webhook URL
            secret: Secret for HMAC signature
            eventos: List of event names to subscribe to
            created_by: User ID who created this webhook

        Returns:
            New webhook ID
        """
        eventos_json = json.dumps(eventos)

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO webhook (url, secret, eventos, created_by)
                VALUES (?, ?, ?, ?)
                RETURNING id
                """,
                (url, secret, eventos_json, created_by),
            )
            webhook_id = cur.fetchone()[0]

        logger.info(f"[Webhook] Created webhook {webhook_id} for {url} by {created_by}")
        return webhook_id

    @staticmethod
    def update(webhook_id: int, **kwargs) -> None:
        """
        Update a webhook.

        Args:
            webhook_id: Webhook ID
            **kwargs: Fields to update (url, secret, eventos, activo)
        """
        allowed_fields = {"url", "secret", "eventos", "activo"}
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}

        if not updates:
            return

        # Convert eventos to JSON if present
        if "eventos" in updates and isinstance(updates["eventos"], list):
            updates["eventos"] = json.dumps(updates["eventos"])

        # Build UPDATE statement
        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        set_clause += ", updated_at = CURRENT_TIMESTAMP"
        values = list(updates.values()) + [webhook_id]

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE webhook SET {set_clause} WHERE id = ?",
                values,
            )

        logger.info(f"[Webhook] Updated webhook {webhook_id}")

    @staticmethod
    def delete(webhook_id: int) -> None:
        """
        Delete a webhook (soft delete by setting activo=0).

        Args:
            webhook_id: Webhook ID
        """
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM webhook WHERE id = ?", (webhook_id,))

        logger.info(f"[Webhook] Deleted webhook {webhook_id}")

    @staticmethod
    def disparar_webhook(evento: str, payload: Dict[str, Any]) -> None:
        """
        Fire webhooks for a given event.

        Sends POST to all active webhooks subscribed to this event.
        Headers:
        - X-Webhook-Signature: HMAC-SHA256 signature
        - X-Webhook-Event: Event name
        - Content-Type: application/json

        Retries up to 3 times with exponential backoff.
        Logs delivery in webhook_delivery table.

        Args:
            evento: Event name (e.g., "solicitud.aprobada")
            payload: Event data as dict
        """
        # Get all active webhooks subscribed to this event
        webhooks = WebhookService.get_all(activo_only=True)
        webhooks_to_fire = []

        for wh in webhooks:
            try:
                eventos = json.loads(wh["eventos"])
                if evento in eventos:
                    webhooks_to_fire.append(wh)
            except (json.JSONDecodeError, TypeError):
                logger.warning(f"[Webhook] Invalid eventos JSON for webhook {wh['id']}")
                continue

        if not webhooks_to_fire:
            logger.debug(f"[Webhook] No webhooks subscribed to event '{evento}'")
            return

        # Prepare payload
        payload_json = json.dumps(payload, ensure_ascii=False)

        # Fire webhooks
        for wh in webhooks_to_fire:
            webhook_id = wh["id"]
            url = wh["url"]
            secret = wh["secret"]

            success = False
            status_code = None
            response_body = None

            # Retry up to 3 times
            for attempt in range(3):
                try:
                    # Generate HMAC signature
                    signature = hmac.new(
                        secret.encode("utf-8"),
                        payload_json.encode("utf-8"),
                        hashlib.sha256,
                    ).hexdigest()

                    # Send POST request
                    headers = {
                        "X-Webhook-Signature": signature,
                        "X-Webhook-Event": evento,
                        "Content-Type": "application/json",
                    }

                    response = requests.post(
                        url,
                        data=payload_json,
                        headers=headers,
                        timeout=10,
                    )

                    status_code = response.status_code
                    response_body = response.text[:1000]  # Limit to 1000 chars

                    # Consider 2xx as success
                    if 200 <= status_code < 300:
                        success = True
                        logger.info(
                            f"[Webhook] Delivered event '{evento}' to webhook {webhook_id} "
                            f"(status: {status_code})"
                        )
                        break
                    else:
                        logger.warning(
                            f"[Webhook] Failed to deliver event '{evento}' to webhook {webhook_id} "
                            f"(status: {status_code}), attempt {attempt + 1}/3"
                        )

                except requests.exceptions.RequestException as e:
                    logger.warning(
                        f"[Webhook] Request exception for webhook {webhook_id}: {e}, "
                        f"attempt {attempt + 1}/3"
                    )
                    response_body = str(e)[:1000]

                # Exponential backoff: 1s, 2s, 4s
                if not success and attempt < 2:
                    time.sleep(2**attempt)

            # Log delivery
            WebhookService._log_delivery(
                webhook_id=webhook_id,
                evento=evento,
                status_code=status_code,
                success=success,
                response_body=response_body,
            )

    @staticmethod
    def _log_delivery(
        webhook_id: int,
        evento: str,
        status_code: Optional[int],
        success: bool,
        response_body: Optional[str],
    ) -> None:
        """
        Log a webhook delivery attempt.

        Args:
            webhook_id: Webhook ID
            evento: Event name
            status_code: HTTP status code
            success: Whether delivery was successful
            response_body: Response body (truncated)
        """
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO webhook_delivery (webhook_id, evento, status_code, success, response_body)
                VALUES (?, ?, ?, ?, ?)
                """,
                (webhook_id, evento, status_code, 1 if success else 0, response_body),
            )

    @staticmethod
    def get_deliveries(webhook_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get delivery log for a webhook.

        Args:
            webhook_id: Webhook ID
            limit: Max number of entries to return

        Returns:
            List of delivery dicts
        """
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, webhook_id, evento, status_code, success, response_body, created_at
                FROM webhook_delivery
                WHERE webhook_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (webhook_id, limit),
            )
            rows = cur.fetchall()

        return [dict(row) for row in rows]

    @staticmethod
    def test_webhook(webhook_id: int) -> Dict[str, Any]:
        """
        Send a test event to a webhook.

        Args:
            webhook_id: Webhook ID

        Returns:
            Dict with test result
        """
        # Get webhook
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM webhook WHERE id = ?", (webhook_id,))
            row = cur.fetchone()

        if not row:
            return {"success": False, "error": "Webhook not found"}

        webhook = dict(row)

        # Send test payload
        test_payload = {
            "event": "webhook.test",
            "timestamp": time.time(),
            "webhook_id": webhook_id,
            "message": "This is a test event from SPMSystem 2.0",
        }

        try:
            payload_json = json.dumps(test_payload, ensure_ascii=False)

            # Generate HMAC signature
            signature = hmac.new(
                webhook["secret"].encode("utf-8"),
                payload_json.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            # Send POST request
            headers = {
                "X-Webhook-Signature": signature,
                "X-Webhook-Event": "webhook.test",
                "Content-Type": "application/json",
            }

            response = requests.post(
                webhook["url"],
                data=payload_json,
                headers=headers,
                timeout=10,
            )

            success = 200 <= response.status_code < 300

            # Log delivery
            WebhookService._log_delivery(
                webhook_id=webhook_id,
                evento="webhook.test",
                status_code=response.status_code,
                success=success,
                response_body=response.text[:1000],
            )

            return {
                "success": success,
                "status_code": response.status_code,
                "response": response.text[:500],
            }

        except requests.exceptions.RequestException as e:
            logger.warning(f"[Webhook] Test failed for webhook {webhook_id}: {e}")

            # Log delivery
            WebhookService._log_delivery(
                webhook_id=webhook_id,
                evento="webhook.test",
                status_code=None,
                success=False,
                response_body=str(e)[:1000],
            )

            return {"success": False, "error": str(e)}

    @staticmethod
    def generate_secret() -> str:
        """
        Generate a secure random secret for a webhook.

        Returns:
            32-byte hex string
        """
        return secrets.token_hex(32)
