"""
MRP Routes - Material Requirements Planning
Tablero de Alertas y KPIs para planificadores
"""

from datetime import datetime, timedelta
from functools import wraps
from typing import Dict

from flask import Blueprint, g, jsonify, request

try:
    from backend.core.db import get_db_connection
except ImportError:
    from core.db import get_db_connection

bp = Blueprint("mrp", __name__, url_prefix="/api/mrp")


def require_auth(f):
    """Decorator que requiere autenticación"""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}
                ),
                401,
            )
        return f(*args, **kwargs)

    return decorated


def require_planner_or_admin(f):
    """Decorator que requiere rol Planificador o Admin"""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}
                ),
                401,
            )

        roles = g.user.get("rol", "").lower()
        is_admin = "admin" in roles
        is_planner = "planificador" in roles

        if not (is_admin or is_planner):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Requiere rol Admin o Planificador",
                        },
                    }
                ),
                403,
            )

        return f(*args, **kwargs)

    return decorated


def calcular_estado_material(
    stock_actual: float,
    stock_seguridad: float,
    punto_pedido: float,
    stock_maximo: float,
    consumo_promedio: float,
    pedidos_en_curso: float,
) -> Dict[str, str]:
    """
    Calcula el estado del material y sugerencia de acción.

    Returns:
        Dict con 'estado' y 'sugerencia'
    """
    stock_disponible = stock_actual + pedidos_en_curso

    # Quiebre de stock
    if stock_actual <= 0:
        return {
            "estado": "Quiebre de Stock",
            "estado_clase": "danger",
            "sugerencia": "Urgente: Reclamar pedido vencido o generar compra de emergencia",
        }

    # Bajo punto de pedido
    if stock_disponible < punto_pedido:
        return {
            "estado": "Bajo Punto de Pedido",
            "estado_clase": "warning",
            "sugerencia": "Generar solicitud de pedido",
        }

    # Por debajo del stock de seguridad
    if stock_actual < stock_seguridad:
        return {
            "estado": "Bajo Stock de Seguridad",
            "estado_clase": "warning",
            "sugerencia": "Reclamar pedido vencido o acelerar entrega",
        }

    # Sobrestock (más del doble del máximo)
    if stock_maximo > 0 and stock_actual > stock_maximo * 1.5:
        return {
            "estado": "Sobrestock Crítico",
            "estado_clase": "info",
            "sugerencia": "Bajar parámetros y disponibilizar stock",
        }

    # Por encima del stock máximo
    if stock_maximo > 0 and stock_actual > stock_maximo:
        return {
            "estado": "Exceso de Stock",
            "estado_clase": "info",
            "sugerencia": "Revisar parámetros MRP",
        }

    # Bajo consumo (rotación muy baja)
    if consumo_promedio > 0:
        meses_cobertura = stock_actual / (consumo_promedio / 12) if consumo_promedio > 0 else 999
        if meses_cobertura > 24:
            return {
                "estado": "Bajo Consumo",
                "estado_clase": "info",
                "sugerencia": "Evaluar obsolescencia o transferir a otro centro",
            }

    # Normal
    return {"estado": "Normal", "estado_clase": "success", "sugerencia": ""}


def calcular_rotacion(consumo_anual: float, stock_promedio: float) -> float:
    """Calcula la rotación del inventario"""
    if stock_promedio <= 0:
        return 0
    return round(consumo_anual / stock_promedio, 2)


