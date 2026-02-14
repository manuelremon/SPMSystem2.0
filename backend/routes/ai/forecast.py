"""
Forecast endpoints: demand forecasting, backtesting, model comparison,
auto-selection, hyperparameter tuning, parallel comparison, and STL decomposition.
"""

import logging

from flask import jsonify, request

from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth
from backend.routes.ai import bp
from backend.services.temp_data_service import temp_data_service

logger = logging.getLogger(__name__)


def _forecast_from_temp_data(user_id: str, material_codigo: str, centro: str, dias: int, modelo: str):
    """
    Genera forecast desde datos temporales importados.
    Usa promedio movil simple cuando los datos son insuficientes para ML.
    """
    from datetime import datetime, timedelta

    import pandas as pd

    try:
        # Obtener consumo historico de datos temporales
        consumo_data = temp_data_service.get_consumo_historico(
            user_id=user_id,
            material=material_codigo,
            centro=centro if centro else None
        )

        if not consumo_data:
            # Sin datos historicos, usar stock actual como referencia
            stock_info = temp_data_service.get_stock_by_material(user_id, material_codigo)
            if stock_info:
                # Estimacion muy basica: asumir consumo del 10% del stock por mes
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
                    "advertencia": "Sin datos historicos - estimacion muy basica",
                    "_temp_mode": True
                }
            })

        # Convertir a DataFrame para analisis
        df = pd.DataFrame(consumo_data)
        df["fecha"] = pd.to_datetime(df["fecha"])
        df = df.sort_values("fecha")

        # Calcular consumo diario promedio
        total_consumo = df["cantidad"].sum()
        dias_datos = max((df["fecha"].max() - df["fecha"].min()).days, 1)
        consumo_diario = total_consumo / dias_datos

        # Proyeccion simple usando promedio movil
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
        for i in range(1, min(dias + 1, 31)):  # Limitar a 30 dias para visualizacion
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
        obtener_nombres_modelos,
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
    Ejecuta backtesting para evaluar precision del modelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "modelo": "random_forest",
            "ventana_test": 30,
            "n_pasos": 5
        }

    Returns:
        Reporte de backtesting con metricas
    """
    from backend.agent.pipelines.forecast import Backtester, DemandPredictor
    from backend.core.db import get_db_connection

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

        # Obtener datos historicos
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
    Compara multiples modelos de forecast.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "modelos": ["random_forest", "gradient_boosting", "linear"]
        }

    Returns:
        Comparacion con ranking y mejor modelo
    """
    from backend.agent.pipelines.forecast import DemandPredictor, ModelComparator
    from backend.core.db import get_db_connection

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
    Selecciona automaticamente el mejor modelo para un material.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "optimizar_params": false
        }

    Returns:
        Mejor modelo con metricas y recomendacion
    """
    from backend.agent.pipelines.forecast import (
        AutoModelSelector,
        DemandPredictor,
        obtener_estrategias_disponibles,
    )
    from backend.core.db import get_db_connection

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

        with get_db_connection("sap_data") as conn:
            query, params = _build_consumo_query(material_codigo, centro)
            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 30:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros"}
            }), 400

        # Preparar features para auto-seleccion
        predictor = DemandPredictor()
        df_prep = predictor._preparar_features(df)
        df_prep = predictor._crear_lag_features(df_prep).dropna()

        if len(df_prep) < 20:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": "Datos insuficientes despues de preparacion"}
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
        logger.error(f"Error en auto-seleccion: {e}")
        return jsonify({"ok": False, "error": {"code": "autoselect_error", "message": str(e)}}), 500


@bp.route("/forecast/tune", methods=["POST"])
@require_auth
@rate_limit(requests=2, window_seconds=60)
def tune_hyperparameters():
    """
    Optimiza hiperparametros de un modelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "modelo": "random_forest",
            "n_iter": 30
        }

    Returns:
        Mejores hiperparametros encontrados
    """
    from backend.agent.pipelines.forecast import DemandPredictor, HyperparameterTuner
    from backend.core.db import get_db_connection

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
    Compara multiples modelos de forecast en paralelo.

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "AA101",
            "modelos": ["lstm", "stl", "random_forest"],
            "periodos": 30
        }

    Returns:
        Ranking de modelos con metricas (MAPE, RMSE, R2)
    """
    try:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        import pandas as pd

        from backend.agent.pipelines.forecast import obtener_estrategia
        from backend.core.db import get_db_connection

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

        # Obtener datos historicos
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
    Obtiene descomposicion STL de una serie temporal.

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
        from backend.core.db import get_db_connection

        data = request.get_json() or {}
        material_codigo = data.get("material_codigo")
        centro = data.get("centro", "")
        periodos = int(data.get("periodos", 30))

        if not material_codigo:
            return jsonify({
                "ok": False,
                "error": {"code": "bad_request", "message": "material_codigo es requerido"}
            }), 400

        # Obtener datos historicos
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
        logger.error(f"Error en descomposicion STL: {e}")
        return jsonify({"ok": False, "error": {"code": "decomposition_error", "message": str(e)}}), 500
