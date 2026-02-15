"""
Ensemble Strategy for Demand Forecasting
Combines multiple forecast strategies with weighted averaging.
Weights are proportional to 1/MAPE from backtesting.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from .base import ForecastStrategy

logger = logging.getLogger(__name__)


class EnsembleStrategy(ForecastStrategy):
    """
    Ensemble forecasting strategy that combines multiple models.

    Uses weighted averaging where weights are derived from model performance (1/MAPE).
    Trains and predicts using multiple strategies in parallel for efficiency.
    """

    def __init__(self, strategies: Optional[List[ForecastStrategy]] = None, weights: Optional[List[float]] = None):
        """
        Initialize ensemble strategy.

        Args:
            strategies: List of ForecastStrategy instances to combine
            weights: Optional manual weights (must sum to 1). If None, will be auto-calculated from MAPE
        """
        super().__init__()
        self.strategies = strategies or []
        self._manual_weights = weights
        self._weights = {}
        self._individual_metrics = {}

    @property
    def nombre_modelo(self) -> str:
        """Nombre legible del modelo"""
        return f"Ensemble ({len(self.strategies)} modelos)"

    @property
    def requiere_features_adicionales(self) -> bool:
        """El ensemble delega a las sub-estrategias"""
        return False

    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Entrena todos los modelos del ensemble en paralelo.

        Calcula pesos basados en 1/MAPE de cada modelo.

        Args:
            df: DataFrame con ['fecha', 'cantidad'] mínimo
            columna_objetivo: Columna a predecir
            test_size: Proporción para test

        Returns:
            Dict con métricas combinadas (weighted average)
        """
        # Validar datos básicos
        if not self.validar_datos(df, min_registros=5):
            logger.error("Datos insuficientes para entrenar ensemble")
            self.is_trained = False
            return {'mae': 0, 'rmse': 0, 'r2': 0, 'mape': 100}

        if not self.strategies:
            logger.error("No hay estrategias en el ensemble")
            self.is_trained = False
            return {'mae': 0, 'rmse': 0, 'r2': 0, 'mape': 100}

        # Guardar estadísticas básicas para fallback
        self._media_historica = df[columna_objetivo].mean()
        self._std_historica = df[columna_objetivo].std()
        self._ultimo_valor = df[columna_objetivo].iloc[-1] if len(df) > 0 else 0

        # Entrenar modelos en paralelo
        logger.info(f"Entrenando ensemble con {len(self.strategies)} modelos")
        self._individual_metrics = {}
        successful_strategies = []

        def entrenar_modelo(idx, strategy):
            """Función auxiliar para entrenar un modelo individual"""
            try:
                nombre = strategy.nombre_modelo
                logger.info(f"Entrenando modelo {idx + 1}/{len(self.strategies)}: {nombre}")
                metrics = strategy.entrenar(df, columna_objetivo, test_size)
                return idx, strategy, nombre, metrics
            except Exception as e:
                logger.warning(f"Error entrenando estrategia {idx}: {e}")
                return idx, None, None, None

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {
                executor.submit(entrenar_modelo, idx, strategy): idx
                for idx, strategy in enumerate(self.strategies)
            }

            for future in as_completed(futures):
                idx, strategy, nombre, metrics = future.result()
                if strategy is not None and metrics is not None:
                    self._individual_metrics[nombre] = metrics
                    successful_strategies.append((idx, strategy, nombre))

        if not successful_strategies:
            logger.error("Ningún modelo se entrenó exitosamente")
            self.is_trained = False
            return {'mae': 0, 'rmse': 0, 'r2': 0, 'mape': 100}

        # Actualizar lista de estrategias con solo las exitosas (preservando orden)
        successful_strategies.sort(key=lambda x: x[0])
        self.strategies = [s[1] for s in successful_strategies]
        strategy_names = [s[2] for s in successful_strategies]

        logger.info(f"{len(self.strategies)} modelos entrenados exitosamente")

        # Calcular pesos basados en MAPE (o usar weights manuales)
        if self._manual_weights and len(self._manual_weights) == len(self.strategies):
            # Usar pesos manuales
            weights_array = np.array(self._manual_weights)
            weights_array = weights_array / weights_array.sum()  # Normalizar
            self._weights = {
                nombre: weight
                for nombre, weight in zip(strategy_names, weights_array)
            }
            logger.info("Usando pesos manuales para ensemble")
        else:
            # Calcular pesos automáticamente desde MAPE
            mapes = []
            for nombre in strategy_names:
                mape = self._individual_metrics[nombre].get('mape', 100)
                # Usar max(mape, 0.1) para evitar división por cero y evitar pesos infinitos
                mapes.append(max(mape, 0.1))

            # Pesos proporcionales a 1/MAPE
            inverse_mapes = np.array([1.0 / mape for mape in mapes])
            weights_array = inverse_mapes / inverse_mapes.sum()

            self._weights = {
                nombre: weight
                for nombre, weight in zip(strategy_names, weights_array)
            }

            logger.info("Pesos calculados automáticamente:")
            for nombre, weight in self._weights.items():
                logger.info(f"  {nombre}: {weight:.3f}")

        # Calcular métricas combinadas (weighted average)
        combined_metrics = {
            'mae': 0.0,
            'rmse': 0.0,
            'r2': 0.0,
            'mape': 0.0
        }

        for nombre, weight in self._weights.items():
            metrics = self._individual_metrics[nombre]
            for key in combined_metrics:
                combined_metrics[key] += weight * metrics.get(key, 0)

        self.metrics = combined_metrics
        self.is_trained = True

        logger.info(f"Ensemble entrenado. Métricas combinadas: {combined_metrics}")

        return combined_metrics

    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """
        Genera predicciones combinando todos los modelos con weighted average.

        Args:
            df_historico: Datos históricos recientes
            periodos: Número de períodos a predecir

        Returns:
            DataFrame con ['fecha', 'prediccion', 'limite_inferior', 'limite_superior']
        """
        if not self.is_trained:
            logger.warning("Ensemble no entrenado, usando predicción simple")
            return self._prediccion_modelo_simple(df_historico, periodos)

        if not self.strategies:
            logger.error("No hay estrategias en el ensemble")
            return self._prediccion_modelo_simple(df_historico, periodos)

        # Validar datos históricos
        df_historico['fecha'] = pd.to_datetime(df_historico['fecha'])
        ultima_fecha = df_historico['fecha'].max()

        # Predecir con cada modelo en paralelo
        logger.info(f"Generando predicciones ensemble para {periodos} períodos")
        predicciones_individuales = {}

        def predecir_modelo(strategy):
            """Función auxiliar para predecir con un modelo individual"""
            try:
                nombre = strategy.nombre_modelo
                pred = strategy.predecir(df_historico, periodos)
                return nombre, pred
            except Exception as e:
                logger.warning(f"Error prediciendo con {strategy.nombre_modelo}: {e}")
                return None, None

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(predecir_modelo, strategy): strategy for strategy in self.strategies}

            for future in as_completed(futures):
                nombre, pred = future.result()
                if nombre is not None and pred is not None:
                    predicciones_individuales[nombre] = pred

        if not predicciones_individuales:
            logger.error("Ningún modelo generó predicciones")
            return self._prediccion_modelo_simple(df_historico, periodos)

        logger.info(f"{len(predicciones_individuales)} modelos generaron predicciones")

        # Combinar predicciones usando weighted average
        predicciones_ensemble = []

        for i in range(periodos):
            fecha_pred = ultima_fecha + timedelta(days=i + 1)

            # Promedios ponderados
            prediccion_ponderada = 0.0
            limite_inf_ponderado = 0.0
            limite_sup_ponderado = 0.0
            peso_total = 0.0

            for nombre, pred_df in predicciones_individuales.items():
                if i < len(pred_df):
                    peso = self._weights.get(nombre, 0)
                    peso_total += peso

                    fila = pred_df.iloc[i]
                    prediccion_ponderada += peso * fila.get('prediccion', 0)

                    # Para intervalos: weighted min/max para conservadurismo
                    # Usar get() para compatibilidad con diferentes nombres de columnas
                    lim_inf = fila.get('limite_inferior', fila.get('limiteInferior', fila.get('prediccion', 0)))
                    lim_sup = fila.get('limite_superior', fila.get('limiteSuperior', fila.get('prediccion', 0)))

                    limite_inf_ponderado += peso * lim_inf
                    limite_sup_ponderado += peso * lim_sup

            # Normalizar si hay pesos faltantes
            if peso_total > 0:
                prediccion_ponderada /= peso_total
                limite_inf_ponderado /= peso_total
                limite_sup_ponderado /= peso_total

            predicciones_ensemble.append({
                'fecha': fecha_pred,
                'prediccion': max(0, prediccion_ponderada),
                'limite_inferior': max(0, limite_inf_ponderado),
                'limite_superior': max(0, limite_sup_ponderado)
            })

        return pd.DataFrame(predicciones_ensemble)

    def get_feature_importance(self) -> pd.DataFrame:
        """
        Agrega feature importance de todas las sub-estrategias.

        Returns:
            DataFrame con ['feature', 'importance'] agregado
        """
        if not self.is_trained or not self.strategies:
            return pd.DataFrame(columns=['feature', 'importance'])

        # Recopilar importances de todos los modelos que las provean
        all_importances = {}

        for strategy in self.strategies:
            try:
                nombre = strategy.nombre_modelo
                peso = self._weights.get(nombre, 0)

                importance_df = strategy.get_feature_importance()

                if not importance_df.empty and 'feature' in importance_df.columns:
                    for _, row in importance_df.iterrows():
                        feature = row['feature']
                        importance = row.get('importance', 0)

                        if feature not in all_importances:
                            all_importances[feature] = 0

                        # Ponderar por peso del modelo
                        all_importances[feature] += peso * importance
            except Exception as e:
                logger.warning(f"Error obteniendo feature importance de {strategy.nombre_modelo}: {e}")

        if not all_importances:
            return pd.DataFrame(columns=['feature', 'importance'])

        # Convertir a DataFrame y ordenar
        importance_df = pd.DataFrame([
            {'feature': feature, 'importance': importance}
            for feature, importance in all_importances.items()
        ])

        importance_df = importance_df.sort_values('importance', ascending=False).reset_index(drop=True)

        return importance_df

    def get_weights(self) -> Dict[str, float]:
        """
        Retorna los pesos de cada modelo en el ensemble.

        Returns:
            Dict {nombre_modelo: peso}
        """
        return self._weights.copy()

    def get_individual_predictions(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> Dict[str, pd.DataFrame]:
        """
        Obtiene predicciones individuales de cada modelo.

        Útil para análisis y comparación.

        Args:
            df_historico: Datos históricos
            periodos: Número de períodos

        Returns:
            Dict {nombre_modelo: predicciones_df}
        """
        if not self.is_trained:
            logger.warning("Ensemble no entrenado")
            return {}

        predicciones = {}

        for strategy in self.strategies:
            try:
                nombre = strategy.nombre_modelo
                pred = strategy.predecir(df_historico, periodos)
                predicciones[nombre] = pred
            except Exception as e:
                logger.warning(f"Error prediciendo con {nombre}: {e}")

        return predicciones
