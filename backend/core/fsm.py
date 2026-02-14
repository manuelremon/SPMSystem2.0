"""
Maquina de Estados Finitos (FSM) para solicitudes.

Este modulo centraliza la gestion de estados de solicitudes,
garantizando transiciones validas y registrando historial completo.

Diseñado para backward compatibility con estados legacy.
"""

import json
import logging
from enum import Enum
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction
from backend.services.push_service import send_push_notification
from backend.services.sla_service import resolver_alertas_solicitud

logger = logging.getLogger(__name__)


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
    # NOTA: Removida transición a REJECTED - una solicitud aprobada no puede ser rechazada
    # por el planificador (el presupuesto ya fue consumido). Solo puede avanzar a IN_TREATMENT.
    EstadoSolicitud.IN_PLANNING: [EstadoSolicitud.IN_TREATMENT],
    EstadoSolicitud.IN_TREATMENT: [
        EstadoSolicitud.TREATED,
        EstadoSolicitud.IN_PLANNING,  # Permite volver atrás (máx 3 veces, validado en cambiar_estado)
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
# NOTA: Algunos estados legacy son ambiguos:
# - "Pendiente" -> submitted (podría ser in_planning en algunos contextos)
# - "En Progreso" -> in_planning (algunas veces se usaba para in_treatment)
# Se recomienda usar estados internos (snake_case) para evitar ambigüedad.
ESTADO_LEGACY_A_NUEVO: Dict[str, str] = {
    # Formato capitalizado (legacy) - estados claros
    "Borrador": "draft",
    "Enviada": "submitted",
    "Aprobada": "approved",
    "Rechazada": "rejected",
    "En tratamiento": "in_treatment",
    "En Tratamiento": "in_treatment",
    "Tratado": "treated",
    "Tratada": "treated",
    "Finalizada": "completed",
    "Completada": "completed",
    "Cancelada": "cancelled",
    # Estados ambiguos - documentados explícitamente
    "En Progreso": "in_planning",  # AMBIGUO: a veces significaba in_treatment
    "En progreso": "in_planning",  # AMBIGUO: ver arriba
    "Pendiente": "submitted",  # AMBIGUO: podría ser in_planning si ya fue aprobada
    "pendiente": "submitted",  # AMBIGUO: ver arriba
    # Formatos internos (passthrough)
    "submitted": "submitted",
    "approved": "approved",
    "rejected": "rejected",
    "processing": "in_planning",  # LEGACY: ya no se usa
}

# Estados considerados ambiguos (para logging)
ESTADOS_AMBIGUOS = {"En Progreso", "En progreso", "Pendiente", "pendiente", "processing"}

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

    estado_stripped = estado.strip()

    # Si ya esta en formato nuevo (enum), retornar
    if estado_stripped in [e.value for e in EstadoSolicitud]:
        return estado_stripped

    # Advertir sobre estados ambiguos
    if estado_stripped in ESTADOS_AMBIGUOS:
        logger.warning(
            f"[FSM] Estado ambiguo '{estado_stripped}' normalizado a '{ESTADO_LEGACY_A_NUEVO.get(estado_stripped)}'. "
            f"Se recomienda usar estados internos (snake_case) para evitar ambigüedad."
        )

    # Buscar en mapeo legacy (exact match primero)
    if estado_stripped in ESTADO_LEGACY_A_NUEVO:
        return ESTADO_LEGACY_A_NUEVO[estado_stripped]

    # FIX: Buscar case-insensitive para estados display comunes
    # Esto evita que "enviada" (minúsculas) no se mapee a "submitted"
    MAPEO_CASE_INSENSITIVE = {
        "borrador": "draft",
        "enviada": "submitted",
        "en aprobación": "submitted",
        "en aprobacion": "submitted",
        "aprobada": "approved",
        "rechazada": "rejected",
        "en progreso": "processing",
        "en tratamiento": "in_treatment",
        "tratado": "treated",
        "tratada": "treated",
        "finalizada": "completed",
        "completada": "completed",
        "cancelada": "cancelled",
        "pendiente": "submitted",
    }

    estado_lower = estado_stripped.lower()
    if estado_lower in MAPEO_CASE_INSENSITIVE:
        return MAPEO_CASE_INSENSITIVE[estado_lower]

    # Si no se encuentra, retornar el estado como está (puede ser un estado nuevo desconocido)
    logger.warning(f"[FSM] Estado desconocido '{estado}', retornando sin normalizar")
    return estado_stripped


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
            "SELECT id, status, id_usuario, aprobador_id, planner_id FROM solicitud WHERE id = ?",
            (solicitud_id,),
        )
        solicitud = cursor.fetchone()

        if solicitud is None:
            raise SolicitudNoEncontradaError(solicitud_id)

        estado_actual = normalizar_estado(solicitud["status"])

        # 2. Validar transicion
        if not validar_transicion(estado_actual, nuevo_estado_str):
            raise TransicionInvalidaError(estado_actual, nuevo_estado_str)

        # 2.5 Validar límite de retrocesos IN_TREATMENT -> IN_PLANNING (máx 3)
        if estado_actual == "in_treatment" and nuevo_estado_str == "in_planning":
            cursor.execute(
                """
                SELECT COUNT(*) as retrocesos FROM solicitud_historial_estado
                WHERE solicitud_id = ? AND estado_anterior = 'in_treatment' AND estado_nuevo = 'in_planning'
                """,
                (solicitud_id,),
            )
            row = cursor.fetchone()
            retrocesos = row["retrocesos"] if row else 0
            if retrocesos >= 3:
                raise TransicionInvalidaError(
                    estado_actual,
                    nuevo_estado_str + " (límite de 3 retrocesos alcanzado)",
                )

        # 2.6 Validar límite de reenvíos REJECTED -> DRAFT (máx 2)
        # Evita ciclos infinitos de rechazo-reenvío
        if estado_actual == "rejected" and nuevo_estado_str == "draft":
            cursor.execute(
                """
                SELECT COUNT(*) as reenvios FROM solicitud_historial_estado
                WHERE solicitud_id = ? AND estado_anterior = 'rejected' AND estado_nuevo = 'draft'
                """,
                (solicitud_id,),
            )
            row = cursor.fetchone()
            reenvios = row["reenvios"] if row else 0
            if reenvios >= 2:
                raise TransicionInvalidaError(
                    estado_actual,
                    nuevo_estado_str + " (límite de 2 reenvíos alcanzado - solicitud debe ser cancelada)",
                )

        # 3. Actualizar estado de solicitud
        cursor.execute(
            "UPDATE solicitud SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (nuevo_estado_str, solicitud_id),
        )

        # 4. Registrar en historial
        metadata_json = json.dumps(metadata) if metadata else None
        cursor.execute(
            """
            INSERT INTO solicitud_historial_estado
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

    # 6. FIX: Auto-resolver alertas SLA cuando la solicitud llega a estados finales
    # Esto evita que las alertas queden activas indefinidamente
    ESTADOS_FINALES_SLA = {"completed", "cancelled", "treated", "rejected"}
    if nuevo_estado_str in ESTADOS_FINALES_SLA:
        try:
            if resolver_alertas_solicitud:
                resolver_alertas_solicitud(
                    solicitud_id=solicitud_id,
                    resuelto_por="sistema_fsm",
                )
                logger.debug(
                    f"[FSM] Alertas SLA auto-resueltas para solicitud {solicitud_id} "
                    f"(estado: {nuevo_estado_str})"
                )
        except Exception as e:
            # SLA es informativo, no debe bloquear el flujo principal
            logger.warning(f"[FSM] Error auto-resolviendo alertas SLA: {e}")

    # 7. Emitir evento WebSocket para tiempo real
    _emitir_evento_ws(
        solicitud_id=solicitud_id,
        estado_anterior=estado_actual,
        estado_nuevo=nuevo_estado_str,
        actor_id=actor_id,
        solicitud_data=dict(solicitud) if solicitud else {},
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
            FROM solicitud_historial_estado
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
        cursor.execute("SELECT status FROM solicitud WHERE id = ?", (solicitud_id,))
        row = cursor.fetchone()

    if row is None:
        return None

    return normalizar_estado(row["status"])


# =============================================================================
# WebSocket Events (Tiempo Real)
# =============================================================================


def _emitir_evento_ws(
    solicitud_id: int,
    estado_anterior: str,
    estado_nuevo: str,
    actor_id: str,
    solicitud_data: Dict[str, Any],
) -> None:
    """
    Emite eventos WebSocket para actualizaciones en tiempo real.

    Los eventos se emiten de forma no-bloqueante. Si WebSocket no esta
    disponible, se ignora silenciosamente.
    """
    try:
        from backend.core.websocket import get_ws_manager

        manager = get_ws_manager()
        if manager is None:
            return

        event_data = {
            "solicitud_id": solicitud_id,
            "estado_anterior": estado_anterior,
            "estado_nuevo": estado_nuevo,
            "actor_id": actor_id,
        }

        # Publicar al EventBus para que los handlers registrados lo procesen
        event_map = {
            "submitted": "solicitud_created",
            "approved": "solicitud_approved",
            "rejected": "solicitud_rejected",
        }

        event_name = event_map.get(estado_nuevo, "solicitud_updated")
        manager.event_bus.publish(event_name, event_data)

        # Notificar al dueño de la solicitud
        user_id = solicitud_data.get("id_usuario")
        if user_id and str(user_id) != str(actor_id):
            manager.send_to_user(
                int(user_id),
                "solicitud_estado_cambio",
                event_data,
            )

        logger.debug(
            f"[FSM] Evento WS emitido: {event_name} para solicitud {solicitud_id}"
        )

    except Exception as e:
        logger.debug(f"[FSM] WebSocket no disponible, evento no emitido: {e}")


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

    # Determinar destinatario, mensaje y tipo segun transicion
    tipo = "info"

    if estado_nuevo == "submitted":
        # Notificar al aprobador asignado
        destinatario = solicitud_data.get("aprobador_id")
        mensaje = f"Nueva solicitud #{solicitud_id} pendiente de aprobación"
        tipo = "solicitud_submitted"

    elif estado_nuevo == "approved":
        # Notificar al planificador asignado
        destinatario = solicitud_data.get("planner_id")
        mensaje = f"Solicitud #{solicitud_id} aprobada y asignada para planificacion"
        tipo = "solicitud_approved"

    elif estado_nuevo == "rejected":
        # Notificar al solicitante
        destinatario = solicitud_data.get("id_usuario")
        motivo = f": {razon}" if razon else ""
        mensaje = f"Solicitud #{solicitud_id} rechazada{motivo}"
        tipo = "solicitud_rejected"

    elif estado_nuevo == "in_planning":
        # Notificar al solicitante que esta en proceso
        destinatario = solicitud_data.get("id_usuario")
        mensaje = f"Solicitud #{solicitud_id} en proceso de planificacion"
        tipo = "solicitud_planned"

    elif estado_nuevo == "completed":
        # Notificar al solicitante que esta completada
        destinatario = solicitud_data.get("id_usuario")
        mensaje = f"Solicitud #{solicitud_id} completada exitosamente"
        tipo = "solicitud_dispatched"

    # Crear notificacion si hay destinatario
    if destinatario and mensaje:
        crear_notificacion(cursor, destinatario, solicitud_id, mensaje, tipo)


def _get_usuario_preferencia_notificacion(user_id: str) -> dict:
    """
    Obtiene las preferencias de notificación del usuario.

    Returns:
        Dict con preferencias (todo True si no hay registro)
    """
    defaults = {"push_enabled": True, "notif_solicitudes": True, "notif_aprobaciones": True}

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT push_enabled, notif_solicitudes, notif_aprobaciones
                   FROM usuario_preferencia_notificacion
                   WHERE user_id = ?""",
                (str(user_id),),
            )
            row = cursor.fetchone()

        if row:
            if hasattr(row, "keys"):
                return {k: bool(v) for k, v in dict(row).items()}
            else:
                return {
                    "push_enabled": bool(row[0]),
                    "notif_solicitudes": bool(row[1]),
                    "notif_aprobaciones": bool(row[2]),
                }
    except Exception as e:
        logger.warning(f"[FSM] Error getting user preferences for {user_id}: {e}")

    return defaults


