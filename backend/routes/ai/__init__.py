"""
Endpoints API para recomendaciones inteligentes de IA.
Sprint 6.3 - Expone funcionalidades del servicio unificado de IA.

Soporta modo temporal con datos importados desde Excel.

Endpoints:
- GET  /api/ai/status              - Estado de los pipelines ML
- POST /api/ai/train               - Entrenar modelos ML
- GET  /api/ai/solicitudes/priorizar - Priorizar solicitudes
- GET  /api/ai/materiales/similares  - Materiales similares
- GET  /api/ai/materiales/forecast   - Proyeccion de demanda
- GET  /api/ai/materiales/analisis   - Analisis completo
- POST /api/ai/sugerir-accion        - Sugerir accion para solicitud
- GET  /api/ai/alertas               - Alertas inteligentes
"""

from flask import Blueprint

bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# Import all sub-modules so their routes register on bp
from backend.routes.ai import (  # noqa: E402, F401
    core,
    forecast,
    materiales,
    plan_compras,
    recomendaciones,
)