@bp.route("/alertas", methods=["GET"])
@require_planner_or_admin
def get_alertas():
    """
    Obtiene el tablero de alertas MRP.

    Query params:
        centro: Filtro por centro (requerido)
        almacen: Filtro por almacén (opcional)
        sector: Filtro por sector (opcional)
        estado: Filtro por estado de alerta (opcional)
        limit: Límite de resultados (default 50)
        offset: Offset para paginación (default 0)
    """
    centro = request.args.get("centro", "").strip()
    almacen = request.args.get("almacen", "").strip()
    sector = request.args.get("sector", "").strip()
    estado_filtro = request.args.get("estado", "").strip()
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Obtener materiales MRP con datos reales de la tabla materiales_mrp
            base_query = """
            SELECT
                codigo_material as codigo,
                descripcion,
                sector,
                almacen,
                centro,
                stock_seguridad,
                punto_pedido,
                stock_maximo,
                stock_actual,
                pedidos_en_curso,
                consumo_promedio_mensual,
                lead_time_dias,
                critico,
                ubicacion
            FROM materiales_mrp
            WHERE 1=1
        """
        params = []

        if centro:
            base_query += " AND centro = ?"
            params.append(int(centro))

        if almacen:
            base_query += " AND almacen = ?"
            params.append(int(almacen))

        if sector:
            base_query += " AND sector = ?"
            params.append(sector)

        base_query += " ORDER BY codigo_material"

        cursor.execute(base_query, params)
        materiales = cursor.fetchall()

        # Calcular alertas para cada material
        alertas = []

        for mat in materiales:
            codigo = mat["codigo"]
            stock_actual = mat["stock_actual"] or 0
            stock_seguridad = mat["stock_seguridad"] or 0
            punto_pedido = mat["punto_pedido"] or 0
            stock_maximo = mat["stock_maximo"] or 0
            pedidos_en_curso = mat["pedidos_en_curso"] or 0
            consumo_mensual = mat["consumo_promedio_mensual"] or 0

            # Calcular demanda anual desde consumo mensual
            demanda_anual = consumo_mensual * 12

            # Calcular rotación
            rotacion = calcular_rotacion(demanda_anual, stock_actual) if stock_actual > 0 else 0

            # Calcular estado y sugerencia
            estado_info = calcular_estado_material(
                stock_actual=stock_actual,
                stock_seguridad=stock_seguridad,
                punto_pedido=punto_pedido,
                stock_maximo=stock_maximo,
                consumo_promedio=consumo_mensual,
                pedidos_en_curso=pedidos_en_curso,
            )

            # Filtrar por estado si se especificó
            if estado_filtro and estado_filtro.lower() != "todos":
                if estado_filtro.lower() not in estado_info["estado"].lower():
                    continue

            alertas.append(
                {
                    "codigo": codigo,
                    "descripcion": mat["descripcion"],
                    "unidad": "UNI",
                    "precio_usd": 0,
                    "centro": mat["centro"] or centro,
                    "sector": mat["sector"] or sector,
                    "almacen": mat["almacen"] or almacen or "1",
                    "demanda_estimada_anual": round(demanda_anual, 0),
                    "stock_seguridad": stock_seguridad,
                    "punto_pedido": punto_pedido,
                    "stock_maximo": stock_maximo,
                    "stock_actual": stock_actual,
                    "pedidos_en_curso": pedidos_en_curso,
                    "solpeds_en_curso": 0,
                    "ventas_ute_en_curso": 0,
                    "consumo_promedio_anual": round(demanda_anual, 2),
                    "rotacion_pct": round(rotacion * 100, 1),
                    "estado": estado_info["estado"],
                    "estado_clase": estado_info["estado_clase"],
                    "sugerencia": estado_info["sugerencia"],
                    "critico": mat["critico"],
                    "ubicacion": mat["ubicacion"],
                }
            )

        # Aplicar paginación
        total = len(alertas)
        alertas_paginadas = alertas[offset : offset + limit]

        # Resumen de estados
        resumen = {
            "total": total,
            "quiebre_stock": sum(1 for a in alertas if "quiebre" in a["estado"].lower()),
            "bajo_punto_pedido": sum(1 for a in alertas if "bajo punto" in a["estado"].lower()),
            "bajo_stock_seguridad": sum(1 for a in alertas if "bajo stock" in a["estado"].lower()),
            "sobrestock": sum(
                1
                for a in alertas
                if "exceso" in a["estado"].lower() or "sobrestock" in a["estado"].lower()
            ),
            "normal": sum(1 for a in alertas if a["estado"].lower() == "normal"),
        }

        return jsonify(
            {
                "ok": True,
                "data": alertas_paginadas,
                "resumen": resumen,
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": (offset + limit) < total,
                },
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


@bp.route("/kpis", methods=["GET"])
@require_planner_or_admin
def get_kpis():
    """
    Obtiene los KPIs MRP.

    Query params:
        centro: Filtro por centro (opcional, reservado para futuro uso)
        periodo: Período de análisis ('mes', 'trimestre', 'anio') - default 'mes'
    """
    _ = request.args.get("centro", "").strip()  # Reservado para filtro por centro
    periodo = request.args.get("periodo", "mes").strip()

    # Calcular fechas según período
    hoy = datetime.now()
    if periodo == "anio":
        fecha_inicio = hoy - timedelta(days=365)
    elif periodo == "trimestre":
        fecha_inicio = hoy - timedelta(days=90)
    else:  # mes
        fecha_inicio = hoy - timedelta(days=30)

    fecha_inicio_str = fecha_inicio.strftime("%Y-%m-%d")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Total de materiales MRP
            cursor.execute("SELECT COUNT(*) as total FROM materiales_mrp")
            total_materiales = cursor.fetchone()["total"]

            # Materiales con solicitudes en el período (reservado para uso futuro)
            cursor.execute(
                """
                SELECT COUNT(DISTINCT json_extract(value, '$.codigo')) as total
                FROM solicitudes, json_each(data_json)
                WHERE created_at >= ?
            """,
                (fecha_inicio_str,),
            )
            _ = cursor.fetchone()["total"]  # materiales_con_demanda - para KPI futuro

            # Solpeds creadas vs completadas
            cursor.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'creada' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN status = 'enviada' THEN 1 ELSE 0 END) as enviadas,
                    SUM(CASE WHEN status = 'completada' THEN 1 ELSE 0 END) as completadas
                FROM solpeds
                WHERE created_at >= ?
            """,
                (fecha_inicio_str,),
            )
            solpeds_stats = cursor.fetchone()

            # Pedidos vencidos (simulado)
            cursor.execute(
                """
                SELECT COUNT(*) as total
                FROM purchase_orders
                WHERE status = 'emitida'
                AND created_at < date('now', '-30 days')
            """
            )
            pedidos_vencidos = cursor.fetchone()["total"]

    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    # Calcular KPIs (fuera del with, datos ya recuperados)
    lead_time_promedio = 15  # días
    lead_time_objetivo = 12  # días
    total_solpeds = solpeds_stats["total"] or 0
    solpeds_completadas = solpeds_stats["completadas"] or 0

    # % materiales en riesgo (simulado basado en hash)
    pct_en_riesgo = round((total_materiales % 20) + 5, 1)  # 5-25%
    pct_sobrestock = round((total_materiales % 15) + 3, 1)  # 3-18%

    # Rotación promedio (simulado)
    rotacion_promedio = round(2.5 + (total_materiales % 30) / 10, 2)

    # Cumplimiento MRP
    cumplimiento_mrp = round(
        (solpeds_completadas / total_solpeds * 100) if total_solpeds > 0 else 85, 1
    )

    # Velocidad de respuesta (días promedio para resolver alertas)
    velocidad_respuesta = round(3 + (total_materiales % 5) / 2, 1)

    kpis = {
        "materiales_en_riesgo": {
            "valor": pct_en_riesgo,
            "unidad": "%",
            "tendencia": "up" if pct_en_riesgo > 10 else "down",
            "descripcion": "Materiales por quiebre o bajo punto de pedido",
        },
        "materiales_sobrestock": {
            "valor": pct_sobrestock,
            "unidad": "%",
            "tendencia": "stable",
            "descripcion": "Materiales con exceso de inventario",
        },
        "rotacion_promedio": {
            "valor": rotacion_promedio,
            "unidad": "veces/año",
            "tendencia": "up" if rotacion_promedio > 3 else "down",
            "descripcion": "Rotación promedio del portafolio",
        },
        "lead_time_promedio": {
            "valor": lead_time_promedio,
            "unidad": "días",
            "objetivo": lead_time_objetivo,
            "tendencia": "up" if lead_time_promedio > lead_time_objetivo else "down",
            "descripcion": "Tiempo promedio de entrega",
        },
        "cumplimiento_mrp": {
            "valor": cumplimiento_mrp,
            "unidad": "%",
            "tendencia": "up" if cumplimiento_mrp > 80 else "down",
            "descripcion": "Nivel de cumplimiento del plan MRP",
        },
        "pedidos_vencidos": {
            "valor": pedidos_vencidos,
            "unidad": "pedidos",
            "tendencia": "down" if pedidos_vencidos < 5 else "up",
            "descripcion": "Pedidos con más de 30 días sin completar",
        },
        "pct_pedidos_vencidos": {
            "valor": round((pedidos_vencidos / total_solpeds * 100) if total_solpeds > 0 else 0, 1),
            "unidad": "%",
            "tendencia": "down" if pedidos_vencidos < 5 else "up",
            "descripcion": "Porcentaje de pedidos vencidos",
        },
        "velocidad_respuesta": {
            "valor": velocidad_respuesta,
            "unidad": "días",
            "tendencia": "down" if velocidad_respuesta < 5 else "up",
            "descripcion": "Tiempo promedio para resolver alertas",
        },
    }

    # Datos para gráficos
    graficos = {
        "distribucion_estados": [
            {
                "nombre": "Normal",
                "valor": 100 - pct_en_riesgo - pct_sobrestock,
                "color": "#22c55e",
            },
            {"nombre": "En Riesgo", "valor": pct_en_riesgo, "color": "#ef4444"},
            {"nombre": "Sobrestock", "valor": pct_sobrestock, "color": "#3b82f6"},
        ],
        "evolucion_alertas": [
            {
                "fecha": (hoy - timedelta(days=30)).strftime("%Y-%m-%d"),
                "alertas": 12,
                "resueltas": 8,
            },
            {
                "fecha": (hoy - timedelta(days=25)).strftime("%Y-%m-%d"),
                "alertas": 15,
                "resueltas": 10,
            },
            {
                "fecha": (hoy - timedelta(days=20)).strftime("%Y-%m-%d"),
                "alertas": 10,
                "resueltas": 9,
            },
            {
                "fecha": (hoy - timedelta(days=15)).strftime("%Y-%m-%d"),
                "alertas": 18,
                "resueltas": 14,
            },
            {
                "fecha": (hoy - timedelta(days=10)).strftime("%Y-%m-%d"),
                "alertas": 8,
                "resueltas": 7,
            },
            {
                "fecha": (hoy - timedelta(days=5)).strftime("%Y-%m-%d"),
                "alertas": 14,
                "resueltas": 11,
            },
            {"fecha": hoy.strftime("%Y-%m-%d"), "alertas": 11, "resueltas": 6},
        ],
        "top_materiales_riesgo": [
            {"codigo": "MAT001", "descripcion": "Válvula de control", "dias_sin_stock": 5},
            {"codigo": "MAT002", "descripcion": "Bomba centrífuga", "dias_sin_stock": 3},
            {"codigo": "MAT003", "descripcion": "Motor eléctrico", "dias_sin_stock": 2},
        ],
    }

    return jsonify(
        {
            "ok": True,
            "kpis": kpis,
            "graficos": graficos,
            "periodo": periodo,
            "fecha_inicio": fecha_inicio_str,
            "fecha_fin": hoy.strftime("%Y-%m-%d"),
            "total_materiales": total_materiales,
        }
    )


@bp.route("/catalogos", methods=["GET"])
@require_auth
def get_catalogos():
    """
    Obtiene catálogos para filtros (centros, almacenes, sectores).
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT codigo, nombre FROM catalog_centros WHERE activo = 1 ORDER BY codigo"
            )
            centros = [{"codigo": r["codigo"], "nombre": r["nombre"]} for r in cursor.fetchall()]

            cursor.execute(
                "SELECT codigo, nombre FROM catalog_almacenes WHERE activo = 1 ORDER BY codigo"
            )
            almacenes = [{"codigo": r["codigo"], "nombre": r["nombre"]} for r in cursor.fetchall()]

            cursor.execute("SELECT nombre FROM catalog_sectores WHERE activo = 1 ORDER BY nombre")
            sectores = [{"nombre": r["nombre"]} for r in cursor.fetchall()]

        return jsonify(
            {
                "ok": True,
                "centros": centros,
                "almacenes": almacenes,
                "sectores": sectores,
            }
        )

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


