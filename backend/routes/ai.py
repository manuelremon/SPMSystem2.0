"""
Endpoints API para recomendaciones inteligentes de IA.
Sprint 6.3 - Expone funcionalidades del servicio unificado de IA.

Soporta modo temporal con datos importados desde Excel.

Endpoints:
- GET  /api/ai/status              - Estado de los pipelines ML
- POST /api/ai/train               - Entrenar modelos ML
- GET  /api/ai/solicitudes/priorizar - Priorizar solicitudes
- GET  /api/ai/materiales/similares  - Materiales similares
- GET  /api/ai/materiales/forecast   - Proyeccion de demanda
- GET  /api/ai/materiales/analisis   - Analisis completo
- POST /api/ai/sugerir-accion        - Sugerir accion para solicitud
- GET  /api/ai/alertas               - Alertas inteligentes
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role
from backend.core.search_utils import build_description_search, expand_codes_from_catalog
from backend.services.ai_service import AIService, get_ai_service
from backend.services.temp_data_service import temp_data_service


logger = logging.getLogger(__name__)

bp = Blueprint("ai", __name__, url_prefix="/api/ai")


@bp.route("/status", methods=["GET"])
@require_auth
@rate_limit(requests=20, window_seconds=60)
def get_status():
    """
    Obtiene estado de los pipelines ML.

    Returns:
        Estado de cada pipeline y del servicio
    """
    try:
        service = get_ai_service()
        status = service.get_status()

        return jsonify({"ok": True, "data": status})

    except Exception as e:
        logger.error(f"Error obteniendo status IA: {e}")
        return jsonify({"ok": False, "error": {"code": "ai_status_error", "message": str(e)}}), 500


@bp.route("/train", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
@rate_limit(requests=2, window_seconds=60)
def train_models():
    """
    Entrena modelos ML con datos historicos.

    Body (opcional):
        {
            "force": true  // Forzar reentrenamiento
        }

    Returns:
        Resultado del entrenamiento
    """
    from backend.core.db import get_db_connection, is_using_postgresql, sql_now_minus

    try:
        service = get_ai_service()

        # Obtener datos de la BD
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Solicitudes historicas
            cursor.execute(
                f"""
                SELECT id, created_at, material_codigo, centro, sector,
                       criticidad, total_monto, data_json
                FROM solicitud
                WHERE created_at > {sql_now_minus("90 days")}
            """
            )
            solicitudes = [dict(row) for row in cursor.fetchall()]

            # Materiales
            cursor.execute(
                """
                SELECT codigo, descripcion, precio_usd, unidad, activo
                FROM catalogo_materiales
                WHERE activo = 1
            """
            )
            materiales = [dict(row) for row in cursor.fetchall()]

        # Entrenar
        result = service.train_pipelines(solicitudes, materiales)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error entrenando modelos: {e}")
        return jsonify({"ok": False, "error": {"code": "train_error", "message": str(e)}}), 500


@bp.route("/solicitudes/priorizar", methods=["GET"])
@require_auth
def priorizar_solicitudes():
    """
    Prioriza solicitudes pendientes.

    Query params:
        - status: Filtrar por status (default: submitted)
        - centro: Filtrar por centro
        - limit: Limite de resultados (default: 20)

    Returns:
        Solicitudes rankeadas por prioridad
    """
    from backend.core.db import get_db_connection, is_using_postgresql

    # Accept both 'status' and 'estado' for backwards compatibility with frontend
    status = request.args.get("status") or request.args.get("estado", "submitted")
    centro = request.args.get("centro")
    limit = int(request.args.get("limit", 20))

    try:
        service = get_ai_service()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, criticidad, fecha_necesidad, total_monto, data_json,
                       status, centro, sector, created_at
                FROM solicitud
                WHERE status = ?
            """
            params = [status]

            if centro:
                query += " AND centro = ?"
                params.append(centro)

            query += " LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            solicitudes = [dict(row) for row in cursor.fetchall()]

        result = service.priorizar_solicitudes(solicitudes)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error priorizando solicitudes: {e}")
        return jsonify({"ok": False, "error": {"code": "prioritize_error", "message": str(e)}}), 500


