"""
Tests para el módulo de optimización MIP/ILP.
"""

import unittest

from src.planner.optimization import (ConstraintBuilder, ConstraintSet,
                                      ConstraintType, ModelAnalyzer,
                                      SolverConfig, SolverManager,
                                      SolverStrategy)


class TestConstraintBuilder(unittest.TestCase):
    """Tests para ConstraintBuilder."""

    def test_empty_builder(self):
        """Test builder vacío."""
        builder = ConstraintBuilder()
        constraints = builder.build()
        summary = builder.get_constraint_summary()
        self.assertEqual(len(summary), 0)

    def test_add_demand_constraint(self):
        """Test agregar restricción de demanda."""
        builder = ConstraintBuilder()
        builder.add_demand_constraint("SKU001", 100, "unidades")
        constraints = builder.build()

        self.assertIn(ConstraintType.DEMAND, constraints)
        self.assertEqual(len(constraints[ConstraintType.DEMAND]), 1)

    def test_add_capacity_constraint(self):
        """Test agregar restricción de capacidad."""
        builder = ConstraintBuilder()
        builder.add_capacity_constraint("CDMX", 500, current_inventory=50)
        constraints = builder.build()

        self.assertIn(ConstraintType.CAPACITY, constraints)
        cap_constraint = constraints[ConstraintType.CAPACITY][0]
        self.assertEqual(cap_constraint.available_capacity, 450)

    def test_builder_fluency(self):
        """Test builder fluido (chainable)."""
        builder = ConstraintBuilder()
        result = (
            builder.add_demand_constraint("SKU001", 100, "unidades")
            .add_capacity_constraint("CDMX", 500)
            .add_budget_constraint(50000)
        )

        self.assertIsInstance(result, ConstraintBuilder)
        summary = result.get_constraint_summary()
        self.assertEqual(len(summary), 3)

    def test_constraint_validation(self):
        """Test validación de restricciones."""
        builder = ConstraintBuilder()
        builder.add_demand_constraint("SKU001", 100, "unidades")

        is_valid, issues = builder.validate()
        # Debería ser válido (no tiene FEFO sin capacidad, etc)
        self.assertTrue(is_valid)


class TestConstraintSet(unittest.TestCase):
    """Tests para ConstraintSet."""

    def test_demand_constraints_property(self):
        """Test propiedad demand_constraints."""
        builder = ConstraintBuilder()
        builder.add_demand_constraint("SKU001", 100, "unidades")
        constraints_dict = builder.build()

        constraint_set = ConstraintSet(constraints_dict)
        demands = constraint_set.demand_constraints

        self.assertEqual(len(demands), 1)
        self.assertEqual(demands[0].quantity_required, 100)

    def test_multiple_constraint_types(self):
        """Test múltiples tipos de restricciones."""
        builder = ConstraintBuilder()
        builder.add_demand_constraint("SKU001", 100, "unidades")
        builder.add_capacity_constraint("LOC_A", 500)
        builder.add_budget_constraint(50000)
        constraints_dict = builder.build()

        constraint_set = ConstraintSet(constraints_dict)

        self.assertEqual(len(constraint_set.demand_constraints), 1)
        self.assertEqual(len(constraint_set.capacity_constraints), 1)
        self.assertEqual(len(constraint_set.budget_constraints), 1)


