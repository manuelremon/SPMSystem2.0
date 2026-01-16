"""
Planner - Ciclo de Vida de Solicitudes

Endpoints para transiciones de estado:
- Aceptar solicitud (approved -> in_treatment)
- Finalizar tratamiento (in_treatment -> completed)
- Agregar comentarios
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.errors import error_not_found, error_validation
from backend.core.fsm import (
    EstadoSolicitud,
    SolicitudNoEncontradaError,
    TransicionInvalidaError,
    cambiar_estado,
)
from backend.core.roles import require_auth
from backend.routes.planner_helpers import _require_solicitud_access
from backend.routes.planner.helpers import _log_evento, _enviar_notificacion_finalizacion

logger = logging.getLogger(__name__)

ciclo_vida_bp = Blueprint("ciclo_vida", __name__)


@ciclo_vida_bp.route("/solicitudes/<int:solicitud_id>/aceptar", methods=["POST"])
@require_auth
def aceptar_solicitud(solicitud_id):
    """Planificador acepta y marca como en tratamiento - Usa FSM"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.IN_TREATMENT,
            actor_id=actor_id,
            razon="Planificador acepta tratamiento",
            metadata={"paso": "aceptacion"},
        )
        _log_evento(
            solicitud_id, None, "planificador_acepta", resultado["estado_nuevo"], {}, actor=actor_id
        )
        return jsonify({"ok": True, "estado": resultado["estado_nuevo"]}), 200

    except TransicionInvalidaError as e:
        logger.warning(f"Transicion invalida aceptar solicitud {solicitud_id}: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": "Transicion de estado no permitida",
                    },
                }
            ),
            400,
        )
    except SolicitudNoEncontradaError:
        return error_not_found("Solicitud", solicitud_id)


@ciclo_vida_bp.route("/solicitudes/<int:solicitud_id>/finalizar", methods=["POST"])
@require_auth
def finalizar_solicitud(solicitud_id):
    """Planificador finaliza tratamiento - Cambia estado a COMPLETED"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

    # 1. Validar que hay decisiones y fueron ejecutadas
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT COUNT(*) as cnt FROM decision_abastecimiento
               WHERE solicitud_id=? AND estado='pendiente'""",
            (solicitud_id,),
        )
        row = cur.fetchone()
        pending = row["cnt"] if row else 0

        if pending > 0:
            return error_validation(
                "acciones",
                f"Hay {pending} acciones pendientes de ejecutar",
            )

    try:
        # 2. Transicion: IN_TREATMENT -> TREATED
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.TREATED,
            actor_id=actor_id,
            razon="Tratamiento completado",
            metadata={"paso": "finalizacion"},
        )

        # 3. Transicion: TREATED -> COMPLETED
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.COMPLETED,
            actor_id=actor_id,
            razon="Tratamiento finalizado",
            metadata={"paso": "finalizacion_completa"},
        )

        # 4. Log evento
        _log_evento(
            solicitud_id,
            None,
            "planificador_finaliza",
            resultado["estado_nuevo"],
            {},
            actor=actor_id,
        )

        # 5. Notificar al solicitante
        _enviar_notificacion_finalizacion(solicitud_id)

        return jsonify({"ok": True, "estado": resultado["estado_nuevo"]}), 200

    except TransicionInvalidaError as e:
        logger.warning(f"Transicion invalida finalizar solicitud {solicitud_id}: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Transicion de estado no permitida: {e}",
                    },
                }
            ),
            400,
        )
    except SolicitudNoEncontradaError:
        return error_not_found("Solicitud", solicitud_id)


@ciclo_vida_bp.route("/solicitudes/<int:solicitud_id>/comentar", methods=["POST"])
@require_auth
def comentar_solicitud(solicitud_id):
    """Agregar comentario/notificacion a una solicitud"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "").strip()

    if not comentario:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "comentario_required",
                        "message": "El comentario es requerido",
                    },
                }
            ),
            400,
        )

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

    _log_evento(
        solicitud_id,
        None,
        "comentario_agregado",
        "comentario",
        {"comentario": comentario},
        actor=actor_id,
    )

    return jsonify({"ok": True, "message": "Comentario agregado correctamente"}), 200
