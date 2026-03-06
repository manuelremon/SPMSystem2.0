"""
Invoice Matching Routes
Endpoints para 3-Way Matching (Sprint 61)
Blueprint: matching_bp, Prefix: /api/matching
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import matching_service

logger = logging.getLogger(__name__)

matching_bp = Blueprint('matching', __name__, url_prefix='/api/matching')


@matching_bp.route('/invoices', methods=['GET'])
@require_auth
def obtener_facturas():
    """Obtener lista de facturas con filtros y paginacion."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'search': request.args.get('search'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = matching_service.obtener_facturas(filtros)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="matching.obtener_facturas")
    except Exception as e:
        return safe_error_response(e, logger, context="matching.obtener_facturas")


@matching_bp.route('/invoices', methods=['POST'])
@require_auth
def registrar_factura():
    """Registrar nueva factura para matching."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'ok': False, 'error': 'No se proporcionaron datos'}), 400

        user_id = _get_user_id()
        resultado = matching_service.registrar_factura(data, user_id)
        return jsonify(resultado), 201
    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="matching.registrar_factura")
    except Exception as e:
        return safe_error_response(e, logger, context="matching.registrar_factura")


@matching_bp.route('/invoices/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_factura(id):
    """Obtener detalle de una factura especifica."""
    try:
        resultado = matching_service.obtener_detalle_factura(id)
        if not resultado:
            return jsonify({'ok': False, 'error': 'Factura no encontrada'}), 404
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_detalle_factura")


@matching_bp.route('/invoices/<int:id>/match', methods=['POST'])
@require_auth
def ejecutar_matching(id):
    """Ejecutar proceso de 3-way matching para una factura."""
    try:
        resultado = matching_service.ejecutar_matching(id)
        return jsonify(resultado), 200
    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="matching.ejecutar_matching")
    except Exception as e:
        return safe_error_response(e, logger, context="matching.ejecutar_matching")


@matching_bp.route('/results/<int:id>/resolve', methods=['PUT'])
@require_auth
def resolver_discrepancia(id):
    """Resolver discrepancia encontrada en matching."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'ok': False, 'error': 'No se proporcionaron datos'}), 400

        user_id = _get_user_id()
        resultado = matching_service.resolver_discrepancia(id, data, user_id)
        return jsonify(resultado), 200
    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="matching.resolver_discrepancia")
    except Exception as e:
        return safe_error_response(e, logger, context="matching.resolver_discrepancia")


@matching_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_matching():
    """Obtener KPIs del proceso de matching."""
    try:
        resultado = matching_service.obtener_kpis_matching()
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_kpis_matching")


@matching_bp.route('/invoices/<int:id>/comparison', methods=['GET'])
@require_auth
def obtener_comparacion(id):
    """Obtener comparacion detallada PO-GR-Invoice."""
    try:
        resultado = matching_service.obtener_comparacion(id)
        if not resultado:
            return jsonify({'ok': False, 'error': 'Comparacion no disponible'}), 404
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_comparacion")
