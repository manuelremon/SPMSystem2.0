"""
Packaging Routes
API para gestión de empaque, packing lists y etiquetas de envío
"""
import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import packaging_service

logger = logging.getLogger(__name__)

packaging_bp = Blueprint('packaging', __name__, url_prefix='/api/packaging')


@packaging_bp.route('/templates', methods=['GET'])
@require_auth
def get_templates():
    """Obtener templates de empaque"""
    try:
        tipo = request.args.get('tipo')
        estado = request.args.get('estado', 'active')

        templates = packaging_service.obtener_templates(tipo=tipo, estado=estado)

        return jsonify({
            'ok': True,
            'templates': templates
        }), 200

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.get_templates")


@packaging_bp.route('/templates', methods=['POST'])
@require_auth
def create_template():
    """Crear template de empaque"""
    try:
        datos = request.get_json()

        if not datos.get('nombre') or not datos.get('tipo'):
            return jsonify({
                'ok': False,
                'error': 'Nombre y tipo son requeridos'
            }), 400

        if datos['tipo'] not in ['caja', 'pallet', 'contenedor']:
            return jsonify({
                'ok': False,
                'error': 'Tipo inválido'
            }), 400

        template = packaging_service.crear_template(datos)

        return jsonify({
            'ok': True,
            'template': template
        }), 201

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.create_template")


@packaging_bp.route('/packing-lists', methods=['GET'])
@require_auth
def get_packing_lists():
    """Obtener packing lists"""
    try:
        estado = request.args.get('estado')
        orden_compra_id = request.args.get('orden_compra_id', type=int)

        packings = packaging_service.obtener_packing_lists(
            estado=estado,
            orden_compra_id=orden_compra_id
        )

        return jsonify({
            'ok': True,
            'packing_lists': packings
        }), 200

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.get_packing_lists")


@packaging_bp.route('/packing-lists', methods=['POST'])
@require_auth
def create_packing_list():
    """Crear packing list"""
    try:
        datos = request.get_json()
        usuario_id = _get_user_id()

        packing = packaging_service.crear_packing_list(datos, usuario_id)

        return jsonify({
            'ok': True,
            'packing_list': packing
        }), 201

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.create_packing_list")


@packaging_bp.route('/packing-lists/<int:packing_id>', methods=['GET'])
@require_auth
def get_packing_detail(packing_id):
    """Obtener detalle de packing list"""
    try:
        packing = packaging_service.obtener_detalle_packing(packing_id)

        if not packing:
            return jsonify({
                'ok': False,
                'error': 'Packing list no encontrado'
            }), 404

        return jsonify({
            'ok': True,
            'packing_list': packing
        }), 200

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.get_packing_detail")


@packaging_bp.route('/packing-lists/<int:packing_id>/items', methods=['POST'])
@require_auth
def add_item(packing_id):
    """Agregar item a packing list"""
    try:
        datos = request.get_json()

        if not datos.get('material_codigo') or not datos.get('cantidad'):
            return jsonify({
                'ok': False,
                'error': 'Material y cantidad son requeridos'
            }), 400

        item = packaging_service.agregar_item(packing_id, datos)

        return jsonify({
            'ok': True,
            'item': item
        }), 201

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="packaging.add_item")
    except Exception as e:
        return safe_error_response(e, logger, context="packaging.add_item")


@packaging_bp.route('/packing-lists/<int:packing_id>/items/<int:item_id>', methods=['DELETE'])
@require_auth
def delete_item(packing_id, item_id):
    """Eliminar item de packing list"""
    try:
        packaging_service.eliminar_item(packing_id, item_id)

        return jsonify({
            'ok': True,
            'message': 'Item eliminado exitosamente'
        }), 200

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="packaging.delete_item")
    except Exception as e:
        return safe_error_response(e, logger, context="packaging.delete_item")


@packaging_bp.route('/packing-lists/<int:packing_id>/optimize', methods=['POST'])
@require_auth
def optimize_packing(packing_id):
    """Optimizar distribución de items en bultos"""
    try:
        resultado = packaging_service.optimizar_empaque(packing_id)

        return jsonify({
            'ok': True,
            'resultado': resultado
        }), 200

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.optimize_packing")


@packaging_bp.route('/packing-lists/<int:packing_id>/pack', methods=['PUT'])
@require_auth
def pack_packing_list(packing_id):
    """Marcar packing list como empacado"""
    try:
        packing = packaging_service.empacar(packing_id)

        return jsonify({
            'ok': True,
            'packing_list': packing
        }), 200

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="packaging.pack_packing_list")
    except Exception as e:
        return safe_error_response(e, logger, context="packaging.pack_packing_list")


@packaging_bp.route('/packing-lists/<int:packing_id>/dispatch', methods=['PUT'])
@require_auth
def dispatch_packing_list(packing_id):
    """Despachar packing list"""
    try:
        packing = packaging_service.despachar(packing_id)

        return jsonify({
            'ok': True,
            'packing_list': packing
        }), 200

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="packaging.dispatch_packing_list")
    except Exception as e:
        return safe_error_response(e, logger, context="packaging.dispatch_packing_list")


@packaging_bp.route('/packing-lists/<int:packing_id>/labels', methods=['POST'])
@require_auth
def generate_label(packing_id):
    """Generar etiqueta de envío"""
    try:
        datos = request.get_json()

        if not datos.get('bulto_numero'):
            return jsonify({
                'ok': False,
                'error': 'Número de bulto es requerido'
            }), 400

        tipo = datos.get('tipo', 'shipping')
        formato = datos.get('formato', 'pdf')

        if tipo not in ['shipping', 'return', 'hazmat', 'customs']:
            return jsonify({
                'ok': False,
                'error': 'Tipo de etiqueta inválido'
            }), 400

        if formato not in ['pdf', 'zpl', 'png']:
            return jsonify({
                'ok': False,
                'error': 'Formato inválido'
            }), 400

        label = packaging_service.generar_etiqueta(
            packing_id,
            datos['bulto_numero'],
            tipo,
            formato
        )

        return jsonify({
            'ok': True,
            'label': label
        }), 201

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="packaging.generate_label")
    except Exception as e:
        return safe_error_response(e, logger, context="packaging.generate_label")


@packaging_bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """Obtener KPIs de packaging"""
    try:
        kpis = packaging_service.obtener_kpis()

        return jsonify({
            'ok': True,
            'kpis': kpis
        }), 200

    except Exception as e:
        return safe_error_response(e, logger, context="packaging.get_kpis")
