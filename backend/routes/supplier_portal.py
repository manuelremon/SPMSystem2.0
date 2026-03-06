"""
Supplier Portal Routes
Endpoints para portal de proveedores (Sprint 74)
"""

import logging

from flask import Blueprint, g, jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_admin, require_auth
from backend.services import supplier_portal_service

logger = logging.getLogger(__name__)

supplier_portal_bp = Blueprint('supplier_portal', __name__, url_prefix='/api/supplier-portal')


def _validate_supplier_ownership(proveedor_cuit):
    """Valida que el usuario autenticado tenga relacion con el proveedor consultado."""
    user = g.user
    if not user:
        return False
    # Admins pueden acceder a cualquier proveedor
    roles = user.get("roles", [])
    if isinstance(roles, str):
        roles = [roles]
    role_names = [r.get("nombre", r) if isinstance(r, dict) else r for r in roles]
    if any(r in ("admin", "administrador") for r in role_names):
        return True
    # Usuarios normales solo pueden acceder a su propio proveedor
    user_cuit = user.get("proveedor_cuit") or user.get("cuit")
    return user_cuit and str(user_cuit) == str(proveedor_cuit)


@supplier_portal_bp.route('/auth/login', methods=['POST'])
@rate_limit(requests=10, window_seconds=60, burst=3, by_user=False, by_ip=True)
def autenticar_portal():
    """Autenticar usuario de portal de proveedor."""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        resultado = supplier_portal_service.autenticar_portal(email, password)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.login")


@supplier_portal_bp.route('/pos', methods=['GET'])
@require_auth
def obtener_pos_proveedor():
    """Obtener órdenes de compra del proveedor."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        if not _validate_supplier_ownership(proveedor_cuit):
            return jsonify({"ok": False, "error": "Access denied"}), 403
        pos = supplier_portal_service.obtener_pos_proveedor(proveedor_cuit)
        return jsonify(pos), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.pos")


@supplier_portal_bp.route('/pos/<int:id>/acknowledge', methods=['PUT'])
@require_auth
def reconocer_po(id):
    """Reconocer recepción de orden de compra."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        if not _validate_supplier_ownership(proveedor_cuit):
            return jsonify({"ok": False, "error": "Access denied"}), 403
        resultado = supplier_portal_service.reconocer_po(id, proveedor_cuit)
        return jsonify(resultado), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.acknowledge")


@supplier_portal_bp.route('/asns', methods=['GET'])
@require_auth
def obtener_asns():
    """Obtener ASNs del proveedor."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        if not _validate_supplier_ownership(proveedor_cuit):
            return jsonify({"ok": False, "error": "Access denied"}), 403
        estado = request.args.get('estado')
        asns = supplier_portal_service.obtener_asns(proveedor_cuit, estado)
        return jsonify(asns), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.asns_get")


@supplier_portal_bp.route('/asns', methods=['POST'])
@require_auth
def crear_asn():
    """Crear nuevo ASN (Advanced Shipping Notice)."""
    try:
        data = request.get_json()
        asn = supplier_portal_service.crear_asn(data)
        return jsonify(asn), 201
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.asns_create")


@supplier_portal_bp.route('/forecasts', methods=['GET'])
@require_auth
def obtener_forecasts_compartidos():
    """Obtener forecasts compartidos con el proveedor."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        if not _validate_supplier_ownership(proveedor_cuit):
            return jsonify({"ok": False, "error": "Access denied"}), 403
        forecasts = supplier_portal_service.obtener_forecasts_compartidos(proveedor_cuit)
        return jsonify(forecasts), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.forecasts")


@supplier_portal_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_dashboard_portal():
    """Obtener dashboard del portal de proveedor."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        if not _validate_supplier_ownership(proveedor_cuit):
            return jsonify({"ok": False, "error": "Access denied"}), 403
        dashboard = supplier_portal_service.obtener_dashboard_portal(proveedor_cuit)
        return jsonify(dashboard), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.dashboard")


@supplier_portal_bp.route('/admin/users', methods=['GET'])
@require_admin
def obtener_usuarios_portal():
    """Obtener usuarios del portal de proveedores (Admin)."""
    try:
        filtros = {
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        usuarios = supplier_portal_service.obtener_usuarios_portal(filtros)
        return jsonify(usuarios), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.obtener_usuarios_portal")


@supplier_portal_bp.route('/admin/users', methods=['POST'])
@require_admin
def crear_usuario_portal():
    """Crear nuevo usuario de portal de proveedor (Admin)."""
    try:
        data = request.get_json()
        usuario = supplier_portal_service.crear_usuario_portal(data)
        return jsonify(usuario), 201
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.crear_usuario_portal")


@supplier_portal_bp.route('/admin/users/<int:id>', methods=['PUT'])
@require_admin
def actualizar_usuario_portal(id):
    """Actualizar usuario de portal de proveedor (Admin)."""
    try:
        data = request.get_json()
        usuario = supplier_portal_service.actualizar_usuario_portal(id, data)
        return jsonify(usuario), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.actualizar_usuario_portal")


@supplier_portal_bp.route('/admin/share-forecast', methods=['POST'])
@require_admin
def compartir_forecast():
    """Compartir forecast con proveedor (Admin)."""
    try:
        data = request.get_json()
        resultado = supplier_portal_service.compartir_forecast(data)
        return jsonify(resultado), 201
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.compartir_forecast")


@supplier_portal_bp.route('/admin/activity', methods=['GET'])
@require_admin
def obtener_actividad_proveedores():
    """Obtener actividad de proveedores en el portal (Admin)."""
    try:
        actividad = supplier_portal_service.obtener_actividad_proveedores()
        return jsonify(actividad), 200
    except Exception as e:
        return safe_error_response(e, logger, context="supplier_portal.obtener_actividad_proveedores")
