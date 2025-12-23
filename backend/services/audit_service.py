"""
Servicio de auditoria centralizado.

Proporciona trazabilidad completa de todas las acciones del sistema
para cumplimiento de compliance y debugging.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from backend.core.db import get_db_connection, get_db_transaction
except ImportError:
    from core.db import get_db_connection, get_db_transaction


# =============================================================================
# Excepciones
# =============================================================================


class AuditoriaError(Exception):
    """Excepcion base para errores de auditoria."""

    pass


class AuditoriaValidationError(AuditoriaError):
    """Error de validacion en datos de auditoria."""

    pass


# =============================================================================
# Funciones de Utilidad
# =============================================================================


def formatear_timestamp() -> str:
    """
    Genera un timestamp en formato ISO 8601 con zona horaria UTC.

    Returns:
        String en formato "2025-12-08T10:30:00Z"
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def serializar_datos(datos: Optional[Dict[str, Any]]) -> Optional[str]:
    """
    Serializa un diccionario a JSON para almacenamiento.

    Args:
        datos: Diccionario a serializar

    Returns:
        String JSON o None si datos es None
    """
    if datos is None:
        return None
    return json.dumps(datos, ensure_ascii=False, default=str)


def serializar_valor(valor: Any) -> Optional[str]:
    """
    Serializa cualquier valor para almacenamiento en audit trail.

    Para valores simples (str, int, float, bool) retorna string directo.
    Para valores complejos (dict, list) retorna JSON.

    Args:
        valor: Valor a serializar

    Returns:
        String serializado o None si valor es None
    """
    if valor is None:
        return None

    # Valores primitivos - convertir directamente
    if isinstance(valor, (str, int, float, bool)):
        return str(valor)

    # Valores complejos - serializar como JSON
    try:
        return json.dumps(valor, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        # Fallback a str si no se puede serializar
        return str(valor)


def validar_entrada_auditoria(entidad: str, entidad_id: str, accion: str, actor_id: str) -> None:
    """
    Valida los campos requeridos para un registro de auditoria.

    Args:
        entidad: Tipo de entidad (solicitud, presupuesto, usuario)
        entidad_id: ID de la entidad
        accion: Accion realizada
        actor_id: ID del usuario que realiza la accion

    Raises:
        AuditoriaValidationError si algun campo es invalido
    """
    if not entidad or not entidad.strip():
        raise AuditoriaValidationError("Campo 'entidad' es requerido")

    if not accion or not accion.strip():
        raise AuditoriaValidationError("Campo 'accion' es requerido")

    if not actor_id or not actor_id.strip():
        raise AuditoriaValidationError("Campo 'actor_id' es requerido")


# =============================================================================
# Funciones Principales
# =============================================================================


def registrar_accion(
    entidad: str,
    entidad_id: str,
    accion: str,
    actor_id: str,
    campo_modificado: Optional[str] = None,
    valor_anterior: Optional[str] = None,
    valor_nuevo: Optional[str] = None,
    actor_rol: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    datos_adicionales: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Registra una accion en el trail de auditoria.

    Args:
        entidad: Tipo de entidad (solicitud, presupuesto, usuario)
        entidad_id: ID de la entidad afectada
        accion: Tipo de accion (crear, aprobar, rechazar, modificar)
        actor_id: ID del usuario que realiza la accion
        campo_modificado: Nombre del campo modificado (opcional)
        valor_anterior: Valor antes del cambio (opcional)
        valor_nuevo: Valor despues del cambio (opcional)
        actor_rol: Rol del usuario (opcional)
        ip_address: Direccion IP del cliente (opcional)
        user_agent: User agent del navegador (opcional)
        datos_adicionales: Datos extra en formato dict (opcional)

    Returns:
        ID del registro de auditoria creado

    Raises:
        AuditoriaValidationError si los datos son invalidos
    """
    validar_entrada_auditoria(entidad, entidad_id, accion, actor_id)

    datos_json = serializar_datos(datos_adicionales)

    with get_db_transaction() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_trail (
                entidad, entidad_id, accion, actor_id,
                campo_modificado, valor_anterior, valor_nuevo,
                actor_rol, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entidad,
                str(entidad_id),
                accion,
                actor_id,
                campo_modificado,
                valor_anterior,
                valor_nuevo,
                actor_rol,
                ip_address,
                user_agent,
            ),
        )
        return cursor.lastrowid


def obtener_auditoria(
    entidad: str,
    entidad_id: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limite: int = 100,
) -> List[Dict[str, Any]]:
    """
    Obtiene el historial de auditoria de una entidad.

    Args:
        entidad: Tipo de entidad
        entidad_id: ID de la entidad
        fecha_desde: Filtrar desde esta fecha (formato ISO)
        fecha_hasta: Filtrar hasta esta fecha (formato ISO)
        limite: Maximo numero de registros a retornar

    Returns:
        Lista de registros de auditoria ordenados cronologicamente
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, entidad, entidad_id, accion, actor_id,
                   campo_modificado, valor_anterior, valor_nuevo,
                   actor_rol, ip_address, user_agent, created_at
            FROM audit_trail
            WHERE entidad = ? AND entidad_id = ?
        """
        params = [entidad, str(entidad_id)]

        if fecha_desde:
            query += " AND created_at >= ?"
            params.append(fecha_desde)

        if fecha_hasta:
            query += " AND created_at <= ?"
            params.append(fecha_hasta)

        query += " ORDER BY created_at ASC LIMIT ?"
        params.append(limite)

        cursor.execute(query, params)
        rows = cursor.fetchall()

    return [dict(row) for row in rows]


def obtener_auditoria_por_actor(
    actor_id: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limite: int = 100,
) -> List[Dict[str, Any]]:
    """
    Obtiene todas las acciones realizadas por un actor.

    Args:
        actor_id: ID del usuario
        fecha_desde: Filtrar desde esta fecha
        fecha_hasta: Filtrar hasta esta fecha
        limite: Maximo numero de registros

    Returns:
        Lista de registros de auditoria
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, entidad, entidad_id, accion, actor_id,
                   campo_modificado, valor_anterior, valor_nuevo,
                   actor_rol, ip_address, user_agent, created_at
            FROM audit_trail
            WHERE actor_id = ?
        """
        params = [actor_id]

        if fecha_desde:
            query += " AND created_at >= ?"
            params.append(fecha_desde)

        if fecha_hasta:
            query += " AND created_at <= ?"
            params.append(fecha_hasta)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limite)

        cursor.execute(query, params)
        rows = cursor.fetchall()

    return [dict(row) for row in rows]


# =============================================================================
# Funciones de Conveniencia para Solicitudes
# =============================================================================


def auditar_creacion_solicitud(
    solicitud_id: int,
    actor_id: str,
    datos_solicitud: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> int:
    """
    Registra la creacion de una solicitud.

    Args:
        solicitud_id: ID de la solicitud creada
        actor_id: ID del usuario que la creo
        datos_solicitud: Datos de la solicitud (centro, sector, etc.)
        ip_address: IP del cliente

    Returns:
        ID del registro de auditoria
    """
    return registrar_accion(
        entidad="solicitud",
        entidad_id=str(solicitud_id),
        accion="crear",
        actor_id=actor_id,
        ip_address=ip_address,
        datos_adicionales=datos_solicitud,
    )


def auditar_aprobacion(
    solicitud_id: int,
    actor_id: str,
    actor_rol: Optional[str] = None,
    comentario: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> int:
    """
    Registra la aprobacion de una solicitud.

    Args:
        solicitud_id: ID de la solicitud aprobada
        actor_id: ID del aprobador
        actor_rol: Rol del aprobador
        comentario: Comentario de aprobacion
        ip_address: IP del cliente

    Returns:
        ID del registro de auditoria
    """
    datos = {"comentario": comentario} if comentario else None

    return registrar_accion(
        entidad="solicitud",
        entidad_id=str(solicitud_id),
        accion="aprobar",
        actor_id=actor_id,
        actor_rol=actor_rol,
        ip_address=ip_address,
        datos_adicionales=datos,
    )


def auditar_rechazo(
    solicitud_id: int,
    actor_id: str,
    motivo: Optional[str] = None,
    actor_rol: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> int:
    """
    Registra el rechazo de una solicitud.

    Args:
        solicitud_id: ID de la solicitud rechazada
        actor_id: ID del que rechaza
        motivo: Motivo del rechazo
        actor_rol: Rol del actor
        ip_address: IP del cliente

    Returns:
        ID del registro de auditoria
    """
    datos = {"motivo": motivo} if motivo else None

    return registrar_accion(
        entidad="solicitud",
        entidad_id=str(solicitud_id),
        accion="rechazar",
        actor_id=actor_id,
        actor_rol=actor_rol,
        ip_address=ip_address,
        datos_adicionales=datos,
    )


def auditar_modificacion(
    entidad: str,
    entidad_id: str,
    actor_id: str,
    campo: str,
    valor_anterior: Any,
    valor_nuevo: Any,
    actor_rol: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> int:
    """
    Registra la modificacion de un campo.

    Args:
        entidad: Tipo de entidad
        entidad_id: ID de la entidad
        actor_id: ID del usuario que modifica
        campo: Nombre del campo modificado
        valor_anterior: Valor antes del cambio
        valor_nuevo: Valor despues del cambio
        actor_rol: Rol del usuario
        ip_address: IP del cliente

    Returns:
        ID del registro de auditoria
    """
    return registrar_accion(
        entidad=entidad,
        entidad_id=str(entidad_id),
        accion="modificar",
        actor_id=actor_id,
        campo_modificado=campo,
        valor_anterior=serializar_valor(valor_anterior),
        valor_nuevo=serializar_valor(valor_nuevo),
        actor_rol=actor_rol,
        ip_address=ip_address,
    )


# =============================================================================
# Funciones de Conveniencia para Presupuestos
# =============================================================================


def auditar_consumo_presupuesto(
    centro: str,
    sector: str,
    monto_cents: int,
    solicitud_id: int,
    actor_id: str,
    ip_address: Optional[str] = None,
) -> int:
    """
    Registra el consumo de presupuesto.

    Args:
        centro: Centro de costo
        sector: Sector
        monto_cents: Monto consumido en centavos
        solicitud_id: ID de la solicitud que consume
        actor_id: ID del actor (puede ser "sistema")
        ip_address: IP del cliente

    Returns:
        ID del registro de auditoria
    """
    return registrar_accion(
        entidad="presupuesto",
        entidad_id=f"{centro}_{sector}",
        accion="consumo",
        actor_id=actor_id,
        ip_address=ip_address,
        datos_adicionales={
            "centro": centro,
            "sector": sector,
            "monto_cents": monto_cents,
            "solicitud_id": solicitud_id,
        },
    )


def auditar_reversion_presupuesto(
    centro: str,
    sector: str,
    monto_cents: int,
    solicitud_id: int,
    motivo: str,
    actor_id: str,
    ip_address: Optional[str] = None,
) -> int:
    """
    Registra la reversion de presupuesto (devolucion).

    Args:
        centro: Centro de costo
        sector: Sector
        monto_cents: Monto revertido en centavos
        solicitud_id: ID de la solicitud relacionada
        motivo: Razon de la reversion
        actor_id: ID del actor
        ip_address: IP del cliente

    Returns:
        ID del registro de auditoria
    """
    return registrar_accion(
        entidad="presupuesto",
        entidad_id=f"{centro}_{sector}",
        accion="reversion",
        actor_id=actor_id,
        ip_address=ip_address,
        datos_adicionales={
            "centro": centro,
            "sector": sector,
            "monto_cents": monto_cents,
            "solicitud_id": solicitud_id,
            "motivo": motivo,
        },
    )


# =============================================================================
# Funciones de Reporte
# =============================================================================


def obtener_resumen_auditoria(fecha_desde: str, fecha_hasta: str) -> Dict[str, Any]:
    """
    Genera un resumen de actividad de auditoria.

    Args:
        fecha_desde: Fecha inicio del reporte
        fecha_hasta: Fecha fin del reporte

    Returns:
        Dict con metricas de auditoria
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Total de acciones
        cursor.execute(
            """
            SELECT COUNT(*) as total,
                   COUNT(DISTINCT actor_id) as actores_unicos,
                   COUNT(DISTINCT entidad_id) as entidades_afectadas
            FROM audit_trail
            WHERE created_at BETWEEN ? AND ?
            """,
            (fecha_desde, fecha_hasta),
        )
        totales = dict(cursor.fetchone())

        # Acciones por tipo
        cursor.execute(
            """
            SELECT accion, COUNT(*) as cantidad
            FROM audit_trail
            WHERE created_at BETWEEN ? AND ?
            GROUP BY accion
            ORDER BY cantidad DESC
            """,
            (fecha_desde, fecha_hasta),
        )
        por_accion = {row["accion"]: row["cantidad"] for row in cursor.fetchall()}

        # Top actores
        cursor.execute(
            """
            SELECT actor_id, COUNT(*) as cantidad
            FROM audit_trail
            WHERE created_at BETWEEN ? AND ?
            GROUP BY actor_id
            ORDER BY cantidad DESC
            LIMIT 10
            """,
            (fecha_desde, fecha_hasta),
        )
        top_actores = [dict(row) for row in cursor.fetchall()]

    return {
        "periodo": {"desde": fecha_desde, "hasta": fecha_hasta},
        "totales": totales,
        "por_accion": por_accion,
        "top_actores": top_actores,
    }
