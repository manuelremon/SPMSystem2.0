"""
Sistema de validacion y sanitizacion de requests.
Sprint 10.2 - Proteccion contra inyecciones y datos maliciosos.

Provee:
- Sanitizacion de strings (XSS, SQL injection)
- Validacion de tipos y formatos
- Limites de tamano de request
- Filtrado de caracteres peligrosos
"""

import html
import logging
import re
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Pattern, Union

from flask import g, jsonify, request

logger = logging.getLogger(__name__)


# =============================================================================
# Patrones peligrosos
# =============================================================================

# Patrones de SQL injection
SQL_INJECTION_PATTERNS: List[Pattern] = [
    re.compile(r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)", re.I),
    re.compile(r"(--|#|/\*|\*/)", re.I),  # Comentarios SQL
    re.compile(r"(\b(OR|AND)\b\s+\d+\s*=\s*\d+)", re.I),  # OR 1=1, AND 1=1
    re.compile(r"(\'|\");\s*\w+", re.I),  # '; DROP TABLE
    re.compile(r"\b(EXEC|EXECUTE|xp_)\b", re.I),  # Stored procedures
]

# Patrones de XSS
XSS_PATTERNS: List[Pattern] = [
    re.compile(r"<script[^>]*>", re.I),
    re.compile(r"javascript:", re.I),
    re.compile(r"on\w+\s*=", re.I),  # onclick, onerror, etc.
    re.compile(r"<iframe[^>]*>", re.I),
    re.compile(r"<object[^>]*>", re.I),
    re.compile(r"<embed[^>]*>", re.I),
    re.compile(r"<link[^>]*>", re.I),
    re.compile(r"expression\s*\(", re.I),  # CSS expression
    re.compile(r"url\s*\(\s*['\"]?data:", re.I),  # data: URLs
]

# Patrones de path traversal
PATH_TRAVERSAL_PATTERNS: List[Pattern] = [
    re.compile(r"\.\./"),
    re.compile(r"\.\.\\"),
    re.compile(r"%2e%2e[/\\]", re.I),
    re.compile(r"%252e%252e[/\\]", re.I),
]

# Patrones de command injection
COMMAND_INJECTION_PATTERNS: List[Pattern] = [
    re.compile(r"[;&|`$]"),
    re.compile(r"\$\("),
    re.compile(r"`[^`]+`"),
]


# =============================================================================
# Funciones de sanitizacion
# =============================================================================


def sanitize_string(value: str, max_length: int = 10000) -> str:
    """
    Sanitiza un string eliminando caracteres peligrosos.

    Args:
        value: String a sanitizar
        max_length: Longitud maxima permitida

    Returns:
        String sanitizado
    """
    if not isinstance(value, str):
        return str(value)[:max_length]

    # Truncar a longitud maxima
    value = value[:max_length]

    # Escapar HTML
    value = html.escape(value)

    # Remover caracteres de control (excepto newlines y tabs)
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)

    return value


def sanitize_html(value: str, allowed_tags: Optional[List[str]] = None) -> str:
    """
    Sanitiza HTML permitiendo solo tags especificos.

    Args:
        value: HTML a sanitizar
        allowed_tags: Lista de tags permitidos (por defecto ninguno)

    Returns:
        HTML sanitizado
    """
    if allowed_tags is None:
        allowed_tags = []

    # Escapar todo el HTML primero
    escaped = html.escape(value)

    # Restaurar tags permitidos
    for tag in allowed_tags:
        # Restaurar tags de apertura
        escaped = escaped.replace(f"&lt;{tag}&gt;", f"<{tag}>")
        escaped = escaped.replace(f"&lt;{tag} ", f"<{tag} ")
        # Restaurar tags de cierre
        escaped = escaped.replace(f"&lt;/{tag}&gt;", f"</{tag}>")

    return escaped


def check_sql_injection(value: str) -> bool:
    """
    Verifica si un string contiene patrones de SQL injection.

    Args:
        value: String a verificar

    Returns:
        True si contiene patrones sospechosos
    """
    for pattern in SQL_INJECTION_PATTERNS:
        if pattern.search(value):
            return True
    return False


