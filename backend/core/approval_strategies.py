from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from backend.core.db import get_db_connection

class ApprovalStrategy(ABC):
    """
    Abstract base class for approval rule lookup strategies.
    """
    
    @abstractmethod
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Attempts to find a matching approval rule based on the criteria.
        Returns the rule dict if found, or None if this strategy doesn't yield a result.
        """
        pass

class CriticidadStrategy(ApprovalStrategy):
    """
    Strategy to find rules based on criticality (High priority).
    """
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not criticidad:
            return None
            
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND criticidad = ?
                    AND (monto_minimo_usd <= ? OR monto_minimo_usd IS NULL)
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                ORDER BY nivel_aprobacion DESC
                LIMIT 1
                """,
                (criticidad, monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            return dict(row) if row else None

class CentroStrategy(ApprovalStrategy):
    """
    Strategy to find rules based on Cost Center.
    """
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not centro:
            return None
            
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND centro = ?
                    AND (monto_minimo_usd <= ? OR monto_minimo_usd IS NULL)
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                ORDER BY nivel_aprobacion DESC
                LIMIT 1
                """,
                (centro, monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            return dict(row) if row else None

class MontoStrategy(ApprovalStrategy):
    """
    General strategy based purely on Amount.
    Excludes explicitly 'admin' position rules unless they are the only ones matching generical criteria.
    """
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND centro IS NULL
                    AND sector IS NULL
                    AND criticidad IS NULL
                    AND monto_minimo_usd <= ?
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                    AND LOWER(rol_requerido) != 'admin'
                ORDER BY monto_minimo_usd DESC
                LIMIT 1
                """,
                (monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            return dict(row) if row else None

class AdminFallbackStrategy(ApprovalStrategy):
    """
    Fallback strategy that finds the generic Admin rule if no other specific rule applies.
    """
    def find_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND LOWER(rol_requerido) = 'admin'
                    AND monto_minimo_usd <= ?
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                LIMIT 1
                """,
                (monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            return dict(row) if row else None

class ApprovalContext:
    """
    Context class that executes strategies in a defined order.
    """
    def __init__(self):
        self.strategies: list[ApprovalStrategy] = [
            CriticidadStrategy(),
            CentroStrategy(),
            MontoStrategy(),
            AdminFallbackStrategy()
        ]
    
    def get_approval_rule(self, monto_usd: float, centro: Optional[str] = None, sector: Optional[str] = None, criticidad: Optional[str] = None) -> Optional[Dict[str, Any]]:
        for strategy in self.strategies:
            rule = strategy.find_rule(monto_usd, centro, sector, criticidad)
            if rule:
                return rule
        return None
