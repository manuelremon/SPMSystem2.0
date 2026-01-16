"""
Formato estándar de errores para API REST
Provee helpers para generar respuestas JSON coherentes con traceo y detalles.

Incluye:
- Clases de excepción personalizadas (SPMException y derivadas)
- Helpers para generar respuestas JSON de error
- Función para registrar el error handler en Flask
"""

import uuid
from typing import Any, Dict, Optional

from flask import jsonify

# ═══════════════════════════════════════════════════════════════════════════
# EXCEPCIONES PERSONALIZADAS
# ═══════════════════════════════════════════════════════════════════════════


class SPMException(Exception):
    """
    Excepción base para todos los errores del sistema SPM.

    Permite lanzar errores desde cualquier punto del código que serán
    capturados automáticamente por el error handler de Flask y convertidos
    a respuestas JSON consistentes.

    Uso:
        raise SPMException("validation_error", "Campo inválido", status=400)
    """

    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        details: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
    ):
        self.code = code
        self.message = message
        self.status = status
        self.details = details or {}
        self.trace_id = trace_id or str(uuid.uuid4())
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte la excepción a diccionario para JSON response."""
        response = {
            "ok": False,
            "error": {
                "code": self.code,
                "message": self.message,
                "trace_id": self.trace_id,
            },
        }
        if self.details:
            response["error"]["details"] = self.details
        return response


class NotFoundError(SPMException):
    """404 Not Found - Recurso no encontrado."""

    def __init__(
        self,
        resource: str,
        resource_id: Any = None,
        trace_id: Optional[str] = None,
    ):
        message = (
            f"{resource} no encontrado"
            if not resource_id
            else f"{resource} con ID {resource_id} no encontrado"
        )
        details = {"resource": resource}
        if resource_id is not None:
            details["id"] = resource_id
        super().__init__("not_found", message, status=404, details=details, trace_id=trace_id)


class ValidationError(SPMException):
    """400 Validation Error - Datos inválidos."""

    def __init__(
        self,
        field: str,
        reason: str,
        trace_id: Optional[str] = None,
    ):
        message = f"Error validando '{field}': {reason}"
        super().__init__(
            "validation_error",
            message,
            status=400,
            details={"field": field, "reason": reason},
            trace_id=trace_id,
        )


class ForbiddenError(SPMException):
    """403 Forbidden - Acceso denegado."""

    def __init__(
        self,
        reason: str = "No tiene permisos para esta acción",
        trace_id: Optional[str] = None,
    ):
        message = f"Acceso denegado: {reason}"
        super().__init__("forbidden", message, status=403, trace_id=trace_id)


class UnauthorizedError(SPMException):
    """401 Unauthorized - No autenticado."""

    def __init__(
        self,
        reason: str = "Autenticación requerida",
        trace_id: Optional[str] = None,
    ):
        super().__init__("unauthorized", reason, status=401, trace_id=trace_id)


class ConflictError(SPMException):
    """409 Conflict - Conflicto con el estado actual."""

    def __init__(
        self,
        reason: str,
        trace_id: Optional[str] = None,
    ):
        message = f"Conflicto: {reason}"
        super().__init__("conflict", message, status=409, trace_id=trace_id)


class DatabaseError(SPMException):
    """500 Database Error - Error de base de datos."""

    def __init__(
        self,
        detail: str = "Error de base de datos",
        trace_id: Optional[str] = None,
    ):
        super().__init__(
            "db_error",
            "Error de base de datos. Contacte al administrador.",
            status=500,
            details={"detail": detail},
            trace_id=trace_id,
        )


class BusinessRuleError(SPMException):
    """422 Unprocessable Entity - Violacion de regla de negocio."""

    def __init__(
        self,
        rule: str,
        details: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
    ):
        super().__init__(
            "business_rule_violation",
            rule,
            status=422,
            details=details,
            trace_id=trace_id,
        )


class BadRequestError(SPMException):
    """400 Bad Request - Solicitud malformada o parametros faltantes."""

    def __init__(
        self,
        message: str = "Solicitud invalida",
        details: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
    ):
        super().__init__(
            "bad_request",
            message,
            status=400,
            details=details,
            trace_id=trace_id,
        )


class InsufficientDataError(SPMException):
    """422 Insufficient Data - Datos insuficientes para procesar."""

    def __init__(
        self,
        message: str = "Datos insuficientes para procesar",
        required: Optional[int] = None,
        actual: Optional[int] = None,
        trace_id: Optional[str] = None,
    ):
        details = {}
        if required is not None:
            details["required"] = required
        if actual is not None:
            details["actual"] = actual
        super().__init__(
            "insufficient_data",
            message,
            status=422,
            details=details if details else None,
            trace_id=trace_id,
        )


class RateLimitedError(SPMException):
    """429 Too Many Requests - Limite de peticiones excedido."""

    def __init__(
        self,
        retry_after: Optional[int] = None,
        trace_id: Optional[str] = None,
    ):
        message = "Demasiadas peticiones. Intente mas tarde."
        details = {}
        if retry_after is not None:
            details["retry_after_seconds"] = retry_after
        super().__init__(
            "rate_limited",
            message,
            status=429,
            details=details if details else None,
            trace_id=trace_id,
        )


class ServiceError(SPMException):
    """500/503 Service Error - Error en servicio interno o externo."""

    def __init__(
        self,
        service: str,
        message: str = "Error en servicio",
        status: int = 500,
        trace_id: Optional[str] = None,
    ):
        super().__init__(
            f"{service}_error",
            message,
            status=status,
            details={"service": service},
            trace_id=trace_id,
        )


# ═══════════════════════════════════════════════════════════════════════════
# REGISTRO DE ERROR HANDLER EN FLASK
# ═══════════════════════════════════════════════════════════════════════════


def register_spm_error_handler(app):
    """
    Registra el error handler para SPMException en la aplicación Flask.

    Debe llamarse desde create_app() después de crear la instancia de Flask.

    Uso:
        from backend.core.errors import register_spm_error_handler
        register_spm_error_handler(app)
    """

    @app.errorhandler(SPMException)
    def handle_spm_exception(error: SPMException):
        app.logger.warning(f"[{error.trace_id}] {error.code}: {error.message}")
        return jsonify(error.to_dict()), error.status


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS (compatibilidad con código existente)
# ═══════════════════════════════════════════════════════════════════════════


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


def error_bad_request(message: str, details: Optional[Dict[str, Any]] = None, trace_id: Optional[str] = None):
    """400 Bad Request"""
    return api_error("bad_request", message, details=details, status=400, trace_id=trace_id)


def error_insufficient_data(
    message: str,
    required: Optional[int] = None,
    actual: Optional[int] = None,
    trace_id: Optional[str] = None,
):
    """422 Insufficient Data"""
    details = {}
    if required is not None:
        details["required"] = required
    if actual is not None:
        details["actual"] = actual
    return api_error(
        "insufficient_data",
        message,
        details=details if details else None,
        status=422,
        trace_id=trace_id,
    )


def error_rate_limited(retry_after: Optional[int] = None, trace_id: Optional[str] = None):
    """429 Too Many Requests"""
    details = {"retry_after_seconds": retry_after} if retry_after else None
    return api_error(
        "rate_limited",
        "Demasiadas peticiones. Intente mas tarde.",
        details=details,
        status=429,
        trace_id=trace_id,
    )


def error_service(service: str, message: str = "Error en servicio", trace_id: Optional[str] = None):
    """500 Service Error"""
    return api_error(
        f"{service}_error",
        message,
        details={"service": service},
        status=500,
        trace_id=trace_id,
    )
