"""
Sustainability Routes
Endpoints para gestión de sostenibilidad y ESG (Sprint 72)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.roles import require_auth
from backend.services import sustainability_service

logger = logging.getLogger(__name__)

sustainability_bp = Blueprint('sustainability', __name__, url_prefix='/api/sustainability')


@sustainability_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_sostenibilidad():
    """Obtener KPIs de sostenibilidad (alias del dashboard)."""
    try:
        dashboard = sustainability_service.obtener_dashboard_sostenibilidad()
        dashboard['ok'] = True
        return jsonify(dashboard), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_dashboard_sostenibilidad():
    """Obtener dashboard de sostenibilidad."""
    try:
        dashboard = sustainability_service.obtener_dashboard_sostenibilidad()
        dashboard['ok'] = True
        return jsonify(dashboard), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


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
        emisiones['ok'] = True
        return jsonify(emisiones), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/emissions', methods=['POST'])
@require_auth
def registrar_emision():
    """Registrar nueva emisión."""
    try:
        data = request.get_json()
        emision = sustainability_service.registrar_emision(data)
        return jsonify({'ok': True, 'id': emision}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


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
        return jsonify({'ok': True, 'items': scores}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/esg-scores', methods=['POST'])
@require_auth
def registrar_esg_proveedor():
    """Registrar score ESG de proveedor."""
    try:
        data = request.get_json()
        score = sustainability_service.registrar_esg_proveedor(data)
        return jsonify({'ok': True, 'id': score}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/goals', methods=['GET'])
@require_auth
def obtener_metas():
    """Obtener metas de sostenibilidad."""
    try:
        estado = request.args.get('estado')
        metas = sustainability_service.obtener_metas(estado)
        return jsonify({'ok': True, 'items': metas}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/goals', methods=['POST'])
@require_auth
def crear_meta():
    """Crear nueva meta de sostenibilidad."""
    try:
        data = request.get_json()
        meta = sustainability_service.crear_meta(data)
        return jsonify({'ok': True, 'id': meta}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/goals/<int:id>', methods=['PUT'])
@require_auth
def actualizar_meta(id):
    """Actualizar meta de sostenibilidad."""
    try:
        data = request.get_json()
        meta = sustainability_service.actualizar_meta(id, data)
        return jsonify({'ok': True, 'updated': meta}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/materials/footprint', methods=['GET'])
@require_auth
def obtener_huella_materiales():
    """Obtener huella de carbono de materiales."""
    try:
        materiales = sustainability_service.obtener_huella_materiales()
        return jsonify({'ok': True, 'items': materiales}), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


@sustainability_bp.route('/materials/footprint', methods=['POST'])
@require_auth
def registrar_huella_material():
    """Registrar huella de carbono de material."""
    try:
        data = request.get_json()
        material = sustainability_service.registrar_huella_material(data)
        return jsonify({'ok': True, 'saved': material}), 201
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")


# === Alias rutas en español (frontend usa estos nombres) ===

@sustainability_bp.route('/emisiones', methods=['GET'])
@require_auth
def obtener_emisiones_es():
    """Alias español de /emissions GET."""
    return obtener_emisiones()


@sustainability_bp.route('/emisiones', methods=['POST'])
@require_auth
def registrar_emision_es():
    """Alias español de /emissions POST."""
    return registrar_emision()


@sustainability_bp.route('/esg-proveedores', methods=['GET'])
@require_auth
def obtener_esg_proveedores_es():
    """Alias español de /esg-scores GET."""
    return obtener_esg_proveedores()


@sustainability_bp.route('/esg-evaluaciones', methods=['POST'])
@require_auth
def registrar_esg_evaluacion_es():
    """Alias español de /esg-scores POST."""
    return registrar_esg_proveedor()


@sustainability_bp.route('/metas', methods=['GET'])
@require_auth
def obtener_metas_es():
    """Alias español de /goals GET."""
    return obtener_metas()


@sustainability_bp.route('/metas', methods=['POST'])
@require_auth
def crear_meta_es():
    """Alias español de /goals POST."""
    return crear_meta()


@sustainability_bp.route('/metas/<int:id>', methods=['PUT'])
@require_auth
def actualizar_meta_es(id):
    """Alias español de /goals/<id> PUT."""
    return actualizar_meta(id)


@sustainability_bp.route('/huella-materiales', methods=['GET'])
@require_auth
def obtener_huella_materiales_es():
    """Alias español de /materials/footprint GET."""
    return obtener_huella_materiales()


@sustainability_bp.route('/huella-materiales', methods=['POST'])
@require_auth
def registrar_huella_material_es():
    """Alias español de /materials/footprint POST."""
    return registrar_huella_material()


@sustainability_bp.route('/orden-compra/<int:id>/footprint', methods=['GET'])
@require_auth
def calcular_huella_orden_compra(id):
    """Calcular huella de carbono de orden de compra."""
    try:
        huella = sustainability_service.calcular_huella_orden_compra(id)
        huella['ok'] = True
        return jsonify(huella), 200
    except Exception as e:
        return safe_error_response(e, logger, context="sustainability")
