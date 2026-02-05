#!/usr/bin/env python3
"""
Script 003: Migración de códigos de material SAP
================================================

Este script ejecuta la migración principal de códigos de material
en todas las bases de datos afectadas.

IMPORTANTE: Ejecutar 001_backup_databases.py y 002_create_mapping_table.py
antes de este script.

Uso:
    python scripts/migrations/003_migrate_material_codes.py
"""

import sqlite3
from datetime import datetime
from pathlib import Path


# Configuración de rutas
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"

CATALOGO_DB = DATA_DIR / "catalogo_materiales.db"
SAP_DATA_DB = DATA_DIR / "sap_data.db"
EQUIVALENTES_DB = DATA_DIR / "equivalentes.db"
SPM_DB = DATA_DIR / "spm.db"


def load_mapping(conn: sqlite3.Connection) -> dict:
    """Carga el mapeo de códigos como diccionario."""
    cursor = conn.cursor()
    cursor.execute("SELECT codigo_antiguo, codigo_nuevo FROM codigo_mapping")
    return {row[0]: row[1] for row in cursor.fetchall()}


def update_sap_data_tables(mapping: dict, catalogo_conn: sqlite3.Connection) -> dict:
    """
    Actualiza las tablas en sap_data.db.

    Tablas afectadas:
    - stock.material
    - materiales_bbdd.codigo_material
    - consumo_historico.material
    - pedidos_sap.material
    """
    results = {}

    conn = sqlite3.connect(SAP_DATA_DB)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    # Crear tabla de mapeo temporal para JOINs eficientes
    cursor.execute("DROP TABLE IF EXISTS temp_mapping")
    cursor.execute("""
        CREATE TEMP TABLE temp_mapping (
            codigo_antiguo TEXT PRIMARY KEY,
            codigo_nuevo TEXT NOT NULL
        )
    """)

    # Insertar mapeo
    cursor.executemany(
        "INSERT INTO temp_mapping VALUES (?, ?)",
        mapping.items()
    )

    # 1. Actualizar stock
    print("  Actualizando stock...")
    cursor.execute("""
        UPDATE stock
        SET material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = stock.material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = stock.material
        )
    """)
    results["stock"] = cursor.rowcount

    # 2. Actualizar materiales_bbdd
    print("  Actualizando materiales_bbdd...")
    cursor.execute("""
        UPDATE materiales_bbdd
        SET codigo_material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = materiales_bbdd.codigo_material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = materiales_bbdd.codigo_material
        )
    """)
    results["materiales_bbdd"] = cursor.rowcount

    # 3. Actualizar consumo_historico
    print("  Actualizando consumo_historico...")
    cursor.execute("""
        UPDATE consumo_historico
        SET material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = consumo_historico.material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = consumo_historico.material
        )
    """)
    results["consumo_historico"] = cursor.rowcount

    # 4. Actualizar pedidos_sap
    print("  Actualizando pedidos_sap...")
    cursor.execute("""
        UPDATE pedidos_sap
        SET material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = pedidos_sap.material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = pedidos_sap.material
        )
    """)
    results["pedidos_sap"] = cursor.rowcount

    conn.commit()
    conn.close()

    return results


def update_equivalencias(mapping: dict) -> dict:
    """
    Actualiza la tabla de equivalencias.

    Columnas afectadas:
    - material_base
    - material_equivalente
    """
    results = {}

    conn = sqlite3.connect(EQUIVALENTES_DB)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    # Crear mapeo temporal
    cursor.execute("DROP TABLE IF EXISTS temp_mapping")
    cursor.execute("""
        CREATE TEMP TABLE temp_mapping (
            codigo_antiguo TEXT PRIMARY KEY,
            codigo_nuevo TEXT NOT NULL
        )
    """)

    # Los códigos en equivalencias son INTEGER, convertir a TEXT para el mapeo
    # Primero, crear mapeo con códigos como texto
    text_mapping = [(str(k), v) for k, v in mapping.items()]
    cursor.executemany(
        "INSERT INTO temp_mapping VALUES (?, ?)",
        text_mapping
    )

    # Actualizar material_base
    print("  Actualizando equivalencias.material_base...")
    cursor.execute("""
        UPDATE equivalencias
        SET material_base = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = CAST(equivalencias.material_base AS TEXT)
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping
            WHERE codigo_antiguo = CAST(equivalencias.material_base AS TEXT)
        )
    """)
    results["material_base"] = cursor.rowcount

    # Actualizar material_equivalente
    print("  Actualizando equivalencias.material_equivalente...")
    cursor.execute("""
        UPDATE equivalencias
        SET material_equivalente = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = CAST(equivalencias.material_equivalente AS TEXT)
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping
            WHERE codigo_antiguo = CAST(equivalencias.material_equivalente AS TEXT)
        )
    """)
    results["material_equivalente"] = cursor.rowcount

    conn.commit()
    conn.close()

    return results


