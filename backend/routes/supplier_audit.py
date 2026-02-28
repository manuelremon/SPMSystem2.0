"""
Supplier Audit & Certifications Routes
Endpoints para auditorías y certificaciones (Sprint 69)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import supplier_audit_service

logger = logging.getLogger(__name__)

supplier_audit_bp = Blueprint('supplier_audit', __name__, url_prefix='/api/supplier-audit')


@supplier_audit_bp.route('/certifications', methods=['GET'])
@require_auth
def obtener_certificaciones():
    """Obtener certificaciones de proveedores con filtros."""
    try:
        filtros = {
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'tipo': request.args.get('tipo'),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        certificaciones = supplier_audit_service.obtener_certificaciones(filtros)
        certificaciones['ok'] = True
        return jsonify(certificaciones), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_certificaciones")


@supplier_audit_bp.route('/certifications', methods=['POST'])
@require_auth
def registrar_certificacion():
    """Registrar nueva certificación de proveedor."""
    try:
        data = request.get_json()
        certificacion = supplier_audit_service.registrar_certificacion(data)
        return jsonify(certificacion), 201
    except Exception as e:
        return safe_error_response(e, logger, context="registrar_certificacion")


@supplier_audit_bp.route('/certifications/<int:id>', methods=['PUT'])
@require_auth
def actualizar_certificacion(id):
    """Actualizar certificación existente."""
    try:
        data = request.get_json()
        certificacion = supplier_audit_service.actualizar_certificacion(id, data)
        return jsonify(certificacion), 200
    except Exception as e:
        return safe_error_response(e, logger, context="actualizar_certificacion")


@supplier_audit_bp.route('/certifications/expiring', methods=['GET'])
@require_auth
def alertas_vencimiento():
    """Obtener certificaciones próximas a vencer."""
    try:
        dias = int(request.args.get('dias', 30))
        alertas = supplier_audit_service.alertas_vencimiento(dias)
        return jsonify({'ok': True, 'items': alertas}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="alertas_vencimiento")


@supplier_audit_bp.route('/audits', methods=['GET'])
@require_auth
def obtener_auditorias():
    """Obtener auditorías de proveedores con filtros."""
    try:
        filtros = {
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'estado': request.args.get('estado'),
            'tipo': request.args.get('tipo'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        auditorias = supplier_audit_service.obtener_auditorias(filtros)
        auditorias['ok'] = True
        return jsonify(auditorias), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_auditorias")


@supplier_audit_bp.route('/audits', methods=['POST'])
@require_auth
def crear_auditoria():
    """Crear nueva auditoría de proveedor."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        auditoria = supplier_audit_service.crear_auditoria(data, user_id)
        return jsonify(auditoria), 201
    except Exception as e:
        return safe_error_response(e, logger, context="crear_auditoria")


@supplier_audit_bp.route('/audits/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_auditoria(id):
    """Obtener detalle completo de auditoría."""
    try:
        detalle = supplier_audit_service.obtener_detalle_auditoria(id)
        return jsonify(detalle), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_detalle_auditoria")


@supplier_audit_bp.route('/audits/<int:id>/result', methods=['PUT'])
@require_auth
def registrar_resultado(id):
    """Registrar resultado de auditoría."""
    try:
        data = request.get_json()
        resultado = supplier_audit_service.registrar_resultado(id, data)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="registrar_resultado")


@supplier_audit_bp.route('/findings/<int:id>/resolve', methods=['PUT'])
@require_auth
def resolver_hallazgo(id):
    """Resolver hallazgo de auditoría."""
    try:
        data = request.get_json()
        hallazgo = supplier_audit_service.resolver_hallazgo(id, data)
        return jsonify(hallazgo), 200
    except Exception as e:
        return safe_error_response(e, logger, context="resolver_hallazgo")


@supplier_audit_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_auditorias():
    """Obtener KPIs de auditorías de proveedores."""
    try:
        kpis = supplier_audit_service.obtener_kpis_auditorias()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_kpis_auditorias")
