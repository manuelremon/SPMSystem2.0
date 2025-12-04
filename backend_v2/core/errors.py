"""
Formato estándar de errores para API REST
Provee helpers para generar respuestas JSON coherentes con traceo y detalles.
"""

import uuid
from typing import Any, Dict, Optional

from flask import jsonify


def api_error(
    code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    status: int = 400,
    trace_id: Optional[str] = None,
) -> tuple:
    """
    Genera respuesta de error estándar en formato JSON.

    Args:
        code: Código de error (ej. "validation_error", "not_found", "forbidden")
        message: Mensaje legible para usuario
        details: Detalles adicionales (validaciones, stack, etc.)
        status: HTTP status code (default 400)
        trace_id: ID único para seguimiento (se genera si no se proporciona)

    Returns:
        Tupla (response_json, status_code)

    Ejemplo:
        return api_error("stock_insuficiente", "No hay suficiente stock",
                        {"deficit": 10, "disponible": 5})
    """
    if trace_id is None:
        trace_id = str(uuid.uuid4())

    response = {"ok": False, "error": {"code": code, "message": message, "trace_id": trace_id}}

    if details:
        response["error"]["details"] = details

    return jsonify(response), status


# Errores comunes reutilizables
def error_not_found(resource: str, resource_id: Any, trace_id: Optional[str] = None):
    """404 Not Found"""
    return api_error(
        "not_found",
        f"{resource} con ID {resource_id} no encontrado",
        {"resource": resource, "id": resource_id},
        status=404,
        trace_id=trace_id,
    )


def error_forbidden(reason: str, trace_id: Optional[str] = None):
    """403 Forbidden"""
    return api_error("forbidden", f"Acceso denegado: {reason}", status=403, trace_id=trace_id)


def error_validation(field: str, reason: str, trace_id: Optional[str] = None):
    """400 Validation Error"""
    return api_error(
        "validation_error",
        f"Error validando campo '{field}': {reason}",
        {"field": field, "reason": reason},
        status=400,
        trace_id=trace_id,
    )


def error_internal(error_detail: str, trace_id: Optional[str] = None):
    """500 Internal Server Error"""
    return api_error(
        "internal_error",
        "Error interno del servidor. Contacta al administrador.",
        {"detail": error_detail},
        status=500,
        trace_id=trace_id,
    )


def error_conflict(reason: str, trace_id: Optional[str] = None):
    """409 Conflict"""
    return api_error("conflict", f"Conflicto: {reason}", status=409, trace_id=trace_id)
