"""
Servicio MRP (Material Requirements Planning).

Sprint 5.2 - Implementacion basada en TDD tests.

Gestiona:
- Calculo de requerimientos netos
- Generacion de ordenes planificadas
- Calculo de punto de reorden y EOQ
- Integracion con forecast de demanda
- Alertas automaticas de reposicion
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id

logger = logging.getLogger(__name__)

# Intentar importar el pipeline de forecast
from backend.agent.pipelines.demand_forecast import DemandForecastPipeline


# =============================================================================
# Calculo de Requerimientos Netos
# =============================================================================


def calcular_requerimiento_neto(
    demanda: float,
    stock_actual: float,
    pedidos_en_curso: float,
    stock_seguridad: float,
    consumo_diario: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Calcula el requerimiento neto de un material.

    Formula: Requerimiento = Demanda - Stock - Pedidos + Stock Seguridad

    Args:
        demanda: Demanda total esperada
        stock_actual: Stock disponible actual
        pedidos_en_curso: Pedidos pendientes de recibir
        stock_seguridad: Stock de seguridad requerido
        consumo_diario: Consumo diario promedio (para calcular cobertura)

    Returns:
        Dict con requerimiento neto, necesidad de reposicion y cobertura
    """
    disponible = stock_actual + pedidos_en_curso
    necesidad = demanda + stock_seguridad - disponible

    requerimiento_neto = max(0, necesidad)
    necesita_reposicion = requerimiento_neto > 0

    resultado = {
        "demanda": demanda,
        "stock_actual": stock_actual,
        "pedidos_en_curso": pedidos_en_curso,
        "stock_seguridad": stock_seguridad,
        "disponible": disponible,
        "requerimiento_neto": requerimiento_neto,
        "necesita_reposicion": necesita_reposicion,
    }

    # Calcular dias de cobertura si se proporciona consumo diario
    if consumo_diario and consumo_diario > 0:
        resultado["dias_cobertura"] = round(stock_actual / consumo_diario, 1)
        resultado["consumo_diario"] = consumo_diario
    else:
        resultado["dias_cobertura"] = None

    return resultado


# =============================================================================
# Calculo de Punto de Reorden
# =============================================================================


def calcular_punto_reorden(
    consumo_diario: float,
    lead_time_dias: int,
    stock_seguridad: float,
    variabilidad_demanda: float = 0.0,
    variabilidad_lead_time: float = 0.0,
    consumo_minimo_estimado: float = 0.5,  # FIX: Nuevo parámetro para materiales sin histórico
) -> Dict[str, Any]:
    """
    Calcula el punto de reorden de un material.

    Formula basica: ROP = (Lead time * Consumo diario) + Stock seguridad
    Con variabilidad: Agrega factor de seguridad adicional

    Args:
        consumo_diario: Consumo promedio diario
        lead_time_dias: Tiempo de entrega en dias
        stock_seguridad: Stock de seguridad base
        variabilidad_demanda: Coeficiente de variacion de demanda (0-1)
        variabilidad_lead_time: Coeficiente de variacion de lead time (0-1)
        consumo_minimo_estimado: Consumo mínimo para materiales sin histórico (default 0.5/día)

    Returns:
        Dict con punto de reorden y componentes
    """
    # FIX: Si no hay consumo histórico, usar un mínimo estimado
    # Esto evita que materiales sin datos históricos tengan ROP muy bajo (=1)
    consumo_efectivo = consumo_diario if consumo_diario > 0 else consumo_minimo_estimado
    consumo_estimado = consumo_diario <= 0  # Flag para indicar si se usó estimación

    # Calculo basico
    demanda_lead_time = lead_time_dias * consumo_efectivo

    # FIX: Mínimo más razonable: al menos 5 unidades o 2 días de consumo estimado
    minimo_razonable = max(consumo_efectivo * 2, 5.0)
    punto_basico = max(demanda_lead_time + stock_seguridad, minimo_razonable)

    # Agregar factor de seguridad por variabilidad
    factor_seguridad = 1.0
    if variabilidad_demanda > 0 or variabilidad_lead_time > 0:
        # Factor z para 95% de nivel de servicio
        z = 1.65
        # Desviacion combinada - usar consumo_efectivo para cálculos
        sigma_demanda = consumo_efectivo * variabilidad_demanda
        sigma_lead_time = lead_time_dias * variabilidad_lead_time

        # Stock de seguridad adicional
        ss_adicional = z * math.sqrt(
            lead_time_dias * (sigma_demanda**2) + (consumo_efectivo**2) * (sigma_lead_time**2)
        )
        # punto_basico siempre > 0 por el max() anterior
        factor_seguridad = 1 + (ss_adicional / punto_basico)

    # FIX: Mínimo más alto para materiales sin histórico (5 unidades)
    punto_reorden = max(round(punto_basico * factor_seguridad), 5 if consumo_estimado else 1)

    return {
        "punto_reorden": punto_reorden,
        "demanda_lead_time": demanda_lead_time,
        "stock_seguridad_base": stock_seguridad,
        "factor_seguridad": round(factor_seguridad, 3),
        "lead_time_dias": lead_time_dias,
        "consumo_diario": consumo_diario,
        "consumo_efectivo": consumo_efectivo,  # FIX: Incluir consumo usado en cálculo
        "consumo_estimado": consumo_estimado,  # FIX: Flag si se usó estimación
    }


