"""
Planner - Consultas de Stock y Respuestas

Endpoints para gestion de consultas de disponibilidad:
- Consultas pendientes por usuario
- Responder consultas de stock (por fuente)
- Responder consultas de referente (legacy, por decision)
"""

import json
import logging

from flask import jsonify, request

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.errors import error_internal, error_not_found, error_validation
from backend.core.roles import require_auth
from backend.routes.planner import bp
from backend.routes.planner.helpers import _log_evento
from backend.routes.planner_helpers import (
    _current_user,
)

logger = logging.getLogger(__name__)


@bp.route("/mis-consultas-pendientes", methods=["GET"])
@require_auth
def obtener_mis_consultas_pendientes():
    """
    Obtiene consultas de stock pendientes para el usuario actual.

    El usuario debe ser responsable de almacen o referente de centro
    para ver las consultas que requieren su respuesta.
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user

    user_id = str(user.get("id_spm") or user.get("usuario") or user.get("id"))

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Buscar consultas pendientes donde el usuario es responsable o referente
            cur.execute(
                """
                SELECT
                    f.id as fuente_id,
                    d.id as decision_id,
                    d.solicitud_id,
                    d.item_index,
                    f.centro_origen,
                    f.almacen_origen,
                    f.cantidad_asignada,
                    f.tipo_fuente,
                    f.codigo_material_equiv,
                    f.estado_consulta,
                    f.created_at,
                    s.criticidad,
                    s.data_json,
                    s.planner_id,
                    s.fecha_necesidad,
                    u.nombre || ' ' || u.apellido as planner_nombre
                FROM decision_abastecimiento_fuentes f
                JOIN decision_abastecimiento d ON d.id = f.decision_id
                JOIN solicitud s ON s.id = d.solicitud_id
                LEFT JOIN usuario u ON u.id_spm = s.planner_id
                LEFT JOIN config_almacenes ca
                    ON ca.centro = f.centro_origen AND ca.almacen = f.almacen_origen
                WHERE (f.estado_consulta = 'pendiente' OR f.estado_consulta IS NULL)
                  AND f.tipo_fuente IN ('stock', 'transferencia', 'equivalencia')
                  AND d.estado = 'esperando_confirmacion'
                  AND (
                      ca.responsable_id = %s
                      OR EXISTS (
                          SELECT 1 FROM usuario u2
                          WHERE u2.id_spm = %s
                          AND f.centro_origen = ANY(string_to_array(u2.centros, ','))
                          AND (u2.rol LIKE '%%coordinador%%' OR u2.rol LIKE '%%jefe%%')
                      )
                      OR EXISTS (
                          SELECT 1 FROM proveedor_interno pi
                          JOIN usuario u3 ON pi.referente_email = u3.mail
                          WHERE u3.id_spm = %s
                          AND pi.centro = f.centro_origen
                          AND pi.almacen = f.almacen_origen
                      )
                  )
                ORDER BY s.criticidad DESC, f.created_at ASC
                """,
                (user_id, user_id, user_id),
            )

            consultas = []
            for row in cur.fetchall():
                consulta = dict(row)
                # Parsear data_json para obtener info del material
                try:
                    data = json.loads(consulta.get("data_json", "{}"))
                    items = data.get("items", [])
                    item_index = consulta.get("item_index", 0)
                    if items and len(items) > item_index:
                        item = items[item_index]
                        consulta["material_id"] = item.get("material_id", "")
                        consulta["material_descripcion"] = item.get("descripcion", "")
                except Exception:
                    consulta["material_id"] = ""
                    consulta["material_descripcion"] = ""

                # Limpiar data_json del response
                del consulta["data_json"]
                consultas.append(consulta)

        return jsonify({"ok": True, "data": consultas}), 200

    except Exception as e:
        logger.error(f"Error obteniendo consultas pendientes para {user_id}: {e}")
        return error_internal("Error al obtener consultas pendientes")


@bp.route("/responder-consulta/<int:fuente_id>", methods=["POST"])
@require_auth
def responder_consulta_stock(fuente_id):
    """
    Responder a consulta de disponibilidad de stock.

    Body JSON:
    {
        "acepta": true/false,
        "cantidad_confirmada": 50,  // Opcional, si confirma parcialmente
        "fecha_disponibilidad": "2025-01-15",  // Opcional
        "comentario": "Notas o motivo"
    }
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user

    try:
        data = request.get_json(silent=True) or {}
        acepta = data.get("acepta", False)
        cantidad_confirmada = data.get("cantidad_confirmada")
        fecha_disponibilidad = data.get("fecha_disponibilidad")
        comentario = data.get("comentario", "")

        usuario_id = str(user.get("id_spm") or user.get("usuario") or user.get("id"))

        # Obtener la fuente y su decision asociada
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT f.*, d.solicitud_id, d.item_index, d.estado as decision_estado,
                       s.planner_id
                FROM decision_abastecimiento_fuentes f
                JOIN decision_abastecimiento d ON d.id = f.decision_id
                JOIN solicitud s ON s.id = d.solicitud_id
                WHERE f.id = ?
                """,
                (fuente_id,),
            )
            fuente = cur.fetchone()

        if not fuente:
            return error_not_found("Consulta", fuente_id)

        # Validar que la consulta esta pendiente
        estado_actual = fuente.get("estado_consulta") or "pendiente"
        if estado_actual not in ("pendiente", None):
            return error_validation(
                "estado", f"Esta consulta ya fue respondida (estado: {estado_actual})"
            )

        # Determinar nuevo estado
        if acepta:
            cantidad_solicitada = fuente.get("cantidad_asignada", 0)
            if cantidad_confirmada and cantidad_confirmada < cantidad_solicitada:
                nuevo_estado = "parcial"
            else:
                nuevo_estado = "confirmado"
                cantidad_confirmada = cantidad_solicitada
        else:
            nuevo_estado = "rechazado"
            cantidad_confirmada = 0

        # Actualizar la fuente con la respuesta
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE decision_abastecimiento_fuentes
                SET estado_consulta = ?,
                    cantidad_confirmada = ?,
                    fecha_disponibilidad = ?,
                    respuesta_comentario = ?,
                    respondido_por = ?,
                    respondido_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    nuevo_estado,
                    cantidad_confirmada,
                    fecha_disponibilidad,
                    comentario,
                    usuario_id,
                    fuente_id,
                ),
            )

            # Si todas las fuentes de la decision estan respondidas, actualizar decision
            cur.execute(
                """
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN estado_consulta IN ('confirmado', 'parcial') THEN 1 ELSE 0 END) as confirmadas,
                       SUM(CASE WHEN estado_consulta = 'rechazado' THEN 1 ELSE 0 END) as rechazadas
                FROM decision_abastecimiento_fuentes
                WHERE decision_id = ?
                """,
                (fuente["decision_id"],),
            )
            stats = cur.fetchone()

            if stats["total"] == (stats["confirmadas"] + stats["rechazadas"]):
                # Todas respondidas - actualizar estado de la decision
                if stats["confirmadas"] > 0:
                    nuevo_estado_decision = "confirmado"
                else:
                    nuevo_estado_decision = "rechazado"

                cur.execute(
                    """
                    UPDATE decision_abastecimiento
                    SET estado = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (nuevo_estado_decision, fuente["decision_id"]),
                )

        # Registrar evento
        _log_evento(
            fuente["solicitud_id"],
            fuente["item_index"],
            "respuesta_consulta_stock",
            nuevo_estado,
            {
                "acepta": acepta,
                "cantidad_confirmada": cantidad_confirmada,
                "fecha_disponibilidad": fecha_disponibilidad,
                "comentario": comentario,
                "fuente_id": fuente_id,
            },
            actor=usuario_id,
        )

        # Notificar al planificador
        from backend.services.notification_service import NotificationService

        if fuente["planner_id"]:
            estado_texto = "confirmada" if acepta else "rechazada"
            mensaje = f"Consulta stock #{fuente['solicitud_id']}: {estado_texto}"
            if cantidad_confirmada and acepta:
                mensaje += f" ({cantidad_confirmada} unidades)"
            if comentario:
                mensaje += f" - {comentario[:50]}"

            NotificationService.create_notification(
                destinatario_id=fuente["planner_id"],
                mensaje=mensaje,
                tipo="stock_consulta_respuesta",
                solicitud_id=fuente["solicitud_id"],
            )

        return (
            jsonify(
                {
                    "ok": True,
                    "data": {
                        "fuente_id": fuente_id,
                        "nuevo_estado": nuevo_estado,
                        "cantidad_confirmada": cantidad_confirmada,
                        "mensaje": "Respuesta registrada correctamente",
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error respondiendo consulta fuente {fuente_id}: {e}")
        return error_internal("Error al registrar respuesta")


@bp.route("/responder-consulta-legacy/<int:decision_id>", methods=["POST"])
@require_auth
def responder_consulta_referente(decision_id):
    """
    Endpoint para que referentes respondan consultas de disponibilidad de stock.

    Body JSON esperado:
    {
        "acepta": true/false,
        "comentario": "Motivo de rechazo o confirmacion",
        "cantidad_confirmada": 50  // opcional, si confirma parcialmente
    }

    Actualiza estado de la decision a 'confirmado' o 'rechazado'.
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user

    try:
        data = request.get_json(silent=True) or {}
        acepta = data.get("acepta", False)
        comentario = data.get("comentario", "")
        cantidad_confirmada = data.get("cantidad_confirmada")

        # Obtener la decision
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, solicitud_id, estado, item_index FROM decision_abastecimiento WHERE id=?",
                (decision_id,),
            )
            decision = cur.fetchone()

        if not decision:
            return error_not_found("Decision", decision_id)

        if decision["estado"] not in ("esperando_confirmacion", "pendiente"):
            return error_validation(
                "estado", f"La decision ya fue procesada (estado: {decision['estado']})"
            )

        # Actualizar estado
        nuevo_estado = "confirmado" if acepta else "rechazado"
        usuario_id = str(user.get("id_spm") or user.get("usuario") or user.get("id"))

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

        # Registrar evento
        _log_evento(
            decision["solicitud_id"],
            decision["item_index"],
            "respuesta_referente",
            nuevo_estado,
            {
                "acepta": acepta,
                "comentario": comentario,
                "cantidad_confirmada": cantidad_confirmada,
            },
            actor=usuario_id,
        )

        # Notificar al planificador
        from backend.services.notification_service import NotificationService

        # Obtener planner_id de la solicitud
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT planner_id FROM solicitud WHERE id=?",
                (decision["solicitud_id"],),
            )
            sol = cur.fetchone()
            if sol and sol["planner_id"]:
                mensaje = (
                    f"Respuesta de referente para solicitud #{decision['solicitud_id']}: "
                    f"{'Confirmado' if acepta else 'Rechazado'}"
                )
                if comentario:
                    mensaje += f" - {comentario}"

                NotificationService.create_notification(
                    destinatario_id=sol["planner_id"],
                    mensaje=mensaje,
                    tipo="info" if acepta else "warning",
                    solicitud_id=decision["solicitud_id"],
                )

        return (
            jsonify(
                {
                    "ok": True,
                    "data": {
                        "decision_id": decision_id,
                        "nuevo_estado": nuevo_estado,
                        "mensaje": "Respuesta registrada correctamente",
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error respondiendo consulta decision {decision_id}: {e}")
        return error_internal("Error al registrar respuesta")
