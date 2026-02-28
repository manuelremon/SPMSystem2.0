"""
Lot Traceability Routes
Endpoints para trazabilidad de lotes y recalls (Sprint 74)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import lot_service

lots_bp = Blueprint('lots', __name__, url_prefix='/api/lots')


@lots_bp.route('/', methods=['GET'])
@require_auth
def buscar_lotes():
    """Buscar lotes con filtros."""
    try:
        filtros = {
            'numero_lote': request.args.get('numero_lote'),
            'material_codigo': request.args.get('material_codigo'),
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'estado': request.args.get('estado'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        lotes = lot_service.buscar_lotes(filtros)
        lotes['ok'] = True
        return jsonify(lotes), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/', methods=['POST'])
@require_auth
def crear_lote():
    """Crear nuevo lote."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        data['usuario_id'] = user_id
        lote_id = lot_service.crear_lote(data)
        return jsonify({'id': lote_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/<int:id>', methods=['GET'])
@require_auth
def obtener_lote(id):
    """Obtener detalle de lote."""
    try:
        lote = lot_service.obtener_lote(id)
        return jsonify(lote), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/<int:id>/consume', methods=['POST'])
@require_auth
def consumir_lote(id):
    """Consumir cantidad de un lote."""
    try:
        user_id = _get_user_id()
        data = request.get_json()
        cantidad = data['cantidad']
        solicitud_id = data.get('solicitud_id')
        destino = data.get('destino')
        observaciones = data.get('observaciones')
        resultado = lot_service.consumir_lote(id, cantidad, user_id, solicitud_id, destino, observaciones)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/<int:id>/block', methods=['PUT'])
@require_auth
def bloquear_lote(id):
    """Bloquear lote."""
    try:
        user_id = _get_user_id()
        data = request.get_json()
        razon = data.get('razon') or data.get('motivo') or data.get('reason', '')
        resultado = lot_service.bloquear_lote(id, razon, user_id)
        return jsonify({'success': resultado}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/<int:id>/unblock', methods=['PUT'])
@require_auth
def desbloquear_lote(id):
    """Desbloquear lote."""
    try:
        user_id = _get_user_id()
        resultado = lot_service.desbloquear_lote(id, user_id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/<int:id>/traceability/forward', methods=['GET'])
@require_auth
def obtener_traceability_forward(id):
    """Obtener trazabilidad hacia adelante (dónde fue usado el lote)."""
    try:
        traceability = lot_service.obtener_traceability_forward(id)
        return jsonify(traceability), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/<int:id>/traceability/backward', methods=['GET'])
@require_auth
def obtener_traceability_backward(id):
    """Obtener trazabilidad hacia atrás (qué lotes formaron este lote)."""
    try:
        traceability = lot_service.obtener_traceability_backward(id)
        return jsonify(traceability), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/genealogy', methods=['POST'])
@require_auth
def registrar_genealogia():
    """Registrar genealogía de lotes."""
    try:
        data = request.get_json()
        genealogia_id = lot_service.registrar_genealogia(
            lote_padre_id=data['lote_padre_id'],
            lote_hijo_id=data['lote_hijo_id'],
            relacion=data.get('relacion', 'component'),
            cantidad_utilizada=data.get('cantidad_utilizada', 0)
        )
        return jsonify({'id': genealogia_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/recalls', methods=['GET'])
@require_auth
def obtener_recalls():
    """Obtener recalls con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'severidad': request.args.get('severidad'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        recalls = lot_service.obtener_recalls(filtros)
        recalls['ok'] = True
        return jsonify(recalls), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/recalls', methods=['POST'])
@require_auth
def crear_recall():
    """Crear nuevo recall."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        data['responsable_id'] = data.get('responsable_id') or user_id
        recall_id = lot_service.crear_recall(data)
        return jsonify({'id': recall_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/recalls/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_recall(id):
    """Obtener detalle de recall."""
    try:
        detalle = lot_service.obtener_detalle_recall(id)
        return jsonify(detalle), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@lots_bp.route('/recalls/<int:id>/lotes/<int:lote_id>/recover', methods=['PUT'])
@require_auth
def marcar_lote_recuperado(id, lote_id):
    """Marcar lote como recuperado en un recall."""
    try:
        resultado = lot_service.marcar_lote_recuperado(id, lote_id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
