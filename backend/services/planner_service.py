"""
Servicio de Planner: logica de negocio PASO 1-3 de tratamiento de solicitud

MODULARIZADO (Sprint 23):
Este archivo ahora re-exporta desde la estructura modular en services/planner/

Modulos:
- planner/analisis.py: Paso 1 - Analisis integral
- planner/opciones.py: Paso 2 - Opciones de abastecimiento
- planner/tratamiento.py: Paso 3 - Guardar tratamiento

V2: Integracion completa de fuentes de datos:
- Proveedores externos con precios negociados
- Proveedores internos (transferencias entre centros)
- Equivalencias desde equivalentes.db
- Parametros MRP desde sap_data.db
- Decisiones multi-fuente
"""

# Re-exportar desde modulos
from backend.services.planner import (
    guardar_decision_multifuente,
    obtener_resumen_decisiones,
    paso_1_analizar_solicitud,
    paso_2_opciones_abastecimiento,
    paso_3_guardar_tratamiento,
)

# Re-exportar helpers para compatibilidad
from backend.services.planner.helpers import (
    _build_proveedor_option,
    _calcular_score_opcion,
    _calcular_score_opcion_v2,
    norm_codigo,
)

__all__ = [
    # Pasos principales
    "paso_1_analizar_solicitud",
    "paso_2_opciones_abastecimiento",
    "paso_3_guardar_tratamiento",
    # Multi-fuente
    "guardar_decision_multifuente",
    "obtener_resumen_decisiones",
    # Helpers
    "norm_codigo",
    "_calcular_score_opcion",
    "_calcular_score_opcion_v2",
    "_build_proveedor_option",
]
