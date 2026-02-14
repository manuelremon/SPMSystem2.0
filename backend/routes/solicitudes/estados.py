"""
Solicitudes estados routes - Transiciones de estado del flujo de solicitudes.

Incluye: enviar_solicitud, aprobar_solicitud, rechazar_solicitud,
cancelar_solicitud, reenviar_solicitud.
"""

import json
import logging
import traceback
from datetime import datetime

from flask import g, jsonify, request

from backend.core.db import get_db_connection
from backend.core.fsm import (
    EstadoSolicitud,
    SolicitudNoEncontradaError,
    TransicionInvalidaError,
    cambiar_estado,
    estado_para_display,
    normalizar_estado,
    validar_transicion,
)
from backend.core.helpers import row_to_dict as _row_to_dict
from backend.core.item_schemas import validar_items
from backend.core.roles import has_any_role, is_admin, require_auth
from backend.routes.solicitudes import bp
from backend.routes.solicitudes.helpers import (
    _aprobador_por_monto,
    _calcular_total,
    _check_auto_approval,
    _get_raw,
    _obtener_monto_consumo_solicitud,
    _planificador_para,
    _revertir_presupuesto_aprobacion_fallida,
    _update_solicitud,
    _validar_consumo_previo_balanceado,
)
from backend.services.approval_service import puede_aprobar
from backend.services.audit_service import (
    auditar_aprobacion,
    auditar_rechazo,
)
from backend.services.sla_service import (
    actualizar_sla_solicitud,
    calcular_fecha_limite,
    obtener_configuracion_sla,
    resolver_alertas_solicitud,
)

logger = logging.getLogger(__name__)


