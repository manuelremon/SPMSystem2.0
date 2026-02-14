"""
Estrategia de Forecasting con LSTM (Long Short-Term Memory)
============================================================
Implementación de redes neuronales LSTM para forecasting de demanda.

LSTM es ideal para:
- Series temporales con patrones complejos y no lineales
- Capturar dependencias a largo plazo
- Datos con estacionalidad variable
- Predicciones con intervalos de confianza mediante Monte Carlo Dropout

FASE 1 - SPM v3.0
"""
import logging
import warnings
from datetime import timedelta
from typing import Dict, Tuple

import numpy as np
import pandas as pd

from .base import ForecastStrategy

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

# Importaciones opcionales de TensorFlow
try:
    import tensorflow as tf  # noqa: F401
    from sklearn.preprocessing import MinMaxScaler
    from tensorflow import keras
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.optimizers import Adam
    LSTM_AVAILABLE = True
except ImportError:
    LSTM_AVAILABLE = False
    logger.warning("TensorFlow no está instalado. Instale con: pip install tensorflow")


class LSTMStrategy(ForecastStrategy):
    """
    Estrategia de forecasting usando redes neuronales LSTM.

    Características:
    - Normalización MinMax (mejor para LSTM que StandardScaler)
    - Arquitectura: LSTM(50) -> Dropout(0.2) -> LSTM(30) -> Dropout(0.2) -> Dense(1)
    - Training: 100 épocas, batch_size=32, early stopping
    - Intervalos de confianza: Monte Carlo Dropout (100 passes)
    """

    def __init__(self, lookback: int = 30, epochs: int = 100, batch_size: int = 32, **kwargs):
        """
        Args:
            lookback: Número de pasos anteriores a usar como entrada (ventana de observación)
            epochs: Número de épocas de entrenamiento
            batch_size: Tamaño del batch
        """
        if not LSTM_AVAILABLE:
            raise ImportError(
                "TensorFlow no está instalado. "
                "Instale con: pip install tensorflow"
            )
        super().__init__()

        self.lookback = lookback
        self.epochs = epochs
        self.batch_size = batch_size
        self.modelo = None  # Será una red Sequential de Keras
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.is_trained = False
        self._historico_escalado = None

    @property
    def nombre_modelo(self) -> str:
        return "LSTM Neural Network"

    @property
    def requiere_features_adicionales(self) -> bool:
        """LSTM trabaja directamente con series univariadas"""
        return False

    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Entrena la red LSTM.

        Args:
            df: DataFrame con ['fecha', 'cantidad']
            columna_objetivo: Columna a predecir
            test_size: Proporción para validación

        Returns:
            Dict con métricas
        """
        if not self.validar_datos(df):
            self._usar_modelo_simple = True
            return {'mae': 0.0, 'rmse': 0.0, 'r2': 0.0, 'mape': 0.0}

        try:
            # Preparar datos
            datos = df[columna_objetivo].values.reshape(-1, 1)

            # Guardar estadísticas para fallback
            self._media_historica = df[columna_objetivo].mean()
            self._std_historica = df[columna_objetivo].std()
            self._ultimo_valor = df[columna_objetivo].iloc[-1] if len(df) > 0 else 0

            # Normalizar
            datos_escalados = self.scaler.fit_transform(datos)
            self._historico_escalado = datos_escalados

            # Crear secuencias (X, y)
            X, y = self._crear_secuencias(datos_escalados, self.lookback)

            if len(X) < 10:
                logger.info(f"Solo {len(X)} secuencias, usando modelo simple")
                self._usar_modelo_simple = True
                self.is_trained = True
                return self._metricas_fallback()

            # Split train/test
            split_idx = int(len(X) * (1 - test_size))
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]

            # Crear modelo
            self.modelo = self._crear_modelo(X_train.shape[1])

            # Entrenar con early stopping
            early_stop = keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True
            )

            self.modelo.fit(
                X_train, y_train,
                epochs=self.epochs,
                batch_size=self.batch_size,
                validation_data=(X_test, y_test),
                callbacks=[early_stop],
                verbose=0
            )

            # Evaluar
            y_pred = self.modelo.predict(X_test, verbose=0)
            y_test_originales = self.scaler.inverse_transform(y_test)
            y_pred_originales = self.scaler.inverse_transform(y_pred)

            self.metrics = self._calcular_metricas(
                y_test_originales.flatten(),
                y_pred_originales.flatten()
            )

            self.is_trained = True
            logger.info(f"LSTM entrenado. MAPE: {self.metrics['mape']:.2f}%")

            return self.metrics

        except Exception as e:
            logger.error(f"Error entrenando LSTM: {str(e)}")
            self._usar_modelo_simple = True
            self.is_trained = True
            return self._metricas_fallback()

    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """
        Genera predicciones futuras con intervalos de confianza.

        Args:
            df_historico: Datos históricos recientes
            periodos: Número de períodos a predecir

        Returns:
            DataFrame con predicciones e intervalos
        """
        if self._usar_modelo_simple or not self.is_trained:
            return self._prediccion_modelo_simple(df_historico, periodos)

        try:
            df_historico['fecha'] = pd.to_datetime(df_historico['fecha'])
            ultima_fecha = df_historico['fecha'].max()

            # Preparar datos históricos
            datos = df_historico['cantidad'].values.reshape(-1, 1)
            datos_escalados = self.scaler.transform(datos)

            # Inicializar con última ventana
            ultima_ventana = datos_escalados[-self.lookback:].reshape(1, self.lookback, 1)

            predicciones = []
            lista_ventanas = [ultima_ventana[0].copy()]

            # Predecir paso a paso
            for _ in range(periodos):
                prediccion_escalada = self.modelo.predict(
                    ultima_ventana,
                    verbose=0
                )
                predicciones.append(prediccion_escalada[0, 0])

                # Actualizar ventana
                nueva_ventana = np.append(lista_ventanas[-1][1:], prediccion_escalada[0])
                lista_ventanas.append(nueva_ventana.copy())
                ultima_ventana = nueva_ventana.reshape(1, self.lookback, 1)

            # Desescalar predicciones
            predicciones = np.array(predicciones).reshape(-1, 1)
            predicciones_originales = self.scaler.inverse_transform(predicciones)

            # Calcular intervalos mediante Monte Carlo Dropout
            limites_inf, limites_sup = self._calcular_intervalos_monte_carlo(
                df_historico,
                periodos,
                predicciones_originales.flatten()
            )

            # Crear DataFrame de salida
            resultados = []
            for i in range(periodos):
                fecha_pred = ultima_fecha + timedelta(days=i+1)
                resultados.append({
                    'fecha': fecha_pred,
                    'prediccion': max(0, predicciones_originales[i, 0]),
                    'limite_inferior': max(0, limites_inf[i]),
                    'limite_superior': limites_sup[i]
                })

            return pd.DataFrame(resultados)

        except Exception as e:
            logger.error(f"Error prediciendo con LSTM: {str(e)}")
            return self._prediccion_modelo_simple(df_historico, periodos)

    def get_feature_importance(self) -> pd.DataFrame:
        """LSTM no tiene feature importance tradicional"""
        return pd.DataFrame({'feature': [], 'importance': []})

    # Métodos privados

    def _crear_modelo(self, timesteps: int) -> "Sequential":
        """Crea arquitectura LSTM"""
        modelo = Sequential([
            LSTM(50, activation='relu', input_shape=(timesteps, 1), return_sequences=True),
            Dropout(0.2),
            LSTM(30, activation='relu'),
            Dropout(0.2),
            Dense(1, activation='linear')
        ])

        modelo.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
        return modelo

    def _crear_secuencias(self, datos: np.ndarray, lookback: int) -> Tuple[np.ndarray, np.ndarray]:
        """Crea secuencias para LSTM"""
        X, y = [], []

        for i in range(len(datos) - lookback):
            X.append(datos[i:(i + lookback), 0])
            y.append(datos[i + lookback, 0])

        return np.array(X).reshape(-1, lookback, 1), np.array(y).reshape(-1, 1)

    def _calcular_intervalos_monte_carlo(
        self,
        df_historico: pd.DataFrame,
        periodos: int,
        predicciones: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calcula intervalos de confianza mediante Monte Carlo Dropout.
        Ejecuta el modelo 100 veces con dropout activo.
        """
        try:
            n_iteraciones = 100
            predicciones_mc = []

            datos = df_historico['cantidad'].values.reshape(-1, 1)
            datos_escalados = self.scaler.transform(datos)
            ultima_ventana = datos_escalados[-self.lookback:].reshape(1, self.lookback, 1)

            for _ in range(n_iteraciones):
                preds_iter = []
                ventana_actual = ultima_ventana.copy()

                for _ in range(periodos):
                    # Predecir con dropout activo (training=True)
                    pred = self.modelo(ventana_actual, training=True)
                    preds_iter.append(pred.numpy()[0, 0])

                    # Actualizar ventana
                    ventana_actual = np.append(ventana_actual[0][1:], pred.numpy()[0])
                    ventana_actual = ventana_actual.reshape(1, self.lookback, 1)

                predicciones_mc.append(preds_iter)

            predicciones_mc = np.array(predicciones_mc)

            # Desescalar
            predicciones_mc_originales = self.scaler.inverse_transform(
                predicciones_mc.T
            ).T

            # Percentiles
            limites_inf = np.percentile(predicciones_mc_originales, 10, axis=0)
            limites_sup = np.percentile(predicciones_mc_originales, 90, axis=0)

            return limites_inf, limites_sup

        except Exception as e:
            logger.warning(f"Error en Monte Carlo: {str(e)}, usando desviación estándar")

            # Fallback: usar desviación estándar del histórico
            std = df_historico['cantidad'].std()
            limites_inf = predicciones - 1.645 * std
            limites_sup = predicciones + 1.645 * std

            return np.maximum(limites_inf, 0), limites_sup

    def _metricas_fallback(self) -> Dict[str, float]:
        """Métricas cuando hay pocos datos"""
        cv = self._std_historica / self._media_historica if self._media_historica > 0 else 0.5
        return {
            'mae': self._std_historica * 0.8 if self._std_historica > 0 else self._media_historica * 0.2,
            'rmse': self._std_historica if self._std_historica > 0 else self._media_historica * 0.25,
            'r2': max(0, 1 - cv),
            'mape': min(cv * 100, 50)
        }
