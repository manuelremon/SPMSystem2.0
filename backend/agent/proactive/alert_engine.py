"""
Motor de alertas proactivas para Vertex IA.

Analiza el contexto del usuario y genera alertas inteligentes:
- Stock bajo de materiales frecuentes
- Solicitudes en riesgo de SLA
- Presupuesto agotandose

Usa placeholders ? (convertidos automáticamente a %s en PostgreSQL por PostgresCursorWrapper).
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    sql_datetime_now,
    sql_extract_year,
    sql_now_minus,
    sql_now_plus,
)

logger = logging.getLogger(__name__)


class AlertEngine:
    """Motor de alertas proactivas para Vertex IA."""

    ALERT_TYPES = {
        "stock_bajo": {
            "priority_base": 3,
            "check_interval_hours": 4,
        },
        "sla_riesgo": {
            "priority_base": 2,
            "check_interval_hours": 1,
        },
        "presupuesto_bajo": {
            "priority_base": 4,
            "check_interval_hours": 24,
        },
        "material_frecuente_sin_stock": {
            "priority_base": 2,
            "check_interval_hours": 8,
        },
    }

    def __init__(self, user_id: int):
        """
        Inicializa motor de alertas para un usuario.

        Args:
            user_id: ID del usuario (id_spm)
        """
        self.user_id = user_id

    def check_all_alerts(self) -> List[Dict[str, Any]]:
        """
        Ejecuta todas las verificaciones de alertas.

        Returns:
            Lista de alertas generadas
        """
        alerts = []

        # 1. Verificar solicitudes en riesgo SLA
        alerts.extend(self._check_sla_risks())

        # 2. Verificar presupuesto del centro/sector
        alerts.extend(self._check_budget_status())

        # 3. Guardar alertas nuevas
        for alert in alerts:
            self._save_alert(alert)

        return alerts

    def _check_sla_risks(self) -> List[Dict]:
        """Verifica solicitudes del usuario en riesgo de incumplir SLA."""
        alerts = []

        try:
            deadline_limit = sql_now_plus("24 hours")
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT id, status, created_at, sla_deadline
                    FROM solicitud
                    WHERE id_usuario = ?
                    AND status NOT IN ('closed', 'rejected', 'cancelled')
                    AND sla_deadline IS NOT NULL
                    AND sla_deadline < {deadline_limit}
                    ORDER BY sla_deadline ASC
                    LIMIT 5
                    """,
                    (self.user_id,),
                )
                solicitudes = cursor.fetchall()

            for sol in solicitudes:
                sol_id = sol["id"] if isinstance(sol, dict) else sol[0]
                deadline = sol["sla_deadline"] if isinstance(sol, dict) else sol[3]

                if deadline:
                    if isinstance(deadline, str):
                        deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))

                    hours_remaining = (deadline - datetime.now()).total_seconds() / 3600

                    if hours_remaining < 0:
                        msg = f"Tu solicitud #{sol_id} ya paso el SLA. Contacta al planificador."
                        priority = 1
                    elif hours_remaining < 4:
                        msg = f"Tu solicitud #{sol_id} vence en {hours_remaining:.0f}hs. Esta ajustado!"
                        priority = 2
                    else:
                        msg = f"Tu solicitud #{sol_id} vence maniana. Te aviso por las dudas."
                        priority = 4

                    alerts.append({
                        "type": "sla_riesgo",
                        "priority": priority,
                        "title": "Solicitud en riesgo de SLA",
                        "message": msg,
                        "context": {
                            "solicitud_id": sol_id,
                            "hours_remaining": hours_remaining,
                            "deadline": deadline.isoformat() if deadline else None,
                        },
                    })

        except Exception as e:
            logger.error(f"Error verificando riesgos SLA: {e}")

        return alerts

    def _check_budget_status(self) -> List[Dict]:
        """Verifica estado del presupuesto del centro/sector del usuario."""
        alerts = []

        try:
            year_expr = sql_extract_year()
            with get_db_connection() as conn:
                cursor = conn.cursor()

                # Obtener centro/sector del usuario
                cursor.execute(
                    "SELECT centros FROM usuario WHERE id_spm = ?",
                    (self.user_id,),
                )
                user_row = cursor.fetchone()

                if not user_row:
                    return alerts

                centros = user_row["centros"] if isinstance(user_row, dict) else user_row[0]
                if not centros:
                    return alerts

                # Tomar el primer centro del usuario
                centro = centros.split(",")[0].strip() if "," in str(centros) else centros

                # Verificar presupuesto
                cursor.execute(
                    f"""
                    SELECT monto_total, monto_usado, monto_reservado
                    FROM presupuesto
                    WHERE centro = ? AND anio = {year_expr}
                    """,
                    (centro,),
                )
                budget_row = cursor.fetchone()

            if budget_row:
                total = budget_row["monto_total"] if isinstance(budget_row, dict) else budget_row[0]
                usado = budget_row["monto_usado"] if isinstance(budget_row, dict) else budget_row[1]
                reservado = budget_row["monto_reservado"] if isinstance(budget_row, dict) else budget_row[2]

                if total and total > 0:
                    disponible = total - (usado or 0) - (reservado or 0)
                    porcentaje_usado = ((usado or 0) / total * 100)

                    if porcentaje_usado > 90:
                        alerts.append({
                            "type": "presupuesto_bajo",
                            "priority": 2,
                            "title": "Presupuesto casi agotado",
                            "message": (
                                f"Ojo que el presupuesto de tu centro esta al {porcentaje_usado:.0f}%. "
                                f"Te queda ${disponible:,.0f} disponible."
                            ),
                            "context": {
                                "centro": centro,
                                "porcentaje_usado": porcentaje_usado,
                                "disponible": disponible,
                            },
                        })
                    elif porcentaje_usado > 75:
                        alerts.append({
                            "type": "presupuesto_bajo",
                            "priority": 5,
                            "title": "Presupuesto avanzado",
                            "message": (
                                f"Te cuento que ya usaron el {porcentaje_usado:.0f}% del presupuesto del centro. "
                                f"Quedan ${disponible:,.0f}."
                            ),
                            "context": {
                                "centro": centro,
                                "porcentaje_usado": porcentaje_usado,
                                "disponible": disponible,
                            },
                        })

        except Exception as e:
            logger.error(f"Error verificando presupuesto: {e}")

        return alerts

    def get_pending_alerts(self, limit: int = 5) -> List[Dict]:
        """
        Obtiene alertas pendientes no mostradas al usuario.

        Args:
            limit: Numero maximo de alertas a retornar

        Returns:
            Lista de alertas pendientes
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, alert_type, priority, title, message, context, created_at
                    FROM vertex_proactive_alerts
                    WHERE user_id = ? AND shown_at IS NULL
                    ORDER BY priority ASC, created_at ASC
                    LIMIT ?
                    """,
                    (self.user_id, limit),
                )
                rows = cursor.fetchall()

            alerts = []
            for row in rows:
                context_val = row["context"] if isinstance(row, dict) else row[5]
                if isinstance(context_val, str):
                    context_val = json.loads(context_val)

                alerts.append({
                    "id": row["id"] if isinstance(row, dict) else row[0],
                    "type": row["alert_type"] if isinstance(row, dict) else row[1],
                    "priority": row["priority"] if isinstance(row, dict) else row[2],
                    "title": row["title"] if isinstance(row, dict) else row[3],
                    "message": row["message"] if isinstance(row, dict) else row[4],
                    "context": context_val,
                    "created_at": row["created_at"] if isinstance(row, dict) else row[6],
                })

            return alerts

        except Exception as e:
            logger.error(f"Error obteniendo alertas pendientes: {e}")
            return []

    def mark_alert_shown(self, alert_id: int):
        """
        Marca una alerta como mostrada.

        Args:
            alert_id: ID de la alerta
        """
        try:
            now = sql_datetime_now()
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE vertex_proactive_alerts SET shown_at = {now} WHERE id = ?",
                    (alert_id,),
                )
        except Exception as e:
            logger.error(f"Error marcando alerta: {e}")

    def dismiss_alert(self, alert_id: int):
        """
        Descarta una alerta.

        Args:
            alert_id: ID de la alerta
        """
        try:
            now = sql_datetime_now()
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE vertex_proactive_alerts SET dismissed_at = {now} WHERE id = ? AND user_id = ?",
                    (alert_id, self.user_id),
                )
        except Exception as e:
            logger.error(f"Error descartando alerta: {e}")

    def _save_alert(self, alert: Dict[str, Any]) -> int:
        """
        Guarda una alerta en la BD.

        Args:
            alert: Datos de la alerta

        Returns:
            ID de la alerta creada
        """
        try:
            # Verificar si ya existe una alerta similar reciente
            since = sql_now_minus("4 hours")
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT id FROM vertex_proactive_alerts
                    WHERE user_id = ? AND alert_type = ?
                    AND created_at > {since}
                    AND dismissed_at IS NULL
                    """,
                    (self.user_id, alert["type"]),
                )
                existing = cursor.fetchone()

            if existing:
                # Ya existe una alerta similar reciente
                return existing["id"] if isinstance(existing, dict) else existing[0]

            # Crear nueva alerta
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO vertex_proactive_alerts
                    (user_id, alert_type, priority, title, message, context)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        self.user_id,
                        alert["type"],
                        alert["priority"],
                        alert["title"],
                        alert["message"],
                        json.dumps(alert.get("context", {})),
                    ),
                )

                # Obtener ID
                cursor.execute(
                    "SELECT id FROM vertex_proactive_alerts WHERE user_id = ? ORDER BY id DESC LIMIT 1",
                    (self.user_id,),
                )
                row = cursor.fetchone()
                return row["id"] if isinstance(row, dict) else row[0] if row else 0

        except Exception as e:
            logger.error(f"Error guardando alerta: {e}")
            return 0
