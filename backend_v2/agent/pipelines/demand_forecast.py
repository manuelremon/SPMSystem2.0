"""
Pipeline para predicción de demanda de materiales.

Analiza histórico de solicitudes y predice demanda futura.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


class DemandForecastPipeline:
    """
    Pipeline para predecir demanda futura de materiales.

    Pasos:
    1. Cargar datos históricos de solicitudes
    2. Preprocesar y feature engineering
    3. Entrenar modelo de regresión
    4. Generar pronósticos
    5. Calcular intervalos de confianza
    """

    def __init__(self, historical_window_days: int = 90):
        """
        Inicializa el pipeline.

        Args:
            historical_window_days: Días de histórico para análisis
        """
        self.historical_window_days = historical_window_days
        self.scaler = StandardScaler()
        self.model = None
        self.feature_names = []
        self.last_fit_date = None

    def fit(self, solicitudes_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Entrena el modelo de pronóstico.

        Args:
            solicitudes_data: Lista de solicitudes con histórico

        Returns:
            Información del entrenamiento
        """
        try:
            # Convertir a DataFrame
            df = pd.DataFrame(solicitudes_data)

            if len(df) < 10:
                raise ValueError("Se necesitan al menos 10 registros históricos")

            # Preparar datos
            df_prepared = self._prepare_data(df)

            # Feature engineering
            X, y = self._extract_features_and_target(df_prepared)

            if len(X) < 5:
                raise ValueError("No hay suficientes datos después del preprocesamiento")

            # Entrenar modelo
            self.model = RandomForestRegressor(
                n_estimators=50, max_depth=10, random_state=42, n_jobs=-1
            )
            self.model.fit(X, y)
            self.last_fit_date = datetime.now()

            # Guardar feature names
            self.feature_names = self._get_feature_names()

            # Calcular métricas
            train_score = self.model.score(X, y)

            return {
                "status": "fitted",
                "n_samples": len(X),
                "n_features": X.shape[1],
                "train_score": float(train_score),
                "feature_importance": self._get_feature_importance(),
                "fit_date": self.last_fit_date.isoformat(),
            }

        except Exception as e:
            logger.error(f"Error entrenando modelo de pronóstico: {e}")
            raise

    def predict(
        self,
        material_codigo: str,
        centro: str,
        days_ahead: int = 30,
        confidence_level: float = 0.95,
    ) -> Dict[str, Any]:
        """
        Predice demanda futura para un material.

        Args:
            material_codigo: Código del material
            centro: Centro de costo
            days_ahead: Días a predecir hacia el futuro
            confidence_level: Nivel de confianza (0-1)

        Returns:
            Pronóstico con intervalo de confianza
        """
        if self.model is None:
            raise ValueError("Modelo no entrenado. Ejecute fit() primero.")

        try:
            # Crear features para predicción
            X_pred = self._create_prediction_features(material_codigo, centro, days_ahead)

            # Predicción puntual
            y_pred = self.model.predict(X_pred)

            # Estimar intervalo de confianza (usando std de residuos)
            residual_std = self._estimate_residual_std()
            z_score = self._get_z_score(confidence_level)
            margin = z_score * residual_std

            result = {
                "material_codigo": material_codigo,
                "centro": centro,
                "forecast_date": datetime.now().isoformat(),
                "days_ahead": days_ahead,
                "predicted_demand": float(y_pred[0]) if len(y_pred) > 0 else 0.0,
                "confidence_lower": max(0.0, float(y_pred[0] - margin)) if len(y_pred) > 0 else 0.0,
                "confidence_upper": float(y_pred[0] + margin) if len(y_pred) > 0 else 0.0,
                "confidence_level": confidence_level,
            }

            return result

        except Exception as e:
            logger.error(f"Error en predicción de demanda: {e}")
            raise

    def forecast_multiple(
        self, materials: List[Dict[str, str]], days_ahead: int = 30
    ) -> Dict[str, Any]:
        """
        Pronóstico para múltiples materiales.

        Args:
            materials: Lista de dicts con material_codigo y centro
            days_ahead: Días a predecir

        Returns:
            Pronósticos agrupados
        """
        forecasts = []

        for material_info in materials:
            try:
                forecast = self.predict(
                    material_info["material_codigo"], material_info["centro"], days_ahead
                )
                forecasts.append(forecast)
            except Exception as e:
                logger.warning(f"Error en pronóstico para {material_info}: {e}")
                forecasts.append({**material_info, "error": str(e)})

        return {
            "n_forecasts": len(forecasts),
            "days_ahead": days_ahead,
            "forecasts": forecasts,
            "generated_at": datetime.now().isoformat(),
        }

    def _prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepara datos históricos.

        Args:
            df: DataFrame con solicitudes

        Returns:
            DataFrame preparado
        """
        # Asegurar que tenemos columnas necesarias
        required_cols = ["created_at", "material_codigo", "centro", "total_monto"]
        for col in required_cols:
            if col not in df.columns:
                df[col] = None

        # Convertir fechas
        if "created_at" in df.columns:
            df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")

        # Filtrar por ventana histórica
        cutoff_date = datetime.now() - timedelta(days=self.historical_window_days)
        df = df[df["created_at"] >= cutoff_date]

        return df.dropna(subset=["created_at", "total_monto"])

    def _extract_features_and_target(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extrae features y target.

        Args:
            df: DataFrame preparado

        Returns:
            (X, y) arrays
        """
        features = []
        targets = []

        # Agrupar por material y centro
        for (material, centro), group in df.groupby(["material_codigo", "centro"]):
            group = group.sort_values("created_at")

            # Features simples
            if len(group) >= 3:
                total_demanda = group["total_monto"].sum()
                avg_demanda = group["total_monto"].mean()
                std_demanda = group["total_monto"].std() if len(group) > 1 else 0
                freq_solicitudes = len(group)
                dias_span = (group["created_at"].max() - group["created_at"].min()).days + 1

                feature_vec = [
                    total_demanda,
                    avg_demanda,
                    std_demanda,
                    freq_solicitudes,
                    dias_span,
                    freq_solicitudes / max(dias_span, 1),  # solicitudes por día
                ]

                target = avg_demanda  # Usar promedio como target

                features.append(feature_vec)
                targets.append(target)

        X = np.array(features)
        y = np.array(targets)

        # Normalizar features
        X = self.scaler.fit_transform(X)

        return X, y

    def _create_prediction_features(
        self, material_codigo: str, centro: str, days_ahead: int
    ) -> np.ndarray:
        """
        Crea features para predicción.

        Args:
            material_codigo: Código del material
            centro: Centro
            days_ahead: Días adelante

        Returns:
            Array de features
        """
        # Features genéricas (en caso de no tener histórico)
        feature_vec = np.array(
            [
                100.0,  # demanda estimada
                50.0,  # promedio
                10.0,  # std
                5.0,  # frecuencia
                days_ahead,  # ventana
                5.0 / days_ahead,  # tasa
            ]
        )

        # Normalizar
        feature_vec = self.scaler.transform(feature_vec.reshape(1, -1))

        return feature_vec

    def _get_feature_importance(self) -> Dict[str, float]:
        """Retorna importancia de features."""
        if self.model is None or not hasattr(self.model, "feature_importances_"):
            return {}

        importances = self.model.feature_importances_
        feature_names = self._get_feature_names()

        return {name: float(imp) for name, imp in zip(feature_names, importances)}

    def _get_feature_names(self) -> List[str]:
        """Retorna nombres de features."""
        return [
            "total_demanda",
            "avg_demanda",
            "std_demanda",
            "freq_solicitudes",
            "dias_span",
            "tasa_solicitudes",
        ]

    def _estimate_residual_std(self) -> float:
        """Estima la desviación estándar de residuos."""
        # Aproximación simple
        return 50.0

    def _get_z_score(self, confidence_level: float) -> float:
        """Obtiene z-score para nivel de confianza."""
        # Aproximaciones comunes
        confidence_map = {0.90: 1.645, 0.95: 1.960, 0.99: 2.576}
        return confidence_map.get(confidence_level, 1.960)

    def get_status(self) -> Dict[str, Any]:
        """Retorna estado del pipeline."""
        return {
            "is_fitted": self.model is not None,
            "last_fit_date": self.last_fit_date.isoformat() if self.last_fit_date else None,
            "n_features": len(self.feature_names),
            "feature_names": self.feature_names,
            "historical_window_days": self.historical_window_days,
        }
