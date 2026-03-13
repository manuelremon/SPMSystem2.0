"""
Planner - Ciclo de Vida y Tratamiento de Solicitudes

Endpoints para transiciones de estado y gestion de items:
- Aceptar solicitud (approved -> in_treatment)
- Finalizar tratamiento (in_treatment -> completed)
- Agregar comentarios
- Guardar tratamiento de items
- Obtener tratamiento previo (rehidratar)
"""

import logging

from flask import jsonify, request

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.errors import error_not_found, error_validation
from backend.core.fsm import (
    EstadoSolicitud,
    SolicitudNoEncontradaError,
    TransicionInvalidaError,
    cambiar_estado,
    normalizar_estado,
)
from backend.core.roles import require_auth
from backend.routes.planner import bp
from backend.routes.planner.helpers import _enviar_notificacion_finalizacion, _log_evento
from backend.routes.planner_helpers import (
    _current_user,
    _require_planner_role,
    _require_solicitud_access,
)

logger = logging.getLogger(__name__)

ESTADOS_TOMABLES = {"approved", "in_planning", "in_treatment"}


@bp.route("/solicitudes/<int:solicitud_id>/tomar", methods=["POST"])
@require_auth
def tomar_solicitud(solicitud_id):
    """Admin o Planificador toma una solicitud asignada a otro planificador."""
    user = _current_user()
    if isinstance(user, tuple):
        return user

    guard, _is_admin = _require_planner_role(user)
    if guard:
        return guard

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")
    actor_nombre = f"{user.get('nombre', '')} {user.get('apellido', '')}".strip() or actor_id

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, status, planner_id FROM solicitud WHERE id = %s",
            (solicitud_id,),
        )
        sol = cur.fetchone()

    if not sol:
        return error_not_found("Solicitud", solicitud_id)

    estado_actual = normalizar_estado(sol["status"])
    if estado_actual not in ESTADOS_TOMABLES:
        return (
            jsonify({
                "ok": False,
                "error": {
                    "code": "estado_invalido",
                    "message": f"No se puede tomar una solicitud en estado '{estado_actual}'",
                },
            }),
            400,
        )

    planner_anterior = (sol["planner_id"] or "").strip()
    if planner_anterior == actor_id:
        return (
            jsonify({
                "ok": False,
                "error": {
                    "code": "ya_asignada",
                    "message": "Esta solicitud ya está asignada a ti",
                },
            }),
            400,
        )

    # Reasignar planner_id
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE solicitud SET planner_id = %s WHERE id = %s",
            (actor_id, solicitud_id),
        )

    # Registrar evento en historial
    _log_evento(
        solicitud_id,
        None,
        "planificador_toma",
        estado_actual,
        {"planner_anterior": planner_anterior, "planner_nuevo": actor_id},
        actor=actor_id,
    )

    # Notificar al planificador anterior (si existía)
    if planner_anterior:
        try:
            from backend.services.notification_service import NotificationService

            NotificationService.create_notification(
                destinatario_id=planner_anterior,
                mensaje=f"Solicitud #{solicitud_id} reasignada a {actor_nombre}",
                tipo="info",
                solicitud_id=solicitud_id,
            )
        except Exception as e:
            logger.warning(f"Error notificando reasignacion solicitud {solicitud_id}: {e}")

    return jsonify({
        "ok": True,
        "planner_id": actor_id,
        "planner_nombre": actor_nombre,
    }), 200


@bp.route("/solicitudes/<int:solicitud_id>/aceptar", methods=["POST"])
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


@bp.route("/solicitudes/<int:solicitud_id>/finalizar", methods=["POST"])
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


@bp.route("/solicitudes/<int:solicitud_id>/comentar", methods=["POST"])
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


@bp.route("/solicitudes/<int:solicitud_id>/items", methods=["PATCH"])
@require_auth
def tratar_items(solicitud_id):
    """
    Guarda tratamiento de items: espera un array items con item_index, decision, cantidad_aprobada, comentario, etc.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    actor = str(
        user.get("id_spm")
        or user.get("usuario")
        or user.get("id")
        or data.get("actor_id")
        or "planner"
    )

    # Validacion basica de items de tratamiento (Sprint 3.4)
    if not items:
        return error_validation("Se requiere al menos un item para tratar")

    errores = []
    for idx, it in enumerate(items):
        if it.get("item_index") is None:
            errores.append(f"Item {idx}: item_index es requerido")
            continue

        # Validar cantidad_aprobada
        cant = it.get("cantidad_aprobada")
        if cant is not None:
            try:
                cant = float(cant)
                if cant < 0:
                    errores.append(f"Item {idx}: cantidad_aprobada no puede ser negativa")
            except (TypeError, ValueError):
                errores.append(f"Item {idx}: cantidad_aprobada debe ser un numero")

        # Validar precio_unitario_estimado
        precio = it.get("precio_unitario_estimado")
        if precio is not None:
            try:
                precio = float(precio)
                if precio < 0:
                    errores.append(f"Item {idx}: precio_unitario_estimado no puede ser negativo")
            except (TypeError, ValueError):
                errores.append(f"Item {idx}: precio_unitario_estimado debe ser un numero")

    if errores:
        return error_validation("; ".join(errores))

    with get_db_transaction() as conn:
        cur = conn.cursor()
        for it in items:
            idx = it.get("item_index")
            if idx is None:
                continue
            cur.execute(
                """
                INSERT INTO solicitud_items_tratamiento (solicitud_id, item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido, precio_unitario_estimado, comentario, updated_by)
                VALUES (?,?,?,?,?,?,?,?,?)
                ON CONFLICT(solicitud_id, item_index) DO UPDATE SET
                    decision=excluded.decision,
                    cantidad_aprobada=excluded.cantidad_aprobada,
                    codigo_equivalente=excluded.codigo_equivalente,
                    proveedor_sugerido=excluded.proveedor_sugerido,
                    precio_unitario_estimado=excluded.precio_unitario_estimado,
                    comentario=excluded.comentario,
                    updated_by=excluded.updated_by,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (
                    solicitud_id,
                    idx,
                    it.get("decision") or "",
                    it.get("cantidad_aprobada") or 0,
                    it.get("codigo_equivalente") or "",
                    it.get("proveedor_sugerido") or "",
                    it.get("precio_unitario_estimado") or 0,
                    it.get("comentario") or "",
                    actor,
                ),
            )
            _log_evento(
                solicitud_id, idx, "item_tratado", it.get("decision") or "", it, actor=actor
            )

    # Usar FSM para asegurar estado correcto (si no esta ya en tratamiento)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status FROM solicitud WHERE id=?", (solicitud_id,))
            row = cur.fetchone()
            if row:
                estado_actual = normalizar_estado(row["status"])
                if estado_actual != "in_treatment":
                    cambiar_estado(
                        solicitud_id=solicitud_id,
                        nuevo_estado=EstadoSolicitud.IN_TREATMENT,
                        actor_id=actor,
                        razon="Items tratados",
                        metadata={"items_count": len(items)},
                    )
    except TransicionInvalidaError:
        pass

    return jsonify({"ok": True}), 200


@bp.route("/solicitudes/<int:solicitud_id>/tratamiento", methods=["GET"])
@require_auth
def obtener_tratamiento(solicitud_id):
    """Rehidrata decisiones previas para mostrarlas al planificador."""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido,
                      precio_unitario_estimado, comentario, updated_by, updated_at
               FROM solicitud_items_tratamiento WHERE solicitud_id=?""",
            (solicitud_id,),
        )
        rows = cur.fetchall()

    data = [dict(r) for r in rows]
    return jsonify({"ok": True, "data": data}), 200
