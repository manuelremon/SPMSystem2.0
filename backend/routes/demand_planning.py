"""
Demand Planning Routes
Endpoints para planificacion colaborativa de demanda S&OP (Sprint 64)
Blueprint: demand_bp, Prefix: /api/demand-planning
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import demand_planning_service

logger = logging.getLogger(__name__)

demand_bp = Blueprint('demand_planning', __name__, url_prefix='/api/demand-planning')


@demand_bp.route('/cycles', methods=['GET'])
@require_auth
def obtener_ciclos():
    """Obtener lista de ciclos de planificacion con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = demand_planning_service.obtener_ciclos(filtros)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_ciclos")


@demand_bp.route('/cycles', methods=['POST'])
@require_auth
def crear_ciclo():
    """Crear nuevo ciclo de planificacion de demanda."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'ok': False, 'error': 'No se proporcionaron datos'}), 400

        user_id = _get_user_id()
        resultado = demand_planning_service.crear_ciclo_planificacion(data, user_id)
        return jsonify(resultado), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="crear_ciclo")


@demand_bp.route('/cycles/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_ciclo(id):
    """Obtener detalle completo de un ciclo de planificacion."""
    try:
        resultado = demand_planning_service.obtener_detalle_ciclo(id)
        if not resultado:
            return jsonify({'ok': False, 'error': 'Ciclo no encontrado'}), 404
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_detalle_ciclo")


@demand_bp.route('/cycles/<int:id>/status', methods=['PUT'])
@require_auth
def cambiar_estado_ciclo(id):
    """Cambiar estado de un ciclo de planificacion."""
    try:
        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({'ok': False, 'error': 'estado es requerido'}), 400

        user_id = _get_user_id()
        resultado = demand_planning_service.cambiar_estado_ciclo(id, data['estado'], user_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="cambiar_estado_ciclo")


@demand_bp.route('/cycles/<int:id>/entries', methods=['POST'])
@require_auth
def agregar_entrada(id):
    """Agregar entrada de demanda a un ciclo."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'ok': False, 'error': 'No se proporcionaron datos'}), 400

        user_id = _get_user_id()
        entrada_id = demand_planning_service.agregar_entrada(id, data, user_id)
        return jsonify({'ok': True, 'id': entrada_id}), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="agregar_entrada")


@demand_bp.route('/cycles/<int:id>/baseline', methods=['POST'])
@require_auth
def generar_baseline(id):
    """Generar baseline estadistico con ML para ciclo."""
    try:
        resultado = demand_planning_service.generar_baseline_ml(id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="generar_baseline")


@demand_bp.route('/cycles/<int:id>/consensus', methods=['POST'])
@require_auth
def calcular_consenso(id):
    """Calcular demand consensus entre stakeholders."""
    try:
        resultado = demand_planning_service.calcular_consenso(id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="calcular_consenso")


@demand_bp.route('/accuracy', methods=['GET'])
@require_auth
def obtener_accuracy_kpis():
    """Obtener KPIs de accuracy del forecast vs demanda real."""
    try:
        resultado = demand_planning_service.obtener_accuracy_kpis()
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_accuracy_kpis")
