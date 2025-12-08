"""
Clase base para herramientas del agente ReAct.

Todas las herramientas deben heredar de BaseTool e implementar execute().
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class ToolMetadata:
    """Metadatos de una herramienta."""

    name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    version: str = "1.0"


class ToolError(Exception):
    """Excepción base para errores en herramientas."""

    pass


class BaseTool(ABC):
    """
    Clase base para todas las herramientas del agente.

    Una herramienta es una acción que el agente puede ejecutar
    para avanzar hacia su objetivo.
    """

    def __init__(self, name: str, description: str):
        """
        Inicializa la herramienta.

        Args:
            name: Nombre único de la herramienta
            description: Descripción de qué hace
        """
        self.name = name
        self.description = description
        self.execution_count = 0
        self.last_error: Optional[str] = None

    @abstractmethod
    def execute(self, **kwargs) -> Dict[str, Any]:
        """
        Ejecuta la herramienta.

        Args:
            **kwargs: Parámetros específicos de la herramienta

        Returns:
            Diccionario con resultado de la ejecución
        """
        pass

    @abstractmethod
    def get_metadata(self) -> ToolMetadata:
        """
        Retorna metadatos de la herramienta para el agente.

        Returns:
            ToolMetadata con esquema de entrada/salida
        """
        pass

    def __call__(self, **kwargs) -> Dict[str, Any]:
        """
        Permite llamar la herramienta como función.

        Mantiene estadísticas y manejo de errores.
        """
        try:
            self.execution_count += 1
            self.last_error = None
            result = self.execute(**kwargs)
            result["_tool_name"] = self.name
            result["_success"] = True
            return result
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error en herramienta {self.name}: {e}")
            return {"_tool_name": self.name, "_success": False, "_error": str(e)}

    def validate_params(self, params: Dict[str, Any], required: list) -> bool:
        """
        Valida que los parámetros requeridos estén presentes.

        Args:
            params: Diccionario de parámetros
            required: Lista de parámetros requeridos

        Returns:
            True si válido, lanza excepción si no
        """
        missing = [p for p in required if p not in params]
        if missing:
            raise ToolError(f"Parámetros requeridos faltantes: {missing}")
        return True

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name}, executions={self.execution_count})"
