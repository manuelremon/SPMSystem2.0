"""
Core package - Centraliza componentes fundamentales del backend.

Exports:
    - Excepciones personalizadas (SPMException, NotFoundError, etc.)
    - Configuración (settings)
    - Database utilities (get_db_connection, get_db_transaction)
"""

from backend.core.errors import (
    BusinessRuleError,
    ConflictError,
    DatabaseError,
    ForbiddenError,
    NotFoundError,
    SPMException,
    UnauthorizedError,
    ValidationError,
)

__all__ = [
    "SPMException",
    "NotFoundError",
    "ValidationError",
    "ForbiddenError",
    "UnauthorizedError",
    "ConflictError",
    "DatabaseError",
    "BusinessRuleError",
]
