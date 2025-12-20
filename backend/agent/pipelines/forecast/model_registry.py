"""
Módulo de Model Registry para Forecast

Proporciona gestión y versionado de modelos entrenados.

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import uuid
import shutil
import logging

logger = logging.getLogger(__name__)

try:
    import joblib
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False
    logger.warning("joblib no disponible")


@dataclass
class ModelMetadata:
    """Metadata de un modelo guardado"""
    model_id: str
    material: str
    modelo_tipo: str
    fecha_entrenamiento: datetime
    metricas: Dict[str, float]
    hiperparametros: Dict[str, Any]
    rango_datos: Tuple[str, str]
    n_muestras: int
    features: List[str]
    version: str = "1.0"
    descripcion: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'model_id': self.model_id,
            'material': self.material,
            'modelo_tipo': self.modelo_tipo,
            'fecha_entrenamiento': self.fecha_entrenamiento.isoformat(),
            'metricas': self.metricas,
            'hiperparametros': self.hiperparametros,
            'rango_datos': self.rango_datos,
            'n_muestras': self.n_muestras,
            'features': self.features,
            'version': self.version,
            'descripcion': self.descripcion,
            'tags': self.tags
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ModelMetadata':
        return cls(
            model_id=data['model_id'],
            material=data['material'],
            modelo_tipo=data['modelo_tipo'],
            fecha_entrenamiento=datetime.fromisoformat(data['fecha_entrenamiento']),
            metricas=data['metricas'],
            hiperparametros=data['hiperparametros'],
            rango_datos=tuple(data['rango_datos']),
            n_muestras=data['n_muestras'],
            features=data['features'],
            version=data.get('version', '1.0'),
            descripcion=data.get('descripcion', ''),
            tags=data.get('tags', [])
        )


@dataclass
class ModelInfo:
    """Información resumida de un modelo"""
    model_id: str
    material: str
    modelo_tipo: str
    fecha_entrenamiento: datetime
    mae: float
    r2: float
    n_muestras: int
    version: str
    archivo: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'model_id': self.model_id,
            'material': self.material,
            'modelo_tipo': self.modelo_tipo,
            'fecha_entrenamiento': self.fecha_entrenamiento.isoformat(),
            'mae': round(self.mae, 2),
            'r2': round(self.r2, 4),
            'n_muestras': self.n_muestras,
            'version': self.version,
            'archivo': self.archivo
        }


@dataclass
class ComparisonReport:
    """Reporte de comparación entre modelos"""
    modelos: List[str]
    metricas: pd.DataFrame
    mejor_por_metrica: Dict[str, str]
    recomendacion: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'modelos': self.modelos,
            'metricas': self.metricas.to_dict('records'),
            'mejor_por_metrica': self.mejor_por_metrica,
            'recomendacion': self.recomendacion
        }


class ModelRegistry:
    """
    Registro y gestión de modelos entrenados.
    """

    METADATA_FILE = "metadata.json"
    MODEL_FILE = "model.joblib"
    INDEX_FILE = "index.json"

    def __init__(self, base_path: str = None):
        if not JOBLIB_AVAILABLE:
            raise ImportError("joblib es requerido para ModelRegistry")

        if base_path is None:
            base_path = Path(__file__).parent.parent.parent.parent / "data" / "models"

        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._cargar_indice()

    def _cargar_indice(self):
        """Carga o inicializa el índice de modelos"""
        index_path = self.base_path / self.INDEX_FILE
        if index_path.exists():
            with open(index_path, 'r') as f:
                self._index = json.load(f)
        else:
            self._index = {'modelos': {}, 'por_material': {}}
            self._guardar_indice()

    def _guardar_indice(self):
        """Guarda el índice de modelos"""
        index_path = self.base_path / self.INDEX_FILE
        with open(index_path, 'w') as f:
            json.dump(self._index, f, indent=2, default=str)

    def _generar_id(self) -> str:
        """Genera un ID único para el modelo"""
        return str(uuid.uuid4())[:8]

    def guardar_modelo(
        self,
        modelo: Any,
        metadata: ModelMetadata,
        scaler: Any = None,
        sobrescribir: bool = False
    ) -> str:
        """Guarda un modelo con su metadata."""
        model_id = metadata.model_id or self._generar_id()
        metadata.model_id = model_id

        model_dir = self.base_path / model_id
        if model_dir.exists():
            if sobrescribir:
                shutil.rmtree(model_dir)
            else:
                raise ValueError(f"Modelo {model_id} ya existe")

        model_dir.mkdir(parents=True)

        model_path = model_dir / self.MODEL_FILE
        modelo_data = {'modelo': modelo, 'scaler': scaler}
        joblib.dump(modelo_data, model_path, compress=3)

        metadata_path = model_dir / self.METADATA_FILE
        with open(metadata_path, 'w') as f:
            json.dump(metadata.to_dict(), f, indent=2, default=str)

        self._index['modelos'][model_id] = {
            'material': metadata.material,
            'modelo_tipo': metadata.modelo_tipo,
            'fecha': metadata.fecha_entrenamiento.isoformat(),
            'mae': metadata.metricas.get('mae', 0),
            'r2': metadata.metricas.get('r2', 0)
        }

        if metadata.material not in self._index['por_material']:
            self._index['por_material'][metadata.material] = []
        if model_id not in self._index['por_material'][metadata.material]:
            self._index['por_material'][metadata.material].append(model_id)

        self._guardar_indice()

        logger.info(f"Modelo guardado: {model_id} ({metadata.modelo_tipo} para {metadata.material})")
        return model_id

    def cargar_modelo(self, model_id: str) -> Tuple[Any, ModelMetadata, Any]:
        """Carga un modelo guardado."""
        model_dir = self.base_path / model_id
        if not model_dir.exists():
            raise ValueError(f"Modelo {model_id} no encontrado")

        model_path = model_dir / self.MODEL_FILE
        modelo_data = joblib.load(model_path)

        metadata_path = model_dir / self.METADATA_FILE
        with open(metadata_path, 'r') as f:
            metadata = ModelMetadata.from_dict(json.load(f))

        logger.debug(f"Modelo cargado: {model_id}")
        return modelo_data['modelo'], metadata, modelo_data.get('scaler')

    def listar_modelos(
        self,
        material: Optional[str] = None,
        modelo_tipo: Optional[str] = None,
        limite: int = 50
    ) -> List[ModelInfo]:
        """Lista modelos disponibles."""
        resultados = []

        if material and material in self._index['por_material']:
            model_ids = self._index['por_material'][material]
        else:
            model_ids = list(self._index['modelos'].keys())

        for model_id in model_ids[:limite]:
            info = self._index['modelos'].get(model_id)
            if not info:
                continue

            if modelo_tipo and info['modelo_tipo'] != modelo_tipo:
                continue

            resultados.append(ModelInfo(
                model_id=model_id,
                material=info['material'],
                modelo_tipo=info['modelo_tipo'],
                fecha_entrenamiento=datetime.fromisoformat(info['fecha']),
                mae=info.get('mae', 0),
                r2=info.get('r2', 0),
                n_muestras=0,
                version="1.0",
                archivo=str(self.base_path / model_id / self.MODEL_FILE)
            ))

        resultados.sort(key=lambda x: x.fecha_entrenamiento, reverse=True)
        return resultados

    def obtener_mejor_modelo(
        self,
        material: str,
        criterio: str = 'mae'
    ) -> Optional[str]:
        """Obtiene el mejor modelo para un material."""
        modelos = self.listar_modelos(material=material)
        if not modelos:
            return None

        if criterio == 'mae':
            mejor = min(modelos, key=lambda x: x.mae if x.mae > 0 else float('inf'))
        elif criterio == 'r2':
            mejor = max(modelos, key=lambda x: x.r2)
        else:
            mejor = modelos[0]

        return mejor.model_id

    def eliminar_modelo(self, model_id: str) -> bool:
        """Elimina un modelo del registry."""
        model_dir = self.base_path / model_id
        if not model_dir.exists():
            return False

        shutil.rmtree(model_dir)

        if model_id in self._index['modelos']:
            material = self._index['modelos'][model_id].get('material')
            del self._index['modelos'][model_id]

            if material and material in self._index['por_material']:
                if model_id in self._index['por_material'][material]:
                    self._index['por_material'][material].remove(model_id)

        self._guardar_indice()
        logger.info(f"Modelo eliminado: {model_id}")
        return True

    def limpiar_antiguos(
        self,
        dias: int = 30,
        mantener_mejor: bool = True
    ) -> int:
        """Elimina modelos antiguos."""
        fecha_limite = datetime.now() - timedelta(days=dias)
        eliminados = 0

        mejores = {}
        if mantener_mejor:
            for material in self._index['por_material']:
                mejor = self.obtener_mejor_modelo(material)
                if mejor:
                    mejores[material] = mejor

        for model_id, info in list(self._index['modelos'].items()):
            fecha = datetime.fromisoformat(info['fecha'])

            if fecha < fecha_limite:
                material = info.get('material')
                if mantener_mejor and mejores.get(material) == model_id:
                    continue

                if self.eliminar_modelo(model_id):
                    eliminados += 1

        logger.info(f"Limpieza completada: {eliminados} modelos eliminados")
        return eliminados

    def obtener_estadisticas(self) -> Dict[str, Any]:
        """Obtiene estadísticas del registry."""
        n_modelos = len(self._index['modelos'])
        n_materiales = len(self._index['por_material'])

        tamano_total = 0
        for model_id in self._index['modelos']:
            model_dir = self.base_path / model_id
            if model_dir.exists():
                for f in model_dir.iterdir():
                    tamano_total += f.stat().st_size

        por_tipo = {}
        for info in self._index['modelos'].values():
            tipo = info.get('modelo_tipo', 'unknown')
            por_tipo[tipo] = por_tipo.get(tipo, 0) + 1

        return {
            'n_modelos': n_modelos,
            'n_materiales': n_materiales,
            'tamano_mb': round(tamano_total / (1024 * 1024), 2),
            'por_tipo': por_tipo,
            'base_path': str(self.base_path)
        }


def crear_metadata(
    material: str,
    modelo_tipo: str,
    metricas: Dict[str, float],
    n_muestras: int,
    fecha_inicio: str,
    fecha_fin: str,
    features: Optional[List[str]] = None,
    hiperparametros: Optional[Dict[str, Any]] = None,
    descripcion: str = ""
) -> ModelMetadata:
    """Función de conveniencia para crear metadata."""
    return ModelMetadata(
        model_id="",
        material=material,
        modelo_tipo=modelo_tipo,
        fecha_entrenamiento=datetime.now(),
        metricas=metricas,
        hiperparametros=hiperparametros or {},
        rango_datos=(fecha_inicio, fecha_fin),
        n_muestras=n_muestras,
        features=features or [],
        descripcion=descripcion
    )


def obtener_registry(base_path: str = None) -> ModelRegistry:
    """Obtiene instancia del registry."""
    return ModelRegistry(base_path)
