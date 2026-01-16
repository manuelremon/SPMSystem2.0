"""
Planner - Decisiones de Abastecimiento

Endpoints para Pasos 2-3 del wizard:
- Opciones de abastecimiento por item
- Guardar tratamiento completo
- Decision multi-fuente
- Resumen de decisiones
- Detalle MRP
"""

import json
import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.errors import error_internal, error_not_found, error_validation
from backend.core.repository import (
    DecisionAbastecimientoRepository,
    MrpRepository,
)
from backend.core.roles import require_auth
from backend.routes.planner_helpers import (
    _require_solicitud_access,
    _stock_disponible,
)
from backend.routes.planner.helpers import _log_evento
from backend.services.planner_service import (
    guardar_decision_multifuente,
    obtener_resumen_decisiones,
    paso_2_opciones_abastecimiento,
    paso_3_guardar_tratamiento,
)

logger = logging.getLogger(__name__)

decisiones_bp = Blueprint("decisiones", __name__)


@decisiones_bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/opciones-abastecimiento", methods=["GET"]
)
@require_auth
def obtener_opciones_abastecimiento(solicitud_id, item_idx):
    """
    PASO 2: Obtener opciones de abastecimiento para un item.

    Delega a paso_2_opciones_abastecimiento() en el servicio.
    Retorna lista de opciones (stock, proveedores, equivalencias, mix).
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        resultado = paso_2_opciones_abastecimiento(solicitud_id, item_idx)
        return jsonify({"ok": True, "data": resultado}), 200
    except ValueError as e:
        logger.warning(f"Validacion opciones item {item_idx} solicitud {solicitud_id}: {e}")
        return error_validation("item_idx", "Item no valido o fuera de rango")
    except Exception as e:
        logger.error(f"Error obteniendo opciones item {item_idx} solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener opciones de abastecimiento")


@decisiones_bp.route("/solicitudes/<int:solicitud_id>/guardar-tratamiento", methods=["POST"])
@require_auth
def guardar_tratamiento(solicitud_id):
    """
    PASO 3: Guardar decisiones de tratamiento para toda la solicitud.

    Delega a paso_3_guardar_tratamiento() en el servicio.
    Persiste decisiones en BD, actualiza status de solicitud, registra evento.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        data = request.get_json(silent=True) or {}
        decisiones = data.get("decisiones", [])
        usuario_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "sistema")

        if not decisiones:
            return error_validation(
                "decisiones", "Se requieren decisiones para guardar el tratamiento"
            )

        resultado = paso_3_guardar_tratamiento(solicitud_id, decisiones, usuario_id)
        return jsonify({"ok": True, "data": resultado}), 200

    except ValueError as e:
        logger.warning(f"Validacion decisiones solicitud {solicitud_id}: {e}")
        return error_validation("decisiones", "Datos de decisiones no validos")
    except Exception as e:
        logger.error(f"Error guardando tratamiento solicitud {solicitud_id}: {e}")
        return error_internal("Error al guardar el tratamiento")


@decisiones_bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/decision-multifuente",
    methods=["POST"],
)
@require_auth
def guardar_decision_multifuente_endpoint(solicitud_id, item_idx):
    """
    Guarda decision multi-fuente para un item.

    Body JSON esperado:
    {
        "cantidad_solicitada": 100,
        "fuentes": [
            {
                "tipo_fuente": "stock",
                "centro_origen": "1008",
                "almacen_origen": "0100",
                "cantidad_asignada": 50,
                "precio_unitario": 10.5,
                "notas": "Stock local"
            },
            {
                "tipo_fuente": "proveedor",
                "cuit_proveedor": "30-12345678-9",
                "proveedor_nombre": "Proveedor ABC",
                "cantidad_asignada": 50,
                "precio_unitario": 12.0,
                "plazo_dias": 15,
                "precio_es_negociado": true
            }
        ],
        "comentario": "Decision dividida entre stock y proveedor"
    }
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        data = request.get_json(silent=True) or {}
        cantidad_solicitada = data.get("cantidad_solicitada", 0)
        fuentes = data.get("fuentes", [])
        comentario = data.get("comentario", "")
        planner_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

        if not fuentes:
            return error_validation("fuentes", "Se requiere al menos una fuente de abastecimiento")

        # Validar que la suma de cantidades coincida
        total_asignado = sum(f.get("cantidad_asignada", 0) for f in fuentes)
        if total_asignado <= 0:
            return error_validation(
                "cantidad_asignada", "La cantidad total asignada debe ser mayor a 0"
            )

        resultado = guardar_decision_multifuente(
            solicitud_id=solicitud_id,
            item_idx=item_idx,
            cantidad_solicitada=cantidad_solicitada,
            fuentes=fuentes,
            planner_id=planner_id,
            comentario=comentario,
        )

        # Registrar evento
        _log_evento(
            solicitud_id,
            item_idx,
            "decision_multifuente",
            resultado.get("estado", "pendiente"),
            {"fuentes": len(fuentes), "total_asignado": total_asignado},
            actor=planner_id,
        )

        return jsonify({"ok": True, "data": resultado}), 200

    except ValueError as e:
        logger.warning(f"Validacion fuentes item {item_idx} solicitud {solicitud_id}: {e}")
        return error_validation("fuentes", "Datos de fuentes no validos")
    except Exception as e:
        logger.error(
            f"Error guardando decision multifuente item {item_idx} solicitud {solicitud_id}: {e}"
        )
        return error_internal("Error al guardar la decision")


@decisiones_bp.route("/solicitudes/<int:solicitud_id>/decisiones-resumen", methods=["GET"])
@require_auth
def obtener_resumen_decisiones_endpoint(solicitud_id):
    """
    Obtiene resumen de todas las decisiones multi-fuente de una solicitud.

    Retorna:
    {
        "solicitud_id": 123,
        "total_items": 5,
        "items_completos": 3,
        "items_parciales": 1,
        "items_pendientes": 1,
        "decisiones": [
            {
                "item_index": 0,
                "estado": "completo",
                "cantidad_solicitada": 100,
                "cantidad_asignada": 100,
                "fuentes": [...]
            },
            ...
        ]
    }
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        resultado = obtener_resumen_decisiones(solicitud_id)
        return jsonify({"ok": True, "data": resultado}), 200
    except Exception as e:
        logger.error(f"Error obteniendo resumen decisiones solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener resumen de decisiones")


