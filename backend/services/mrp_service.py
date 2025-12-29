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
try:
    from backend.agent.pipelines.demand_forecast import DemandForecastPipeline
except ImportError:
    DemandForecastPipeline = None


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
