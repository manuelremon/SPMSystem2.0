#!/usr/bin/env python3
"""
Script 011: Correccion de consistencia de codigos de almacen
============================================================

La migracion inicial (010_rename_almacenes.py) solo actualizo:
- catalog_almacenes.codigo en spm.db
- stock.almacen en sap_data.db

Este script completa la migracion actualizando las tablas restantes:

En sap_data.db:
- consumo_historico.almacen (~20,424 registros)
- materiales_bbdd.almacen (~7,309 registros)
- pedidos_sap.almacen (~602 registros)

En spm.db:
- usuarios.almacenes (campo JSON/CSV con codigos de almacen)

Regla de transformacion:
- 0XXX -> AAXXX (ej: 0001 -> AA001)
- 9XXX -> IIXXX (ej: 9003 -> II003)
- Otros codigos se mantienen sin cambios

Uso:
    python scripts/migrations/011_fix_almacenes_consistency.py

IMPORTANTE: Se creara un backup automatico antes de la migracion.
"""

import json
import re
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


# Configuracion de rutas
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
BACKUP_DIR = PROJECT_ROOT / "backup" / "pre_migration_almacenes_consistency"

SPM_DB = DATA_DIR / "spm.db"
SAP_DATA_DB = DATA_DIR / "sap_data.db"


def transform_almacen_code(codigo: str) -> str:
    """
    Transforma codigo de almacen segun regla.

    Args:
        codigo: Codigo original del almacen

    Returns:
        Codigo transformado

    Ejemplos:
        0001 -> AA001
        0012 -> AA012
        9002 -> II002
        9003 -> II003
        7777 -> 7777 (sin cambio)
        AA001 -> AA001 (ya migrado, sin cambio)
    """
    codigo_str = str(codigo).strip()

    # Si ya tiene formato nuevo, no cambiar
    if codigo_str.startswith("AA") or codigo_str.startswith("II"):
        return codigo_str

    # Verificar patron 0XXX (exactamente 4 digitos empezando con 0)
    if re.match(r"^0\d{3}$", codigo_str):
        return "AA" + codigo_str[1:]

    # Verificar patron 9XXX (exactamente 4 digitos empezando con 9)
    if re.match(r"^9\d{3}$", codigo_str):
        return "II" + codigo_str[1:]

    # Sin cambio para otros formatos
    return codigo_str


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


