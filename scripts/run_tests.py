#!/usr/bin/env python
"""
Script maestro para ejecutar tests de Fase 3

Ejecuta:
1. Unit tests (servicios, repositorio, cache, schemas)
2. Integration tests (endpoints HTTP)
3. Genera reporte

Uso:
    python run_tests.py                    # Todos los tests
    python run_tests.py --unit             # Solo unit tests
    python run_tests.py --integration      # Solo integration tests
    python run_tests.py --verbose          # Modo verbose
    python run_tests.py --coverage         # Con coverage report
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd, description):
    """Ejecutar comando y reportar resultado"""
    print(f"\n{'=' * 70}")
    print(f"📋 {description}")
    print(f"{'=' * 70}")
    print(f"Comando: {' '.join(cmd)}\n")

    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent)
    return result.returncode == 0


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Ejecutar tests de Fase 3")
    parser.add_argument("--unit", action="store_true", help="Solo unit tests")
    parser.add_argument("--integration", action="store_true", help="Solo integration tests")
    parser.add_argument("--verbose", "-v", action="store_true", help="Modo verbose")
    parser.add_argument("--coverage", action="store_true", help="Con coverage report")
    parser.add_argument("--quick", "-q", action="store_true", help="Skip slow tests")

    args = parser.parse_args()

    # Determinar qué tests ejecutar
    run_unit = args.unit or (not args.unit and not args.integration)
    run_integration = args.integration or (not args.unit and not args.integration)

    results = {}

    # =====================================================================
    # UNIT TESTS
    # =====================================================================
    if run_unit:
        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "tests/unit/test_planner_service.py",
            "-v" if args.verbose else "",
            "--tb=short",
        ]
        cmd = [c for c in cmd if c]  # Eliminar strings vacíos

        if args.coverage:
            cmd.extend(["--cov=backend_v2/core/services", "--cov=backend_v2/core/repository"])

        success = run_command(cmd, "UNIT TESTS - Servicios, Repositorio, Cache, Schemas")
        results["unit"] = success

    # =====================================================================
    # INTEGRATION TESTS
    # =====================================================================
    if run_integration:
        cmd = [
            sys.executable,
            "-m",
            "pytest",
            "tests/integration/test_planner_endpoints.py",
            "-v" if args.verbose else "",
            "--tb=short",
        ]
        cmd = [c for c in cmd if c]

        if args.coverage:
            cmd.extend(["--cov=backend_v2/routes/planner"])

        success = run_command(cmd, "INTEGRATION TESTS - Endpoints HTTP")
        results["integration"] = success

    # =====================================================================
    # RESUMEN
    # =====================================================================
    print(f"\n{'=' * 70}")
    print("📊 RESUMEN DE RESULTADOS")
    print(f"{'=' * 70}\n")

    all_passed = all(results.values())

    for test_type, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_type.upper():20} → {status}")

    print(f"\n{'=' * 70}")
    if all_passed:
        print("🎉 TODOS LOS TESTS PASARON ✅")
    else:
        print("⚠️  ALGUNOS TESTS FALLARON ❌")
    print(f"{'=' * 70}\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
