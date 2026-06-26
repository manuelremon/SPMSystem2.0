"""
Auto-Approval Service
Evaluates solicitudes against configurable rules for automatic approval.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


class AutoApprovalService:
    """Service for managing and evaluating auto-approval rules."""

    @staticmethod
    def evaluar_solicitud(solicitud_id: int) -> Dict[str, Any]:
        """
        Evaluate if a solicitud can be auto-approved.

        Args:
            solicitud_id: Solicitud ID to evaluate

        Returns:
            {
                auto_aprobable: bool,
                regla_aplicada: str | None,
                confianza: float,
                motivo: str
            }
        """
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()

                # 1. Load solicitud data
                cur.execute("""
                    SELECT s.id, s.id_usuario, s.centro_id, s.criticidad,
                           SUM(si.cantidad * si.precio_unitario) as total_monto
                    FROM solicitud s
                    LEFT JOIN solicitud_item si ON s.id = si.solicitud_id
                    WHERE s.id = ?
                    GROUP BY s.id, s.id_usuario, s.centro_id, s.criticidad
                """, (solicitud_id,))
                solicitud = cur.fetchone()

                if not solicitud:
                    return {
                        "auto_aprobable": False,
                        "regla_aplicada": None,
                        "confianza": 0.0,
                        "motivo": "Solicitud no encontrada"
                    }

                sol_data = dict(solicitud)
                total_monto = float(sol_data.get("total_monto") or 0)
                id_usuario = sol_data.get("id_usuario")
                centro_id = sol_data.get("centro_id")
                criticidad = sol_data.get("criticidad", "media")

                # 2. Load active rules ordered by priority
                cur.execute("""
                    SELECT id, nombre, condiciones_json, centro_id, prioridad
                    FROM regla_auto_aprobacion
                    WHERE activo = 1
                    AND (centro_id IS NULL OR centro_id = ?)
                    ORDER BY prioridad ASC
                """, (centro_id,))
                rules = cur.fetchall()

                # 3. Evaluate each rule
                for rule_row in rules:
                    rule = dict(rule_row)
                    rule_id = rule["id"]
                    rule_name = rule["nombre"]
                    conditions_raw = rule.get("condiciones_json", "{}")

                    try:
                        conditions = json.loads(conditions_raw)
                    except (json.JSONDecodeError, TypeError):
                        logger.warning(f"Invalid JSON in rule {rule_id}")
                        continue

                    # Evaluate ALL conditions
                    conditions_met = 0
                    total_conditions = len(conditions)

                    if total_conditions == 0:
                        continue

                    # Condition 1: monto_max
                    if "monto_max" in conditions:
                        if total_monto <= float(conditions["monto_max"]):
                            conditions_met += 1
                        else:
                            continue  # Rule failed

                    # Condition 2: materiales_conocidos_only
                    if "materiales_conocidos_only" in conditions and conditions["materiales_conocidos_only"]:
                        # Check if all materials have been requested before
                        cur.execute("""
                            SELECT COUNT(DISTINCT si.material_codigo) as total_materiales
                            FROM solicitud_item si
                            WHERE si.solicitud_id = ?
                        """, (solicitud_id,))
                        total_materiales = (cur.fetchone() or {}).get("total_materiales", 0)

                        cur.execute("""
                            SELECT COUNT(DISTINCT si_new.material_codigo) as materiales_conocidos
                            FROM solicitud_item si_new
                            WHERE si_new.solicitud_id = ?
                            AND EXISTS (
                                SELECT 1 FROM solicitud_item si_old
                                JOIN solicitud s_old ON si_old.solicitud_id = s_old.id
                                WHERE si_old.material_codigo = si_new.material_codigo
                                AND s_old.id != ?
                                AND s_old.id_usuario = ?
                                AND s_old.status IN ('approved', 'completed')
                            )
                        """, (solicitud_id, solicitud_id, id_usuario))
                        materiales_conocidos = (cur.fetchone() or {}).get("materiales_conocidos", 0)

                        if materiales_conocidos == total_materiales and total_materiales > 0:
                            conditions_met += 1
                        else:
                            continue  # Rule failed

                    # Condition 3: historial_solicitante_min
                    if "historial_solicitante_min" in conditions:
                        cur.execute("""
                            SELECT COUNT(*) as count FROM solicitud
                            WHERE id_usuario = ?
                            AND status IN ('approved', 'completed')
                            AND id != ?
                        """, (id_usuario, solicitud_id))
                        historial_count = (cur.fetchone() or {}).get("count", 0)

                        if historial_count >= int(conditions["historial_solicitante_min"]):
                            conditions_met += 1
                        else:
                            continue  # Rule failed

                    # Condition 4: criticidad_max
                    if "criticidad_max" in conditions:
                        criticidad_map = {"baja": 1, "media": 2, "alta": 3, "critica": 4}
                        criticidad_actual = criticidad_map.get(criticidad.lower(), 2)
                        criticidad_limite = criticidad_map.get(conditions["criticidad_max"].lower(), 2)

                        if criticidad_actual <= criticidad_limite:
                            conditions_met += 1
                        else:
                            continue  # Rule failed

                    # If ALL conditions passed, this rule matches
                    if conditions_met == total_conditions:
                        confianza = conditions_met / max(total_conditions, 1)
                        return {
                            "auto_aprobable": True,
                            "regla_aplicada": rule_name,
                            "confianza": round(confianza, 2),
                            "motivo": f"Cumple regla: {rule_name}"
                        }

            # No rules matched
            return {
                "auto_aprobable": False,
                "regla_aplicada": None,
                "confianza": 0.0,
                "motivo": "No cumple ninguna regla activa"
            }

        except Exception as e:
            logger.error(f"Error evaluating auto-approval for solicitud {solicitud_id}: {e}")
            return {
                "auto_aprobable": False,
                "regla_aplicada": None,
                "confianza": 0.0,
                "motivo": f"Error en evaluación: {str(e)}"
            }

    @staticmethod
    def get_rules() -> List[Dict[str, Any]]:
        """Get all auto-approval rules."""
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT id, nombre, descripcion, condiciones_json, activo,
                           centro_id, prioridad, creado_por, created_at, updated_at
                    FROM regla_auto_aprobacion
                    ORDER BY prioridad ASC, created_at DESC
                """)
                rows = cur.fetchall()

            return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting auto-approval rules: {e}")
            return []

    @staticmethod
    def create_rule(data: Dict[str, Any], user_id: int) -> Optional[Dict[str, Any]]:
        """Create a new auto-approval rule."""
        try:
            nombre = data.get("nombre", "").strip()
            descripcion = data.get("descripcion", "").strip()
            condiciones = data.get("condiciones", {})
            centro_id = data.get("centro_id")
            prioridad = int(data.get("prioridad", 100))
            activo = bool(data.get("activo", True))

            if not nombre:
                return None

            condiciones_json = json.dumps(condiciones)

            with get_db_transaction() as conn:
                cur = conn.cursor()

                if is_using_postgresql():
                    cur.execute("""
                        INSERT INTO regla_auto_aprobacion
                        (nombre, descripcion, condiciones_json, activo, centro_id, prioridad, creado_por)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (nombre, descripcion, condiciones_json, activo, centro_id, prioridad, user_id))
                    rule_id = cur.fetchone()["id"]
                else:
                    cur.execute("""
                        INSERT INTO regla_auto_aprobacion
                        (nombre, descripcion, condiciones_json, activo, centro_id, prioridad, creado_por)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (nombre, descripcion, condiciones_json, activo, centro_id, prioridad, user_id))
                    rule_id = cur.lastrowid

                # Fetch created rule
                cur.execute("SELECT * FROM regla_auto_aprobacion WHERE id = ?", (rule_id,))
                row = cur.fetchone()

            logger.info(f"Auto-approval rule created: {rule_id} by user {user_id}")
            return dict(row) if row else None

        except Exception as e:
            logger.error(f"Error creating auto-approval rule: {e}")
            return None

    @staticmethod
    def update_rule(rule_id: int, data: Dict[str, Any], user_id: int) -> Optional[Dict[str, Any]]:
        """Update an existing auto-approval rule."""
        try:
            updates = []
            params = []

            if "nombre" in data:
                updates.append("nombre = ?")
                params.append(data["nombre"])

            if "descripcion" in data:
                updates.append("descripcion = ?")
                params.append(data["descripcion"])

            if "condiciones" in data:
                updates.append("condiciones_json = ?")
                params.append(json.dumps(data["condiciones"]))

            if "activo" in data:
                updates.append("activo = ?")
                params.append(bool(data["activo"]))

            if "centro_id" in data:
                updates.append("centro_id = ?")
                params.append(data["centro_id"])

            if "prioridad" in data:
                updates.append("prioridad = ?")
                params.append(int(data["prioridad"]))

            if not updates:
                return None

            if is_using_postgresql():
                updates.append("updated_at = CURRENT_TIMESTAMP")
            else:
                updates.append("updated_at = datetime('now')")

            params.append(rule_id)

            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(f"""
                    UPDATE regla_auto_aprobacion
                    SET {', '.join(updates)}
                    WHERE id = ?
                """, params)

                # Fetch updated rule
                cur.execute("SELECT * FROM regla_auto_aprobacion WHERE id = ?", (rule_id,))
                row = cur.fetchone()

            logger.info(f"Auto-approval rule updated: {rule_id} by user {user_id}")
            return dict(row) if row else None

        except Exception as e:
            logger.error(f"Error updating auto-approval rule {rule_id}: {e}")
            return None

    @staticmethod
    def delete_rule(rule_id: int, user_id: int) -> bool:
        """Delete an auto-approval rule."""
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute("DELETE FROM regla_auto_aprobacion WHERE id = ?", (rule_id,))
                deleted = cur.rowcount > 0

            if deleted:
                logger.info(f"Auto-approval rule deleted: {rule_id} by user {user_id}")

            return deleted

        except Exception as e:
            logger.error(f"Error deleting auto-approval rule {rule_id}: {e}")
            return False

    @staticmethod
    def simulate(rule_id: Optional[int] = None, dias: int = 30) -> Dict[str, Any]:
        """
        Simulate how many recent solicitudes would have been auto-approved.

        Args:
            rule_id: Specific rule to test (None = all active rules)
            dias: Number of days to look back

        Returns:
            {
                total_solicitudes: int,
                auto_aprobables: int,
                porcentaje: float,
                detalle: [...]
            }
        """
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Get recent solicitudes (submitted state)
                if is_using_postgresql():
                    cur.execute("""
                        SELECT id FROM solicitud
                        WHERE status = 'submitted'
                        AND created_at >= NOW() - INTERVAL '%s days'
                        ORDER BY created_at DESC
                        LIMIT 100
                    """, (dias,))
                else:
                    cur.execute("""
                        SELECT id FROM solicitud
                        WHERE status = 'submitted'
                        AND created_at >= datetime('now', '-' || ? || ' days')
                        ORDER BY created_at DESC
                        LIMIT 100
                    """, (dias,))

                solicitudes = [row["id"] for row in cur.fetchall()]

            total_solicitudes = len(solicitudes)
            auto_aprobables = 0
            detalle = []

            for sol_id in solicitudes:
                result = AutoApprovalService.evaluar_solicitud(sol_id)
                if result.get("auto_aprobable"):
                    auto_aprobables += 1
                    detalle.append({
                        "solicitud_id": sol_id,
                        "regla_aplicada": result.get("regla_aplicada"),
                        "confianza": result.get("confianza")
                    })

            porcentaje = round(100 * auto_aprobables / total_solicitudes, 1) if total_solicitudes > 0 else 0.0

            return {
                "total_solicitudes": total_solicitudes,
                "auto_aprobables": auto_aprobables,
                "porcentaje": porcentaje,
                "detalle": detalle[:20]  # Limit to top 20
            }

        except Exception as e:
            logger.error(f"Error simulating auto-approval: {e}")
            return {
                "total_solicitudes": 0,
                "auto_aprobables": 0,
                "porcentaje": 0.0,
                "detalle": [],
                "error": str(e)
            }
