"""
Supplier Risk Routes
Endpoints para evaluacion de riesgo de proveedores (Sprint 63)
Blueprint: supplier_risk_bp, Prefix: /api/supplier-risk
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.services import supplier_risk_service

logger = logging.getLogger(__name__)

supplier_risk_bp = Blueprint('supplier_risk', __name__, url_prefix='/api/supplier-risk')


@supplier_risk_bp.route('/map', methods=['GET'])
@require_auth
def obtener_mapa_riesgo():
    """Obtener mapa de riesgo de proveedores con filtros y paginacion."""
    try:
        filtros = {
            'nivel': request.args.get('nivel'),
            'search': request.args.get('search'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = supplier_risk_service.obtener_mapa_riesgo(filtros)
        resultado['ok'] = True
        resultado['suppliers'] = resultado.pop('items', [])
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_mapa_riesgo")


@supplier_risk_bp.route('/<cuit>', methods=['GET'])
@require_auth
def obtener_riesgo_proveedor(cuit):
    """Calcular y obtener riesgo actual de proveedor especifico."""
    try:
        resultado = supplier_risk_service.calcular_riesgo_proveedor(cuit)
        if not resultado:
            return jsonify({'ok': False, 'error': 'Proveedor no encontrado'}), 404
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_riesgo_proveedor")


@supplier_risk_bp.route('/single-source', methods=['GET'])
@require_auth
def detectar_fuentes_unicas():
    """Detectar materiales con fuente unica (single source risk)."""
    try:
        resultado = supplier_risk_service.detectar_fuentes_unicas()
        return jsonify({'ok': True, 'single_source': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="detectar_fuentes_unicas")


@supplier_risk_bp.route('/alerts', methods=['GET'])
@require_auth
def obtener_alertas_riesgo():
    """Obtener alertas activas de riesgo de proveedores."""
    try:
        resultado = supplier_risk_service.obtener_alertas_riesgo()
        return jsonify({'ok': True, 'alerts': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_alertas_riesgo")


@supplier_risk_bp.route('/<cuit>/evaluate', methods=['POST'])
@require_auth
def evaluar_riesgo_proveedor(cuit):
    """Forzar re-evaluacion de riesgo de proveedor."""
    try:
        resultado = supplier_risk_service.calcular_riesgo_proveedor(cuit)
        if not resultado:
            return jsonify({'ok': False, 'error': 'Proveedor no encontrado'}), 404
        return jsonify({'ok': True, 'message': 'Evaluacion completada', 'data': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="evaluar_riesgo_proveedor")


@supplier_risk_bp.route('/recalculate', methods=['POST'])
@require_admin
def recalcular_todos():
    """Recalcular riesgo para todos los proveedores (solo admin)."""
    try:
        resultado = supplier_risk_service.recalcular_todos()
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="recalcular_todos")


@supplier_risk_bp.route('/<cuit>/trend', methods=['GET'])
@require_auth
def obtener_tendencia_riesgo(cuit):
    """Obtener tendencia historica de riesgo de proveedor."""
    try:
        resultado = supplier_risk_service.obtener_tendencia_riesgo(cuit)
        if not resultado:
            return jsonify({'ok': False, 'error': 'No hay datos historicos disponibles'}), 404
        return jsonify({'ok': True, 'data': resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_tendencia_riesgo")
