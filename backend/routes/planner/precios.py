"""
Planner - Precios Negociados

Endpoints para gestion de precios negociados con proveedores.
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.errors import error_internal, error_validation
from backend.core.repository import ProveedorPreciosRepository
from backend.core.roles import require_auth
from backend.routes.planner_helpers import _current_user, _require_planner_role

logger = logging.getLogger(__name__)

precios_bp = Blueprint("precios", __name__)


@precios_bp.route("/proveedores/<cuit>/precios", methods=["GET"])
@require_auth
def listar_precios_proveedor(cuit):
    """
    Lista todos los precios negociados de un proveedor.

    Query params opcionales:
    - activo: 1/0 (filtra solo activos)
    - material: codigo de material especifico
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, _ = _require_planner_role(user)
    if guard:
        return guard

    try:
        solo_activos = request.args.get("activo", "1") == "1"
        material = request.args.get("material")

        precios = ProveedorPreciosRepository.listar_por_proveedor(cuit, solo_activos=solo_activos)

        # Filtrar por material si se especifica
        if material:
            precios = [p for p in precios if p.get("codigo_material") == material]

        return jsonify({"ok": True, "data": precios}), 200

    except Exception as e:
        logger.error(f"Error listando precios proveedor {cuit}: {e}")
        return error_internal("Error al obtener precios del proveedor")


@precios_bp.route("/proveedores/<cuit>/precios", methods=["POST"])
@require_auth
def crear_precio_negociado(cuit):
    """
    Crea o actualiza un precio negociado para proveedor/material.

    Body JSON esperado:
    {
        "codigo_material": "12345678",
        "precio_usd": 150.50,
        "moneda": "USD",
        "fecha_vigencia_desde": "2024-01-01",
        "fecha_vigencia_hasta": "2024-12-31",
        "condicion_pago": "30 dias",
        "cantidad_minima": 10,
        "notas": "Precio especial por volumen"
    }
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, _ = _require_planner_role(user)
    if guard:
        return guard

    try:
        data = request.get_json(silent=True) or {}

        # Validaciones
        codigo_material = data.get("codigo_material")
        precio_usd = data.get("precio_usd")
        fecha_desde = data.get("fecha_vigencia_desde")

        if not codigo_material:
            return error_validation("codigo_material", "Codigo de material requerido")
        if not precio_usd or precio_usd <= 0:
            return error_validation("precio_usd", "Precio USD debe ser mayor a 0")
        if not fecha_desde:
            return error_validation("fecha_vigencia_desde", "Fecha de vigencia requerida")

        precio_id = ProveedorPreciosRepository.crear_precio(
            cuit_proveedor=cuit,
            codigo_material=codigo_material,
            precio_usd=float(precio_usd),
            moneda=data.get("moneda", "USD"),
            fecha_vigencia_desde=fecha_desde,
            fecha_vigencia_hasta=data.get("fecha_vigencia_hasta"),
            condicion_pago=data.get("condicion_pago"),
            cantidad_minima=data.get("cantidad_minima", 1),
            notas=data.get("notas"),
        )

        return (
            jsonify(
                {
                    "ok": True,
                    "data": {"id": precio_id, "mensaje": "Precio negociado creado correctamente"},
                }
            ),
            201,
        )

    except Exception as e:
        logger.error(f"Error creando precio proveedor {cuit}: {e}")
        return error_internal("Error al crear precio negociado")


@precios_bp.route("/materiales/<codigo>/mejores-precios", methods=["GET"])
@require_auth
def obtener_mejores_precios_material(codigo):
    """
    Obtiene los mejores precios negociados para un material.

    Query params:
    - limit: numero maximo de resultados (default 5)
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, _ = _require_planner_role(user)
    if guard:
        return guard

    try:
        limit = int(request.args.get("limit", 5))
        precios = ProveedorPreciosRepository.get_mejores_precios(codigo, limit=limit)
        return jsonify({"ok": True, "data": precios}), 200

    except Exception as e:
        logger.error(f"Error obteniendo mejores precios material {codigo}: {e}")
        return error_internal("Error al obtener precios del material")
