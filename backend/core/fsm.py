"""
Maquina de Estados Finitos (FSM) para solicitudes.

Este modulo centraliza la gestion de estados de solicitudes,
garantizando transiciones validas y registrando historial completo.

Diseñado para backward compatibility con estados legacy.
"""

import json
from enum import Enum
from typing import Any, Dict, List, Optional

try:
    from backend.core.db import get_db_connection, get_db_transaction
except ImportError:
    from core.db import get_db_connection, get_db_transaction


# =============================================================================
# Excepciones
# =============================================================================


class FSMError(Exception):
    """Excepcion base para errores del FSM."""

    pass


class TransicionInvalidaError(FSMError):
    """Se levanta cuando se intenta una transicion no permitida."""

    def __init__(self, estado_actual: str, estado_nuevo: str):
        self.estado_actual = estado_actual
        self.estado_nuevo = estado_nuevo
        super().__init__(
            f"Transicion invalida: no se puede ir de '{estado_actual}' a '{estado_nuevo}'"
        )


class SolicitudNoEncontradaError(FSMError):
    """Se levanta cuando la solicitud no existe."""

    def __init__(self, solicitud_id: int):
        self.solicitud_id = solicitud_id
        super().__init__(f"Solicitud no encontrada: {solicitud_id}")


# =============================================================================
# Enum de Estados
# =============================================================================


class EstadoSolicitud(str, Enum):
    """
    Estados posibles de una solicitud.

    Hereda de str para permitir comparaciones directas con strings.
    """

    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_PLANNING = "in_planning"
    IN_TREATMENT = "in_treatment"
    TREATED = "treated"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    def __str__(self) -> str:
        return self.value

    def __eq__(self, other: object) -> bool:
        if isinstance(other, str):
            return self.value == other
        return super().__eq__(other)

    def __hash__(self) -> int:
        return hash(self.value)


# =============================================================================
# Transiciones Validas
# =============================================================================


TRANSICIONES_VALIDAS: Dict[EstadoSolicitud, List[EstadoSolicitud]] = {
    EstadoSolicitud.DRAFT: [EstadoSolicitud.SUBMITTED, EstadoSolicitud.CANCELLED],
    EstadoSolicitud.SUBMITTED: [EstadoSolicitud.APPROVED, EstadoSolicitud.REJECTED],
    EstadoSolicitud.APPROVED: [EstadoSolicitud.IN_PLANNING, EstadoSolicitud.CANCELLED],
    EstadoSolicitud.IN_PLANNING: [EstadoSolicitud.IN_TREATMENT, EstadoSolicitud.REJECTED],
    EstadoSolicitud.IN_TREATMENT: [
        EstadoSolicitud.TREATED,
        EstadoSolicitud.IN_PLANNING,  # Permite volver atras
    ],
    EstadoSolicitud.TREATED: [EstadoSolicitud.COMPLETED],
    EstadoSolicitud.REJECTED: [EstadoSolicitud.DRAFT],  # Permite reenviar
    EstadoSolicitud.COMPLETED: [],  # Estado terminal
    EstadoSolicitud.CANCELLED: [],  # Estado terminal
}


# =============================================================================
# Mapeo Bidireccional (Backward Compatibility)
# =============================================================================


# Mapeo de estados legacy (display) a estados nuevos (internos)
ESTADO_LEGACY_A_NUEVO: Dict[str, str] = {
    # Formato capitalizado (legacy)
    "Borrador": "draft",
    "Enviada": "submitted",
    "Aprobada": "approved",
    "Rechazada": "rejected",
    "En Progreso": "in_planning",
    "En progreso": "in_planning",
    "En tratamiento": "in_treatment",
    "En Tratamiento": "in_treatment",
    "Tratado": "treated",
    "Tratada": "treated",
    "Finalizada": "completed",
    "Completada": "completed",
    "Cancelada": "cancelled",
    # Formatos alternativos encontrados en el sistema
    "submitted": "submitted",
    "approved": "approved",
    "rejected": "rejected",
    "processing": "in_planning",
    "Pendiente": "submitted",
    "pendiente": "submitted",
}

# Mapeo de estados nuevos a display (para UI)
ESTADO_NUEVO_A_DISPLAY: Dict[str, str] = {
    "draft": "Borrador",
    "submitted": "Enviada",
    "approved": "Aprobada",
    "rejected": "Rechazada",
    "in_planning": "En Progreso",
    "in_treatment": "En tratamiento",
    "treated": "Tratado",
    "completed": "Finalizada",
    "cancelled": "Cancelada",
}


def normalizar_estado(estado: str) -> str:
    """
    Normaliza un estado a formato interno (minusculas, snake_case).

    Acepta tanto estados legacy como nuevos.

    Args:
        estado: Estado en cualquier formato

    Returns:
        Estado normalizado (ej: "submitted", "approved")
    """
    if not estado:
        return "draft"

    # Si ya esta en formato nuevo, retornar
    if estado in [e.value for e in EstadoSolicitud]:
        return estado

    # Buscar en mapeo legacy
    return ESTADO_LEGACY_A_NUEVO.get(estado, estado)


