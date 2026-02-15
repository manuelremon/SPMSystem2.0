"""
Sustainability Routes
Endpoints para gestión de sostenibilidad y ESG (Sprint 72)
"""

from flask import Blueprint, jsonify, request

from backend.core.roles import require_auth
from backend.services import sustainability_service

sustainability_bp = Blueprint('sustainability', __name__, url_prefix='/api/sustainability')


@sustainability_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_dashboard_sostenibilidad():
    """Obtener dashboard de sostenibilidad."""
    try:
        dashboard = sustainability_service.obtener_dashboard_sostenibilidad()
        return jsonify(dashboard), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/emissions', methods=['GET'])
@require_auth
def obtener_emisiones():
    """Obtener emisiones con filtros."""
    try:
        filtros = {
            'scope': request.args.get('scope'),
            'categoria': request.args.get('categoria'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        emisiones = sustainability_service.obtener_emisiones(filtros)
        return jsonify(emisiones), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/emissions', methods=['POST'])
@require_auth
def registrar_emision():
    """Registrar nueva emisión."""
    try:
        data = request.get_json()
        emision = sustainability_service.registrar_emision(data)
        return jsonify(emision), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/esg-scores', methods=['GET'])
@require_auth
def obtener_esg_proveedores():
    """Obtener scores ESG de proveedores con filtros."""
    try:
        filtros = {
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'certificacion': request.args.get('certificacion'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        scores = sustainability_service.obtener_esg_proveedores(filtros)
        return jsonify(scores), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/esg-scores', methods=['POST'])
@require_auth
def registrar_esg_proveedor():
    """Registrar score ESG de proveedor."""
    try:
        data = request.get_json()
        score = sustainability_service.registrar_esg_proveedor(data)
        return jsonify(score), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/goals', methods=['GET'])
@require_auth
def obtener_metas():
    """Obtener metas de sostenibilidad."""
    try:
        estado = request.args.get('estado')
        metas = sustainability_service.obtener_metas(estado)
        return jsonify(metas), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/goals', methods=['POST'])
@require_auth
def crear_meta():
    """Crear nueva meta de sostenibilidad."""
    try:
        data = request.get_json()
        meta = sustainability_service.crear_meta(data)
        return jsonify(meta), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/goals/<int:id>', methods=['PUT'])
@require_auth
def actualizar_meta(id):
    """Actualizar meta de sostenibilidad."""
    try:
        data = request.get_json()
        meta = sustainability_service.actualizar_meta(id, data)
        return jsonify(meta), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/materials/footprint', methods=['GET'])
@require_auth
def obtener_huella_materiales():
    """Obtener huella de carbono de materiales."""
    try:
        materiales = sustainability_service.obtener_huella_materiales()
        return jsonify(materiales), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/materials/footprint', methods=['POST'])
@require_auth
def registrar_huella_material():
    """Registrar huella de carbono de material."""
    try:
        data = request.get_json()
        material = sustainability_service.registrar_huella_material(data)
        return jsonify(material), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sustainability_bp.route('/orden-compra/<int:id>/footprint', methods=['GET'])
@require_auth
def calcular_huella_orden_compra(id):
    """Calcular huella de carbono de orden de compra."""
    try:
        huella = sustainability_service.calcular_huella_orden_compra(id)
        return jsonify(huella), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
