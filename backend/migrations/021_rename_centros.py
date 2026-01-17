"""
Migracion 021: Renombrar Centros

Esta migracion actualiza los codigos y nombres de centros en todas las tablas:
- 1001 (Planta Norte) -> AA101 (Deposito 1)
- 1002 (Planta Sur) -> AA102 (Deposito 2)
- 1003 (Planta Este) -> AA103 (Deposito 3)
- 1004 (Terminal Alpha) -> AA104 (Deposito 4)
- 1005 (Terminal Beta) -> AA105 (Deposito 5)
- 1006 (Terminal Gamma) -> AA106 (Deposito 6)

Fecha: 2026-01-16
"""

import logging
import os
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

# Mapeo de codigos
CENTRO_MAPPING = {
    "1001": "AA101",
    "1002": "AA102",
    "1003": "AA103",
    "1004": "AA104",
    "1005": "AA105",
    "1006": "AA106",
}

# Mapeo inverso para rollback
CENTRO_MAPPING_REVERSE = {v: k for k, v in CENTRO_MAPPING.items()}

# Mapeo de nombres
NOMBRE_MAPPING = {
    "Planta Norte": "Deposito 1",
    "Planta Sur": "Deposito 2",
    "Planta Este": "Deposito 3",
    "Terminal Alpha": "Deposito 4",
    "Terminal Beta": "Deposito 5",
    "Terminal Gamma": "Deposito 6",
}

# Mapeo inverso para rollback
NOMBRE_MAPPING_REVERSE = {v: k for k, v in NOMBRE_MAPPING.items()}


def _update_csv_field(value, mapping):
    """Actualiza un campo CSV con el mapeo de centros."""
    if not value:
        return value
    parts = [p.strip() for p in value.split(",")]
    mapped = [mapping.get(p, p) for p in parts]
    return ",".join(mapped)


def run_migration_sqlite(db_path):
    """Ejecuta la migracion en SQLite."""
    if not os.path.exists(db_path):
        logger.warning(f"Base de datos no encontrada: {db_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Actualizar catalog_centros
        logger.info("Actualizando catalog_centros...")
        for old_code, new_code in CENTRO_MAPPING.items():
            new_name = None
            for old_name, mapped_name in NOMBRE_MAPPING.items():
                if old_code == "1001" and old_name == "Planta Norte":
                    new_name = mapped_name
                elif old_code == "1002" and old_name == "Planta Sur":
                    new_name = mapped_name
                elif old_code == "1003" and old_name == "Planta Este":
                    new_name = mapped_name
                elif old_code == "1004" and old_name == "Terminal Alpha":
                    new_name = mapped_name
                elif old_code == "1005" and old_name == "Terminal Beta":
                    new_name = mapped_name
                elif old_code == "1006" and old_name == "Terminal Gamma":
                    new_name = mapped_name

            if new_name:
                cursor.execute(
                    "UPDATE catalog_centros SET codigo = ?, nombre = ? WHERE codigo = ?",
                    (new_code, new_name, old_code),
                )

        # 2. Actualizar usuarios (campo centros es CSV)
        logger.info("Actualizando usuarios.centros...")
        cursor.execute("SELECT id_spm, centros FROM usuarios WHERE centros IS NOT NULL")
        for row in cursor.fetchall():
            user_id, centros = row
            new_centros = _update_csv_field(centros, CENTRO_MAPPING)
            if new_centros != centros:
                cursor.execute(
                    "UPDATE usuarios SET centros = ? WHERE id_spm = ?",
                    (new_centros, user_id),
                )

        # 3. Actualizar solicitudes
        logger.info("Actualizando solicitudes.centro...")
        for old_code, new_code in CENTRO_MAPPING.items():
            cursor.execute(
                "UPDATE solicitudes SET centro = ? WHERE centro = ?",
                (new_code, old_code),
            )

        # 4. Actualizar presupuestos
        logger.info("Actualizando presupuestos.centro...")
        for old_code, new_code in CENTRO_MAPPING.items():
            cursor.execute(
                "UPDATE presupuestos SET centro = ? WHERE centro = ?",
                (new_code, old_code),
            )

        # 5. Actualizar presupuesto_ledger (si existe)
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='presupuesto_ledger'"
        )
        if cursor.fetchone():
            logger.info("Actualizando presupuesto_ledger.centro...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE presupuesto_ledger SET centro = ? WHERE centro = ?",
                    (new_code, old_code),
                )

        # 6. Actualizar budget_update_requests (si existe)
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='budget_update_requests'"
        )
        if cursor.fetchone():
            logger.info("Actualizando budget_update_requests.centro...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE budget_update_requests SET centro = ? WHERE centro = ?",
                    (new_code, old_code),
                )

        # 7. Actualizar planificador_asignaciones
        logger.info("Actualizando planificador_asignaciones.centro...")
        for old_code, new_code in CENTRO_MAPPING.items():
            cursor.execute(
                "UPDATE planificador_asignaciones SET centro = ? WHERE centro = ?",
                (new_code, old_code),
            )

        # 8. Actualizar proveedores_internos
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='proveedores_internos'"
        )
        if cursor.fetchone():
            logger.info("Actualizando proveedores_internos...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE proveedores_internos SET centro = ? WHERE centro = ?",
                    (new_code, old_code),
                )
            for old_name, new_name in NOMBRE_MAPPING.items():
                cursor.execute(
                    "UPDATE proveedores_internos SET centro_nombre = ? WHERE centro_nombre = ?",
                    (new_name, old_name),
                )

        # 9. Actualizar config_almacenes
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='config_almacenes'"
        )
        if cursor.fetchone():
            logger.info("Actualizando config_almacenes.centro...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE config_almacenes SET centro = ? WHERE centro = ?",
                    (new_code, old_code),
                )

        # 10. Actualizar decision_abastecimiento_fuentes (si existe)
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='decision_abastecimiento_fuentes'"
        )
        if cursor.fetchone():
            logger.info("Actualizando decision_abastecimiento_fuentes.centro_origen...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE decision_abastecimiento_fuentes SET centro_origen = ? WHERE centro_origen = ?",
                    (new_code, old_code),
                )

        conn.commit()
        conn.close()
        logger.info(f"Migracion SQLite completada: {db_path}")
        return True

    except Exception as e:
        logger.error(f"Error en migracion SQLite: {e}")
        return False