def check_xss(value: str) -> bool:
    """
    Verifica si un string contiene patrones de XSS.

    Args:
        value: String a verificar

    Returns:
        True si contiene patrones sospechosos
    """
    for pattern in XSS_PATTERNS:
        if pattern.search(value):
            return True
    return False


def check_path_traversal(value: str) -> bool:
    """
    Verifica si un string contiene patrones de path traversal.

    Args:
        value: String a verificar

    Returns:
        True si contiene patrones sospechosos
    """
    for pattern in PATH_TRAVERSAL_PATTERNS:
        if pattern.search(value):
            return True
    return False


def check_command_injection(value: str) -> bool:
    """
    Verifica si un string contiene patrones de command injection.

    Args:
        value: String a verificar

    Returns:
        True si contiene patrones sospechosos
    """
    for pattern in COMMAND_INJECTION_PATTERNS:
        if pattern.search(value):
            return True
    return False


def is_safe_string(value: str) -> bool:
    """
    Verifica si un string es seguro (no contiene patrones peligrosos).

    Args:
        value: String a verificar

    Returns:
        True si es seguro
    """
    if not isinstance(value, str):
        return True

    return not (
        check_sql_injection(value)
        or check_xss(value)
        or check_path_traversal(value)
        or check_command_injection(value)
    )


# =============================================================================
# Validadores de tipo
# =============================================================================


def validate_email(email: str) -> bool:
    """
    Valida formato de email.

    Args:
        email: Email a validar

    Returns:
        True si es valido
    """
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """
    Valida formato de telefono.

    Args:
        phone: Telefono a validar

    Returns:
        True si es valido
    """
    # Remover espacios y guiones
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    # Debe ser solo numeros y opcionalmente empezar con +
    pattern = r"^\+?\d{7,15}$"
    return bool(re.match(pattern, cleaned))


def validate_integer(
    value: Any, min_val: Optional[int] = None, max_val: Optional[int] = None
) -> bool:
    """
    Valida que un valor sea entero dentro de un rango.

    Args:
        value: Valor a validar
        min_val: Valor minimo (opcional)
        max_val: Valor maximo (opcional)

    Returns:
        True si es valido
    """
    try:
        int_val = int(value)
        if min_val is not None and int_val < min_val:
            return False
        if max_val is not None and int_val > max_val:
            return False
        return True
    except (TypeError, ValueError):
        return False


def validate_float(
    value: Any, min_val: Optional[float] = None, max_val: Optional[float] = None
) -> bool:
    """
    Valida que un valor sea float dentro de un rango.

    Args:
        value: Valor a validar
        min_val: Valor minimo (opcional)
        max_val: Valor maximo (opcional)

    Returns:
        True si es valido
    """
    try:
        float_val = float(value)
        if min_val is not None and float_val < min_val:
            return False
        if max_val is not None and float_val > max_val:
            return False
        return True
    except (TypeError, ValueError):
        return False


def validate_uuid(value: str) -> bool:
    """
    Valida formato UUID.

    Args:
        value: UUID a validar

    Returns:
        True si es valido
    """
    pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    return bool(re.match(pattern, str(value).lower()))


def validate_date(value: str, format: str = "%Y-%m-%d") -> bool:
    """
    Valida formato de fecha.

    Args:
        value: Fecha a validar
        format: Formato esperado

    Returns:
        True si es valido
    """
    from datetime import datetime

    try:
        datetime.strptime(value, format)
        return True
    except ValueError:
        return False


# =============================================================================
# Validador de request body
# =============================================================================


