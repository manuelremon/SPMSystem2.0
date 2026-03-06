"""
Consignment Inventory Routes
Endpoints para gestión de inventario en consignación (Sprint 83)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import consignment_service

logger = logging.getLogger(__name__)

consignment_bp = Blueprint('consignment', __name__, url_prefix='/api/consignment')


@consignment_bp.route('/programs', methods=['GET'])
@require_auth
def obtener_programas():
    """Obtener programas de consignación con paginación."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        resultado = consignment_service.obtener_programas(filtros)
        return jsonify({'ok': True, **resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/programs', methods=['POST'])
@require_auth
def crear_programa():
    """Crear nuevo programa de consignación."""
    try:
        data = request.get_json()

        # Validar campos requeridos
        if not data.get('proveedor_cuit'):
            return jsonify({'ok': False, 'error': 'proveedor_cuit es requerido'}), 400
        if not data.get('nombre'):
            return jsonify({'ok': False, 'error': 'nombre es requerido'}), 400

        programa_id = consignment_service.crear_programa(data)
        return jsonify({'ok': True, 'programa_id': programa_id}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/programs/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_programa(id):
    """Obtener detalle completo de un programa."""
    try:
        detalle = consignment_service.obtener_detalle_programa(id)
        return jsonify({'ok': True, **detalle}), 200
    except ValueError as e:
        return safe_error_response(e, logger, status_code=404, context="consignment.obtener_detalle_programa")
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/programs/<int:id>', methods=['PUT'])
@require_auth
def actualizar_programa(id):
    """Actualizar o suspender un programa."""
    try:
        data = request.get_json()
        consignment_service.actualizar_programa(id, data)
        return jsonify({'ok': True, 'message': 'Programa actualizado'}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/programs/<int:id>/stock', methods=['POST'])
@require_auth
def actualizar_stock(id):
    """Actualizar stock de un material en consignación."""
    try:
        data = request.get_json()

        if not data.get('material_codigo'):
            return jsonify({'ok': False, 'error': 'material_codigo es requerido'}), 400
        if 'cantidad_disponible' not in data:
            return jsonify({'ok': False, 'error': 'cantidad_disponible es requerido'}), 400

        stock_id = consignment_service.actualizar_stock(
            id,
            data['material_codigo'],
            data['cantidad_disponible'],
            data.get('valor_unitario')
        )
        return jsonify({'ok': True, 'stock_id': stock_id}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/programs/<int:id>/consume', methods=['POST'])
@require_auth
def registrar_consumo(id):
    """Registrar consumo de material en consignación."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        if not data.get('stock_id'):
            return jsonify({'ok': False, 'error': 'stock_id es requerido'}), 400
        if not data.get('cantidad'):
            return jsonify({'ok': False, 'error': 'cantidad es requerido'}), 400

        consumo_id = consignment_service.registrar_consumo(
            data['stock_id'],
            data['cantidad'],
            data.get('solicitud_id'),
            user_id
        )
        return jsonify({'ok': True, 'consumo_id': consumo_id}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/programs/<int:id>/reconciliation', methods=['POST'])
@require_auth
def generar_reconciliacion(id):
    """Generar reconciliación para un periodo."""
    try:
        data = request.get_json()

        if not data.get('periodo'):
            return jsonify({'ok': False, 'error': 'periodo es requerido (formato YYYY-MM)'}), 400

        reconciliacion_id = consignment_service.generar_reconciliacion(id, data['periodo'])
        return jsonify({'ok': True, 'reconciliacion_id': reconciliacion_id}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/reconciliations/<int:id>/send', methods=['PUT'])
@require_auth
def enviar_reconciliacion(id):
    """Enviar reconciliación al proveedor."""
    try:
        data = request.get_json() or {}
        consignment_service.enviar_reconciliacion(id, data.get('notas'))
        return jsonify({'ok': True, 'message': 'Reconciliación enviada'}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/reconciliations/<int:id>/confirm', methods=['PUT'])
@require_auth
def confirmar_reconciliacion(id):
    """Confirmar reconciliación."""
    try:
        data = request.get_json() or {}
        consignment_service.confirmar_reconciliacion(id, data.get('notas'))
        return jsonify({'ok': True, 'message': 'Reconciliación confirmada'}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")


@consignment_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs de consignación."""
    try:
        programa_id = request.args.get('programa_id', type=int)
        kpis = consignment_service.obtener_kpis(programa_id)
        return jsonify({'ok': True, 'kpis': kpis}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="consignment")