def run_migration_postgresql():
    """Ejecuta la migracion en PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url or not database_url.startswith("postgresql://"):
        logger.info("DATABASE_URL no es PostgreSQL. Saltando migracion PostgreSQL.")
        return True

    try:
        import psycopg2

        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # 1. Actualizar catalog_centros
        logger.info("Actualizando catalog_centros...")
        for old_code, new_code in CENTRO_MAPPING.items():
            for old_name, new_name in NOMBRE_MAPPING.items():
                if (
                    (old_code == "1001" and old_name == "Planta Norte")
                    or (old_code == "1002" and old_name == "Planta Sur")
                    or (old_code == "1003" and old_name == "Planta Este")
                    or (old_code == "1004" and old_name == "Terminal Alpha")
                    or (old_code == "1005" and old_name == "Terminal Beta")
                    or (old_code == "1006" and old_name == "Terminal Gamma")
                ):
                    cursor.execute(
                        "UPDATE catalog_centros SET codigo = %s, nombre = %s WHERE codigo = %s",
                        (new_code, new_name, old_code),
                    )
                    break

        # 2. Actualizar usuarios (campo centros es CSV)
        logger.info("Actualizando usuarios.centros...")
        cursor.execute("SELECT id_spm, centros FROM usuarios WHERE centros IS NOT NULL")
        for row in cursor.fetchall():
            user_id, centros = row
            new_centros = _update_csv_field(centros, CENTRO_MAPPING)
            if new_centros != centros:
                cursor.execute(
                    "UPDATE usuarios SET centros = %s WHERE id_spm = %s",
                    (new_centros, user_id),
                )

        # 3-10. Actualizar otras tablas
        tables_with_centro = [
            ("solicitudes", "centro"),
            ("presupuestos", "centro"),
            ("presupuesto_ledger", "centro"),
            ("budget_update_requests", "centro"),
            ("planificador_asignaciones", "centro"),
            ("config_almacenes", "centro"),
            ("decision_abastecimiento_fuentes", "centro_origen"),
        ]

        for table, column in tables_with_centro:
            logger.info(f"Actualizando {table}.{column}...")
            for old_code, new_code in CENTRO_MAPPING.items():
                try:
                    cursor.execute(
                        f"UPDATE {table} SET {column} = %s WHERE {column} = %s",
                        (new_code, old_code),
                    )
                except Exception as e:
                    logger.warning(f"Tabla {table} no existe o error: {e}")

        # proveedores_internos (centro y centro_nombre)
        logger.info("Actualizando proveedores_internos...")
        for old_code, new_code in CENTRO_MAPPING.items():
            try:
                cursor.execute(
                    "UPDATE proveedores_internos SET centro = %s WHERE centro = %s",
                    (new_code, old_code),
                )
            except Exception:
                pass
        for old_name, new_name in NOMBRE_MAPPING.items():
            try:
                cursor.execute(
                    "UPDATE proveedores_internos SET centro_nombre = %s WHERE centro_nombre = %s",
                    (new_name, old_name),
                )
            except Exception:
                pass

        conn.commit()
        conn.close()
        logger.info("Migracion PostgreSQL completada")
        return True

    except ImportError:
        logger.warning("psycopg2 no instalado. Saltando migracion PostgreSQL.")
        return True
    except Exception as e:
        logger.error(f"Error en migracion PostgreSQL: {e}")
        return False


def run_migration():
    """Ejecuta la migracion completa."""
    base_dir = Path(__file__).parent.parent.parent
    data_dir = base_dir / "data"
    spm_db = data_dir / "spm.db"

    success = True

    # Migrar SQLite
    if spm_db.exists():
        success = run_migration_sqlite(str(spm_db)) and success

    # Migrar PostgreSQL
    success = run_migration_postgresql() and success

    if success:
        logger.info("Migracion 021 completada: centros renombrados")
    return success


def rollback_migration():
    """Revierte la migracion (usa mapeo inverso)."""
    global CENTRO_MAPPING, NOMBRE_MAPPING
    # Intercambiar mapeos
    CENTRO_MAPPING, _ = CENTRO_MAPPING_REVERSE, CENTRO_MAPPING
    NOMBRE_MAPPING, _ = NOMBRE_MAPPING_REVERSE, NOMBRE_MAPPING

    return run_migration()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migration()
