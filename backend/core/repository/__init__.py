"""
Repository Package
Re-exports all repository classes for backward compatibility

This module structure allows for gradual migration of repository classes
into separate files while maintaining backward compatibility.

Usage:
    from backend.core.repository import SolicitudRepository
    # or
    from backend.core.repository.base import _connect

Sprint: Technical Audit - Phase 3
"""

# Re-export base utilities
from .base import (
    _db_path,
    _connect,
    _connect_catalogo,
    _connect_equivalentes,
    _connect_sap_data,
    logger,
)

# Re-export all repository classes from the original monolithic file
# This maintains backward compatibility with existing imports
try:
    from backend.core.repository_legacy import (
        SolicitudRepository,
        PresupuestoRepository,
        TratamientoRepository,
        ProveedorRepository,
        MaterialRepository,
        ConfigAlmacenesRepository,
        ProveedorPreciosRepository,
        ProveedorInternoRepository,
        EquivalenciasRepository,
        MrpRepository,
        DecisionAbastecimientoRepository,
        ProveedorExternoRepository,
    )
except ImportError:
    from core.repository_legacy import (
        SolicitudRepository,
        PresupuestoRepository,
        TratamientoRepository,
        ProveedorRepository,
        MaterialRepository,
        ConfigAlmacenesRepository,
        ProveedorPreciosRepository,
        ProveedorInternoRepository,
        EquivalenciasRepository,
        MrpRepository,
        DecisionAbastecimientoRepository,
        ProveedorExternoRepository,
    )

__all__ = [
    # Base utilities
    "_db_path",
    "_connect",
    "_connect_catalogo",
    "_connect_equivalentes",
    "_connect_sap_data",
    # Repository classes
    "SolicitudRepository",
    "PresupuestoRepository",
    "TratamientoRepository",
    "ProveedorRepository",
    "MaterialRepository",
    "ConfigAlmacenesRepository",
    "ProveedorPreciosRepository",
    "ProveedorInternoRepository",
    "EquivalenciasRepository",
    "MrpRepository",
    "DecisionAbastecimientoRepository",
    "ProveedorExternoRepository",
]
