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

from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id

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
              AND activo = TRUE
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
              AND activo = TRUE
            LIMIT 1
        """,
            (estado_desde, estado_hasta),
        )

        row = cursor.fetchone()
        return dict(row) if row else None


# =============================================================================
# Configuracion de Horas Laborales
# =============================================================================

# Horario laboral: 9:00 - 18:00 (9 horas por día)
HORA_INICIO_LABORAL = 9
HORA_FIN_LABORAL = 18
HORAS_POR_DIA = HORA_FIN_LABORAL - HORA_INICIO_LABORAL  # 9 horas

# Días laborales: Lunes (0) a Viernes (4)
DIAS_LABORALES = {0, 1, 2, 3, 4}  # Monday = 0, Friday = 4


def es_hora_laboral(dt: datetime) -> bool:
    """Verifica si un datetime está dentro del horario laboral."""
    return (
        dt.weekday() in DIAS_LABORALES and
        HORA_INICIO_LABORAL <= dt.hour < HORA_FIN_LABORAL
    )


def es_dia_laboral(dt: datetime) -> bool:
    """Verifica si un datetime es un día laboral (L-V)."""
    return dt.weekday() in DIAS_LABORALES


def siguiente_hora_laboral(dt: datetime) -> datetime:
    """
    Retorna el siguiente momento laboral válido.
    Si ya es hora laboral, retorna el mismo datetime.
    """
    # Si es fin de semana, avanzar al lunes
    while dt.weekday() not in DIAS_LABORALES:
        dt = dt.replace(hour=HORA_INICIO_LABORAL, minute=0, second=0, microsecond=0)
        dt += timedelta(days=1)

    # Si es antes del horario laboral, avanzar a las 9:00
    if dt.hour < HORA_INICIO_LABORAL:
        return dt.replace(hour=HORA_INICIO_LABORAL, minute=0, second=0, microsecond=0)

    # Si es después del horario laboral, avanzar al siguiente día laboral
    if dt.hour >= HORA_FIN_LABORAL:
        dt = dt.replace(hour=HORA_INICIO_LABORAL, minute=0, second=0, microsecond=0)
        dt += timedelta(days=1)
        # Saltar fin de semana si es necesario
        while dt.weekday() not in DIAS_LABORALES:
            dt += timedelta(days=1)
        return dt

    return dt


# =============================================================================
# Calculo de Fechas
# =============================================================================


def calcular_horas_laborales(inicio: datetime, fin: datetime) -> float:
    """
    Calcula las horas laborales entre dos fechas.

    Solo cuenta horas dentro del horario laboral (9:00-18:00, L-V).

    Args:
        inicio: Fecha y hora de inicio
        fin: Fecha y hora de fin

    Returns:
        Número de horas laborales transcurridas
    """
    if fin <= inicio:
        return 0.0

    horas = 0.0
    current = siguiente_hora_laboral(inicio)

    while current < fin:
        if es_hora_laboral(current):
            # Calcular cuánto queda de hora laboral en este momento
            fin_hora = current.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

            # No exceder el fin del día laboral
            fin_dia = current.replace(hour=HORA_FIN_LABORAL, minute=0, second=0, microsecond=0)
            fin_hora = min(fin_hora, fin_dia)

            # No exceder el fin del período
            fin_hora = min(fin_hora, fin)

            # Calcular fracción de hora
            if fin_hora > current:
                delta = fin_hora - current
                horas += delta.total_seconds() / 3600

            current = fin_hora
        else:
            # Avanzar a la siguiente hora laboral
            current = siguiente_hora_laboral(current)

    return round(horas, 2)


def calcular_fecha_limite(
    fecha_inicio: datetime, horas: float, solo_horas_laborales: bool = False
) -> datetime:
    """
    Calcula la fecha limite agregando horas a la fecha de inicio.

    Args:
        fecha_inicio: Fecha y hora de inicio
        horas: Horas a agregar (puede ser fraccionario)
        solo_horas_laborales: Si True, solo cuenta horas laborales (9-18, L-V)

    Returns:
        datetime con la fecha limite calculada
    """
    if not solo_horas_laborales:
        # Calculo simple: agregar horas directamente
        return fecha_inicio + timedelta(hours=horas)

    # Calculo con horas laborales (9:00 - 18:00, L-V)
    horas_restantes = horas
    current = siguiente_hora_laboral(fecha_inicio)

    while horas_restantes > 0:
        if not es_hora_laboral(current):
            current = siguiente_hora_laboral(current)
            continue

        # Calcular horas disponibles hasta el fin del día laboral
        fin_dia = current.replace(hour=HORA_FIN_LABORAL, minute=0, second=0, microsecond=0)
        horas_hasta_fin = (fin_dia - current).total_seconds() / 3600

        if horas_restantes <= horas_hasta_fin:
            # Alcanza para terminar hoy
            return current + timedelta(hours=horas_restantes)
        else:
            # No alcanza, consumir el resto del día y pasar al siguiente
            horas_restantes -= horas_hasta_fin
            current = fin_dia + timedelta(seconds=1)
            current = siguiente_hora_laboral(current)

    return current


def calcular_tiempo_respuesta(
    fecha_inicio: datetime, fecha_fin: datetime, solo_horas_laborales: bool = False
) -> float:
    """
    Calcula el tiempo de respuesta en horas entre dos fechas.

    Args:
        fecha_inicio: Fecha y hora de inicio
        fecha_fin: Fecha y hora de fin
        solo_horas_laborales: Si True, solo cuenta horas laborales (9-18, L-V)

    Returns:
        Horas transcurridas (puede ser fraccionario)
    """
    if solo_horas_laborales:
        return calcular_horas_laborales(fecha_inicio, fecha_fin)

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

        new_id = insert_returning_id(
            cursor,
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

        return {"id": new_id}


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

        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE sla_alertas
            SET estado = 'resuelta',
                fecha_resolucion = ?,
                resuelto_por = ?
            WHERE id = ?
              AND estado = 'activa'
        """,
            (now_iso, resuelto_por, alerta_id),
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

        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE sla_alertas
            SET estado = 'resuelta',
                fecha_resolucion = ?,
                resuelto_por = ?
            WHERE solicitud_id = ?
              AND estado = 'activa'
        """,
            (now_iso, resuelto_por, solicitud_id),
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
            FROM solicitud
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
            FROM solicitud
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
            FROM solicitud
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
            FROM solicitud
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
            FROM solicitud
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
                FROM solicitud
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

        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE solicitud
            SET sla_fecha_limite = ?,
                sla_estado = ?,
                updated_at = ?
            WHERE id = ?
        """,
            (fecha_limite, estado_sla, now_iso, solicitud_id),
        )

        return {"actualizado": cursor.rowcount > 0}


