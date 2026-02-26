"""
Rutas para gestión de financiamiento de proveedores.
Sprint 89: Supplier Finance
"""
from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth, require_role
from backend.services import supplier_finance_service as sf_service

supplier_finance_bp = Blueprint('supplier_finance', __name__, url_prefix='/api/supplier-finance')


@supplier_finance_bp.route('/programs', methods=['GET'])
@require_auth
def get_programs():
    """Obtener programas de descuento."""
    try:
        estado = request.args.get('estado')
        programas = sf_service.obtener_programas(estado)
        return jsonify({'ok': True, 'programas': programas}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/programs', methods=['POST'])
@require_auth
@require_role('admin')
def create_program():
    """Crear programa de descuento."""
    try:
        data = request.get_json()
        programa_id = sf_service.crear_programa(
            nombre=data['nombre'],
            tipo=data['tipo'],
            descuento_base_pct=data['descuento_base_pct'],
            dias_anticipacion=data.get('dias_anticipacion'),
            formula=data.get('formula'),
            presupuesto_anual=data.get('presupuesto_anual')
        )
        return jsonify({'ok': True, 'programa_id': programa_id}), 201
    except KeyError as e:
        return jsonify({'ok': False, 'error': f'Campo requerido: {e}'}), 400
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/programs/<int:programa_id>/generate-offers', methods=['POST'])
@require_auth
@require_role('admin')
def generate_offers(programa_id):
    """Generar ofertas de descuento para un programa."""
    try:
        data = request.get_json() or {}
        dias_horizonte = data.get('dias_horizonte', 30)

        ofertas_ids = sf_service.generar_ofertas(programa_id, dias_horizonte)

        return jsonify({
            'ok': True,
            'ofertas_generadas': len(ofertas_ids),
            'ofertas_ids': ofertas_ids
        }), 201
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/offers', methods=['GET'])
@require_auth
def get_offers():
    """Obtener ofertas de descuento."""
    try:
        estado = request.args.get('estado')
        proveedor_cuit = request.args.get('proveedor_cuit')

        ofertas = sf_service.obtener_ofertas(estado, proveedor_cuit)
        return jsonify({'ok': True, 'ofertas': ofertas}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/offers/<int:oferta_id>/accept', methods=['PUT'])
@require_auth
@require_role('admin')
def accept_offer(oferta_id):
    """Aceptar oferta de descuento."""
    try:
        success = sf_service.aceptar_oferta(oferta_id, _get_user_id())
        if success:
            return jsonify({'ok': True, 'message': 'Oferta aceptada exitosamente'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Oferta no encontrada o ya procesada'}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/offers/<int:oferta_id>/reject', methods=['PUT'])
@require_auth
@require_role('admin')
def reject_offer(oferta_id):
    """Rechazar oferta de descuento."""
    try:
        success = sf_service.rechazar_oferta(oferta_id)
        if success:
            return jsonify({'ok': True, 'message': 'Oferta rechazada exitosamente'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Oferta no encontrada o ya procesada'}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/offers/<int:oferta_id>/pay', methods=['PUT'])
@require_auth
@require_role('admin')
def mark_offer_paid(oferta_id):
    """Marcar oferta como pagada."""
    try:
        success = sf_service.marcar_pagada(oferta_id)
        if success:
            return jsonify({'ok': True, 'message': 'Oferta marcada como pagada exitosamente'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Oferta no encontrada o no está aceptada'}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/payment-terms', methods=['GET'])
@require_auth
def get_payment_terms():
    """Obtener términos de pago de proveedores."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        terminos = sf_service.obtener_terminos_proveedor(proveedor_cuit)
        return jsonify({'ok': True, 'terminos': terminos}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/payment-terms/<proveedor_cuit>', methods=['PUT'])
@require_auth
@require_role('admin')
def update_payment_terms(proveedor_cuit):
    """Actualizar términos de pago de proveedor."""
    try:
        data = request.get_json()
        success = sf_service.actualizar_terminos(
            proveedor_cuit=proveedor_cuit,
            termino_estandar_dias=data.get('termino_estandar_dias'),
            termino_negociado_dias=data.get('termino_negociado_dias'),
            descuento_pronto_pago_pct=data.get('descuento_pronto_pago_pct')
        )
        if success:
            return jsonify({'ok': True, 'message': 'Términos actualizados exitosamente'}), 200
        else:
            return jsonify({'ok': False, 'error': 'Error al actualizar términos'}), 500
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/simulate', methods=['POST'])
@require_auth
def simulate_cashflow():
    """Simular impacto en cashflow."""
    try:
        data = request.get_json()
        simulaciones = sf_service.simular_cashflow(
            escenario=data['escenario'],
            dias_anticipacion=data['dias_anticipacion'],
            descuento_pct=data['descuento_pct'],
            porcentaje_facturas_elegibles=data['porcentaje_facturas_elegibles'],
            created_by=_get_user_id()
        )
        return jsonify({'ok': True, 'simulaciones': simulaciones}), 201
    except KeyError as e:
        return jsonify({'ok': False, 'error': f'Campo requerido: {e}'}), 400
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@supplier_finance_bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """Obtener KPIs de financiamiento."""
    try:
        kpis = sf_service.obtener_kpis()
        return jsonify({'ok': True, 'kpis': kpis}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500
