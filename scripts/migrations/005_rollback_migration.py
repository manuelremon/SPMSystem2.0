#!/usr/bin/env python3
"""
Script 005: Rollback de migración de códigos SAP
================================================

Este script restaura las bases de datos al estado anterior a la migración
usando los backups creados por 001_backup_databases.py.

ADVERTENCIA: Este script sobrescribirá los datos actuales con los backups.

Uso:
    python scripts/migrations/005_rollback_migration.py
"""

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


# Configuración de rutas
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
BACKUP_DIR = PROJECT_ROOT / "backup" / "pre_migration_codigos_sap"

DATABASES = [
    "catalogo_materiales.db",
    "sap_data.db",
    "equivalentes.db",
    "spm.db",
]


def get_latest_backup_dir() -> Path | None:
    """Obtiene el directorio del último backup."""
    latest_ref = BACKUP_DIR / "latest"
    if latest_ref.exists():
        with open(latest_ref, "r", encoding="utf-8") as f:
            return Path(f.read().strip())

    # Si no hay referencia, buscar el backup más reciente
    if BACKUP_DIR.exists():
        subdirs = [d for d in BACKUP_DIR.iterdir() if d.is_dir() and d.name != "latest"]
        if subdirs:
            return max(subdirs, key=lambda d: d.stat().st_mtime)

    return None


def verify_backup_integrity(backup_path: Path) -> bool:
    """Verifica la integridad del backup."""
    try:
        conn = sqlite3.connect(backup_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        result = cursor.fetchone()[0]
        conn.close()
        return result == "ok"
    except Exception:
        return False


def restore_database(backup_path: Path, target_path: Path) -> bool:
    """Restaura una base de datos desde backup."""
    try:
        # Verificar integridad del backup antes de restaurar
        if not verify_backup_integrity(backup_path):
            print(f"  ✗ Backup corrupto: {backup_path}")
            return False

        # Copiar backup sobre el archivo actual
        shutil.copy2(backup_path, target_path)
        return True
    except Exception as e:
        print(f"  ✗ Error restaurando {target_path.name}: {e}")
        return False


def rollback_using_mapping() -> bool:
    """
    Alternativa: revertir usando la tabla de mapeo si no hay backup.
    Solo funciona si la migración se completó correctamente.
    """
    catalogo_db = DATA_DIR / "catalogo_materiales.db"

    if not catalogo_db.exists():
        return False

    conn = sqlite3.connect(catalogo_db)
    cursor = conn.cursor()

    # Verificar que existen las tablas necesarias
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('codigo_mapping', 'materiales_backup')
    """)
    tables = {row[0] for row in cursor.fetchall()}

    if "materiales_backup" not in tables:
        conn.close()
        return False

    print("Usando tabla materiales_backup para rollback...")

    try:
        # Restaurar tabla original
        cursor.execute("DROP TABLE IF EXISTS materiales")
        cursor.execute("ALTER TABLE materiales_backup RENAME TO materiales")

        # Recrear índices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiales_descripcion ON materiales(descripcion)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiales_grupo ON materiales(grupo_articulos)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiales_activo ON materiales(activo)")

        conn.commit()
        print("  ✓ Tabla materiales restaurada")

        # Nota: Las otras tablas no se pueden revertir sin backup
        print("\n  ⚠ ADVERTENCIA: Las tablas en sap_data.db, equivalentes.db y spm.db")
        print("    no pueden ser revertidas sin backup. Necesitará restaurarlas manualmente")
        print("    si tienen códigos con el nuevo formato.")

        return True

    except Exception as e:
        print(f"  ✗ Error en rollback por mapeo: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def main():
    """Función principal de rollback."""
    print("=" * 60)
    print("ROLLBACK DE MIGRACIÓN DE CÓDIGOS SAP")
    print("=" * 60)
    print(f"\nFecha: {datetime.now().isoformat()}")
    print()

    # Buscar directorio de backup
    backup_dir = get_latest_backup_dir()

    if not backup_dir or not backup_dir.exists():
        print("No se encontró directorio de backup.")
        print("\nIntentando rollback usando tabla de mapeo...")

        if rollback_using_mapping():
            print("\n✓ Rollback parcial completado usando mapeo")
            print("  Las tablas dependientes pueden requerir restauración manual.")
            return True
        else:
            print("\n✗ No se pudo realizar el rollback")
            print("  No hay backup disponible ni tabla materiales_backup")
            return False

    print(f"Directorio de backup: {backup_dir}")
    print()

    # Verificar que existen los archivos de backup
    missing = []
    for db_name in DATABASES:
        backup_path = backup_dir / db_name
        if not backup_path.exists():
            missing.append(db_name)

    if missing:
        print(f"⚠ Backups faltantes: {missing}")
        print("  Continuando con los backups disponibles...")
        print()

    # Restaurar cada base de datos
    success = True
    restored = []

    for db_name in DATABASES:
        backup_path = backup_dir / db_name
        target_path = DATA_DIR / db_name

        print(f"Restaurando: {db_name}")

        if not backup_path.exists():
            print(f"  ⚠ Backup no encontrado, saltando...")
            continue

        if not target_path.exists():
            print(f"  ⚠ Archivo destino no existe, saltando...")
            continue

        if restore_database(backup_path, target_path):
            print(f"  ✓ Restaurado exitosamente")
            restored.append(db_name)
        else:
            print(f"  ✗ Error al restaurar")
            success = False

    # Verificar integridad de las bases restauradas
    print("\nVerificando integridad de bases restauradas...")
    for db_name in restored:
        db_path = DATA_DIR / db_name
        if verify_backup_integrity(db_path):
            print(f"  ✓ {db_name}: OK")
        else:
            print(f"  ✗ {db_name}: CORRUPTA")
            success = False

    # Resultado
    print()
    print("=" * 60)
    if success and len(restored) == len(DATABASES):
        print("✓ ROLLBACK COMPLETADO EXITOSAMENTE")
    elif restored:
        print("⚠ ROLLBACK PARCIAL COMPLETADO")
        print(f"   Restaurados: {restored}")
    else:
        print("✗ ROLLBACK FALLIDO")
    print("=" * 60)

    return success


if __name__ == "__main__":
    import sys

    print("ADVERTENCIA: Este script restaurará las bases de datos al estado")
    print("anterior a la migración, sobrescribiendo los datos actuales.")
    print()

    response = input("¿Desea continuar con el rollback? (s/N): ").strip().lower()
    if response != "s":
        print("Rollback cancelado.")
        sys.exit(0)

    print()
    success = main()
    sys.exit(0 if success else 1)
