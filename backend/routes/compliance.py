"""
Contract Compliance & Rebates Routes
Endpoints para compliance contractual y rebates (Sprint 67)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import compliance_service

logger = logging.getLogger(__name__)

compliance_bp = Blueprint('compliance', __name__, url_prefix='/api/compliance')


@compliance_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_compliance_dashboard():
    """Obtener dashboard de compliance contractual."""
    try:
        dashboard = compliance_service.obtener_compliance_dashboard()
        dashboard['ok'] = True
        return jsonify(dashboard), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/checks', methods=['GET'])
@require_auth
def obtener_checks():
    """Obtener lista de checks de compliance con filtros."""
    try:
        filtros = {
            'contrato_id': request.args.get('contrato_id', type=int),
            'es_compliant': request.args.get('es_compliant', type=lambda v: v.lower() == 'true') if request.args.get('es_compliant') else None,
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        checks = compliance_service.obtener_checks(filtros)
        checks['ok'] = True
        return jsonify(checks), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/check/<int:oc_id>', methods=['POST'])
@require_auth
def verificar_compliance_oc(oc_id):
    """Verificar compliance de una orden de compra contra contrato."""
    try:
        resultado = compliance_service.verificar_compliance_oc(oc_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/rebates/programs', methods=['GET'])
@require_auth
def obtener_programas_rebate():
    """Obtener programas de rebate con filtros."""
    try:
        filtros = {
            'contrato_id': request.args.get('contrato_id', type=int),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        programas = compliance_service.obtener_programas_rebate(filtros)
        programas['ok'] = True
        return jsonify(programas), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/rebates/programs', methods=['POST'])
@require_auth
def crear_programa_rebate():
    """Crear nuevo programa de rebate."""
    try:
        data = request.get_json()
        programa = compliance_service.crear_programa_rebate(data)
        programa['ok'] = True
        return jsonify(programa), 201
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/rebates/calculate/<int:programa_id>', methods=['POST'])
@require_auth
def calcular_rebates(programa_id):
    """Calcular rebates para un programa específico."""
    try:
        resultado = compliance_service.calcular_rebates(programa_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/rebates/claims', methods=['GET'])
@require_auth
def obtener_claims():
    """Obtener claims de rebate con filtros."""
    try:
        filtros = {
            'programa_id': request.args.get('programa_id', type=int),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        claims = compliance_service.obtener_claims(filtros)
        claims['ok'] = True
        return jsonify(claims), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")


@compliance_bp.route('/rebates/claims/<int:id>/status', methods=['PUT'])
@require_auth
def cambiar_estado_claim(id):
    """Cambiar estado de claim de rebate."""
    try:
        data = request.get_json()
        estado = data.get('estado')
        user_id = _get_user_id()
        resultado = compliance_service.cambiar_estado_claim(id, estado, user_id)
        resultado['ok'] = True
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="compliance")