class RequestValidator:
    """
    Validador de request body con reglas configurables.
    """

    def __init__(self):
        self._rules: Dict[str, Dict[str, Any]] = {}

    def add_rule(
        self,
        field: str,
        required: bool = False,
        field_type: Optional[type] = None,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        min_value: Optional[Union[int, float]] = None,
        max_value: Optional[Union[int, float]] = None,
        pattern: Optional[str] = None,
        choices: Optional[List[Any]] = None,
        sanitize: bool = True,
        custom_validator: Optional[Callable[[Any], bool]] = None,
    ) -> "RequestValidator":
        """
        Agrega una regla de validacion.

        Args:
            field: Nombre del campo
            required: Si el campo es requerido
            field_type: Tipo esperado (str, int, float, bool, list, dict)
            min_length: Longitud minima (para strings y listas)
            max_length: Longitud maxima
            min_value: Valor minimo (para numeros)
            max_value: Valor maximo
            pattern: Patron regex para validar
            choices: Lista de valores permitidos
            sanitize: Si sanitizar strings
            custom_validator: Funcion de validacion personalizada

        Returns:
            Self para encadenamiento
        """
        self._rules[field] = {
            "required": required,
            "type": field_type,
            "min_length": min_length,
            "max_length": max_length,
            "min_value": min_value,
            "max_value": max_value,
            "pattern": re.compile(pattern) if pattern else None,
            "choices": choices,
            "sanitize": sanitize,
            "custom_validator": custom_validator,
        }
        return self

    def validate(self, data: Dict[str, Any]) -> tuple[bool, List[str], Dict[str, Any]]:
        """
        Valida y sanitiza datos.

        Args:
            data: Diccionario de datos a validar

        Returns:
            Tupla (valido, lista_errores, datos_sanitizados)
        """
        errors = []
        sanitized = {}

        for field, rules in self._rules.items():
            value = data.get(field)

            # Verificar requerido
            if rules["required"] and value is None:
                errors.append(f"Campo '{field}' es requerido")
                continue

            if value is None:
                continue

            # Verificar tipo
            if rules["type"]:
                if rules["type"] == str and not isinstance(value, str):
                    errors.append(f"Campo '{field}' debe ser string")
                    continue
                elif rules["type"] == int:
                    try:
                        value = int(value)
                    except (TypeError, ValueError):
                        errors.append(f"Campo '{field}' debe ser entero")
                        continue
                elif rules["type"] == float:
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        errors.append(f"Campo '{field}' debe ser numero")
                        continue
                elif rules["type"] == bool:
                    if isinstance(value, str):
                        value = value.lower() in ("true", "1", "yes")
                    else:
                        value = bool(value)
                elif rules["type"] == list and not isinstance(value, list):
                    errors.append(f"Campo '{field}' debe ser lista")
                    continue
                elif rules["type"] == dict and not isinstance(value, dict):
                    errors.append(f"Campo '{field}' debe ser objeto")
                    continue

            # Sanitizar strings
            if rules["sanitize"] and isinstance(value, str):
                max_len = rules["max_length"] or 10000
                value = sanitize_string(value, max_len)

                # Verificar patrones peligrosos
                if not is_safe_string(data.get(field, "")):
                    errors.append(f"Campo '{field}' contiene caracteres no permitidos")
                    continue

            # Verificar longitud
            if rules["min_length"] is not None:
                if isinstance(value, (str, list)) and len(value) < rules["min_length"]:
                    errors.append(
                        f"Campo '{field}' debe tener al menos {rules['min_length']} caracteres"
                    )
                    continue

            if rules["max_length"] is not None:
                if isinstance(value, (str, list)) and len(value) > rules["max_length"]:
                    errors.append(
                        f"Campo '{field}' debe tener maximo {rules['max_length']} caracteres"
                    )
                    continue

            # Verificar rango numerico
            if rules["min_value"] is not None and isinstance(value, (int, float)):
                if value < rules["min_value"]:
                    errors.append(f"Campo '{field}' debe ser mayor o igual a {rules['min_value']}")
                    continue

            if rules["max_value"] is not None and isinstance(value, (int, float)):
                if value > rules["max_value"]:
                    errors.append(f"Campo '{field}' debe ser menor o igual a {rules['max_value']}")
                    continue

            # Verificar patron
            if rules["pattern"] and isinstance(value, str):
                if not rules["pattern"].match(value):
                    errors.append(f"Campo '{field}' tiene formato invalido")
                    continue

            # Verificar choices
            if rules["choices"] is not None:
                if value not in rules["choices"]:
                    errors.append(f"Campo '{field}' debe ser uno de: {rules['choices']}")
                    continue

            # Validador personalizado
            if rules["custom_validator"]:
                if not rules["custom_validator"](value):
                    errors.append(f"Campo '{field}' no paso validacion personalizada")
                    continue

            sanitized[field] = value

        return len(errors) == 0, errors, sanitized