class TestGreedySolver(unittest.TestCase):
    """Tests para el solver greedy."""

    def setUp(self):
        """Configuración inicial."""
        self.config = SolverConfig(strategy=SolverStrategy.GREEDY)
        self.manager = SolverManager(self.config)

        # CTE scores para prueba
        self.cte_scores = [
            {"option_id": "SUP_A", "cte": 50.0, "qty": 1, "max_qty": 100},
            {"option_id": "SUP_B", "cte": 40.0, "qty": 1, "max_qty": 150},
            {"option_id": "SUP_C", "cte": 45.0, "qty": 1, "max_qty": 80},
        ]

        # Restricciones simples
        builder = ConstraintBuilder()
        self.constraints = ConstraintSet(builder.build())

    def test_greedy_solve_simple(self):
        """Test solver greedy simple."""
        result = self.manager.solve(
            item_id="TEST_SKU",
            demand=100.0,
            required_date="2025-10-30",
            cte_scores=self.cte_scores,
            constraints=self.constraints,
        )

        self.assertTrue(result.success)
        self.assertIsNotNone(result.objective_value)
        self.assertGreater(result.objective_value, 0)

    def test_greedy_respects_demand(self):
        """Test que greedy respeta demanda."""
        result = self.manager.solve(
            item_id="TEST_SKU",
            demand=100.0,
            required_date="2025-10-30",
            cte_scores=self.cte_scores,
            constraints=self.constraints,
        )

        if result.success:
            total_qty = result.solution.get("total_quantity", 0)
            self.assertGreaterEqual(total_qty, 100.0 - 1e-6)

    def test_greedy_minimize_cost(self):
        """Test que greedy minimiza costo."""
        result = self.manager.solve(
            item_id="TEST_SKU",
            demand=100.0,
            required_date="2025-10-30",
            cte_scores=self.cte_scores,
            constraints=self.constraints,
        )

        # Costo mínimo teórico: 100 * 40 = 4000
        if result.success:
            self.assertLessEqual(result.objective_value, 4100)


class TestBatchSolve(unittest.TestCase):
    """Tests para batch solve."""

    def test_batch_solve_multiple_items(self):
        """Test resolver múltiples ítems."""
        config = SolverConfig(strategy=SolverStrategy.GREEDY)
        manager = SolverManager(config)

        items = [
            {
                "item_id": "SKU001",
                "demand": 100,
                "required_date": "2025-10-30",
                "cte_scores": [
                    {"option_id": "A", "cte": 50, "qty": 1, "max_qty": 100},
                ],
            },
            {
                "item_id": "SKU002",
                "demand": 50,
                "required_date": "2025-10-31",
                "cte_scores": [
                    {"option_id": "B", "cte": 30, "qty": 1, "max_qty": 75},
                ],
            },
        ]

        builder = ConstraintBuilder()
        constraints = ConstraintSet(builder.build())

        results = manager.batch_solve(items, constraints)

        self.assertEqual(len(results), 2)
        self.assertTrue(all(r.success for r in results))

    def test_portfolio_summary(self):
        """Test resumen de portafolio."""
        config = SolverConfig(strategy=SolverStrategy.GREEDY)
        manager = SolverManager(config)

        items = [
            {
                "item_id": f"SKU{i:03d}",
                "demand": 100,
                "required_date": "2025-10-30",
                "cte_scores": [
                    {"option_id": f"OPT_{i}", "cte": 50, "qty": 1, "max_qty": 100},
                ],
            }
            for i in range(3)
        ]

        builder = ConstraintBuilder()
        constraints = ConstraintSet(builder.build())

        results = manager.batch_solve(items, constraints)
        summary = manager.get_portfolio_summary(results)

        self.assertEqual(summary["num_items"], 3)
        self.assertEqual(summary["num_feasible"], 3)
        self.assertGreater(summary["total_cost"], 0)


