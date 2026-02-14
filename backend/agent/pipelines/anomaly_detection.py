"""
Detección de Anomalías en Series Temporales
============================================
Identifica comportamientos inusuales en consumo de materiales.

Utiliza Isolation Forest para detectar outliers sin supervisión.

FASE 5 - SPM v3.0
"""
import logging
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings('ignore')
logger = logging.getLogger(__name__)

try:
    from sklearn.ensemble import IsolationForest
    ISOLATION_FOREST_AVAILABLE = True
except ImportError:
    ISOLATION_FOREST_AVAILABLE = False
    logger.warning("sklearn no está disponible para anomaly detection")


class AnomalyDetector:
    """
    Detector de anomalías usando Isolation Forest.

    Características:
    - Detección no supervisada de outliers
    - Features: consumo diario, stock ratio, precio unitario
    - Contamination: proporción esperada de anomalías (default 5%)
    - Explicación de anomalías detectadas
    """

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        """
        Args:
            contamination: Proporción esperada de outliers (0.01-0.1)
            random_state: Para reproducibilidad
        """
        if not ISOLATION_FOREST_AVAILABLE:
            raise ImportError("sklearn es requerido para AnomalyDetector")

        self.contamination = min(max(contamination, 0.01), 0.1)  # Clamp entre 0.01 y 0.1
        self.random_state = random_state
        self.detector = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100
        )
        self.is_fitted = False
        self.feature_names = []

    def preparar_features(
        self,
        df: pd.DataFrame,
        stock_actual: float = 0.0,
        precio_unitario: float = 0.0
    ) -> pd.DataFrame:
        """
        Prepara features para detección de anomalías.

        Args:
            df: DataFrame con ['fecha', 'cantidad']
            stock_actual: Stock actual del material
            precio_unitario: Precio unitario en USD

        Returns:
            DataFrame con features normalizados
        """
        df = df.copy()
        df['fecha'] = pd.to_datetime(df['fecha'])

        # Feature 1: Consumo diario
        df['consumo_diario'] = df['cantidad']

        # Feature 2: Consumo vs promedio (desviación normalizada)
        media = df['cantidad'].mean()
        std = df['cantidad'].std() + 1e-5  # Evitar división por cero
        df['consumo_normalized'] = (df['cantidad'] - media) / std

        # Feature 3: Ratio de cambio día a día
        df['cambio_ratio'] = df['cantidad'].pct_change().fillna(0).abs()

        # Feature 4: Media móvil (suavidad)
        df['ma_7'] = df['cantidad'].rolling(window=7, min_periods=1).mean()
        df['desviacion_ma'] = np.abs(df['cantidad'] - df['ma_7'])

        # Feature 5: Stock ratio (si aplica)
        if stock_actual > 0:
            df['stock_ratio'] = stock_actual / (df['cantidad'].mean() + 1e-5)
            df['stock_ratio'] = df['stock_ratio'].clip(0, 365)  # Cap a 1 año
        else:
            df['stock_ratio'] = 0.0

        # Feature 6: Precio total
        df['precio_total'] = df['cantidad'] * precio_unitario

        # Feature 7: Variabilidad en ventana de 7 días
        df['volatility_7d'] = df['cantidad'].rolling(window=7, min_periods=1).std()

        # Seleccionar features para modelo
        feature_cols = [
            'consumo_diario',
            'consumo_normalized',
            'cambio_ratio',
            'desviacion_ma',
            'stock_ratio',
            'volatility_7d'
        ]

        self.feature_names = feature_cols

        # Normalizar features
        for col in feature_cols:
            if df[col].std() > 0:
                df[col] = (df[col] - df[col].mean()) / df[col].std()
            else:
                df[col] = 0

        return df[['fecha', 'cantidad'] + feature_cols]

    def detectar(
        self,
        df: pd.DataFrame,
        stock_actual: float = 0.0,
        precio_unitario: float = 0.0
    ) -> Tuple[pd.DataFrame, float]:
        """
        Detecta anomalías en la serie temporal.

        Args:
            df: DataFrame con ['fecha', 'cantidad']
            stock_actual: Stock actual del material
            precio_unitario: Precio unitario

        Returns:
            DataFrame con anomalías detectadas y score de anomalía (0-1)
        """
        if len(df) < 5:
            logger.warning("Datos insuficientes para detectar anomalías")
            df['es_anomalia'] = False
            df['anomalia_score'] = 0.0
            return df, 0.0

        try:
            # Preparar features
            df_features = self.preparar_features(df, stock_actual, precio_unitario)

            # Extraer X para el modelo
            X = df_features[self.feature_names].values

            # Entrenar y predecir
            predicciones = self.detector.fit_predict(X)
            anomalia_scores = -self.detector.score_samples(X)  # Invertir para que 1 = anomalía
            anomalia_scores = (anomalia_scores - anomalia_scores.min()) / (
                anomalia_scores.max() - anomalia_scores.min() + 1e-5
            )  # Normalizar a [0, 1]

            # Agregar resultados
            df_features['es_anomalia'] = predicciones == -1  # -1 indica anomalía
            df_features['anomalia_score'] = anomalia_scores

            # Calcular proporción de anomalías detectadas
            prop_anomalias = df_features['es_anomalia'].sum() / len(df_features)

            self.is_fitted = True
            logger.info(f"Anomalías detectadas: {df_features['es_anomalia'].sum()} ({prop_anomalias*100:.1f}%)")

            return df_features, prop_anomalias

        except Exception as e:
            logger.error(f"Error en detección de anomalías: {e}")
            df['es_anomalia'] = False
            df['anomalia_score'] = 0.0
            return df, 0.0

    def explicar_anomalia(
        self,
        row: pd.Series,
        contexto: Optional[Dict] = None
    ) -> Dict[str, str]:
        """
        Proporciona explicación legible de por qué se detectó una anomalía.

        Args:
            row: Fila del DataFrame con la anomalía
            contexto: Contexto adicional (ej: material_nombre, centro)

        Returns:
            Dict con explicación y tipo de anomalía
        """
        cantidad = row.get('cantidad', 0)
        cambio_ratio = row.get('cambio_ratio', 0)
        consumo_normalized = row.get('consumo_normalized', 0)
        desviacion_ma = row.get('desviacion_ma', 0)
        volatility = row.get('volatility_7d', 0)

        tipos_anomalia = []

        # Análisis de cambio brusco
        if cambio_ratio > 0.5:
            tipos_anomalia.append("Cambio brusco en consumo (>50%)")

        # Análisis de desviación
        if abs(consumo_normalized) > 2.5:
            if consumo_normalized > 0:
                tipos_anomalia.append("Consumo significativamente mayor que el promedio")
            else:
                tipos_anomalia.append("Consumo significativamente menor que el promedio")

        # Análisis de volatilidad
        if volatility > 0.5:
            tipos_anomalia.append("Volatilidad alta en últimos 7 días")

        # Análisis de desviación de media móvil
        if desviacion_ma > 1.5:
            tipos_anomalia.append("Desviación significativa de tendencia esperada")

        # Si no hay razón clara, es un outlier general
        if not tipos_anomalia:
            tipos_anomalia.append("Patrón inusual detectado")

        contexto_str = ""
        if contexto:
            if 'material_nombre' in contexto:
                contexto_str += f" Material: {contexto['material_nombre']}."
            if 'centro' in contexto:
                contexto_str += f" Centro: {contexto['centro']}."

        return {
            'fecha': str(row.get('fecha', '')),
            'cantidad': float(cantidad),
            'tipos_anomalia': tipos_anomalia,
            'descripcion': f"Anomalía detectada:{contexto_str} {'; '.join(tipos_anomalia)}",
            'score': float(row.get('anomalia_score', 0))
        }

    def obtener_anomalias_significativas(
        self,
        df_anomalias: pd.DataFrame,
        threshold_score: float = 0.5
    ) -> pd.DataFrame:
        """
        Filtra anomalías significativas por score.

        Args:
            df_anomalias: DataFrame con detecciones
            threshold_score: Score mínimo para considerar significativa (0-1)

        Returns:
            DataFrame con anomalías significativas
        """
        anomalias_sig = df_anomalias[
            (df_anomalias['es_anomalia']) &
            (df_anomalias['anomalia_score'] >= threshold_score)
        ].copy()

        return anomalias_sig.sort_values('anomalia_score', ascending=False)