# =============================================================================
# Middleware de validacion
# =============================================================================


def init_request_validation(app, max_content_length=10 * 1024 * 1024) -> None:
    """
    Inicializa validacion de requests para Flask.

    Args:
        app: Aplicacion Flask
        max_content_length: Tamano maximo de request body (default 10MB)
    """
    # None = sin limite (Flask default)
    app.config["MAX_CONTENT_LENGTH"] = max_content_length

    @app.before_request
    def validate_content_type():
        # Para requests POST/PUT/PATCH, verificar Content-Type
        # IMPORTANTE: No acceder a request.data para multipart (fuerza lectura completa del body)
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.content_type or ""
            allowed_types = ["application/json", "application/x-www-form-urlencoded", "multipart/form-data"]
            if any(ct in content_type for ct in allowed_types):
                return  # Content-Type valido, continuar
            if request.content_length and request.content_length > 0:
                logger.warning(f"Content-Type invalido: {content_type}")


# =============================================================================
# Decorador de validacion
# =============================================================================


def validate_json(validator: RequestValidator):
    """
    Decorador para validar JSON body de request.

    Args:
        validator: Instancia de RequestValidator con reglas

    Usage:
        validator = RequestValidator()
        validator.add_rule("name", required=True, field_type=str, max_length=100)

        @validate_json(validator)
        def create_user():
            data = g.validated_data
            ...
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Obtener JSON body
            try:
                data = request.get_json(force=True, silent=True) or {}
            except Exception:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "invalid_json",
                                "message": "Request body must be valid JSON",
                            },
                        }
                    ),
                    400,
                )

            # Validar
            valid, errors, sanitized = validator.validate(data)

            if not valid:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "validation_error",
                                "message": "Validation failed",
                                "details": errors,
                            },
                        }
                    ),
                    400,
                )

            # Guardar datos validados en g
            g.validated_data = sanitized

            return func(*args, **kwargs)

        return wrapper

    return decorator


def validate_query_params(**rules):
    """
    Decorador para validar query parameters.

    Args:
        **rules: Reglas de validacion por parametro

    Usage:
        @validate_query_params(
            page={"type": int, "default": 1, "min": 1},
            limit={"type": int, "default": 20, "min": 1, "max": 100}
        )
        def list_items():
            page = g.query_params["page"]
            limit = g.query_params["limit"]
            ...
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            params = {}
            errors = []

            for param, config in rules.items():
                value = request.args.get(param)
                param_type = config.get("type", str)
                default = config.get("default")
                required = config.get("required", False)
                min_val = config.get("min")
                max_val = config.get("max")
                choices = config.get("choices")

                # Usar default si no hay valor
                if value is None:
                    if required:
                        errors.append(f"Query param '{param}' es requerido")
                        continue
                    params[param] = default
                    continue

                # Convertir tipo
                try:
                    if param_type == int:
                        value = int(value)
                    elif param_type == float:
                        value = float(value)
                    elif param_type == bool:
                        value = value.lower() in ("true", "1", "yes")
                except (TypeError, ValueError):
                    errors.append(f"Query param '{param}' debe ser {param_type.__name__}")
                    continue

                # Validar rango
                if min_val is not None and isinstance(value, (int, float)):
                    if value < min_val:
                        errors.append(f"Query param '{param}' debe ser >= {min_val}")
                        continue

                if max_val is not None and isinstance(value, (int, float)):
                    if value > max_val:
                        errors.append(f"Query param '{param}' debe ser <= {max_val}")
                        continue

                # Validar choices
                if choices is not None and value not in choices:
                    errors.append(f"Query param '{param}' debe ser uno de: {choices}")
                    continue

                # Sanitizar strings
                if isinstance(value, str):
                    value = sanitize_string(value, 1000)
                    if not is_safe_string(request.args.get(param, "")):
                        errors.append(f"Query param '{param}' contiene caracteres no permitidos")
                        continue

                params[param] = value

            if errors:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "validation_error",
                                "message": "Query parameters validation failed",
                                "details": errors,
                            },
                        }
                    ),
                    400,
                )

            g.query_params = params
            return func(*args, **kwargs)

        return wrapper

    return decorator
