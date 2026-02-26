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

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
)


def _ph():
    """Return the correct placeholder character for the current DB."""
    return "%s" if is_using_postgresql() else "?"

# =============================================================================
# Configuracion SLA
# =============================================================================


def obtener_configuracion_sla(
    criticidad: str, estado_desde: str = None, estado_hasta: str = None
) -> Optional[Dict[str, Any]]:
    """
    Obtiene la configuracion SLA aplicable.

    sla_configuracion actual schema: id, tipo_solicitud, criticidad, tiempo_limite_horas, activo, created_at

    Args:
        criticidad: Nivel de criticidad (Baja, Normal, Alta, Urgente)
        estado_desde: Ignored (not in actual schema)
        estado_hasta: Ignored (not in actual schema)

    Returns:
        Dict con configuracion SLA o None si no existe
    """
    ph = _ph()
    bool_true = "TRUE" if is_using_postgresql() else "1"
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Buscar configuracion especifica para criticidad
        cursor.execute(
            f"""
            SELECT id, criticidad, tiempo_limite_horas, activo, created_at
            FROM sla_configuracion
            WHERE criticidad = {ph}
              AND activo = {bool_true}
            LIMIT 1
        """,
            (criticidad,),
        )

        row = cursor.fetchone()
        if row:
            return dict(row)

        # Buscar configuracion general
        cursor.execute(
            f"""
            SELECT id, criticidad, tiempo_limite_horas, activo, created_at
            FROM sla_configuracion
            WHERE criticidad IS NULL
              AND activo = {bool_true}
            LIMIT 1
        """
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

    sla_alertas actual schema: id, solicitud_id, tipo_alerta, mensaje, resuelta, created_at

    Args:
        solicitud_id: ID de la solicitud
        sla_config_id: Ignored (not in actual schema)
        tipo: Tipo de alerta ('warning', 'breach', 'escalated')
        fecha_inicio: Fecha inicio del contador SLA
        fecha_vencimiento: Fecha de vencimiento
        tiempo_transcurrido_horas: Horas transcurridas
        tiempo_objetivo_horas: Horas objetivo del SLA
        mensaje: Mensaje descriptivo opcional

    Returns:
        Dict con id de la alerta creada
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        msg = mensaje or f"Alerta SLA {tipo}: solicitud {solicitud_id}"

        new_id = insert_returning_id(
            cursor,
            f"""
            INSERT INTO sla_alertas (
                solicitud_id, tipo_alerta, mensaje, resuelta
            ) VALUES ({ph}, {ph}, {ph}, FALSE)
        """,
            (
                solicitud_id,
                tipo,
                msg,
            ),
        )

        return {"id": new_id}


def resolver_alerta_sla(alerta_id: int, resuelto_por: str) -> Dict[str, Any]:
    """
    Marca una alerta como resuelta.

    sla_alertas actual schema: id, solicitud_id, tipo_alerta, mensaje, resuelta, created_at

    Args:
        alerta_id: ID de la alerta a resolver
        resuelto_por: ID del usuario que resuelve

    Returns:
        Dict con resultado de la operacion
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            f"""
            UPDATE sla_alertas
            SET resuelta = TRUE
            WHERE id = {ph}
              AND resuelta = FALSE
        """,
            (alerta_id,),
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
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            f"""
            UPDATE sla_alertas
            SET resuelta = TRUE
            WHERE solicitud_id = {ph}
              AND resuelta = FALSE
        """,
            (solicitud_id,),
        )

        return {"alertas_resueltas": cursor.rowcount}


def obtener_alertas_activas(
    solicitud_id: Optional[int] = None, tipo: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Obtiene las alertas activas.

    sla_alertas actual schema: id, solicitud_id, tipo_alerta, mensaje, resuelta, created_at

    Args:
        solicitud_id: Filtrar por solicitud (opcional)
        tipo: Filtrar por tipo (opcional)

    Returns:
        Lista de alertas activas
    """
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, solicitud_id, tipo_alerta, mensaje, resuelta, created_at
            FROM sla_alertas
            WHERE resuelta = FALSE
        """
        params = []

        if solicitud_id:
            query += f" AND solicitud_id = {ph}"
            params.append(solicitud_id)

        if tipo:
            query += f" AND tipo_alerta = {ph}"
            params.append(tipo)

        query += " ORDER BY created_at ASC"

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
    from backend.core.db import is_using_postgresql
    ph = "%s" if is_using_postgresql() else "?"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        fecha_inicio = datetime.now(timezone.utc) - timedelta(days=periodo_dias)
        fecha_str = fecha_inicio.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Total de solicitudes en el periodo
        # Actual table: solicitudes (not solicitud); no sla_estado column
        cursor.execute(
            f"""
            SELECT COUNT(*) as total
            FROM solicitudes
            WHERE created_at >= {ph}
        """,
            (fecha_str,),
        )
        total_row = cursor.fetchone()
        total = (total_row["total"] if isinstance(total_row, dict) else total_row[0]) if total_row else 0

        # Since solicitudes has no sla_estado column, use alertas as proxy:
        # - breach: solicitudes submitted more than N hours ago and still submitted
        # - on_time: solicitudes submitted recently and resolved
        # Use sla_alertas table for breach count
        cursor.execute(
            f"""
            SELECT COUNT(DISTINCT solicitud_id) as breach
            FROM sla_alertas
            WHERE tipo_alerta = 'breach'
              AND resuelta = FALSE
              AND created_at >= {ph}
        """,
            (fecha_str,),
        )
        breach_row = cursor.fetchone()
        breach = (breach_row["breach"] if isinstance(breach_row, dict) else breach_row[0]) if breach_row else 0

        # warning count
        cursor.execute(
            f"""
            SELECT COUNT(DISTINCT solicitud_id) as warning
            FROM sla_alertas
            WHERE tipo_alerta = 'warning'
              AND resuelta = FALSE
              AND created_at >= {ph}
        """,
            (fecha_str,),
        )
        warning_row = cursor.fetchone()
        warning = (warning_row["warning"] if isinstance(warning_row, dict) else warning_row[0]) if warning_row else 0

        on_time = max(0, total - breach - warning)
        sin_sla = 0  # Not tracked separately

        # Calcular % cumplimiento
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
                f"""
                SELECT
                    criticidad,
                    COUNT(*) as total
                FROM solicitudes
                WHERE created_at >= {ph}
                GROUP BY criticidad
            """,
                (fecha_str,),
            )
            resultado["por_criticidad"] = [
                {**dict(row), "on_time": 0, "warning": 0, "breach": 0, "sin_sla": 0}
                for row in cursor.fetchall()
            ]

        return resultado


# =============================================================================
# Actualizar SLA de Solicitud
# =============================================================================


def actualizar_sla_solicitud(
    solicitud_id: int, fecha_limite: str, estado_sla: str
) -> Dict[str, Any]:
    """
    Actualiza la informacion SLA de una solicitud via alertas.

    solicitudes table has no sla_* columns - track via sla_alertas instead.

    Args:
        solicitud_id: ID de la solicitud
        fecha_limite: Nueva fecha limite (stored in alerta mensaje)
        estado_sla: Nuevo estado SLA ('on_time', 'warning', 'breach')

    Returns:
        Dict con resultado de la operacion
    """
    # If on_time, resolve all active alerts; if warning/breach, create new alert
    if estado_sla == "on_time":
        return resolver_alertas_solicitud(solicitud_id, "system")
    else:
        result = registrar_alerta_sla(
            solicitud_id=solicitud_id,
            sla_config_id=0,
            tipo=estado_sla,
            fecha_inicio=datetime.now().isoformat(),
            fecha_vencimiento=fecha_limite,
            mensaje=f"SLA {estado_sla}: vencimiento {fecha_limite}",
        )
        return {"actualizado": result.get("id") is not None}


def actualizar_sla_solicitudes_lote(
    solicitud_ids: List[int], estado_sla: str
) -> Dict[str, Any]:
    """
    Actualiza el estado SLA de multiples solicitudes en lote.

    Args:
        solicitud_ids: Lista de IDs de solicitudes
        estado_sla: Nuevo estado SLA ('on_time', 'warning', 'breach')

    Returns:
        Dict con numero de registros actualizados
    """
    if not solicitud_ids:
        return {"actualizados": 0}

    actualizados = 0
    for sid in solicitud_ids:
        try:
            actualizar_sla_solicitud(sid, datetime.now().isoformat(), estado_sla)
            actualizados += 1
        except Exception:
            pass

    return {"actualizados": actualizados}


# =============================================================================
# CRUD Configuracion SLA
# =============================================================================


def listar_configuraciones_sla(activo: Optional[bool] = None) -> List[Dict[str, Any]]:
    """
    Lista todas las configuraciones SLA.

    sla_configuracion actual schema: id, tipo_solicitud, criticidad, tiempo_limite_horas, activo, created_at

    Args:
        activo: Filtrar por estado activo (opcional)

    Returns:
        Lista de configuraciones SLA
    """
    bool_true = "TRUE" if is_using_postgresql() else "1"
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT id, tipo_solicitud, criticidad, tiempo_limite_horas, activo, created_at
            FROM sla_configuracion
        """
        params = []

        if activo is not None:
            val = bool_true if activo else ("FALSE" if is_using_postgresql() else "0")
            query += f" WHERE activo = {val}"

        query += " ORDER BY criticidad"

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def crear_configuracion_sla(
    nombre: str = None,
    estado_desde: str = None,
    estado_hasta: str = None,
    tiempo_objetivo_horas: int = 24,
    criticidad: Optional[str] = None,
    descripcion: Optional[str] = None,
    tiempo_alerta_horas: Optional[int] = None,
    notificar_al_vencer: bool = True,
    escalar_al_vencer: bool = False,
    escalar_a_rol: Optional[str] = None,
    created_by: Optional[str] = None,
    tipo_solicitud: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Crea una nueva configuracion SLA.

    sla_configuracion actual schema: id, tipo_solicitud, criticidad, tiempo_limite_horas, activo, created_at

    Args:
        nombre: Ignored (not in actual schema)
        tiempo_objetivo_horas: Tiempo limite en horas
        criticidad: Criticidad aplicable
        tipo_solicitud: Tipo de solicitud aplicable

    Returns:
        Dict con id de la configuracion creada
    """
    ph = _ph()
    bool_true = "TRUE" if is_using_postgresql() else "1"
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        new_id = insert_returning_id(
            cursor,
            f"""
            INSERT INTO sla_configuracion (
                tipo_solicitud, criticidad, tiempo_limite_horas, activo
            ) VALUES ({ph}, {ph}, {ph}, {bool_true})
        """,
            (
                tipo_solicitud or estado_desde,
                criticidad,
                tiempo_objetivo_horas,
            ),
        )

        return {"id": new_id}


def actualizar_configuracion_sla(config_id: int, **campos) -> Dict[str, Any]:
    """
    Actualiza una configuracion SLA existente.

    sla_configuracion actual schema: id, tipo_solicitud, criticidad, tiempo_limite_horas, activo, created_at

    Args:
        config_id: ID de la configuracion
        **campos: Campos a actualizar

    Returns:
        Dict con resultado de la operacion
    """
    if not campos:
        return {"actualizado": False, "mensaje": "No hay campos para actualizar"}

    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        set_clauses = []
        params = []

        # Map old field names to actual schema
        field_map = {
            "tiempo_objetivo_horas": "tiempo_limite_horas",
            "tipo_solicitud": "tipo_solicitud",
            "criticidad": "criticidad",
            "activo": "activo",
        }

        for campo, valor in campos.items():
            actual_campo = field_map.get(campo, campo)
            if actual_campo in {"tipo_solicitud", "criticidad", "tiempo_limite_horas", "activo"}:
                set_clauses.append(f"{actual_campo} = {ph}")
                params.append(valor)

        if not set_clauses:
            return {"actualizado": False, "mensaje": "No hay campos validos para actualizar"}

        query = f"""
            UPDATE sla_configuracion
            SET {", ".join(set_clauses)}
            WHERE id = {ph}
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
    ph = _ph()
    bool_false = "FALSE" if is_using_postgresql() else "0"
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Soft delete - solo desactivar (no updated_at in actual schema)
        cursor.execute(
            f"""
            UPDATE sla_configuracion
            SET activo = {bool_false}
            WHERE id = {ph}
        """,
            (config_id,),
        )

        return {"eliminado": cursor.rowcount > 0}
