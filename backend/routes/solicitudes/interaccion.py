"""
Solicitudes interaccion routes - Comentarios, historial y transiciones.

Incluye: comentar_solicitud, get_historial_estados, get_transiciones_posibles.
"""

import json
import logging

from flask import g, jsonify, request

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.fsm import (
    estado_para_display,
    normalizar_estado,
)
from backend.core.roles import require_auth
from backend.routes.solicitudes import bp
from backend.routes.solicitudes.helpers import (
    _calcular_total,
    _get_raw,
)

logger = logging.getLogger(__name__)


@bp.route("/<int:solicitud_id>/comentar", methods=["POST"])
@require_auth
def comentar_solicitud(solicitud_id):
    """Agregar comentario/notificacion a una solicitud"""
    actor_id = str(g.user.get("user_id") or "system")

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

    # Registrar el comentario en el log (si existe la tabla)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Verificar si existe la tabla de log
            cur.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_name='solicitud_tratamiento_log'"
            )
            table_exists = cur.fetchone() is not None

        if table_exists:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO solicitud_tratamiento_log (solicitud_id, item_index, actor_id, tipo, estado, payload_json) VALUES (?,?,?,?,?,?)",
                    (
                        solicitud_id,
                        None,
                        actor_id,
                        "comentario_agregado",
                        "comentario",
                        json.dumps({"comentario": comentario}),
                    ),
                )
    except Exception:
        pass  # Log error silently - consider proper logging in production

    return jsonify({"ok": True, "message": "Comentario agregado correctamente"}), 200


@bp.route("/<int:solicitud_id>/historial-estados", methods=["GET"])
@require_auth
def get_historial_estados(solicitud_id):
    """
    Obtener historial de transiciones de estado de una solicitud.

    Endpoint v2 que usa el FSM centralizado.
    """
    # Importar funcion del FSM
    from backend.core.fsm import estado_para_display, obtener_historial_estados

    # Verificar que la solicitud existe
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # Obtener historial
    historial = obtener_historial_estados(solicitud_id)

    # Enriquecer con nombres de display
    for item in historial:
        item["estado_anterior_display"] = estado_para_display(item["estado_anterior"])
        item["estado_nuevo_display"] = estado_para_display(item["estado_nuevo"])

    return (
        jsonify(
            {
                "ok": True,
                "solicitud_id": solicitud_id,
                "estado_actual": normalizar_estado(solicitud.get("status") or ""),
                "estado_actual_display": estado_para_display(solicitud.get("status") or ""),
                "historial": historial,
                "total_transiciones": len(historial),
            }
        ),
        200,
    )


@bp.route("/<int:solicitud_id>/transiciones-posibles", methods=["GET"])
@require_auth
def get_transiciones_posibles(solicitud_id):
    """
    Obtener las transiciones de estado posibles desde el estado actual.

    Util para que el frontend muestre solo las acciones permitidas.
    Incluye validacion de permisos para cada transicion.
    """
    user_id = g.user.get("user_id")

    # Importar funcion del FSM
    from backend.core.fsm import get_transiciones_posibles as fsm_transiciones
    from backend.core.fsm import normalizar_estado

    # Importar servicio de aprobacion para validar permisos
    from backend.services.approval_service import puede_aprobar

    # Verificar que la solicitud existe
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    estado_actual = normalizar_estado(solicitud.get("status") or "")
    transiciones_display = fsm_transiciones(estado_actual)  # Retorna strings display names

    # Obtener informacion del usuario para validar permisos
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol, centros FROM usuario WHERE id_spm = ?", (user_id,))
        user_row = cur.fetchone()
        user_rol = user_row["rol"] if isinstance(user_row, dict) else user_row[0] if user_row else ""
        user_row["centros"] if isinstance(user_row, dict) else user_row[1] if user_row else None

    # FIX 2.1: Enriquecer transiciones con validacion de permisos
    transiciones_con_permisos = []
    owner_id = str(solicitud.get("id_usuario", ""))
    es_owner = str(user_id) == owner_id
    es_admin = "admin" in (user_rol or "").lower()

    # Calcular total de la solicitud para validar aprobacion
    items_json = solicitud.get("data_json") or "{}"
    try:
        extra = json.loads(items_json) if isinstance(items_json, str) else items_json
        items = extra.get("items", [])
    except (json.JSONDecodeError, TypeError):
        items = []
    total_solicitud = _calcular_total(items)

    for estado_display in transiciones_display:
        # estado_display es un string como "Aprobada", "Enviada", etc.
        # Convertir de nuevo a estado interno para comparaciones
        from backend.core.fsm import normalizar_estado
        estado_destino = normalizar_estado(estado_display)

        validacion = {
            "estado": estado_destino,
            "estado_display": estado_display,
            "permitido": True,
            "razon": None,
        }

        # Validar permisos especificos por tipo de transicion
        if estado_destino == "approved":
            # Solo aprobadores pueden aprobar
            permiso = puede_aprobar(
                usuario_id=user_id,
                monto_usd=total_solicitud,
                centro=solicitud.get("centro"),
                sector=solicitud.get("sector"),
            )
            if not permiso.get("puede_aprobar"):
                validacion["permitido"] = False
                validacion["razon"] = permiso.get("razon", "Sin permisos de aprobacion")

        elif estado_destino == "rejected":
            # Solo aprobadores o admin pueden rechazar
            es_aprobador = "aprobador" in (user_rol or "").lower() or "coordinador" in (user_rol or "").lower()
            if not es_aprobador and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo aprobadores pueden rechazar solicitudes"

        elif estado_destino == "cancelled":
            # Solo el owner o admin pueden cancelar
            if not es_owner and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo el solicitante o admin puede cancelar"

        elif estado_destino == "in_planning":
            # Solo planificadores o admin pueden mover a planificacion
            es_planner = "planner" in (user_rol or "").lower() or "planificador" in (user_rol or "").lower()
            if not es_planner and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo planificadores pueden iniciar planificacion"
            else:
                # FIX 4.1: Validar limite de retrocesos (in_treatment -> in_planning)
                if estado_actual == "in_treatment":
                    with get_db_connection() as conn_ret:
                        cur_ret = conn_ret.cursor()
                        cur_ret.execute(
                            """
                            SELECT COUNT(*) as retrocesos FROM solicitud_historial_estado
                            WHERE solicitud_id = ?
                              AND estado_anterior = 'in_treatment'
                              AND estado_nuevo = 'in_planning'
                            """,
                            (solicitud_id,),
                        )
                        row_ret = cur_ret.fetchone()
                        retrocesos = row_ret["retrocesos"] if isinstance(row_ret, dict) else row_ret[0] if row_ret else 0
                        if retrocesos >= 3:
                            validacion["permitido"] = False
                            validacion["razon"] = "Limite de 3 retrocesos alcanzado para esta solicitud"

        elif estado_destino == "submitted":
            # Solo el owner puede enviar (desde draft)
            if estado_actual == "draft" and not es_owner and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo el solicitante puede enviar su solicitud"

        transiciones_con_permisos.append(validacion)

    return (
        jsonify(
            {
                "ok": True,
                "solicitud_id": solicitud_id,
                "estado_actual": estado_actual,
                "estado_actual_display": estado_para_display(estado_actual),
                "transiciones_posibles": transiciones_con_permisos,
            }
        ),
        200,
    )
