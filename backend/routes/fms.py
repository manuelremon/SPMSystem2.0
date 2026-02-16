"""
Fleet Management System (FMS) Routes
Gestión completa de flotas: vehículos, conductores, órdenes de trabajo, mantenimiento, inspecciones
"""

import logging

from flask import Blueprint, g, jsonify, request

from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role
from backend.services import fms_service

logger = logging.getLogger(__name__)

bp = Blueprint("fms", __name__, url_prefix="/api/fms")


# ============================================================================
# VEHICLES
# ============================================================================

@bp.route("/vehicles", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def list_vehicles():
    """Lista vehículos con filtros opcionales"""
    try:
        filters = {
            "estado": request.args.get("estado"),
            "tipo": request.args.get("tipo"),
            "activo": request.args.get("activo"),
        }

        vehicles = fms_service.list_vehicles(filters)
        return jsonify({"ok": True, "data": vehicles})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in list_vehicles: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "list_vehicles_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def create_vehicle():
    """Crea un nuevo vehículo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        vehicle = fms_service.create_vehicle(data, user_id)
        return jsonify({"ok": True, "data": vehicle}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in create_vehicle: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "create_vehicle_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles/<int:vehicle_id>", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_vehicle(vehicle_id):
    """Obtiene detalle de vehículo con documentos y planes de mantenimiento"""
    try:
        vehicle = fms_service.get_vehicle_detail(vehicle_id)

        if not vehicle:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Vehicle {vehicle_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": vehicle})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_vehicle: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_vehicle_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles/<int:vehicle_id>", methods=["PUT"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def update_vehicle(vehicle_id):
    """Actualiza un vehículo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        vehicle = fms_service.update_vehicle(vehicle_id, data, user_id)

        if not vehicle:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Vehicle {vehicle_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": vehicle})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in update_vehicle: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "update_vehicle_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles/<int:vehicle_id>/status", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def change_vehicle_status(vehicle_id):
    """Cambia el estado de un vehículo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data or "estado" not in data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "Estado required"}
            }), 400

        vehicle = fms_service.change_vehicle_status(vehicle_id, data["estado"], user_id)

        if not vehicle:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Vehicle {vehicle_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": vehicle})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in change_vehicle_status: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "change_status_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles/available", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_available_vehicles():
    """Obtiene vehículos disponibles con filtros opcionales de capacidad"""
    try:
        filters = {
            "min_capacidad_kg": request.args.get("min_capacidad_kg", type=float),
            "min_capacidad_m3": request.args.get("min_capacidad_m3", type=float),
        }

        vehicles = fms_service.get_available_vehicles(filters)
        return jsonify({"ok": True, "data": vehicles})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_available_vehicles: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_available_vehicles_failed", "message": "Error interno del servidor"}
        }), 500


# ============================================================================
# DRIVERS
# ============================================================================

@bp.route("/drivers", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def list_drivers():
    """Lista conductores con filtros opcionales"""
    try:
        filters = {
            "activo": request.args.get("activo"),
        }

        drivers = fms_service.list_drivers(filters)
        return jsonify({"ok": True, "data": drivers})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in list_drivers: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "list_drivers_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/drivers", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def create_driver():
    """Crea un nuevo conductor"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        driver = fms_service.create_driver(data, user_id)
        return jsonify({"ok": True, "data": driver}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in create_driver: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "create_driver_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/drivers/<int:driver_id>", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_driver(driver_id):
    """Obtiene detalle de conductor"""
    try:
        driver = fms_service.get_driver_detail(driver_id)

        if not driver:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Driver {driver_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": driver})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_driver: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_driver_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/drivers/<int:driver_id>", methods=["PUT"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def update_driver(driver_id):
    """Actualiza un conductor"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        driver = fms_service.update_driver(driver_id, data, user_id)

        if not driver:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Driver {driver_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": driver})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in update_driver: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "update_driver_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/drivers/available", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_available_drivers():
    """Obtiene conductores disponibles (activos con licencia y certificado médico vigente)"""
    try:
        drivers = fms_service.get_available_drivers()
        return jsonify({"ok": True, "data": drivers})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_available_drivers: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_available_drivers_failed", "message": "Error interno del servidor"}
        }), 500


# ============================================================================
# WORK ORDERS (Órdenes de Trabajo)
# ============================================================================

@bp.route("/work-orders", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def list_work_orders():
    """Lista órdenes de trabajo con paginación y filtros"""
    try:
        filters = {
            "estado": request.args.get("estado"),
            "tipo": request.args.get("tipo"),
            "vehicle_id": request.args.get("vehicle_id", type=int),
            "prioridad": request.args.get("prioridad"),
            "limit": request.args.get("limit", 50, type=int),
            "offset": request.args.get("offset", 0, type=int),
        }

        result = fms_service.list_work_orders(filters)
        return jsonify({"ok": True, "data": result})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in list_work_orders: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "list_work_orders_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/work-orders", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager", "workshop_chief"])
@rate_limit(30, 60)
def create_work_order():
    """Crea una nueva orden de trabajo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        work_order = fms_service.create_work_order(data, user_id)
        return jsonify({"ok": True, "data": work_order}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in create_work_order: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "create_work_order_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/work-orders/<int:order_id>", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_work_order(order_id):
    """Obtiene detalle de orden de trabajo con repuestos"""
    try:
        work_order = fms_service.get_work_order_detail(order_id)

        if not work_order:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Work order {order_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": work_order})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_work_order: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_work_order_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/work-orders/<int:order_id>/transition", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager", "workshop_chief"])
@rate_limit(30, 60)
def transition_work_order(order_id):
    """Transición de estado de orden de trabajo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data or "estado" not in data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "Estado required"}
            }), 400

        work_order = fms_service.transition_work_order(order_id, data["estado"], data.get("datos", {}), user_id)

        if not work_order:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Work order {order_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": work_order})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in transition_work_order: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "transition_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/work-orders/<int:order_id>/parts", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager", "workshop_chief"])
@rate_limit(30, 60)
def add_part_to_work_order(order_id):
    """Agrega un repuesto a la orden de trabajo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        part = fms_service.add_part_to_work_order(order_id, data, user_id)
        return jsonify({"ok": True, "data": part}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in add_part_to_work_order: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "add_part_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/work-orders/<int:order_id>/request-part", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager", "workshop_chief"])
@rate_limit(30, 60)
def request_part_from_spm(order_id):
    """Solicita un repuesto desde SPM (crea solicitud)"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        result = fms_service.request_part_from_spm(order_id, data, user_id)
        return jsonify({"ok": True, "data": result}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in request_part_from_spm: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "request_part_failed", "message": "Error interno del servidor"}
        }), 500


# ============================================================================
# MAINTENANCE (Mantenimiento)
# ============================================================================

@bp.route("/vehicles/<int:vehicle_id>/maintenance-plans", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def list_maintenance_plans(vehicle_id):
    """Lista planes de mantenimiento de un vehículo"""
    try:
        plans = fms_service.list_maintenance_plans(vehicle_id)
        return jsonify({"ok": True, "data": plans})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in list_maintenance_plans: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "list_maintenance_plans_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles/<int:vehicle_id>/maintenance-plans", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def create_maintenance_plan(vehicle_id):
    """Crea un plan de mantenimiento para un vehículo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        plan = fms_service.create_maintenance_plan(vehicle_id, data, user_id)
        return jsonify({"ok": True, "data": plan}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in create_maintenance_plan: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "create_maintenance_plan_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/maintenance-plans/<int:plan_id>", methods=["PUT"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def update_maintenance_plan(plan_id):
    """Actualiza un plan de mantenimiento"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        plan = fms_service.update_maintenance_plan(plan_id, data, user_id)

        if not plan:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Maintenance plan {plan_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": plan})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in update_maintenance_plan: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "update_maintenance_plan_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/maintenance/evaluate", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(10, 60)
def evaluate_preventive_maintenance():
    """Evalúa mantenimiento preventivo para todos los vehículos"""
    try:
        user_id = g.user.get("id_spm")
        result = fms_service.evaluate_preventive_maintenance(user_id)
        return jsonify({"ok": True, "data": result})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in evaluate_preventive_maintenance: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "evaluate_maintenance_failed", "message": "Error interno del servidor"}
        }), 500


# ============================================================================
# INSPECTIONS (Inspecciones)
# ============================================================================

@bp.route("/inspections", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def list_inspections():
    """Lista inspecciones con filtros opcionales"""
    try:
        filters = {
            "tipo": request.args.get("tipo"),
            "vehicle_id": request.args.get("vehicle_id", type=int),
            "driver_id": request.args.get("driver_id", type=int),
        }

        inspections = fms_service.list_inspections(filters)
        return jsonify({"ok": True, "data": inspections})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in list_inspections: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "list_inspections_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/inspections", methods=["POST"])
@require_auth
@rate_limit(50, 60)
def create_inspection():
    """Crea una nueva inspección (pre/post viaje)"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        inspection = fms_service.create_inspection(data, user_id)
        return jsonify({"ok": True, "data": inspection}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in create_inspection: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "create_inspection_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/inspections/<int:inspection_id>", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_inspection(inspection_id):
    """Obtiene detalle de inspección con items"""
    try:
        inspection = fms_service.get_inspection_detail(inspection_id)

        if not inspection:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Inspection {inspection_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": inspection})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_inspection: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_inspection_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/inspections/<int:inspection_id>/complete", methods=["POST"])
@require_auth
@rate_limit(50, 60)
def complete_inspection(inspection_id):
    """Completa una inspección con resultados de items"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        inspection = fms_service.complete_inspection(inspection_id, data, user_id)

        if not inspection:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": f"Inspection {inspection_id} not found"}
            }), 404

        return jsonify({"ok": True, "data": inspection})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in complete_inspection: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "complete_inspection_failed", "message": "Error interno del servidor"}
        }), 500


# ============================================================================
# DOCUMENTS (Documentos)
# ============================================================================

@bp.route("/vehicles/<int:vehicle_id>/documents", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def list_vehicle_documents(vehicle_id):
    """Lista documentos de un vehículo"""
    try:
        documents = fms_service.list_vehicle_documents(vehicle_id)
        return jsonify({"ok": True, "data": documents})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in list_vehicle_documents: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "list_documents_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/vehicles/<int:vehicle_id>/documents", methods=["POST"])
@require_auth
@require_role(["admin", "fleet_manager"])
@rate_limit(30, 60)
def add_vehicle_document(vehicle_id):
    """Agrega un documento a un vehículo"""
    try:
        data = request.get_json()
        user_id = g.user.get("id_spm")

        if not data:
            return jsonify({
                "ok": False,
                "error": {"code": "invalid_request", "message": "No data provided"}
            }), 400

        document = fms_service.add_vehicle_document(vehicle_id, data, user_id)
        return jsonify({"ok": True, "data": document}), 201

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in add_vehicle_document: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "add_document_failed", "message": "Error interno del servidor"}
        }), 500


@bp.route("/documents/expiring", methods=["GET"])
@require_auth
@rate_limit(100, 60)
def get_expiring_documents():
    """Obtiene documentos que expiran en los próximos N días"""
    try:
        days = request.args.get("days", 30, type=int)
        documents = fms_service.get_expiring_documents(days)
        return jsonify({"ok": True, "data": documents})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_expiring_documents: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_expiring_documents_failed", "message": "Error interno del servidor"}
        }), 500


# ============================================================================
# KPIs
# ============================================================================

@bp.route("/kpis", methods=["GET"])
@require_auth
@rate_limit(50, 60)
def get_fms_kpis():
    """Obtiene KPIs del dashboard FMS"""
    try:
        kpis = fms_service.get_fms_kpis()
        return jsonify({"ok": True, "data": kpis})

    except (KeyError, ValueError, TypeError) as e:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Datos de entrada inválidos"}
        }), 400
    except Exception as e:
        logger.error(f"Error in get_fms_kpis: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": {"code": "get_kpis_failed", "message": "Error interno del servidor"}
        }), 500