@bp.route("/materiales/similares/<material_codigo>", methods=["GET"])
@require_auth
def materiales_similares(material_codigo):
    """
    Encuentra materiales similares a uno dado.

    Path params:
        - material_codigo: Codigo del material de referencia

    Query params:
        - centro: Centro de costo
        - max: Maximo de resultados (default: 5)

    Returns:
        Lista de materiales similares
    """
    centro = request.args.get("centro", "1000")
    max_resultados = int(request.args.get("max", 5))

    try:
        service = get_ai_service()
        result = service.recomendar_materiales_similares(
            material_codigo=material_codigo, centro=centro, max_resultados=max_resultados
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error buscando similares: {e}")
        return jsonify({"ok": False, "error": {"code": "similares_error", "message": str(e)}}), 500


@bp.route("/materiales/buscar-consumo", methods=["GET"])
@require_auth
def buscar_materiales_consumo():
    """
    Busca materiales que tienen historial de consumo en sap_data.db.

    Query params:
        q: Texto de búsqueda (código o descripción, mínimo 2 caracteres)
        limit: Máximo de resultados (default 20, max 100)

    Returns:
        Lista de materiales con: codigo, descripcion
    """
    from backend.core.db import get_db_connection, is_using_postgresql

    q = (request.args.get("q") or "").strip()
    limit = min(int(request.args.get("limit", 20)), 100)

    if len(q) < 2:
        return jsonify({"ok": True, "data": []})

    try:
        # Build search for consumo_historico columns
        search_ch = build_description_search(q, ["material", "descripcion"], require_all_words=False)
        # Expand search via catalogo_materiales.descripcion_larga
        catalog_codes = expand_codes_from_catalog(q)

        if not search_ch and not catalog_codes:
            return jsonify({"ok": True, "data": []})

        # Build WHERE for consumo_historico
        ch_parts = []
        ch_params = []
        if search_ch:
            ch_parts.append(search_ch.where_clause)
            ch_params.extend(search_ch.params)
        if catalog_codes:
            placeholders = ", ".join("?" for _ in catalog_codes)
            ch_parts.append(f"material IN ({placeholders})")
            ch_params.extend(catalog_codes)
        ch_where = " OR ".join(ch_parts)
        if len(ch_parts) > 1:
            ch_where = f"({ch_where})"

        # Build search for materiales_bbdd columns (with table alias)
        search_m = build_description_search(q, ["m.codigo_material", "m.descripcion"], require_all_words=False)
        # Build WHERE for materiales_bbdd
        m_parts = []
        m_params = []
        if search_m:
            m_parts.append(search_m.where_clause)
            m_params.extend(search_m.params)
        if catalog_codes:
            placeholders = ", ".join("?" for _ in catalog_codes)
            m_parts.append(f"m.codigo_material IN ({placeholders})")
            m_params.extend(catalog_codes)
        m_where = " OR ".join(m_parts)
        if len(m_parts) > 1:
            m_where = f"({m_where})"

        # Build search for LEFT JOIN condition (consumo_historico alias c)
        search_c = build_description_search(q, ["c.material", "c.descripcion"], require_all_words=False)
        c_parts = []
        c_params = []
        if search_c:
            c_parts.append(search_c.where_clause)
            c_params.extend(search_c.params)
        if catalog_codes:
            placeholders = ", ".join("?" for _ in catalog_codes)
            c_parts.append(f"c.material IN ({placeholders})")
            c_params.extend(catalog_codes)
        c_where = " OR ".join(c_parts)
        if len(c_parts) > 1:
            c_where = f"({c_where})"

        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            # Search in both consumo_historico and materiales_bbdd,
            # prioritizing materials that have consumption data
            all_params = ch_params + c_params + m_params + [limit]
            cur.execute(f"""
                SELECT codigo, descripcion, has_consumo FROM (
                    SELECT DISTINCT material AS codigo, descripcion, 1 AS has_consumo
                    FROM consumo_historico
                    WHERE {ch_where}

                    UNION ALL

                    SELECT DISTINCT m.codigo_material AS codigo, m.descripcion, 0 AS has_consumo
                    FROM materiales_bbdd m
                    LEFT JOIN consumo_historico c
                        ON m.codigo_material = c.material
                        AND ({c_where})
                    WHERE ({m_where})
                    AND c.material IS NULL
                )
                ORDER BY has_consumo DESC, codigo
                LIMIT ?
            """, all_params)
            rows = cur.fetchall()
            data = [{"codigo": r[0], "descripcion": r[1], "has_consumo": bool(r[2])} for r in rows]

        return jsonify({"ok": True, "data": data, "total": len(data)})
    except Exception as e:
        logger.error(f"Error buscando materiales con consumo: {e}")
        return jsonify({"ok": False, "error": {"code": "search_error", "message": str(e)}}), 500


@bp.route("/materiales/forecast/<material_codigo>", methods=["GET"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def forecast_demanda(material_codigo):
    """
    Proyecta demanda futura para un material.
    Soporta modo temporal con datos importados desde Excel.

    Path params:
        - material_codigo: Codigo del material

    Query params:
        - centro: Centro de costo (opcional)
        - almacen: Almacen (opcional)
        - dias: Dias a proyectar (default: 30)
        - modelo: Tipo de modelo ML (default: random_forest)
                  Opciones: random_forest, gradient_boosting, linear, xgboost, prophet, arima

    Returns:
        Proyeccion con intervalo de confianza
    """
    # Soportar centro/almacen como multiselect (getlist) o string individual
    centro = request.args.getlist("centro") or request.args.get("centro", "")
    almacen = request.args.getlist("almacen") or request.args.get("almacen", "")
    # Si viene como lista de un solo elemento, convertir a string
    if isinstance(centro, list) and len(centro) == 1:
        centro = centro[0]
    if isinstance(almacen, list) and len(almacen) == 1:
        almacen = almacen[0]
    dias = int(request.args.get("dias", 30))
    modelo = request.args.get("modelo", "random_forest")
    meses_historico = int(request.args.get("meses_historico", 0))  # 0 = todo el histórico

    # Verificar si modo temporal está activo
    user_id = _get_user_id()
    if user_id and temp_data_service.is_active(user_id):
        return _forecast_from_temp_data(user_id, material_codigo, centro, dias, modelo)

    try:
        service = get_ai_service()
        result = service.proyectar_demanda(
            material_codigo=material_codigo, centro=centro, dias=dias,
            modelo_tipo=modelo, almacen=almacen, meses_historico=meses_historico
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error proyectando demanda: {e}")
        return jsonify({"ok": False, "error": {"code": "forecast_error", "message": str(e)}}), 500


def _forecast_from_temp_data(user_id: str, material_codigo: str, centro: str, dias: int, modelo: str):
    """
    Genera forecast desde datos temporales importados.
    Usa promedio móvil simple cuando los datos son insuficientes para ML.
    """
    import pandas as pd
    from datetime import datetime, timedelta

    try:
        # Obtener consumo histórico de datos temporales
        consumo_data = temp_data_service.get_consumo_historico(
            user_id=user_id,
            material=material_codigo,
            centro=centro if centro else None
        )

        if not consumo_data:
            # Sin datos históricos, usar stock actual como referencia
            stock_info = temp_data_service.get_stock_by_material(user_id, material_codigo)
            if stock_info:
                # Estimación muy básica: asumir consumo del 10% del stock por mes
                consumo_mensual_est = float(stock_info.get("stock", 0)) * 0.1
                demanda_proyectada = (consumo_mensual_est / 30) * dias
            else:
                demanda_proyectada = 0

            return jsonify({
                "ok": True,
                "data": {
                    "material_codigo": material_codigo,
                    "centro": centro,
                    "dias": dias,
                    "demanda_proyectada": round(demanda_proyectada, 2),
                    "metodo": "estimacion_basica",
                    "confianza": 0.3,
                    "intervalo_inferior": 0,
                    "intervalo_superior": round(demanda_proyectada * 2, 2),
                    "advertencia": "Sin datos históricos - estimación muy básica",
                    "_temp_mode": True
                }
            })

        # Convertir a DataFrame para análisis
        df = pd.DataFrame(consumo_data)
        df["fecha"] = pd.to_datetime(df["fecha"])
        df = df.sort_values("fecha")

        # Calcular consumo diario promedio
        total_consumo = df["cantidad"].sum()
        dias_datos = max((df["fecha"].max() - df["fecha"].min()).days, 1)
        consumo_diario = total_consumo / dias_datos

        # Proyección simple usando promedio móvil
        demanda_proyectada = consumo_diario * dias

        # Calcular variabilidad para intervalo de confianza
        consumo_mensual = df.groupby(df["fecha"].dt.to_period("M"))["cantidad"].sum()

        if len(consumo_mensual) > 1:
            std_mensual = consumo_mensual.std()
            mean_mensual = consumo_mensual.mean()
            cv = std_mensual / mean_mensual if mean_mensual > 0 else 0.5

            # Intervalo de confianza (95%)
            intervalo = demanda_proyectada * cv * 1.96
            confianza = max(0.5, 1 - cv)
        else:
            intervalo = demanda_proyectada * 0.5
            confianza = 0.5

        # Generar serie temporal de predicciones
        hoy = datetime.now()
        predicciones = []
        for i in range(1, min(dias + 1, 31)):  # Limitar a 30 días para visualización
            fecha_pred = (hoy + timedelta(days=i)).strftime("%Y-%m-%d")
            predicciones.append({
                "fecha": fecha_pred,
                "cantidad_predicha": round(consumo_diario, 2),
                "intervalo_inferior": round(max(0, consumo_diario - (intervalo / dias)), 2),
                "intervalo_superior": round(consumo_diario + (intervalo / dias), 2)
            })

        return jsonify({
            "ok": True,
            "data": {
                "material_codigo": material_codigo,
                "centro": centro,
                "dias": dias,
                "demanda_proyectada": round(demanda_proyectada, 2),
                "intervalo_inferior": round(max(0, demanda_proyectada - intervalo), 2),
                "intervalo_superior": round(demanda_proyectada + intervalo, 2),
                "metodo": "promedio_movil",
                "modelo_solicitado": modelo,
                "confianza": round(confianza, 2),
                "consumo_diario_promedio": round(consumo_diario, 2),
                "datos_historicos": len(df),
                "periodo_historico_dias": dias_datos,
                "predicciones": predicciones,
                "_temp_mode": True,
                "_temp_message": "Forecast calculado desde datos temporales importados"
            }
        })

    except Exception as e:
        logger.error(f"Error en forecast temporal: {e}")
        return jsonify({"ok": False, "error": {"code": "temp_forecast_error", "message": str(e)}}), 500


@bp.route("/materiales/analisis/<material_codigo>", methods=["GET"])
@require_auth
def analisis_material(material_codigo):
    """
    Analisis completo de un material integrando MRP y ML.

    Path params:
        - material_codigo: Codigo del material

    Query params:
        - centro: Centro de costo

    Returns:
        Analisis completo con stock status y recomendaciones IA
    """
    centro = request.args.get("centro", "1000")

    try:
        service = get_ai_service()
        result = service.analisis_completo_material(material_codigo=material_codigo, centro=centro)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error en analisis: {e}")
        return jsonify({"ok": False, "error": {"code": "analisis_error", "message": str(e)}}), 500


@bp.route("/sugerir-accion", methods=["POST"])
@require_auth
def sugerir_accion():
    """
    Sugiere accion para una solicitud.

    Body:
        {
            "solicitud_id": 123,
            // O datos completos de solicitud:
            "solicitud": {
                "id": 123,
                "criticidad": "Alta",
                "total_monto": 50000,
                ...
            }
        }

    Returns:
        Accion sugerida con nivel de confianza
    """
    from backend.core.db import get_db_connection, is_using_postgresql

    data = request.get_json() or {}

    try:
        service = get_ai_service()

        # Obtener solicitud
        if "solicitud" in data:
            solicitud = data["solicitud"]
        elif "solicitud_id" in data:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, criticidad, fecha_necesidad, total_monto, data_json
                    FROM solicitud WHERE id = ?
                """,
                    (data["solicitud_id"],),
                )
                row = cursor.fetchone()
                if not row:
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "not_found",
                                    "message": "Solicitud no encontrada",
                                },
                            }
                        ),
                        404,
                    )
                solicitud = dict(row)
        else:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "bad_request",
                            "message": "Falta solicitud_id o solicitud",
                        },
                    }
                ),
                400,
            )

        result = service.sugerir_accion(solicitud)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error sugiriendo accion: {e}")
        return jsonify({"ok": False, "error": {"code": "suggest_error", "message": str(e)}}), 500


@bp.route("/alertas", methods=["GET"])
@require_auth
def alertas_inteligentes():
    """
    Genera alertas inteligentes basadas en patrones ML.

    Query params:
        - centro: Centro de costo (requerido)

    Returns:
        Lista de alertas con severidad y recomendaciones
    """
    centro = request.args.get("centro")

    if not centro:
        return (
            jsonify(
                {"ok": False, "error": {"code": "bad_request", "message": "centro es requerido"}}
            ),
            400,
        )

    try:
        service = get_ai_service()
        result = service.generar_alertas_inteligentes(centro=centro)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error generando alertas: {e}")
        return jsonify({"ok": False, "error": {"code": "alertas_error", "message": str(e)}}), 500


@bp.route("/cantidad-optima", methods=["POST"])
@require_auth
def cantidad_optima():
    """
    Sugiere cantidad optima de pedido (EOQ).

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "demanda_anual": 1200,  // Opcional
            "costo_orden": 50,      // Opcional
            "costo_mantenimiento": 2 // Opcional
        }

    Returns:
        Cantidad sugerida con justificacion
    """
    data = request.get_json() or {}

    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "1000")

    if not material_codigo:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "bad_request", "message": "material_codigo es requerido"},
                }
            ),
            400,
        )

    try:
        service = get_ai_service()
        result = service.sugerir_cantidad_optima(
            material_codigo=material_codigo,
            centro=centro,
            demanda_anual=data.get("demanda_anual"),
            costo_orden=data.get("costo_orden", 50.0),
            costo_mantenimiento=data.get("costo_mantenimiento", 2.0),
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error calculando cantidad optima: {e}")
        return jsonify({"ok": False, "error": {"code": "eoq_error", "message": str(e)}}), 500


# =============================================================================
# Endpoints de Forecast Avanzado (Sprint Forecast Integration)
# =============================================================================

@bp.route("/forecast/models", methods=["GET"])
@require_auth
@rate_limit(requests=20, window_seconds=60)
def get_forecast_models():
    """
    Lista modelos de forecast disponibles.

    Returns:
        Lista de modelos con sus nombres legibles
    """
    from backend.agent.pipelines.forecast import (
        obtener_estrategias_disponibles,
        obtener_nombres_modelos
    )

    try:
        modelos = obtener_estrategias_disponibles()
        nombres = obtener_nombres_modelos()

        return jsonify({
            "ok": True,
            "data": {
                "modelos": modelos,
                "nombres": nombres
            }
        })

    except Exception as e:
        logger.error(f"Error listando modelos forecast: {e}")
        return jsonify({"ok": False, "error": {"code": "models_error", "message": str(e)}}), 500


def _sanitize_for_json(obj):
    """Convierte tipos numpy/pandas a tipos nativos de Python para JSON."""
    import numpy as np
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_json(v) for v in obj]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def _build_consumo_query(material_codigo, centro, limit=None):
    """Helper: construye query y params para consumo_historico con centro opcional."""
    conditions = ["material = ?"]
    params = [material_codigo]
    if centro and centro != "1000":
        if isinstance(centro, list):
            centro_list = [c for c in centro if c and c != "1000"]
        elif "," in centro:
            centro_list = [c.strip() for c in centro.split(",") if c.strip() and c.strip() != "1000"]
        else:
            centro_list = [centro]
        if centro_list:
            placeholders = ",".join(["?"] * len(centro_list))
            conditions.append(f"centro IN ({placeholders})")
            params.extend(centro_list)
    where = " AND ".join(conditions)
    query = f"SELECT fecha, SUM(cantidad) as cantidad FROM consumo_historico WHERE {where} GROUP BY fecha ORDER BY fecha"
    if limit:
        query += f" LIMIT {int(limit)}"
    return query, params


@bp.route("/forecast/backtest", methods=["POST"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def run_backtest():
    """
    Ejecuta backtesting para evaluar precisión del modelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "modelo": "random_forest",
            "ventana_test": 30,
            "n_pasos": 5
        }

    Returns:
        Reporte de backtesting con métricas
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.agent.pipelines.forecast import DemandPredictor, Backtester

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "")
    modelo = data.get("modelo", "random_forest")
    ventana_test = int(data.get("ventana_test", 30))
    n_pasos = int(data.get("n_pasos", 5))

    if not material_codigo:
        return jsonify({
            "ok": False,
            "error": {"code": "bad_request", "message": "material_codigo es requerido"}
        }), 400

    try:
        import pandas as pd

        # Obtener datos históricos
        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 20:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Ejecutar backtesting
        backtester = Backtester(DemandPredictor, modelo)
        report = backtester.ejecutar(df, ventana_test=ventana_test, n_pasos=n_pasos)

        return jsonify({"ok": True, "data": _sanitize_for_json(report.to_dict())})

    except Exception as e:
        logger.error(f"Error en backtesting: {e}")
        return jsonify({"ok": False, "error": {"code": "backtest_error", "message": str(e)}}), 500


@bp.route("/forecast/compare", methods=["POST"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def compare_models():
    """
    Compara múltiples modelos de forecast.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "modelos": ["random_forest", "gradient_boosting", "linear"]
        }

    Returns:
        Comparación con ranking y mejor modelo
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.agent.pipelines.forecast import DemandPredictor, ModelComparator

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "")
    modelos = data.get("modelos", ["random_forest", "gradient_boosting", "linear"])

    if not material_codigo:
        return jsonify({
            "ok": False,
            "error": {"code": "bad_request", "message": "material_codigo es requerido"}
        }), 400

    try:
        import pandas as pd

        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 20:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        comparator = ModelComparator(DemandPredictor)
        result = comparator.comparar(df, modelos)

        # Serializar resultado (sin el report completo)
        serializable_result = {
            "mejor_modelo": result["mejor_modelo"],
            "recomendacion": result["recomendacion"],
            "ranking": result["ranking"],
            "resultados": {
                k: {kk: vv for kk, vv in v.items() if kk != "report"}
                for k, v in result["resultados"].items()
            }
        }

        return jsonify({"ok": True, "data": _sanitize_for_json(serializable_result)})

    except Exception as e:
        logger.error(f"Error comparando modelos: {e}")
        return jsonify({"ok": False, "error": {"code": "compare_error", "message": str(e)}}), 500


@bp.route("/forecast/auto-select", methods=["POST"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def auto_select_model():
    """
    Selecciona automáticamente el mejor modelo para un material.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "optimizar_params": false
        }

    Returns:
        Mejor modelo con métricas y recomendación
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.agent.pipelines.forecast import (
        DemandPredictor, AutoModelSelector, obtener_estrategias_disponibles
    )

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "")
    optimizar_params = data.get("optimizar_params", False)

    if not material_codigo:
        return jsonify({
            "ok": False,
            "error": {"code": "bad_request", "message": "material_codigo es requerido"}
        }), 400

    try:
        import pandas as pd
        import numpy as np

        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 30:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Preparar features para auto-selección
        predictor = DemandPredictor()
        df_prep = predictor._preparar_features(df)
        df_prep = predictor._crear_lag_features(df_prep).dropna()

        if len(df_prep) < 20:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": "Datos insuficientes después de preparación"}
            }), 400

        feature_cols = [c for c in df_prep.columns if c not in ["fecha", "cantidad"]]
        X = df_prep[feature_cols].values
        y = df_prep["cantidad"].values

        # Auto-seleccionar
        modelos_disponibles = obtener_estrategias_disponibles()
        selector = AutoModelSelector(modelos=modelos_disponibles, optimizar_params=optimizar_params)
        result = selector.seleccionar(X, y)

        return jsonify({"ok": True, "data": _sanitize_for_json(result.to_dict())})

    except Exception as e:
        logger.error(f"Error en auto-selección: {e}")
        return jsonify({"ok": False, "error": {"code": "autoselect_error", "message": str(e)}}), 500


