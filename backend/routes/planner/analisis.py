"""
Planner - Paso 1: Analisis

Endpoints para el analisis inicial de solicitudes (Paso 1 del wizard).
"""

import logging

from flask import Blueprint, jsonify

from backend.core.errors import error_internal, error_validation
from backend.core.roles import require_auth
from backend.routes.planner_helpers import _require_solicitud_access
from backend.services.planner_service import paso_1_analizar_solicitud

logger = logging.getLogger(__name__)

analisis_bp = Blueprint("analisis", __name__)


@analisis_bp.route("/solicitudes/<int:solicitud_id>/analizar", methods=["POST"])
@require_auth
def analizar_solicitud(solicitud_id):
    """
    PASO 1: Analisis integral de solicitud para tratamiento

    Delega a paso_1_analizar_solicitud() en el servicio.
    Retorna objeto de analisis con metricas presupuesto, conflictos, avisos y recomendaciones.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        resultado = paso_1_analizar_solicitud(solicitud_id)
        return jsonify({"ok": True, "data": resultado}), 200
    except ValueError as e:
        logger.warning(f"Validacion paso1 solicitud {solicitud_id}: {e}")
        return error_validation("solicitud_id", "Solicitud no valida o no encontrada")
    except Exception as e:
        logger.error(f"Error en paso1_analisis solicitud {solicitud_id}: {e}")
        return error_internal("Error al analizar solicitud")


def _generar_recomendaciones(conflictos: list, avisos: list) -> list:
    """Genera recomendaciones basadas en conflictos y avisos"""
    recomendaciones = []

    for conflicto in conflictos:
        if conflicto["tipo"] == "stock_insuficiente":
            recomendaciones.append(
                {
                    "prioridad": "alta",
                    "accion": "Buscar proveedores externos",
                    "razon": f"Stock insuficiente para item {conflicto['item_idx']}",
                }
            )
        elif conflicto["tipo"] == "presupuesto_insuficiente":
            recomendaciones.append(
                {
                    "prioridad": "muy_alta",
                    "accion": "Solicitar ampliacion de presupuesto",
                    "razon": f"Item {conflicto['item_idx']} requiere ${conflicto['costo_item']}",
                }
            )

    if len(avisos) > 0:
        recomendaciones.append(
            {
                "prioridad": "media",
                "accion": "Revisar avisos especiales antes de continuar",
                "razon": f"Hay {len(avisos)} avisos que requieren atencion",
            }
        )

    return recomendaciones