def detectar_anomalias_material(
    material_codigo: str,
    centro: str = "1000",
    dias: int = 90
) -> Dict:
    """
    Función de conveniencia para detectar anomalías de un material.

    Args:
        material_codigo: Código del material
        centro: Centro de distribución
        dias: Días históricos a analizar

    Returns:
        Dict con anomalías detectadas y análisis
    """
    try:
        from backend.core.db import get_db_connection, sql_date_relative
        import pandas as pd

        # Obtener datos
        with get_db_connection("sap_data") as conn:
            date_filter = sql_date_relative(days=-dias)
            query = f"""
                SELECT fecha, cantidad
                FROM consumo_historico
                WHERE material = ? AND centro = ?
                AND fecha > {date_filter}
                ORDER BY fecha
            """
            # pd.read_sql_query necesita la conexión raw para PostgreSQL
            raw_conn = conn._conn if hasattr(conn, '_conn') else conn
            df = pd.read_sql_query(
                query.replace("?", "%s") if hasattr(conn, '_conn') else query,
                raw_conn,
                params=[material_codigo, centro]
            )

        if len(df) < 5:
            return {
                'ok': False,
                'error': f'Datos insuficientes: {len(df)} registros'
            }

        # Detectar anomalías
        detector = AnomalyDetector()
        df_anomalias, prop = detector.detectar(df)

        # Filtrar significativas
        anomalias_sig = detector.obtener_anomalias_significativas(df_anomalias, threshold_score=0.6)

        # Explicar cada anomalía
        explicaciones = []
        for _, row in anomalias_sig.head(10).iterrows():
            explicaciones.append(detector.explicar_anomalia(row, {
                'material': material_codigo,
                'centro': centro
            }))

        return {
            'ok': True,
            'material': material_codigo,
            'centro': centro,
            'total_registros': len(df),
            'anomalias_detectadas': df_anomalias['es_anomalia'].sum(),
            'proporcion_anomalias': float(prop),
            'anomalias_significativas': len(anomalias_sig),
            'explicaciones': explicaciones
        }

    except Exception as e:
        logger.error(f"Error detectando anomalías: {e}")
        return {
            'ok': False,
            'error': str(e)
        }