@bp.route("/forecast/tune", methods=["POST"])
@require_auth
@rate_limit(requests=2, window_seconds=60)
def tune_hyperparameters():
    """
    Optimiza hiperparámetros de un modelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "modelo": "random_forest",
            "n_iter": 30
        }

    Returns:
        Mejores hiperparámetros encontrados
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.agent.pipelines.forecast import DemandPredictor, HyperparameterTuner

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "")
    modelo = data.get("modelo", "random_forest")
    n_iter = int(data.get("n_iter", 30))

    if not material_codigo:
        return jsonify({
            "ok": False,
            "error": {"code": "bad_request", "message": "material_codigo es requerido"}
        }), 400

    try:
        import pandas as pd

        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 30:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Preparar features
        predictor = DemandPredictor()
        df_prep = predictor._preparar_features(df)
        df_prep = predictor._crear_lag_features(df_prep).dropna()

        feature_cols = [c for c in df_prep.columns if c not in ["fecha", "cantidad"]]
        X = df_prep[feature_cols].values
        y = df_prep["cantidad"].values

        # Optimizar
        tuner = HyperparameterTuner()
        result = tuner.optimizar(X, y, modelo, n_iter=n_iter, rapido=True)

        return jsonify({"ok": True, "data": _sanitize_for_json(result.to_dict())})

    except Exception as e:
        logger.error(f"Error en tuning: {e}")
        return jsonify({"ok": False, "error": {"code": "tune_error", "message": str(e)}}), 500


# ============================================================================
# FASE 1 - Forecast Mejorado (LSTM, STL Decomposition)
# ============================================================================

@bp.route("/forecast/compare-parallel", methods=["POST"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def compare_models_parallel():
    """
    Compara múltiples modelos de forecast en paralelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "modelos": ["lstm", "stl", "random_forest"],
            "periodos": 30
        }

    Returns:
        Ranking de modelos con métricas (MAPE, RMSE, R2)
    """
    try:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import pandas as pd
        from backend.agent.pipelines.forecast import obtener_estrategia
        from backend.core.db import get_db_connection, is_using_postgresql

        data = request.get_json() or {}
        material_codigo = data.get("material_codigo")
        centro = data.get("centro", "")
        modelos = data.get("modelos", ["lstm", "stl", "random_forest"])
        periodos = int(data.get("periodos", 30))

        if not material_codigo:
            return jsonify({
                "ok": False,
                "error": {"code": "bad_request", "message": "material_codigo es requerido"}
            }), 400

        # Obtener datos históricos
        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro, limit=365)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 30:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Entrenar modelos en paralelo
        resultados = {}

        def entrenar_modelo(modelo_id):
            try:
                modelo = obtener_estrategia(modelo_id)
                if not modelo:
                    return modelo_id, None

                metricas = modelo.entrenar(df)
                predicciones = modelo.predecir(df, periodos=periodos)

                return modelo_id, {
                    'metricas': metricas,
                    'predicciones': predicciones.to_dict('records')
                }
            except Exception as e:
                logger.warning(f"Error en modelo {modelo_id}: {e}")
                return modelo_id, None

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(entrenar_modelo, mid): mid for mid in modelos}

            for future in as_completed(futures, timeout=300):
                modelo_id, resultado = future.result()
                if resultado:
                    resultados[modelo_id] = resultado

        # Crear ranking
        ranking = []
        for modelo_id, resultado in resultados.items():
            ranking.append({
                'modelo': modelo_id,
                'mape': resultado['metricas'].get('mape', 0),
                'rmse': resultado['metricas'].get('rmse', 0),
                'r2': resultado['metricas'].get('r2', 0),
                'mae': resultado['metricas'].get('mae', 0)
            })

        # Ordenar por MAPE
        ranking.sort(key=lambda x: x['mape'])

        return jsonify({
            "ok": True,
            "data": {
                "ranking": ranking,
                "mejor_modelo": ranking[0]['modelo'] if ranking else None,
                "total_modelos": len(resultados),
                "periodos": periodos
            }
        })

    except Exception as e:
        logger.error(f"Error comparando modelos: {e}")
        return jsonify({"ok": False, "error": {"code": "compare_error", "message": str(e)}}), 500


@bp.route("/forecast/decomposition", methods=["POST"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_stl_decomposition():
    """
    Obtiene descomposición STL de una serie temporal.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "periodos": 30
        }

    Returns:
        Componentes (trend, seasonal, residual) y predicciones
    """
    try:
        import pandas as pd
        from backend.agent.pipelines.forecast import obtener_estrategia
        from backend.core.db import get_db_connection, is_using_postgresql

        data = request.get_json() or {}
        material_codigo = data.get("material_codigo")
        centro = data.get("centro", "")
        periodos = int(data.get("periodos", 30))

        if not material_codigo:
            return jsonify({
                "ok": False,
                "error": {"code": "bad_request", "message": "material_codigo es requerido"}
            }), 400

        # Obtener datos históricos
        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro, limit=365)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 30:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Usar STL
        stl = obtener_estrategia('stl')
        if not stl:
            return jsonify({
                "ok": False,
                "error": {"code": "model_unavailable", "message": "STL model not available"}
            }), 500

        # Entrenar
        stl.entrenar(df)

        # Obtener componentes
        descomposicion = stl.get_descomposicion()

        # Obtener predicciones
        predicciones = stl.predecir(df, periodos=periodos)

        return jsonify({
            "ok": True,
            "data": {
                "componentes": {
                    "trend": descomposicion['trend'].tolist() if isinstance(descomposicion['trend'], object) else descomposicion['trend'],
                    "seasonal": descomposicion['seasonal'].tolist() if isinstance(descomposicion['seasonal'], object) else descomposicion['seasonal'],
                    "residual": descomposicion['residual'].tolist() if isinstance(descomposicion['residual'], object) else descomposicion['residual'],
                    "fechas": descomposicion['fechas']
                },
                "predicciones": predicciones.to_dict('records'),
                "material": material_codigo,
                "centro": centro
            }
        })

    except Exception as e:
        logger.error(f"Error en descomposición STL: {e}")
        return jsonify({"ok": False, "error": {"code": "decomposition_error", "message": str(e)}}), 500


# ============================================================================
# Recomendaciones de Compra (RecommendationEngine)
# ============================================================================

@bp.route("/recomendaciones/<centro>", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_recomendaciones(centro):
    """
    Genera recomendaciones de compra para un centro.

    Path params:
        - centro: Centro de distribución

    Query params:
        - limit: Máximo de recomendaciones (default: 10, max: 50)

    Returns:
        Lista de recomendaciones ordenadas por score
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.services.recommendation_engine import RecommendationEngine
    import pandas as pd
    import numpy as np

    limit = min(int(request.args.get("limit", 10)), 50)

    try:
        engine = RecommendationEngine()
        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            # Obtener materiales con stock y consumo
            cursor.execute("""
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    COALESCE(m.stock_de_seguridad, 0) as stock_seguridad,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.centro = ?
                ORDER BY m.codigo_material
                LIMIT 200
            """, (centro,))
            materiales_raw = [dict(row) for row in cursor.fetchall()]

        materiales_para_engine = []
        for mat in materiales_raw:
            consumo_anual = float(mat.get("consumo_anual") or 0)
            demanda_diaria = consumo_anual / 365 if consumo_anual > 0 else 0.1
            stock_actual = float(mat.get("stock_actual") or 0)
            punto_pedido = float(mat.get("punto_pedido") or 0)

            # Solo incluir materiales con datos significativos
            if consumo_anual > 0 or stock_actual > 0:
                materiales_para_engine.append({
                    'codigo': mat['codigo'],
                    'descripcion': mat.get('descripcion', ''),
                    'stock_actual': stock_actual,
                    'rop': punto_pedido if punto_pedido > 0 else demanda_diaria * 14,
                    'consumo_historico': [demanda_diaria] * 30,
                    'demanda_promedio': demanda_diaria,
                    'demanda_std': demanda_diaria * 0.3,
                    'abc_clase': 'A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
                    'lead_time_dias': 14,
                    'precio_unitario': float(mat.get("precio_unitario") or 0),
                    'cantidad_eoq': 0
                })

        recomendaciones = engine.generar_top_recomendaciones(materiales_para_engine, limit=limit)

        return jsonify({
            "ok": True,
            "data": {
                "centro": centro,
                "recomendaciones": recomendaciones,
                "total": len(recomendaciones)
            }
        })

    except Exception as e:
        logger.error(f"Error generando recomendaciones: {e}")
        return jsonify({"ok": False, "error": {"code": "recomendaciones_error", "message": str(e)}}), 500


