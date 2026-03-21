"""
Warehouse Operations Routes
Endpoints para recepción y putaway (Sprint 66)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.services import warehouse_service

logger = logging.getLogger(__name__)

warehouse_bp = Blueprint('warehouse', __name__, url_prefix='/api/warehouse')


@warehouse_bp.route('/docks', methods=['GET'])
@require_auth
def obtener_docks():
    """Obtener lista de docks con estado de ocupación."""
    try:
        almacen = request.args.get('almacen')
        docks = warehouse_service.obtener_docks(almacen)
        return jsonify({'ok': True, 'items': docks}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/docks', methods=['POST'])
@require_admin
def crear_dock():
    """Crear nuevo dock de recepción."""
    try:
        data = request.get_json()
        dock = warehouse_service.crear_dock(data)
        return jsonify({'ok': True, 'id': dock}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/docks/<int:dock_id>/assign/<int:recepcion_id>', methods=['POST'])
@require_auth
def asignar_dock(dock_id, recepcion_id):
    """Asignar recepción a dock disponible."""
    try:
        user_id = _get_user_id()
        resultado = warehouse_service.asignar_dock(dock_id, recepcion_id, user_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/docks/<int:dock_id>/times', methods=['PUT'])
@require_auth
def registrar_tiempos_dock(dock_id):
    """Registrar tiempos de inicio/fin de operación en dock."""
    try:
        data = request.get_json()
        resultado = warehouse_service.registrar_tiempos_dock(dock_id, data)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/putaway', methods=['GET'])
@require_auth
def obtener_tareas_putaway():
    """Obtener tareas de putaway con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'almacen': request.args.get('almacen'),
            'prioridad': request.args.get('prioridad'),
            'asignado_a': request.args.get('asignado_a'),
            'page': request.args.get('page', 1, type=int),
            'per_page': min(request.args.get('per_page', 50, type=int), 500)
        }
        tareas = warehouse_service.obtener_tareas_putaway(filtros)
        tareas['ok'] = True
        return jsonify(tareas), 200
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/putaway/generate/<int:recepcion_id>', methods=['POST'])
@require_auth
def generar_tareas_putaway(recepcion_id):
    """Generar tareas de putaway para recepción."""
    try:
        tareas = warehouse_service.generar_tareas_putaway(recepcion_id)
        return jsonify({'ok': True, 'items': tareas}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/putaway/<int:tarea_id>/complete', methods=['PUT'])
@require_auth
def completar_putaway(tarea_id):
    """Completar tarea de putaway."""
    try:
        user_id = _get_user_id()
        resultado = warehouse_service.completar_putaway(tarea_id, user_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")


@warehouse_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_warehouse():
    """Obtener KPIs de operaciones de warehouse."""
    try:
        kpis = warehouse_service.obtener_kpis_warehouse()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return safe_error_response(e, logger, context="warehouse")
