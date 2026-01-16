"""
Planner - Acciones Post-Tratamiento (Paso 4)

Endpoints para ejecutar y gestionar acciones despues del tratamiento:
- Ejecutar acciones (traspasos, consultas, SOLPEDs)
- Consultas pendientes por usuario
- Responder consultas de stock
- Estado de acciones
"""

import json
import logging
import traceback

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.errors import error_internal, error_not_found, error_validation
from backend.core.repository import DecisionAbastecimientoRepository
from backend.core.roles import require_auth
from backend.routes.planner_helpers import (
    _current_user,
    _require_solicitud_access,
)
from backend.routes.planner.helpers import (
    _log_evento,
    _get_responsable_almacen,
    _get_responsable_almacen_config,
    _get_referente_centro,
    _enviar_consulta_stock,
    _actualizar_estado_decision,
)

logger = logging.getLogger(__name__)

acciones_bp = Blueprint("acciones", __name__)


@acciones_bp.route("/solicitudes/<int:solicitud_id>/ejecutar-acciones", methods=["POST"])
@require_auth
def ejecutar_acciones_post_tratamiento(solicitud_id):
    """
    PASO 4: Ejecutar acciones post-tratamiento.

    Procesa cada decision de abastecimiento y ejecuta las acciones correspondientes:
    - Stock mismo centro: Notificacion al almacen para traspaso
    - Stock otro centro: Consulta al referente del centro
    - Compra proveedor: Marca como pendiente SOLPED (futuro SAP)
    - Opcional: Enviar resumen al solicitante para aceptacion

    Body JSON esperado:
    {
        "enviar_resumen_solicitante": true/false  // Opcional
    }

    Retorna resumen de acciones ejecutadas por item.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        # Leer opciones del body
        body_data = request.get_json(silent=True) or {}
        enviar_resumen_solicitante = body_data.get("enviar_resumen_solicitante", False)

        # Importar NotificationService y MessageService
        from backend.services.message_service import MessageService
        from backend.services.notification_service import NotificationService

        # Obtener datos de la solicitud
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT centro, id_usuario, data_json FROM solicitudes WHERE id=?",
                (solicitud_id,),
            )
            sol_row = cur.fetchone()
            if not sol_row:
                return error_not_found("Solicitud", solicitud_id)

            centro_solicitud = sol_row["centro"]
            solicitante_id = sol_row["id_usuario"]
            data_json = json.loads(sol_row["data_json"] or "{}")
            items = data_json.get("items", [])

        # Obtener todas las decisiones de la solicitud
        decisiones = DecisionAbastecimientoRepository.get_decisiones_solicitud(solicitud_id)

        acciones_ejecutadas = []
        planner_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

        for decision in decisiones:
            item_idx = decision.get("item_index", 0)
            item = items[item_idx] if item_idx < len(items) else {}
            codigo_material = item.get("codigo") or item.get("codigo_material", "")
            descripcion = item.get("descripcion", "")

            # Obtener fuentes de esta decision
            fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

            for fuente in fuentes:
                tipo_fuente = fuente.get("tipo_fuente", "")
                centro_origen = fuente.get("centro_origen", "")
                almacen_origen = fuente.get("almacen_origen", "")
                cantidad = fuente.get("cantidad_asignada", 0)

                accion = {
                    "decision_id": decision["id"],
                    "item_index": item_idx,
                    "codigo_material": codigo_material,
                    "descripcion": descripcion,
                    "tipo_fuente": tipo_fuente,
                    "cantidad": cantidad,
                    "estado": "pendiente",
                    "destinatario": None,
                    "mensaje": None,
                }

                # Determinar accion segun tipo de fuente
                if tipo_fuente in ("stock", "transferencia"):
                    if centro_origen == centro_solicitud:
                        # Stock mismo centro -> notificar almacen
                        accion["estado"] = "transferencia_solicitada"
                        accion["destinatario"] = f"Almacen {centro_origen}/{almacen_origen}"
                        accion["mensaje"] = (
                            f"Traspaso requerido: {cantidad} unidades de {codigo_material} "
                            f"({descripcion}) desde almacen {almacen_origen}"
                        )

                        # Buscar responsable del almacen y notificar
                        responsable_id = _get_responsable_almacen(centro_origen, almacen_origen)
                        if responsable_id:
                            NotificationService.create_notification(
                                destinatario_id=responsable_id,
                                mensaje=accion["mensaje"],
                                tipo="solicitud_planned",
                                solicitud_id=solicitud_id,
                            )
                            accion["notificacion_enviada"] = True
                    else:
                        # Stock otro centro -> consulta a responsable Y referente
                        accion["estado"] = "esperando_confirmacion"
                        accion["destinatario"] = f"Responsable/Referente {centro_origen}/{almacen_origen}"
                        accion["mensaje"] = (
                            f"Consulta de disponibilidad: {cantidad} unidades de {codigo_material} "
                            f"({descripcion}) desde centro {centro_origen}, almacen {almacen_origen}"
                        )

                        # Notificar a AMBOS: responsable del almacen y referente del centro
                        notificados = _enviar_consulta_stock(
                            solicitud_id=solicitud_id,
                            fuente_id=fuente.get("id", 0),
                            centro=centro_origen,
                            almacen=almacen_origen,
                            material=codigo_material,
                            cantidad=cantidad,
                            descripcion=descripcion,
                        )
                        if notificados:
                            accion["notificacion_enviada"] = True
                            accion["notificados"] = notificados
                            accion["requiere_respuesta"] = True

                elif tipo_fuente == "equivalencia":
                    # Manejo de equivalencias - tratar como stock interno
                    codigo_equiv = fuente.get("codigo_material_equiv", codigo_material)
                    tipo_equiv = fuente.get("tipo_equivalencia", "E1_ESTRICTA")

                    if centro_origen == centro_solicitud or not centro_origen:
                        # Equivalencia del mismo centro -> traspaso
                        accion["estado"] = "transferencia_solicitada"
                        accion["destinatario"] = f"Almacen {centro_origen or centro_solicitud}/{almacen_origen or '0001'}"
                        accion["mensaje"] = (
                            f"Traspaso de equivalencia ({tipo_equiv}): {cantidad} unidades de {codigo_equiv} "
                            f"en lugar de {codigo_material} ({descripcion})"
                        )
                        accion["es_equivalencia"] = True
                        accion["codigo_equivalente"] = codigo_equiv

                        responsable_id = _get_responsable_almacen(
                            centro_origen or centro_solicitud, almacen_origen or "0001"
                        )
                        if responsable_id:
                            NotificationService.create_notification(
                                destinatario_id=responsable_id,
                                mensaje=accion["mensaje"],
                                tipo="solicitud_planned",
                                solicitud_id=solicitud_id,
                            )
                            accion["notificacion_enviada"] = True
                    else:
                        # Equivalencia de otro centro -> consulta a responsable Y referente
                        accion["estado"] = "esperando_confirmacion"
                        accion["destinatario"] = f"Responsable/Referente {centro_origen}"
                        accion["mensaje"] = (
                            f"Consulta equivalencia ({tipo_equiv}): {cantidad} unidades de {codigo_equiv} "
                            f"desde centro {centro_origen} - reemplaza {codigo_material}"
                        )
                        accion["es_equivalencia"] = True
                        accion["codigo_equivalente"] = codigo_equiv

                        # Notificar a AMBOS: responsable del almacen y referente del centro
                        notificados = _enviar_consulta_stock(
                            solicitud_id=solicitud_id,
                            fuente_id=fuente.get("id", 0),
                            centro=centro_origen,
                            almacen=almacen_origen or "0001",
                            material=codigo_equiv,
                            cantidad=cantidad,
                            descripcion=f"Equivalencia de {codigo_material}",
                        )
                        if notificados:
                            accion["notificacion_enviada"] = True
                            accion["notificados"] = notificados
                            accion["requiere_respuesta"] = True

                elif tipo_fuente == "proveedor":
                    # Compra a proveedor -> pendiente SOLPED
                    proveedor = fuente.get("proveedor_nombre", "")
                    accion["estado"] = "solped_pendiente"
                    accion["destinatario"] = proveedor
                    accion["mensaje"] = (
                        f"Pendiente generar SOLPED: {cantidad} unidades de {codigo_material} "
                        f"({descripcion}) - Proveedor: {proveedor}"
                    )
                    accion["requiere_sap"] = True

                # Actualizar estado de la decision en BD
                _actualizar_estado_decision(decision["id"], accion["estado"])

                acciones_ejecutadas.append(accion)

        # Registrar evento
        _log_evento(
            solicitud_id,
            None,
            "acciones_ejecutadas",
            "paso_4",
            {"total_acciones": len(acciones_ejecutadas)},
            actor=planner_id,
        )

        # Agrupar por tipo para el resumen
        resumen = {
            "solicitud_id": solicitud_id,
            "total_acciones": len(acciones_ejecutadas),
            "traspasos_solicitados": len(
                [a for a in acciones_ejecutadas if a["estado"] == "transferencia_solicitada" and not a.get("es_equivalencia")]
            ),
            "equivalencias_solicitadas": len(
                [a for a in acciones_ejecutadas if a.get("es_equivalencia")]
            ),
            "consultas_pendientes": len(
                [a for a in acciones_ejecutadas if a["estado"] == "esperando_confirmacion"]
            ),
            "solped_pendientes": len(
                [a for a in acciones_ejecutadas if a["estado"] == "solped_pendiente"]
            ),
            "acciones": acciones_ejecutadas,
            "resumen_enviado_solicitante": False,
        }

        # Enviar resumen al solicitante si se solicito
        if enviar_resumen_solicitante and solicitante_id:
            try:
                # Construir mensaje de resumen
                resumen_items = []
                for accion in acciones_ejecutadas:
                    estado_label = {
                        "transferencia_solicitada": "Traspaso de almacen",
                        "esperando_confirmacion": "Pendiente confirmacion",
                        "solped_pendiente": "Compra a proveedor",
                    }.get(accion["estado"], accion["estado"])
                    resumen_items.append(
                        f"- {accion['codigo_material']}: {accion['cantidad']} unidades ({estado_label})"
                    )

                mensaje_resumen = (
                    f"Se ha completado el tratamiento de su solicitud #{solicitud_id}.\n\n"
                    f"Resumen del abastecimiento propuesto:\n"
                    f"{chr(10).join(resumen_items)}\n\n"
                    f"Traspasos de stock: {resumen['traspasos_solicitados']}\n"
                    f"Consultas pendientes: {resumen['consultas_pendientes']}\n"
                    f"Compras a proveedores: {resumen['solped_pendientes']}\n\n"
                    f"Por favor, revise el tratamiento propuesto y confirme su aceptacion."
                )

                # Enviar notificacion al solicitante
                NotificationService.create_notification(
                    destinatario_id=solicitante_id,
                    mensaje=f"Tratamiento de solicitud #{solicitud_id} completado - Pendiente su aceptacion",
                    tipo="info",
                    solicitud_id=solicitud_id,
                )

                # Enviar mensaje detallado
                MessageService.enviar_mensaje(
                    remitente_id=planner_id,
                    destinatario_id=solicitante_id,
                    asunto=f"Resumen de tratamiento - Solicitud #{solicitud_id}",
                    mensaje=mensaje_resumen,
                    solicitud_id=solicitud_id,
                    tipo="resumen_tratamiento",
                )

                resumen["resumen_enviado_solicitante"] = True

            except Exception as e:
                # No fallar si no se puede enviar el resumen
                resumen["error_envio_resumen"] = str(e)

        return jsonify({"ok": True, "data": resumen}), 200

    except Exception as e:
        logger.error(f"Error en ejecutar_acciones_post_tratamiento solicitud {solicitud_id}: {e}")
        logger.error(traceback.format_exc())
        return error_internal("Error al ejecutar acciones de tratamiento")


@acciones_bp.route("/mis-consultas-pendientes", methods=["GET"])
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
                JOIN solicitudes s ON s.id = d.solicitud_id
                LEFT JOIN usuarios u ON u.id_spm = s.planner_id
                LEFT JOIN config_almacenes ca
                    ON ca.centro = f.centro_origen AND ca.almacen = f.almacen_origen
                WHERE (f.estado_consulta = 'pendiente' OR f.estado_consulta IS NULL)
                  AND f.tipo_fuente IN ('stock', 'transferencia', 'equivalencia')
                  AND d.estado = 'esperando_confirmacion'
                  AND (
                      ca.responsable_id = %s
                      OR EXISTS (
                          SELECT 1 FROM usuarios u2
                          WHERE u2.id_spm = %s
                          AND f.centro_origen = ANY(string_to_array(u2.centros, ','))
                          AND (u2.rol LIKE '%%coordinador%%' OR u2.rol LIKE '%%jefe%%')
                      )
                      OR EXISTS (
                          SELECT 1 FROM proveedores_internos pi
                          JOIN usuarios u3 ON pi.referente_email = u3.mail
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


@acciones_bp.route("/responder-consulta/<int:fuente_id>", methods=["POST"])
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
                JOIN solicitudes s ON s.id = d.solicitud_id
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


@acciones_bp.route("/responder-consulta-legacy/<int:decision_id>", methods=["POST"])
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
                "SELECT planner_id FROM solicitudes WHERE id=?",
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


@acciones_bp.route("/solicitudes/<int:solicitud_id>/estado-acciones", methods=["GET"])
@require_auth
def obtener_estado_acciones(solicitud_id):
    """
    Obtiene el estado actual de todas las acciones post-tratamiento de una solicitud.

    Retorna estado de cada decision y sus fuentes.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        # Obtener datos de la solicitud
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT data_json FROM solicitudes WHERE id=?",
                (solicitud_id,),
            )
            sol_row = cur.fetchone()
            if not sol_row:
                return error_not_found("Solicitud", solicitud_id)

            data_json = json.loads(sol_row["data_json"] or "{}")
            items = data_json.get("items", [])

        # Obtener todas las decisiones
        decisiones = DecisionAbastecimientoRepository.get_decisiones_solicitud(solicitud_id)

        estados = []
        for decision in decisiones:
            item_idx = decision.get("item_index", 0)
            item = items[item_idx] if item_idx < len(items) else {}

            fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

            estados.append(
                {
                    "decision_id": decision["id"],
                    "item_index": item_idx,
                    "codigo_material": item.get("codigo") or item.get("codigo_material", ""),
                    "descripcion": item.get("descripcion", ""),
                    "estado": decision.get("estado", "pendiente"),
                    "cantidad_solicitada": decision.get("cantidad_solicitada", 0),
                    "cantidad_asignada": decision.get("cantidad_asignada", 0),
                    "fuentes": fuentes,
                    "updated_at": decision.get("updated_at"),
                }
            )

        # Resumen de estados
        resumen = {
            "solicitud_id": solicitud_id,
            "total_items": len(estados),
            "estados": {
                "pendiente": len([e for e in estados if e["estado"] == "pendiente"]),
                "transferencia_solicitada": len(
                    [e for e in estados if e["estado"] == "transferencia_solicitada"]
                ),
                "esperando_confirmacion": len(
                    [e for e in estados if e["estado"] == "esperando_confirmacion"]
                ),
                "confirmado": len([e for e in estados if e["estado"] == "confirmado"]),
                "rechazado": len([e for e in estados if e["estado"] == "rechazado"]),
                "solped_pendiente": len([e for e in estados if e["estado"] == "solped_pendiente"]),
            },
            "items": estados,
        }

        return jsonify({"ok": True, "data": resumen}), 200

    except Exception as e:
        logger.error(f"Error obteniendo estado acciones solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener estado de acciones")
