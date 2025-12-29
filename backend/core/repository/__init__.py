"""
Repository Package - Modular Data Access Layer

Re-exports all repository classes and helper functions for backward compatibility.

Usage:
    from backend.core.repository import SolicitudRepository, MaterialRepository
    # or
    from backend.core.repository.solicitud import SolicitudRepository
"""

# Base functions
from backend.core.repository.base import (
    _connect,
    _connect_catalogo,
    _connect_equivalentes,
    _connect_sap_data,
    _db_path,
    _table_exists,
)

# Repository classes
from backend.core.repository.config import ConfigAlmacenesRepository
from backend.core.repository.decision import DecisionAbastecimientoRepository
from backend.core.repository.equivalencias import EquivalenciasRepository
from backend.core.repository.material import MaterialRepository
from backend.core.repository.mrp import MrpRepository
from backend.core.repository.presupuesto import PresupuestoRepository
from backend.core.repository.proveedor import (
    ProveedorExternoRepository,
    ProveedorInternoRepository,
    ProveedorPreciosRepository,
    ProveedorRepository,
)
from backend.core.repository.solicitud import SolicitudRepository
from backend.core.repository.tratamiento import TratamientoRepository

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
