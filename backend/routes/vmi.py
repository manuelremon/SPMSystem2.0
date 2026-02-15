"""
Vendor-Managed Inventory (VMI) Routes
Endpoints para gestión de inventario administrado por proveedor (Sprint 73)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import vmi_service

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
        return jsonify(programas), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/programas', methods=['POST'])
@require_auth
def crear_programa():
    """Crear nuevo programa VMI."""
    try:
        data = request.get_json()
        programa = vmi_service.crear_programa(data)
        return jsonify(programa), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/programas/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_programa(id):
    """Obtener detalle de programa VMI."""
    try:
        detalle = vmi_service.obtener_detalle_programa(id)
        return jsonify(detalle), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/programas/<int:id>', methods=['PUT'])
@require_auth
def actualizar_programa(id):
    """Actualizar programa VMI."""
    try:
        data = request.get_json()
        programa = vmi_service.actualizar_programa(id, data)
        return jsonify(programa), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/programas/<int:id>/inventario', methods=['POST'])
@require_auth
def actualizar_inventario(id):
    """Actualizar inventario de programa VMI."""
    try:
        data = request.get_json()
        resultado = vmi_service.actualizar_inventario(id, data)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        return jsonify(reposiciones), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/reposiciones/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_reposicion(id):
    """Aprobar reposición VMI."""
    try:
        user_id = _get_user_id()
        data = request.get_json()
        cantidad_aprobada = data.get('cantidad_aprobada')
        resultado = vmi_service.aprobar_reposicion(id, user_id, cantidad_aprobada)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/reposiciones/<int:id>/reject', methods=['PUT'])
@require_auth
def rechazar_reposicion(id):
    """Rechazar reposición VMI."""
    try:
        user_id = _get_user_id()
        data = request.get_json()
        razon = data.get('razon')
        resultado = vmi_service.rechazar_reposicion(id, user_id, razon)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vmi_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_dashboard_vmi():
    """Obtener dashboard VMI."""
    try:
        dashboard = vmi_service.obtener_dashboard_vmi()
        return jsonify(dashboard), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