@decisiones_bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/decision",
    methods=["GET"],
)
@require_auth
def obtener_decision_item(solicitud_id, item_idx):
    """
    Obtiene la decision guardada para un item especifico.
    Incluye todas las fuentes seleccionadas con sus cantidades.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        decision = DecisionAbastecimientoRepository.get_decision(solicitud_id, item_idx)

        if not decision:
            return (
                jsonify(
                    {"ok": True, "data": None, "mensaje": "No hay decision guardada para este item"}
                ),
                200,
            )

        # Obtener fuentes de la decision
        fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

        resultado = {
            **decision,
            "fuentes": fuentes,
        }

        return jsonify({"ok": True, "data": resultado}), 200

    except Exception as e:
        logger.error(f"Error obteniendo decision item {item_idx} solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener decision del item")


@decisiones_bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/mrp",
    methods=["GET"],
)
@require_auth
def obtener_detalle_mrp(solicitud_id, item_idx):
    """
    Obtiene detalle completo de parametros MRP para un item.

    Retorna informacion de:
    - Punto de pedido
    - Stock de seguridad
    - Stock maximo
    - Lote de pedido
    - Pedidos en curso
    - Consumo historico
    - Alertas activas
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        # Obtener la solicitud para conseguir centro y codigo material
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT centro, data_json FROM solicitudes WHERE id=?",
                (solicitud_id,),
            )
            row = cur.fetchone()
            if not row:
                return error_not_found("Solicitud", solicitud_id)

            centro = row["centro"]
            data_json = json.loads(row["data_json"] or "{}")
            items = data_json.get("items", [])

            if item_idx < 0 or item_idx >= len(items):
                return error_validation("item_idx", f"Item {item_idx} no existe en la solicitud")

            item = items[item_idx]
            codigo_material = item.get("codigo") or item.get("codigo_material", "")

        # Obtener parametros MRP desde sap_data.db
        mrp_params = MrpRepository.get_parametros_mrp(codigo_material, centro)
        pedidos = MrpRepository.get_pedidos_en_curso(codigo_material, centro)
        consumo = MrpRepository.get_consumo_historico(codigo_material, centro, meses=12)

        # Calcular alertas
        alertas = []
        if mrp_params:
            stock_actual = _stock_disponible(codigo_material, centro)
            punto_pedido = mrp_params.get("punto_pedido", 0)
            stock_seguridad = mrp_params.get("stock_seguridad", 0)

            if stock_actual < punto_pedido:
                alertas.append(
                    {
                        "tipo": "bajo_punto_pedido",
                        "severidad": "warning",
                        "mensaje": f"Stock ({stock_actual}) bajo punto de pedido ({punto_pedido})",
                    }
                )
            if stock_actual < stock_seguridad:
                alertas.append(
                    {
                        "tipo": "bajo_stock_seguridad",
                        "severidad": "critical",
                        "mensaje": f"Stock ({stock_actual}) bajo stock de seguridad ({stock_seguridad})",
                    }
                )

        resultado = {
            "codigo_material": codigo_material,
            "centro": centro,
            "parametros_mrp": mrp_params or {},
            "pedidos_en_curso": pedidos,
            "consumo_historico": consumo,
            "alertas": alertas,
            "planificado_mrp": bool(mrp_params),
        }

        return jsonify({"ok": True, "data": resultado}), 200

    except Exception as e:
        logger.error(f"Error obteniendo detalle MRP item {item_idx} solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener informacion MRP")
