"""
Schemas para el sistema de notificaciones en tiempo real.

Define las estructuras de datos para notificaciones, incluyendo
validación y serialización JSON.
"""

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import List, Optional


class NotificacionTipo(str, Enum):
    """Tipos de notificaciones"""

    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    SOLICITUD_CREATED = "solicitud_created"
    SOLICITUD_APPROVED = "solicitud_approved"
    SOLICITUD_REJECTED = "solicitud_rejected"
    SOLICITUD_PLANNED = "solicitud_planned"
    SOLICITUD_DISPATCHED = "solicitud_dispatched"


@dataclass
class NotificacionCreate:
    """Schema para crear una nueva notificación"""

    destinatario_id: str
    mensaje: str
    tipo: str = "info"
    solicitud_id: Optional[int] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class Notificacion:
    """Schema completo de una notificación"""

    id: int
    destinatario_id: str
    mensaje: str
    tipo: str
    leido: bool
    created_at: str
    solicitud_id: Optional[int] = None

    @classmethod
    def from_db_row(cls, row: dict):
        """Construir desde un row de SQLite"""
        return cls(
            id=row.get("id"),
            destinatario_id=row.get("destinatario_id"),
            mensaje=row.get("mensaje"),
            tipo=row.get("tipo", "info"),
            leido=bool(row.get("leido", 0)),
            created_at=row.get("created_at"),
            solicitud_id=row.get("solicitud_id"),
        )

    def to_dict(self):
        return asdict(self)


@dataclass
class NotificacionListResponse:
    """Respuesta para lista de notificaciones"""

    ok: bool
    total: int
    unread_count: int
    notifications: List[dict] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


@dataclass
class NotificacionMarkReadRequest:
    """Request para marcar notificación como leída"""

    notification_id: int

    @classmethod
    def from_request(cls, data: dict):
        return cls(notification_id=data.get("notification_id"))


@dataclass
class NotificacionEvent:
    """Evento de notificación para SSE"""

    event: str
    data: dict

    def to_sse_format(self) -> str:
        """Formatear para Server-Sent Events"""
        import json

        return f"event: {self.event}\ndata: {json.dumps(self.data)}\n\n"


# Helper functions
def create_solicitud_notification(
    solicitud_id: int, destinatario_id: str, tipo: str, **kwargs
) -> NotificacionCreate:
    """
    Helper para crear notificaciones de solicitudes.

    Args:
        solicitud_id: ID de la solicitud
        destinatario_id: ID del usuario destinatario
        tipo: Tipo de notificación
        **kwargs: Argumentos adicionales para el mensaje

    Returns:
        NotificacionCreate ready to insert
    """
    messages = {
        "solicitud_created": "Nueva solicitud #{id} creada",
        "solicitud_approved": "Solicitud #{id} aprobada",
        "solicitud_rejected": "Solicitud #{id} rechazada: {motivo}",
        "solicitud_planned": "Solicitud #{id} planificada",
        "solicitud_dispatched": "Solicitud #{id} despachada",
    }

    template = messages.get(tipo, "Actualización de solicitud #{id}")
    mensaje = template.format(id=solicitud_id, **kwargs)

    return NotificacionCreate(
        destinatario_id=destinatario_id, mensaje=mensaje, tipo=tipo, solicitud_id=solicitud_id
    )
