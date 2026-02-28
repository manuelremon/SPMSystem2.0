"""
Inventory Optimization Routes
Endpoints para optimización de inventario multi-ubicación (Sprint 68)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.services import inventory_optimization_service

logger = logging.getLogger(__name__)

inv_opt_bp = Blueprint('inventory_optimization', __name__, url_prefix='/api/inventory-optimization')


@inv_opt_bp.route('/imbalances', methods=['GET'])
@require_auth
def detectar_desbalances():
    """Detectar desbalances de inventario entre ubicaciones."""
    try:
        desbalances = inventory_optimization_service.detectar_desbalances()
        return jsonify({'ok': True, 'items': desbalances}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="detectar_desbalances")


@inv_opt_bp.route('/transfers/propose', methods=['POST'])
@require_auth
def proponer_transferencias():
    """Proponer transferencias para balancear inventario."""
    try:
        propuestas = inventory_optimization_service.proponer_transferencias()
        return jsonify({'ok': True, 'items': propuestas}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="proponer_transferencias")


@inv_opt_bp.route('/transfers', methods=['GET'])
@require_auth
def obtener_transferencias():
    """Obtener transferencias de inventario con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'material_codigo': request.args.get('material_codigo'),
            'almacen': request.args.get('almacen'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        transferencias = inventory_optimization_service.obtener_transferencias(filtros)
        transferencias['ok'] = True
        return jsonify(transferencias), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_transferencias")


@inv_opt_bp.route('/transfers/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_transferencia(id):
    """Aprobar transferencia de inventario."""
    try:
        user_id = _get_user_id()
        resultado = inventory_optimization_service.aprobar_transferencia(id, user_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="aprobar_transferencia")


@inv_opt_bp.route('/transfers/<int:id>/complete', methods=['PUT'])
@require_auth
def completar_transferencia(id):
    """Completar transferencia de inventario."""
    try:
        user_id = _get_user_id()
        resultado = inventory_optimization_service.completar_transferencia(id, user_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="completar_transferencia")


@inv_opt_bp.route('/service-levels', methods=['GET'])
@require_auth
def obtener_niveles_servicio():
    """Obtener niveles de servicio por material/ubicación."""
    try:
        filtros = {
            'material_codigo': request.args.get('material_codigo'),
            'almacen': request.args.get('almacen'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        niveles = inventory_optimization_service.obtener_niveles_servicio(filtros)
        niveles['ok'] = True
        return jsonify(niveles), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_niveles_servicio")


@inv_opt_bp.route('/service-levels/<material>', methods=['PUT'])
@require_auth
def calcular_niveles_servicio(material):
    """Calcular niveles de servicio para un material."""
    try:
        data = request.get_json()
        almacen = data.get('almacen', '')
        resultado = inventory_optimization_service.calcular_niveles_servicio(material, almacen)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="calcular_niveles_servicio")


@inv_opt_bp.route('/recalculate', methods=['POST'])
@require_admin
def recalcular_todos_niveles():
    """Recalcular niveles de servicio para todos los materiales."""
    try:
        resultado = inventory_optimization_service.recalcular_todos_niveles()
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="recalcular_todos_niveles")


@inv_opt_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_optimizacion():
    """Obtener KPIs de optimización de inventario."""
    try:
        kpis = inventory_optimization_service.obtener_kpis_optimizacion()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_kpis_optimizacion")