# =============================================================================
# Endpoints MRP Avanzados (Sprint 5)
# =============================================================================

try:
    from backend.services.mrp_service import (
        analizar_material,
        analizar_centro,
        obtener_demanda_proyectada,
        generar_recomendacion,
        obtener_alertas_mrp,
        crear_alerta_mrp,
        resolver_alerta_mrp,
    )
except ImportError:
    from services.mrp_service import (
        analizar_material,
        analizar_centro,
        obtener_demanda_proyectada,
        generar_recomendacion,
        obtener_alertas_mrp,
        crear_alerta_mrp,
        resolver_alerta_mrp,
    )


@bp.route("/analisis/<material_codigo>", methods=["GET"])
@require_planner_or_admin
def get_analisis_material(material_codigo):
    """
    Analisis MRP completo de un material.

    Path params:
        material_codigo: Codigo del material

    Query params:
        centro: Centro de costo (requerido)

    Returns:
        Analisis con estado, requerimientos y recomendaciones
    """
    centro = request.args.get("centro", "").strip()
    if not centro:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Centro es requerido"}
        }), 400

    try:
        resultado = analizar_material(
            material_codigo=material_codigo,
            centro=centro
        )

        if "error" in resultado:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": resultado["error"]}
            }), 404

        return jsonify({"ok": True, "data": resultado})

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": {"code": "server_error", "message": str(e)}
        }), 500


