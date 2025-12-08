"""
Esquemas Pydantic para validación del agente ReAct.

Define estructuras de datos para requests/responses de API.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, validator

# ==================== AGENT CORE ====================


class AgentGoal(BaseModel):
    """Objetivo para el agente."""

    goal: str = Field(..., min_length=1, max_length=1000)
    context: Optional[Dict[str, Any]] = Field(None, description="Contexto adicional")
    max_iterations: int = Field(10, ge=1, le=50)
    timeout_seconds: int = Field(300, ge=10, le=3600)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "goal": "Analizar solicitud #123 y sugerir optimizaciones",
                "context": {"solicitud_id": 123},
                "max_iterations": 5,
            }
        }
    )


class AgentResponse(BaseModel):
    """Respuesta del agente."""

    success: bool
    goal: str
    result: Optional[Dict[str, Any]] = None
    reasoning_trace: List[str] = []
    execution_log: List[Dict[str, Any]] = []
    n_iterations: int = 0
    total_time_seconds: float = 0.0
    error: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "goal": "Analizar solicitud #123",
                "n_iterations": 3,
                "reasoning_trace": ["Necesito analizar la solicitud", "Cargaré datos"],
            }
        }
    )


# ==================== MEMORY ====================


class MemoryEntry(BaseModel):
    """Entrada en memoria del agente."""

    entry_type: Literal["observation", "thought", "action", "result"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    context: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "entry_type": "observation",
                "content": "Se cargaron 50 solicitudes",
                "timestamp": "2025-11-22T10:30:00",
            }
        }
    )


class MemoryQuery(BaseModel):
    """Query para consultar memoria."""

    entry_type: Optional[str] = None
    search_text: Optional[str] = None
    depth: int = Field(10, ge=1, le=100)

    model_config = ConfigDict(
        json_schema_extra={"example": {"search_text": "solicitud aprobada", "depth": 5}}
    )


class MemoryResponse(BaseModel):
    """Respuesta de memoria."""

    n_entries: int
    entries: List[MemoryEntry]
    context: str


# ==================== TOOLS ====================


class ToolCall(BaseModel):
    """Llamada a una herramienta."""

    tool_name: str
    parameters: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tool_name": "load_data",
                "parameters": {"data_type": "solicitudes", "limit": 100},
            }
        }
    )


class ToolResult(BaseModel):
    """Resultado de ejecutar una herramienta."""

    tool_name: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0


class ToolRegistry(BaseModel):
    """Registro de herramientas disponibles."""

    tool_name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    version: str = "1.0"


# ==================== DATA LOADING ====================


class DataLoadRequest(BaseModel):
    """Request para cargar datos."""

    data_type: Literal["solicitudes", "materiales", "stock", "presupuestos", "catalogs"]
    filters: Optional[Dict[str, Any]] = None
    limit: int = Field(100, ge=1, le=10000)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "data_type": "solicitudes",
                "filters": {"estado": "pendiente_de_aprobacion"},
                "limit": 50,
            }
        }
    )


class DataLoadResponse(BaseModel):
    """Response de cargar datos."""

    data_type: str
    count: int
    data: List[Dict[str, Any]]
    filters_applied: Optional[Dict[str, Any]] = None


# ==================== ML TRAINING ====================


class MLTrainingRequest(BaseModel):
    """Request para entrenar modelo ML."""

    model_type: Literal["random_forest_classifier", "random_forest_regressor"]
    X_train: List[List[float]]
    y_train: List[Any]
    hyperparams: Optional[Dict[str, Any]] = None
    model_name: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "model_type": "random_forest_classifier",
                "X_train": [[1.0, 2.0], [3.0, 4.0]],
                "y_train": [0, 1],
                "hyperparams": {"n_estimators": 50, "max_depth": 10},
            }
        }
    )


class MLTrainingResponse(BaseModel):
    """Response de entrenamiento ML."""

    model_type: str
    model_name: str
    model_path: str
    n_features: int
    n_samples: int
    hyperparams: Dict[str, Any]
    training_successful: bool
    feature_importances: Optional[List[float]] = None


# ==================== ML EVALUATION ====================


class MLEvaluationRequest(BaseModel):
    """Request para evaluar modelo."""

    y_true: List[Any]
    y_pred: List[Any]
    metrics: Optional[List[str]] = None
    problem_type: Literal["classification", "regression"] = "classification"

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "y_true": [0, 1, 0, 1],
                "y_pred": [0, 1, 1, 1],
                "problem_type": "classification",
                "metrics": ["accuracy", "precision", "recall", "f1"],
            }
        }
    )


class MLEvaluationResponse(BaseModel):
    """Response de evaluación."""

    problem_type: str
    n_samples: int
    metrics: Dict[str, float]


# ==================== ML PREDICTION ====================


class MLPredictionRequest(BaseModel):
    """Request para predicción."""

    model_name: str
    X_test: List[List[float]]
    return_probabilities: bool = False
    prediction_type: Literal["default", "confidence"] = "default"

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "model_name": "random_forest_classifier_model.pkl",
                "X_test": [[1.0, 2.0], [3.0, 4.0]],
                "return_probabilities": True,
            }
        }
    )


class MLPredictionResponse(BaseModel):
    """Response de predicción."""

    model_name: str
    n_predictions: int
    predictions: List[Any]
    model_type: str
    probabilities: Optional[List[List[float]]] = None
    confidence: Optional[List[float]] = None
    feature_importances: Optional[List[float]] = None


# ==================== DEMAND FORECAST ====================


class DemandForecastRequest(BaseModel):
    """Request para pronóstico de demanda."""

    material_codigo: str
    centro: str
    days_ahead: int = Field(30, ge=1, le=365)
    confidence_level: float = Field(0.95, ge=0.5, le=0.99)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "material_codigo": "1000000006",
                "centro": "1008",
                "days_ahead": 30,
                "confidence_level": 0.95,
            }
        }
    )


class DemandForecastResponse(BaseModel):
    """Response de pronóstico."""

    material_codigo: str
    centro: str
    forecast_date: datetime
    days_ahead: int
    predicted_demand: float
    confidence_lower: float
    confidence_upper: float
    confidence_level: float


# ==================== CLUSTERING ====================


class ClusteringRequest(BaseModel):
    """Request para clustering."""

    cluster_type: Literal["materiales", "solicitudes"]
    n_clusters: Optional[int] = None
    max_clusters: int = 10

    model_config = ConfigDict(
        json_schema_extra={"example": {"cluster_type": "materiales", "max_clusters": 10}}
    )


class ClusteringResponse(BaseModel):
    """Response de clustering."""

    status: str
    n_clusters: int
    silhouette_score: Optional[float] = None
    cluster_sizes: Dict[str, int]


# ==================== SCORING ====================


class ScoringRequest(BaseModel):
    """Request para scoring de solicitud."""

    solicitud: Dict[str, Any]
    presupuesto_disponible: Optional[float] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "solicitud": {
                    "id": 1,
                    "criticidad": "Alta",
                    "total_monto": 5000.0,
                    "fecha_necesidad": "2025-12-01",
                }
            }
        }
    )


class ScoringResponse(BaseModel):
    """Response de scoring."""

    solicitud_id: Optional[int]
    scores: Dict[str, float]
    total_score: float
    normalized_score: float
    priority_level: Literal["crítica", "alta", "media", "baja"]
    puede_procesarse: Optional[bool] = None
    weights_used: Dict[str, float]


# ==================== REQUESTS/RESPONSES DE API ====================


class AgentExecuteRequest(BaseModel):
    """Request para ejecutar agente."""

    goal: str = Field(..., min_length=1, max_length=1000)
    context: Optional[Dict[str, Any]] = None
    max_iterations: int = Field(10, ge=1, le=50)
    timeout_seconds: int = Field(300, ge=10, le=3600)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "goal": "Optimizar solicitud #123",
                "context": {"solicitud_id": 123},
                "max_iterations": 5,
            }
        }
    )


class HealthCheckResponse(BaseModel):
    """Response de health check."""

    status: str
    timestamp: datetime
    agent_status: str
    tools_available: int
    memory_entries: int


class ErrorResponse(BaseModel):
    """Response de error."""

    ok: bool = False
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


# ==================== VALIDATORS ====================


class ValidatedRequest(BaseModel):
    """Request con validaciones adicionales."""

    @validator("*", pre=True)
    def empty_str_to_none(cls, v):
        """Convierte strings vacíos a None."""
        if isinstance(v, str) and v == "":
            return None
        return v


# ==================== EXPORTAR SCHEMAS ====================

__all__ = [
    # Agent
    "AgentGoal",
    "AgentResponse",
    "AgentExecuteRequest",
    # Memory
    "MemoryEntry",
    "MemoryQuery",
    "MemoryResponse",
    # Tools
    "ToolCall",
    "ToolResult",
    "ToolRegistry",
    # Data
    "DataLoadRequest",
    "DataLoadResponse",
    # ML Training
    "MLTrainingRequest",
    "MLTrainingResponse",
    # ML Evaluation
    "MLEvaluationRequest",
    "MLEvaluationResponse",
    # ML Prediction
    "MLPredictionRequest",
    "MLPredictionResponse",
    # Demand Forecast
    "DemandForecastRequest",
    "DemandForecastResponse",
    # Clustering
    "ClusteringRequest",
    "ClusteringResponse",
    # Scoring
    "ScoringRequest",
    "ScoringResponse",
    # Health/Error
    "HealthCheckResponse",
    "ErrorResponse",
]
