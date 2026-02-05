"""
Estrategia de Forecasting con STL Decomposition
================================================
STL (Seasonal and Trend decomposition using Loess) para descomposición de series temporales.

STL es ideal para:
- Series con patrones estacionales fuertes
- Analizar componentes: Trend, Seasonal, Residual
- Hacer pronósticos robustos basados en componentes
- Visualizar comportamiento subyacente

FASE 1 - SPM v3.0
"""
from typing import Dict, Tuple, Optional
import pandas as pd
import numpy as np
from datetime import timedelta
import logging

from .base import ForecastStrategy

logger = logging.getLogger(__name__)

# Importación opcional de statsmodels
try:
    from statsmodels.tsa.seasonal import STL
    STL_AVAILABLE = True
except ImportError:
    STL_AVAILABLE = False
    logger.warning("statsmodels no está instalado. Instale con: pip install statsmodels")


class STLDecompositionStrategy(ForecastStrategy):
    """
    Estrategia de forecasting usando STL Decomposition.

    STL descompone la serie en:
    - Trend: Componente de tendencia suave
    - Seasonal: Componente estacional periódica
    - Residual: Variación restante (ruido)

    Forecast se hace prediciendo cada componente por separado
    y combinándolos nuevamente.

    Características:
    - Período estacional: 7 días (semanal) por defecto
    - Robust: Usa mediana para evitar outliers
    - Intervalos de confianza: Basados en varianza de residuales
    """

    def __init__(self, seasonal: int = 7, trend: int = 31, **kwargs):
        """
        Args:
            seasonal: Período estacional (7=semanal, 30=mensual)
            trend: Ventana para estimación de tendencia
        """
        if not STL_AVAILABLE:
            raise ImportError(
                "statsmodels no está instalado. "
                "Instale con: pip install statsmodels"
            )
        super().__init__()

        self.seasonal = seasonal
        self.trend = trend
        self.stl_model = None
        self.resultado_stl = None  # Guardará trend, seasonal, residual
        self.is_trained = False

    @property
    def nombre_modelo(self) -> str:
        return "STL Decomposition"

    @property
    def requiere_features_adicionales(self) -> bool:
        """STL trabaja directamente con series univariadas"""
        return False

    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Entrena el descompositor STL.

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
            df = df.copy()
            df['fecha'] = pd.to_datetime(df['fecha'])
            df = df.set_index('fecha').sort_index()

            # Guardar estadísticas para fallback
            self._media_historica = df[columna_objetivo].mean()
            self._std_historica = df[columna_objetivo].std()
            self._ultimo_valor = df[columna_objetivo].iloc[-1] if len(df) > 0 else 0

            # Validar periodo estacional
            if len(df) < self.seasonal * 2:
                logger.info(
                    f"Serie muy corta ({len(df)} obs) para período estacional {self.seasonal}, "
                    f"usando modelo simple"
                )
                self._usar_modelo_simple = True
                self.is_trained = True
                return self._metricas_fallback()

            # Aplicar STL
            try:
                stl = STL(
                    df[columna_objetivo],
                    seasonal=self.seasonal,
                    trend=self.trend,
                    robust=True
                )
                self.resultado_stl = stl.fit()
                self.stl_model = stl
            except ValueError as e:
                logger.warning(f"STL falló: {str(e)}, usando modelo simple")
                self._usar_modelo_simple = True
                self.is_trained = True
                return self._metricas_fallback()

            # Validar descomposición
            trend = self.resultado_stl.trend.values
            seasonal = self.resultado_stl.seasonal.values
            residual = self.resultado_stl.resid.values

            # Pronosticar componentes
            forecast_trend = self._pronosticar_componente(trend, 30)
            forecast_seasonal = self._pronosticar_componente(seasonal, 30, trend=False)
            forecast_residual = self._pronosticar_componente(residual, 30, trend=False)

            # Combinar
            forecast_combinado = forecast_trend + forecast_seasonal + forecast_residual
            forecast_combinado = np.maximum(forecast_combinado, 0)

            # Metricas usando split train/test
            split_idx = int(len(df) * (1 - test_size))
            y_test = df[columna_objetivo].iloc[split_idx:].values

            # Pronosticar para test
            y_pred = self._predecir_internamente(df[columna_objetivo].iloc[:split_idx].values, len(y_test))

            self.metrics = self._calcular_metricas(y_test, y_pred)
            self.is_trained = True

            logger.info(f"STL entrenado. MAPE: {self.metrics['mape']:.2f}%")
            return self.metrics

        except Exception as e:
            logger.error(f"Error entrenando STL: {str(e)}")
            self._usar_modelo_simple = True
            self.is_trained = True
            return self._metricas_fallback()

    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """
        Genera predicciones futuras usando descomposición STL.

        Args:
            df_historico: Datos históricos recientes
            periodos: Número de períodos a predecir

        Returns:
            DataFrame con predicciones e intervalos
        """
        if self._usar_modelo_simple or not self.is_trained:
            return self._prediccion_modelo_simple(df_historico, periodos)

        try:
            df_historico = df_historico.copy()
            df_historico['fecha'] = pd.to_datetime(df_historico['fecha'])
            df_historico = df_historico.set_index('fecha').sort_index()

            ultima_fecha = df_historico.index.max()

            # Re-descomponer si es necesario (usar modelo entrenado)
            try:
                stl = STL(
                    df_historico['cantidad'],
                    seasonal=self.seasonal,
                    trend=self.trend,
                    robust=True
                )
                resultado = stl.fit()
            except:
                return self._prediccion_modelo_simple(df_historico.reset_index(), periodos)

            # Obtener componentes
            trend = resultado.trend.values
            seasonal = resultado.seasonal.values
            residual = resultado.resid.values

            # Pronosticar cada componente
            forecast_trend = self._pronosticar_componente(trend, periodos)
            forecast_seasonal = self._pronosticar_componente(seasonal, periodos, trend=False)
            forecast_residual = self._pronosticar_componente(residual, periodos, trend=False)

            # Combinar y asegurar valores no negativos
            predicciones = forecast_trend + forecast_seasonal + forecast_residual
            predicciones = np.maximum(predicciones, 0)

            # Calcular intervalos basados en varianza de residuales
            std_residual = np.std(residual)
            limites_inf = predicciones - 1.645 * std_residual
            limites_sup = predicciones + 1.645 * std_residual
            limites_inf = np.maximum(limites_inf, 0)

            # Crear DataFrame de salida
            resultados = []
            for i in range(periodos):
                fecha_pred = ultima_fecha + timedelta(days=i+1)
                resultados.append({
                    'fecha': fecha_pred,
                    'prediccion': float(predicciones[i]),
                    'limite_inferior': float(limites_inf[i]),
                    'limite_superior': float(limites_sup[i])
                })

            return pd.DataFrame(resultados)

        except Exception as e:
            logger.error(f"Error prediciendo con STL: {str(e)}")
            return self._prediccion_modelo_simple(df_historico.reset_index(), periodos)

    def get_feature_importance(self) -> pd.DataFrame:
        """STL no tiene feature importance"""
        return pd.DataFrame({'feature': [], 'importance': []})

    def get_descomposicion(self) -> Optional[Dict[str, np.ndarray]]:
        """
        Retorna los componentes de la descomposición STL.
        Útil para visualización en frontend.

        Returns:
            Dict con 'trend', 'seasonal', 'residual', 'fechas'
        """
        if self.resultado_stl is None:
            return None

        return {
            'trend': self.resultado_stl.trend.values,
            'seasonal': self.resultado_stl.seasonal.values,
            'residual': self.resultado_stl.resid.values,
            'fechas': self.resultado_stl.trend.index.astype(str).tolist()
        }

    # Métodos privados

    def _pronosticar_componente(
        self,
        componente: np.ndarray,
        periodos: int,
        trend: bool = True
    ) -> np.ndarray:
        """
        Pronostica un componente (trend, seasonal o residual).

        Args:
            componente: Array con valores del componente
            periodos: Número de períodos a pronosticar
            trend: Si es True, usa regresión lineal (para trend)
                   Si es False, repite últimos valores (para seasonal/residual)

        Returns:
            Array con predicciones
        """
        if trend:
            # Para trend: usar regresión lineal
            x = np.arange(len(componente))
            coeffs = np.polyfit(x, componente, 1)
            poly = np.poly1d(coeffs)

            x_futuro = np.arange(len(componente), len(componente) + periodos)
            return poly(x_futuro)
        else:
            # Para seasonal: repetir último ciclo estacional
            ventana_estacional = componente[-self.seasonal:] if len(componente) >= self.seasonal else componente
            ciclos_necesarios = (periodos // len(ventana_estacional)) + 1
            repetido = np.tile(ventana_estacional, ciclos_necesarios)
            return repetido[:periodos]

    def _predecir_internamente(self, datos: np.ndarray, periodos: int) -> np.ndarray:
        """
        Método interno para predecir durante entrenamiento.
        """
        try:
            from statsmodels.tsa.seasonal import STL as STL_Import

            # Crear serie temporal con los datos
            serie = pd.Series(datos, index=pd.date_range('2020-01-01', periods=len(datos), freq='D'))

            # Descomponer
            stl = STL_Import(
                serie,
                seasonal=min(self.seasonal, len(datos) // 2),
                trend=min(self.trend, len(datos) // 2),
                robust=True
            )
            resultado = stl.fit()

            # Pronosticar componentes
            trend = resultado.trend.values
            seasonal = resultado.seasonal.values
            residual = resultado.resid.values

            forecast_trend = self._pronosticar_componente(trend, periodos)
            forecast_seasonal = self._pronosticar_componente(seasonal, periodos, trend=False)
            forecast_residual = self._pronosticar_componente(residual, periodos, trend=False)

            predicciones = forecast_trend + forecast_seasonal + forecast_residual
            return np.maximum(predicciones[:periodos], 0)

        except Exception as e:
            logger.error(f"Error en predicción interna: {str(e)}")
            # Fallback: repetir último valor
            return np.full(periodos, datos[-1] if len(datos) > 0 else 0)

    def _metricas_fallback(self) -> Dict[str, float]:
        """Métricas cuando hay pocos datos"""
        cv = self._std_historica / self._media_historica if self._media_historica > 0 else 0.5
        return {
            'mae': self._std_historica * 0.8 if self._std_historica > 0 else self._media_historica * 0.2,
            'rmse': self._std_historica if self._std_historica > 0 else self._media_historica * 0.25,
            'r2': max(0, 1 - cv),
            'mape': min(cv * 100, 50)
        }