# =============================================================================
# Cantidad Optima de Pedido (EOQ)
# =============================================================================


def calcular_cantidad_optima(
    demanda_anual: float,
    costo_orden: float,
    costo_mantenimiento_unitario: float,
    cantidad_minima: Optional[float] = None,
    cantidad_maxima: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Calcula la cantidad economica de pedido (EOQ).

    Formula: EOQ = sqrt(2 * D * S / H)
    Donde: D = Demanda anual, S = Costo por orden, H = Costo mantenimiento

    Args:
        demanda_anual: Demanda anual del material
        costo_orden: Costo de realizar un pedido
        costo_mantenimiento_unitario: Costo de mantener una unidad en inventario/año
        cantidad_minima: Cantidad minima de pedido (restriccion)
        cantidad_maxima: Cantidad maxima de pedido (restriccion)

    Returns:
        Dict con cantidad optima y costos asociados
    """
    # Calcular EOQ
    # FIX: Si no hay costo de mantenimiento, usar proxy del 20% anual del valor
    # En lugar de pedir toda la demanda anual de una vez (incorrecto)
    if costo_mantenimiento_unitario <= 0:
        # Estimar costo de mantenimiento como 20% del costo de orden mensualizado
        # Esto es una aproximación razonable para la industria
        costo_mantenimiento_estimado = max(costo_orden * 0.2 / 12, 0.01)
        eoq = math.sqrt(2 * demanda_anual * costo_orden / costo_mantenimiento_estimado)
        logger.debug(
            f"[MRP] EOQ calculado con costo mantenimiento estimado: {costo_mantenimiento_estimado:.4f}"
        )
    else:
        eoq = math.sqrt(2 * demanda_anual * costo_orden / costo_mantenimiento_unitario)

    # Asegurar un mínimo razonable (al menos 1 unidad)
    eoq = max(eoq, 1.0)

    cantidad_optima = round(eoq)
    ajustado = False

    # Aplicar restricciones
    if cantidad_minima and cantidad_optima < cantidad_minima:
        cantidad_optima = cantidad_minima
        ajustado = True

    if cantidad_maxima and cantidad_optima > cantidad_maxima:
        cantidad_optima = cantidad_maxima
        ajustado = True

    # Calcular numero de ordenes al año
    ordenes_por_anio = demanda_anual / cantidad_optima if cantidad_optima > 0 else 0

    # Costo total anual
    costo_ordenar = ordenes_por_anio * costo_orden
    costo_mantener = (cantidad_optima / 2) * costo_mantenimiento_unitario
    costo_total = costo_ordenar + costo_mantener

    return {
        "cantidad_optima": cantidad_optima,
        "eoq_calculado": round(eoq),
        "ajustado": ajustado,
        "ordenes_por_anio": round(ordenes_por_anio, 1),
        "costo_ordenar_anual": round(costo_ordenar, 2),
        "costo_mantener_anual": round(costo_mantener, 2),
        "costo_total_anual": round(costo_total, 2),
    }


# =============================================================================
# Generacion de Ordenes Planificadas
# =============================================================================


def generar_orden_planificada(
    material_codigo: str,
    centro: str,
    cantidad: float,
    fecha_necesidad: str,
    tipo: str = "compra",
    prioridad: str = "normal",
) -> Dict[str, Any]:
    """
    Genera una orden planificada para un material.

    Args:
        material_codigo: Codigo del material
        centro: Centro de costo
        cantidad: Cantidad a ordenar
        fecha_necesidad: Fecha en que se necesita
        tipo: Tipo de orden (compra, transferencia, produccion)
        prioridad: Prioridad (alta, normal, baja)

    Returns:
        Dict con id de la orden creada
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        new_id = insert_returning_id(
            cursor,
            """
            INSERT INTO ordenes_planificadas (
                material_codigo, centro, cantidad,
                fecha_necesidad, tipo, prioridad,
                estado, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'planificada', ?)
        """,
            (
                material_codigo,
                centro,
                cantidad,
                fecha_necesidad,
                tipo,
                prioridad,
                datetime.now(timezone.utc).isoformat(),
            ),
        )

        return {
            "id": new_id,
            "material_codigo": material_codigo,
            "centro": centro,
            "cantidad": cantidad,
            "estado": "planificada",
            "tipo": tipo,
        }


def generar_ordenes_mrp(centro: str, solo_criticos: bool = False) -> Dict[str, Any]:
    """
    Genera ordenes planificadas para materiales con necesidad.

    Args:
        centro: Centro a analizar
        solo_criticos: Si True, solo materiales criticos

    Returns:
        Dict con resumen de ordenes generadas
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT
                codigo_material as codigo,
                centro,
                stock_actual,
                punto_pedido,
                stock_seguridad,
                consumo_promedio_mensual,
                lead_time_dias
            FROM materiales_mrp
            WHERE centro = ?
              AND stock_actual < punto_pedido
        """
        params = [centro]

        if solo_criticos:
            query += " AND critico = 1"

        cursor.execute(query, params)
        materiales = cursor.fetchall()

    ordenes_generadas = 0
    ordenes = []

    for mat in materiales:
        # Calcular cantidad optima
        consumo_mensual = mat["consumo_promedio_mensual"] or 0
        demanda_anual = consumo_mensual * 12

        if demanda_anual > 0:
            eoq = calcular_cantidad_optima(
                demanda_anual=demanda_anual,
                costo_orden=100,  # Costo estimado
                costo_mantenimiento_unitario=demanda_anual * 0.2 / 12,  # 20% anual
            )
            cantidad = eoq["cantidad_optima"]
        else:
            cantidad = mat["punto_pedido"] - mat["stock_actual"]

        # FIX 3.11: Validar cantidad mínima de pedido
        # Usar cantidad_minima_pedido del material o mínimo de 10 unidades
        cantidad_minima = max(mat.get("cantidad_minima_pedido") or 1, 10)
        if cantidad > 0 and cantidad < cantidad_minima:
            cantidad = cantidad_minima

        if cantidad > 0:
            lead_time = mat["lead_time_dias"] or 15
            fecha_necesidad = (datetime.now(timezone.utc) + timedelta(days=lead_time)).strftime(
                "%Y-%m-%d"
            )

            try:
                orden = generar_orden_planificada(
                    material_codigo=mat["codigo"],
                    centro=centro,
                    cantidad=cantidad,
                    fecha_necesidad=fecha_necesidad,
                    tipo="compra",
                )
                ordenes.append(orden)
                ordenes_generadas += 1
            except Exception as e:
                logger.warning(f"Error generando orden para material {mat['codigo']}: {e}")

    return {
        "centro": centro,
        "materiales_analizados": len(materiales),
        "ordenes_generadas": ordenes_generadas,
        "ordenes": ordenes,
    }


# =============================================================================
# Integracion con Forecast de Demanda
# =============================================================================


def obtener_demanda_proyectada(material_codigo: str, centro: str, dias: int = 30) -> Dict[str, Any]:
    """
    Obtiene demanda proyectada usando ML o promedio historico.

    Args:
        material_codigo: Codigo del material
        centro: Centro de costo
        dias: Dias a proyectar

    Returns:
        Dict con demanda proyectada y metodo usado
    """
    # Intentar usar modelo ML
    if DemandForecastPipeline:
        try:
            pipeline = DemandForecastPipeline()
            forecast = pipeline.predict(
                material_codigo=material_codigo, centro=centro, days_ahead=dias
            )

            return {
                "material_codigo": material_codigo,
                "centro": centro,
                "dias": dias,
                "demanda_proyectada": forecast.get("predicted_demand", 0),
                "confianza_inferior": forecast.get("confidence_lower", 0),
                "confianza_superior": forecast.get("confidence_upper", 0),
                "metodo": "ml_forecast",
            }
        except Exception as e:
            logger.debug(f"ML forecast no disponible para {material_codigo}: {e}")

    # Fallback: usar promedio historico
    sin_datos_historicos = False
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT consumo_promedio_mensual as consumo_promedio
            FROM materiales_mrp
            WHERE codigo_material = ? AND centro = ?
        """,
            (material_codigo, centro),
        )

        row = cursor.fetchone()
        if row and row["consumo_promedio"]:
            consumo_mensual = row["consumo_promedio"]
        else:
            consumo_mensual = 0
            sin_datos_historicos = True

    # Proyectar consumo para los dias solicitados
    demanda_proyectada = (consumo_mensual / 30) * dias if consumo_mensual else 0

    return {
        "material_codigo": material_codigo,
        "centro": centro,
        "dias": dias,
        "demanda_proyectada": round(demanda_proyectada, 2),
        "metodo": "promedio_historico",
        "sin_datos_historicos": sin_datos_historicos,
        "alerta": (
            "Sin datos históricos - demanda proyectada es 0, requiere revisión manual"
            if sin_datos_historicos
            else None
        ),
    }


# =============================================================================
# Analisis MRP
# =============================================================================


def analizar_material(material_codigo: str, centro: str) -> Dict[str, Any]:
    """
    Analisis completo de un material.

    Args:
        material_codigo: Codigo del material
        centro: Centro de costo

    Returns:
        Dict con analisis completo del material
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                codigo_material,
                descripcion,
                stock_actual,
                stock_seguridad,
                punto_pedido,
                stock_maximo,
                pedidos_en_curso,
                consumo_promedio_mensual,
                lead_time_dias
            FROM materiales_mrp
            WHERE codigo_material = ? AND centro = ?
        """,
            (material_codigo, centro),
        )

        mat = cursor.fetchone()

    if not mat:
        return {"error": "Material no encontrado"}

    # Extraer datos
    stock_actual = mat["stock_actual"] or 0
    stock_seguridad = mat["stock_seguridad"] or 0
    punto_pedido = mat["punto_pedido"] or 0
    pedidos_en_curso = mat["pedidos_en_curso"] or 0
    consumo_mensual = mat["consumo_promedio_mensual"] or 0
    consumo_diario = consumo_mensual / 30 if consumo_mensual > 0 else 0

    # Calcular requerimiento neto
    req = calcular_requerimiento_neto(
        demanda=consumo_mensual,
        stock_actual=stock_actual,
        pedidos_en_curso=pedidos_en_curso,
        stock_seguridad=stock_seguridad,
        consumo_diario=consumo_diario,
    )

    # Generar recomendacion
    rec = generar_recomendacion(
        stock_actual=stock_actual,
        stock_seguridad=stock_seguridad,
        punto_pedido=punto_pedido,
        pedidos_en_curso=pedidos_en_curso,
    )

    # Determinar estado
    if stock_actual <= 0:
        estado = "quiebre"
    elif stock_actual < stock_seguridad:
        estado = "critico"
    elif stock_actual < punto_pedido:
        estado = "bajo_punto_pedido"
    else:
        estado = "normal"

    return {
        "material_codigo": material_codigo,
        "descripcion": mat["descripcion"],
        "estado": estado,
        "stock_actual": stock_actual,
        "stock_seguridad": stock_seguridad,
        "punto_pedido": punto_pedido,
        "pedidos_en_curso": pedidos_en_curso,
        "requerimiento_neto": req["requerimiento_neto"],
        "dias_cobertura": req["dias_cobertura"],
        "recomendacion": rec,
    }


def analizar_centro(centro: str, incluir_normales: bool = False) -> Dict[str, Any]:
    """
    Analisis MRP de todos los materiales de un centro.

    Args:
        centro: Centro a analizar
        incluir_normales: Si True, incluye materiales sin problemas

    Returns:
        Dict con resumen del analisis
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                codigo_material,
                stock_actual,
                punto_pedido,
                stock_seguridad
            FROM materiales_mrp
            WHERE centro = ?
        """,
            (centro,),
        )

        materiales = cursor.fetchall()

    criticos = []
    bajo_pedido = []
    normales = []

    for mat in materiales:
        stock = mat["stock_actual"] or 0
        pp = mat["punto_pedido"] or 0
        ss = mat["stock_seguridad"] or 0

        if stock < ss:
            criticos.append(mat["codigo_material"])
        elif stock < pp:
            bajo_pedido.append(mat["codigo_material"])
        else:
            normales.append(mat["codigo_material"])

    resultado = {
        "centro": centro,
        "materiales_analizados": len(materiales),
        "materiales_criticos": criticos,
        "materiales_bajo_pedido": bajo_pedido,
        "resumen": {
            "total": len(materiales),
            "criticos": len(criticos),
            "bajo_pedido": len(bajo_pedido),
            "normales": len(normales),
        },
    }

    if incluir_normales:
        resultado["materiales_normales"] = normales

    return resultado


# =============================================================================
# Recomendaciones MRP
# =============================================================================


def generar_recomendacion(
    stock_actual: float, stock_seguridad: float, punto_pedido: float, pedidos_en_curso: float
) -> Dict[str, Any]:
    """
    Genera recomendacion de accion basada en niveles de stock.

    Args:
        stock_actual: Stock disponible
        stock_seguridad: Stock minimo de seguridad
        punto_pedido: Nivel de reorden
        pedidos_en_curso: Pedidos pendientes

    Returns:
        Dict con accion recomendada y prioridad
    """
    disponible = stock_actual + pedidos_en_curso

    # Quiebre o bajo seguridad
    if stock_actual < stock_seguridad:
        if pedidos_en_curso > 0:
            return {
                "accion": "acelerar_pedido",
                "prioridad": "alta",
                "mensaje": "Stock critico. Acelerar pedido en curso.",
            }
        else:
            return {
                "accion": "compra_urgente",
                "prioridad": "alta",
                "mensaje": "Stock bajo seguridad. Generar compra urgente.",
            }

    # Bajo punto de pedido
    if stock_actual < punto_pedido:
        if pedidos_en_curso > 0:
            return {
                "accion": "monitorear",
                "prioridad": "media",
                "mensaje": "Pedido en curso. Monitorear entrega.",
            }
        else:
            return {
                "accion": "generar_solped",
                "prioridad": "media",
                "mensaje": "Stock bajo punto de pedido. Generar SolPed.",
            }

    # Stock OK
    return {"accion": "ninguna", "prioridad": "baja", "mensaje": "Stock en niveles adecuados."}


# =============================================================================
# Alertas MRP Automaticas
# =============================================================================


def crear_alerta_mrp(
    material_codigo: str, centro: str, tipo: str, severidad: str, mensaje: str
) -> Dict[str, Any]:
    """
    Crea una alerta MRP automatica.

    Args:
        material_codigo: Codigo del material
        centro: Centro de costo
        tipo: Tipo de alerta (quiebre, bajo_punto_pedido, etc.)
        severidad: Severidad (danger, warning, info)
        mensaje: Mensaje descriptivo

    Returns:
        Dict con id de la alerta creada
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        new_id = insert_returning_id(
            cursor,
            """
            INSERT INTO alertas_mrp (
                material_codigo, centro, tipo, severidad,
                mensaje, estado, created_at
            ) VALUES (?, ?, ?, ?, ?, 'activa', ?)
        """,
            (
                material_codigo,
                centro,
                tipo,
                severidad,
                mensaje,
                datetime.now(timezone.utc).isoformat(),
            ),
        )

        return {
            "id": new_id,
            "material_codigo": material_codigo,
            "tipo": tipo,
            "severidad": severidad,
        }


def obtener_alertas_mrp(
    centro: Optional[str] = None, tipo: Optional[str] = None, solo_activas: bool = True
) -> List[Dict[str, Any]]:
    """
    Obtiene alertas MRP.

    Args:
        centro: Filtrar por centro
        tipo: Filtrar por tipo
        solo_activas: Solo alertas activas

    Returns:
        Lista de alertas
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = "SELECT * FROM alertas_mrp WHERE 1=1"
        params = []

        if solo_activas:
            query += " AND estado = 'activa'"

        if centro:
            query += " AND centro = ?"
            params.append(centro)

        if tipo:
            query += " AND tipo = ?"
            params.append(tipo)

        query += " ORDER BY created_at DESC"

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def resolver_alerta_mrp(alerta_id: int, resuelto_por: str, accion_tomada: str) -> Dict[str, Any]:
    """
    Resuelve una alerta MRP.

    Args:
        alerta_id: ID de la alerta
        resuelto_por: Usuario que resuelve
        accion_tomada: Descripcion de la accion tomada

    Returns:
        Dict con resultado de la operacion
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE alertas_mrp
            SET estado = 'resuelta',
                resuelto_por = ?,
                accion_tomada = ?,
                fecha_resolucion = ?
            WHERE id = ?
              AND estado = 'activa'
        """,
            (resuelto_por, accion_tomada, datetime.now(timezone.utc).isoformat(), alerta_id),
        )

        return {"resuelta": cursor.rowcount > 0}


# =============================================================================
# Parametrizacion MRP Avanzada - Sprint 25 (Nueva Página)
# =============================================================================

def calcular_stock_seguridad(
    demanda_diaria: float,
    lead_time_dias: float,
    desv_std_demanda_diaria: float,
    desv_std_lead_time: float,
    nivel_servicio: float,
) -> tuple:
    """
    Calcula Stock de Seguridad (SS) con fórmula completa que considera
    variabilidad en demanda y lead time.

    Formula: SS = Z × √(LT × σd² + d² × σLT²)

    Donde:
    - Z = Factor de servicio (tabla según nivel_servicio)
    - σd = Desviación estándar demanda diaria
    - LT = Lead Time promedio (días)
    - σLT = Desviación estándar del Lead Time
    - d = Demanda diaria promedio

    Args:
        demanda_diaria: Demanda promedio diaria (unidades/día)
        lead_time_dias: Lead time promedio (días)
        desv_std_demanda_diaria: Desviación estándar demanda diaria
        desv_std_lead_time: Desviación estándar lead time (días)
        nivel_servicio: Nivel de servicio deseado (0.90-0.995)

    Returns:
        Tuple (stock_seguridad, factor_z)
    """
    # Tabla Z para diferentes niveles de servicio
    Z_TABLE = {
        0.90: 1.28,
        0.95: 1.65,
        0.97: 1.88,
        0.98: 2.05,
        0.99: 2.33,
        0.995: 2.58,
    }

    # Obtener factor Z (default a 0.95 si no existe)
    z = Z_TABLE.get(round(nivel_servicio, 2), 1.65)

    # Fórmula completa: Z × √(LT × σd² + d² × σLT²)
    varianza_demanda = lead_time_dias * (desv_std_demanda_diaria**2)
    varianza_leadtime = (demanda_diaria**2) * (desv_std_lead_time**2)
    ss = z * math.sqrt(max(0, varianza_demanda + varianza_leadtime))

    return (round(ss, 0), z)


def calcular_punto_reorden_completo(
    demanda_diaria: float,
    lead_time_dias: float,
    stock_seguridad: float,
) -> float:
    """
    Calcula Punto de Reorden (ROP) básico.

    Formula: ROP = (d × LT) + SS

    Args:
        demanda_diaria: Demanda promedio diaria
        lead_time_dias: Lead time en días
        stock_seguridad: Stock de seguridad calculado

    Returns:
        Punto de reorden (unidades)
    """
    return (demanda_diaria * lead_time_dias) + stock_seguridad


def calcular_eoq_con_restricciones(
    demanda_anual: float,
    costo_por_pedido: float,
    costo_unitario: float,
    tasa_mantenimiento: float,
    cantidad_minima: int = 10,
    cantidad_maxima: int = None,
    multiplo_pedido: int = 1,
) -> tuple:
    """
    Calcula Cantidad Económica de Pedido (EOQ) con restricciones.

    Formula: EOQ = √(2 × D × S / H)

    Donde:
    - D = Demanda anual
    - S = Costo de emisión por pedido ($)
    - H = Costo de mantenimiento unitario anual = costo_unitario × tasa_mantenimiento

    Args:
        demanda_anual: Demanda anual (unidades)
        costo_por_pedido: Costo administrativo por orden ($)
        costo_unitario: Precio unitario del material ($)
        tasa_mantenimiento: Tasa de mantenimiento anual (% sobre valor, ej: 0.20)
        cantidad_minima: Cantidad mínima de pedido (restricción)
        cantidad_maxima: Cantidad máxima de pedido (restricción, None = sin límite)
        multiplo_pedido: Múltiplo de compra (ej: cajas de 100)

    Returns:
        Tuple (cantidad_pedido_eoq, dict_costos) donde dict_costos contiene:
        - pedidos_anuales: Número de pedidos por año
        - costo_ordenar_anual: Costo total de ordenar anual ($)
        - costo_mantener_anual: Costo total de mantenimiento anual ($)
        - costo_total_anual: Costo total anual ($)
    """
    # Si no hay datos de costos, usar lote basado en cobertura (30 días)
    if costo_unitario <= 0 or costo_por_pedido <= 0:
        demanda_diaria = demanda_anual / 300
        eoq = demanda_diaria * 30  # Cobertura de 30 días
    else:
        costo_mantenimiento = costo_unitario * tasa_mantenimiento
        eoq = math.sqrt((2 * demanda_anual * costo_por_pedido) / costo_mantenimiento)

    # Aplicar restricción mínima
    if cantidad_minima and eoq < cantidad_minima:
        eoq = cantidad_minima

    # Aplicar restricción máxima
    if cantidad_maxima and eoq > cantidad_maxima:
        eoq = cantidad_maxima

    # Redondear a múltiplo
    eoq_redondeado = math.ceil(eoq / multiplo_pedido) * multiplo_pedido

    # Calcular costos con EOQ final
    pedidos_anuales = demanda_anual / eoq_redondeado if eoq_redondeado > 0 else 0
    costo_ordenar = pedidos_anuales * costo_por_pedido
    costo_mantener = (
        (eoq_redondeado / 2) * costo_unitario * tasa_mantenimiento
        if costo_unitario > 0
        else 0
    )
    costo_total = costo_ordenar + costo_mantener

    return (
        int(eoq_redondeado),
        {
            "pedidos_anuales": round(pedidos_anuales, 2),
            "costo_ordenar_anual": round(costo_ordenar, 2),
            "costo_mantener_anual": round(costo_mantener, 2),
            "costo_total_anual": round(costo_total, 2),
        },
    )


def calcular_parametros_mrp_completo(
    material_codigo: str,
    centro: str,
    almacen: str,
    demanda_anual: float,
    lead_time_dias: int = 30,
    desv_std_demanda_diaria: float = 0.0,
    desv_std_lead_time: float = 0.0,
    costo_unitario: float = 0.0,
    costo_por_pedido: float = 100.0,
    tasa_mantenimiento: float = 0.20,
    nivel_servicio: float = 0.95,
    dias_laborables_año: int = 300,
    cantidad_minima_pedido: int = 10,
    cantidad_maxima_pedido: int = None,
    multiplo_pedido: int = 1,
    categoria_abc: str = None,
    critico: bool = False,
) -> Dict[str, Any]:
    """
    Calcula TODOS los parámetros MRP para un material en una sola llamada.

    Realiza:
    1. Demanda diaria
    2. Stock de Seguridad (SS)
    3. Punto de Reorden (ROP)
    4. Cantidad Económica de Pedido (EOQ)
    5. Stock Máximo
    6. Coberturas
    7. Costos
    8. Overrides para materiales críticos

    Args:
        material_codigo: Código SAP del material
        centro: Centro de costo
        almacen: Almacén
        demanda_anual: Demanda estimada anual (unidades) - REQUERIDO
        lead_time_dias: Lead time promedio (días)
        desv_std_demanda_diaria: Desviación estándar demanda diaria
        desv_std_lead_time: Desviación estándar lead time
        costo_unitario: Precio unitario del material
        costo_por_pedido: Costo administrativo por orden
        tasa_mantenimiento: Tasa mantenimiento anual (% sobre valor)
        nivel_servicio: Nivel de servicio deseado
        dias_laborables_año: Días laborables al año
        cantidad_minima_pedido: Cantidad mínima de compra
        cantidad_maxima_pedido: Cantidad máxima de compra
        multiplo_pedido: Múltiplo de compra
        categoria_abc: Clasificación ABC (A/B/C)
        critico: Es material crítico (obliga nivel servicio 99%)

    Returns:
        Dict con todos los parámetros calculados listos para guardar en BD
    """
    # 1. Demanda diaria
    demanda_diaria = demanda_anual / dias_laborables_año if dias_laborables_año > 0 else 0

    # 2. Stock de Seguridad - aplicar lógica de crítico
    ss_nivel_servicio = 0.99 if critico else nivel_servicio
    stock_seguridad, factor_z = calcular_stock_seguridad(
        demanda_diaria=demanda_diaria,
        lead_time_dias=lead_time_dias,
        desv_std_demanda_diaria=desv_std_demanda_diaria,
        desv_std_lead_time=desv_std_lead_time,
        nivel_servicio=ss_nivel_servicio,
    )

    # 3. Punto de Reorden
    punto_reorden = calcular_punto_reorden_completo(
        demanda_diaria=demanda_diaria,
        lead_time_dias=lead_time_dias,
        stock_seguridad=stock_seguridad,
    )

    # 4. EOQ
    cantidad_pedido_eoq, costos = calcular_eoq_con_restricciones(
        demanda_anual=demanda_anual,
        costo_por_pedido=costo_por_pedido,
        costo_unitario=costo_unitario,
        tasa_mantenimiento=tasa_mantenimiento,
        cantidad_minima=cantidad_minima_pedido,
        cantidad_maxima=cantidad_maxima_pedido,
        multiplo_pedido=multiplo_pedido,
    )

    # 5. Stock Máximo
    stock_maximo = int(stock_seguridad + cantidad_pedido_eoq)

    # 6. Coberturas
    cobertura_ss_dias = (
        stock_seguridad / demanda_diaria if demanda_diaria > 0 else 0
    )
    cobertura_eoq_dias = (
        cantidad_pedido_eoq / demanda_diaria if demanda_diaria > 0 else 0
    )

    # Retornar diccionario con TODOS los campos
    return {
        "material_codigo": material_codigo,
        "centro": centro,
        "almacen": almacen,
        # Inputs
        "demanda_anual": demanda_anual,
        "lead_time_dias": lead_time_dias,
        "desv_std_demanda_diaria": desv_std_demanda_diaria,
        "desv_std_lead_time": desv_std_lead_time,
        "costo_unitario": costo_unitario,
        "costo_por_pedido": costo_por_pedido,
        "tasa_mantenimiento": tasa_mantenimiento,
        "nivel_servicio": nivel_servicio,
        "dias_laborables_año": dias_laborables_año,
        "cantidad_minima_pedido": cantidad_minima_pedido,
        "cantidad_maxima_pedido": cantidad_maxima_pedido,
        "multiplo_pedido": multiplo_pedido,
        "categoria_abc": categoria_abc,
        "critico": critico,
        # Outputs calculados
        "demanda_diaria": round(demanda_diaria, 2),
        "factor_z": round(factor_z, 3),
        "stock_seguridad": int(stock_seguridad),
        "punto_pedido": int(punto_reorden),
        "stock_maximo": stock_maximo,
        "cantidad_pedido_eoq": cantidad_pedido_eoq,
        "cobertura_ss_dias": round(cobertura_ss_dias, 2),
        "cobertura_eoq_dias": round(cobertura_eoq_dias, 2),
        "pedidos_anuales": costos.get("pedidos_anuales", 0),
        "costo_total_anual": costos.get("costo_total_anual", 0),
    }


def obtener_configuracion_global() -> Dict[str, Any]:
    """
    Obtiene configuración global MRP de la tabla mrp_configuracion.

    Returns:
        Dict con parámetros por defecto
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT parametro, valor_numerico, valor_texto FROM mrp_configuracion"
            )
            rows = cursor.fetchall()

            config = {}
            for row in rows:
                parametro = row[0]
                valor_numerico = row[1]
                valor_texto = row[2]

                # Usar valor numérico si existe, sino texto
                config[parametro] = valor_numerico if valor_numerico is not None else valor_texto

            logger.debug(f"[MRP] Loaded {len(config)} configuration parameters")
            return config

    except Exception as e:
        logger.error(f"Error obteniendo configuración global MRP: {e}", exc_info=True)
        # Retornar defaults si hay error
        return {
            "lead_time_default": 30,
            "costo_orden_default": 100.0,
            "tasa_mantenimiento_default": 0.20,
            "nivel_servicio_default": 0.95,
            "dias_laborables_default": 300,
            "cantidad_minima_default": 10,
        }


