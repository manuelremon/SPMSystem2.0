"""
Planner routes - Gestion de planificacion de solicitudes

Modularizado en sub-modulos por responsabilidad:
- core.py: Dashboard stats, listados de solicitudes, presupuesto
- solicitudes.py: Aceptar, finalizar, comentar, tratar items, obtener tratamiento
- decisiones.py: Opciones abastecimiento, guardar tratamiento, multifuente, MRP
- proveedores.py: Precios negociados de proveedores
- acciones.py: Ejecutar acciones post-tratamiento, estado acciones
- consultas.py: Consultas pendientes, responder consultas de stock/referente
- helpers.py: Funciones auxiliares internas del modulo
"""

from flask import Blueprint

# Blueprint principal (url_prefix se define en blueprints.py al registrar)
bp = Blueprint("planner_api", __name__)

# Blueprint historico (legacy, mantener para compatibilidad)
planner_bp = Blueprint("planner", __name__)

# Importar sub-modulos para registrar rutas en bp
# Cada sub-modulo hace: from backend.routes.planner import bp
from backend.routes.planner import (
    acciones,  # noqa: E402, F401
    consultas,  # noqa: E402, F401
    core,  # noqa: E402, F401
    decisiones,  # noqa: E402, F401
    proveedores,  # noqa: E402, F401
    solicitudes,  # noqa: E402, F401
)

# Exportar blueprints para registro en blueprints.py
__all__ = ["bp", "planner_bp"]
