"""
Servicio de SLA (Service Level Agreement).

Sprint 4.3 - Implementacion basada en TDD tests.

Gestiona:
- Configuracion de tiempos objetivo por criticidad/estado
- Calculo de fechas limite
- Deteccion de alertas y breaches
- Metricas de cumplimiento
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction

# =============================================================================
# Configuracion SLA
# =============================================================================


def obtener_configuracion_sla(
    criticidad: str, estado_desde: str, estado_hasta: str
) -> Optional[Dict[str, Any]]:
    """
    Obtiene la configuracion SLA aplicable para una transicion de estado.

    Primero busca una configuracion especifica para la criticidad,
    luego busca una configuracion general (criticidad = NULL).

    Args:
        criticidad: Nivel de criticidad (Baja, Normal, Alta, Urgente)
        estado_desde: Estado inicial de la transicion
        estado_hasta: Estado destino de la transicion

    Returns:
        Dict con configuracion SLA o None si no existe
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Buscar configuracion especifica para criticidad
        cursor.execute(
            """
            SELECT id, nombre, criticidad, estado_desde, estado_hasta,
                   tiempo_objetivo_horas, tiempo_alerta_horas,
                   activo, notificar_al_vencer, escalar_al_vencer, escalar_a_rol
            FROM sla_configuracion
            WHERE criticidad = ?
              AND estado_desde = ?
              AND estado_hasta = ?
              AND activo = 1
            LIMIT 1
        """,
            (criticidad, estado_desde, estado_hasta),
        )

        row = cursor.fetchone()
        if row:
            return dict(row)

        # Buscar configuracion general (sin criticidad especifica)
        cursor.execute(
            """
            SELECT id, nombre, criticidad, estado_desde, estado_hasta,
                   tiempo_objetivo_horas, tiempo_alerta_horas,
                   activo, notificar_al_vencer, escalar_al_vencer, escalar_a_rol
            FROM sla_configuracion
            WHERE criticidad IS NULL
              AND estado_desde = ?
              AND estado_hasta = ?
              AND activo = 1
            LIMIT 1
        """,
            (estado_desde, estado_hasta),
        )

        row = cursor.fetchone()
        return dict(row) if row else None


# =============================================================================
# Calculo de Fechas
# =============================================================================


def calcular_fecha_limite(
    fecha_inicio: datetime, horas: float, solo_horas_laborales: bool = False
) -> datetime:
    """
    Calcula la fecha limite agregando horas a la fecha de inicio.

    Args:
        fecha_inicio: Fecha y hora de inicio
        horas: Horas a agregar (puede ser fraccionario)
        solo_horas_laborales: Si True, solo cuenta horas laborales (9-18)

    Returns:
        datetime con la fecha limite calculada
    """
    if not solo_horas_laborales:
        # Calculo simple: agregar horas directamente
        return fecha_inicio + timedelta(hours=horas)

    # Calculo con horas laborales (9:00 - 18:00, L-V)
    # Por simplicidad inicial, implementamos version basica
    # TODO: Implementar logica completa de horas laborales
    return fecha_inicio + timedelta(hours=horas)


def calcular_tiempo_respuesta(fecha_inicio: datetime, fecha_fin: datetime) -> float:
    """
    Calcula el tiempo de respuesta en horas entre dos fechas.

    Args:
        fecha_inicio: Fecha y hora de inicio
        fecha_fin: Fecha y hora de fin

    Returns:
        Horas transcurridas (puede ser fraccionario)
    """
    delta = fecha_fin - fecha_inicio
    return round(delta.total_seconds() / 3600, 2)


# =============================================================================
# Verificacion de Estado SLA
# =============================================================================


def verificar_estado_sla(
    fecha_limite: datetime, ahora: datetime, umbral_alerta_horas: Optional[float] = None
) -> Dict[str, Any]:
    """
    Verifica el estado de cumplimiento SLA.

    Args:
        fecha_limite: Fecha limite del SLA
        ahora: Fecha actual para comparar
        umbral_alerta_horas: Horas antes del vencimiento para warning

    Returns:
        Dict con:
        - estado: 'on_time', 'warning', 'breach'
        - horas_restantes: Horas hasta/desde el vencimiento
        - horas_excedidas: Horas excedidas (solo si breach)
    """
    delta = fecha_limite - ahora
    horas_restantes = round(delta.total_seconds() / 3600, 2)

    if horas_restantes < 0:
        # Ya vencio - breach
        return {
            "estado": "breach",
            "horas_restantes": horas_restantes,
            "horas_excedidas": abs(horas_restantes),
        }

    if umbral_alerta_horas and horas_restantes <= umbral_alerta_horas:
        # Cerca de vencer - warning
        return {"estado": "warning", "horas_restantes": horas_restantes}

    # A tiempo
    return {"estado": "on_time", "horas_restantes": horas_restantes}


