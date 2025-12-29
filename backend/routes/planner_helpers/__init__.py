"""
Planner Routes Package

Este paquete contiene los endpoints para gestión de planificación de solicitudes.

Estructura modular:
- helpers.py: Funciones auxiliares (_current_user, _require_planner_role, etc.)
- data_loaders.py: Cargadores de datos (stock, consumo, equivalencias)
- (endpoints.py): Endpoints principales (pendiente migración)

Los blueprints principales se re-exportan desde el archivo original
para mantener compatibilidad mientras se migra el código gradualmente.
"""

# Re-export helpers for external use
from backend.routes.planner_helpers.helpers import (
    _current_user,
    _get_user,
    _norm_codigo,
    _require_planner_role,
    _require_solicitud_access,
    _table_exists,
)

# Re-export data loaders
from backend.routes.planner_helpers.data_loaders import (
    _calcular_consumo_promedio,
    _get_consumo_sql,
    _load_consumo_db,
    _load_consumo_stock,
    _load_equivalencias_catalogo,
    _load_stock_db,
    _load_stock_xlsx,
    _rankear_proveedores,
    _stock_detalle,
    _stock_disponible,
)

__all__ = [
    # Helpers
    "_current_user",
    "_get_user",
    "_norm_codigo",
    "_require_planner_role",
    "_require_solicitud_access",
    "_table_exists",
    # Data loaders
    "_load_stock_db",
    "_load_stock_xlsx",
    "_load_equivalencias_catalogo",
    "_stock_disponible",
    "_stock_detalle",
    "_rankear_proveedores",
    "_load_consumo_db",
    "_load_consumo_stock",
    "_get_consumo_sql",
    "_calcular_consumo_promedio",
]