def estado_para_display(estado: str) -> str:
    """
    Convierte un estado interno a formato de display (para UI).

    Args:
        estado: Estado en formato interno

    Returns:
        Estado para mostrar en UI (ej: "Enviada", "Aprobada")
    """
    estado_normalizado = normalizar_estado(estado)
    return ESTADO_NUEVO_A_DISPLAY.get(estado_normalizado, estado)


def get_estado_enum(estado: str) -> EstadoSolicitud:
    """
    Obtiene el enum correspondiente a un estado string.

    Args:
        estado: Estado en cualquier formato

    Returns:
        EstadoSolicitud enum

    Raises:
        ValueError si el estado no es valido
    """
    estado_normalizado = normalizar_estado(estado)
    try:
        return EstadoSolicitud(estado_normalizado)
    except ValueError:
        raise ValueError(f"Estado no reconocido: {estado}")


# =============================================================================
# Funciones de Validacion
# =============================================================================


def validar_transicion(
    estado_actual: EstadoSolicitud | str, estado_nuevo: EstadoSolicitud | str
) -> bool:
    """
    Valida si una transicion de estado es permitida.

    Args:
        estado_actual: Estado actual de la solicitud
        estado_nuevo: Estado al que se quiere transicionar

    Returns:
        True si la transicion es valida, False en caso contrario
    """
    # Normalizar a enum
    if isinstance(estado_actual, str):
        try:
            estado_actual = get_estado_enum(estado_actual)
        except ValueError:
            return False

    if isinstance(estado_nuevo, str):
        try:
            estado_nuevo = get_estado_enum(estado_nuevo)
        except ValueError:
            return False

    # No permitir transicion al mismo estado
    if estado_actual == estado_nuevo:
        return False

    # Verificar si la transicion esta en la lista de permitidas
    transiciones_permitidas = TRANSICIONES_VALIDAS.get(estado_actual, [])
    return estado_nuevo in transiciones_permitidas


def get_transiciones_posibles(estado_actual: EstadoSolicitud | str) -> List[str]:
    """
    Obtiene la lista de estados a los que se puede transicionar.

    Args:
        estado_actual: Estado actual de la solicitud

    Returns:
        Lista de estados posibles (en formato display)
    """
    if isinstance(estado_actual, str):
        try:
            estado_actual = get_estado_enum(estado_actual)
        except ValueError:
            return []

    transiciones = TRANSICIONES_VALIDAS.get(estado_actual, [])
    return [estado_para_display(e.value) for e in transiciones]


# =============================================================================
# Funciones Principales
# =============================================================================


def cambiar_estado(
    solicitud_id: int,
    nuevo_estado: EstadoSolicitud | str,
    actor_id: str,
    razon: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Cambia el estado de una solicitud validando la transicion.

    Esta es la funcion principal del FSM. Realiza:
    1. Validacion de existencia de solicitud
    2. Validacion de transicion permitida
    3. Actualizacion del estado
    4. Registro en historial
    5. Disparo de side-effects (notificaciones)

    Args:
        solicitud_id: ID de la solicitud
        nuevo_estado: Estado destino
        actor_id: ID del usuario que realiza el cambio
        razon: Motivo del cambio (opcional)
        metadata: Datos adicionales en formato dict (opcional)

    Returns:
        Dict con resultado: {
            "success": bool,
            "estado_anterior": str,
            "estado_nuevo": str,
            "solicitud_id": int
        }

    Raises:
        SolicitudNoEncontradaError: Si la solicitud no existe
        TransicionInvalidaError: Si la transicion no es valida
    """
    # Normalizar estado nuevo
    if isinstance(nuevo_estado, str):
        nuevo_estado_str = normalizar_estado(nuevo_estado)
    else:
        nuevo_estado_str = nuevo_estado.value

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # 1. Obtener solicitud actual
        cursor.execute(
            "SELECT id, status, id_usuario, aprobador_id, planner_id FROM solicitudes WHERE id = ?",
            (solicitud_id,),
        )
        solicitud = cursor.fetchone()

        if solicitud is None:
            raise SolicitudNoEncontradaError(solicitud_id)

        estado_actual = normalizar_estado(solicitud["status"])

        # 2. Validar transicion
        if not validar_transicion(estado_actual, nuevo_estado_str):
            raise TransicionInvalidaError(estado_actual, nuevo_estado_str)

        # 3. Actualizar estado de solicitud
        cursor.execute(
            "UPDATE solicitudes SET status = ?, updated_at = datetime('now') WHERE id = ?",
            (nuevo_estado_str, solicitud_id),
        )

        # 4. Registrar en historial
        metadata_json = json.dumps(metadata) if metadata else None
        cursor.execute(
            """
            INSERT INTO solicitudes_historial_estados
            (solicitud_id, estado_anterior, estado_nuevo, actor_id, razon, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (solicitud_id, estado_actual, nuevo_estado_str, actor_id, razon, metadata_json),
        )

        # 5. Disparar side-effects (notificaciones)
        _disparar_notificaciones(
            cursor=cursor,
            solicitud_id=solicitud_id,
            estado_anterior=estado_actual,
            estado_nuevo=nuevo_estado_str,
            actor_id=actor_id,
            razon=razon,
            solicitud_data=dict(solicitud),
        )

    return {
        "success": True,
        "estado_anterior": estado_actual,
        "estado_nuevo": nuevo_estado_str,
        "solicitud_id": solicitud_id,
    }


def obtener_historial_estados(solicitud_id: int) -> List[Dict[str, Any]]:
    """
    Obtiene el historial de transiciones de una solicitud.

    Args:
        solicitud_id: ID de la solicitud

    Returns:
        Lista de transiciones ordenadas cronologicamente
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id,
                solicitud_id,
                estado_anterior,
                estado_nuevo,
                actor_id,
                razon,
                metadata_json,
                created_at
            FROM solicitudes_historial_estados
            WHERE solicitud_id = ?
            ORDER BY created_at ASC
            """,
            (solicitud_id,),
        )
        rows = cursor.fetchall()

    return [dict(row) for row in rows]


