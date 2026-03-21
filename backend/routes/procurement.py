"""
Procurement Routes - SAP Requisitions and Purchase Orders
Refactored to use ProcurementService
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth, require_role
from backend.services.procurement_service import ProcurementService

logger = logging.getLogger(__name__)

procurement_bp = Blueprint('procurement', __name__, url_prefix='/api/procurement')


@procurement_bp.record_once
def _on_register(state):
    """Crear vistas de procurement al registrar el blueprint."""
    try:
        ProcurementService.ensure_procurement_views()
    except Exception as e:
        logger.warning(f"Could not create procurement views on startup: {e}")


def ensure_procurement_views():
    """Wrapper for backward compatibility"""
    ProcurementService.ensure_procurement_views()

@procurement_bp.route('/solpeds', methods=['GET'])
@require_auth
def get_solpeds():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 500)
        centro = request.args.get('centro')
        material = request.args.get('material')
        estado = request.args.get('estado')
        fecha_desde = request.args.get('fecha_desde')
        fecha_hasta = request.args.get('fecha_hasta')
        search = request.args.get('search')

        result = ProcurementService.get_solpeds(
            page=page, per_page=per_page, centro=centro,
            material=material, estado=estado,
            fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
            search=search
        )
        result['ok'] = True
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting solpeds: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/solpeds/<solped_id>', methods=['GET'])
@require_auth
def get_solped_detail(solped_id):
    try:
        result = ProcurementService.get_solped_detail(solped_id)
        if not result:
            return jsonify({"ok": False, "error": "Solped no encontrada"}), 404
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting solped detail: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/orders', methods=['GET'])
@require_auth
def get_orders():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 500)
        proveedor = request.args.get('proveedor')
        material = request.args.get('material')
        fecha_desde = request.args.get('fecha_desde')
        fecha_hasta = request.args.get('fecha_hasta')
        recibido = request.args.get('recibido') == 'true'

        result = ProcurementService.get_orders(
            page=page, per_page=per_page, proveedor=proveedor,
            material=material, fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta, recibido=recibido
        )
        result['ok'] = True
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting orders: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/orders/<pedido_id>', methods=['GET'])
@require_auth
def get_order_detail(pedido_id):
    try:
        result = ProcurementService.get_order_detail(pedido_id)
        if not result:
            return jsonify({"ok": False, "error": "Pedido no encontrado"}), 404
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting order detail: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    try:
        centro = request.args.get('centro')
        periodo = request.args.get('periodo', 'mes')
        result = ProcurementService.get_kpis(centro=centro, periodo=periodo)
        result['ok'] = True
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting KPIs: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis/lead-times', methods=['GET'])
@require_auth
def get_lead_times():
    try:
        centro = request.args.get('centro')
        proveedor = request.args.get('proveedor')
        group_by = request.args.get('group_by', 'proveedor')
        
        result = ProcurementService.get_lead_times(
            centro=centro, proveedor=proveedor, group_by=group_by
        )
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting lead times: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis/compliance', methods=['GET'])
@require_auth
def get_compliance():
    try:
        min_pedidos = request.args.get('min_pedidos', 5, type=int)
        limit = request.args.get('limit', 50, type=int)
        return jsonify({"ok": True, "items": ProcurementService.get_compliance(min_pedidos=min_pedidos, limit=limit)})
    except Exception as e:
        logger.error(f"Error getting compliance: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis/costs', methods=['GET'])
@require_auth
def get_costs():
    try:
        material = request.args.get('material')
        moneda = request.args.get('moneda')
        min_trans = request.args.get('min_trans', 3, type=int)
        
        return jsonify({"ok": True, "items": ProcurementService.get_costs(
            material=material, moneda=moneda, min_trans=min_trans
        )})
    except Exception as e:
        logger.error(f"Error getting costs: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/import', methods=['POST'])
@require_auth
@require_role('admin')
def import_zm65():
    try:
        if 'file' not in request.files:
            return jsonify({"ok": False, "error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"ok": False, "error": "No selected file"}), 400
            
        user_id = _get_user_id()
        result = ProcurementService.import_zm65_file(file, user_id=user_id)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error importing ZM65: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/import/history', methods=['GET'])
@require_auth
def get_import_history():
    try:
        limit = request.args.get('limit', 20, type=int)
        return jsonify({"ok": True, "items": ProcurementService.get_import_history(limit=limit)})
    except Exception as e:
        logger.error(f"Error getting import history: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/summary', methods=['GET'])
@require_auth
def get_summary():
    try:
        return jsonify({"ok": True, "items": ProcurementService.get_summary()})
    except Exception as e:
        logger.error(f"Error getting summary: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/pipeline', methods=['GET'])
@require_auth
def get_pipeline():
    try:
        return jsonify({"ok": True, "items": ProcurementService.get_pipeline()})
    except Exception as e:
        logger.error(f"Error getting pipeline: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/analytics', methods=['GET'])
@require_auth
def get_procurement_analytics():
    try:
        result = ProcurementService.get_procurement_analytics()
        result['ok'] = True
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting analytics: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/<proveedor>', methods=['GET'])
@require_auth
def get_provider_scorecard(proveedor):
    try:
        periodo = request.args.get('periodo', 'anio')
        result = ProcurementService.get_provider_scorecard(proveedor, periodo=periodo)
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting provider scorecard: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/price-history/<material_codigo>', methods=['GET'])
@require_auth
def get_price_history(material_codigo):
    try:
        centro = request.args.get('centro')
        moneda = request.args.get('moneda')
        limit = request.args.get('limit', 50, type=int)

        result = ProcurementService.get_price_history(
            material_codigo, centro=centro, moneda=moneda, limit=limit
        )
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting price history: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/ranking', methods=['GET'])
@require_auth
def get_provider_ranking():
    try:
        limit = request.args.get('limit', 20, type=int)
        periodo = request.args.get('periodo', 'anio')
        centro = request.args.get('centro')

        result = ProcurementService.get_provider_ranking(
            limit=limit, periodo=periodo, centro=centro
        )
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting ranking: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/comparar', methods=['GET', 'POST'])
@require_auth
def comparar_proveedores():
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            proveedor_ids = data.get('proveedor_ids', [])
            result = ProcurementService.compare_providers_side_by_side(proveedor_ids)
            if isinstance(result, dict):
                result['ok'] = True
            else:
                result = {'ok': True, 'items': result}
            return jsonify(result)

        material_codigo = request.args.get('material')
        if not material_codigo:
            return jsonify({"ok": False, "error": "Parámetro 'material' es requerido"}), 400

        centro = request.args.get('centro')
        result = ProcurementService.compare_providers(material_codigo, centro=centro)
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="procurement.comparar_proveedores")
    except Exception as e:
        logger.error(f"Error comparing providers: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/ranking', methods=['GET'])
@require_auth
def get_scorecard_ranking():
    try:
        limit = request.args.get('limit', 50, type=int)
        periodo = request.args.get('periodo')
        result = ProcurementService.get_scorecard_ranking(limit=limit, periodo=periodo)
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting scorecard ranking: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/<proveedor_id>/evaluar', methods=['POST'])
@require_auth
@require_role(['admin', 'planner'])
def evaluar_proveedor(proveedor_id):
    try:
        data = request.get_json() or {}
        user_id = _get_user_id()
        result = ProcurementService.evaluate_provider(proveedor_id, data, user_id)
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'id': result}
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Error evaluating provider: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/<proveedor_id>/historial', methods=['GET'])
@require_auth
def get_scorecard_historial(proveedor_id):
    try:
        meses = request.args.get('meses', 12, type=int)
        result = ProcurementService.get_scorecard_history(proveedor_id, meses=meses)
        if isinstance(result, dict):
            result['ok'] = True
        else:
            result = {'ok': True, 'items': result}
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting scorecard history: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Error interno del servidor"}), 500
