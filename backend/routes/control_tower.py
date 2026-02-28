"""
Control Tower Routes
Endpoints para torre de control centralizada (Sprint 71)
"""

from flask import Blueprint, jsonify, request

from backend.core.roles import require_auth
from backend.services import control_tower_service

control_tower_bp = Blueprint('control_tower', __name__, url_prefix='/api/control-tower')


@control_tower_bp.route('/events', methods=['GET'])
@require_auth
def obtener_eventos_timeline():
    """Obtener eventos para timeline con filtros."""
    try:
        filtros = {
            'categoria': request.args.get('categoria'),
            'severidad': request.args.get('severidad'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        eventos = control_tower_service.obtener_eventos_timeline(filtros)
        eventos['ok'] = True
        return jsonify(eventos), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@control_tower_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_agregados():
    """Obtener KPIs agregados del control tower."""
    try:
        kpis = control_tower_service.obtener_kpis_agregados()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@control_tower_bp.route('/alerts', methods=['GET'])
@require_auth
def obtener_alertas_agregadas():
    """Obtener alertas agregadas con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'tipo': request.args.get('tipo')
        }
        alertas = control_tower_service.obtener_alertas_agregadas(filtros)
        return jsonify({'ok': True, 'items': alertas}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@control_tower_bp.route('/alerts/<int:id>/acknowledge', methods=['PUT'])
@require_auth
def acknowledgeAlert(id):
    """Marcar alerta como reconocida."""
    try:
        resultado = control_tower_service.marcar_alerta(id, 'acknowledged')
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@control_tower_bp.route('/alerts/<int:id>/resolve', methods=['PUT'])
@require_auth
def resolveAlert(id):
    """Marcar alerta como resuelta."""
    try:
        resultado = control_tower_service.marcar_alerta(id, 'resolved')
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@control_tower_bp.route('/trends', methods=['GET'])
@require_auth
def obtener_tendencias():
    """Obtener tendencias de KPIs."""
    try:
        kpi_key = request.args.get('kpi_key')
        periodos = request.args.get('periodos', 12, type=int)
        tendencias = control_tower_service.obtener_tendencias(kpi_key, periodos)
        tendencias['ok'] = True
        return jsonify(tendencias), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