def update_spm_tables(mapping: dict) -> dict:
    """
    Actualiza las tablas en spm.db que referencian códigos de material.

    Tablas afectadas:
    - traslados.material
    - solpeds.material
    - proveedor_precios_negociados.codigo_material
    - decision_abastecimiento_fuentes.codigo_material_equiv
    """
    results = {}

    conn = sqlite3.connect(SPM_DB)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    # Crear mapeo temporal
    cursor.execute("DROP TABLE IF EXISTS temp_mapping")
    cursor.execute("""
        CREATE TEMP TABLE temp_mapping (
            codigo_antiguo TEXT PRIMARY KEY,
            codigo_nuevo TEXT NOT NULL
        )
    """)
    cursor.executemany(
        "INSERT INTO temp_mapping VALUES (?, ?)",
        mapping.items()
    )

    # 1. traslados
    print("  Actualizando traslados...")
    cursor.execute("""
        UPDATE traslados
        SET material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = traslados.material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = traslados.material
        )
    """)
    results["traslados"] = cursor.rowcount

    # 2. solpeds
    print("  Actualizando solpeds...")
    cursor.execute("""
        UPDATE solpeds
        SET material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = solpeds.material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = solpeds.material
        )
    """)
    results["solpeds"] = cursor.rowcount

    # 3. proveedor_precios_negociados
    print("  Actualizando proveedor_precios_negociados...")
    cursor.execute("""
        UPDATE proveedor_precios_negociados
        SET codigo_material = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = proveedor_precios_negociados.codigo_material
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = proveedor_precios_negociados.codigo_material
        )
    """)
    results["proveedor_precios_negociados"] = cursor.rowcount

    # 4. decision_abastecimiento_fuentes
    print("  Actualizando decision_abastecimiento_fuentes...")
    cursor.execute("""
        UPDATE decision_abastecimiento_fuentes
        SET codigo_material_equiv = (
            SELECT codigo_nuevo FROM temp_mapping
            WHERE codigo_antiguo = decision_abastecimiento_fuentes.codigo_material_equiv
        )
        WHERE EXISTS (
            SELECT 1 FROM temp_mapping WHERE codigo_antiguo = decision_abastecimiento_fuentes.codigo_material_equiv
        )
    """)
    results["decision_abastecimiento_fuentes"] = cursor.rowcount

    conn.commit()
    conn.close()

    return results


