#!/usr/bin/env python3
"""
Script 010: Renombrado de codigos de almacen
=============================================

Este script migra los codigos de almacen de formato numerico a formato
con prefijo alfabetico segun la siguiente regla:

- 0XXX -> AAXXX (ej: 0001 -> AA001)
- 9XXX -> IIXXX (ej: 9003 -> II003)
- Otros codigos se mantienen sin cambios (ej: 7777)

Tablas afectadas:
- spm.db: catalog_almacenes.codigo (PK)
- sap_data.db: stock.almacen

Uso:
    python scripts/migrations/010_rename_almacenes.py

IMPORTANTE: Se creara un backup automatico antes de la migracion.
"""

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


# Configuracion de rutas
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
BACKUP_DIR = PROJECT_ROOT / "backup" / "pre_migration_almacenes"

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
    """
    codigo_str = str(codigo).strip()

    if codigo_str.startswith("0"):
        # 0XXX -> AAXXX
        return "AA" + codigo_str[1:]
    elif codigo_str.startswith("9"):
        # 9XXX -> IIXXX
        return "II" + codigo_str[1:]
    else:
        # Sin cambio
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


def get_unique_almacenes_spm() -> list[tuple[str, str]]:
    """
    Obtiene los almacenes unicos de catalog_almacenes en spm.db.

    Returns:
        Lista de tuplas (codigo, nombre)
    """
    conn = sqlite3.connect(SPM_DB)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='catalog_almacenes'
    """)
    if not cursor.fetchone():
        conn.close()
        return []

    cursor.execute("SELECT codigo, nombre FROM catalog_almacenes ORDER BY codigo")
    results = cursor.fetchall()
    conn.close()
    return results


def get_unique_almacenes_sap() -> list[tuple[str, int]]:
    """
    Obtiene los almacenes unicos de la tabla stock en sap_data.db.

    Returns:
        Lista de tuplas (almacen, conteo)
    """
    conn = sqlite3.connect(SAP_DATA_DB)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='stock'
    """)
    if not cursor.fetchone():
        conn.close()
        return []

    cursor.execute("""
        SELECT almacen, COUNT(*) as cnt
        FROM stock
        GROUP BY almacen
        ORDER BY almacen
    """)
    results = cursor.fetchall()
    conn.close()
    return results


def generate_mapping() -> dict[str, str]:
    """
    Genera el mapeo completo de codigos antiguos a nuevos.

    Returns:
        Diccionario {codigo_antiguo: codigo_nuevo}
    """
    mapping = {}

    # Obtener almacenes de catalog_almacenes
    almacenes_spm = get_unique_almacenes_spm()
    for codigo, _ in almacenes_spm:
        if codigo not in mapping:
            mapping[codigo] = transform_almacen_code(codigo)

    # Obtener almacenes de stock
    almacenes_sap = get_unique_almacenes_sap()
    for almacen, _ in almacenes_sap:
        if almacen not in mapping:
            mapping[almacen] = transform_almacen_code(almacen)

    return mapping


def update_catalog_almacenes(mapping: dict[str, str]) -> int:
    """
    Actualiza la tabla catalog_almacenes en spm.db.

    Args:
        mapping: Diccionario de mapeo {antiguo: nuevo}

    Returns:
        Numero de registros actualizados
    """
    conn = sqlite3.connect(SPM_DB)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    # Verificar que existe la tabla
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='catalog_almacenes'
    """)
    if not cursor.fetchone():
        conn.close()
        print("  Tabla catalog_almacenes no existe")
        return 0

    # Obtener codigos actuales
    cursor.execute("SELECT codigo FROM catalog_almacenes")
    codigos_actuales = [row[0] for row in cursor.fetchall()]

    updated = 0
    for codigo_antiguo in codigos_actuales:
        codigo_nuevo = mapping.get(codigo_antiguo)
        if codigo_nuevo and codigo_nuevo != codigo_antiguo:
            cursor.execute(
                "UPDATE catalog_almacenes SET codigo = ? WHERE codigo = ?",
                (codigo_nuevo, codigo_antiguo)
            )
            updated += cursor.rowcount

    conn.commit()
    conn.close()
    return updated


