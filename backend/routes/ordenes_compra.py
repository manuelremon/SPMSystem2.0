"""
Ordenes de Compra Routes - Gestion de Ordenes de Compra internas

Endpoints:
- GET    /api/ordenes-compra              - Listar ordenes (paginado)
- GET    /api/ordenes-compra/estadisticas - Estadisticas de ordenes
- GET    /api/ordenes-compra/<id>         - Detalle de orden con items e historial
- POST   /api/ordenes-compra             - Crear nueva orden
- PUT    /api/ordenes-compra/<id>/estado  - Cambiar estado de orden
- POST   /api/ordenes-compra/<id>/recepcion - Registrar recepcion de mercaderia
- POST   /api/ordenes-compra/desde-solicitud - Generar OC desde solicitud
- GET    /api/ordenes-compra/<id>/pdf     - Generar PDF de orden
"""

import logging
from typing import Any

from flask import Blueprint, Response, g, jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth
from backend.services.oc_service import OCService
from backend.services.reporting_service import get_reporting_service

logger = logging.getLogger(__name__)

ordenes_compra_bp = Blueprint(
    "ordenes_compra", __name__, url_prefix="/api/ordenes-compra"
)


def _error_response(code: str, message: str, status: int = 400) -> tuple:
    """Patron de respuesta de error estandar."""
    return jsonify({"ok": False, "error": {"code": code, "message": message}}), status


def _success_response(
    data: Any = None, message: str = None, status: int = 200
) -> tuple:
    """Patron de respuesta exitosa estandar."""
    response: dict[str, Any] = {"ok": True}
    if data is not None:
        response["data"] = data
    if message:
        response["message"] = message
    return jsonify(response), status


def _is_planner_or_admin() -> bool:
    """Verifica si el usuario actual es planner o admin."""
    rol = g.user.get("rol", "")
    roles_normalizados = [r.strip().lower() for r in rol.split(",")]
    return any(
        r in ("admin", "administrador", "planner", "planificador")
        for r in roles_normalizados
    )


# ============================================================================
# LIST & DETAIL
# ============================================================================


@ordenes_compra_bp.route("", methods=["GET"])
@require_auth
@rate_limit(30, 60)
def listar_ordenes():
    """
    Listar ordenes de compra con paginacion y filtros.

    Query params:
        - page: Pagina (default 1)
        - per_page: Items por pagina (default 20, max 100)
        - estado: Filtrar por estado
        - centro: Filtrar por centro
        - proveedor: Filtrar por CUIT o nombre de proveedor
    """
    try:
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)
        estado = request.args.get("estado")
        centro = request.args.get("centro")
        proveedor = request.args.get("proveedor")

        contrato_id = request.args.get("contrato_id", type=int)

        result = OCService.listar_ordenes(
            page=page,
            per_page=per_page,
            estado=estado,
            centro=centro,
            proveedor=proveedor,
            contrato_id=contrato_id,
        )
        return _success_response(result)

    except Exception as e:
        logger.error(f"[OC] Error listando ordenes: {e}", exc_info=True)
        return _error_response(
            "list_error", "Error al listar ordenes de compra", 500
        )


@ordenes_compra_bp.route("/<int:orden_id>", methods=["GET"])
@require_auth
@rate_limit(30, 60)
def obtener_orden(orden_id: int):
    """
    Obtener detalle de una orden de compra con items e historial.
    """
    try:
        orden = OCService.obtener_orden(orden_id)
        if not orden:
            return _error_response(
                "not_found", "Orden de compra no encontrada", 404
            )

        return _success_response(orden)

    except Exception as e:
        logger.error(
            f"[OC] Error obteniendo orden {orden_id}: {e}", exc_info=True
        )
        return _error_response(
            "get_error", "Error al obtener orden de compra", 500
        )


# ============================================================================
# CREATE
# ============================================================================


