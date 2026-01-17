"""
Migracion 021: Renombrar Centros

Esta migracion actualiza los codigos y nombres de centros en todas las tablas.

Mapeo para PRODUCCION (codigos reales):
- 1008 (UP Loma La Lata) -> AA101 (Deposito 1)
- 1050 (UP UTE Rio Neuquen) -> AA102 (Deposito 2)
- 1064 (UP Anelo) -> AA103 (Deposito 3)
- 1500 (MID Loma La Lata) -> AA104 (Deposito 4)
- 1501 (MID Sierra Barrosa) -> AA105 (Deposito 5)
- 1502 (MID El Porton) -> AA106 (Deposito 6)

Mapeo para DESARROLLO (codigos anonimizados):
- 1001-1006 -> AA101-AA106

Fecha: 2026-01-16
"""

import logging
import os
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

# Mapeo de codigos - incluye tanto produccion como desarrollo
CENTRO_MAPPING = {
    # Produccion (codigos reales)
    "1008": "AA101",
    "1050": "AA102",
    "1064": "AA103",
    "1500": "AA104",
    "1501": "AA105",
    "1502": "AA106",
    # Desarrollo (codigos anonimizados)
    "1001": "AA101",
    "1002": "AA102",
    "1003": "AA103",
    "1004": "AA104",
    "1005": "AA105",
    "1006": "AA106",
}

# Mapeo inverso para rollback
CENTRO_MAPPING_REVERSE = {v: k for k, v in CENTRO_MAPPING.items()}

# Mapeo de nombres - incluye todas las variantes
NOMBRE_MAPPING = {
    # Produccion (nombres reales)
    "UP Loma La Lata": "Deposito 1",
    "UP UTE Rio Neuquen": "Deposito 2",
    "UP UTE Río Neuquén": "Deposito 2",
    "UP Anelo": "Deposito 3",
    "UP Añelo": "Deposito 3",
    "MID Loma La Lata": "Deposito 4",
    "MID Sierra Barrosa": "Deposito 5",
    "MID El Porton": "Deposito 6",
    "MID El Portón": "Deposito 6",
    # Desarrollo (nombres anonimizados)
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


# Mapeo directo de codigo antiguo a nuevo nombre
CODIGO_TO_NOMBRE = {
    # Produccion
    "1008": "Deposito 1",
    "1050": "Deposito 2",
    "1064": "Deposito 3",
    "1500": "Deposito 4",
    "1501": "Deposito 5",
    "1502": "Deposito 6",
    # Desarrollo
    "1001": "Deposito 1",
    "1002": "Deposito 2",
    "1003": "Deposito 3",
    "1004": "Deposito 4",
    "1005": "Deposito 5",
    "1006": "Deposito 6",
}


def run_migration_sqlite(db_path):
    """Ejecuta la migracion en SQLite."""
    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Actualizar catalog_centros
        print("Actualizando catalog_centros...")
        for old_code, new_code in CENTRO_MAPPING.items():
            new_name = CODIGO_TO_NOMBRE.get(old_code)
            if new_name:
                cursor.execute(
                    "UPDATE catalog_centros SET codigo = ?, nombre = ? WHERE codigo = ?",
                    (new_code, new_name, old_code),
                )
                print(f"  {old_code} -> {new_code} ({new_name})")

        # 2. Actualizar usuarios (campo centros es CSV)
        print("Actualizando usuarios.centros...")
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
        print("Actualizando solicitudes.centro...")
        for old_code, new_code in CENTRO_MAPPING.items():
            cursor.execute(
                "UPDATE solicitudes SET centro = ? WHERE centro = ?",
                (new_code, old_code),
            )

        # 4. Actualizar presupuestos
        print("Actualizando presupuestos.centro...")
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
            print("Actualizando presupuesto_ledger.centro...")
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
            print("Actualizando budget_update_requests.centro...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE budget_update_requests SET centro = ? WHERE centro = ?",
                    (new_code, old_code),
                )

        # 7. Actualizar planificador_asignaciones
        print("Actualizando planificador_asignaciones.centro...")
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
            print("Actualizando proveedores_internos...")
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
            print("Actualizando config_almacenes.centro...")
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
            print("Actualizando decision_abastecimiento_fuentes.centro_origen...")
            for old_code, new_code in CENTRO_MAPPING.items():
                cursor.execute(
                    "UPDATE decision_abastecimiento_fuentes SET centro_origen = ? WHERE centro_origen = ?",
                    (new_code, old_code),
                )

        conn.commit()
        conn.close()
        print(f"Migracion SQLite completada: {db_path}")
        return True

    except Exception as e:
        print(f"Error en migracion SQLite: {e}")
        return False


def run_migration_postgresql():
    """Ejecuta la migracion en PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url or not database_url.startswith("postgresql://"):
        print("DATABASE_URL no es PostgreSQL. Saltando migracion PostgreSQL.")
        return True

    try:
        import psycopg2

        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # 1. Actualizar catalog_centros
        print("Actualizando catalog_centros...")
        for old_code, new_code in CENTRO_MAPPING.items():
            new_name = CODIGO_TO_NOMBRE.get(old_code)
            if new_name:
                cursor.execute(
                    "UPDATE catalog_centros SET codigo = %s, nombre = %s WHERE codigo = %s",
                    (new_code, new_name, old_code),
                )
                print(f"  {old_code} -> {new_code} ({new_name})")

        # 2. Actualizar usuarios (campo centros es CSV)
        print("Actualizando usuarios.centros...")
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
            print(f"Actualizando {table}.{column}...")
            for old_code, new_code in CENTRO_MAPPING.items():
                try:
                    cursor.execute(
                        f"UPDATE {table} SET {column} = %s WHERE {column} = %s",
                        (new_code, old_code),
                    )
                except Exception as e:
                    print(f"Tabla {table} no existe o error: {e}")

        # proveedores_internos (centro y centro_nombre)
        print("Actualizando proveedores_internos...")
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
        print("Migracion PostgreSQL completada")
        return True

    except ImportError:
        print("psycopg2 no instalado. Saltando migracion PostgreSQL.")
        return True
    except Exception as e:
        print(f"Error en migracion PostgreSQL: {e}")
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
        print("Migracion 021 completada: centros renombrados")
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