@bp.route("/<int:solicitud_id>/enviar", methods=["PUT", "POST"])
@require_auth
def enviar_solicitud(solicitud_id):
    """Enviar solicitud para aprobacion - Usa FSM centralizado"""
    user_id = str(g.user.get("user_id", ""))

    # SEGURIDAD: Validar ownership - solo el dueno puede enviar la solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    if str(solicitud.get("id_usuario")) != str(user_id):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tienes permiso para enviar esta solicitud",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    items = data.get("items") or []

    # Validar items antes de enviar (Sprint 3.3)
    # Si no se envian items, obtener los existentes de la solicitud
    if not items:
        # Ya tenemos la solicitud cargada arriba
        if solicitud:
            try:
                data_json = json.loads(solicitud.get("data_json") or "{}")
                items = data_json.get("items", [])
            except (json.JSONDecodeError, TypeError):
                items = []

    if items:
        validacion = validar_items(items)
        if not validacion["ok"]:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "validation_error",
                            "message": validacion.get("mensaje", "Error de validacion en items"),
                            "errores": validacion.get("errores", []),
                        },
                    }
                ),
                400,
            )
        items_validos = [item.to_dict() for item in validacion["items"]]
        total = validacion["total"]
    else:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Se requiere al menos un item para enviar la solicitud",
                    },
                }
            ),
            400,
        )

    aprobador = _aprobador_por_monto(total)

    # Actualizar items y total antes de cambiar estado
    _update_solicitud(
        solicitud_id,
        {
            "data_json": json.dumps({"items": items_validos}),
            "total_monto": total,
            "aprobador_id": aprobador,
        },
    )

    # Usar FSM para cambiar estado (valida transicion y registra historial)
    try:
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.SUBMITTED,
            actor_id=user_id,
            razon="Solicitud enviada para aprobacion",
            metadata={"total_monto": total, "aprobador_asignado": aprobador},
        )
    except SolicitudNoEncontradaError:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud no encontrada"}}
            ),
            404,
        )
    except TransicionInvalidaError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": str(e),
                        "estado_actual": e.estado_actual,
                        "estado_solicitado": e.estado_nuevo,
                    },
                }
            ),
            400,
        )

    # Sprint 4.4: Calcular SLA para la transicion submitted -> approved
    try:
        sol = _get_raw(solicitud_id)
        criticidad = sol.get("criticidad") or "Normal" if sol else "Normal"

        sla_config = obtener_configuracion_sla(
            criticidad=criticidad, estado_desde="submitted", estado_hasta="approved"
        )

        if sla_config:
            fecha_limite = calcular_fecha_limite(
                fecha_inicio=datetime.utcnow(), horas=sla_config["tiempo_objetivo_horas"]
            )
            actualizar_sla_solicitud(
                solicitud_id=solicitud_id,
                fecha_limite=fecha_limite.isoformat() + "Z",
                estado_sla="on_time",
            )
    except Exception as e:
        # SLA es informativo, no debe bloquear el flujo principal
        logger.warning(f"Actualizacion SLA fallo para solicitud {solicitud_id}: {e}")

    # Calcular score IA de prioridad (no bloqueante)
    try:
        from backend.services.ai_service import get_ai_service
        sol_data = _get_raw(solicitud_id)
        if sol_data:
            service = get_ai_service()
            scored = service.priorizar_solicitudes([dict(sol_data)])
            if scored and scored.get("solicitudes_rankeadas"):
                ranked = scored["solicitudes_rankeadas"][0]
                ai_score = ranked.get("total_score", 0)
                priority_level = ranked.get("priority_level", "Media")
                _update_solicitud(solicitud_id, {
                    "ai_score": round(ai_score, 4),
                    "ai_priority": priority_level,
                })
    except Exception as e:
        logger.warning(f"AI scoring fallo para solicitud {solicitud_id}: {e}")

    # Feature 4.1: Auto-Aprobacion con IA (no bloqueante)
    try:
        auto_aprobada = _check_auto_approval(solicitud_id)
        if auto_aprobada:
            logger.info(f"[AUTO-APROBACION] Solicitud {solicitud_id} auto-aprobada por IA")
    except Exception as e:
        logger.warning(f"Auto-aprobacion fallo para solicitud {solicitud_id}: {e}")

    # Import get_solicitud here to avoid circular import at module level
    from backend.routes.solicitudes.crud import get_solicitud
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/aprobar", methods=["PUT", "POST"])
@require_auth
def aprobar_solicitud(solicitud_id):
    """Aprobar solicitud validando presupuesto - Usa FSM centralizado"""
    logger.info(f"[APROBAR-DEBUG] Inicio aprobar_solicitud({solicitud_id})")
    aprobador_id = str(g.user.get("user_id", ""))
    logger.info(f"[APROBAR-DEBUG] aprobador_id={aprobador_id}")

    # 2. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # FIX 4.2: Validar que el usuario solicitante sigue activo
    solicitante_id = solicitud.get("id_usuario")
    if solicitante_id:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT estado_registro FROM usuario WHERE id_spm = ?",
                (str(solicitante_id),),
            )
            row = cur.fetchone()
            if row:
                estado_usuario = row["estado_registro"] if isinstance(row, dict) else row[0]
                if estado_usuario and estado_usuario != "Activo":
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "user_inactive",
                                    "message": "El usuario solicitante ya no esta activo en el sistema",
                                },
                            }
                        ),
                        422,
                    )

    # 2.5 SEGURIDAD: Validar que el aprobador sea el asignado (si hay uno asignado)
    aprobador_asignado = solicitud.get("aprobador_id") or solicitud.get("aprobador_asignado")
    logger.info(f"[APROBAR] Solicitud {solicitud_id}: aprobador_asignado={aprobador_asignado!r}, aprobador_id_token={aprobador_id!r}, match={str(aprobador_asignado) == str(aprobador_id)}")

    # Obtener rol del usuario que intenta aprobar
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (aprobador_id,))
        row = cur.fetchone()
        user_rol = _row_to_dict(row, cur).get("rol", "") if row else ""

    logger.info(f"[APROBAR] Usuario {aprobador_id} rol={user_rol!r}, is_admin={is_admin(user_rol)}")

    if aprobador_asignado and str(aprobador_asignado) != str(aprobador_id):
        # Verificar si es admin (admins pueden aprobar cualquier solicitud)
        if not is_admin(user_rol):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Solo el aprobador asignado puede aprobar esta solicitud",
                            "aprobador_asignado": str(aprobador_asignado),
                        },
                    }
                ),
                403,
            )

    # 3. Validar transicion con FSM (submitted -> approved)
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if not validar_transicion(estado_actual, EstadoSolicitud.APPROVED):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Solicitud no puede aprobarse desde estado '{estado_para_display(estado_actual)}'",
                        "estado_actual": estado_actual,
                    },
                }
            ),
            400,
        )

    # 4. Calcular total
    items = json.loads(solicitud.get("data_json") or "{}").get("items", [])
    total = solicitud.get("total_monto") or _calcular_total(items)

    # 4.5 Validar permisos de aprobacion (matriz parametrizable)
    permiso = puede_aprobar(
        usuario_id=aprobador_id,
        monto_usd=total,
        centro=solicitud.get("centro"),
        sector=solicitud.get("sector"),
    )
    if not permiso.get("puede_aprobar"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "insufficient_permission",
                        "message": permiso.get(
                            "razon", "No tiene permisos para aprobar este monto"
                        ),
                        "rol_usuario": permiso.get("rol_usuario"),
                        "rol_requerido": permiso.get("rol_requerido"),
                        "nivel_aprobacion": permiso.get("nivel_aprobacion"),
                    },
                }
            ),
            403,
        )

    # 4.6 SPRINT 1.2: Validar que no haya consumo previo sin revertir
    # Esto previene doble consumo cuando una solicitud se reenvia
    balanceado, consumos, reversiones = _validar_consumo_previo_balanceado(solicitud_id)
    if not balanceado:
        logger.error(
            f"[DOBLE_CONSUMO] Solicitud {solicitud_id} tiene consumos no balanceados: "
            f"consumos={consumos}, reversiones={reversiones}"
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unbalanced_budget_entries",
                        "message": "Esta solicitud tiene consumos de presupuesto previos no revertidos. "
                                   "Contacte al administrador.",
                        "consumos": consumos,
                        "reversiones": reversiones,
                    },
                }
            ),
            422,
        )

    # 5. Validar y consumir presupuesto
    from backend.services.budget_service import aprobar_solicitud_con_presupuesto

    # Obtener rol del aprobador
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (aprobador_id,))
        user_row = cur.fetchone()

    aprobador_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    result = aprobar_solicitud_con_presupuesto(
        solicitud_id=solicitud_id,
        solicitud=solicitud,
        aprobador_id=aprobador_id,
        aprobador_rol=aprobador_rol,
        actor_ip=request.remote_addr or "",
    )

    if not result["ok"]:
        error_code = result.get("error_code", "budget_error")
        status_code = 422 if error_code == "saldo_insuficiente" else 400
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": error_code,
                        "message": result.get("error_message", "Error de presupuesto"),
                        "saldo_disponible": result.get("saldo_disponible_usd"),
                        "monto_requerido": result.get("monto_requerido_usd"),
                    },
                }
            ),
            status_code,
        )

    # 6. Asignar planificador
    planificador = _planificador_para(solicitud.get("centro"), solicitud.get("sector"))
    _update_solicitud(
        solicitud_id,
        {"total_monto": total, "planner_id": planificador, "aprobador_id": aprobador_id},
    )

    # 7. Usar FSM para cambiar estado (registra historial y dispara notificaciones)
    # FIX: Si falla el FSM, revertir el presupuesto consumido (pattern de compensacion)
    budget_result = result.get("budget_result", {})
    presupuesto_consumido = budget_result.get("saldo_anterior_cents", 0) - budget_result.get(
        "saldo_posterior_cents", 0
    )

    try:
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.APPROVED,
            actor_id=aprobador_id,
            razon="Solicitud aprobada",
            metadata={
                "total_monto": total,
                "planificador_asignado": planificador,
                "presupuesto_consumido_cents": presupuesto_consumido,
                "saldo_anterior_cents": budget_result.get("saldo_anterior_cents"),
                "saldo_posterior_cents": budget_result.get("saldo_posterior_cents"),
                "ledger_id": budget_result.get("ledger_id"),
            },
        )

        # Registrar en auditoria (tolerante a fallos - tabla audit_trail puede no existir)
        try:
            auditar_aprobacion(
                solicitud_id=solicitud_id,
                actor_id=aprobador_id,
                actor_rol=aprobador_rol,
                ip_address=request.remote_addr,
            )
        except Exception as e:
            # Auditoria es informativa, no debe bloquear el flujo principal
            logger.warning(f"[AUDIT] Error registrando aprobacion en audit_trail: {e}")

        # NOTA: Notificacion al solicitante ya se crea automaticamente en FSM
        # (cambiar_estado -> _disparar_notificaciones) - NO duplicar aqui

    except TransicionInvalidaError as e:
        # FIX: Revertir presupuesto consumido si falla el cambio de estado
        _revertir_presupuesto_aprobacion_fallida(
            solicitud_id=solicitud_id,
            solicitud=solicitud,
            monto_cents=presupuesto_consumido,
            aprobador_id=aprobador_id,
            aprobador_rol=aprobador_rol,
            razon=f"Compensacion: FSM fallo con error {str(e)}",
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_transition", "message": str(e)},
                }
            ),
            400,
        )
    except Exception as e:
        # FIX: Cualquier otro error tambien debe revertir el presupuesto
        logger.error(f"Error inesperado en aprobacion de solicitud {solicitud_id}: {e}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        _revertir_presupuesto_aprobacion_fallida(
            solicitud_id=solicitud_id,
            solicitud=solicitud,
            monto_cents=presupuesto_consumido,
            aprobador_id=aprobador_id,
            aprobador_rol=aprobador_rol,
            razon=f"Compensacion: Error inesperado {str(e)}",
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "internal_error", "message": "Error interno al aprobar"},
                }
            ),
            500,
        )

    # Sprint 4.4: Resolver alertas SLA y calcular nuevo SLA para siguiente etapa
    try:
        # Resolver alertas de la transicion submitted -> approved
        resolver_alertas_solicitud(solicitud_id=solicitud_id, resuelto_por=aprobador_id)

        # Calcular SLA para la siguiente transicion: approved -> in_treatment
        criticidad = solicitud.get("criticidad") or "Normal"
        sla_config = obtener_configuracion_sla(
            criticidad=criticidad, estado_desde="approved", estado_hasta="in_treatment"
        )

        if sla_config:
            fecha_limite = calcular_fecha_limite(
                fecha_inicio=datetime.utcnow(), horas=sla_config["tiempo_objetivo_horas"]
            )
            actualizar_sla_solicitud(
                solicitud_id=solicitud_id,
                fecha_limite=fecha_limite.isoformat() + "Z",
                estado_sla="on_time",
            )
    except Exception:
        # SLA es informativo, no debe bloquear el flujo principal
        pass

    # Import get_solicitud here to avoid circular import at module level
    from backend.routes.solicitudes.crud import get_solicitud
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/rechazar", methods=["PUT", "POST"])
@require_auth
def rechazar_solicitud(solicitud_id):
    """Rechazar solicitud - Usa FSM centralizado"""
    actor_id = str(g.user.get("user_id", ""))

    # Obtener rol del actor ANTES de procesar (necesario para validar autorizacion)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (actor_id,))
        user_row = cur.fetchone()
    actor_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    # SEGURIDAD: Validar autorizacion - solo aprobadores/coordinadores/admin pueden rechazar
    roles_rechazo = [
        "aprobador",
        "aprobador_solicitudes",
        "aprobador solicitudes",
        "aprobador de solicitudes",
        "approver",
        "coordinador",
        "coordinator",
        "admin",
        "administrador",
    ]
    if not is_admin(actor_rol) and not has_any_role(actor_rol, roles_rechazo):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tiene permisos para rechazar solicitudes",
                    },
                }
            ),
            403,
        )

    # Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # SEGURIDAD: Validar que el rechazante sea el aprobador asignado (si hay uno)
    aprobador_asignado = solicitud.get("aprobador_id") or solicitud.get("aprobador_asignado")
    if aprobador_asignado and str(aprobador_asignado) != str(actor_id):
        if not is_admin(actor_rol):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Solo el aprobador asignado puede rechazar esta solicitud",
                            "aprobador_asignado": str(aprobador_asignado),
                        },
                    }
                ),
                403,
            )

    # Validar transicion con FSM
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if not validar_transicion(estado_actual, EstadoSolicitud.REJECTED):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Solicitud no puede rechazarse desde estado '{estado_para_display(estado_actual)}'",
                        "estado_actual": estado_actual,
                    },
                }
            ),
            400,
        )

    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo") or ""

    # SPRINT 1.1: Revertir presupuesto si la solicitud estaba APPROVED
    # Esto previene fuga de dinero cuando se rechaza una solicitud ya aprobada
    if estado_actual == EstadoSolicitud.APPROVED.value or estado_actual == "approved":
        monto_consumido = _obtener_monto_consumo_solicitud(solicitud_id)
        if monto_consumido > 0:
            logger.info(
                f"[REVERSION_RECHAZO] Revirtiendo ${monto_consumido/100:.2f} para solicitud {solicitud_id} "
                f"(estado previo: approved)"
            )
            _revertir_presupuesto_aprobacion_fallida(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                monto_cents=monto_consumido,
                aprobador_id=actor_id,
                aprobador_rol=actor_rol,
                razon=f"Reversion por rechazo de solicitud aprobada. Motivo: {motivo or 'No especificado'}",
            )

    # Usar FSM para cambiar estado (registra historial y dispara notificaciones)
    try:
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.REJECTED,
            actor_id=actor_id,
            razon=motivo or "Rechazada",
            metadata={"motivo_rechazo": motivo},
        )

        # Registrar en auditoria
        # Registrar en auditoria (tolerante a fallos - tabla audit_trail puede no existir)
        try:
            auditar_rechazo(
                solicitud_id=solicitud_id,
                actor_id=actor_id,
                motivo=motivo,
                actor_rol=actor_rol,
                ip_address=request.remote_addr,
            )
        except Exception as e:
            # Auditoria es informativa, no debe bloquear el flujo principal
            logger.warning(f"[AUDIT] Error registrando rechazo en audit_trail: {e}")

    except TransicionInvalidaError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_transition", "message": str(e)},
                }
            ),
            400,
        )

    # Sprint 4.4: Resolver todas las alertas SLA al rechazar
    try:
        resolver_alertas_solicitud(solicitud_id=solicitud_id, resuelto_por=actor_id)
        # Limpiar SLA de la solicitud
        actualizar_sla_solicitud(solicitud_id=solicitud_id, fecha_limite=None, estado_sla="closed")
    except Exception:
        # SLA es informativo, no debe bloquear el flujo principal
        pass

    # Import get_solicitud here to avoid circular import at module level
    from backend.routes.solicitudes.crud import get_solicitud
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/cancelar", methods=["PUT", "POST"])
@require_auth
def cancelar_solicitud(solicitud_id):
    """
    SPRINT 1.3: Cancelar solicitud con reversion automatica de presupuesto.
    Solo el solicitante o admin pueden cancelar.
    Si la solicitud estaba APPROVED, el presupuesto consumido se revierte.
    """
    actor_id = str(g.user.get("user_id", ""))

    # 2. Obtener rol del actor
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (actor_id,))
        user_row = cur.fetchone()
    actor_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    # 3. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # 4. SEGURIDAD: Solo el owner o admin pueden cancelar
    owner_id = str(solicitud.get("id_usuario") or solicitud.get("solicitante_id") or "")
    es_owner = str(actor_id) == owner_id
    es_admin_user = is_admin(actor_rol)

    if not es_owner and not es_admin_user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo el solicitante o admin puede cancelar esta solicitud",
                    },
                }
            ),
            403,
        )

    # 5. Validar transicion con FSM
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if not validar_transicion(estado_actual, EstadoSolicitud.CANCELLED):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Solicitud no puede cancelarse desde estado '{estado_para_display(estado_actual)}'",
                        "estado_actual": estado_actual,
                    },
                }
            ),
            400,
        )

    # 6. Obtener motivo de cancelacion (requerido)
    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo") or data.get("motivo_cancelacion") or ""
    if not motivo.strip():
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "motivo_required",
                        "message": "El motivo de cancelacion es requerido",
                    },
                }
            ),
            400,
        )

    # 7. SPRINT 1.3: Revertir presupuesto si la solicitud estaba APPROVED
    if estado_actual == EstadoSolicitud.APPROVED.value or estado_actual == "approved":
        monto_consumido = _obtener_monto_consumo_solicitud(solicitud_id)
        if monto_consumido > 0:
            logger.info(
                f"[REVERSION_CANCELACION] Revirtiendo ${monto_consumido/100:.2f} para solicitud {solicitud_id} "
                f"(estado previo: approved)"
            )
            _revertir_presupuesto_aprobacion_fallida(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                monto_cents=monto_consumido,
                aprobador_id=actor_id,
                aprobador_rol=actor_rol,
                razon=f"Reversion por cancelacion de solicitud. Motivo: {motivo}",
            )

    # 8. Usar FSM para cambiar estado
    try:
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.CANCELLED,
            actor_id=actor_id,
            razon=motivo,
            metadata={"motivo_cancelacion": motivo, "cancelado_por": actor_id},
        )
        logger.info(f"[CANCELACION] Solicitud {solicitud_id} cancelada por usuario {actor_id}")

    except TransicionInvalidaError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_transition", "message": str(e)},
                }
            ),
            400,
        )

    # 9. Resolver alertas SLA
    try:
        resolver_alertas_solicitud(solicitud_id=solicitud_id, resuelto_por=actor_id)
        actualizar_sla_solicitud(solicitud_id=solicitud_id, fecha_limite=None, estado_sla="closed")
    except Exception:
        pass  # SLA es informativo

    # Import get_solicitud here to avoid circular import at module level
    from backend.routes.solicitudes.crud import get_solicitud
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/reenviar", methods=["PUT", "POST"])
@require_auth
def reenviar_solicitud(solicitud_id):
    """
    Reenviar solicitud rechazada para nueva aprobacion.
    Transicion: rejected -> submitted
    Maximo 2 reenvios permitidos (validacion de reenvios).
    """
    actor_id = str(g.user.get("user_id", ""))

    # 1. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # 2. SEGURIDAD: Solo el owner puede reenviar
    owner_id = str(solicitud.get("id_usuario") or solicitud.get("solicitante_id") or "")
    if str(actor_id) != owner_id:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo el solicitante puede reenviar esta solicitud",
                    },
                }
            ),
            403,
        )

    # 3. Validar que este en estado rejected
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if estado_actual != "rejected":
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_state",
                        "message": f"Solicitud debe estar rechazada, estado actual: {estado_actual}",
                    },
                }
            ),
            400,
        )

    # 4. Validar maximo de reenvios (maximo 2)
    with get_db_connection() as conn:
        cur = conn.cursor()
        # Contar transiciones de rejected -> submitted
        cur.execute(
            """SELECT COUNT(*) as reenvios FROM solicitud_historial_estado
               WHERE solicitud_id = ? AND estado_anterior = 'rejected' AND estado_nuevo = 'submitted'""",
            (solicitud_id,),
        )
        row = cur.fetchone()
        reenvios = row["reenvios"] if isinstance(row, dict) else row[0]

    if reenvios >= 2:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "max_reenvios_exceeded",
                        "message": f"Numero maximo de reenvios (2) excedido. Reenvios actuales: {reenvios}",
                    },
                }
            ),
            400,
        )

    # 5. Transicionar a submitted
    data = request.get_json(silent=True) or {}
    razon_reenvio = (data.get("razon_reenvio") or "").strip()

    # 6. Hacer transicion
    cambiar_estado(
        solicitud_id=solicitud_id,
        estado_nuevo=EstadoSolicitud.SUBMITTED,
        actor_id=actor_id,
        razon=razon_reenvio or f"Reenvio #{reenvios + 1}",
    )

    logger.info(f"[REENVIAR] Solicitud {solicitud_id} reenviada (reenvio #{reenvios + 1})")

    # Import get_solicitud here to avoid circular import at module level
    from backend.routes.solicitudes.crud import get_solicitud
    return get_solicitud(solicitud_id)
