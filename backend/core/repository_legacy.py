"""
DEPRECATED: Este archivo mantiene compatibilidad hacia atras.
Usar backend.core.repository en su lugar.

Los repositorios han sido modularizados en:
- backend/core/repository/base.py         - Funciones de conexion
- backend/core/repository/solicitud.py    - SolicitudRepository
- backend/core/repository/presupuesto.py  - PresupuestoRepository
- backend/core/repository/tratamiento.py  - TratamientoRepository
- backend/core/repository/proveedor.py    - Proveedor*Repository (4 clases)
- backend/core/repository/material.py     - MaterialRepository
- backend/core/repository/config.py       - ConfigAlmacenesRepository
- backend/core/repository/equivalencias.py- EquivalenciasRepository
- backend/core/repository/mrp.py          - MrpRepository
- backend/core/repository/decision.py     - DecisionAbastecimientoRepository

AVISO: Este modulo sera eliminado en una version futura.
       Por favor, actualice sus imports a 'backend.core.repository'.
"""

import warnings

# Emitir advertencia de deprecacion al importar
warnings.warn(
    "backend.core.repository_legacy esta deprecado. "
    "Use 'from backend.core.repository import ...' en su lugar. "
    "Este modulo sera eliminado en una version futura.",
    DeprecationWarning,
    stacklevel=2,
)

# Re-export everything for backward compatibility
from backend.core.repository import (
    # Base functions
    _connect,
    _connect_catalogo,
    _connect_equivalentes,
    _connect_sap_data,
    _db_path,
    _table_exists,
    # Repositories
    ConfigAlmacenesRepository,
    DecisionAbastecimientoRepository,
    EquivalenciasRepository,
    MaterialRepository,
    MrpRepository,
    PresupuestoRepository,
    ProveedorExternoRepository,
    ProveedorInternoRepository,
    ProveedorPreciosRepository,
    ProveedorRepository,
    SolicitudRepository,
    TratamientoRepository,
)

__all__ = [
    # Base functions
    "_db_path",
    "_connect",
    "_table_exists",
    "_connect_catalogo",
    "_connect_equivalentes",
    "_connect_sap_data",
    # Repositories
    "SolicitudRepository",
    "PresupuestoRepository",
    "TratamientoRepository",
    "ProveedorRepository",
    "ProveedorPreciosRepository",
    "ProveedorInternoRepository",
    "ProveedorExternoRepository",
    "MaterialRepository",
    "ConfigAlmacenesRepository",
    "EquivalenciasRepository",
    "MrpRepository",
    "DecisionAbastecimientoRepository",
]
