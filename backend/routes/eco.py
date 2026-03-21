"""
Engineering Change Order (ECO) Routes
Endpoints para órdenes de cambio de ingeniería (Sprint 72)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import eco_service

logger = logging.getLogger(__name__)

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
            # Frontend envia 'material', backend lee 'material_codigo'
            'material_codigo': request.args.get('material_codigo') or request.args.get('material'),
            'page': request.args.get('page', 1, type=int),
            'per_page': min(request.args.get('per_page', 50, type=int), 500)
        }
        result = eco_service.obtener_ecos(filtros)
        # Frontend espera 'ecos', servicio retorna 'items'
        result['ecos'] = result.pop('items', [])
        result['ok'] = True
        return jsonify(result), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/', methods=['POST'])
@require_auth
def crear_eco():
    """Crear nueva ECO."""
    try:
        data = request.get_json()
        eco = eco_service.crear_eco(data)
        eco['ok'] = True
        return jsonify(eco), 201
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_eco(id):
    """Obtener detalle completo de ECO."""
    try:
        detalle = eco_service.obtener_detalle_eco(id)
        # Alinear keys de cambios al frontend
        for c in detalle.get('cambios', []):
            c.setdefault('campo_afectado', c.get('campo'))
            c.setdefault('tipo_cambio', c.get('razon'))
        # Alinear keys de aprobaciones al frontend
        for a in detalle.get('aprobaciones', []):
            a.setdefault('aprobador', a.get('aprobador_nombre'))
        # Alinear keys de historial al frontend
        for h in detalle.get('historial', []):
            h.setdefault('actor', h.get('actor_nombre'))
            h.setdefault('notas', h.get('comentarios'))
        return jsonify({'ok': True, 'eco': detalle}), 200
    except ValueError as e:
        return safe_error_response(e, logger, status_code=404, context="eco.obtener_detalle_eco")
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>', methods=['PUT'])
@require_auth
def actualizar_eco(id):
    """Actualizar ECO."""
    try:
        data = request.get_json()
        eco = eco_service.actualizar_eco(id, data)
        eco['ok'] = True
        return jsonify(eco), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>/changes', methods=['POST'])
@require_auth
def agregar_cambios(id):
    """Agregar cambios a ECO."""
    try:
        data = request.get_json()
        # Frontend puede enviar un objeto plano o {cambios: [...]}
        cambios = data.get('cambios')
        if cambios is None:
            # Frontend envia objeto plano: {campo_afectado, tipo_cambio, ...}
            cambio = {
                'campo': data.get('campo_afectado') or data.get('campo'),
                'valor_anterior': data.get('valor_anterior'),
                'valor_nuevo': data.get('valor_nuevo'),
                'razon': data.get('tipo_cambio') or data.get('razon'),
            }
            cambios = [cambio]
        resultado = eco_service.agregar_cambios(id, cambios)
        return jsonify({'ok': True, 'result': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>/submit', methods=['POST'])
@require_auth
def solicitar_aprobacion(id):
    """Solicitar aprobación de ECO."""
    try:
        user_id = _get_user_id()
        resultado = eco_service.solicitar_aprobacion(id, user_id)
        return jsonify({'ok': True, 'result': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_eco(id):
    """Aprobar ECO."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        comentarios = data.get('comentarios')
        resultado = eco_service.aprobar_eco(id, user_id, comentarios)
        return jsonify({'ok': True, 'result': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>/reject', methods=['PUT'])
@require_auth
def rechazar_eco(id):
    """Rechazar ECO."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        comentarios = data.get('comentarios')
        resultado = eco_service.rechazar_eco(id, user_id, comentarios)
        return jsonify({'ok': True, 'result': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>/implement', methods=['POST'])
@require_auth
def implementar_eco(id):
    """Implementar ECO."""
    try:
        user_id = _get_user_id()
        resultado = eco_service.implementar_eco(id, user_id)
        return jsonify({'ok': True, 'result': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/<int:id>/impact', methods=['GET'])
@require_auth
def obtener_impacto(id):
    """Obtener análisis de impacto de ECO."""
    try:
        impacto = eco_service.obtener_impacto(id)
        # Frontend espera 'stock', servicio retorna 'stock_afectado'
        impacto['stock'] = impacto.pop('stock_afectado', [])
        return jsonify({'ok': True, 'impact': impacto}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")


@eco_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs de ECOs."""
    try:
        kpis = eco_service.obtener_kpis()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return safe_error_response(e, logger, context="eco")
