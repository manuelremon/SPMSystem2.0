from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from backend.core.db import get_db_connection


class ApprovalStrategy(ABC):
    """
    Abstract base class for approval rule lookup strategies.
    """

    @abstractmethod
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        pass


class MontoStrategy(ApprovalStrategy):
    """
    Strategy based on amount ranges using the real reglas_aprobacion schema:
    columns: id, rol_solicitante, monto_minimo, monto_maximo, rol_aprobador, niveles_requeridos, activo, created_at
    """
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = TRUE
                    AND monto_minimo <= ?
                    AND (monto_maximo >= ? OR monto_maximo IS NULL)
                ORDER BY monto_minimo DESC
                LIMIT 1
                """,
                (monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            return dict(row) if row else None


class ApprovalContext:
    """
    Context class that executes strategies in order.
    """
    def __init__(self):
        self.strategies: list[ApprovalStrategy] = [
            MontoStrategy(),
        ]

    def get_approval_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        for strategy in self.strategies:
            rule = strategy.find_rule(monto_usd, centro, sector, criticidad)
            if rule:
                return rule
        return None
