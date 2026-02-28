"""
Cycle Count Routes
Endpoints para conteo cíclico de inventario (Sprint 75)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import cycle_count_service

cycle_count_bp = Blueprint('cycle_count', __name__, url_prefix='/api/cycle-count')


@cycle_count_bp.route('/programs', methods=['GET'])
@require_auth
def obtener_programas():
    """Obtener programas de conteo cíclico."""
    try:
        programas = cycle_count_service.obtener_programas()
        return jsonify({'ok': True, 'items': programas}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/programs', methods=['POST'])
@require_auth
def crear_programa():
    """Crear nuevo programa de conteo cíclico."""
    try:
        data = request.get_json()
        programa = cycle_count_service.crear_programa(data)
        return jsonify(programa), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/programs/<int:id>', methods=['PUT'])
@require_auth
def actualizar_programa(id):
    """Actualizar programa de conteo cíclico."""
    try:
        data = request.get_json()
        programa = cycle_count_service.actualizar_programa(id, data)
        return jsonify(programa), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/counts', methods=['GET'])
@require_auth
def obtener_conteos():
    """Obtener conteos con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'programa_id': request.args.get('programa_id', type=int),
            'almacen_id': request.args.get('almacen_id', type=int),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        conteos = cycle_count_service.obtener_conteos(filtros)
        conteos['ok'] = True
        return jsonify(conteos), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/counts/generate', methods=['POST'])
@require_auth
def generar_conteo():
    """Generar nuevo conteo cíclico."""
    try:
        data = request.get_json()
        tipo = data['tipo']
        almacen_id = data['almacen_id']
        programa_id = data.get('programa_id')
        asignado_a = data.get('asignado_a')
        conteo = cycle_count_service.generar_conteo(tipo, almacen_id, programa_id, asignado_a)
        return jsonify(conteo), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/counts/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_conteo(id):
    """Obtener detalle de conteo."""
    try:
        detalle = cycle_count_service.obtener_detalle_conteo(id)
        return jsonify(detalle), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/counts/<int:id>/start', methods=['PUT'])
@require_auth
def iniciar_conteo(id):
    """Iniciar conteo cíclico."""
    try:
        resultado = cycle_count_service.iniciar_conteo(id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/counts/<int:id>/items/<int:item_id>', methods=['PUT'])
@require_auth
def registrar_conteo_item(id, item_id):
    """Registrar conteo de un item."""
    try:
        user_id = _get_user_id()
        data = request.get_json()
        cantidad_contada = data['cantidad_contada']
        resultado = cycle_count_service.registrar_conteo_item(id, item_id, cantidad_contada, user_id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/counts/<int:id>/complete', methods=['PUT'])
@require_auth
def completar_conteo(id):
    """Completar conteo cíclico."""
    try:
        resultado = cycle_count_service.completar_conteo(id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/adjustments/<int:item_id>/approve', methods=['POST'])
@require_auth
def aprobar_ajuste(item_id):
    """Aprobar ajuste de inventario."""
    try:
        user_id = _get_user_id()
        resultado = cycle_count_service.aprobar_ajuste(item_id, user_id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cycle_count_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs de conteo cíclico."""
    try:
        kpis = cycle_count_service.obtener_kpis()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