# Mapeo de tipo de notificación a preferencia del usuario
TIPO_TO_PREFERENCE = {
    "solicitud_submitted": "notif_solicitudes",
    "solicitud_approved": "notif_aprobaciones",
    "solicitud_rejected": "notif_aprobaciones",
    "solicitud_planned": "notif_solicitudes",
    "solicitud_dispatched": "notif_solicitudes",
}


def crear_notificacion(
    cursor, destinatario_id: str, solicitud_id: int, mensaje: str, tipo: str = "info"
) -> None:
    """
    Crea una notificacion para un usuario y envia Web Push.

    Respeta las preferencias del usuario para notificaciones.

    Args:
        cursor: Cursor de base de datos
        destinatario_id: ID del usuario destinatario
        solicitud_id: ID de la solicitud relacionada
        mensaje: Texto de la notificacion
        tipo: Tipo de notificacion (info, warning, error)
    """
    # Verificar preferencias del usuario
    prefs = _get_usuario_preferencia_notificacion(destinatario_id)

    # Verificar si el usuario desea este tipo de notificación
    pref_key = TIPO_TO_PREFERENCE.get(tipo)
    if pref_key and not prefs.get(pref_key, True):
        logger.debug(f"[FSM] Notificación tipo {tipo} omitida por preferencias de usuario {destinatario_id}")
        return

    # Crear notificacion en BD
    cursor.execute(
        """
        INSERT INTO notificacion (destinatario_id, solicitud_id, mensaje, tipo)
        VALUES (?, ?, ?, ?)
        """,
        (destinatario_id, solicitud_id, mensaje, tipo),
    )

    # Verificar si push está habilitado
    if not prefs.get("push_enabled", True):
        logger.debug(f"[FSM] Push deshabilitado para usuario {destinatario_id}")
        return

    # Enviar Web Push (no bloquea si falla)
    try:
        # Mapeo de tipo a titulo de push
        PUSH_TITLES = {
            "info": "SPM - Información",
            "success": "SPM - Éxito",
            "warning": "SPM - Atención",
            "error": "SPM - Error",
            "solicitud_submitted": "Nueva Solicitud",
            "solicitud_approved": "Solicitud Aprobada",
            "solicitud_rejected": "Solicitud Rechazada",
            "solicitud_planned": "Solicitud Planificada",
            "solicitud_dispatched": "Solicitud Completada",
        }
        title = PUSH_TITLES.get(tipo, "SPM - Notificación")
        url = f"/solicitudes/{solicitud_id}" if solicitud_id else "/notificaciones"

        send_push_notification(
            user_id=destinatario_id,
            title=title,
            body=mensaje,
            tipo=tipo,  # Para selección de icono en Service Worker
            url=url,
            tag=f"solicitud-{solicitud_id}" if solicitud_id else None,
        )
    except Exception as e:
        # No fallar si push falla - la notificacion in-app ya se creo
        logger.warning(f"[FSM] Error enviando Web Push a {destinatario_id}: {e}")


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
