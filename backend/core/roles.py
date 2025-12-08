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
        "admin",
        "administrador",
        "usuario",
        "user",
        "planificador",
        "planner",
        "coordinador",
        "coordinator",
        "aprobador",
        "approver",
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

    return {
        "id": user.get("id_spm") or user.get("id"),
        "username": user.get("id_spm"),
        "email": user.get("mail"),
        "nombre": f"{user.get('nombre', '')} {user.get('apellido', '')}".strip(),
        "rol": rol_raw,  # Mantener original para compatibilidad
        "roles": roles,  # Lista normalizada
        "is_admin": is_admin(rol_raw),
        "sector_id": user.get("sector"),
        "centro_id": user.get("centros"),
    }
