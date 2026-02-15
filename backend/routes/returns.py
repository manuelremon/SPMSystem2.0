"""
Returns & RMA Routes
Endpoints para devoluciones y logistica inversa (Sprint 65)
Blueprint: returns_bp, Prefix: /api/returns
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import returns_service

returns_bp = Blueprint('returns', __name__, url_prefix='/api/returns')


@returns_bp.route('/', methods=['GET'])
@require_auth
def obtener_devoluciones():
    """Obtener lista de devoluciones con filtros y paginacion."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'tipo': request.args.get('tipo'),
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = returns_service.obtener_devoluciones(filtros)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@returns_bp.route('/', methods=['POST'])
@require_auth
def crear_devolucion():
    """Crear nueva devolucion o RMA."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No se proporcionaron datos'}), 400

        user_id = _get_user_id()
        resultado = returns_service.crear_devolucion(data, user_id)
        return jsonify(resultado), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@returns_bp.route('/from-ncr/<int:ncr_id>', methods=['POST'])
@require_auth
def crear_desde_ncr(ncr_id):
    """Crear devolucion automaticamente desde NCR existente."""
    try:
        user_id = _get_user_id()
        resultado = returns_service.crear_desde_ncr(ncr_id, user_id)
        return jsonify(resultado), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@returns_bp.route('/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_devolucion(id):
    """Obtener detalle completo de una devolucion."""
    try:
        resultado = returns_service.obtener_detalle_devolucion(id)
        if not resultado:
            return jsonify({'error': 'Devolucion no encontrada'}), 404
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@returns_bp.route('/<int:id>/status', methods=['PUT'])
@require_auth
def cambiar_estado(id):
    """Cambiar estado de una devolucion."""
    try:
        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({'error': 'estado es requerido'}), 400

        user_id = _get_user_id()
        notas = data.get('notas')
        resultado = returns_service.cambiar_estado(id, data['estado'], user_id, notas)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@returns_bp.route('/<int:id>/credit', methods=['PUT'])
@require_auth
def registrar_credito(id):
    """Registrar nota de credito para devolucion."""
    try:
        data = request.get_json()
        if not data or 'monto' not in data:
            return jsonify({'error': 'monto es requerido'}), 400

        user_id = _get_user_id()
        resultado = returns_service.registrar_credito(id, data['monto'], user_id)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@returns_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_devoluciones():
    """Obtener KPIs del proceso de devoluciones."""
    try:
        resultado = returns_service.obtener_kpis_devoluciones()
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