@ordenes_compra_bp.route("", methods=["POST"])
@require_auth
@rate_limit(10, 60)
def crear_orden():
    """
    Crear nueva orden de compra.

    Body:
        {
            solicitud_id: int (opcional),
            proveedor_cuit: str,
            proveedor_nombre: str,
            centro: str,
            items: [
                {
                    material_codigo: str,
                    material_descripcion: str (opcional),
                    cantidad: float,
                    precio_unitario: float,
                    unidad: str (opcional)
                }
            ],
            notas: str (opcional),
            moneda: str (opcional, default "ARS")
        }
    """
    try:
        if not _is_planner_or_admin():
            return _error_response(
                "forbidden",
                "Solo planificadores y administradores pueden crear ordenes",
                403,
            )

        data = request.get_json(silent=True)
        if not data:
            return _error_response(
                "missing_data", "Datos de orden requeridos"
            )

        # Validar campos requeridos
        required_fields = ["proveedor_cuit", "proveedor_nombre", "centro", "items"]
        for field in required_fields:
            if not data.get(field):
                return _error_response(
                    "missing_field", f"Campo requerido: {field}"
                )

        items = data.get("items", [])
        if not items or len(items) == 0:
            return _error_response(
                "no_items", "La orden debe tener al menos un item"
            )

        # Validar cada item
        for idx, item in enumerate(items):
            if not item.get("material_codigo"):
                return _error_response(
                    "invalid_item",
                    f"Item {idx + 1}: material_codigo es requerido",
                )
            cantidad = item.get("cantidad", 0)
            if not cantidad or float(cantidad) <= 0:
                return _error_response(
                    "invalid_item",
                    f"Item {idx + 1}: cantidad debe ser mayor a 0",
                )
            precio = item.get("precio_unitario", 0)
            if precio is None or float(precio) < 0:
                return _error_response(
                    "invalid_item",
                    f"Item {idx + 1}: precio_unitario no puede ser negativo",
                )

        user_id = g.user.get("id_spm") or g.user.get("user_id")

        result = OCService.crear_orden(
            solicitud_id=data.get("solicitud_id"),
            proveedor_cuit=data["proveedor_cuit"],
            proveedor_nombre=data["proveedor_nombre"],
            centro=data["centro"],
            items=items,
            creado_por=user_id,
            notas=data.get("notas"),
            moneda=data.get("moneda", "ARS"),
        )

        return _success_response(
            result, "Orden de compra creada exitosamente", 201
        )

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="ordenes_compra.crear_orden")
    except Exception as e:
        logger.error(f"[OC] Error creando orden: {e}", exc_info=True)
        return _error_response(
            "create_error", "Error al crear orden de compra", 500
        )


# ============================================================================
# STATE TRANSITIONS
# ============================================================================


@ordenes_compra_bp.route("/<int:orden_id>/estado", methods=["PUT"])
@require_auth
@rate_limit(10, 60)
def cambiar_estado(orden_id: int):
    """
    Cambiar estado de una orden de compra.

    Body:
        {
            estado: str,
            razon: str (opcional)
        }

    Transiciones validas:
        borrador -> pendiente_aprobacion
        pendiente_aprobacion -> aprobada | rechazada
        aprobada -> enviada_proveedor
        enviada_proveedor -> confirmada_proveedor | parcialmente_recibida
        confirmada_proveedor -> parcialmente_recibida
        parcialmente_recibida -> recibida_completa
        * -> cancelada (con razon obligatoria)
    """
    try:
        data = request.get_json(silent=True)
        if not data or "estado" not in data:
            return _error_response(
                "missing_data", "Estado objetivo requerido"
            )

        nuevo_estado = data.get("estado", "").strip()
        razon = data.get("razon", "").strip()

        if not nuevo_estado:
            return _error_response(
                "missing_field", "Campo estado es requerido"
            )

        # Si se cancela, la razon es obligatoria
        if nuevo_estado == "cancelada" and len(razon) < 5:
            return _error_response(
                "razon_required",
                "Debe proporcionar una razon para cancelar (minimo 5 caracteres)",
            )

        user_id = g.user.get("id_spm") or g.user.get("user_id")

        result = OCService.cambiar_estado(
            orden_id, nuevo_estado, user_id, razon or None
        )

        return _success_response(
            result, "Estado actualizado exitosamente"
        )

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="ordenes_compra.cambiar_estado")
    except Exception as e:
        logger.error(
            f"[OC] Error cambiando estado de orden {orden_id}: {e}",
            exc_info=True,
        )
        return _error_response(
            "transition_error", "Error al cambiar estado de orden", 500
        )


# ============================================================================
# GOODS RECEIPT
# ============================================================================


