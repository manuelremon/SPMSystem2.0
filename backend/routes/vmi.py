"""
Vendor-Managed Inventory (VMI) Routes
Endpoints para gestión de inventario administrado por proveedor (Sprint 73)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import vmi_service

logger = logging.getLogger(__name__)

vmi_bp = Blueprint('vmi', __name__, url_prefix='/api/vmi')


@vmi_bp.route('/programas', methods=['GET'])
@require_auth
def obtener_programas():
    """Obtener programas VMI con filtros."""
    try:
        filtros = {
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        programas = vmi_service.obtener_programas(filtros)
        programas['ok'] = True
        return jsonify(programas), 200
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/programas', methods=['POST'])
@require_auth
def crear_programa():
    """Crear nuevo programa VMI."""
    try:
        data = request.get_json()
        programa_id = vmi_service.crear_programa(data)
        if programa_id:
            return jsonify({'ok': True, 'id': programa_id}), 201
        return jsonify({'ok': False, 'error': 'Error al crear programa VMI'}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/programas/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_programa(id):
    """Obtener detalle de programa VMI."""
    try:
        detalle = vmi_service.obtener_detalle_programa(id)
        if detalle is None:
            return jsonify({'ok': False, 'error': 'Programa VMI no encontrado'}), 404
        detalle['ok'] = True
        return jsonify(detalle), 200
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/programas/<int:id>', methods=['PUT'])
@require_auth
def actualizar_programa(id):
    """Actualizar programa VMI."""
    try:
        data = request.get_json()
        ok = vmi_service.actualizar_programa(id, data)
        if ok:
            return jsonify({'ok': True, 'message': 'Programa actualizado'}), 200
        return jsonify({'ok': False, 'error': 'No se pudo actualizar'}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/programas/<int:id>/inventario', methods=['POST'])
@require_auth
def actualizar_inventario(id):
    """Actualizar inventario de programa VMI."""
    try:
        data = request.get_json()
        ok = vmi_service.actualizar_inventario(id, data)
        if ok:
            return jsonify({'ok': True, 'message': 'Inventario actualizado'}), 200
        return jsonify({'ok': False, 'error': 'No se pudo actualizar inventario'}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/reposiciones', methods=['GET'])
@require_auth
def obtener_reposiciones():
    """Obtener reposiciones VMI con filtros."""
    try:
        filtros = {
            'programa_id': request.args.get('programa_id', type=int),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        reposiciones = vmi_service.obtener_reposiciones(filtros)
        if isinstance(reposiciones, list):
            return jsonify({'ok': True, 'items': reposiciones}), 200
        reposiciones['ok'] = True
        return jsonify(reposiciones), 200
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/reposiciones/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_reposicion(id):
    """Aprobar reposición VMI."""
    try:
        user_id = _get_user_id()
        data = request.get_json() or {}
        cantidad_aprobada = data.get('cantidad_aprobada')
        ok = vmi_service.aprobar_reposicion(id, user_id, cantidad_aprobada)
        if ok:
            return jsonify({'ok': True, 'message': 'Reposición aprobada'}), 200
        return jsonify({'ok': False, 'error': 'No se pudo aprobar'}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/reposiciones/<int:id>/reject', methods=['PUT'])
@require_auth
def rechazar_reposicion(id):
    """Rechazar reposición VMI."""
    try:
        user_id = _get_user_id()
        data = request.get_json() or {}
        razon = data.get('razon', '')
        ok = vmi_service.rechazar_reposicion(id, user_id, razon)
        if ok:
            return jsonify({'ok': True, 'message': 'Reposición rechazada'}), 200
        return jsonify({'ok': False, 'error': 'No se pudo rechazar'}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")


@vmi_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_dashboard_vmi():
    """Obtener dashboard VMI."""
    try:
        dashboard = vmi_service.obtener_dashboard_vmi()
        dashboard['ok'] = True
        return jsonify(dashboard), 200
    except Exception as e:
        return safe_error_response(e, logger, context="vmi")
