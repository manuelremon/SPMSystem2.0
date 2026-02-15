"""
Engineering Change Order (ECO) Routes
Endpoints para órdenes de cambio de ingeniería (Sprint 72)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import eco_service

eco_bp = Blueprint('eco', __name__, url_prefix='/api/eco')


@eco_bp.route('/', methods=['GET'])
@require_auth
def obtener_ecos():
    """Obtener ECOs con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'tipo': request.args.get('tipo'),
            'prioridad': request.args.get('prioridad'),
            'material_codigo': request.args.get('material_codigo'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        ecos = eco_service.obtener_ecos(filtros)
        return jsonify(ecos), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/', methods=['POST'])
@require_auth
def crear_eco():
    """Crear nueva ECO."""
    try:
        data = request.get_json()
        eco = eco_service.crear_eco(data)
        return jsonify(eco), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_eco(id):
    """Obtener detalle completo de ECO."""
    try:
        detalle = eco_service.obtener_detalle_eco(id)
        return jsonify(detalle), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>', methods=['PUT'])
@require_auth
def actualizar_eco(id):
    """Actualizar ECO."""
    try:
        data = request.get_json()
        eco = eco_service.actualizar_eco(id, data)
        return jsonify(eco), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>/changes', methods=['POST'])
@require_auth
def agregar_cambios(id):
    """Agregar cambios a ECO."""
    try:
        data = request.get_json()
        cambios = data.get('cambios')
        resultado = eco_service.agregar_cambios(id, cambios)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>/submit', methods=['POST'])
@require_auth
def solicitar_aprobacion(id):
    """Solicitar aprobación de ECO."""
    try:
        user_id = _get_user_id()
        resultado = eco_service.solicitar_aprobacion(id, user_id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_eco(id):
    """Aprobar ECO."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        comentarios = data.get('comentarios')
        resultado = eco_service.aprobar_eco(id, user_id, comentarios)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>/reject', methods=['PUT'])
@require_auth
def rechazar_eco(id):
    """Rechazar ECO."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        comentarios = data.get('comentarios')
        resultado = eco_service.rechazar_eco(id, user_id, comentarios)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>/implement', methods=['POST'])
@require_auth
def implementar_eco(id):
    """Implementar ECO."""
    try:
        user_id = _get_user_id()
        resultado = eco_service.implementar_eco(id, user_id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/<int:id>/impact', methods=['GET'])
@require_auth
def obtener_impacto(id):
    """Obtener análisis de impacto de ECO."""
    try:
        impacto = eco_service.obtener_impacto(id)
        return jsonify(impacto), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@eco_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs de ECOs."""
    try:
        kpis = eco_service.obtener_kpis()
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
