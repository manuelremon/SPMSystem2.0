import unittest
from unittest.mock import MagicMock, patch

import pytest

# OBSOLETO: este test referencia `CriticidadStrategy`, que ya no existe en
# backend/core/approval_strategies.py (solo quedan ApprovalStrategy, MontoStrategy,
# ApprovalContext tras un refactor). Se omite hasta reescribirlo contra la API actual.
pytest.skip(
    "Test obsoleto: CriticidadStrategy fue eliminada del modulo approval_strategies",
    allow_module_level=True,
)

from backend.core.approval_strategies import ApprovalContext, CriticidadStrategy  # noqa: E402,F401


class TestApprovalStrategies(unittest.TestCase):
    
    @patch('backend.core.approval_strategies.get_db_connection')
    def test_criticidad_strategy(self, mock_conn):
        # Setup mock
        mock_cursor = MagicMock()
        mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = {"id": 1, "nombre": "Regla Critica"}
        
        # Test
        strategy = CriticidadStrategy()
        result = strategy.find_rule(100.0, criticidad="Alta")
        
        self.assertIsNotNone(result)
        self.assertEqual(result["nombre"], "Regla Critica")

    @patch('backend.core.approval_strategies.get_db_connection')
    def test_context_integration(self, mock_conn):
        # Setup mock for context execution
        mock_cursor = MagicMock()
        mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor
        
        # Scenario: First strategy (Criticidad) returns None, Second (Centro) returns a rule
        # We need to simulate the DB calls. 
        # Strategy 1 executes a query. fetchone -> None
        # Strategy 2 executes a query. fetchone -> Result
        
        mock_cursor.fetchone.side_effect = [None, {"id": 2, "nombre": "Regla Centro"}]
        
        context = ApprovalContext()
        # We pass arguments that would trigger at least the first two strategies
        result = context.get_approval_rule(100.0, centro="IT", criticidad="Baja")
        
        self.assertIsNotNone(result)
        self.assertEqual(result["nombre"], "Regla Centro")

if __name__ == "__main__":
    unittest.main()
