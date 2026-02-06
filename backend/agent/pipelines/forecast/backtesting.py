"""
Módulo de Backtesting para Forecast

Proporciona herramientas para evaluar la precisión real de los modelos
mediante simulación de predicciones históricas.

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import warnings

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

# Número máximo de workers para paralelización
MAX_WORKERS = 4


@dataclass
class BacktestStep:
    """Resultado de un paso individual de backtesting"""
    fecha_corte: datetime
    fecha_inicio_test: datetime
    fecha_fin_test: datetime
    n_train: int
    n_test: int
    predicciones: pd.Series
    valores_reales: pd.Series
    mae: float
    rmse: float
    mape: float
    r2: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            'fecha_corte': self.fecha_corte.isoformat(),
            'fecha_inicio_test': self.fecha_inicio_test.isoformat(),
            'fecha_fin_test': self.fecha_fin_test.isoformat(),
            'n_train': int(self.n_train),
            'n_test': int(self.n_test),
            'mae': round(float(self.mae), 2),
            'rmse': round(float(self.rmse), 2),
            'mape': round(float(self.mape), 2) if not np.isinf(self.mape) else None,
            'r2': round(float(self.r2), 4)
        }


@dataclass
class BacktestReport:
    """Reporte completo de backtesting"""
    modelo_tipo: str
    steps: List[BacktestStep]
    ventana_test: int
    n_pasos: int
    metricas_agregadas: Dict[str, float]
    metricas_por_periodo: pd.DataFrame
    timestamp: datetime = field(default_factory=datetime.now)

    @property
    def mae_promedio(self) -> float:
        return self.metricas_agregadas.get('mae_mean', 0)

    @property
    def mae_std(self) -> float:
        return self.metricas_agregadas.get('mae_std', 0)

    @property
    def es_estable(self) -> bool:
        """Modelo es estable si el coeficiente de variación de MAE < 0.5"""
        if self.mae_promedio == 0:
            return True
        cv = self.mae_std / self.mae_promedio
        return cv < 0.5

    def to_dict(self) -> Dict[str, Any]:
        return {
            'modelo_tipo': self.modelo_tipo,
            'ventana_test': self.ventana_test,
            'n_pasos': self.n_pasos,
            'metricas_agregadas': {k: round(float(v), 4) for k, v in self.metricas_agregadas.items()},
            'es_estable': bool(self.es_estable),
            'steps': [s.to_dict() for s in self.steps],
            'timestamp': self.timestamp.isoformat()
        }


class Backtester:
    """
    Ejecutor de backtesting para modelos de forecast.
    Implementa walk-forward validation.
    """

    def __init__(self, predictor_class, modelo_tipo: str = 'random_forest'):
        self.predictor_class = predictor_class
        self.modelo_tipo = modelo_tipo

    def ejecutar(
        self,
        df: pd.DataFrame,
        columna_fecha: str = 'fecha',
        columna_cantidad: str = 'cantidad',
        ventana_test: int = 30,
        n_pasos: int = 5,
        min_train: int = 60,
        stride: Optional[int] = None,
        paralelo: bool = True
    ) -> BacktestReport:
        """
        Ejecuta backtesting walk-forward.

        Args:
            df: DataFrame con datos históricos
            columna_fecha: Nombre de columna de fecha
            columna_cantidad: Nombre de columna de cantidad
            ventana_test: Días por ventana de test
            n_pasos: Número de pasos walk-forward
            min_train: Mínimo de datos para entrenamiento
            stride: Salto entre ventanas (default = ventana_test)
            paralelo: Si True, ejecuta pasos en paralelo (default True)
        """
        logger.info(f"Iniciando backtesting: {n_pasos} pasos, ventana={ventana_test} días, paralelo={paralelo}")

        df_prep = self._preparar_datos(df, columna_fecha, columna_cantidad)

        if len(df_prep) < min_train + ventana_test:
            raise ValueError(
                f"Datos insuficientes para backtesting. "
                f"Necesita al menos {min_train + ventana_test} días, tiene {len(df_prep)}"
            )

        stride = stride or ventana_test
        fechas_corte = self._calcular_fechas_corte(
            df_prep, columna_fecha, ventana_test, n_pasos, min_train, stride
        )

        # Ejecutar pasos en paralelo o secuencial
        if paralelo and len(fechas_corte) > 1:
            steps = self._ejecutar_pasos_paralelo(
                df_prep, fechas_corte, columna_fecha, columna_cantidad, ventana_test
            )
        else:
            steps = self._ejecutar_pasos_secuencial(
                df_prep, fechas_corte, columna_fecha, columna_cantidad, ventana_test
            )

        if not steps:
            raise ValueError("No se completó ningún paso de backtesting")

        metricas_agregadas = self._calcular_metricas_agregadas(steps)
        metricas_por_periodo = self._crear_metricas_por_periodo(steps)

        logger.info(
            f"Backtesting completado: MAE={metricas_agregadas['mae_mean']:.2f} "
            f"(±{metricas_agregadas['mae_std']:.2f})"
        )

        return BacktestReport(
            modelo_tipo=self.modelo_tipo,
            steps=steps,
            ventana_test=ventana_test,
            n_pasos=len(steps),
            metricas_agregadas=metricas_agregadas,
            metricas_por_periodo=metricas_por_periodo
        )

    def _ejecutar_pasos_secuencial(
        self,
        df_prep: pd.DataFrame,
        fechas_corte: List[datetime],
        columna_fecha: str,
        columna_cantidad: str,
        ventana_test: int
    ) -> List[BacktestStep]:
        """Ejecuta pasos de backtesting secuencialmente."""
        steps = []
        for i, fecha_corte in enumerate(fechas_corte):
            logger.debug(f"Paso {i+1}/{len(fechas_corte)}: corte en {fecha_corte}")
            try:
                step = self._ejecutar_paso(
                    df_prep, fecha_corte, columna_fecha, columna_cantidad, ventana_test
                )
                steps.append(step)
            except Exception as e:
                logger.warning(f"Error en paso {i+1}: {e}")
                continue
        return steps

    def _ejecutar_pasos_paralelo(
        self,
        df_prep: pd.DataFrame,
        fechas_corte: List[datetime],
        columna_fecha: str,
        columna_cantidad: str,
        ventana_test: int
    ) -> List[BacktestStep]:
        """
        Ejecuta pasos de backtesting en paralelo con ThreadPoolExecutor.

        ThreadPoolExecutor es apropiado porque sklearn libera el GIL durante
        operaciones intensivas de cálculo.
        """
        def ejecutar_un_paso(args):
            i, fecha_corte = args
            try:
                logger.debug(f"Paso {i+1}/{len(fechas_corte)}: corte en {fecha_corte}")
                return self._ejecutar_paso(
                    df_prep, fecha_corte, columna_fecha, columna_cantidad, ventana_test
                )
            except Exception as e:
                logger.warning(f"Error en paso {i+1}: {e}")
                return None

        # Preparar argumentos
        args_list = list(enumerate(fechas_corte))

        # Ejecutar en paralelo
        n_workers = min(MAX_WORKERS, len(fechas_corte))
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            results = list(executor.map(ejecutar_un_paso, args_list))

        # Filtrar resultados None (errores)
        steps = [step for step in results if step is not None]
        return steps

    def _preparar_datos(
        self,
        df: pd.DataFrame,
        columna_fecha: str,
        columna_cantidad: str
    ) -> pd.DataFrame:
        """Prepara y valida los datos para backtesting"""
        df_prep = df.copy()
        df_prep[columna_fecha] = pd.to_datetime(df_prep[columna_fecha])
        df_prep[columna_cantidad] = pd.to_numeric(df_prep[columna_cantidad], errors='coerce')
        df_prep = df_prep.sort_values(columna_fecha).reset_index(drop=True)
        df_prep = df_prep.dropna(subset=[columna_fecha, columna_cantidad])
        return df_prep

    def _calcular_fechas_corte(
        self,
        df: pd.DataFrame,
        columna_fecha: str,
        ventana_test: int,
        n_pasos: int,
        min_train: int,
        stride: int
    ) -> List[datetime]:
        """Calcula las fechas de corte para backtesting"""
        fecha_max = df[columna_fecha].max()

        fechas = []
        fecha_actual = fecha_max - timedelta(days=ventana_test)

        while len(fechas) < n_pasos:
            datos_train = df[df[columna_fecha] < fecha_actual]
            if len(datos_train) < min_train:
                break

            fechas.append(fecha_actual)
            fecha_actual = fecha_actual - timedelta(days=stride)

        return list(reversed(fechas))

    def _ejecutar_paso(
        self,
        df: pd.DataFrame,
        fecha_corte: datetime,
        columna_fecha: str,
        columna_cantidad: str,
        ventana_test: int
    ) -> BacktestStep:
        """Ejecuta un paso individual de backtesting"""
        df_train = df[df[columna_fecha] < fecha_corte].copy()
        df_test = df[
            (df[columna_fecha] >= fecha_corte) &
            (df[columna_fecha] < fecha_corte + timedelta(days=ventana_test))
        ].copy()

        if len(df_test) == 0:
            raise ValueError(f"No hay datos de test para fecha {fecha_corte}")

        df_train_agg = df_train.groupby(columna_fecha)[columna_cantidad].sum().reset_index()
        df_test_agg = df_test.groupby(columna_fecha)[columna_cantidad].sum().reset_index()

        predictor = self.predictor_class(modelo=self.modelo_tipo)
        predictor.entrenar(df_train_agg, columna_cantidad)

        n_dias_test = len(df_test_agg)
        df_pred = predictor.predecir(df_train_agg, n_dias_test)

        predicciones = df_pred['prediccion'].values[:len(df_test_agg)]
        valores_reales = df_test_agg[columna_cantidad].values[:len(predicciones)]

        mae = self._calcular_mae(predicciones, valores_reales)
        rmse = self._calcular_rmse(predicciones, valores_reales)
        mape = self._calcular_mape(predicciones, valores_reales)
        r2 = self._calcular_r2(predicciones, valores_reales)

        return BacktestStep(
            fecha_corte=fecha_corte,
            fecha_inicio_test=df_test_agg[columna_fecha].min(),
            fecha_fin_test=df_test_agg[columna_fecha].max(),
            n_train=len(df_train_agg),
            n_test=len(df_test_agg),
            predicciones=pd.Series(predicciones),
            valores_reales=pd.Series(valores_reales),
            mae=mae,
            rmse=rmse,
            mape=mape,
            r2=r2
        )

    def _calcular_mae(self, pred: np.ndarray, real: np.ndarray) -> float:
        return float(np.mean(np.abs(pred - real)))

    def _calcular_rmse(self, pred: np.ndarray, real: np.ndarray) -> float:
        return float(np.sqrt(np.mean((pred - real) ** 2)))

    def _calcular_mape(self, pred: np.ndarray, real: np.ndarray) -> float:
        mask = real != 0
        if not mask.any():
            return np.inf
        return float(np.mean(np.abs((pred[mask] - real[mask]) / real[mask])) * 100)

    def _calcular_r2(self, pred: np.ndarray, real: np.ndarray) -> float:
        ss_res = np.sum((real - pred) ** 2)
        ss_tot = np.sum((real - np.mean(real)) ** 2)
        if ss_tot == 0:
            return 0.0
        return float(1 - (ss_res / ss_tot))

    def _calcular_metricas_agregadas(self, steps: List[BacktestStep]) -> Dict[str, float]:
        maes = [s.mae for s in steps]
        rmses = [s.rmse for s in steps]
        mapes = [s.mape for s in steps if not np.isinf(s.mape)]
        r2s = [s.r2 for s in steps]

        return {
            'mae_mean': np.mean(maes),
            'mae_std': np.std(maes),
            'mae_min': np.min(maes),
            'mae_max': np.max(maes),
            'rmse_mean': np.mean(rmses),
            'rmse_std': np.std(rmses),
            'mape_mean': np.mean(mapes) if mapes else np.inf,
            'mape_std': np.std(mapes) if mapes else 0,
            'r2_mean': np.mean(r2s),
            'r2_std': np.std(r2s),
            'n_pasos_exitosos': len(steps)
        }

    def _crear_metricas_por_periodo(self, steps: List[BacktestStep]) -> pd.DataFrame:
        rows = []
        for step in steps:
            rows.append({
                'fecha_corte': step.fecha_corte,
                'n_train': step.n_train,
                'n_test': step.n_test,
                'mae': step.mae,
                'rmse': step.rmse,
                'mape': step.mape,
                'r2': step.r2
            })
        return pd.DataFrame(rows)


class ModelComparator:
    """Compara múltiples modelos usando backtesting."""

    def __init__(self, predictor_class):
        self.predictor_class = predictor_class

    def comparar(
        self,
        df: pd.DataFrame,
        modelos: List[str],
        columna_fecha: str = 'fecha',
        columna_cantidad: str = 'cantidad',
        ventana_test: int = 30,
        n_pasos: int = 3,
        paralelo: bool = True
    ) -> Dict[str, Any]:
        """
        Compara múltiples modelos usando backtesting.

        Args:
            df: DataFrame con datos históricos
            modelos: Lista de modelos a comparar
            columna_fecha: Nombre de columna de fecha
            columna_cantidad: Nombre de columna de cantidad
            ventana_test: Días por ventana de test
            n_pasos: Número de pasos walk-forward
            paralelo: Si True, evalúa modelos en paralelo (default True)
        """
        logger.info(f"Comparando {len(modelos)} modelos (paralelo={paralelo})")

        if paralelo and len(modelos) > 1:
            resultados = self._comparar_paralelo(
                df, modelos, columna_fecha, columna_cantidad, ventana_test, n_pasos
            )
        else:
            resultados = self._comparar_secuencial(
                df, modelos, columna_fecha, columna_cantidad, ventana_test, n_pasos
            )

        modelos_validos = {k: v for k, v in resultados.items() if 'error' not in v}
        if modelos_validos:
            mejor_modelo = min(modelos_validos.keys(), key=lambda x: modelos_validos[x]['mae_mean'])
        else:
            mejor_modelo = None

        recomendacion = self._generar_recomendacion(resultados, mejor_modelo)

        return {
            'resultados': resultados,
            'mejor_modelo': mejor_modelo,
            'recomendacion': recomendacion,
            'ranking': self._crear_ranking(resultados)
        }

    def _comparar_secuencial(
        self,
        df: pd.DataFrame,
        modelos: List[str],
        columna_fecha: str,
        columna_cantidad: str,
        ventana_test: int,
        n_pasos: int
    ) -> Dict[str, Any]:
        """Compara modelos secuencialmente."""
        resultados = {}
        for modelo in modelos:
            try:
                backtester = Backtester(self.predictor_class, modelo)
                report = backtester.ejecutar(
                    df, columna_fecha, columna_cantidad,
                    ventana_test, n_pasos, paralelo=False
                )
                resultados[modelo] = {
                    'mae_mean': report.mae_promedio,
                    'mae_std': report.mae_std,
                    'rmse_mean': report.metricas_agregadas['rmse_mean'],
                    'r2_mean': report.metricas_agregadas['r2_mean'],
                    'es_estable': report.es_estable,
                    'report': report
                }
                logger.info(f"  {modelo}: MAE={report.mae_promedio:.2f}")
            except Exception as e:
                logger.warning(f"Error evaluando {modelo}: {e}")
                resultados[modelo] = {'error': str(e), 'mae_mean': np.inf}
        return resultados

    def _comparar_paralelo(
        self,
        df: pd.DataFrame,
        modelos: List[str],
        columna_fecha: str,
        columna_cantidad: str,
        ventana_test: int,
        n_pasos: int
    ) -> Dict[str, Any]:
        """
        Compara modelos en paralelo usando ThreadPoolExecutor.

        Nota: Cada Backtester interno usa paralelo=False para evitar
        anidación excesiva de threads.
        """
        def evaluar_modelo(modelo):
            try:
                backtester = Backtester(self.predictor_class, modelo)
                # Backtester interno es secuencial para evitar exceso de threads
                report = backtester.ejecutar(
                    df, columna_fecha, columna_cantidad,
                    ventana_test, n_pasos, paralelo=False
                )
                resultado = {
                    'mae_mean': report.mae_promedio,
                    'mae_std': report.mae_std,
                    'rmse_mean': report.metricas_agregadas['rmse_mean'],
                    'r2_mean': report.metricas_agregadas['r2_mean'],
                    'es_estable': report.es_estable,
                    'report': report
                }
                logger.info(f"  {modelo}: MAE={report.mae_promedio:.2f}")
                return modelo, resultado
            except Exception as e:
                logger.warning(f"Error evaluando {modelo}: {e}")
                return modelo, {'error': str(e), 'mae_mean': np.inf}

        # Ejecutar en paralelo
        n_workers = min(MAX_WORKERS, len(modelos))
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            results = list(executor.map(evaluar_modelo, modelos))

        return dict(results)

    def _crear_ranking(self, resultados: Dict[str, Any]) -> List[Dict[str, Any]]:
        ranking = []
        for modelo, datos in resultados.items():
            if 'error' not in datos:
                ranking.append({
                    'modelo': modelo,
                    'mae': datos['mae_mean'],
                    'rmse': datos['rmse_mean'],
                    'r2': datos['r2_mean'],
                    'estable': datos['es_estable']
                })

        ranking.sort(key=lambda x: x['mae'])
        for i, item in enumerate(ranking):
            item['posicion'] = i + 1

        return ranking

    def _generar_recomendacion(
        self,
        resultados: Dict[str, Any],
        mejor_modelo: Optional[str]
    ) -> str:
        if not mejor_modelo:
            return "No se pudo determinar el mejor modelo."

        datos_mejor = resultados[mejor_modelo]
        partes = [f"Modelo recomendado: {mejor_modelo}"]

        r2 = datos_mejor['r2_mean']
        if r2 > 0.8:
            partes.append(f"Excelente ajuste (R²={r2:.2f}).")
        elif r2 > 0.6:
            partes.append(f"Buen ajuste (R²={r2:.2f}).")
        elif r2 > 0.4:
            partes.append(f"Ajuste moderado (R²={r2:.2f}).")
        else:
            partes.append(f"Ajuste débil (R²={r2:.2f}).")

        if datos_mejor['es_estable']:
            partes.append("El modelo es estable.")
        else:
            partes.append("El modelo muestra variabilidad.")

        return " ".join(partes)


def ejecutar_backtest_rapido(
    df: pd.DataFrame,
    predictor_class,
    modelo: str = 'random_forest',
    ventana: int = 30,
    pasos: int = 3
) -> BacktestReport:
    """Función de conveniencia para backtesting rápido."""
    backtester = Backtester(predictor_class, modelo)
    return backtester.ejecutar(df, ventana_test=ventana, n_pasos=pasos)


def comparar_modelos_rapido(
    df: pd.DataFrame,
    predictor_class,
    modelos: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Función de conveniencia para comparar modelos."""
    modelos = modelos or ['random_forest', 'gradient_boosting', 'linear']
    comparator = ModelComparator(predictor_class)
    return comparator.comparar(df, modelos)