@bp.route("/recomendaciones/material/<material_codigo>", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_recomendacion_material(material_codigo):
    """
    Genera recomendación para un material específico.

    Path params:
        - material_codigo: Código del material

    Query params:
        - centro: Centro (default: primer centro encontrado)

    Returns:
        Recomendación con scoring detallado
    """
    from backend.services.recommendation_engine import RecommendationEngine
    from backend.core.db import get_db_connection, is_using_postgresql
    import numpy as np

    centro = request.args.get("centro", "")

    try:
        engine = RecommendationEngine()
        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            # Info del material
            query = """
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    m.centro,
                    COALESCE(m.stock_de_seguridad, 0) as stock_seguridad,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.codigo_material = ?
            """
            params = [material_codigo]
            if centro:
                query += " AND m.centro = ?"
                params.append(centro)
            query += " LIMIT 1"

            cursor.execute(query, params)
            row = cursor.fetchone()

            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Material no encontrado"}
                }), 404

            mat = dict(row)

            # Obtener consumo histórico
            cursor.execute("""
                SELECT cantidad FROM consumo_historico
                WHERE material = ?
                ORDER BY fecha DESC LIMIT 30
            """, (material_codigo,))
            consumo_rows = cursor.fetchall()
            consumo_historico = [float(r[0] if not isinstance(r, dict) else r.get('cantidad', 0)) for r in consumo_rows]

        if not consumo_historico:
            consumo_historico = [0.0] * 30

        consumo_anual = float(mat.get("consumo_anual") or 0)
        demanda_promedio = np.mean(consumo_historico) if consumo_historico else (consumo_anual / 365 if consumo_anual > 0 else 0.1)
        demanda_std = np.std(consumo_historico) if len(consumo_historico) > 1 else demanda_promedio * 0.3
        punto_pedido = float(mat.get("punto_pedido") or 0)

        rec = engine.generar_recomendacion(
            material_codigo=material_codigo,
            stock_actual=float(mat.get("stock_actual") or 0),
            rop=punto_pedido if punto_pedido > 0 else demanda_promedio * 14,
            consumo_historico=consumo_historico,
            demanda_promedio=demanda_promedio,
            demanda_std=demanda_std,
            abc_clase='A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
            lead_time_dias=14,
            precio_unitario=float(mat.get("precio_unitario") or 0),
            cantidad_eoq=0
        )

        rec['descripcion'] = mat.get('descripcion', '')
        rec['centro'] = mat.get('centro', centro)

        return jsonify({"ok": True, "data": rec})

    except Exception as e:
        logger.error(f"Error en recomendación de material: {e}")
        return jsonify({"ok": False, "error": {"code": "recomendacion_error", "message": str(e)}}), 500