def update_stock_almacen(mapping: dict[str, str]) -> int:
    """
    Actualiza la columna almacen en la tabla stock de sap_data.db.

    Args:
        mapping: Diccionario de mapeo {antiguo: nuevo}

    Returns:
        Numero de registros actualizados
    """
    conn = sqlite3.connect(SAP_DATA_DB)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    # Verificar que existe la tabla
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='stock'
    """)
    if not cursor.fetchone():
        conn.close()
        print("  Tabla stock no existe")
        return 0

    # Crear tabla temporal de mapeo para UPDATE eficiente con JOIN
    cursor.execute("DROP TABLE IF EXISTS temp_almacen_mapping")
    cursor.execute("""
        CREATE TEMP TABLE temp_almacen_mapping (
            codigo_antiguo TEXT PRIMARY KEY,
            codigo_nuevo TEXT NOT NULL
        )
    """)

    # Insertar solo mapeos que cambian
    mapeo_efectivo = [(k, v) for k, v in mapping.items() if k != v]
    cursor.executemany(
        "INSERT INTO temp_almacen_mapping VALUES (?, ?)",
        mapeo_efectivo
    )

    # Actualizar stock usando JOIN con tabla temporal
    cursor.execute("""
        UPDATE stock
        SET almacen = (
            SELECT codigo_nuevo FROM temp_almacen_mapping
            WHERE codigo_antiguo = stock.almacen
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_almacen_mapping
            WHERE codigo_antiguo = stock.almacen
        )
    """)
    updated = cursor.rowcount

    conn.commit()
    conn.close()
    return updated


def validate_migration(mapping: dict[str, str]) -> bool:
    """
    Valida que la migracion se realizo correctamente.

    Args:
        mapping: Diccionario de mapeo usado

    Returns:
        True si la validacion es exitosa
    """
    print("\n" + "=" * 60)
    print("VALIDACION")
    print("=" * 60)

    errors = []

    # Validar catalog_almacenes
    if SPM_DB.exists():
        conn = sqlite3.connect(SPM_DB)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='catalog_almacenes'
        """)
        if cursor.fetchone():
            # Verificar que no hay codigos con formato antiguo
            cursor.execute("""
                SELECT codigo FROM catalog_almacenes
                WHERE codigo LIKE '0%' OR codigo LIKE '9%'
            """)
            old_format = cursor.fetchall()
            if old_format:
                # Verificar que son los que no cambian (como 7777)
                for (codigo,) in old_format:
                    if codigo.startswith("0") or codigo.startswith("9"):
                        errors.append(f"catalog_almacenes: codigo {codigo} aun tiene formato antiguo")

            # Verificar formato correcto
            cursor.execute("""
                SELECT codigo FROM catalog_almacenes
                WHERE codigo LIKE 'AA%' OR codigo LIKE 'II%'
            """)
            new_format = cursor.fetchall()
            print(f"  catalog_almacenes: {len(new_format)} registros con nuevo formato")

        conn.close()

    # Validar stock
    if SAP_DATA_DB.exists():
        conn = sqlite3.connect(SAP_DATA_DB)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='stock'
        """)
        if cursor.fetchone():
            # Contar registros totales
            cursor.execute("SELECT COUNT(*) FROM stock")
            total = cursor.fetchone()[0]

            # Contar con nuevo formato
            cursor.execute("""
                SELECT COUNT(*) FROM stock
                WHERE almacen LIKE 'AA%' OR almacen LIKE 'II%'
            """)
            new_format_count = cursor.fetchone()[0]

            # Contar con formato que deberia haber cambiado
            cursor.execute("""
                SELECT COUNT(*) FROM stock
                WHERE almacen LIKE '0%' OR almacen LIKE '9%'
            """)
            old_format_count = cursor.fetchone()[0]

            if old_format_count > 0:
                errors.append(f"stock: {old_format_count} registros aun con formato 0XXX/9XXX")

            print(f"  stock: {total:,} registros totales")
            print(f"  stock: {new_format_count:,} con formato AA/II")

            # Mostrar distribucion por almacen
            cursor.execute("""
                SELECT almacen, COUNT(*) as cnt
                FROM stock
                GROUP BY almacen
                ORDER BY cnt DESC
                LIMIT 15
            """)
            print("\n  Distribucion de almacenes:")
            for almacen, cnt in cursor.fetchall():
                print(f"    {almacen}: {cnt:,} registros")

        conn.close()

    if errors:
        print("\n  ERRORES ENCONTRADOS:")
        for err in errors:
            print(f"    - {err}")
        return False

    print("\n  Validacion exitosa")
    return True


def main():
    """Funcion principal de migracion."""
    print("=" * 60)
    print("MIGRACION DE CODIGOS DE ALMACEN")
    print("=" * 60)
    print(f"\nFecha: {datetime.now().isoformat()}")
    print()

    # Verificar que existen las bases de datos
    if not SPM_DB.exists() and not SAP_DATA_DB.exists():
        print("Error: No se encontraron las bases de datos")
        return False

    # Paso 1: Backup
    print("\nPaso 1: Creando backup...")
    backup_path = backup_databases()
    if not backup_path:
        print("Error: Fallo el backup")
        return False

    # Paso 2: Generar mapeo
    print("\n" + "=" * 60)
    print("GENERACION DE MAPEO")
    print("=" * 60)

    mapping = generate_mapping()

    # Mostrar mapeo
    print("\nMapeo de transformacion:")
    print("-" * 40)
    changes = [(k, v) for k, v in sorted(mapping.items()) if k != v]
    no_changes = [(k, v) for k, v in sorted(mapping.items()) if k == v]

    for old, new in changes:
        print(f"  {old} -> {new}")

    if no_changes:
        print(f"\n  {len(no_changes)} codigo(s) sin cambio: {', '.join([k for k, _ in no_changes])}")

    print(f"\nTotal de mapeos: {len(mapping)}")
    print(f"  Con cambio: {len(changes)}")
    print(f"  Sin cambio: {len(no_changes)}")

    # Paso 3: Actualizar catalog_almacenes
    print("\n" + "=" * 60)
    print("ACTUALIZACION DE TABLAS")
    print("=" * 60)

    print("\nActualizando catalog_almacenes en spm.db...")
    updated_catalog = update_catalog_almacenes(mapping)
    print(f"  Registros actualizados: {updated_catalog}")

    # Paso 4: Actualizar stock
    print("\nActualizando stock.almacen en sap_data.db...")
    updated_stock = update_stock_almacen(mapping)
    print(f"  Registros actualizados: {updated_stock:,}")

    # Paso 5: Validar
    success = validate_migration(mapping)

    print("\n" + "=" * 60)
    if success:
        print("MIGRACION COMPLETADA EXITOSAMENTE")
    else:
        print("MIGRACION COMPLETADA CON ADVERTENCIAS")
        print(f"\nPara restaurar desde backup: {backup_path}")
    print("=" * 60)

    # Resumen final
    print("\nResumen:")
    print(f"  catalog_almacenes actualizados: {updated_catalog}")
    print(f"  stock.almacen actualizados: {updated_stock:,}")
    print(f"  Backup en: {backup_path}")

    return success


if __name__ == "__main__":
    import sys

    print("\n" + "=" * 60)
    print("MIGRACION DE CODIGOS DE ALMACEN")
    print("=" * 60)
    print("\nEste script transformara los codigos de almacen:")
    print("  - 0XXX -> AAXXX (ej: 0001 -> AA001)")
    print("  - 9XXX -> IIXXX (ej: 9003 -> II003)")
    print("\nTablas afectadas:")
    print("  - spm.db: catalog_almacenes.codigo")
    print("  - sap_data.db: stock.almacen")
    print()

    response = input("Desea continuar? (s/N): ").strip().lower()
    if response != "s":
        print("Migracion cancelada.")
        sys.exit(0)

    print()
    success = main()
    sys.exit(0 if success else 1)
