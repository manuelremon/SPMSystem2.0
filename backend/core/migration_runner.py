"""
Migration Runner - Sistema de migraciones automáticas para SPM v3.0

Este módulo proporciona funcionalidad para:
1. Detectar migraciones pendientes
2. Ejecutar migraciones en orden
3. Registrar migraciones aplicadas en schema_migrations
"""

import importlib.util
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from backend.core.db import get_db_connection, get_db_transaction

logger = logging.getLogger(__name__)


def get_migrations_dir() -> Path:
    """Obtiene el directorio de migraciones"""
    return Path(__file__).parent.parent / "migrations"


def ensure_schema_migrations_table():
    """Crea la tabla schema_migrations si no existe"""
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                execution_time_ms INTEGER
            )
        """)


def get_applied_migrations() -> List[str]:
    """Obtiene lista de migraciones ya aplicadas"""
    ensure_schema_migrations_table()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        return [row[0] for row in cur.fetchall()]


def get_available_migrations() -> List[Tuple[str, Path]]:
    """
    Obtiene lista de migraciones disponibles ordenadas por versión
    Retorna lista de tuplas (version, path)
    """
    migrations_dir = get_migrations_dir()
    if not migrations_dir.exists():
        logger.warning(f"Directorio de migraciones no existe: {migrations_dir}")
        return []

    migrations = []
    pattern = re.compile(r"^(\d+)_.*\.py$")

    for file_path in migrations_dir.glob("*.py"):
        if file_path.name.startswith("__"):
            continue

        # Extraer versión del nombre del archivo
        match = pattern.match(file_path.name)
        if match:
            version = file_path.stem  # Nombre sin extensión
            migrations.append((version, file_path))
        else:
            # Archivos sin número (como create_mensajes_table.py)
            version = file_path.stem
            migrations.append((version, file_path))

    # Ordenar por nombre (las que empiezan con número van primero)
    return sorted(migrations, key=lambda x: (
        not x[0][0].isdigit(),  # Numéricas primero
        x[0].zfill(50)  # Ordenar numéricamente
    ))


def get_pending_migrations() -> List[Tuple[str, Path]]:
    """Obtiene migraciones pendientes de aplicar"""
    applied = set(get_applied_migrations())
    available = get_available_migrations()
    return [(v, p) for v, p in available if v not in applied]


def run_migration(version: str, file_path: Path) -> bool:
    """
    Ejecuta una migración individual

    La migración debe tener una función `migrate()` o `up()`
    """
    logger.info(f"Ejecutando migración: {version}")
    start_time = datetime.now()

    try:
        # Cargar el módulo dinámicamente
        spec = importlib.util.spec_from_file_location(version, file_path)
        if not spec or not spec.loader:
            logger.error(f"No se pudo cargar la especificación del módulo: {file_path}")
            return False

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Buscar función de migración
        migrate_fn = getattr(module, "migrate", None) or getattr(module, "up", None)
        if not migrate_fn:
            logger.warning(f"Migración {version} no tiene función migrate() o up()")
            return False

        # Ejecutar migración
        migrate_fn()

        # Calcular tiempo de ejecución
        execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Registrar migración aplicada
        description = getattr(module, "__doc__", None) or f"Migración {version}"
        if description:
            # Limpiar docstring
            description = description.strip().split("\n")[0][:200]

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO schema_migrations (version, description, execution_time_ms)
                VALUES (?, ?, ?)
                """,
                (version, description, execution_time_ms),
            )

        logger.info(f"✓ Migración {version} completada en {execution_time_ms}ms")
        return True

    except Exception as e:
        logger.error(f"✗ Error ejecutando migración {version}: {e}")
        return False


def run_pending_migrations() -> Tuple[int, int]:
    """
    Ejecuta todas las migraciones pendientes

    Returns:
        Tupla (exitosas, fallidas)
    """
    pending = get_pending_migrations()

    if not pending:
        logger.info("No hay migraciones pendientes")
        return (0, 0)

    logger.info(f"Encontradas {len(pending)} migraciones pendientes")

    successful = 0
    failed = 0

    for version, file_path in pending:
        if run_migration(version, file_path):
            successful += 1
        else:
            failed += 1
            # Detenerse al primer error para mantener consistencia
            logger.error(f"Deteniendo migraciones por error en {version}")
            break

    logger.info(f"Migraciones completadas: {successful} exitosas, {failed} fallidas")
    return (successful, failed)


def mark_as_applied(versions: Optional[List[str]] = None):
    """
    Marca migraciones como aplicadas sin ejecutarlas

    Útil para sistemas existentes donde las tablas ya existen
    """
    ensure_schema_migrations_table()

    if versions is None:
        # Marcar todas las disponibles
        versions = [v for v, _ in get_available_migrations()]

    with get_db_transaction() as conn:
        cur = conn.cursor()
        for version in versions:
            cur.execute(
                """
                INSERT OR IGNORE INTO schema_migrations (version, description)
                VALUES (?, ?)
                """,
                (version, f"Marcada como aplicada (existente)"),
            )

    logger.info(f"Marcadas {len(versions)} migraciones como aplicadas")


def migration_status() -> List[dict]:
    """
    Obtiene estado de todas las migraciones

    Returns:
        Lista de diccionarios con información de cada migración
    """
    applied = {v: True for v in get_applied_migrations()}
    available = get_available_migrations()

    status = []
    for version, file_path in available:
        is_applied = version in applied
        status.append({
            "version": version,
            "file": file_path.name,
            "applied": is_applied,
            "status": "✓ applied" if is_applied else "○ pending"
        })

    return status


# CLI helper
if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if len(sys.argv) < 2:
        print("Uso: python -m backend.core.migration_runner <comando>")
        print("\nComandos:")
        print("  status     - Ver estado de migraciones")
        print("  run        - Ejecutar migraciones pendientes")
        print("  mark-all   - Marcar todas como aplicadas (sin ejecutar)")
        sys.exit(1)

    command = sys.argv[1]

    if command == "status":
        print("\n=== Estado de Migraciones ===\n")
        for m in migration_status():
            print(f"  {m['status']:12} {m['version']}")
        print()

    elif command == "run":
        successful, failed = run_pending_migrations()
        sys.exit(0 if failed == 0 else 1)

    elif command == "mark-all":
        mark_as_applied()
        print("Todas las migraciones marcadas como aplicadas")

    else:
        print(f"Comando desconocido: {command}")
        sys.exit(1)
