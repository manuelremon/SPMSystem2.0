"""
Rutas API para el agente ReAct.

Endpoints para ejecutar agente, consultar memoria, ejecutar herramientas.
"""

import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from .core.memory import Memory
from .core.react_agent import ReactAgent
from .pipelines import (ClusteringPipeline, DemandForecastPipeline,
                        ScoringPipeline)
from .schemas import (AgentExecuteRequest, DataLoadRequest,
                      DemandForecastRequest, MLEvaluationRequest,
                      MLPredictionRequest, MLTrainingRequest, ScoringRequest)
from .tools import DataLoader, Evaluator, MLTrainer, Predictor

logger = logging.getLogger(__name__)

# Blueprint setup
agent_bp = Blueprint("agent", __name__, url_prefix="/api/agent")

# Instancias globales
agent = ReactAgent()
memory = Memory()
data_loader = DataLoader()
ml_trainer = MLTrainer()
evaluator = Evaluator()
predictor = Predictor()
demand_forecast = DemandForecastPipeline()
clustering = ClusteringPipeline()
scoring = ScoringPipeline()


# ==================== AGENT EXECUTION ====================


@agent_bp.route("/execute", methods=["POST"])
def execute_agent():
    """
    Ejecuta el agente con un objetivo dado.

    Request body:
    {
        "goal": "Analizar solicitud #123",
        "context": {"solicitud_id": 123},
        "max_iterations": 5
    }
    """
    try:
        data = request.get_json()

        # Validar request
        try:
            req = AgentExecuteRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en execute_agent: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar agente
        result = agent.act(
            goal=req.goal,
            context=req.context,
            max_iterations=req.max_iterations,
            timeout_seconds=req.timeout_seconds,
        )

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error ejecutando agente: {e}")
        return jsonify({"ok": False, "error": "execution_error", "message": str(e)}), 500


# ==================== MEMORY ====================


