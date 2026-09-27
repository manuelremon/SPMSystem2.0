"""
Consumo historico de materiales (Inventario): filtros, resumen, grafico mensual
y detalle/agrupado por material, con valorizacion en USD.

Ver backend/services/consumo_historico_service.py para la logica (sin Flask,
testeable). El inmovilizado NO se recalcula aqui: ver
backend/services/inmovilizado_service.py.
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.helpers import safe_error_response
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth
from backend.services import consumo_historico_service as service

logger = logging.getLogger(__name__)

bp = Blueprint("consumo_historico", __name__, url_prefix="/api/consumo-historico")

MAX_LONGITUD_MATERIAL = 200

MSG_FECHA_INVALIDA = "Fecha invalida. Usa el formato YYYY-MM-DD."
MSG_RANGO_INVALIDO = "El rango de fechas es invalido: 'desde' no puede ser posterior a 'hasta'."
MSG_CENTRO_INVALIDO = "El centro indicado no es valido."
MSG_ALMACEN_INVALIDO = "El almacen indicado no es valido."
MSG_MATERIAL_INVALIDO = "El texto de busqueda de material es demasiado largo."


def _error(mensaje: str):
    return jsonify({"ok": False, "error": {"code": "validation_error", "message": mensaje}}), 400


@bp.route("", methods=["GET"])
@require_auth
@rate_limit(requests=30, window_seconds=60)
def listar_consumo_historico():
    """
    GET /api/consumo-historico

    Query params: desde, hasta (YYYY-MM-DD), centro, almacen,
    material (coincide con codigo o descripcion), agrupar = detalle | material.

    Returns:
    {
        ok: true,
        data: [...],            # detalle o por material, segun `agrupar`
        truncado: bool,         # solo relevante en detalle
        resumen: {...},
        mensual: [...],
        rango_datos: {min, max},
        filtros: {centros, almacenes},
    }
    """
    args = request.args

    try:
        desde = service.parsear_fecha((args.get("desde") or "").strip() or None)
        hasta = service.parsear_fecha((args.get("hasta") or "").strip() or None)
    except service.FiltroInvalido:
        return _error(MSG_FECHA_INVALIDA)

    if desde and hasta and desde > hasta:
        return _error(MSG_RANGO_INVALIDO)

    centro = (args.get("centro") or "").strip() or None
    almacen = (args.get("almacen") or "").strip() or None
    material = (args.get("material") or "").strip() or None
    agrupar = (args.get("agrupar") or "detalle").strip().lower()
    if agrupar not in service.AGRUPACIONES:
        agrupar = "detalle"

    if material and len(material) > MAX_LONGITUD_MATERIAL:
        return _error(MSG_MATERIAL_INVALIDO)

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            catalogos = service.catalogos_validos(cur)
            if centro and centro not in catalogos["centros"]:
                return _error(MSG_CENTRO_INVALIDO)
            if almacen and almacen not in catalogos["almacenes"]:
                return _error(MSG_ALMACEN_INVALIDO)

            resultado = service.obtener_consumo(
                cur,
                desde=desde,
                hasta=hasta,
                centro=centro,
                almacen=almacen,
                material=material,
                agrupar=agrupar,
            )

        return jsonify({"ok": True, "filtros": catalogos, **resultado})

    except Exception as e:
        return safe_error_response(e, logger, context="consumo_historico.listar")