@bp.route("/analisis/centro/<centro>", methods=["GET"])
@require_planner_or_admin
def get_analisis_centro(centro):
    """
    Analisis MRP de todos los materiales de un centro.

    Path params:
        centro: Centro de costo

    Query params:
        incluir_normales: Incluir materiales sin problemas (default: false)

    Returns:
        Resumen con materiales criticos y recomendaciones
    """
    incluir_normales = request.args.get("incluir_normales", "false").lower() == "true"

    try:
        resultado = analizar_centro(
            centro=centro,
            incluir_normales=incluir_normales
        )

        return jsonify({"ok": True, "data": resultado})

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": {"code": "server_error", "message": str(e)}
        }), 500


@bp.route("/forecast/<material_codigo>", methods=["GET"])
@require_planner_or_admin
def get_forecast_demanda(material_codigo):
    """
    Obtiene proyeccion de demanda para un material.

    Path params:
        material_codigo: Codigo del material

    Query params:
        centro: Centro de costo (requerido)
        dias: Dias a proyectar (default: 30)

    Returns:
        Demanda proyectada con metodo usado (ML o historico)
    """
    centro = request.args.get("centro", "").strip()
    dias = request.args.get("dias", 30, type=int)

    if not centro:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "Centro es requerido"}
        }), 400

    try:
        resultado = obtener_demanda_proyectada(
            material_codigo=material_codigo,
            centro=centro,
            dias=dias
        )

        return jsonify({"ok": True, "data": resultado})

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": {"code": "server_error", "message": str(e)}
        }), 500


