import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Add project root to path (parent of backend)
sys.path.append(os.getcwd())

try:
    from backend.services.approval_service import obtener_regla_aprobacion
    from backend.core.approval_strategies import ApprovalContext, CriticidadStrategy
except ImportError as e:
    print(f"Import Error: {e}")
    # Try adding explicit path if still failing
    sys.path.append(os.path.dirname(os.getcwd()))
    try:
        from backend.services.approval_service import obtener_regla_aprobacion
        from backend.core.approval_strategies import ApprovalContext, CriticidadStrategy
    except ImportError as e2:
         print(f"Import Error 2: {e2}")
         sys.exit(1)

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
