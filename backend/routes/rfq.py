"""
Blueprint RFQ (Request for Quotation)
Maneja la creacion, publicacion, evaluacion y adjudicacion de RFQs
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.errors import NotFoundError, ValidationError
from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import rfq_service

logger = logging.getLogger(__name__)

rfq_bp = Blueprint("rfq", __name__, url_prefix="/api/rfq")


@rfq_bp.route("", methods=["GET"])
@require_auth
def listar_rfqs():
    """
    Lista RFQs con filtros y paginacion
    Query params: estado, search, page, per_page
    """
    try:
        filtros = {
            "estado": request.args.get("estado"),
            "search": request.args.get("search"),
            "page": int(request.args.get("page", 1)),
            "per_page": int(request.args.get("per_page", 20))
        }

        resultado = rfq_service.obtener_rfqs(filtros)
        resultado["ok"] = True

        return jsonify(resultado), 200

    except ValueError as e:
        return jsonify({"ok": False, "error": f"Parametros invalidos: {str(e)}"}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="listar_rfqs")


@rfq_bp.route("", methods=["POST"])
@require_auth
def crear_rfq():
    """
    Crea un nuevo RFQ
    Body: {titulo, descripcion, fecha_cierre_ofertas, items, proveedores}
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        if not data:
            return jsonify({"ok": False, "error": "Datos requeridos"}), 400

        rfq = rfq_service.crear_rfq(data, user_id)

        return jsonify(rfq), 201

    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="crear_rfq")


@rfq_bp.route("/from-solicitud/<int:solicitud_id>", methods=["POST"])
@require_auth
def crear_desde_solicitud(solicitud_id):
    """
    Crea un RFQ pre-poblado desde una solicitud existente
    Body: {proveedores, fecha_cierre_ofertas, descripcion}
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        if not data:
            return jsonify({"ok": False, "error": "Datos requeridos"}), 400

        rfq = rfq_service.crear_rfq_desde_solicitud(solicitud_id, data, user_id)

        return jsonify(rfq), 201

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="crear_desde_solicitud")


@rfq_bp.route("/<int:rfq_id>", methods=["GET"])
@require_auth
def obtener_detalle(rfq_id):
    """
    Obtiene el detalle completo de un RFQ
    """
    try:
        rfq = rfq_service.obtener_detalle_rfq(rfq_id)
        return jsonify(rfq), 200

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except Exception as e:
        return safe_error_response(e, logger, context="obtener_detalle")


@rfq_bp.route("/<int:rfq_id>", methods=["PUT"])
@require_auth
def actualizar_rfq(rfq_id):
    """
    Actualiza un RFQ en estado draft
    Body: {titulo?, descripcion?, fecha_cierre_ofertas?}
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        if not data:
            return jsonify({"ok": False, "error": "Datos requeridos"}), 400

        rfq = rfq_service.actualizar_rfq(rfq_id, data, user_id)

        return jsonify(rfq), 200

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="actualizar_rfq")


@rfq_bp.route("/<int:rfq_id>/publish", methods=["PUT"])
@require_auth
def publicar_rfq(rfq_id):
    """
    Publica un RFQ (draft -> published)
    """
    try:
        user_id = _get_user_id()
        rfq = rfq_service.publicar_rfq(rfq_id, user_id)

        return jsonify(rfq), 200

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="publicar_rfq")


@rfq_bp.route("/<int:rfq_id>/bids", methods=["POST"])
@require_auth
def registrar_ofertas(rfq_id):
    """
    Registra ofertas de un proveedor
    Body: {proveedor_cuit, ofertas: [{rfq_item_id, precio_unitario, ...}]}
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"ok": False, "error": "Datos requeridos"}), 400

        resultado = rfq_service.registrar_oferta(rfq_id, data)

        return jsonify(resultado), 201

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="registrar_ofertas")


@rfq_bp.route("/<int:rfq_id>/bids", methods=["GET"])
@require_auth
def listar_ofertas(rfq_id):
    """
    Lista todas las ofertas de un RFQ agrupadas por proveedor
    """
    try:
        ofertas = rfq_service.obtener_ofertas(rfq_id)
        return jsonify({"ofertas": ofertas}), 200

    except Exception as e:
        return safe_error_response(e, logger, context="listar_ofertas")


@rfq_bp.route("/<int:rfq_id>/comparison", methods=["GET"])
@require_auth
def obtener_comparacion(rfq_id):
    """
    Genera una matriz de comparacion de ofertas
    """
    try:
        comparacion = rfq_service.obtener_comparacion(rfq_id)
        return jsonify(comparacion), 200

    except Exception as e:
        return safe_error_response(e, logger, context="obtener_comparacion")


@rfq_bp.route("/<int:rfq_id>/criteria", methods=["POST"])
@require_auth
def configurar_criterios(rfq_id):
    """
    Configura los criterios de evaluacion para un RFQ
    Body: {criterios: [{criterio, peso_porcentaje}]}
    """
    try:
        data = request.get_json()

        if not data or "criterios" not in data:
            return jsonify({"ok": False, "error": "Campo 'criterios' requerido"}), 400

        resultado = rfq_service.configurar_criterios(rfq_id, data["criterios"])

        return jsonify(resultado), 200

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="configurar_criterios")


@rfq_bp.route("/<int:rfq_id>/evaluate", methods=["POST"])
@require_auth
def evaluar_rfq(rfq_id):
    """
    Calcula los puntajes de evaluacion para cada proveedor
    """
    try:
        evaluaciones = rfq_service.calcular_puntajes(rfq_id)

        return jsonify({"evaluaciones": evaluaciones}), 200

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="evaluar_rfq")


@rfq_bp.route("/<int:rfq_id>/award", methods=["POST"])
@require_auth
def adjudicar_rfq(rfq_id):
    """
    Adjudica items del RFQ a proveedores ganadores
    Body: {adjudicaciones: [{rfq_item_id, proveedor_ganador_cuit, precio_adjudicado, cantidad_adjudicada}]}
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        if not data or "adjudicaciones" not in data:
            return jsonify({"ok": False, "error": "Campo 'adjudicaciones' requerido"}), 400

        resultado = rfq_service.adjudicar_rfq(rfq_id, data["adjudicaciones"], user_id)

        return jsonify(resultado), 200

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="adjudicar_rfq")


@rfq_bp.route("/<int:rfq_id>/generate-po", methods=["POST"])
@require_auth
def generar_ordenes_compra(rfq_id):
    """
    Genera ordenes de compra desde las adjudicaciones del RFQ
    """
    try:
        user_id = _get_user_id()
        ordenes = rfq_service.generar_oc_desde_rfq(rfq_id, user_id)

        return jsonify({
            "message": "Ordenes de compra generadas exitosamente",
            "ordenes": ordenes
        }), 201

    except NotFoundError as e:
        return jsonify({"ok": False, "error": str(e)}), 404
    except ValidationError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return safe_error_response(e, logger, context="generar_ordenes_compra")
