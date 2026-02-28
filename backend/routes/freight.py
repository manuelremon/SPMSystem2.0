"""
Freight Audit & Payment Routes
Endpoints para auditoría de fletes (Sprint 70)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import freight_audit_service

freight_bp = Blueprint('freight', __name__, url_prefix='/api/freight')


@freight_bp.route('/invoices', methods=['GET'])
@require_auth
def obtener_facturas_flete():
    """Obtener facturas de flete con filtros."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'transportista_cuit': request.args.get('transportista_cuit'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        facturas = freight_audit_service.obtener_facturas_flete(filtros)
        facturas['ok'] = True
        return jsonify(facturas), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/invoices', methods=['POST'])
@require_auth
def registrar_factura_flete():
    """Registrar nueva factura de flete."""
    try:
        data = request.get_json()
        factura = freight_audit_service.registrar_factura_flete(data)
        return jsonify(factura), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/invoices/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_factura_flete(id):
    """Obtener detalle completo de factura de flete."""
    try:
        detalle = freight_audit_service.obtener_detalle_factura_flete(id)
        return jsonify(detalle), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/invoices/<int:id>/audit', methods=['POST'])
@require_auth
def auditar_factura(id):
    """Auditar factura de flete contra tarifas."""
    try:
        resultado = freight_audit_service.auditar_factura(id)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/invoices/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_factura(id):
    """Aprobar factura de flete."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        monto_aprobado = data.get('monto_aprobado')
        resultado = freight_audit_service.aprobar_factura(id, user_id, monto_aprobado)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/invoices/<int:id>/dispute', methods=['PUT'])
@require_auth
def disputar_factura(id):
    """Disputar factura de flete."""
    try:
        data = request.get_json()
        razon = data.get('razon')
        resultado = freight_audit_service.disputar_factura(id, razon)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/tariffs', methods=['GET'])
@require_auth
def obtener_tarifas():
    """Obtener tarifas de flete configuradas."""
    try:
        filtros = {
            'transportista_cuit': request.args.get('transportista_cuit')
        }
        tarifas = freight_audit_service.obtener_tarifas(filtros)
        tarifas['ok'] = True
        return jsonify(tarifas), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/tariffs', methods=['POST'])
@require_auth
def crear_tarifa():
    """Crear nueva tarifa de flete."""
    try:
        data = request.get_json()
        tarifa = freight_audit_service.crear_tarifa(data)
        return jsonify(tarifa), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_freight():
    """Obtener KPIs de auditoría de fletes."""
    try:
        kpis = freight_audit_service.obtener_kpis_freight()
        kpis['ok'] = True
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@freight_bp.route('/carrier-performance', methods=['GET'])
@require_auth
def rendimiento_transportistas():
    """Obtener rendimiento de transportistas."""
    try:
        rendimiento = freight_audit_service.rendimiento_transportistas()
        return jsonify({'ok': True, 'items': rendimiento}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
