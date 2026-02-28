"""
Kitting & Light Assembly Routes
Endpoints para kitting y ensamblaje ligero (Sprint 73)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.roles import require_auth
from backend.services import kitting_service

logger = logging.getLogger(__name__)

kitting_bp = Blueprint('kitting', __name__, url_prefix='/api/kitting')


@kitting_bp.route('/boms', methods=['GET'])
@require_auth
def obtener_boms():
    """Obtener BOMs con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'kit_codigo': request.args.get('kit_codigo'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        boms = kitting_service.obtener_boms(filtros)
        return jsonify({'ok': True, 'items': boms}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/boms', methods=['POST'])
@require_auth
def crear_bom():
    """Crear nueva BOM de kit."""
    try:
        data = request.get_json()
        bom = kitting_service.crear_bom(data)
        return jsonify(bom), 201
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/boms/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_bom(id):
    """Obtener detalle completo de BOM."""
    try:
        detalle = kitting_service.obtener_detalle_bom(id)
        return jsonify(detalle), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/boms/<int:id>', methods=['PUT'])
@require_auth
def actualizar_bom(id):
    """Actualizar BOM."""
    try:
        data = request.get_json()
        bom = kitting_service.actualizar_bom(id, data)
        return jsonify(bom), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/boms/<int:id>/components', methods=['POST'])
@require_auth
def agregar_componente(id):
    """Agregar componente a BOM."""
    try:
        data = request.get_json()
        componente = kitting_service.agregar_componente(id, data)
        return jsonify(componente), 201
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/boms/<int:id>/components/<int:comp_id>', methods=['DELETE'])
@require_auth
def eliminar_componente(id, comp_id):
    """Eliminar componente de BOM."""
    try:
        resultado = kitting_service.eliminar_componente(id, comp_id)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders', methods=['GET'])
@require_auth
def obtener_ordenes():
    """Obtener órdenes de kitting con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'kit_codigo': request.args.get('kit_codigo'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        ordenes = kitting_service.obtener_ordenes(filtros)
        ordenes['ok'] = True
        return jsonify(ordenes), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders', methods=['POST'])
@require_auth
def crear_orden():
    """Crear nueva orden de kitting."""
    try:
        data = request.get_json()
        orden = kitting_service.crear_orden(data)
        return jsonify(orden), 201
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_orden(id):
    """Obtener detalle completo de orden."""
    try:
        detalle = kitting_service.obtener_detalle_orden(id)
        return jsonify(detalle), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders/<int:id>/allocate', methods=['POST'])
@require_auth
def asignar_componentes(id):
    """Asignar componentes a orden de kitting."""
    try:
        resultado = kitting_service.asignar_componentes(id)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders/<int:id>/start', methods=['PUT'])
@require_auth
def iniciar_produccion(id):
    """Iniciar producción de orden de kitting."""
    try:
        resultado = kitting_service.iniciar_produccion(id)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders/<int:id>/complete', methods=['PUT'])
@require_auth
def completar_orden(id):
    """Completar orden de kitting."""
    try:
        resultado = kitting_service.completar_orden(id)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/orders/<int:id>/availability', methods=['GET'])
@require_auth
def verificar_disponibilidad(id):
    """Verificar disponibilidad de componentes para orden."""
    try:
        disponibilidad = kitting_service.verificar_disponibilidad(id)
        return jsonify(disponibilidad), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")


@kitting_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs de kitting."""
    try:
        kpis = kitting_service.obtener_kpis()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return safe_error_response(e, logger, context="kitting")