def actualizar_sla_solicitudes_lote(
    solicitud_ids: List[int], estado_sla: str
) -> Dict[str, Any]:
    """
    FIX 3.10: Actualiza el estado SLA de múltiples solicitudes en lote.

    Más eficiente que actualizar una por una cuando se procesan
    muchas solicitudes (ej: job nocturno de recálculo SLA).

    Args:
        solicitud_ids: Lista de IDs de solicitudes
        estado_sla: Nuevo estado SLA ('on_time', 'warning', 'breach')

    Returns:
        Dict con número de registros actualizados
    """
    if not solicitud_ids:
        return {"actualizados": 0}

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        now_iso = datetime.now().isoformat()
        placeholders = ",".join(["?"] * len(solicitud_ids))
        params = [estado_sla, now_iso] + list(solicitud_ids)

        cursor.execute(
            f"""
            UPDATE solicitud
            SET sla_estado = ?,
                updated_at = ?
            WHERE id IN ({placeholders})
        """,
            params,
        )

        return {"actualizados": cursor.rowcount}


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
            params.append(bool(activo))

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

        new_id = insert_returning_id(
            cursor,
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

        return {"id": new_id}


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

        # Agregar updated_at como parametro (compatible con PostgreSQL y SQLite)
        set_clauses.append("updated_at = ?")
        params.append(datetime.now().isoformat())

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
        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE sla_configuracion
            SET activo = FALSE,
                updated_at = ?
            WHERE id = ?
        """,
            (now_iso, config_id),
        )

        return {"eliminado": cursor.rowcount > 0}