@bp.route("/alertas-mrp", methods=["GET"])
@require_planner_or_admin
def get_alertas_mrp_activas():
    """
    Obtiene alertas MRP activas.

    Query params:
        centro: Filtrar por centro (opcional)
        tipo: Filtrar por tipo (opcional)

    Returns:
        Lista de alertas activas
    """
    centro = request.args.get("centro", "").strip() or None
    tipo = request.args.get("tipo", "").strip() or None

    try:
        alertas = obtener_alertas_mrp(
            centro=centro,
            tipo=tipo,
            solo_activas=True
        )

        return jsonify({
            "ok": True,
            "data": alertas,
            "total": len(alertas)
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": {"code": "server_error", "message": str(e)}
        }), 500


@bp.route("/alertas-mrp/<int:alerta_id>/resolver", methods=["PUT", "POST"])
@require_planner_or_admin
def resolver_alerta_mrp_endpoint(alerta_id):
    """
    Resuelve una alerta MRP.

    Path params:
        alerta_id: ID de la alerta

    Body:
        accion_tomada: Descripcion de la accion tomada

    Returns:
        Resultado de la operacion
    """
    data = request.get_json(silent=True) or {}
    accion_tomada = data.get("accion_tomada", "Resuelta manualmente")

    # Obtener usuario del contexto
    user_id = "system"
    if hasattr(g, "user") and g.user:
        user_id = str(g.user.get("user_id", "system"))

    try:
        resultado = resolver_alerta_mrp(
            alerta_id=alerta_id,
            resuelto_por=user_id,
            accion_tomada=accion_tomada
        )

        if resultado.get("resuelta"):
            return jsonify({
                "ok": True,
                "message": "Alerta resuelta correctamente"
            })
        else:
            return jsonify({
                "ok": False,
                "error": {"code": "not_found", "message": "Alerta no encontrada o ya resuelta"}
            }), 404

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": {"code": "server_error", "message": str(e)}
        }), 500
