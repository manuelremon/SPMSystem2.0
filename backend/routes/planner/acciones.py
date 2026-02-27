"""
Planner - Acciones Post-Tratamiento (Paso 4)

Endpoints para ejecutar y gestionar acciones despues del tratamiento:
- Ejecutar acciones (traspasos, consultas, SOLPEDs)
- Estado de acciones por solicitud
"""

import json
import logging
import traceback

from flask import jsonify, request

from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.errors import error_internal, error_not_found
from backend.core.repository import DecisionAbastecimientoRepository
from backend.core.roles import require_auth
from backend.routes.planner import bp
from backend.routes.planner.helpers import (
    _actualizar_estado_decision,
    _enviar_consulta_stock,
    _get_responsable_almacen,
    _log_evento,
)
from backend.routes.planner_helpers import _require_solicitud_access

logger = logging.getLogger(__name__)


@bp.route("/solicitudes/<int:solicitud_id>/ejecutar-acciones", methods=["POST"])
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
        ph = "%s" if is_using_postgresql() else "?"
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT centro, id_usuario, data_json FROM solicitud WHERE id={ph}",
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
            codigo_material = (
                item.get("material") or item.get("codigo") or item.get("codigo_material", "")
            )
            descripcion = item.get("descripcion", "")

            # Obtener fuentes de esta decision
            fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

            for fuente in fuentes:
                tipo_fuente = fuente.get("tipo_fuente") or ""
                centro_origen = fuente.get("centro_origen") or ""
                almacen_origen = fuente.get("almacen_origen") or ""
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
                        accion["destinatario"] = (
                            f"Responsable/Referente {centro_origen}/{almacen_origen}"
                        )
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
                        accion["destinatario"] = (
                            f"Almacen {centro_origen or centro_solicitud}/{almacen_origen or '0001'}"
                        )
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
                [
                    a
                    for a in acciones_ejecutadas
                    if a["estado"] == "transferencia_solicitada" and not a.get("es_equivalencia")
                ]
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


@bp.route("/solicitudes/<int:solicitud_id>/estado-acciones", methods=["GET"])
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
        ph = "%s" if is_using_postgresql() else "?"
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT data_json FROM solicitud WHERE id={ph}",
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
                    "codigo_material": (
                        item.get("material")
                        or item.get("codigo")
                        or item.get("codigo_material", "")
                    ),
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
                "solped_pendiente": len(
                    [e for e in estados if e["estado"] == "solped_pendiente"]
                ),
            },
            "items": estados,
        }

        return jsonify({"ok": True, "data": resumen}), 200

    except Exception as e:
        logger.error(f"Error obteniendo estado acciones solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener estado de acciones")
