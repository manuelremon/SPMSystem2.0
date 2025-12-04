#!/usr/bin/env python
"""Test rápido de imports y funcionalidad básica."""

print("1. Testing imports...")
try:
    from src.planner.optimization import (ConstraintBuilder, ModelAnalyzer,
                                          SolverConfig, SolverManager,
                                          SolverStrategy)

    print("   OK - Imports exitosos")
except Exception as e:
    print(f"   ERROR - {e}")
    exit(1)

print("\n2. Testing ConstraintBuilder...")
try:
    builder = ConstraintBuilder()
    builder.add_demand_constraint("SKU001", 100, "unidades")
    builder.add_capacity_constraint("LOC_A", 500, current_inventory=50)
    constraints = builder.build()
    summary = builder.get_constraint_summary()
    print(f"   OK - Restricciones creadas: {summary}")
except Exception as e:
    print(f"   ERROR - {e}")
    exit(1)

print("\n3. Testing SolverManager (Greedy)...")
try:
    from src.planner.optimization import ConstraintSet

    config = SolverConfig(strategy=SolverStrategy.GREEDY)
    manager = SolverManager(config)

    cte_scores = [
        {"option_id": "SUP_A", "cte": 50.0, "qty": 1, "max_qty": 100},
        {"option_id": "SUP_B", "cte": 40.0, "qty": 1, "max_qty": 150},
    ]

    builder = ConstraintBuilder()
    constraints = ConstraintSet(builder.build())

    result = manager.solve(
        item_id="TEST",
        demand=100.0,
        required_date="2025-10-30",
        cte_scores=cte_scores,
        constraints=constraints,
    )

    print("   OK - Solver exitoso")
    print(f"   Exito: {result.success}")
    print(f"   Costo: ${result.objective_value:.2f}")
    print(f"   Tiempo: {result.solve_time_seconds:.3f}s")

except Exception as e:
    print(f"   ERROR - {e}")
    import traceback

    traceback.print_exc()
    exit(1)

print("\n4. Testing ModelAnalyzer...")
try:
    analyzer = ModelAnalyzer()
    report = analyzer.generate_report(result, constraints)
    print("   OK - Análisis completado")
    print(f"   Status: {report['solution_status']}")
except Exception as e:
    print(f"   ERROR - {e}")
    exit(1)

print("\n✓ Todos los tests pasaron!")
