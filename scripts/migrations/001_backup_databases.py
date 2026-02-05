#!/usr/bin/env python3
"""
Script 001: Backup de bases de datos antes de migración de códigos SAP
=====================================================================

Este script crea copias de seguridad de todas las bases de datos SQLite
antes de ejecutar la migración de códigos de material.

Uso:
    python scripts/migrations/001_backup_databases.py
"""

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


# Configuración de rutas
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
BACKUP_DIR = PROJECT_ROOT / "backup" / "pre_migration_codigos_sap"

# Bases de datos a respaldar
DATABASES = [
    "catalogo_materiales.db",
    "sap_data.db",
    "equivalentes.db",
    "spm.db",
]


def verify_database_integrity(db_path: Path) -> bool:
    """Verifica la integridad de una base de datos SQLite."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        result = cursor.fetchone()[0]
        conn.close()
        return result == "ok"
    except Exception as e:
        print(f"  Error verificando {db_path.name}: {e}")
        return False


def get_table_counts(db_path: Path) -> dict:
    """Obtiene el conteo de registros de cada tabla."""
    counts = {}
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]
        for table in tables:
            if not table.startswith("sqlite_"):
                cursor.execute(f"SELECT COUNT(*) FROM [{table}]")
                counts[table] = cursor.fetchone()[0]
        conn.close()
    except Exception as e:
        print(f"  Error obteniendo conteos de {db_path.name}: {e}")
    return counts


def backup_databases() -> bool:
    """Crea backups de todas las bases de datos."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_subdir = BACKUP_DIR / timestamp

    print("=" * 60)
    print("BACKUP DE BASES DE DATOS - MIGRACIÓN CÓDIGOS SAP")
    print("=" * 60)
    print(f"\nTimestamp: {timestamp}")
    print(f"Directorio de backup: {backup_subdir}")
    print()

    # Crear directorio de backup
    backup_subdir.mkdir(parents=True, exist_ok=True)

    success = True
    backup_info = {}

    for db_name in DATABASES:
        db_path = DATA_DIR / db_name
        backup_path = backup_subdir / db_name

        print(f"Procesando: {db_name}")

        if not db_path.exists():
            print(f"  ⚠ No existe: {db_path}")
            continue

        # Verificar integridad antes de copiar
        print("  Verificando integridad...")
        if not verify_database_integrity(db_path):
            print(f"  ✗ Integridad fallida para {db_name}")
            success = False
            continue

        # Obtener conteos de tablas
        counts = get_table_counts(db_path)

        # Copiar archivo
        print("  Copiando...")
        try:
            shutil.copy2(db_path, backup_path)
            file_size = db_path.stat().st_size / (1024 * 1024)  # MB
            print(f"  ✓ Backup creado: {backup_path.name} ({file_size:.2f} MB)")

            backup_info[db_name] = {
                "path": str(backup_path),
                "size_mb": file_size,
                "tables": counts,
            }
        except Exception as e:
            print(f"  ✗ Error copiando {db_name}: {e}")
            success = False

    # Guardar manifiesto de backup
    manifest_path = backup_subdir / "manifest.txt"
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(f"Backup de Migración de Códigos SAP\n")
        f.write(f"Fecha: {datetime.now().isoformat()}\n")
        f.write(f"{'=' * 50}\n\n")

        for db_name, info in backup_info.items():
            f.write(f"{db_name}:\n")
            f.write(f"  Tamaño: {info['size_mb']:.2f} MB\n")
            f.write(f"  Tablas:\n")
            for table, count in info["tables"].items():
                f.write(f"    - {table}: {count:,} registros\n")
            f.write("\n")

    print()
    print(f"Manifiesto guardado: {manifest_path}")

    # Crear archivo de referencia con la ruta del último backup
    latest_ref = BACKUP_DIR / "latest"
    with open(latest_ref, "w", encoding="utf-8") as f:
        f.write(str(backup_subdir))

    print()
    if success:
        print("=" * 60)
        print("✓ BACKUP COMPLETADO EXITOSAMENTE")
        print("=" * 60)
    else:
        print("=" * 60)
        print("✗ BACKUP COMPLETADO CON ERRORES")
        print("=" * 60)

    return success


if __name__ == "__main__":
    import sys
    success = backup_databases()
    sys.exit(0 if success else 1)