def backup_databases() -> Path | None:
    """
    Crea backups de las bases de datos afectadas.

    Returns:
        Path al directorio de backup o None si fallo
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_subdir = BACKUP_DIR / timestamp

    print("=" * 60)
    print("BACKUP DE BASES DE DATOS")
    print("=" * 60)

    backup_subdir.mkdir(parents=True, exist_ok=True)

    databases = [SPM_DB, SAP_DATA_DB]

    for db_path in databases:
        if not db_path.exists():
            print(f"  Advertencia: {db_path.name} no existe")
            continue

        print(f"  Copiando {db_path.name}...")

        if not verify_database_integrity(db_path):
            print(f"  Error: Integridad fallida para {db_path.name}")
            return None

        try:
            backup_path = backup_subdir / db_path.name
            shutil.copy2(db_path, backup_path)
            size_mb = db_path.stat().st_size / (1024 * 1024)
            print(f"    Backup creado: {backup_path.name} ({size_mb:.2f} MB)")
        except Exception as e:
            print(f"  Error copiando {db_path.name}: {e}")
            return None

    # Guardar referencia al ultimo backup
    latest_ref = BACKUP_DIR / "latest"
    with open(latest_ref, "w", encoding="utf-8") as f:
        f.write(str(backup_subdir))

    print(f"  Backup guardado en: {backup_subdir}")
    return backup_subdir


def count_legacy_codes(db_path: Path, table: str, column: str) -> int:
    """
    Cuenta registros con codigos legacy (0XXX o 9XXX) en una tabla.

    Args:
        db_path: Ruta a la base de datos
        table: Nombre de la tabla
        column: Nombre de la columna

    Returns:
        Numero de registros con codigos legacy
    """
    if not db_path.exists():
        return 0

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Verificar que existe la tabla
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,)
    )
    if not cursor.fetchone():
        conn.close()
        return 0

    cursor.execute(f"""
        SELECT COUNT(*) FROM {table}
        WHERE {column} GLOB '0[0-9][0-9][0-9]'
           OR {column} GLOB '9[0-9][0-9][0-9]'
    """)
    count = cursor.fetchone()[0]
    conn.close()
    return count


def update_sap_table(table: str, column: str = "almacen") -> int:
    """
    Actualiza una tabla en sap_data.db transformando codigos de almacen.

    Args:
        table: Nombre de la tabla
        column: Nombre de la columna (default: almacen)

    Returns:
        Numero de registros actualizados
    """
    if not SAP_DATA_DB.exists():
        print(f"  Error: {SAP_DATA_DB.name} no existe")
        return 0

    conn = sqlite3.connect(SAP_DATA_DB)
    cursor = conn.cursor()

    # Verificar que existe la tabla
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,)
    )
    if not cursor.fetchone():
        conn.close()
        print(f"  Tabla {table} no existe")
        return 0

    total_updated = 0

    # Actualizar 0XXX -> AAXXX
    cursor.execute(f"""
        UPDATE {table}
        SET {column} = 'AA' || substr({column}, 2)
        WHERE {column} GLOB '0[0-9][0-9][0-9]'
    """)
    updated_0xxx = cursor.rowcount
    total_updated += updated_0xxx

    # Actualizar 9XXX -> IIXXX
    cursor.execute(f"""
        UPDATE {table}
        SET {column} = 'II' || substr({column}, 2)
        WHERE {column} GLOB '9[0-9][0-9][0-9]'
    """)
    updated_9xxx = cursor.rowcount
    total_updated += updated_9xxx

    conn.commit()
    conn.close()

    print(f"    0XXX -> AAXXX: {updated_0xxx:,} registros")
    print(f"    9XXX -> IIXXX: {updated_9xxx:,} registros")

    return total_updated


def update_usuarios_almacenes() -> int:
    """
    Actualiza el campo 'almacenes' en la tabla usuarios de spm.db.

    El campo puede contener:
    - JSON array: '["0001", "0012"]'
    - CSV string: '0001,0012'
    - Valor simple: '0001'
    - NULL o vacio

    Returns:
        Numero de registros actualizados
    """
    if not SPM_DB.exists():
        print("  Error: spm.db no existe")
        return 0

    conn = sqlite3.connect(SPM_DB)
    cursor = conn.cursor()

    # Verificar que existe la tabla
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
    )
    if not cursor.fetchone():
        conn.close()
        print("  Tabla usuarios no existe")
        return 0

    # Verificar que existe la columna almacenes
    cursor.execute("PRAGMA table_info(usuarios)")
    columns = [row[1] for row in cursor.fetchall()]
    if "almacenes" not in columns:
        conn.close()
        print("  Columna 'almacenes' no existe en usuarios")
        return 0

    # Obtener todos los registros con almacenes
    # Nota: La columna PK es id_spm, no id
    cursor.execute("""
        SELECT id_spm, almacenes FROM usuarios
        WHERE almacenes IS NOT NULL AND almacenes != ''
    """)
    rows = cursor.fetchall()

    updated = 0
    for user_id, almacenes_raw in rows:
        if not almacenes_raw:
            continue

        almacenes_raw = almacenes_raw.strip()
        new_value = None
        changed = False

        # Intentar parsear como JSON array
        if almacenes_raw.startswith("["):
            try:
                almacenes_list = json.loads(almacenes_raw)
                new_list = []
                for codigo in almacenes_list:
                    new_codigo = transform_almacen_code(str(codigo))
                    if new_codigo != str(codigo):
                        changed = True
                    new_list.append(new_codigo)
                if changed:
                    new_value = json.dumps(new_list)
            except json.JSONDecodeError:
                pass

        # Intentar parsear como CSV
        elif "," in almacenes_raw:
            almacenes_list = [x.strip() for x in almacenes_raw.split(",")]
            new_list = []
            for codigo in almacenes_list:
                new_codigo = transform_almacen_code(codigo)
                if new_codigo != codigo:
                    changed = True
                new_list.append(new_codigo)
            if changed:
                new_value = ",".join(new_list)

        # Valor simple
        else:
            new_codigo = transform_almacen_code(almacenes_raw)
            if new_codigo != almacenes_raw:
                new_value = new_codigo
                changed = True

        # Actualizar si cambio
        if changed and new_value:
            cursor.execute(
                "UPDATE usuarios SET almacenes = ? WHERE id_spm = ?",
                (new_value, user_id)
            )
            updated += 1
            print(f"    Usuario {user_id}: {almacenes_raw} -> {new_value}")

    conn.commit()
    conn.close()
    return updated


def validate_consistency() -> dict:
    """
    Valida que no queden codigos legacy en ninguna tabla.

    Returns:
        Diccionario con resultados de validacion
    """
    results = {}

    # Tablas en sap_data.db
    sap_tables = ["consumo_historico", "materiales_bbdd", "pedidos_sap", "stock"]
    for table in sap_tables:
        count = count_legacy_codes(SAP_DATA_DB, table, "almacen")
        results[f"sap_data.{table}"] = count

    # Tabla usuarios en spm.db (validacion especial)
    if SPM_DB.exists():
        conn = sqlite3.connect(SPM_DB)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
        )
        if cursor.fetchone():
            cursor.execute("""
                SELECT COUNT(*) FROM usuarios
                WHERE almacenes LIKE '%0___"%'
                   OR almacenes LIKE '%9___"%'
                   OR almacenes GLOB '*0[0-9][0-9][0-9]*'
                   OR almacenes GLOB '*9[0-9][0-9][0-9]*'
            """)
            # Busqueda mas precisa
            cursor.execute("""
                SELECT almacenes FROM usuarios
                WHERE almacenes IS NOT NULL AND almacenes != ''
            """)
            legacy_count = 0
            for (almacenes_raw,) in cursor.fetchall():
                if not almacenes_raw:
                    continue
                # Buscar patrones 0XXX o 9XXX
                if re.search(r"(?<![A-Z])0\d{3}(?!\d)", almacenes_raw) or \
                   re.search(r"(?<![A-Z])9\d{3}(?!\d)", almacenes_raw):
                    legacy_count += 1

            results["spm.usuarios"] = legacy_count
        conn.close()

    return results


def print_pre_migration_status():
    """Imprime el estado antes de la migracion."""
    print("\n" + "=" * 60)
    print("ESTADO ANTES DE MIGRACION")
    print("=" * 60)

    # Contar registros legacy en cada tabla
    tables_info = [
        (SAP_DATA_DB, "consumo_historico", "almacen"),
        (SAP_DATA_DB, "materiales_bbdd", "almacen"),
        (SAP_DATA_DB, "pedidos_sap", "almacen"),
    ]

    for db_path, table, column in tables_info:
        count = count_legacy_codes(db_path, table, column)
        print(f"  {table}.{column}: {count:,} registros con codigos legacy")

    # Usuarios (validacion especial)
    if SPM_DB.exists():
        conn = sqlite3.connect(SPM_DB)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'"
        )
        if cursor.fetchone():
            cursor.execute("""
                SELECT id_spm, almacenes FROM usuarios
                WHERE almacenes IS NOT NULL AND almacenes != ''
            """)
            legacy_users = []
            for user_id, almacenes_raw in cursor.fetchall():
                if almacenes_raw and (
                    re.search(r"(?<![A-Z])0\d{3}(?!\d)", almacenes_raw) or
                    re.search(r"(?<![A-Z])9\d{3}(?!\d)", almacenes_raw)
                ):
                    legacy_users.append((user_id, almacenes_raw))

            print(f"  usuarios.almacenes: {len(legacy_users)} usuarios con codigos legacy")
            if legacy_users:
                for user_id, almacenes in legacy_users[:5]:  # Mostrar primeros 5
                    print(f"    Usuario {user_id}: {almacenes}")
                if len(legacy_users) > 5:
                    print(f"    ... y {len(legacy_users) - 5} mas")

        conn.close()


def main():
    """Funcion principal de migracion."""
    print("=" * 60)
    print("CORRECCION DE CONSISTENCIA - CODIGOS DE ALMACEN")
    print("=" * 60)
    print(f"\nFecha: {datetime.now().isoformat()}")

    # Verificar que existen las bases de datos
    if not SPM_DB.exists() and not SAP_DATA_DB.exists():
        print("Error: No se encontraron las bases de datos")
        return False

    # Mostrar estado actual
    print_pre_migration_status()

    # Paso 1: Backup
    print("\n" + "=" * 60)
    print("PASO 1: BACKUP")
    print("=" * 60)
    backup_path = backup_databases()
    if not backup_path:
        print("Error: Fallo el backup")
        return False

    # Paso 2: Actualizar tablas en sap_data.db
    print("\n" + "=" * 60)
    print("PASO 2: ACTUALIZAR TABLAS EN sap_data.db")
    print("=" * 60)

    total_sap_updated = 0

    print("\n  Actualizando consumo_historico...")
    updated = update_sap_table("consumo_historico", "almacen")
    total_sap_updated += updated
    print(f"    Total: {updated:,} registros")

    print("\n  Actualizando materiales_bbdd...")
    updated = update_sap_table("materiales_bbdd", "almacen")
    total_sap_updated += updated
    print(f"    Total: {updated:,} registros")

    print("\n  Actualizando pedidos_sap...")
    updated = update_sap_table("pedidos_sap", "almacen")
    total_sap_updated += updated
    print(f"    Total: {updated:,} registros")

    # Paso 3: Actualizar usuarios en spm.db
    print("\n" + "=" * 60)
    print("PASO 3: ACTUALIZAR USUARIOS EN spm.db")
    print("=" * 60)

    print("\n  Actualizando usuarios.almacenes...")
    updated_usuarios = update_usuarios_almacenes()
    print(f"    Total: {updated_usuarios} usuarios")

    # Paso 4: Validar consistencia
    print("\n" + "=" * 60)
    print("PASO 4: VALIDACION DE CONSISTENCIA")
    print("=" * 60)

    validation = validate_consistency()
    all_clean = True

    print("\n  Verificando que no hay codigos legacy:")
    for table, count in validation.items():
        status = "OK" if count == 0 else "PENDIENTE"
        if count > 0:
            all_clean = False
        print(f"    {table}: {count:,} registros legacy ({status})")

    # Resumen final
    print("\n" + "=" * 60)
    if all_clean:
        print("MIGRACION COMPLETADA EXITOSAMENTE")
    else:
        print("MIGRACION COMPLETADA CON ADVERTENCIAS")
        print("\nAlgunos registros aun tienen codigos legacy.")
        print("Revisar manualmente las tablas indicadas.")
    print("=" * 60)

    print("\nResumen:")
    print(f"  Registros actualizados en sap_data.db: {total_sap_updated:,}")
    print(f"  Usuarios actualizados en spm.db: {updated_usuarios}")
    print(f"  Backup en: {backup_path}")

    return all_clean


if __name__ == "__main__":
    import sys

    print("\n" + "=" * 60)
    print("CORRECCION DE CONSISTENCIA - CODIGOS DE ALMACEN")
    print("=" * 60)
    print("\nEste script completara la migracion de codigos de almacen")
    print("en las tablas que no fueron actualizadas por 010_rename_almacenes.py")
    print("\nTablas a actualizar:")
    print("  - sap_data.db: consumo_historico.almacen")
    print("  - sap_data.db: materiales_bbdd.almacen")
    print("  - sap_data.db: pedidos_sap.almacen")
    print("  - spm.db: usuarios.almacenes")
    print("\nTransformacion:")
    print("  - 0XXX -> AAXXX (ej: 0001 -> AA001)")
    print("  - 9XXX -> IIXXX (ej: 9003 -> II003)")
    print()

    # Permitir --yes para saltar confirmacion
    if "--yes" not in sys.argv and "-y" not in sys.argv:
        response = input("Desea continuar? (s/N): ").strip().lower()
        if response != "s":
            print("Migracion cancelada.")
            sys.exit(0)
    else:
        print("Ejecutando con --yes (sin confirmacion)")

    print()
    success = main()
    sys.exit(0 if success else 1)