@ordenes_compra_bp.route("/<int:orden_id>/recepcion", methods=["POST"])
@require_auth
@rate_limit(10, 60)
def registrar_recepcion(orden_id: int):
    """
    Registrar recepcion de mercaderia para una orden.

    Body:
        {
            items: [
                {
                    orden_compra_item_id: int,
                    cantidad_recibida: float,
                    estado_calidad: str (opcional, default "aceptado"),
                    notas: str (opcional)
                }
            ],
            notas: str (opcional, notas generales de recepcion)
        }
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return _error_response(
                "missing_data", "Datos de recepcion requeridos"
            )

        items = data.get("items", [])
        if not items or len(items) == 0:
            return _error_response(
                "no_items",
                "Debe registrar al menos un item de recepcion",
            )

        # Validar cada item de recepcion
        for idx, item in enumerate(items):
            if not item.get("orden_compra_item_id"):
                return _error_response(
                    "invalid_item",
                    f"Item {idx + 1}: orden_compra_item_id es requerido",
                )
            cantidad = item.get("cantidad_recibida", 0)
            if cantidad is None or float(cantidad) < 0:
                return _error_response(
                    "invalid_item",
                    f"Item {idx + 1}: cantidad_recibida no puede ser negativa",
                )

        user_id = g.user.get("id_spm") or g.user.get("user_id")

        result = OCService.registrar_recepcion(
            orden_id,
            items_recibidos=items,
            recibido_por=user_id,
            notas=data.get("notas"),
        )

        return _success_response(
            result, "Recepcion registrada exitosamente"
        )

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="ordenes_compra.registrar_recepcion")
    except Exception as e:
        logger.error(
            f"[OC] Error registrando recepcion para orden {orden_id}: {e}",
            exc_info=True,
        )
        return _error_response(
            "receipt_error",
            "Error al registrar recepcion de mercaderia",
            500,
        )


# ============================================================================
# STATISTICS
# ============================================================================


@ordenes_compra_bp.route("/estadisticas", methods=["GET"])
@require_auth
@rate_limit(30, 60)
def estadisticas():
    """
    Obtener estadisticas de ordenes de compra.

    Query params:
        - centro: Filtrar estadisticas por centro (opcional)
    """
    try:
        centro = request.args.get("centro")

        result = OCService.obtener_estadisticas(centro)
        return _success_response(result)

    except Exception as e:
        logger.error(
            f"[OC] Error obteniendo estadisticas: {e}", exc_info=True
        )
        return _error_response(
            "stats_error",
            "Error al obtener estadisticas de ordenes",
            500,
        )


# ============================================================================
# GENERATE FROM SOLICITUD
# ============================================================================


@ordenes_compra_bp.route("/desde-solicitud", methods=["POST"])
@require_auth
@rate_limit(10, 60)
def crear_desde_solicitud():
    """
    Generar orden de compra a partir de una solicitud existente.

    Body:
        {
            solicitud_id: int,
            proveedor_cuit: str,
            proveedor_nombre: str
        }
    """
    try:
        if not _is_planner_or_admin():
            return _error_response(
                "forbidden",
                "Solo planificadores y administradores pueden generar ordenes",
                403,
            )

        data = request.get_json(silent=True)
        if not data:
            return _error_response(
                "missing_data", "Datos requeridos para generar orden"
            )

        required_fields = ["solicitud_id", "proveedor_cuit", "proveedor_nombre"]
        for field in required_fields:
            if not data.get(field):
                return _error_response(
                    "missing_field", f"Campo requerido: {field}"
                )

        user_id = g.user.get("id_spm") or g.user.get("user_id")

        result = OCService.generar_oc_desde_solicitud(
            solicitud_id=data["solicitud_id"],
            proveedor_cuit=data["proveedor_cuit"],
            proveedor_nombre=data["proveedor_nombre"],
            creado_por=user_id,
        )

        return _success_response(
            result,
            "Orden de compra generada desde solicitud exitosamente",
            201,
        )

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="ordenes_compra.crear_desde_solicitud")
    except Exception as e:
        logger.error(
            f"[OC] Error generando OC desde solicitud: {e}", exc_info=True
        )
        return _error_response(
            "create_error",
            "Error al generar orden desde solicitud",
            500,
        )


# ============================================================================
# PDF GENERATION
# ============================================================================


@ordenes_compra_bp.route("/<int:orden_id>/pdf", methods=["GET"])
@require_auth
@rate_limit(5, 60)
def generar_pdf(orden_id: int):
    """
    Generar PDF de una orden de compra.
    """
    try:
        # Verificar que la orden existe
        orden = OCService.obtener_orden(orden_id)
        if not orden:
            return _error_response(
                "not_found", "Orden de compra no encontrada", 404
            )

        service = get_reporting_service()
        result = service.generate_custom_report(
            titulo=f"Orden de Compra #{orden_id}",
            datos=orden.get("items", []),
            columnas=None,
            formato="pdf",
        )

        if not result.get("success"):
            return _error_response(
                "pdf_error",
                result.get("error", "Error al generar PDF"),
            )

        return Response(
            result["contenido"],
            mimetype="application/pdf",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=orden_compra_{orden_id}.pdf"
                ),
            },
        )

    except Exception as e:
        logger.error(
            f"[OC] Error generando PDF para orden {orden_id}: {e}",
            exc_info=True,
        )
        return _error_response(
            "pdf_error", "Error al generar PDF de orden de compra", 500
        )