# ============================================================================
# Top Recomendaciones Globales (todos los centros)
# ============================================================================


@bp.route("/recomendaciones/top", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_top_recomendaciones():
    """
    Top recomendaciones de compra globales (todos los centros).

    Query params:
        - limit: Máximo de recomendaciones (default: 10, max: 50)

    Returns:
        Top N recomendaciones ordenadas por score
    """
    from backend.core.db import get_db_connection
    from backend.services.recommendation_engine import RecommendationEngine
    import numpy as np

    limit = min(int(request.args.get("limit", 10)), 50)

    try:
        engine = RecommendationEngine()

        with get_db_connection("sap_data") as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    m.centro,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.consumo_promedio_anual > 0
                ORDER BY m.consumo_promedio_anual DESC
                LIMIT 500
            """)
            materiales_raw = [dict(row) for row in cursor.fetchall()]

        materiales_para_engine = []
        for mat in materiales_raw:
            consumo_anual = float(mat.get("consumo_anual") or 0)
            demanda_diaria = consumo_anual / 365 if consumo_anual > 0 else 0.1
            stock_actual = float(mat.get("stock_actual") or 0)
            punto_pedido = float(mat.get("punto_pedido") or 0)

            if consumo_anual > 0 or stock_actual > 0:
                materiales_para_engine.append({
                    'codigo': mat['codigo'],
                    'descripcion': mat.get('descripcion', ''),
                    'centro': mat.get('centro', ''),
                    'stock_actual': stock_actual,
                    'rop': punto_pedido if punto_pedido > 0 else demanda_diaria * 14,
                    'consumo_historico': [demanda_diaria] * 30,
                    'demanda_promedio': demanda_diaria,
                    'demanda_std': demanda_diaria * 0.3,
                    'abc_clase': 'A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
                    'lead_time_dias': 14,
                    'precio_unitario': float(mat.get("precio_unitario") or 0),
                    'cantidad_eoq': 0,
                })

        recomendaciones = engine.generar_top_recomendaciones(materiales_para_engine, limit=limit)

        # Enrich with description and centro
        mat_map = {m['codigo']: m for m in materiales_para_engine}
        for rec in recomendaciones:
            info = mat_map.get(rec['material'], {})
            rec['descripcion'] = info.get('descripcion', '')
            rec['centro'] = info.get('centro', '')

        return jsonify({
            "ok": True,
            "data": {
                "recomendaciones": recomendaciones,
                "total": len(recomendaciones),
                "materiales_evaluados": len(materiales_para_engine),
            }
        })

    except Exception as e:
        logger.error(f"Error en top recomendaciones: {e}")
        return jsonify({"ok": False, "error": {"code": "recomendaciones_error", "message": str(e)}}), 500


# ============================================================================
# Detección de Anomalías
# ============================================================================

@bp.route("/anomalias/<material_codigo>", methods=["POST"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def detectar_anomalias(material_codigo):
    """
    Detecta anomalías en consumo de un material.

    Path params:
        - material_codigo: Código del material

    Body (opcional):
        {
            "centro": "AA101",
            "dias": 90,
            "threshold": 0.5
        }

    Returns:
        Anomalías detectadas con explicaciones
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    import pandas as pd

    data = request.get_json() or {}
    centro = data.get("centro", "")
    dias = int(data.get("dias", 90))
    threshold = float(data.get("threshold", 0.5))

    try:
        from backend.agent.pipelines.anomaly_detection import AnomalyDetector

        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            query = "SELECT fecha, SUM(cantidad) as cantidad FROM consumo_historico WHERE material = ?"
            params = [material_codigo]

            if centro:
                query += " AND centro = ?"
                params.append(centro)

            query += " GROUP BY fecha ORDER BY fecha"

            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 5:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros (mínimo 5)"}
            }), 400

        detector = AnomalyDetector()
        df_anomalias, prop = detector.detectar(df)

        # Filtrar significativas
        anomalias_sig = detector.obtener_anomalias_significativas(df_anomalias, threshold_score=threshold)

        # Explicar cada anomalía
        explicaciones = []
        for _, row in anomalias_sig.head(20).iterrows():
            explicaciones.append(detector.explicar_anomalia(row, {
                'material_nombre': material_codigo,
                'centro': centro
            }))

        return jsonify({
            "ok": True,
            "data": {
                "material": material_codigo,
                "centro": centro,
                "total_registros": len(df),
                "anomalias_detectadas": int(df_anomalias['es_anomalia'].sum()),
                "proporcion_anomalias": round(float(prop), 4),
                "anomalias_significativas": len(anomalias_sig),
                "explicaciones": explicaciones,
                "periodo_analizado_dias": dias
            }
        })

    except ImportError:
        return jsonify({
            "ok": False,
            "error": {"code": "dependency_missing", "message": "sklearn es requerido para detección de anomalías"}
        }), 501
    except Exception as e:
        logger.error(f"Error detectando anomalías: {e}")
        return jsonify({"ok": False, "error": {"code": "anomalias_error", "message": str(e)}}), 500