class TestModelAnalyzer(unittest.TestCase):
    """Tests para ModelAnalyzer."""

    def setUp(self):
        """Configuración inicial."""
        config = SolverConfig(strategy=SolverStrategy.GREEDY)
        manager = SolverManager(config)

        cte_scores = [
            {"option_id": "SUP_A", "cte": 50.0, "qty": 1, "max_qty": 100},
            {"option_id": "SUP_B", "cte": 40.0, "qty": 1, "max_qty": 100},
        ]

        builder = ConstraintBuilder()
        constraints = ConstraintSet(builder.build())

        self.result = manager.solve(
            item_id="TEST",
            demand=100,
            required_date="2025-10-30",
            cte_scores=cte_scores,
            constraints=constraints,
        )

        self.constraints = constraints

    def test_analyze_solution(self):
        """Test análisis de solución."""
        analyzer = ModelAnalyzer()
        analysis = analyzer.analyze_solution(self.result, self.constraints)

        self.assertIn("timestamp", analysis)
        self.assertIn("feasibility", analysis)
        self.assertIn("cost_breakdown", analysis)
        self.assertIn("robustness", analysis)
        self.assertIn("recommendations", analysis)

    def test_generate_report(self):
        """Test generación de reporte."""
        analyzer = ModelAnalyzer()
        report = analyzer.generate_report(self.result, self.constraints)

        self.assertIn("generated_at", report)
        self.assertIn("solution_status", report)
        self.assertIn("objective_value", report)
        self.assertIn("analysis", report)

    def test_cost_breakdown(self):
        """Test desglose de costos."""
        analyzer = ModelAnalyzer()
        breakdown = analyzer._analyze_cost_breakdown(self.result)

        self.assertIsInstance(breakdown, list)
        if breakdown:
            self.assertGreater(breakdown[0].total_cost, 0)


class TestConstraintTypes(unittest.TestCase):
    """Tests para tipos específicos de restricciones."""

    def test_demand_constraint_invalid(self):
        """Test que demanda inválida lanza error."""
        with self.assertRaises(ValueError):
            builder = ConstraintBuilder()
            builder.add_demand_constraint("SKU001", -10, "unidades")

    def test_capacity_available(self):
        """Test capacidad disponible."""
        builder = ConstraintBuilder()
        builder.add_capacity_constraint("LOC", max_units=500, current_inventory=100)

        constraints = builder.build()
        cap = constraints[ConstraintType.CAPACITY][0]

        self.assertEqual(cap.available_capacity, 400)
        self.assertEqual(cap.utilization_rate, 20.0)

    def test_one_in_constraint_invalid(self):
        """Test restricción one-in con lista vacía."""
        with self.assertRaises(ValueError):
            from src.planner.optimization import OneInConstraint

            OneInConstraint(item_id="SKU001", allowed_suppliers=[])


class TestSolverStrategies(unittest.TestCase):
    """Tests para diferentes estrategias de solver."""

    def setUp(self):
        """Configuración."""
        self.cte_scores = [
            {"option_id": "A", "cte": 50, "qty": 1, "max_qty": 100},
            {"option_id": "B", "cte": 40, "qty": 1, "max_qty": 100},
        ]

        builder = ConstraintBuilder()
        self.constraints = ConstraintSet(builder.build())

    def test_strategy_greedy(self):
        """Test estrategia greedy."""
        config = SolverConfig(strategy=SolverStrategy.GREEDY)
        manager = SolverManager(config)

        result = manager.solve(
            item_id="TEST",
            demand=100,
            required_date="2025-10-30",
            cte_scores=self.cte_scores,
            constraints=self.constraints,
        )

        self.assertEqual(result.strategy_used, "greedy")
        self.assertTrue(result.success)

    def test_strategy_greedy_with_reopt(self):
        """Test estrategia greedy con reopt."""
        config = SolverConfig(strategy=SolverStrategy.GREEDY_WITH_REOPT)
        manager = SolverManager(config)

        result = manager.solve(
            item_id="TEST",
            demand=100,
            required_date="2025-10-30",
            cte_scores=self.cte_scores,
            constraints=self.constraints,
        )

        self.assertEqual(result.strategy_used, "greedy_with_reopt")
        self.assertTrue(result.success)


def run_tests():
    """Ejecuta todos los tests."""
    unittest.main(verbosity=2, exit=False)


if __name__ == "__main__":
    print("- Testing constraint_builder")
    print("- Testing constraint_set")
    print("- Testing greedy_solver")
    print("- Testing batch_solve")
    print("- Testing model_analyzer")
    print("- Testing constraint_types")
    print("- Testing solver_strategies")
    print("")
    run_tests()
