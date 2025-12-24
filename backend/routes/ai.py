"""
Endpoints API para recomendaciones inteligentes de IA.
Sprint 6.3 - Expone funcionalidades del servicio unificado de IA.

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
from functools import wraps

from flask import Blueprint, g, jsonify, request

try:
    from backend.services.ai_service import AIService, get_ai_service
except ImportError:
    from services.ai_service import get_ai_service


def require_auth(f):
    """Decorator que requiere autenticacion"""

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


def require_role(roles):
    """Decorator que requiere uno de los roles especificados"""

    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(g, "user") or not g.user:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {"code": "unauthorized", "message": "No autenticado"},
                        }
                    ),
                    401,
                )

            user_role = g.user.get("rol", "").lower()
            allowed = False
            for role in roles:
                if role.lower() in user_role:
                    allowed = True
                    break

            if not allowed:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "forbidden",
                                "message": f"Requiere uno de estos roles: {', '.join(roles)}",
                            },
                        }
                    ),
                    403,
                )

            return f(*args, **kwargs)

        return decorated

    return decorator


logger = logging.getLogger(__name__)

bp = Blueprint("ai", __name__, url_prefix="/api/ai")


@bp.route("/status", methods=["GET"])
@require_auth
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
    try:
        from backend.core.db import get_db_connection, sql_now_minus
    except ImportError:
        from core.db import get_db_connection, sql_now_minus

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
                FROM solicitudes
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
        - estado: Filtrar por estado (default: submitted)
        - centro: Filtrar por centro
        - limit: Limite de resultados (default: 20)

    Returns:
        Solicitudes rankeadas por prioridad
    """
    try:
        from backend.core.db import get_db_connection
    except ImportError:
        from core.db import get_db_connection

    estado = request.args.get("estado", "submitted")
    centro = request.args.get("centro")
    limit = int(request.args.get("limit", 20))

    try:
        service = get_ai_service()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, criticidad, fecha_necesidad, total_monto, data_json,
                       estado, centro, sector, created_at
                FROM solicitudes
                WHERE estado = ?
            """
            params = [estado]

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


@bp.route("/materiales/forecast/<material_codigo>", methods=["GET"])
@require_auth
def forecast_demanda(material_codigo):
    """
    Proyecta demanda futura para un material.

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
    centro = request.args.get("centro", "")
    almacen = request.args.get("almacen", "")
    dias = int(request.args.get("dias", 30))
    modelo = request.args.get("modelo", "random_forest")

    try:
        service = get_ai_service()
        result = service.proyectar_demanda(
            material_codigo=material_codigo, centro=centro, dias=dias, modelo_tipo=modelo, almacen=almacen
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error proyectando demanda: {e}")
        return jsonify({"ok": False, "error": {"code": "forecast_error", "message": str(e)}}), 500


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
    try:
        from backend.core.db import get_db_connection
    except ImportError:
        from core.db import get_db_connection

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
                    FROM solicitudes WHERE id = ?
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
def get_forecast_models():
    """
    Lista modelos de forecast disponibles.

    Returns:
        Lista de modelos con sus nombres legibles
    """
    try:
        from backend.agent.pipelines.forecast import (
            obtener_estrategias_disponibles,
            obtener_nombres_modelos
        )
    except ImportError:
        from agent.pipelines.forecast import (
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


@bp.route("/forecast/backtest", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
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
    try:
        from backend.core.db import get_db_connection
        from backend.agent.pipelines.forecast import DemandPredictor, Backtester
    except ImportError:
        from core.db import get_db_connection
        from agent.pipelines.forecast import DemandPredictor, Backtester

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "1000")
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
            query = """
                SELECT fecha_doc as fecha, cantidad
                FROM consumo_historico
                WHERE material = ? AND centro = ?
                ORDER BY fecha_doc
            """
            df = pd.read_sql_query(query, conn, params=[material_codigo, centro])

        if len(df) < 60:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Ejecutar backtesting
        backtester = Backtester(DemandPredictor, modelo)
        report = backtester.ejecutar(df, ventana_test=ventana_test, n_pasos=n_pasos)

        return jsonify({"ok": True, "data": report.to_dict()})

    except Exception as e:
        logger.error(f"Error en backtesting: {e}")
        return jsonify({"ok": False, "error": {"code": "backtest_error", "message": str(e)}}), 500


@bp.route("/forecast/compare", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
def compare_models():
    """
    Compara múltiples modelos de forecast.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "modelos": ["random_forest", "gradient_boosting", "linear"]
        }

    Returns:
        Comparación con ranking y mejor modelo
    """
    try:
        from backend.core.db import get_db_connection
        from backend.agent.pipelines.forecast import DemandPredictor, ModelComparator
    except ImportError:
        from core.db import get_db_connection
        from agent.pipelines.forecast import DemandPredictor, ModelComparator

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "1000")
    modelos = data.get("modelos", ["random_forest", "gradient_boosting", "linear"])

    if not material_codigo:
        return jsonify({
            "ok": False,
            "error": {"code": "bad_request", "message": "material_codigo es requerido"}
        }), 400

    try:
        import pandas as pd

        with get_db_connection("sap_data") as conn:
            query = """
                SELECT fecha_doc as fecha, cantidad
                FROM consumo_historico
                WHERE material = ? AND centro = ?
                ORDER BY fecha_doc
            """
            df = pd.read_sql_query(query, conn, params=[material_codigo, centro])

        if len(df) < 60:
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

        return jsonify({"ok": True, "data": serializable_result})

    except Exception as e:
        logger.error(f"Error comparando modelos: {e}")
        return jsonify({"ok": False, "error": {"code": "compare_error", "message": str(e)}}), 500


@bp.route("/forecast/auto-select", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
def auto_select_model():
    """
    Selecciona automáticamente el mejor modelo para un material.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "optimizar_params": false
        }

    Returns:
        Mejor modelo con métricas y recomendación
    """
    try:
        from backend.core.db import get_db_connection
        from backend.agent.pipelines.forecast import (
            DemandPredictor, AutoModelSelector, obtener_estrategias_disponibles
        )
    except ImportError:
        from core.db import get_db_connection
        from agent.pipelines.forecast import (
            DemandPredictor, AutoModelSelector, obtener_estrategias_disponibles
        )

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "1000")
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
            query = """
                SELECT fecha_doc as fecha, cantidad
                FROM consumo_historico
                WHERE material = ? AND centro = ?
                ORDER BY fecha_doc
            """
            df = pd.read_sql_query(query, conn, params=[material_codigo, centro])

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

        return jsonify({"ok": True, "data": result.to_dict()})

    except Exception as e:
        logger.error(f"Error en auto-selección: {e}")
        return jsonify({"ok": False, "error": {"code": "autoselect_error", "message": str(e)}}), 500


@bp.route("/forecast/tune", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
def tune_hyperparameters():
    """
    Optimiza hiperparámetros de un modelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "modelo": "random_forest",
            "n_iter": 30
        }

    Returns:
        Mejores hiperparámetros encontrados
    """
    try:
        from backend.core.db import get_db_connection
        from backend.agent.pipelines.forecast import DemandPredictor, HyperparameterTuner
    except ImportError:
        from core.db import get_db_connection
        from agent.pipelines.forecast import DemandPredictor, HyperparameterTuner

    data = request.get_json() or {}
    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "1000")
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
            query = """
                SELECT fecha_doc as fecha, cantidad
                FROM consumo_historico
                WHERE material = ? AND centro = ?
                ORDER BY fecha_doc
            """
            df = pd.read_sql_query(query, conn, params=[material_codigo, centro])

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

        return jsonify({"ok": True, "data": result.to_dict()})

    except Exception as e:
        logger.error(f"Error en tuning: {e}")
        return jsonify({"ok": False, "error": {"code": "tune_error", "message": str(e)}}), 500
