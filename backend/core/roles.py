"""
Módulo de gestión de roles - Normalización y verificación

Este módulo centraliza toda la lógica de roles para garantizar consistencia
entre todos los endpoints y servicios.
"""

import json
from typing import List, Set

# Roles que tienen acceso total (MODO DIOS)
# Usar igualdad exacta para evitar falsos positivos
ADMIN_ROLES: Set[str] = frozenset({"admin", "administrador", "administrator", "superadmin"})

# Roles válidos del sistema
VALID_ROLES: Set[str] = frozenset(
    {
        # Administración
        "admin",
        "administrador",
        # Usuarios base
        "usuario",
        "user",
        "solicitante",
        # Planificación
        "planificador",
        "planner",
        # Coordinación
        "coordinador",
        "coordinator",
        # Aprobación general
        "aprobador",
        "approver",
        # Aprobación específica
        "aprobador_solicitudes",
        "aprobador solicitudes",
        "aprobador_presupuestos",
        "aprobador presupuestos",
        # Niveles jerárquicos
        "jefe",
        "gerente1",
        "gerente2",
        # Solo lectura
        "viewer",
        "lector",
    }
)


def normalize_roles(rol_value) -> List[str]:
    """
    Normaliza roles a una lista de strings en minúsculas.

    Soporta múltiples formatos de entrada:
    - JSON array: '["admin", "planner"]'
    - String simple: "Admin"
    - Comma-separated: "Admin,Planner"
    - Semicolon-separated: "Admin;Planner"
    - Lista Python: ["Admin", "Planner"]
    - None o vacío

    Args:
        rol_value: Valor de rol en cualquier formato

    Returns:
        Lista de roles normalizados (lowercase, trimmed, sin duplicados)
    """
    if not rol_value:
        return []

    roles = []

    # Si ya es una lista
    if isinstance(rol_value, (list, tuple)):
        roles = list(rol_value)
    elif isinstance(rol_value, str):
        rol_str = rol_value.strip()
        if not rol_str:
            return []

        # Intentar parsear como JSON array
        if rol_str.startswith("["):
            try:
                parsed = json.loads(rol_str)
                if isinstance(parsed, list):
                    roles = parsed
                else:
                    roles = [rol_str]
            except (json.JSONDecodeError, ValueError):
                roles = [rol_str]
        # Separar por coma o punto y coma
        elif "," in rol_str or ";" in rol_str:
            roles = [r for r in rol_str.replace(";", ",").split(",")]
        # String simple
        else:
            roles = [rol_str]
    else:
        # Convertir a string como fallback
        roles = [str(rol_value)]

    # Normalizar: trim, lowercase, filtrar vacíos, sin duplicados
    normalized = []
    seen = set()
    for r in roles:
        if r is not None:
            clean = str(r).strip().lower()
            if clean and clean not in seen:
                normalized.append(clean)
                seen.add(clean)

    return normalized


def is_admin(rol_value) -> bool:
    """
    Verifica si el usuario tiene rol de administrador.

    Args:
        rol_value: Valor de rol en cualquier formato

    Returns:
        True si tiene rol admin, False en caso contrario
    """
    roles = normalize_roles(rol_value)
    return any(role in ADMIN_ROLES for role in roles)


def has_role(rol_value, required_role: str) -> bool:
    """
    Verifica si el usuario tiene un rol específico.

    Args:
        rol_value: Valor de rol en cualquier formato
        required_role: Rol requerido (case-insensitive)

    Returns:
        True si tiene el rol, False en caso contrario
    """
    roles = normalize_roles(rol_value)
    required = required_role.lower().strip()
    return required in roles


def has_any_role(rol_value, required_roles: List[str]) -> bool:
    """
    Verifica si el usuario tiene alguno de los roles requeridos.

    Args:
        rol_value: Valor de rol en cualquier formato
        required_roles: Lista de roles requeridos (case-insensitive)

    Returns:
        True si tiene al menos uno de los roles, False en caso contrario
    """
    roles = set(normalize_roles(rol_value))
    required = {r.lower().strip() for r in required_roles}
    return bool(roles & required)


# =============================================================================
# Authorization Decorators
# =============================================================================


from functools import wraps

from flask import g, jsonify


def require_auth(f):
    """
    Decorator que verifica que el usuario este autenticado.

    Uso:
    @bp.route("/some-protected-route")
    @require_auth
    def some_protected_route():
        # g.user esta garantizado que existe aqui
        ...
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, "user") or g.user is None:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "unauthorized",
                            "message": "Authentication required for this resource.",
                        },
                    }
                ),
                401,
            )
        return f(*args, **kwargs)

    return decorated_function


def require_admin(f):
    """
    Decorator que verifica que el usuario sea administrador.

    Implica @require_auth.
    """

    @wraps(f)
    @require_auth  # Asegura que g.user existe primero
    def decorated_function(*args, **kwargs):
        user_roles = g.user.get("rol", "")
        if not is_admin(user_roles):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Administrator privileges required for this resource.",
                        },
                    }
                ),
                403,
            )
        return f(*args, **kwargs)

    return decorated_function


def require_role(required_roles: List[str]):
    """
    Decorator que verifica que el usuario tenga al menos uno de los roles requeridos.

    Implica @require_auth.

    Uso:
        @bp.route("/planner-only")
        @require_role(["planificador", "admin"])
        def planner_only():
            ...

    Args:
        required_roles: Lista de roles permitidos (case-insensitive)
    """

    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            user_roles = normalize_roles(g.user.get("rol", ""))
            required = {r.lower().strip() for r in required_roles}

            # Admin siempre tiene acceso
            if any(r in ADMIN_ROLES for r in user_roles):
                return f(*args, **kwargs)

            # Verificar si tiene alguno de los roles requeridos
            if not any(r in required for r in user_roles):
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "forbidden",
                                "message": f"Se requiere uno de los siguientes roles: {', '.join(required_roles)}",
                            },
                        }
                    ),
                    403,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def format_user_response(user: dict) -> dict:
    """
    Formatea la respuesta de usuario con roles normalizados.

    Args:
        user: Diccionario con datos del usuario de la BD

    Returns:
        Diccionario formateado para respuesta API
    """
    rol_raw = user.get("rol", "")
    roles = normalize_roles(rol_raw)

    user_id = user.get("id_spm") or user.get("id")

    # Detectar si es usuario nuevo: solo tiene rol Solicitante y sin sector/centros asignados
    is_new_user = (
        roles == ["solicitante"] and
        not user.get("sector") and
        not user.get("centros")
    )

    return {
        "id": user_id,
        "id_spm": user_id,  # Alias para compatibilidad con frontend
        "username": user.get("id_spm"),
        "email": user.get("mail"),
        "nombre": f"{user.get('nombre', '')} {user.get('apellido', '')}".strip(),
        "rol": rol_raw,  # Mantener original para compatibilidad
        "roles": roles,  # Lista normalizada
        "is_admin": is_admin(rol_raw),
        "is_new_user": is_new_user,  # Flag para redirigir a pagina de nuevo usuario
        "sector_id": user.get("sector"),
        "centro_id": user.get("centros"),
    }