@agent_bp.route("/memory", methods=["GET"])
def get_memory():
    """Obtiene contexto de memoria actual."""
    try:
        depth = request.args.get("depth", 10, type=int)
        memory_context = memory.get_context(depth)

        return (
            jsonify(
                {
                    "ok": True,
                    "data": {"entries": memory_context, "depth_returned": len(memory_context)},
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error obteniendo memoria: {e}")
        return jsonify({"ok": False, "error": "memory_error", "message": str(e)}), 500


@agent_bp.route("/memory", methods=["DELETE"])
def clear_memory():
    """Limpia la memoria."""
    try:
        memory.clear()
        return jsonify({"ok": True, "message": "Memoria limpiada"}), 200

    except Exception as e:
        logger.error(f"Error limpiando memoria: {e}")
        return jsonify({"ok": False, "error": "memory_error", "message": str(e)}), 500


# ==================== TOOLS ====================


@agent_bp.route("/tools", methods=["GET"])
def list_tools():
    """Lista todas las herramientas disponibles."""
    try:
        tools = [
            data_loader.get_metadata(),
            ml_trainer.get_metadata(),
            evaluator.get_metadata(),
            predictor.get_metadata(),
        ]

        tool_list = [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
                "output_schema": tool.output_schema,
                "version": tool.version,
            }
            for tool in tools
        ]

        return jsonify({"ok": True, "data": {"tools": tool_list, "total": len(tool_list)}}), 200

    except Exception as e:
        logger.error(f"Error listando herramientas: {e}")
        return jsonify({"ok": False, "error": "tools_error", "message": str(e)}), 500


# ==================== DATA LOADING ====================


@agent_bp.route("/data/load", methods=["POST"])
def load_data():
    """Carga datos del sistema."""
    try:
        data = request.get_json()

        # Validar
        try:
            req = DataLoadRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en load_data: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar tool
        result = data_loader.execute(data_type=req.data_type, filters=req.filters, limit=req.limit)

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error cargando datos: {e}")
        return jsonify({"ok": False, "error": "data_load_error", "message": str(e)}), 500


# ==================== ML TRAINING ====================


@agent_bp.route("/ml/train", methods=["POST"])
def train_model():
    """Entrena un modelo ML."""
    try:
        data = request.get_json()

        # Validar
        try:
            req = MLTrainingRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en train_model: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar tool
        result = ml_trainer.execute(
            model_type=req.model_type,
            X_train=req.X_train,
            y_train=req.y_train,
            hyperparams=req.hyperparams,
            model_name=req.model_name,
        )

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error entrenando modelo: {e}")
        return jsonify({"ok": False, "error": "training_error", "message": str(e)}), 500


# ==================== ML EVALUATION ====================


@agent_bp.route("/ml/evaluate", methods=["POST"])
def evaluate_model():
    """Evalúa un modelo ML."""
    try:
        data = request.get_json()

        # Validar
        try:
            req = MLEvaluationRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en evaluate_model: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar tool
        result = evaluator.execute(
            y_true=req.y_true, y_pred=req.y_pred, metrics=req.metrics, problem_type=req.problem_type
        )

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error evaluando modelo: {e}")
        return jsonify({"ok": False, "error": "evaluation_error", "message": str(e)}), 500


# ==================== ML PREDICTION ====================


@agent_bp.route("/ml/predict", methods=["POST"])
def predict():
    """Realiza predicciones con modelo entrenado."""
    try:
        data = request.get_json()

        # Validar
        try:
            req = MLPredictionRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en predict: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar tool
        result = predictor.execute(
            model_name=req.model_name,
            X_test=req.X_test,
            return_probabilities=req.return_probabilities,
            prediction_type=req.prediction_type,
        )

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error en predicción: {e}")
        return jsonify({"ok": False, "error": "prediction_error", "message": str(e)}), 500


# ==================== DEMAND FORECAST ====================


@agent_bp.route("/forecast/demand", methods=["POST"])
def forecast_demand():
    """Pronostica demanda de material."""
    try:
        data = request.get_json()

        # Validar
        try:
            req = DemandForecastRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en forecast_demand: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar pipeline
        result = demand_forecast.predict(
            material_codigo=req.material_codigo,
            centro=req.centro,
            days_ahead=req.days_ahead,
            confidence_level=req.confidence_level,
        )

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error en pronóstico de demanda: {e}")
        return jsonify({"ok": False, "error": "forecast_error", "message": str(e)}), 500


# ==================== CLUSTERING ====================


@agent_bp.route("/cluster/status", methods=["GET"])
def get_clustering_status():
    """Obtiene estado de clustering."""
    return jsonify({"ok": True, "data": clustering.get_status()}), 200


# ==================== SCORING ====================


@agent_bp.route("/score/solicitud", methods=["POST"])
def score_solicitud():
    """Calcula puntuación de solicitud."""
    try:
        data = request.get_json()

        # Validar
        try:
            req = ScoringRequest(**data)
        except ValidationError as e:
            logger.warning(f"Validación fallida en score_solicitud: {e}")
            return jsonify({"ok": False, "error": "validation_error", "message": str(e)}), 422

        # Ejecutar scoring
        result = scoring.score_solicitud(
            solicitud=req.solicitud, presupuesto_disponible=req.presupuesto_disponible
        )

        return jsonify({"ok": True, "data": result}), 200

    except Exception as e:
        logger.error(f"Error en scoring: {e}")
        return jsonify({"ok": False, "error": "scoring_error", "message": str(e)}), 500


# ==================== HEALTH CHECK ====================


@agent_bp.route("/health", methods=["GET"])
def health_check():
    """Health check del agente."""
    try:
        return (
            jsonify(
                {
                    "ok": True,
                    "data": {
                        "status": "operational",
                        "timestamp": datetime.now().isoformat(),
                        "agent_status": "ready",
                        "tools_available": 4,  # DataLoader, MLTrainer, Evaluator, Predictor
                        "memory_entries": len(memory.short_term),
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error en health check: {e}")
        return jsonify({"ok": False, "error": "health_check_error", "message": str(e)}), 500


# ==================== EXPORTAR BLUEPRINT ====================


def register_agent_routes(app):
    """
    Registra las rutas del agente en la app Flask.

    Args:
        app: Instancia de Flask app
    """
    app.register_blueprint(agent_bp)
    logger.info("Agent routes registradas en /api/agent")
