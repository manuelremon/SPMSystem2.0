"""
Solicitudes routes package - SQLite-backed (demo)

Refactorizado para usar FSM centralizado (Sprint 1.6)
Dividido en sub-modulos para mantenibilidad (Sprint 26+)

Sub-modulos:
- crud.py: list, get, create, delete, draft
- estados.py: enviar, aprobar, rechazar, cancelar, reenviar
- interaccion.py: comentar, historial, transiciones
- helpers.py: funciones internas compartidas
"""

from flask import Blueprint

bp = Blueprint("solicitudes", __name__, url_prefix="/api/solicitudes")

# Importar sub-modulos para registrar rutas en el blueprint
from backend.routes.solicitudes import (
    crud,  # noqa: E402, F401
    estados,  # noqa: E402, F401
    interaccion,  # noqa: E402, F401
)

# Re-exportar funciones de ruta para compatibilidad con imports externos
# (e.g., tests que hacen `from backend.routes.solicitudes import aprobar_solicitud`)
from backend.routes.solicitudes.crud import (  # noqa: E402, F401
    create_solicitud,
    eliminar_solicitud,
    get_solicitud,
    guardar_borrador,
    list_solicitudes,
)
from backend.routes.solicitudes.estados import (  # noqa: E402, F401
    aprobar_solicitud,
    cancelar_solicitud,
    enviar_solicitud,
    rechazar_solicitud,
    reenviar_solicitud,
)
from backend.routes.solicitudes.interaccion import (  # noqa: E402, F401
    comentar_solicitud,
    get_historial_estados,
    get_transiciones_posibles,
)