def obtener_estado_actual(solicitud_id: int) -> Optional[str]:
    """
    Obtiene el estado actual de una solicitud.

    Args:
        solicitud_id: ID de la solicitud

    Returns:
        Estado actual normalizado, o None si no existe
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM solicitudes WHERE id = ?", (solicitud_id,))
        row = cursor.fetchone()

    if row is None:
        return None

    return normalizar_estado(row["status"])


# =============================================================================
# Side Effects (Notificaciones)
# =============================================================================


def _disparar_notificaciones(
    cursor,
    solicitud_id: int,
    estado_anterior: str,
    estado_nuevo: str,
    actor_id: str,
    razon: Optional[str],
    solicitud_data: Dict[str, Any],
) -> None:
    """
    Dispara notificaciones segun la transicion de estado.

    Esta funcion es llamada internamente por cambiar_estado.
    """
    destinatario = None
    mensaje = None

    # Determinar destinatario y mensaje segun transicion
    if estado_nuevo == "approved":
        # Notificar al planificador asignado
        destinatario = solicitud_data.get("planner_id")
        mensaje = f"Solicitud #{solicitud_id} aprobada y asignada para planificacion"

    elif estado_nuevo == "rejected":
        # Notificar al solicitante
        destinatario = solicitud_data.get("id_usuario")
        motivo = f": {razon}" if razon else ""
        mensaje = f"Solicitud #{solicitud_id} rechazada{motivo}"

    elif estado_nuevo == "in_planning":
        # Notificar al solicitante que esta en proceso
        destinatario = solicitud_data.get("id_usuario")
        mensaje = f"Solicitud #{solicitud_id} en proceso de planificacion"

    elif estado_nuevo == "completed":
        # Notificar al solicitante que esta completada
        destinatario = solicitud_data.get("id_usuario")
        mensaje = f"Solicitud #{solicitud_id} completada exitosamente"

    # Crear notificacion si hay destinatario
    if destinatario and mensaje:
        crear_notificacion(cursor, destinatario, solicitud_id, mensaje)


def crear_notificacion(
    cursor, destinatario_id: str, solicitud_id: int, mensaje: str, tipo: str = "info"
) -> None:
    """
    Crea una notificacion para un usuario.

    Args:
        cursor: Cursor de base de datos
        destinatario_id: ID del usuario destinatario
        solicitud_id: ID de la solicitud relacionada
        mensaje: Texto de la notificacion
        tipo: Tipo de notificacion (info, warning, error)
    """
    cursor.execute(
        """
        INSERT INTO notificaciones (destinatario_id, solicitud_id, mensaje, tipo)
        VALUES (?, ?, ?, ?)
        """,
        (destinatario_id, solicitud_id, mensaje, tipo),
    )


# =============================================================================
# Funciones de Conveniencia
# =============================================================================


def es_estado_terminal(estado: EstadoSolicitud | str) -> bool:
    """
    Verifica si un estado es terminal (sin transiciones salientes).

    Args:
        estado: Estado a verificar

    Returns:
        True si es terminal (COMPLETED o CANCELLED)
    """
    if isinstance(estado, str):
        try:
            estado = get_estado_enum(estado)
        except ValueError:
            return False

    return len(TRANSICIONES_VALIDAS.get(estado, [])) == 0


def puede_cancelar(estado: EstadoSolicitud | str) -> bool:
    """
    Verifica si desde un estado se puede cancelar.

    Args:
        estado: Estado actual

    Returns:
        True si se puede cancelar desde ese estado
    """
    return validar_transicion(estado, EstadoSolicitud.CANCELLED)


def puede_rechazar(estado: EstadoSolicitud | str) -> bool:
    """
    Verifica si desde un estado se puede rechazar.

    Args:
        estado: Estado actual

    Returns:
        True si se puede rechazar desde ese estado
    """
    return validar_transicion(estado, EstadoSolicitud.REJECTED)