# ============================================================================
# Clustering de Materiales
# ============================================================================

@bp.route("/clustering", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
@rate_limit(requests=5, window_seconds=60)
def clustering_materiales():
    """
    Agrupa materiales por similitud usando K-Means.

    Body:
        {
            "centro": "AA101",
            "n_clusters": 5,
            "limit": 200
        }

    Returns:
        Clusters con materiales asignados y características
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    import numpy as np

    data = request.get_json() or {}
    centro = data.get("centro", "")
    n_clusters = min(int(data.get("n_clusters", 5)), 10)
    limit = min(int(data.get("limit", 200)), 500)

    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler

        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            query = """
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(m.stock_de_seguridad, 0) as stock_seguridad,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE 1=1
            """
            params = []
            if centro:
                query += " AND m.centro = ?"
                params.append(centro)

            query += " ORDER BY m.consumo_promedio_anual DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            materiales = [dict(row) for row in cursor.fetchall()]

        if len(materiales) < n_clusters:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Solo {len(materiales)} materiales, se necesitan al menos {n_clusters}"}
            }), 400

        # Preparar features
        features = []
        codigos = []
        descripciones = []
        for mat in materiales:
            features.append([
                float(mat.get("consumo_anual") or 0),
                float(mat.get("stock_actual") or 0),
                float(mat.get("precio_unitario") or 0),
                float(mat.get("stock_seguridad") or 0),
                float(mat.get("punto_pedido") or 0),
            ])
            codigos.append(mat['codigo'])
            descripciones.append(mat.get('descripcion', ''))

        X = np.array(features)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)

        # Organizar resultados por cluster
        clusters = {}
        for i in range(n_clusters):
            mask = labels == i
            cluster_indices = np.where(mask)[0]
            cluster_features = X[mask]

            miembros = []
            for idx in cluster_indices:
                miembros.append({
                    'codigo': codigos[idx],
                    'descripcion': descripciones[idx][:60],
                    'consumo_anual': float(features[idx][0]),
                    'stock_actual': float(features[idx][1]),
                    'precio_unitario': float(features[idx][2]),
                })

            clusters[f"cluster_{i}"] = {
                'id': i,
                'total_materiales': int(mask.sum()),
                'consumo_promedio': float(cluster_features[:, 0].mean()) if len(cluster_features) > 0 else 0,
                'precio_promedio': float(cluster_features[:, 2].mean()) if len(cluster_features) > 0 else 0,
                'stock_promedio': float(cluster_features[:, 1].mean()) if len(cluster_features) > 0 else 0,
                'miembros': miembros[:20],  # Limitar miembros por cluster
            }

        return jsonify({
            "ok": True,
            "data": {
                "centro": centro,
                "n_clusters": n_clusters,
                "total_materiales": len(materiales),
                "clusters": clusters,
                "inertia": float(kmeans.inertia_)
            }
        })

    except ImportError:
        return jsonify({
            "ok": False,
            "error": {"code": "dependency_missing", "message": "sklearn es requerido para clustering"}
        }), 501
    except Exception as e:
        logger.error(f"Error en clustering: {e}")
        return jsonify({"ok": False, "error": {"code": "clustering_error", "message": str(e)}}), 500


@bp.route('/plan-compras/<centro>', methods=['GET'])
@require_auth
@require_role(['Admin', 'Administrador', 'Planificador', 'Planner'])
def get_plan_compras(centro):
    """
    Feature 4.4: Genera plan de compras inteligente combinando forecast + stock + proveedores.

    Para cada material A/B del centro:
    1. Ejecuta forecast de demanda
    2. Compara con stock actual y pedidos en curso
    3. Identifica proveedor óptimo (mejor OTIF)
    4. Calcula cantidad óptima (EOQ)
    5. Sugiere fecha de compra

    Query params:
        - limit: Máximo de items (default: 50, max: 200)
    """
    try:
        from backend.services.mrp_service import (
            calcular_requerimiento_neto,
            calcular_cantidad_optima
        )
        from datetime import datetime, timedelta

        limite = min(int(request.args.get('limit', 50)), 200)

        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Get A/B materials needing reorder
            cur.execute("""
                SELECT
                    m.codigo_material,
                    m.descripcion,
                    m.centro,
                    m.stock_actual,
                    m.stock_seguridad,
                    m.punto_pedido,
                    m.consumo_promedio_mensual,
                    m.lead_time_dias,
                    m.pedidos_en_curso,
                    m.categoria_abc,
                    m.critico
                FROM materiales_mrp m
                WHERE m.centro = ?
                  AND UPPER(COALESCE(m.categoria_abc, 'C')) IN ('A', 'B')
                  AND m.stock_actual < m.punto_pedido
                ORDER BY
                    CASE WHEN m.stock_actual <= 0 THEN 0
                         WHEN m.stock_actual < COALESCE(m.stock_seguridad, 0) THEN 1
                         ELSE 2 END,
                    m.codigo_material
                LIMIT ?
            """, (centro, limite))
            materiales = cur.fetchall()

            plan = []
            for mat_row in materiales:
                mat = dict(mat_row) if hasattr(mat_row, 'keys') else {
                    'codigo_material': mat_row[0], 'descripcion': mat_row[1],
                    'centro': mat_row[2], 'stock_actual': mat_row[3],
                    'stock_seguridad': mat_row[4], 'punto_pedido': mat_row[5],
                    'consumo_promedio_mensual': mat_row[6], 'lead_time_dias': mat_row[7],
                    'pedidos_en_curso': mat_row[8], 'categoria_abc': mat_row[9],
                    'critico': mat_row[10]
                }
                codigo = mat.get('codigo_material') or mat_row[0]
                stock = mat.get('stock_actual') or 0
                ss = mat.get('stock_seguridad') or 0
                pp = mat.get('punto_pedido') or 0
                consumo = mat.get('consumo_promedio_mensual') or 0
                lead_time = mat.get('lead_time_dias') or 30
                pedidos = mat.get('pedidos_en_curso') or 0

                # Calculate optimal quantity
                demanda_anual = consumo * 12
                try:
                    eoq_result = calcular_cantidad_optima(
                        demanda_anual=demanda_anual,
                        costo_orden=100,
                        costo_mantenimiento_unitario=max(demanda_anual * 0.2 / 12, 0.01)
                    )
                    cantidad = eoq_result['cantidad_optima']
                except Exception:
                    cantidad = max(pp - stock, consumo) if consumo > 0 else 100

                # Find best provider for this material
                cur.execute("""
                    SELECT
                        p.proveedor_nombre,
                        p.proveedor_cuit,
                        COUNT(*) as entregas,
                        SUM(CASE
                            WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                             AND p.cantidad_recepcionada >= p.cantidad_pedida
                            THEN 1 ELSE 0
                        END) as otif_count,
                        AVG(s.precio_unitario) as precio_promedio
                    FROM sap_purchase_orders p
                    INNER JOIN sap_solpeds s
                        ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                    WHERE s.material_codigo = ?
                      AND p.fecha_recepcion IS NOT NULL
                      AND p.proveedor_nombre IS NOT NULL
                    GROUP BY p.proveedor_cuit, p.proveedor_nombre
                    HAVING COUNT(*) >= 2
                    ORDER BY (CAST(SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)) DESC
                    LIMIT 1
                """, (codigo,))
                best_provider = cur.fetchone()

                provider_info = None
                precio_estimado = 0
                if best_provider:
                    bp = dict(best_provider) if hasattr(best_provider, 'keys') else {
                        'proveedor_nombre': best_provider[0], 'proveedor_cuit': best_provider[1],
                        'entregas': best_provider[2], 'otif_count': best_provider[3],
                        'precio_promedio': best_provider[4]
                    }
                    entregas = bp.get('entregas') or bp.get(2) or 1
                    otif = bp.get('otif_count') or bp.get(3) or 0
                    precio_estimado = float(bp.get('precio_promedio') or bp.get(4) or 0)
                    provider_info = {
                        "nombre": bp.get('proveedor_nombre') or bp[0],
                        "cuit": bp.get('proveedor_cuit') or bp[1],
                        "otif_pct": round(100 * otif / entregas, 1),
                        "entregas": entregas,
                        "precio_promedio": round(precio_estimado, 2)
                    }

                # Suggested order date
                consumo_diario = consumo / 30 if consumo > 0 else 0
                dias_hasta_quiebre = round(stock / consumo_diario) if consumo_diario > 0 else 999
                fecha_pedido = datetime.now() + timedelta(days=max(0, dias_hasta_quiebre - lead_time))

                # Urgency
                if stock <= 0:
                    urgencia = "critica"
                elif stock < ss:
                    urgencia = "alta"
                elif stock < pp:
                    urgencia = "media"
                else:
                    urgencia = "baja"

                plan.append({
                    "material_codigo": codigo,
                    "descripcion": mat.get('descripcion') or mat_row[1] or '',
                    "stock_actual": stock,
                    "punto_pedido": pp,
                    "stock_seguridad": ss,
                    "cantidad_sugerida": cantidad,
                    "costo_estimado": round(cantidad * precio_estimado, 2) if precio_estimado else None,
                    "proveedor_optimo": provider_info,
                    "fecha_sugerida": fecha_pedido.strftime('%Y-%m-%d'),
                    "urgencia": urgencia,
                    "categoria_abc": mat.get('categoria_abc'),
                    "cobertura_actual_dias": round(stock / consumo_diario, 1) if consumo_diario > 0 else None,
                    "cobertura_post_compra_dias": round((stock + cantidad) / consumo_diario, 1) if consumo_diario > 0 else None
                })

        return jsonify({
            "centro": centro,
            "total_items": len(plan),
            "costo_total_estimado": round(sum(p.get('costo_estimado') or 0 for p in plan), 2),
            "plan": plan
        })

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error generando plan de compras: {e}")
        return jsonify({"error": "Error al generar plan de compras"}), 500
