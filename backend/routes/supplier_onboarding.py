"""
Supplier Onboarding Routes
Endpoints para gestión de onboarding de proveedores (Sprint 81)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.services import supplier_onboarding_service

logger = logging.getLogger(__name__)

supplier_onboarding_bp = Blueprint('supplier_onboarding', __name__, url_prefix='/api/supplier-onboarding')


@supplier_onboarding_bp.route('/', methods=['GET'])
@require_auth
def obtener_onboardings():
    """Obtener lista de onboardings con filtros y paginación."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'rubro': request.args.get('rubro'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        resultado = supplier_onboarding_service.obtener_onboardings(filtros)
        return jsonify({'ok': True, **resultado}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/', methods=['POST'])
@require_auth
def crear_onboarding():
    """Crear nuevo registro de onboarding."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        # Validaciones básicas
        if not data.get('razon_social') or not data.get('cuit'):
            return jsonify({'ok': False, 'error': 'Razón social y CUIT son obligatorios'}), 400

        onboarding_id = supplier_onboarding_service.crear_onboarding(data, user_id)

        if onboarding_id:
            return jsonify({'ok': True, 'id': onboarding_id}), 201
        else:
            return jsonify({'ok': False, 'error': 'Error al crear onboarding'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_onboarding(id):
    """Obtener detalle completo de un onboarding."""
    try:
        detalle = supplier_onboarding_service.obtener_detalle_onboarding(id)

        if detalle:
            return jsonify({'ok': True, **detalle}), 200
        else:
            return jsonify({'ok': False, 'error': 'Onboarding no encontrado'}), 404

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>', methods=['PUT'])
@require_auth
def actualizar_onboarding(id):
    """Actualizar datos de un onboarding."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        success = supplier_onboarding_service.actualizar_onboarding(id, data, user_id)

        if success:
            return jsonify({'ok': True, 'message': 'Onboarding actualizado'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Error al actualizar onboarding'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>/submit', methods=['POST'])
@require_auth
def enviar_a_revision(id):
    """Enviar onboarding a revisión."""
    try:
        user_id = _get_user_id()
        success = supplier_onboarding_service.enviar_a_revision(id, user_id)

        if success:
            return jsonify({'ok': True, 'message': 'Onboarding enviado a revisión'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Error al enviar a revisión'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>/documents', methods=['POST'])
@require_auth
def agregar_documento(id):
    """Agregar documento a un onboarding."""
    try:
        data = request.get_json()

        # Validaciones básicas
        if not data.get('tipo_documento') or not data.get('nombre_archivo'):
            return jsonify({'ok': False, 'error': 'Tipo y nombre de archivo son obligatorios'}), 400

        doc_id = supplier_onboarding_service.agregar_documento(id, data)

        if doc_id:
            return jsonify({'ok': True, 'id': doc_id}), 201
        else:
            return jsonify({'ok': False, 'error': 'Error al agregar documento'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>/documents/<int:doc_id>/review', methods=['PUT'])
@require_auth
def revisar_documento(id, doc_id):
    """Aprobar o rechazar un documento."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        aprobado = data.get('aprobado', False)
        notas = data.get('notas')

        success = supplier_onboarding_service.revisar_documento(doc_id, aprobado, user_id, notas)

        if success:
            return jsonify({'ok': True, 'message': 'Documento revisado'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Error al revisar documento'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>/evaluations', methods=['POST'])
@require_auth
def agregar_evaluacion(id):
    """Agregar evaluación de criterio."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        # Validaciones básicas
        if not data.get('criterio') or data.get('puntaje') is None:
            return jsonify({'ok': False, 'error': 'Criterio y puntaje son obligatorios'}), 400

        if not (0 <= data.get('puntaje', -1) <= 100):
            return jsonify({'ok': False, 'error': 'Puntaje debe estar entre 0 y 100'}), 400

        eval_id = supplier_onboarding_service.agregar_evaluacion(id, data, user_id)

        if eval_id:
            return jsonify({'ok': True, 'id': eval_id}), 201
        else:
            return jsonify({'ok': False, 'error': 'Error al agregar evaluación'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>/approve', methods=['PUT'])
@require_admin
def aprobar_onboarding(id):
    """Aprobar onboarding y crear proveedor (solo admin)."""
    try:
        user_id = _get_user_id()
        success = supplier_onboarding_service.aprobar_onboarding(id, user_id)

        if success:
            return jsonify({'ok': True, 'message': 'Onboarding aprobado y proveedor creado'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Error al aprobar onboarding'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/<int:id>/reject', methods=['PUT'])
@require_admin
def rechazar_onboarding(id):
    """Rechazar onboarding (solo admin)."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        razon = data.get('razon')
        if not razon:
            return jsonify({'ok': False, 'error': 'Razón de rechazo es obligatoria'}), 400

        success = supplier_onboarding_service.rechazar_onboarding(id, user_id, razon)

        if success:
            return jsonify({'ok': True, 'message': 'Onboarding rechazado'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Error al rechazar onboarding'}), 500

    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")


@supplier_onboarding_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs del dashboard de onboarding."""
    try:
        kpis = supplier_onboarding_service.obtener_kpis()
        return jsonify({'ok': True, 'kpis': kpis}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_onboarding")
