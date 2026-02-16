"""
Procurement Routes - SAP Requisitions and Purchase Orders
Refactored to use ProcurementService
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth, require_role
from backend.services.procurement_service import ProcurementService

logger = logging.getLogger(__name__)

procurement_bp = Blueprint('procurement', __name__, url_prefix='/api/procurement')

def ensure_procurement_views():
    """Wrapper for backward compatibility"""
    ProcurementService.ensure_procurement_views()

@procurement_bp.route('/solpeds', methods=['GET'])
@require_auth
def get_solpeds():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
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
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting solpeds: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/solpeds/<int:solped_id>', methods=['GET'])
@require_auth
def get_solped_detail(solped_id):
    try:
        result = ProcurementService.get_solped_detail(solped_id)
        if not result:
            return jsonify({"error": "Solped no encontrada"}), 404
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting solped detail: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/orders', methods=['GET'])
@require_auth
def get_orders():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
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
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting orders: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/orders/<int:pedido_id>', methods=['GET'])
@require_auth
def get_order_detail(pedido_id):
    try:
        result = ProcurementService.get_order_detail(pedido_id)
        if not result:
            return jsonify({"error": "Pedido no encontrado"}), 404
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting order detail: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    try:
        centro = request.args.get('centro')
        periodo = request.args.get('periodo', 'mes')
        return jsonify(ProcurementService.get_kpis(centro=centro, periodo=periodo))
    except Exception as e:
        logger.error(f"Error getting KPIs: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis/lead-times', methods=['GET'])
@require_auth
def get_lead_times():
    try:
        centro = request.args.get('centro')
        proveedor = request.args.get('proveedor')
        group_by = request.args.get('group_by', 'proveedor')
        
        return jsonify(ProcurementService.get_lead_times(
            centro=centro, proveedor=proveedor, group_by=group_by
        ))
    except Exception as e:
        logger.error(f"Error getting lead times: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis/compliance', methods=['GET'])
@require_auth
def get_compliance():
    try:
        min_pedidos = request.args.get('min_pedidos', 5, type=int)
        return jsonify({"items": ProcurementService.get_compliance(min_pedidos=min_pedidos)})
    except Exception as e:
        logger.error(f"Error getting compliance: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/kpis/costs', methods=['GET'])
@require_auth
def get_costs():
    try:
        material = request.args.get('material')
        moneda = request.args.get('moneda')
        min_trans = request.args.get('min_trans', 3, type=int)
        
        return jsonify({"items": ProcurementService.get_costs(
            material=material, moneda=moneda, min_trans=min_trans
        )})
    except Exception as e:
        logger.error(f"Error getting costs: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/import', methods=['POST'])
@require_auth
@require_role('admin')
def import_zm65():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        user_id = _get_user_id()
        result = ProcurementService.import_zm65_file(file, user_id=user_id)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error importing ZM65: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/import/history', methods=['GET'])
@require_auth
def get_import_history():
    try:
        limit = request.args.get('limit', 20, type=int)
        return jsonify({"items": ProcurementService.get_import_history(limit=limit)})
    except Exception as e:
        logger.error(f"Error getting import history: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/summary', methods=['GET'])
@require_auth
def get_summary():
    try:
        return jsonify({"items": ProcurementService.get_summary()})
    except Exception as e:
        logger.error(f"Error getting summary: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/pipeline', methods=['GET'])
@require_auth
def get_pipeline():
    try:
        return jsonify(ProcurementService.get_pipeline())
    except Exception as e:
        logger.error(f"Error getting pipeline: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/analytics', methods=['GET'])
@require_auth
def get_procurement_analytics():
    try:
        return jsonify(ProcurementService.get_procurement_analytics())
    except Exception as e:
        logger.error(f"Error getting analytics: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/<proveedor>', methods=['GET'])
@require_auth
def get_provider_scorecard(proveedor):
    try:
        periodo = request.args.get('periodo', 'anio')
        return jsonify(ProcurementService.get_provider_scorecard(proveedor, periodo=periodo))
    except Exception as e:
        logger.error(f"Error getting provider scorecard: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/price-history/<material_codigo>', methods=['GET'])
@require_auth
def get_price_history(material_codigo):
    try:
        centro = request.args.get('centro')
        moneda = request.args.get('moneda')
        limit = request.args.get('limit', 50, type=int)
        
        return jsonify(ProcurementService.get_price_history(
            material_codigo, centro=centro, moneda=moneda, limit=limit
        ))
    except Exception as e:
        logger.error(f"Error getting price history: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/ranking', methods=['GET'])
@require_auth
def get_provider_ranking():
    try:
        limit = request.args.get('limit', 20, type=int)
        periodo = request.args.get('periodo', 'anio')
        centro = request.args.get('centro')
        
        return jsonify(ProcurementService.get_provider_ranking(
            limit=limit, periodo=periodo, centro=centro
        ))
    except Exception as e:
        logger.error(f"Error getting ranking: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/comparar', methods=['GET', 'POST'])
@require_auth
def comparar_proveedores():
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            proveedor_ids = data.get('proveedor_ids', [])
            return jsonify(ProcurementService.compare_providers_side_by_side(proveedor_ids))

        material_codigo = request.args.get('material')
        if not material_codigo:
            return jsonify({"error": "Parámetro 'material' es requerido"}), 400
        
        centro = request.args.get('centro')
        return jsonify(ProcurementService.compare_providers(material_codigo, centro=centro))
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error comparing providers: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/ranking', methods=['GET'])
@require_auth
def get_scorecard_ranking():
    try:
        limit = request.args.get('limit', 50, type=int)
        periodo = request.args.get('periodo')
        return jsonify(ProcurementService.get_scorecard_ranking(limit=limit, periodo=periodo))
    except Exception as e:
        logger.error(f"Error getting scorecard ranking: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/<proveedor_id>/evaluar', methods=['POST'])
@require_auth
@require_role(['admin', 'planner'])
def evaluar_proveedor(proveedor_id):
    try:
        data = request.get_json() or {}
        user_id = _get_user_id()
        result = ProcurementService.evaluate_provider(proveedor_id, data, user_id)
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Error evaluating provider: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500

@procurement_bp.route('/scorecard/<proveedor_id>/historial', methods=['GET'])
@require_auth
def get_scorecard_historial(proveedor_id):
    try:
        meses = request.args.get('meses', 12, type=int)
        return jsonify(ProcurementService.get_scorecard_history(proveedor_id, meses=meses))
    except Exception as e:
        logger.error(f"Error getting scorecard history: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500