def migrate_main_table(mapping: dict, conn: sqlite3.Connection) -> int:
    """
    Migra la tabla principal de materiales en catalogo_materiales.db.

    Estrategia:
    1. Crear nueva tabla con estructura idéntica
    2. Insertar datos con códigos nuevos
    3. Renombrar tablas
    4. Recrear índices
    """
    cursor = conn.cursor()

    # Paso 1: Crear tabla de mapeo temporal
    cursor.execute("DROP TABLE IF EXISTS temp_mapping")
    cursor.execute("""
        CREATE TEMP TABLE temp_mapping (
            codigo_antiguo TEXT PRIMARY KEY,
            codigo_nuevo TEXT NOT NULL
        )
    """)
    cursor.executemany(
        "INSERT INTO temp_mapping VALUES (?, ?)",
        mapping.items()
    )

    # Paso 2: Crear nueva tabla con estructura idéntica
    print("  Creando tabla materiales_new...")
    cursor.execute("DROP TABLE IF EXISTS materiales_new")
    cursor.execute("""
        CREATE TABLE materiales_new (
            codigo TEXT PRIMARY KEY,
            descripcion TEXT NOT NULL,
            descripcion_larga TEXT,
            grupo_articulos INTEGER,
            unidad_medida TEXT DEFAULT 'UN',
            precio_usd REAL,
            activo INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # Paso 3: Insertar datos con códigos nuevos
    print("  Migrando datos a materiales_new...")
    cursor.execute("""
        INSERT INTO materiales_new (
            codigo, descripcion, descripcion_larga, grupo_articulos,
            unidad_medida, precio_usd, activo, created_at
        )
        SELECT
            m.codigo_nuevo,
            mat.descripcion,
            mat.descripcion_larga,
            mat.grupo_articulos,
            mat.unidad_medida,
            mat.precio_usd,
            mat.activo,
            mat.created_at
        FROM materiales mat
        JOIN temp_mapping m ON mat.codigo = m.codigo_antiguo
    """)
    migrated_count = cursor.rowcount

    # Paso 4: Renombrar tablas
    print("  Renombrando tablas...")
    cursor.execute("DROP TABLE IF EXISTS materiales_backup")
    cursor.execute("ALTER TABLE materiales RENAME TO materiales_backup")
    cursor.execute("ALTER TABLE materiales_new RENAME TO materiales")

    # Paso 5: Recrear índices
    print("  Recreando índices...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiales_descripcion ON materiales(descripcion)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiales_grupo ON materiales(grupo_articulos)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_materiales_activo ON materiales(activo)")

    # Paso 6: Marcar mapeo como aplicado
    cursor.execute("UPDATE codigo_mapping SET aplicado = 1")

    conn.commit()

    return migrated_count


def main():
    """Función principal de migración."""
    print("=" * 60)
    print("MIGRACIÓN DE CÓDIGOS DE MATERIAL SAP")
    print("=" * 60)
    print(f"\nFecha: {datetime.now().isoformat()}")
    print()

    # Verificar prerequisitos
    if not CATALOGO_DB.exists():
        print(f"✗ Error: No se encontró {CATALOGO_DB}")
        return False

    # Conectar a catálogo y cargar mapeo
    catalogo_conn = sqlite3.connect(CATALOGO_DB)
    cursor = catalogo_conn.cursor()

    # Verificar que existe la tabla de mapeo
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='codigo_mapping'
    """)
    if not cursor.fetchone():
        print("✗ Error: No existe la tabla codigo_mapping")
        print("  Ejecute primero: python scripts/migrations/002_create_mapping_table.py")
        return False

    # Cargar mapeo
    print("Cargando tabla de mapeo...")
    mapping = load_mapping(catalogo_conn)
    print(f"  ✓ Cargados {len(mapping):,} mapeos")

    results = {}

    try:
        # Fase 1: Actualizar tablas dependientes en sap_data.db
        print("\nFase 1: Actualizando sap_data.db...")
        if SAP_DATA_DB.exists():
            results["sap_data"] = update_sap_data_tables(mapping, catalogo_conn)
            for table, count in results["sap_data"].items():
                print(f"    {table}: {count:,} registros actualizados")
        else:
            print("  ⚠ sap_data.db no existe, saltando...")

        # Fase 2: Actualizar equivalencias
        print("\nFase 2: Actualizando equivalentes.db...")
        if EQUIVALENTES_DB.exists():
            results["equivalencias"] = update_equivalencias(mapping)
            for col, count in results["equivalencias"].items():
                print(f"    {col}: {count:,} registros actualizados")
        else:
            print("  ⚠ equivalentes.db no existe, saltando...")

        # Fase 3: Actualizar spm.db
        print("\nFase 3: Actualizando spm.db...")
        if SPM_DB.exists():
            results["spm"] = update_spm_tables(mapping)
            for table, count in results["spm"].items():
                print(f"    {table}: {count:,} registros actualizados")
        else:
            print("  ⚠ spm.db no existe, saltando...")

        # Fase 4: Migrar tabla principal
        print("\nFase 4: Migrando tabla principal de materiales...")
        migrated = migrate_main_table(mapping, catalogo_conn)
        print(f"    ✓ {migrated:,} materiales migrados")

        print()
        print("=" * 60)
        print("✓ MIGRACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)

        # Resumen
        print("\nResumen de cambios:")
        total_updated = migrated
        if "sap_data" in results:
            for count in results["sap_data"].values():
                total_updated += count
        if "equivalencias" in results:
            for count in results["equivalencias"].values():
                total_updated += count
        if "spm" in results:
            for count in results["spm"].values():
                total_updated += count

        print(f"  Total de registros actualizados: {total_updated:,}")

        return True

    except Exception as e:
        print(f"\n✗ Error durante la migración: {e}")
        print("\nPara restaurar desde backup:")
        print("  python scripts/migrations/005_rollback_migration.py")
        catalogo_conn.rollback()
        return False
    finally:
        catalogo_conn.close()


if __name__ == "__main__":
    import sys

    # Confirmación antes de ejecutar
    print("ADVERTENCIA: Este script modificará permanentemente las bases de datos.")
    print("Asegúrese de haber ejecutado:")
    print("  1. python scripts/migrations/001_backup_databases.py")
    print("  2. python scripts/migrations/002_create_mapping_table.py")
    print()

    response = input("¿Desea continuar? (s/N): ").strip().lower()
    if response != "s":
        print("Migración cancelada.")
        sys.exit(0)

    print()
    success = main()
    sys.exit(0 if success else 1)