def guardar_parametros_mrp_bd(parametros: Dict[str, Any], usuario: str) -> Dict[str, Any]:
    """
    Guarda parámetros MRP calculados en BD y registra cambios en historial.

    Args:
        parametros: Dict con todos los parámetros a guardar
        usuario: ID del usuario que realiza la operación

    Returns:
        Dict con {"success": True/False, "message": ..., "error": ...}
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 1. Verificar si existe el material
            cursor.execute(
                """
                SELECT stock_de_seguridad, punto_de_pedido, stock_maximo
                FROM sap_materiales_bbdd
                WHERE codigo_material = %s AND centro = %s AND almacen = %s
            """,
                (parametros["material_codigo"], parametros["centro"], parametros["almacen"]),
            )

            existing = cursor.fetchone()
            valores_anteriores = (
                {
                    "stock_seguridad": existing[0],
                    "punto_pedido": existing[1],
                    "stock_maximo": existing[2],
                }
                if existing
                else {}
            )

            # 2. UPDATE si existe, INSERT si no
            if existing:
                cursor.execute(
                    """
                    UPDATE sap_materiales_bbdd
                    SET stock_de_seguridad = %s,
                        punto_de_pedido = %s,
                        stock_maximo = %s,
                        lead_time_dias = %s,
                        desv_std_demanda_diaria = %s,
                        desv_std_lead_time = %s,
                        costo_unitario = %s,
                        costo_por_pedido = %s,
                        tasa_mantenimiento = %s,
                        nivel_servicio = %s,
                        cantidad_minima_pedido = %s,
                        cantidad_maxima_pedido = %s,
                        multiplo_pedido = %s,
                        categoria_abc = %s,
                        critico = %s,
                        demanda_anual = %s,
                        demanda_diaria = %s,
                        factor_z = %s,
                        cantidad_pedido_eoq = %s,
                        cobertura_ss_dias = %s,
                        cobertura_eoq_dias = %s,
                        pedidos_anuales = %s,
                        costo_total_anual = %s,
                        parametros_calculados_at = CURRENT_TIMESTAMP,
                        parametros_calculados_por = %s,
                        ultima_actualizacion = CURRENT_TIMESTAMP
                    WHERE codigo_material = %s
                      AND centro = %s
                      AND almacen = %s
                """,
                    (
                        parametros["stock_seguridad"],
                        parametros["punto_pedido"],
                        parametros["stock_maximo"],
                        parametros["lead_time_dias"],
                        parametros["desv_std_demanda_diaria"],
                        parametros["desv_std_lead_time"],
                        parametros["costo_unitario"],
                        parametros["costo_por_pedido"],
                        parametros["tasa_mantenimiento"],
                        parametros["nivel_servicio"],
                        parametros["cantidad_minima_pedido"],
                        parametros["cantidad_maxima_pedido"],
                        parametros["multiplo_pedido"],
                        parametros["categoria_abc"],
                        parametros["critico"],
                        parametros["demanda_anual"],
                        parametros["demanda_diaria"],
                        parametros["factor_z"],
                        parametros["cantidad_pedido_eoq"],
                        parametros["cobertura_ss_dias"],
                        parametros["cobertura_eoq_dias"],
                        parametros["pedidos_anuales"],
                        parametros["costo_total_anual"],
                        usuario,
                        parametros["material_codigo"],
                        parametros["centro"],
                        parametros["almacen"],
                    ),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO sap_materiales_bbdd (
                        codigo_material, centro, almacen, sector, descripcion,
                        stock_de_seguridad, punto_de_pedido, stock_maximo,
                        lead_time_dias, desv_std_demanda_diaria, desv_std_lead_time,
                        costo_unitario, costo_por_pedido, tasa_mantenimiento, nivel_servicio,
                        cantidad_minima_pedido, cantidad_maxima_pedido, multiplo_pedido,
                        categoria_abc, critico, demanda_anual, demanda_diaria, factor_z,
                        cantidad_pedido_eoq, cobertura_ss_dias, cobertura_eoq_dias,
                        pedidos_anuales, costo_total_anual,
                        parametros_calculados_at, parametros_calculados_por
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        CURRENT_TIMESTAMP, %s
                    )
                """,
                    (
                        parametros["material_codigo"],
                        parametros["centro"],
                        parametros["almacen"],
                        "",
                        "",
                        parametros["stock_seguridad"],
                        parametros["punto_pedido"],
                        parametros["stock_maximo"],
                        parametros["lead_time_dias"],
                        parametros["desv_std_demanda_diaria"],
                        parametros["desv_std_lead_time"],
                        parametros["costo_unitario"],
                        parametros["costo_por_pedido"],
                        parametros["tasa_mantenimiento"],
                        parametros["nivel_servicio"],
                        parametros["cantidad_minima_pedido"],
                        parametros["cantidad_maxima_pedido"],
                        parametros["multiplo_pedido"],
                        parametros["categoria_abc"],
                        parametros["critico"],
                        parametros["demanda_anual"],
                        parametros["demanda_diaria"],
                        parametros["factor_z"],
                        parametros["cantidad_pedido_eoq"],
                        parametros["cobertura_ss_dias"],
                        parametros["cobertura_eoq_dias"],
                        parametros["pedidos_anuales"],
                        parametros["costo_total_anual"],
                        usuario,
                    ),
                )

            # 3. Registrar en historial de cambios (solo campos principales)
            for campo in ["stock_seguridad", "punto_pedido", "stock_maximo"]:
                valor_ant = valores_anteriores.get(campo)
                valor_nuevo = parametros.get(campo)
                if valor_ant != valor_nuevo and valor_ant is not None:
                    cursor.execute(
                        """
                        INSERT INTO mrp_historial_parametros (
                            material_codigo, centro, almacen, campo_modificado,
                            valor_anterior, valor_nuevo, modificado_por
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                        (
                            parametros["material_codigo"],
                            parametros["centro"],
                            parametros["almacen"],
                            campo,
                            str(valor_ant),
                            str(valor_nuevo),
                            usuario,
                        ),
                    )

            conn.commit()
            logger.info(
                f"[MRP] Parámetros guardados: {parametros['material_codigo']} "
                f"({parametros['centro']}/{parametros['almacen']}) por {usuario}"
            )
            return {"success": True, "message": "Parámetros guardados correctamente"}

    except Exception as e:
        logger.error(f"Error guardando parámetros MRP: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
