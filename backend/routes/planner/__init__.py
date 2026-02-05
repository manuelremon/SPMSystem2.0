"""
Planner routes - Gestion de planificacion de solicitudes

Modularizado en sub-modulos por responsabilidad (Sprint 23):
- dashboard.py: Dashboard y listados
- analisis.py: Paso 1 - Analisis inicial
- decisiones.py: Pasos 2-3 - Opciones y decisiones
- acciones.py: Paso 4 - Acciones post-tratamiento
- precios.py: Precios negociados
- ciclo_vida.py: Transiciones de estado (aceptar, finalizar)

Nota: items.py fue planificado pero no implementado.
"""

from flask import Blueprint

# Blueprint principal (url_prefix se define en app.py al registrar)
bp = Blueprint("planner_api", __name__)

# Blueprint historico (legacy, mantener para compatibilidad)
planner_bp = Blueprint("planner", __name__)

# Importar y registrar sub-blueprints
from backend.routes.planner.dashboard import dashboard_bp
from backend.routes.planner.analisis import analisis_bp
from backend.routes.planner.decisiones import decisiones_bp
from backend.routes.planner.acciones import acciones_bp
from backend.routes.planner.precios import precios_bp
from backend.routes.planner.ciclo_vida import ciclo_vida_bp

# Registrar todos los sub-blueprints en el blueprint principal
bp.register_blueprint(dashboard_bp)
bp.register_blueprint(analisis_bp)
bp.register_blueprint(decisiones_bp)
bp.register_blueprint(acciones_bp)
bp.register_blueprint(precios_bp)
bp.register_blueprint(ciclo_vida_bp)

# Exportar blueprints para registro en app.py
__all__ = ["bp", "planner_bp"]
