"""
Planner - Funciones Helper Locales

Funciones auxiliares especificas del modulo planner que no estan
en planner_helpers/ (que son compartidas con otros modulos).
"""

import json
import logging

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def _log_evento(
    solicitud_id: int, item_index, tipo: str, estado: str, payload: dict, actor: str = "planner"
):
    """Registra un evento en el log de tratamiento de solicitudes."""
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO solicitud_tratamiento_log (solicitud_id, item_index, actor_id, tipo, estado, payload_json) VALUES (?,?,?,?,?,?)",
            (solicitud_id, item_index, actor or "planner", tipo, estado, json.dumps(payload)),
        )


def _get_responsable_almacen(centro: str, almacen: str) -> str | None:
    """Busca el responsable de un almacen especifico por rol."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT u.id_spm
                FROM usuario u
                WHERE u.centro = ? AND u.rol LIKE '%%almacen%%'
                LIMIT 1
                """,
                (centro,),
            )
            row = cur.fetchone()
            return row["id_spm"] if row else None
    except Exception:
        return None


def _get_responsable_almacen_config(centro: str, almacen: str) -> str | None:
    """Busca el responsable de un almacen desde config_almacenes."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT responsable_id
                FROM config_almacenes
                WHERE centro = ? AND almacen = ?
                """,
                (centro, almacen),
            )
            row = cur.fetchone()
            return row["responsable_id"] if row and row["responsable_id"] else None
    except Exception:
        return None


def _get_referente_centro(centro: str, almacen: str = None) -> str | None:
    """Busca el referente de un centro desde proveedores_internos."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            placeholder = "%s" if is_using_postgresql() else "?"

            if almacen:
                sql = f"""
                    SELECT pi.referente_email
                    FROM proveedores_internos pi
                    WHERE pi.centro = {placeholder} AND pi.almacen = {placeholder}
                    AND pi.referente_email IS NOT NULL
                    LIMIT 1
                """
                cur.execute(sql, (centro, almacen))
            else:
                sql = f"""
                    SELECT pi.referente_email
                    FROM proveedores_internos pi
                    WHERE pi.centro = {placeholder}
                    AND pi.referente_email IS NOT NULL
                    LIMIT 1
                """
                cur.execute(sql, (centro,))

            row = cur.fetchone()
            if not row:
                return None

            referente_email = row["referente_email"] if isinstance(row, dict) else row[0]
            if not referente_email:
                return None

            sql_user = f"SELECT id_spm FROM usuario WHERE mail = {placeholder}"
            cur.execute(sql_user, (referente_email,))
            user_row = cur.fetchone()
            if user_row:
                return user_row["id_spm"] if isinstance(user_row, dict) else user_row[0]
            return None
    except Exception as e:
        logger.warning(f"Error buscando referente centro {centro}: {e}")
        return None


def _enviar_consulta_stock(
    solicitud_id: int,
    fuente_id: int,
    centro: str,
    almacen: str,
    material: str,
    cantidad: float,
    descripcion: str,
) -> list:
    """
    Envia notificacion de consulta de stock a AMBOS:
    - Responsable del almacen (desde config_almacenes)
    - Referente del centro (coordinador/jefe)

    Returns: Lista de user_ids notificados
    """
    from backend.services.notification_service import NotificationService

    notificados = []
    mensaje = (
        f"Consulta disponibilidad: {cantidad} uds de {material} "
        f"({descripcion}) - {centro}/{almacen}"
    )

    responsable_id = _get_responsable_almacen_config(centro, almacen)
    referente_id = _get_referente_centro(centro, almacen)

    for user_id in set(filter(None, [responsable_id, referente_id])):
        try:
            NotificationService.create_notification(
                destinatario_id=user_id,
                mensaje=mensaje,
                tipo="stock_consulta",
                solicitud_id=solicitud_id,
            )
            notificados.append(user_id)
        except Exception as e:
            logger.warning(f"Error notificando consulta stock a {user_id}: {e}")

    return notificados


def _actualizar_estado_decision(decision_id: int, nuevo_estado: str):
    """Actualiza el estado de una decision de abastecimiento."""
    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE decision_abastecimiento
                SET estado = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (nuevo_estado, decision_id),
            )
    except Exception as e:
        logger.error(f"Error actualizando estado decision: {e}")


def _enviar_notificacion_finalizacion(solicitud_id: int):
    """Notifica al solicitante que el tratamiento finalizo."""
    try:
        from backend.services.notification_service import NotificationService

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id_usuario FROM solicitud WHERE id = ?",
                (solicitud_id,),
            )
            sol = cur.fetchone()

            if sol and sol["id_usuario"]:
                NotificationService.create_notification(
                    destinatario_id=sol["id_usuario"],
                    mensaje=f"El tratamiento de su solicitud #{solicitud_id} ha sido finalizado",
                    tipo="solicitud_dispatched",
                    solicitud_id=solicitud_id,
                )
    except Exception as e:
        logger.warning(f"Error notificando finalizacion {solicitud_id}: {e}")


def _generar_recomendaciones(conflictos: dict) -> list:
    """Genera lista de recomendaciones basadas en conflictos detectados."""
    recs = []
    if conflictos.get("presupuesto_insuficiente"):
        recs.append(
            {
                "tipo": "presupuesto",
                "mensaje": "Saldo insuficiente. Considere reducir cantidad o solicitar ampliacion.",
                "severidad": "alta",
            }
        )
    if conflictos.get("items_sin_stock"):
        recs.append(
            {
                "tipo": "stock",
                "mensaje": "Algunos materiales no tienen stock. Evaluar equivalencias o compra.",
                "severidad": "media",
            }
        )
    if conflictos.get("lead_time_largo"):
        recs.append(
            {
                "tipo": "tiempo",
                "mensaje": "Lead time supera fecha de necesidad. Considerar alternativas.",
                "severidad": "media",
            }
        )
    return recs
