"""
TMS Routes - Transport Management System
Gestion de envios, rutas, vehiculos, conductores, y costos

Endpoints principales:
- Shipments: CRUD + FSM + tracking
- Consolidations: LTL grouping
- Routes: Ruta planning
- Costs: Tarifas y liquidacion
- KPIs: Dashboard de metricas
"""

import logging
from typing import Any

from flask import Blueprint, g, jsonify, request

from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role

logger = logging.getLogger(__name__)

# Lazy import del service para evitar dependencias circulares
_tms_service = None


def get_tms_service():
    """Obtener instancia del TMS service."""
    global _tms_service
    if _tms_service is None:
        from backend.services import tms_service
        _tms_service = tms_service
    return _tms_service


bp = Blueprint("tms", __name__, url_prefix="/api/tms")


def error_response(code: str, message: str, status: int = 400) -> tuple:
    """Patron de respuesta de error estandar."""
    return jsonify({"ok": False, "error": {"code": code, "message": message}}), status


def success_response(data: Any = None, message: str = None, status: int = 200) -> tuple:
    """Patron de respuesta exitosa estandar."""
    response = {"ok": True}
    if data is not None:
        response["data"] = data
    if message:
        response["message"] = message
    return jsonify(response), status


# ============================================================================
# SHIPMENTS - CRUD + FSM
# ============================================================================

@bp.route("/shipments", methods=["GET"])
@require_auth
def list_shipments():
    """
    Listar envios con paginacion y filtros.
    Query params: page, per_page, estado, created_by, fecha_desde, fecha_hasta, prioridad
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        # Parsear parametros de query
        filters = {
            "page": request.args.get("page", 1, type=int),
            "per_page": request.args.get("per_page", 20, type=int),
            "estado": request.args.get("estado"),
            "created_by": request.args.get("created_by", type=int),
            "fecha_desde": request.args.get("fecha_desde"),
            "fecha_hasta": request.args.get("fecha_hasta"),
            "prioridad": request.args.get("prioridad"),
        }

        result = service.list_shipments(user_id, filters)
        return success_response(result)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error listing shipments: {e}", exc_info=True)
        return error_response("list_error", "Error interno del servidor", 500)


@bp.route("/shipments", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher", "planner", "planificador"])
@rate_limit(30, 60)
def create_shipment():
    """
    Crear un nuevo envio.
    Body: {tipo, prioridad, origen, destino, items: [{material_id, cantidad}], notas}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de envio requeridos")

        # Validaciones basicas
        required_fields = ["tipo", "origen", "destino", "items"]
        for field in required_fields:
            if field not in data:
                return error_response("missing_field", f"Campo requerido: {field}")

        if not data["items"] or len(data["items"]) == 0:
            return error_response("no_items", "El envio debe tener al menos un item")

        shipment = service.create_shipment(user_id, data)
        return success_response(shipment, "Envio creado exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error creating shipment: {e}", exc_info=True)
        return error_response("create_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>", methods=["GET"])
