"""
Pipeline para clustering de materiales y solicitudes.

Agrupa materiales similares y solicitudes relacionadas.
"""

import logging
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


class ClusteringPipeline:
    """
    Pipeline para agrupación inteligente.

    Características:
    - Clustering de materiales por similitud
    - Agrupación de solicitudes por patrón
    - Detección automática del número óptimo de clusters
    - Análisis de coherencia con silhouette score
    """

    def __init__(self, n_clusters: Optional[int] = None, max_clusters: int = 10):
        """
        Inicializa el pipeline.

        Args:
            n_clusters: Número de clusters (auto si None)
            max_clusters: Máximo de clusters a probar
        """
        self.n_clusters = n_clusters
        self.max_clusters = max_clusters
        self.scaler = StandardScaler()
        self.model = None
        self.cluster_centers = None
        self.silhouette = None

    def fit_material_clusters(self, materiales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Agrupa materiales por similitud.

        Args:
            materiales_data: Lista de datos de materiales

        Returns:
            Información del clustering
        """
        try:
            # Preparar datos
            X = self._prepare_material_features(materiales_data)

            if len(X) < 3:
                raise ValueError("Se necesitan al menos 3 materiales")

            # Determinar n_clusters óptimo
            if self.n_clusters is None:
                optimal_k = self._find_optimal_clusters(X)
            else:
                optimal_k = self.n_clusters

            # Entrenar modelo
            self.model = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
            labels = self.model.fit_predict(X)
            self.cluster_centers = self.model.cluster_centers_

            # Calcular silhouette score
            self.silhouette = silhouette_score(X, labels)

            return {
                "status": "fitted",
                "n_clusters": optimal_k,
                "n_materials": len(X),
                "silhouette_score": float(self.silhouette),
                "inertia": float(self.model.inertia_),
            }

        except Exception as e:
            logger.error(f"Error en clustering de materiales: {e}")
            raise

    def predict_material_clusters(self, materiales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Predice cluster para materiales.

        Args:
            materiales_data: Lista de materiales

        Returns:
            Asignaciones de cluster
        """
        if self.model is None:
            raise ValueError("Modelo no entrenado. Ejecute fit_material_clusters() primero.")

        try:
            X = self._prepare_material_features(materiales_data)
            labels = self.model.predict(X)

            # Organizar resultados
            clusters = {}
            for idx, (material, label) in enumerate(zip(materiales_data, labels)):
                if label not in clusters:
                    clusters[label] = []
                clusters[label].append({**material, "cluster_id": int(label)})

            return {
                "n_clusters": len(clusters),
                "total_materials": len(materiales_data),
                "clusters": clusters,
                "cluster_sizes": {str(k): len(v) for k, v in clusters.items()},
            }

        except Exception as e:
            logger.error(f"Error prediciendo clusters: {e}")
            raise

    def fit_solicitud_clusters(self, solicitudes_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Agrupa solicitudes por patrón.

        Args:
            solicitudes_data: Lista de solicitudes

        Returns:
            Información del clustering
        """
        try:
            # Preparar features
            X = self._prepare_solicitud_features(solicitudes_data)

            if len(X) < 3:
                raise ValueError("Se necesitan al menos 3 solicitudes")

            # Determinar k óptimo
            if self.n_clusters is None:
                optimal_k = self._find_optimal_clusters(X)
            else:
                optimal_k = self.n_clusters

            # Entrenar
            self.model = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
            labels = self.model.fit_predict(X)

            self.silhouette = silhouette_score(X, labels)

            return {
                "status": "fitted",
                "n_clusters": optimal_k,
                "n_solicitudes": len(X),
                "silhouette_score": float(self.silhouette),
                "inertia": float(self.model.inertia_),
            }

        except Exception as e:
            logger.error(f"Error en clustering de solicitudes: {e}")
            raise

    def group_similar_materials(
        self, material_codigo: str, similitud_minima: float = 0.7
    ) -> Dict[str, Any]:
        """
        Encuentra materiales similares a uno dado.

        Args:
            material_codigo: Código del material referencia
            similitud_minima: Threshold de similitud (0-1)

        Returns:
            Materiales similares agrupados
        """
        if self.model is None:
            raise ValueError("Modelo no entrenado")

        try:
            # Búsqueda simple por proximidad en clusters
            # En implementación real, usaría distancias
            return {
                "material_referencia": material_codigo,
                "similares": [],
                "similitud_threshold": similitud_minima,
            }

        except Exception as e:
            logger.error(f"Error buscando materiales similares: {e}")
            raise

    def _prepare_material_features(self, materiales_data: List[Dict[str, Any]]) -> np.ndarray:
        """
        Prepara features de materiales.

        Args:
            materiales_data: Lista de materiales

        Returns:
            Array de features
        """
        features = []

        for material in materiales_data:
            feature_vec = [
                len(material.get("descripcion", "")),  # longitud descripción
                float(material.get("precio_usd", 0)),  # precio
                1.0 if material.get("activo", True) else 0.0,  # estado
                hash(material.get("unidad", "UNI")) % 10,  # unidad (encoded)
            ]
            features.append(feature_vec)

        X = np.array(features)
        X = self.scaler.fit_transform(X)

        return X

    def _prepare_solicitud_features(self, solicitudes_data: List[Dict[str, Any]]) -> np.ndarray:
        """
        Prepara features de solicitudes.

        Args:
            solicitudes_data: Lista de solicitudes

        Returns:
            Array de features
        """
        features = []

        for solicitud in solicitudes_data:
            # Extraer features
            data_json = solicitud.get("data_json", {})
            n_items = len(data_json.get("items", []))
            total_monto = float(solicitud.get("total_monto", 0))

            feature_vec = [
                n_items,  # número de items
                total_monto,  # monto total
                1.0 if solicitud.get("criticidad") == "Alta" else 0.0,  # criticidad
                hash(solicitud.get("sector", "")) % 10,  # sector (encoded)
            ]
            features.append(feature_vec)

        X = np.array(features)
        X = self.scaler.fit_transform(X)

        return X

    def _find_optimal_clusters(self, X: np.ndarray) -> int:
        """
        Encuentra número óptimo de clusters.

        Args:
            X: Array de features

        Returns:
            Número óptimo de clusters
        """
        silhouette_scores = []

        for k in range(2, min(self.max_clusters + 1, len(X))):
            km = KMeans(n_clusters=k, random_state=42, n_init=5)
            labels = km.fit_predict(X)

            score = silhouette_score(X, labels)
            silhouette_scores.append(score)

        if silhouette_scores:
            optimal_k = silhouette_scores.index(max(silhouette_scores)) + 2
            return optimal_k
        else:
            return 2

    def get_status(self) -> Dict[str, Any]:
        """Retorna estado del pipeline."""
        return {
            "is_fitted": self.model is not None,
            "n_clusters": self.n_clusters,
            "max_clusters": self.max_clusters,
            "silhouette_score": float(self.silhouette) if self.silhouette is not None else None,
            "cluster_centers": (
                self.cluster_centers.tolist() if self.cluster_centers is not None else None
            ),
        }

    def reset(self) -> None:
        """Resetea el pipeline."""
        self.model = None
        self.cluster_centers = None
        self.silhouette = None