# =============================================================================
# Alertas SLA
# =============================================================================


def registrar_alerta_sla(
    solicitud_id: int,
    sla_config_id: int,
    tipo: str,
    fecha_inicio: str,
    fecha_vencimiento: str,
    tiempo_transcurrido_horas: Optional[float] = None,
    tiempo_objetivo_horas: Optional[int] = None,
    mensaje: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Registra una nueva alerta de SLA.

    Args:
        solicitud_id: ID de la solicitud
        sla_config_id: ID de la configuracion SLA
        tipo: Tipo de alerta ('warning', 'breach', 'escalated')
        fecha_inicio: Fecha inicio del contador SLA
        fecha_vencimiento: Fecha de vencimiento
        tiempo_transcurrido_horas: Horas transcurridas
        tiempo_objetivo_horas: Horas objetivo del SLA
        mensaje: Mensaje descriptivo opcional

    Returns:
        Dict con id de la alerta creada
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Calcular porcentaje de cumplimiento si tenemos los datos
        porcentaje = None
        if tiempo_transcurrido_horas and tiempo_objetivo_horas:
            porcentaje = round((tiempo_transcurrido_horas / tiempo_objetivo_horas) * 100, 2)

        cursor.execute(
            """
            INSERT INTO sla_alertas (
                solicitud_id, sla_config_id, tipo, estado,
                fecha_inicio, fecha_vencimiento,
                tiempo_transcurrido_horas, tiempo_objetivo_horas,
                porcentaje_cumplimiento, mensaje
            ) VALUES (?, ?, ?, 'activa', ?, ?, ?, ?, ?, ?)
        """,
            (
                solicitud_id,
                sla_config_id,
                tipo,
                fecha_inicio,
                fecha_vencimiento,
                tiempo_transcurrido_horas,
                tiempo_objetivo_horas,
                porcentaje,
                mensaje,
            ),
        )

        return {"id": cursor.lastrowid}


def resolver_alerta_sla(alerta_id: int, resuelto_por: str) -> Dict[str, Any]:
    """
    Marca una alerta como resuelta.

    Args:
        alerta_id: ID de la alerta a resolver
        resuelto_por: ID del usuario que resuelve

    Returns:
        Dict con resultado de la operacion
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE sla_alertas
            SET estado = 'resuelta',
                fecha_resolucion = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                resuelto_por = ?
            WHERE id = ?
              AND estado = 'activa'
        """,
            (resuelto_por, alerta_id),
        )

        return {"resuelto": cursor.rowcount > 0}


def resolver_alertas_solicitud(solicitud_id: int, resuelto_por: str) -> Dict[str, Any]:
    """
    Resuelve todas las alertas activas de una solicitud.

    Args:
        solicitud_id: ID de la solicitud
        resuelto_por: ID del usuario que resuelve

    Returns:
        Dict con cantidad de alertas resueltas
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE sla_alertas
            SET estado = 'resuelta',
                fecha_resolucion = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                resuelto_por = ?
            WHERE solicitud_id = ?
              AND estado = 'activa'
        """,
            (resuelto_por, solicitud_id),
        )

        return {"alertas_resueltas": cursor.rowcount}


