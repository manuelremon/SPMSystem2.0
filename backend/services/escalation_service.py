"""
Escalation Service - Evaluates solicitudes that exceed approval timeout.

When a solicitud stays in 'submitted' state beyond the configured timeout,
it gets reassigned/escalated to a higher role.
"""
import logging
from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction, sql_datetime_now

logger = logging.getLogger(__name__)


class EscalationService:
    """Service for managing approval escalation rules and executing escalations."""

    @staticmethod
    def get_rules(activo_only=True):
        """Get all escalation rules."""
        with get_db_connection() as conn:
            cur = conn.cursor()
            query = "SELECT * FROM regla_escalacion"
            if activo_only:
                # activo es INTEGER en PostgreSQL (no boolean); = 1 es portable
                query += " WHERE activo = 1"
            query += " ORDER BY centro, criticidad"
            cur.execute(query)
            rows = cur.fetchall()
            return [dict(r) if hasattr(r, "keys") else r for r in rows]

    @staticmethod
    def get_rule(rule_id):
        """Get a single rule by ID."""
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM regla_escalacion WHERE id = ?", (rule_id,))
            row = cur.fetchone()
            return dict(row) if row and hasattr(row, "keys") else row

    @staticmethod
    def create_rule(centro, criticidad, timeout_dias, escalate_to_role):
        """Create a new escalation rule."""
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO regla_escalacion
                   (centro, criticidad, timeout_dias, escalate_to_role, activo)
                   VALUES (?, ?, ?, ?, 1)""",
                (centro or None, criticidad, timeout_dias, escalate_to_role),
            )
            return cur.lastrowid

    @staticmethod
    def update_rule(rule_id, **kwargs):
        """Update an existing escalation rule."""
        allowed = {"centro", "criticidad", "timeout_dias", "escalate_to_role", "activo"}
        fields = {k: v for k, v in kwargs.items() if k in allowed}
        if not fields:
            return False

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values())
        values.append(rule_id)

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE regla_escalacion SET {set_clause}, updated_at = {sql_datetime_now()} WHERE id = ?",
                values,
            )
            return cur.rowcount > 0

    @staticmethod
    def delete_rule(rule_id):
        """Delete an escalation rule."""
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM regla_escalacion WHERE id = ?", (rule_id,))
            return cur.rowcount > 0

    @staticmethod
    def check_escalations():
        """
        Check all submitted solicitudes against escalation rules.
        Returns list of escalated solicitudes.
        """
        rules = EscalationService.get_rules(activo_only=True)
        if not rules:
            return []

        escalated = []
        now = datetime.utcnow()

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT id, centro, criticidad, created_at
                   FROM solicitud
                   WHERE estado = 'submitted'"""
            )
            solicitudes = cur.fetchall()

        for sol in solicitudes:
            sol_dict = dict(sol) if hasattr(sol, "keys") else {
                "id": sol[0], "centro": sol[1], "criticidad": sol[2], "created_at": sol[3]
            }

            created_at = sol_dict.get("created_at", "")
            try:
                if "T" in str(created_at):
                    sol_date = datetime.fromisoformat(str(created_at).replace("Z", "+00:00")).replace(tzinfo=None)
                else:
                    sol_date = datetime.strptime(str(created_at), "%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                continue

            age_days = (now - sol_date).days

            for rule in rules:
                rule_dict = dict(rule) if hasattr(rule, "keys") else rule
                rule_centro = rule_dict.get("centro")
                rule_crit = rule_dict.get("criticidad", "media")
                rule_timeout = rule_dict.get("timeout_dias", 3)
                rule_role = rule_dict.get("escalate_to_role", "admin")

                # Match centro (None means all)
                if rule_centro and rule_centro != sol_dict.get("centro"):
                    continue

                # Match criticidad
                if rule_crit != sol_dict.get("criticidad", "media"):
                    continue

                # Check timeout
                if age_days >= rule_timeout:
                    escalated.append({
                        "solicitud_id": sol_dict["id"],
                        "centro": sol_dict.get("centro"),
                        "criticidad": sol_dict.get("criticidad"),
                        "age_days": age_days,
                        "escalate_to_role": rule_role,
                        "rule_id": rule_dict.get("id"),
                    })
                    break  # Only escalate once per solicitud

        # Execute escalations
        for esc in escalated:
            EscalationService._execute_escalation(esc)

        if escalated:
            logger.info(f"Escalated {len(escalated)} solicitudes")

        return escalated

    @staticmethod
    def _execute_escalation(esc):
        """Execute a single escalation: notify the target role."""
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                now = datetime.utcnow().isoformat() + "Z"

                # Find users with the target role
                cur.execute(
                    "SELECT id_spm FROM usuario WHERE rol LIKE ?",
                    (f"%{esc['escalate_to_role']}%",),
                )
                targets = cur.fetchall()

                mensaje = (
                    f"Solicitud #{esc['solicitud_id']} lleva {esc['age_days']} días "
                    f"pendiente de aprobación (criticidad: {esc.get('criticidad', 'N/A')}). "
                    f"Requiere atención urgente."
                )

                for target in targets:
                    target_id = target[0] if not hasattr(target, "keys") else target.get("id_spm")
                    cur.execute(
                        """INSERT INTO notificacion
                           (destinatario_id, solicitud_id, mensaje, leido, created_at)
                           VALUES (?, ?, ?, 0, ?)""",
                        (target_id, esc["solicitud_id"], mensaje, now),
                    )

                # Log in audit
                cur.execute(
                    """INSERT INTO audit_log
                       (event_type, entity_type, entity_id, details, created_at)
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        "escalation",
                        "solicitud",
                        esc["solicitud_id"],
                        f"Escalated to {esc['escalate_to_role']} after {esc['age_days']} days",
                        now,
                    ),
                )

            logger.info(
                f"Escalated solicitud #{esc['solicitud_id']} to {esc['escalate_to_role']}"
            )
        except Exception as e:
            logger.error(f"Error escalating solicitud #{esc['solicitud_id']}: {e}")
