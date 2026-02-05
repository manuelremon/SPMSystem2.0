#!/usr/bin/env python3
"""
Script Maestro: Migración completa de códigos SAP
=================================================

Este script ejecuta todos los pasos de la migración en secuencia:
1. Backup de bases de datos
2. Crear tabla de mapeo
3. Ejecutar migración
4. Validar resultados

Uso:
    python scripts/migrations/migrate_sap_codes.py [--dry-run] [--skip-backup]

Opciones:
    --dry-run      Solo simula la migración, no hace cambios
    --skip-backup  Salta el paso de backup (usar con precaución)
"""

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent.parent.parent
MIGRATIONS_DIR = PROJECT_ROOT / "scripts" / "migrations"


def run_script(script_name: str, description: str, dry_run: bool = False) -> bool:
    """Ejecuta un script de migración."""
    script_path = MIGRATIONS_DIR / script_name

    print()
    print("=" * 60)
    print(f"PASO: {description}")
    print("=" * 60)
    print(f"Script: {script_name}")
    print()

    if dry_run:
        print("  [DRY-RUN] Se ejecutaría este script")
        return True

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(PROJECT_ROOT),
            capture_output=False,
            text=True,
            input="s\n",  # Auto-confirmar prompts
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error ejecutando {script_name}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Migración completa de códigos SAP de materiales"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula la migración sin hacer cambios",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="Salta el paso de backup (usar con precaución)",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Salta el paso de validación",
    )

    args = parser.parse_args()

    print()
    print("=" * 60)
    print("MIGRACIÓN DE CÓDIGOS SAP DE MATERIALES")
    print("=" * 60)
    print(f"Fecha: {datetime.now().isoformat()}")
    print(f"Modo: {'DRY-RUN (simulación)' if args.dry_run else 'EJECUCIÓN REAL'}")
    print()

    if not args.dry_run:
        print("ADVERTENCIA: Esta operación modificará permanentemente las bases de datos.")
        print()
        response = input("¿Desea continuar? (s/N): ").strip().lower()
        if response != "s":
            print("Migración cancelada.")
            return False

    steps = []

    # Paso 1: Backup
    if not args.skip_backup:
        steps.append(("001_backup_databases.py", "Crear backup de bases de datos"))

    # Paso 2: Crear mapeo
    steps.append(("002_create_mapping_table.py", "Crear tabla de mapeo de códigos"))

    # Paso 3: Migración
    steps.append(("003_migrate_material_codes.py", "Ejecutar migración principal"))

    # Paso 4: Validación
    if not args.skip_validation:
        steps.append(("004_validate_migration.py", "Validar resultados de migración"))

    # Ejecutar pasos
    for script_name, description in steps:
        success = run_script(script_name, description, args.dry_run)
        if not success and not args.dry_run:
            print()
            print("=" * 60)
            print("✗ MIGRACIÓN FALLIDA")
            print("=" * 60)
            print()
            print("Para restaurar desde backup:")
            print("  python scripts/migrations/005_rollback_migration.py")
            return False

    # Resumen final
    print()
    print("=" * 60)
    if args.dry_run:
        print("✓ SIMULACIÓN COMPLETADA")
        print()
        print("Para ejecutar la migración real:")
        print("  python scripts/migrations/migrate_sap_codes.py")
    else:
        print("✓ MIGRACIÓN COMPLETADA EXITOSAMENTE")
        print()
        print("Próximos pasos:")
        print("  1. Verificar funcionamiento de la aplicación")
        print("  2. Si hay problemas, ejecutar rollback:")
        print("     python scripts/migrations/005_rollback_migration.py")
    print("=" * 60)

    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