def obtener_alertas_activas(
    solicitud_id: Optional[int] = None, tipo: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Obtiene las alertas activas.

    Args:
        solicitud_id: Filtrar por solicitud (opcional)
        tipo: Filtrar por tipo (opcional)

    Returns:
        Lista de alertas activas
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, solicitud_id, sla_config_id, tipo, estado,
                   fecha_inicio, fecha_vencimiento, fecha_resolucion,
                   tiempo_transcurrido_horas, tiempo_objetivo_horas,
                   porcentaje_cumplimiento, mensaje,
                   escalado, escalado_a, fecha_escalamiento
            FROM sla_alertas
            WHERE estado = 'activa'
        """
        params = []

        if solicitud_id:
            query += " AND solicitud_id = ?"
            params.append(solicitud_id)

        if tipo:
            query += " AND tipo = ?"
            params.append(tipo)

        query += " ORDER BY fecha_vencimiento ASC"

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


# =============================================================================
# Metricas SLA
# =============================================================================


def obtener_metricas_sla(periodo_dias: int = 30, por_criticidad: bool = False) -> Dict[str, Any]:
    """
    Calcula metricas de cumplimiento SLA.

    Args:
        periodo_dias: Dias hacia atras para calcular metricas
        por_criticidad: Si True, incluye desglose por criticidad

    Returns:
        Dict con metricas de SLA
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        fecha_inicio = datetime.now(timezone.utc) - timedelta(days=periodo_dias)
        fecha_str = fecha_inicio.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Total de solicitudes en el periodo
        cursor.execute(
            """
            SELECT COUNT(*) as total
            FROM solicitudes
            WHERE created_at >= ?
        """,
            (fecha_str,),
        )
        total_row = cursor.fetchone()
        total = total_row["total"] if total_row else 0

        # Solicitudes a tiempo (solo contamos explícitamente on_time, NO NULL)
        cursor.execute(
            """
            SELECT COUNT(*) as on_time
            FROM solicitudes
            WHERE created_at >= ?
              AND sla_estado = 'on_time'
        """,
            (fecha_str,),
        )
        on_time_row = cursor.fetchone()
        on_time = on_time_row["on_time"] if on_time_row else 0

        # Solicitudes con warning
        cursor.execute(
            """
            SELECT COUNT(*) as warning
            FROM solicitudes
            WHERE created_at >= ?
              AND sla_estado = 'warning'
        """,
            (fecha_str,),
        )
        warning_row = cursor.fetchone()
        warning = warning_row["warning"] if warning_row else 0

        # Solicitudes en breach
        cursor.execute(
            """
            SELECT COUNT(*) as breach
            FROM solicitudes
            WHERE created_at >= ?
              AND sla_estado = 'breach'
        """,
            (fecha_str,),
        )
        breach_row = cursor.fetchone()
        breach = breach_row["breach"] if breach_row else 0

        # Solicitudes sin SLA calculado (NULL)
        cursor.execute(
            """
            SELECT COUNT(*) as sin_sla
            FROM solicitudes
            WHERE created_at >= ?
              AND sla_estado IS NULL
        """,
            (fecha_str,),
        )
        sin_sla_row = cursor.fetchone()
        sin_sla = sin_sla_row["sin_sla"] if sin_sla_row else 0

        # Calcular % cumplimiento solo sobre solicitudes con SLA calculado
        solicitudes_con_sla = on_time + warning + breach
        resultado = {
            "total_solicitudes": total,
            "on_time": on_time,
            "warning": warning,
            "breach": breach,
            "sin_sla": sin_sla,
            "porcentaje_cumplimiento": (
                round((on_time / solicitudes_con_sla) * 100, 1) if solicitudes_con_sla > 0 else 0
            ),
        }

        # Desglose por criticidad si se solicita
        if por_criticidad:
            cursor.execute(
                """
                SELECT
                    criticidad,
                    COUNT(*) as total,
                    SUM(CASE WHEN sla_estado = 'on_time' THEN 1 ELSE 0 END) as on_time,
                    SUM(CASE WHEN sla_estado = 'warning' THEN 1 ELSE 0 END) as warning,
                    SUM(CASE WHEN sla_estado = 'breach' THEN 1 ELSE 0 END) as breach,
                    SUM(CASE WHEN sla_estado IS NULL THEN 1 ELSE 0 END) as sin_sla
                FROM solicitudes
                WHERE created_at >= ?
                GROUP BY criticidad
            """,
                (fecha_str,),
            )
            resultado["por_criticidad"] = [dict(row) for row in cursor.fetchall()]

        return resultado


# =============================================================================
# Actualizar SLA de Solicitud
# =============================================================================


def actualizar_sla_solicitud(
    solicitud_id: int, fecha_limite: str, estado_sla: str
) -> Dict[str, Any]:
    """
    Actualiza la informacion SLA de una solicitud.

    Args:
        solicitud_id: ID de la solicitud
        fecha_limite: Nueva fecha limite
        estado_sla: Nuevo estado SLA ('on_time', 'warning', 'breach')

    Returns:
        Dict con resultado de la operacion
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE solicitudes
            SET sla_fecha_limite = ?,
                sla_estado = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
        """,
            (fecha_limite, estado_sla, solicitud_id),
        )

        return {"actualizado": cursor.rowcount > 0}


