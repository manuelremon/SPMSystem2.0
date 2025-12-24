"""
Servicio unificado de IA para recomendaciones inteligentes.
Sprint 6.2 - Orquesta todos los pipelines ML.

Integra:
- ClusteringPipeline: Agrupacion de materiales y solicitudes
- ScoringPipeline: Priorizacion y ranking
- DemandForecastPipeline: Prediccion de demanda
- MRP Service: Stock y alertas (Sprint 5)

Este servicio proporciona una API unificada para todas las
funcionalidades de IA/ML del sistema SPM.
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def get_db_connection():
    """Obtiene conexion a base de datos."""
    try:
        from backend.core.db import get_db_connection as db_conn

        return db_conn()
    except ImportError:
        from core.db import get_db_connection as db_conn

        return db_conn()


def _sql_now_minus(interval: str) -> str:
    """Helper para obtener expresion SQL NOW() - interval compatible."""
    try:
        from backend.core.db import sql_now_minus
        return sql_now_minus(interval)
    except ImportError:
        from core.db import sql_now_minus
        return sql_now_minus(interval)


class AIService:
    """
    Servicio unificado de inteligencia artificial.

    Proporciona:
    - Entrenamiento de modelos ML
    - Recomendaciones de materiales similares
    - Priorizacion de solicitudes
    - Proyeccion de demanda
    - Sugerencias de accion automaticas
    - Alertas inteligentes
    - Analisis completo de materiales
    """

    def __init__(self):
        """Inicializa el servicio con todos los pipelines."""
        try:
            from backend.agent.pipelines.clustering import ClusteringPipeline
            from backend.agent.pipelines.demand_forecast import DemandForecastPipeline
            from backend.agent.pipelines.scoring import ScoringPipeline
        except ImportError:
            from agent.pipelines.clustering import ClusteringPipeline
            from agent.pipelines.demand_forecast import DemandForecastPipeline
            from agent.pipelines.scoring import ScoringPipeline

        self.clustering = ClusteringPipeline()
        self.scoring = ScoringPipeline()
        self.forecast = DemandForecastPipeline()

        self._pipelines_trained = False
        self._last_training_date: Optional[datetime] = None

        # Cache simple para recomendaciones
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, datetime] = {}

    def get_status(self) -> Dict[str, Any]:
        """
        Retorna estado de todos los pipelines.

        Returns:
            Estado de cada pipeline y del servicio general
        """
        return {
            "clustering": self.clustering.get_status(),
            "scoring": self.scoring.get_status(),
            "forecast": self.forecast.get_status(),
            "pipelines_trained": self._pipelines_trained,
            "last_training_date": (
                self._last_training_date.isoformat() if self._last_training_date else None
            ),
            "cache_size": len(self._cache),
        }

    def train_pipelines(
        self, solicitudes_data: List[Dict[str, Any]], materiales_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Entrena todos los pipelines ML con datos historicos.

        Args:
            solicitudes_data: Datos historicos de solicitudes
            materiales_data: Datos de materiales

        Returns:
            Resultado del entrenamiento de cada pipeline
        """
        results = {
            "status": "trained",
            "clustering": {"status": "skipped"},
            "forecast": {"status": "skipped"},
            "errors": [],
        }

        # Entrenar clustering de materiales
        try:
            if len(materiales_data) >= 3:
                cluster_result = self.clustering.fit_material_clusters(materiales_data)
                results["clustering"] = cluster_result
            else:
                results["clustering"] = {"status": "skipped", "reason": "insufficient_data"}
        except Exception as e:
            logger.warning(f"Error entrenando clustering: {e}")
            results["clustering"] = {"status": "error", "error": str(e)}
            results["errors"].append(f"clustering: {e}")

        # Entrenar forecast de demanda
        try:
            if len(solicitudes_data) >= 10:
                forecast_result = self.forecast.fit(solicitudes_data)
                results["forecast"] = forecast_result
            else:
                results["forecast"] = {"status": "skipped", "reason": "insufficient_data"}
        except Exception as e:
            logger.warning(f"Error entrenando forecast: {e}")
            results["forecast"] = {"status": "error", "error": str(e)}
            results["errors"].append(f"forecast: {e}")

        # Determinar estado final
        clustering_ok = results["clustering"].get("status") == "fitted"
        forecast_ok = results["forecast"].get("status") == "fitted"

        if results["errors"]:
            if len(results["errors"]) == 2:
                results["status"] = "error"
            else:
                results["status"] = "partial"
        elif not clustering_ok and not forecast_ok:
            # Ambos fueron saltados
            results["status"] = "skipped"
        else:
            self._pipelines_trained = True
            self._last_training_date = datetime.now(timezone.utc)

        return results

    # ========================================================================
    # RECOMENDACIONES
    # ========================================================================

    def recomendar_materiales_similares(
        self, material_codigo: str, centro: str, max_resultados: int = 5
    ) -> Dict[str, Any]:
        """
        Recomienda materiales similares basado en clustering.

        Args:
            material_codigo: Codigo del material de referencia
            centro: Centro de costo
            max_resultados: Numero maximo de resultados

        Returns:
            Lista de materiales similares con scores
        """
        try:
            if self.clustering.model is not None:
                result = self.clustering.group_similar_materials(
                    material_codigo, similitud_minima=0.5
                )
                result["centro"] = centro
                result["max_resultados"] = max_resultados
                return result
            else:
                # Fallback: buscar por descripcion similar
                return self._fallback_materiales_similares(material_codigo, centro, max_resultados)
        except Exception as e:
            logger.error(f"Error recomendando materiales similares: {e}")
            return {"material_referencia": material_codigo, "similares": [], "error": str(e)}

    def priorizar_solicitudes(
        self, solicitudes: List[Dict[str, Any]], presupuesto_disponible: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Prioriza lista de solicitudes usando scoring ML.

        Args:
            solicitudes: Lista de solicitudes a priorizar
            presupuesto_disponible: Presupuesto disponible (opcional)

        Returns:
            Solicitudes rankeadas con scores
        """
        if not solicitudes:
            return {
                "total_solicitudes": 0,
                "solicitudes_rankeadas": [],
                "criterios": self.scoring.weights,
            }

        return self.scoring.rank_solicitudes(solicitudes)

    def proyectar_demanda(
        self, material_codigo: str, centro: str, dias: int = 30,
        modelo_tipo: str = "random_forest", almacen: str = ""
    ) -> Dict[str, Any]:
        """
        Proyecta demanda futura usando forecast ML.

        Args:
            material_codigo: Codigo del material
            centro: Centro de costo
            dias: Dias a proyectar
            modelo_tipo: Tipo de modelo ML (random_forest, gradient_boosting, linear, ridge)
            almacen: Codigo de almacen (opcional, filtra datos historicos)

        Returns:
            Proyeccion con intervalo de confianza
        """
        try:
            # Usar nuevo módulo de forecast
            from agent.pipelines.forecast import DemandPredictor
            from core.db import get_db_connection
            import pandas as pd

            # Obtener datos históricos de consumo con filtros opcionales de centro y almacen
            with get_db_connection("sap_data") as conn:
                # Construir query con filtros opcionales
                params = [material_codigo]
                conditions = ["material = ?"]

                if centro:
                    conditions.append("centro = ?")
                    params.append(centro)

                if almacen:
                    conditions.append("almacen = ?")
                    params.append(almacen)

                where_clause = " AND ".join(conditions)
                query = f"""
                    SELECT fecha, SUM(cantidad) as cantidad
                    FROM consumo_historico
                    WHERE {where_clause}
                    GROUP BY fecha
                    ORDER BY fecha
                """
                df = pd.read_sql_query(query, conn, params=params)

            if len(df) < 10:
                return self._fallback_proyeccion(material_codigo, centro, dias)

            # Crear predictor y generar forecast
            predictor = DemandPredictor(modelo=modelo_tipo)
            metricas = predictor.entrenar(df)
            predicciones_df = predictor.predecir(df, periodos=dias)

            # Formatear predicciones para el frontend
            predicciones = []
            for _, row in predicciones_df.iterrows():
                predicciones.append({
                    "fecha": row['fecha'].strftime('%Y-%m-%d') if hasattr(row['fecha'], 'strftime') else str(row['fecha']),
                    "cantidad_predicha": round(float(row['prediccion']), 2),
                    "limite_inferior": round(float(row['limite_inferior']), 2),
                    "limite_superior": round(float(row['limite_superior']), 2)
                })

            return {
                "material": material_codigo,
                "centro": centro,
                "modelo": modelo_tipo,
                "nombre_modelo": predictor.nombre_modelo,
                "dias": dias,
                "predicciones": predicciones,
                "metricas": {
                    "mae": round(metricas.get('mae', 0), 2),
                    "rmse": round(metricas.get('rmse', 0), 2),
                    "r2": round(metricas.get('r2', 0), 4),
                    "mape": round(metricas.get('mape', 0), 2)
                },
                "historico": df.tail(30).to_dict('records'),
                "fecha_generacion": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Error proyectando demanda: {e}")
            return self._fallback_proyeccion(material_codigo, centro, dias)

    # ========================================================================
    # SUGERENCIAS AUTOMATICAS
    # ========================================================================

    def sugerir_accion(self, solicitud: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sugiere accion para una solicitud.

        Args:
            solicitud: Datos de la solicitud

        Returns:
            Accion sugerida con nivel de confianza
        """
        try:
            # Calcular score de la solicitud
            score_result = self.scoring.score_solicitud(solicitud)
            total_score = score_result["total_score"]
            priority = score_result["priority_level"]

            # Determinar accion basada en score y reglas
            if total_score >= 0.8:
                accion = "aprobar"
                confianza = 0.9
                motivo = "Solicitud critica con alta prioridad"
            elif total_score >= 0.6:
                accion = "revisar"
                confianza = 0.7
                motivo = "Requiere revision antes de aprobar"
            elif total_score >= 0.4:
                accion = "escalar"
                confianza = 0.6
                motivo = "Considerar escalar a supervisor"
            else:
                accion = "rechazar"
                confianza = 0.5
                motivo = "Baja prioridad, considerar rechazar"

            metodo = "ml_scoring" if self._pipelines_trained else "reglas_basicas"

            return {
                "solicitud_id": solicitud.get("id"),
                "accion_sugerida": accion,
                "confianza": confianza,
                "motivo": motivo,
                "score": total_score,
                "prioridad": priority,
                "metodo": metodo,
                "detalles_score": score_result["scores"],
            }

        except Exception as e:
            logger.error(f"Error sugiriendo accion: {e}")
            return {
                "solicitud_id": solicitud.get("id"),
                "accion_sugerida": "revisar",
                "confianza": 0.3,
                "motivo": f"Error en analisis: {e}",
                "metodo": "reglas_basicas",
            }

    def sugerir_cantidad_optima(
        self,
        material_codigo: str,
        centro: str,
        demanda_anual: Optional[float] = None,
        costo_orden: float = 50.0,
        costo_mantenimiento: float = 2.0,
    ) -> Dict[str, Any]:
        """
        Sugiere cantidad optima de pedido (EOQ).

        Args:
            material_codigo: Codigo del material
            centro: Centro de costo
            demanda_anual: Demanda anual (estimada si no se proporciona)
            costo_orden: Costo por orden
            costo_mantenimiento: Costo de mantenimiento unitario

        Returns:
            Cantidad sugerida con justificacion
        """
        try:
            # Si no hay demanda anual, estimar con forecast
            if demanda_anual is None:
                if self.forecast.model is not None:
                    forecast = self.forecast.predict(material_codigo, centro, 365)
                    demanda_anual = forecast["predicted_demand"] * 12  # Mensual a anual
                else:
                    demanda_anual = 1000  # Default

            # Calcular EOQ: sqrt(2 * D * S / H)
            eoq = math.sqrt((2 * demanda_anual * costo_orden) / costo_mantenimiento)

            return {
                "material_codigo": material_codigo,
                "centro": centro,
                "cantidad_sugerida": round(eoq),
                "demanda_anual_estimada": demanda_anual,
                "metodo": "eoq_formula",
                "parametros": {
                    "costo_orden": costo_orden,
                    "costo_mantenimiento": costo_mantenimiento,
                },
            }

        except Exception as e:
            logger.error(f"Error calculando cantidad optima: {e}")
            return {
                "material_codigo": material_codigo,
                "cantidad_sugerida": 100,  # Default
                "metodo": "default",
                "error": str(e),
            }

    def generar_alertas_inteligentes(self, centro: str) -> Dict[str, Any]:
        """
        Genera alertas basadas en patrones ML.

        Args:
            centro: Centro de costo

        Returns:
            Lista de alertas con severidad y recomendacion
        """
        alertas = []

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT codigo, stock_actual, punto_pedido, stock_seguridad
                    FROM catalogo_materiales
                    WHERE centro = ? AND activo = 1
                """,
                    (centro,),
                )
                materiales = cursor.fetchall()

                for mat in materiales:
                    if not mat:
                        continue

                    codigo = mat.get("codigo") or mat[0]
                    stock = mat.get("stock_actual") or mat[1] or 0
                    punto_pedido = mat.get("punto_pedido") or mat[2] or 0
                    stock_seg = mat.get("stock_seguridad") or mat[3] or 0

                    # Detectar anomalias
                    if stock < stock_seg:
                        alertas.append(
                            {
                                "tipo": "quiebre_stock",
                                "severidad": "critical",
                                "material": codigo,
                                "mensaje": f"Stock ({stock}) bajo nivel de seguridad ({stock_seg})",
                                "accion_sugerida": "Generar orden urgente",
                            }
                        )
                    elif stock < punto_pedido:
                        alertas.append(
                            {
                                "tipo": "bajo_punto_pedido",
                                "severidad": "warning",
                                "material": codigo,
                                "mensaje": f"Stock ({stock}) bajo punto de pedido ({punto_pedido})",
                                "accion_sugerida": "Programar reposicion",
                            }
                        )

        except Exception as e:
            logger.error(f"Error generando alertas: {e}")
            alertas.append(
                {
                    "tipo": "error_sistema",
                    "severidad": "info",
                    "mensaje": f"No se pudieron analizar algunos materiales: {e}",
                }
            )

        return {
            "centro": centro,
            "alertas": alertas,
            "total_alertas": len(alertas),
            "generado_en": datetime.now(timezone.utc).isoformat(),
        }

    # ========================================================================
    # ANALISIS COMPLETO
    # ========================================================================

    def analisis_completo_material(self, material_codigo: str, centro: str) -> Dict[str, Any]:
        """
        Analisis completo de material integrando MRP y ML.

        Args:
            material_codigo: Codigo del material
            centro: Centro de costo

        Returns:
            Analisis completo con recomendaciones IA
        """
        result = {
            "material": material_codigo,
            "centro": centro,
            "stock_status": {},
            "recomendacion_ia": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT codigo_material, descripcion, stock_actual, stock_seguridad,
                           punto_pedido, consumo_promedio_mensual, precio_usd
                    FROM catalogo_materiales
                    WHERE codigo_material = ? AND centro = ?
                """,
                    (material_codigo, centro),
                )
                material = cursor.fetchone()

                if material:
                    stock = material.get("stock_actual") or 0
                    stock_seg = material.get("stock_seguridad") or 0
                    punto_pedido = material.get("punto_pedido") or 0
                    consumo = material.get("consumo_promedio_mensual") or 0
                    precio = material.get("precio_usd") or 0

                    # Status de stock
                    if stock < stock_seg:
                        status = "critico"
                    elif stock < punto_pedido:
                        status = "bajo"
                    else:
                        status = "normal"

                    result["material"] = {
                        "codigo": material_codigo,
                        "descripcion": material.get("descripcion"),
                        "precio_usd": precio,
                    }
                    result["stock_status"] = {
                        "actual": stock,
                        "seguridad": stock_seg,
                        "punto_pedido": punto_pedido,
                        "status": status,
                        "dias_cobertura": (round(stock / (consumo / 30)) if consumo > 0 else None),
                    }

                    # Recomendacion IA
                    material_data = {
                        "codigo": material_codigo,
                        "descripcion": material.get("descripcion"),
                        "precio_usd": precio,
                    }
                    score_result = self.scoring.score_material(
                        material_data,
                        demanda_historica=consumo,
                        disponibilidad=1.0 if status == "normal" else 0.5,
                    )

                    result["recomendacion_ia"] = {
                        "score": score_result["total_score"],
                        "prioridad": score_result["priority"],
                        "accion": score_result["recomendacion"],
                    }

        except Exception as e:
            logger.error(f"Error en analisis completo: {e}")
            result["error"] = str(e)
            result["recomendacion_ia"] = {
                "accion": "revisar_manualmente",
                "motivo": f"Error en analisis: {e}",
            }

        return result

    # ========================================================================
    # CACHE
    # ========================================================================

    def cache_recommendation(
        self, key: str, tipo: str, data: Dict[str, Any], ttl_seconds: int = 300
    ) -> None:
        """
        Cachea una recomendacion.

        Args:
            key: Clave unica (ej: material_codigo)
            tipo: Tipo de recomendacion
            data: Datos a cachear
            ttl_seconds: Tiempo de vida en segundos
        """
        cache_key = f"{key}:{tipo}"
        self._cache[cache_key] = data
        self._cache_timestamps[cache_key] = datetime.now(timezone.utc) + timedelta(
            seconds=ttl_seconds
        )

    def get_cached_recommendation(self, key: str, tipo: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene recomendacion cacheada si no ha expirado.

        Args:
            key: Clave unica
            tipo: Tipo de recomendacion

        Returns:
            Datos cacheados o None si expiro/no existe
        """
        cache_key = f"{key}:{tipo}"

        if cache_key not in self._cache:
            return None

        expiration = self._cache_timestamps.get(cache_key)
        if expiration and datetime.now(timezone.utc) > expiration:
            # Expirado, eliminar
            del self._cache[cache_key]
            del self._cache_timestamps[cache_key]
            return None

        return self._cache.get(cache_key)

    # ========================================================================
    # FALLBACKS
    # ========================================================================

    def _fallback_materiales_similares(
        self, material_codigo: str, centro: str, max_resultados: int
    ) -> Dict[str, Any]:
        """Fallback para materiales similares sin ML."""
        return {
            "material_referencia": material_codigo,
            "similares": [],
            "metodo": "fallback",
            "mensaje": "ML no entrenado, usar busqueda manual",
        }

    def _fallback_proyeccion(self, material_codigo: str, centro: str, dias: int) -> Dict[str, Any]:
        """Fallback para proyeccion sin ML."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT AVG(total_monto) as consumo_promedio
                    FROM solicitudes
                    WHERE material_codigo = ? AND centro = ?
                    AND created_at > {_sql_now_minus("90 days")}
                """,
                    (material_codigo, centro),
                )
                result = cursor.fetchone()
                consumo = (result.get("consumo_promedio") or 0) if result else 0
        except Exception:
            consumo = 100  # Default

        # Generar predicciones para cada día con estructura consistente
        from datetime import date
        predicciones = []
        base_date = date.today()
        for i in range(1, dias + 1):
            fecha = base_date + timedelta(days=i)
            predicciones.append({
                "fecha": fecha.strftime('%Y-%m-%d'),
                "cantidad_predicha": round(consumo, 2),
                "limite_inferior": round(consumo * 0.8, 2),
                "limite_superior": round(consumo * 1.2, 2)
            })

        return {
            "material": material_codigo,
            "centro": centro,
            "modelo": "fallback",
            "nombre_modelo": "Promedio Histórico",
            "dias": dias,
            "predicciones": predicciones,
            "metricas": {
                "mae": 0,
                "rmse": 0,
                "r2": 0,
                "mape": 0
            },
            "historico": [],
            "metodo": "promedio_historico",
            "fecha_generacion": datetime.now(timezone.utc).isoformat()
        }


# Instancia singleton para uso global
_ai_service_instance: Optional[AIService] = None


def get_ai_service() -> AIService:
    """
    Obtiene instancia singleton del servicio IA.

    Returns:
        Instancia de AIService
    """
    global _ai_service_instance
    if _ai_service_instance is None:
        _ai_service_instance = AIService()
    return _ai_service_instance