@require_auth
def get_shipment(shipment_id: int):
    """Obtener detalle de un envio con items y tracking."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        shipment = service.get_shipment(shipment_id, user_id)
        if not shipment:
            return error_response("not_found", "Envio no encontrado", 404)

        return success_response(shipment)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting shipment {shipment_id}: {e}", exc_info=True)
        return error_response("get_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>", methods=["PUT"])
@require_auth
@require_role(["admin", "dispatcher", "planner", "planificador"])
@rate_limit(30, 60)
def update_shipment(shipment_id: int):
    """
    Actualizar un envio (solo si esta en estado draft/confirmed).
    Body: {tipo, prioridad, origen, destino, notas}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de actualizacion requeridos")

        updated = service.update_shipment(shipment_id, user_id, data)
        if not updated:
            return error_response("update_failed", "No se pudo actualizar el envio o estado invalido", 400)

        return success_response(updated, "Envio actualizado exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error updating shipment {shipment_id}: {e}", exc_info=True)
        return error_response("update_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/transition", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher", "driver"])
@rate_limit(30, 60)
def transition_shipment(shipment_id: int):
    """
    Transicionar estado de un envio.
    Body: {estado, razon (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data or "estado" not in data:
            return error_response("missing_data", "Estado objetivo requerido")

        nuevo_estado = data.get("estado")
        razon = data.get("razon", "")

        result = service.transition_shipment(shipment_id, nuevo_estado, user_id, razon)
        if not result.get("ok"):
            return error_response("transition_failed", result.get("error", "Transicion invalida"), 400)

        return success_response(result, "Estado actualizado exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error transitioning shipment {shipment_id}: {e}", exc_info=True)
        return error_response("transition_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/assign", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def assign_shipment(shipment_id: int):
    """
    Asignar vehiculo, conductor y ruta a un envio.
    Body: {vehicle_id, driver_id, route_id (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de asignacion requeridos")

        if "vehicle_id" not in data or "driver_id" not in data:
            return error_response("missing_field", "vehicle_id y driver_id son requeridos")

        result = service.assign_shipment(
            shipment_id,
            data.get("vehicle_id"),
            data.get("driver_id"),
            data.get("route_id"),
            user_id
        )

        if not result:
            return error_response("assign_failed", "No se pudo asignar el envio", 400)

        return success_response(result, "Envio asignado exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error assigning shipment {shipment_id}: {e}", exc_info=True)
        return error_response("assign_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/deliver", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher", "driver"])
@rate_limit(30, 60)
def deliver_shipment(shipment_id: int):
    """
    Confirmar entrega de un envio.
    Body: {receptor_nombre, notas_entrega (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data or "receptor_nombre" not in data:
            return error_response("missing_data", "Nombre del receptor requerido")

        result = service.deliver_shipment(
            shipment_id,
            data.get("receptor_nombre"),
            data.get("notas_entrega", ""),
            user_id
        )

        if not result:
            return error_response("deliver_failed", "No se pudo confirmar la entrega", 400)

        return success_response(result, "Entrega confirmada exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error delivering shipment {shipment_id}: {e}", exc_info=True)
        return error_response("deliver_error", "Error interno del servidor", 500)


# ============================================================================
# TRACKING
# ============================================================================

@bp.route("/shipments/<int:shipment_id>/tracking", methods=["GET"])
@require_auth
def get_tracking(shipment_id: int):
    """Obtener eventos de tracking para un envio."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        tracking = service.get_tracking(shipment_id, user_id)
        return success_response(tracking)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting tracking for shipment {shipment_id}: {e}", exc_info=True)
        return error_response("tracking_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/tracking", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher", "driver"])
@rate_limit(60, 60)
def register_tracking(shipment_id: int):
    """
    Registrar evento de tracking (para conductores).
    Body: {tipo_evento, latitud (opcional), longitud (opcional), notas (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data or "tipo_evento" not in data:
            return error_response("missing_data", "Tipo de evento requerido")

        event = service.register_tracking(shipment_id, user_id, data)
        return success_response(event, "Evento registrado exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error registering tracking for shipment {shipment_id}: {e}", exc_info=True)
        return error_response("tracking_error", "Error interno del servidor", 500)


@bp.route("/tracking/in-transit", methods=["GET"])
@require_auth
@require_role(["admin", "dispatcher"])
def get_in_transit_shipments():
    """Obtener todos los envios en transito con ultima ubicacion conocida."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        shipments = service.get_in_transit_shipments(user_id)
        return success_response(shipments)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting in-transit shipments: {e}", exc_info=True)
        return error_response("transit_error", "Error interno del servidor", 500)


# ============================================================================
# CONSOLIDATION (LTL)
# ============================================================================

@bp.route("/consolidations", methods=["GET"])
@require_auth
@require_role(["admin", "dispatcher", "planner", "planificador"])
def list_consolidations():
    """Listar consolidaciones con paginacion."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        filters = {
            "page": request.args.get("page", 1, type=int),
            "per_page": request.args.get("per_page", 20, type=int),
            "estado": request.args.get("estado"),
        }

        result = service.list_consolidations(user_id, filters)
        return success_response(result)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error listing consolidations: {e}", exc_info=True)
        return error_response("list_error", "Error interno del servidor", 500)


@bp.route("/consolidations", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def create_consolidation():
    """
    Crear una nueva consolidacion.
    Body: {nombre, destino, fecha_salida_estimada, shipment_ids: [int]}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de consolidacion requeridos")

        required_fields = ["nombre", "destino"]
        for field in required_fields:
            if field not in data:
                return error_response("missing_field", f"Campo requerido: {field}")

        consolidation = service.create_consolidation(user_id, data)
        return success_response(consolidation, "Consolidacion creada exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error creating consolidation: {e}", exc_info=True)
        return error_response("create_error", "Error interno del servidor", 500)


@bp.route("/consolidations/suggest", methods=["GET"])
@require_auth
@require_role(["admin", "dispatcher"])
def suggest_consolidations():
    """
    Obtener sugerencias de consolidacion automatica basadas en destino y fecha.
    Query params: destino (opcional), max_suggestions (default 10)
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        destino = request.args.get("destino")
        max_suggestions = request.args.get("max_suggestions", 10, type=int)

        suggestions = service.suggest_consolidations(user_id, destino, max_suggestions)
        return success_response(suggestions)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error suggesting consolidations: {e}", exc_info=True)
        return error_response("suggest_error", "Error interno del servidor", 500)


@bp.route("/consolidations/<int:consolidation_id>/add-shipment", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def add_shipment_to_consolidation(consolidation_id: int):
    """
    Agregar envio a una consolidacion.
    Body: {shipment_id}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data or "shipment_id" not in data:
            return error_response("missing_data", "shipment_id requerido")

        result = service.add_shipment_to_consolidation(
            consolidation_id,
            data.get("shipment_id"),
            user_id
        )

        if not result:
            return error_response("add_failed", "No se pudo agregar envio a consolidacion", 400)

        return success_response(result, "Envio agregado exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error adding shipment to consolidation {consolidation_id}: {e}", exc_info=True)
        return error_response("add_error", "Error interno del servidor", 500)


@bp.route("/consolidations/<int:consolidation_id>/remove-shipment", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def remove_shipment_from_consolidation(consolidation_id: int):
    """
    Remover envio de una consolidacion.
    Body: {shipment_id}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data or "shipment_id" not in data:
            return error_response("missing_data", "shipment_id requerido")

        result = service.remove_shipment_from_consolidation(
            consolidation_id,
            data.get("shipment_id"),
            user_id
        )

        if not result:
            return error_response("remove_failed", "No se pudo remover envio de consolidacion", 400)

        return success_response(result, "Envio removido exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error removing shipment from consolidation {consolidation_id}: {e}", exc_info=True)
        return error_response("remove_error", "Error interno del servidor", 500)


# ============================================================================
# ROUTES
# ============================================================================

@bp.route("/routes", methods=["GET"])
@require_auth
def list_routes():
    """Listar rutas con paginacion."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        filters = {
            "page": request.args.get("page", 1, type=int),
            "per_page": request.args.get("per_page", 20, type=int),
            "activo": request.args.get("activo", type=bool),
        }

        result = service.list_routes(user_id, filters)
        return success_response(result)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error listing routes: {e}", exc_info=True)
        return error_response("list_error", "Error interno del servidor", 500)


@bp.route("/routes", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def create_route():
    """
    Crear una nueva ruta.
    Body: {nombre, origen, destino, waypoints: [{orden, ubicacion, tipo}], distancia_km, tiempo_estimado_hrs}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de ruta requeridos")

        required_fields = ["nombre", "origen", "destino"]
        for field in required_fields:
            if field not in data:
                return error_response("missing_field", f"Campo requerido: {field}")

        route = service.create_route(user_id, data)
        return success_response(route, "Ruta creada exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error creating route: {e}", exc_info=True)
        return error_response("create_error", "Error interno del servidor", 500)


@bp.route("/routes/<int:route_id>", methods=["GET"])
@require_auth
def get_route(route_id: int):
    """Obtener detalle de una ruta con waypoints."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        route = service.get_route(route_id, user_id)
        if not route:
            return error_response("not_found", "Ruta no encontrada", 404)

        return success_response(route)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting route {route_id}: {e}", exc_info=True)
        return error_response("get_error", "Error interno del servidor", 500)


@bp.route("/routes/<int:route_id>", methods=["PUT"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def update_route(route_id: int):
    """
    Actualizar una ruta.
    Body: {nombre, distancia_km, tiempo_estimado_hrs, activo}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de actualizacion requeridos")

        updated = service.update_route(route_id, user_id, data)
        if not updated:
            return error_response("update_failed", "No se pudo actualizar la ruta", 400)

        return success_response(updated, "Ruta actualizada exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error updating route {route_id}: {e}", exc_info=True)
        return error_response("update_error", "Error interno del servidor", 500)


# ============================================================================
# COSTS & TARIFFS
# ============================================================================

@bp.route("/shipments/<int:shipment_id>/costs", methods=["GET"])
@require_auth
def get_shipment_costs(shipment_id: int):
    """Obtener costos para un envio."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        costs = service.get_shipment_costs(shipment_id, user_id)
        return success_response(costs)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting costs for shipment {shipment_id}: {e}", exc_info=True)
        return error_response("cost_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/costs", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def register_cost(shipment_id: int):
    """
    Registrar un costo para un envio.
    Body: {tipo_costo, monto, moneda, descripcion (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de costo requeridos")

        required_fields = ["tipo_costo", "monto", "moneda"]
        for field in required_fields:
            if field not in data:
                return error_response("missing_field", f"Campo requerido: {field}")

        cost = service.register_cost(shipment_id, user_id, data)
        return success_response(cost, "Costo registrado exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error registering cost for shipment {shipment_id}: {e}", exc_info=True)
        return error_response("cost_error", "Error interno del servidor", 500)


@bp.route("/tariffs", methods=["GET"])
@require_auth
def list_tariffs():
    """Listar reglas de tarifas."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        filters = {
            "page": request.args.get("page", 1, type=int),
            "per_page": request.args.get("per_page", 20, type=int),
            "activo": request.args.get("activo", type=bool),
        }

        result = service.list_tariffs(user_id, filters)
        return success_response(result)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error listing tariffs: {e}", exc_info=True)
        return error_response("list_error", "Error interno del servidor", 500)


@bp.route("/tariffs", methods=["POST"])
@require_auth
@require_role(["admin"])
@rate_limit(30, 60)
def create_tariff():
    """
    Crear una regla de tarifa.
    Body: {nombre, tipo, origen, destino, tarifa_base, tarifa_por_km, tarifa_por_kg, moneda}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de tarifa requeridos")

        required_fields = ["nombre", "tipo", "tarifa_base", "moneda"]
        for field in required_fields:
            if field not in data:
                return error_response("missing_field", f"Campo requerido: {field}")

        tariff = service.create_tariff(user_id, data)
        return success_response(tariff, "Tarifa creada exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error creating tariff: {e}", exc_info=True)
        return error_response("create_error", "Error interno del servidor", 500)


@bp.route("/tariffs/<int:tariff_id>", methods=["PUT"])
@require_auth
@require_role(["admin"])
@rate_limit(30, 60)
def update_tariff(tariff_id: int):
    """Actualizar una regla de tarifa."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de actualizacion requeridos")

        updated = service.update_tariff(tariff_id, user_id, data)
        if not updated:
            return error_response("update_failed", "No se pudo actualizar la tarifa", 400)

        return success_response(updated, "Tarifa actualizada exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error updating tariff {tariff_id}: {e}", exc_info=True)
        return error_response("update_error", "Error interno del servidor", 500)


# ============================================================================
# FINANCIAL SETTLEMENT
# ============================================================================

@bp.route("/settlements", methods=["GET"])
@require_auth
@require_role(["admin", "dispatcher"])
def list_settlements():
    """Listar liquidaciones con paginacion."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        filters = {
            "page": request.args.get("page", 1, type=int),
            "per_page": request.args.get("per_page", 20, type=int),
            "fecha_desde": request.args.get("fecha_desde"),
            "fecha_hasta": request.args.get("fecha_hasta"),
        }

        result = service.list_settlements(user_id, filters)
        return success_response(result)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error listing settlements: {e}", exc_info=True)
        return error_response("list_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/settle", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher"])
@rate_limit(30, 60)
def settle_shipment(shipment_id: int):
    """
    Crear liquidacion para un envio (cerrar viaje financieramente).
    Body: {notas (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json() or {}
        notas = data.get("notas", "")

        settlement = service.settle_shipment(shipment_id, user_id, notas)
        if not settlement:
            return error_response("settle_failed", "No se pudo crear liquidacion", 400)

        return success_response(settlement, "Liquidacion creada exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error settling shipment {shipment_id}: {e}", exc_info=True)
        return error_response("settle_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/settlement", methods=["GET"])
@require_auth
def get_settlement(shipment_id: int):
    """Obtener liquidacion de un envio."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        settlement = service.get_settlement(shipment_id, user_id)
        if not settlement:
            return error_response("not_found", "Liquidacion no encontrada", 404)

        return success_response(settlement)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting settlement for shipment {shipment_id}: {e}", exc_info=True)
        return error_response("settlement_error", "Error interno del servidor", 500)


@bp.route("/shipments/<int:shipment_id>/calculate-freight", methods=["GET"])
@require_auth
def calculate_freight(shipment_id: int):
    """Calcular estimado de flete para un envio."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        estimate = service.calculate_freight(shipment_id, user_id)
        return success_response(estimate)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error calculating freight for shipment {shipment_id}: {e}", exc_info=True)
        return error_response("calculation_error", "Error interno del servidor", 500)


# ============================================================================
# FUEL
# ============================================================================

@bp.route("/fuel", methods=["POST"])
@require_auth
@require_role(["admin", "dispatcher", "driver"])
@rate_limit(30, 60)
def register_fuel():
    """
    Registrar carga de combustible.
    Body: {vehicle_id, litros, costo_total, moneda, odometro (opcional), ubicacion (opcional)}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data:
            return error_response("missing_data", "Datos de combustible requeridos")

        required_fields = ["vehicle_id", "litros", "costo_total", "moneda"]
        for field in required_fields:
            if field not in data:
                return error_response("missing_field", f"Campo requerido: {field}")

        fuel_record = service.register_fuel(user_id, data)
        return success_response(fuel_record, "Combustible registrado exitosamente", status=201)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error registering fuel: {e}", exc_info=True)
        return error_response("fuel_error", "Error interno del servidor", 500)


# ============================================================================
# CONFIG & KPIs
# ============================================================================

@bp.route("/config", methods=["GET"])
@require_auth
def get_config():
    """Obtener configuracion TMS."""
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        config = service.get_config(user_id)
        return success_response(config)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting config: {e}", exc_info=True)
        return error_response("config_error", "Error interno del servidor", 500)


@bp.route("/config/<config_key>", methods=["PUT"])
@require_auth
@require_role(["admin"])
@rate_limit(30, 60)
def update_config(config_key: str):
    """
    Actualizar valor de configuracion.
    Body: {value}
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        data = request.get_json()
        if not data or "value" not in data:
            return error_response("missing_data", "Valor requerido")

        updated = service.update_config(config_key, data.get("value"), user_id)
        if not updated:
            return error_response("update_failed", "No se pudo actualizar configuracion", 400)

        return success_response(updated, "Configuracion actualizada exitosamente")

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error updating config {config_key}: {e}", exc_info=True)
        return error_response("config_error", "Error interno del servidor", 500)


@bp.route("/kpis", methods=["GET"])
@require_auth
@require_role(["admin", "dispatcher", "planner", "planificador"])
def get_kpis():
    """
    Obtener dashboard de KPIs TMS.
    Query params: fecha_desde, fecha_hasta
    """
    try:
        service = get_tms_service()
        user_id = g.user.get("id_spm")

        filters = {
            "fecha_desde": request.args.get("fecha_desde"),
            "fecha_hasta": request.args.get("fecha_hasta"),
        }

        kpis = service.get_kpis(user_id, filters)
        return success_response(kpis)

    except (KeyError, ValueError, TypeError):
        return error_response("validation_error", "Datos de entrada inválidos", 400)
    except Exception as e:
        logger.error(f"[TMS] Error getting KPIs: {e}", exc_info=True)
        return error_response("kpi_error", "Error interno del servidor", 500)