# =============================================================================
# CRUD Configuracion SLA
# =============================================================================


def listar_configuraciones_sla(activo: Optional[bool] = None) -> List[Dict[str, Any]]:
    """
    Lista todas las configuraciones SLA.

    Args:
        activo: Filtrar por estado activo (opcional)

    Returns:
        Lista de configuraciones SLA
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, nombre, descripcion, criticidad,
                   estado_desde, estado_hasta,
                   tiempo_objetivo_horas, tiempo_alerta_horas,
                   activo, notificar_al_vencer, escalar_al_vencer, escalar_a_rol,
                   created_at, updated_at, created_by
            FROM sla_configuracion
        """
        params = []

        if activo is not None:
            query += " WHERE activo = ?"
            params.append(1 if activo else 0)

        query += " ORDER BY estado_desde, criticidad"

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def crear_configuracion_sla(
    nombre: str,
    estado_desde: str,
    estado_hasta: str,
    tiempo_objetivo_horas: int,
    criticidad: Optional[str] = None,
    descripcion: Optional[str] = None,
    tiempo_alerta_horas: Optional[int] = None,
    notificar_al_vencer: bool = True,
    escalar_al_vencer: bool = False,
    escalar_a_rol: Optional[str] = None,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Crea una nueva configuracion SLA.

    Args:
        nombre: Nombre descriptivo
        estado_desde: Estado inicial
        estado_hasta: Estado destino
        tiempo_objetivo_horas: Tiempo objetivo en horas
        criticidad: Criticidad aplicable (opcional = todas)
        descripcion: Descripcion detallada
        tiempo_alerta_horas: Horas antes para alertar
        notificar_al_vencer: Enviar notificacion al vencer
        escalar_al_vencer: Escalar al vencer
        escalar_a_rol: Rol al que escalar
        created_by: Usuario que crea

    Returns:
        Dict con id de la configuracion creada
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO sla_configuracion (
                nombre, descripcion, criticidad,
                estado_desde, estado_hasta,
                tiempo_objetivo_horas, tiempo_alerta_horas,
                notificar_al_vencer, escalar_al_vencer, escalar_a_rol,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                nombre,
                descripcion,
                criticidad,
                estado_desde,
                estado_hasta,
                tiempo_objetivo_horas,
                tiempo_alerta_horas,
                1 if notificar_al_vencer else 0,
                1 if escalar_al_vencer else 0,
                escalar_a_rol,
                created_by,
            ),
        )

        return {"id": cursor.lastrowid}


def actualizar_configuracion_sla(config_id: int, **campos) -> Dict[str, Any]:
    """
    Actualiza una configuracion SLA existente.

    Args:
        config_id: ID de la configuracion
        **campos: Campos a actualizar

    Returns:
        Dict con resultado de la operacion
    """
    if not campos:
        return {"actualizado": False, "mensaje": "No hay campos para actualizar"}

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Construir query dinamica
        set_clauses = []
        params = []

        campos_permitidos = {
            "nombre",
            "descripcion",
            "criticidad",
            "estado_desde",
            "estado_hasta",
            "tiempo_objetivo_horas",
            "tiempo_alerta_horas",
            "activo",
            "notificar_al_vencer",
            "escalar_al_vencer",
            "escalar_a_rol",
        }

        for campo, valor in campos.items():
            if campo in campos_permitidos:
                set_clauses.append(f"{campo} = ?")
                params.append(valor)

        if not set_clauses:
            return {"actualizado": False, "mensaje": "No hay campos validos para actualizar"}

        # Agregar updated_at
        set_clauses.append("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")

        query = f"""
            UPDATE sla_configuracion
            SET {", ".join(set_clauses)}
            WHERE id = ?
        """
        params.append(config_id)

        cursor.execute(query, params)
        return {"actualizado": cursor.rowcount > 0}


def eliminar_configuracion_sla(config_id: int) -> Dict[str, Any]:
    """
    Elimina (desactiva) una configuracion SLA.

    Args:
        config_id: ID de la configuracion

    Returns:
        Dict con resultado de la operacion
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Soft delete - solo desactivar
        cursor.execute(
            """
            UPDATE sla_configuracion
            SET activo = 0,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
        """,
            (config_id,),
        )

        return {"eliminado": cursor.rowcount > 0}
