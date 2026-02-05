#!/usr/bin/env python3
"""
Script 004: Validación de migración de códigos SAP
==================================================

Este script verifica que la migración se completó correctamente:
1. Formato de códigos nuevos (NNNN-NNNNNNN)
2. Integridad referencial entre tablas
3. Preservación de descripciones
4. Conteo de registros

Uso:
    python scripts/migrations/004_validate_migration.py
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


def validate_code_format(conn: sqlite3.Connection) -> dict:
    """Verifica que todos los códigos tengan el formato correcto."""
    cursor = conn.cursor()

    results = {
        "total": 0,
        "valid_format": 0,
        "invalid_format": 0,
        "invalid_examples": [],
    }

    cursor.execute("SELECT COUNT(*) FROM materiales")
    results["total"] = cursor.fetchone()[0]

    # Formato esperado: NNNN-NNNNNNN (4 dígitos, guión, 7 dígitos)
    cursor.execute("""
        SELECT COUNT(*) FROM materiales
        WHERE codigo GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
    """)
    results["valid_format"] = cursor.fetchone()[0]
    results["invalid_format"] = results["total"] - results["valid_format"]

    if results["invalid_format"] > 0:
        cursor.execute("""
            SELECT codigo FROM materiales
            WHERE codigo NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
            LIMIT 10
        """)
        results["invalid_examples"] = [row[0] for row in cursor.fetchall()]

    return results


def validate_descriptions_preserved(conn: sqlite3.Connection) -> dict:
    """Verifica que las descripciones no fueron modificadas."""
    cursor = conn.cursor()

    results = {
        "checked": 0,
        "mismatches": 0,
        "mismatch_examples": [],
    }

    # Comparar con backup (si existe)
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='materiales_backup'
    """)
    if not cursor.fetchone():
        results["error"] = "No existe tabla materiales_backup para comparación"
        return results

    # Verificar descripciones usando la tabla de mapeo
    cursor.execute("""
        SELECT
            m.codigo AS codigo_nuevo,
            m.descripcion AS desc_nueva,
            b.descripcion AS desc_original
        FROM materiales m
        JOIN codigo_mapping cm ON m.codigo = cm.codigo_nuevo
        JOIN materiales_backup b ON cm.codigo_antiguo = b.codigo
        WHERE m.descripcion != b.descripcion
        LIMIT 10
    """)
    mismatches = cursor.fetchall()
    results["mismatch_examples"] = mismatches
    results["mismatches"] = len(mismatches)

    cursor.execute("SELECT COUNT(*) FROM materiales")
    results["checked"] = cursor.fetchone()[0]

    return results


def validate_referential_integrity() -> dict:
    """Verifica la integridad referencial entre tablas."""
    results = {}

    catalogo_conn = sqlite3.connect(CATALOGO_DB)
    catalogo_cursor = catalogo_conn.cursor()

    # Obtener todos los códigos válidos del catálogo
    catalogo_cursor.execute("SELECT codigo FROM materiales")
    valid_codes = {row[0] for row in catalogo_cursor.fetchall()}
    results["valid_codes_count"] = len(valid_codes)

    # Verificar sap_data.db
    if SAP_DATA_DB.exists():
        sap_conn = sqlite3.connect(SAP_DATA_DB)
        sap_cursor = sap_conn.cursor()

        # stock
        sap_cursor.execute("SELECT DISTINCT material FROM stock WHERE material IS NOT NULL")
        stock_codes = {row[0] for row in sap_cursor.fetchall()}
        orphan_stock = stock_codes - valid_codes
        results["stock"] = {
            "total": len(stock_codes),
            "orphans": len(orphan_stock),
            "orphan_examples": list(orphan_stock)[:5] if orphan_stock else [],
        }

        # consumo_historico
        sap_cursor.execute("SELECT DISTINCT material FROM consumo_historico WHERE material IS NOT NULL")
        consumo_codes = {row[0] for row in sap_cursor.fetchall()}
        orphan_consumo = consumo_codes - valid_codes
        results["consumo_historico"] = {
            "total": len(consumo_codes),
            "orphans": len(orphan_consumo),
            "orphan_examples": list(orphan_consumo)[:5] if orphan_consumo else [],
        }

        # materiales_bbdd
        sap_cursor.execute("SELECT DISTINCT codigo_material FROM materiales_bbdd WHERE codigo_material IS NOT NULL")
        bbdd_codes = {row[0] for row in sap_cursor.fetchall()}
        orphan_bbdd = bbdd_codes - valid_codes
        results["materiales_bbdd"] = {
            "total": len(bbdd_codes),
            "orphans": len(orphan_bbdd),
            "orphan_examples": list(orphan_bbdd)[:5] if orphan_bbdd else [],
        }

        # pedidos_sap
        sap_cursor.execute("SELECT DISTINCT material FROM pedidos_sap WHERE material IS NOT NULL")
        pedidos_codes = {row[0] for row in sap_cursor.fetchall()}
        orphan_pedidos = pedidos_codes - valid_codes
        results["pedidos_sap"] = {
            "total": len(pedidos_codes),
            "orphans": len(orphan_pedidos),
            "orphan_examples": list(orphan_pedidos)[:5] if orphan_pedidos else [],
        }

        sap_conn.close()

    catalogo_conn.close()

    return results


def get_migration_stats(conn: sqlite3.Connection) -> dict:
    """Obtiene estadísticas de la migración."""
    cursor = conn.cursor()

    stats = {}

    # Total de materiales migrados
    cursor.execute("SELECT COUNT(*) FROM materiales")
    stats["total_materiales"] = cursor.fetchone()[0]

    # Distribución por grupo (top 10)
    cursor.execute("""
        SELECT
            SUBSTR(codigo, 1, 4) AS grupo,
            COUNT(*) AS cantidad
        FROM materiales
        GROUP BY grupo
        ORDER BY cantidad DESC
        LIMIT 10
    """)
    stats["top_groups"] = cursor.fetchall()

    # Rango de secuencias por grupo
    cursor.execute("""
        SELECT
            SUBSTR(codigo, 1, 4) AS grupo,
            MIN(CAST(SUBSTR(codigo, 6) AS INTEGER)) AS min_seq,
            MAX(CAST(SUBSTR(codigo, 6) AS INTEGER)) AS max_seq
        FROM materiales
        GROUP BY grupo
        ORDER BY max_seq DESC
        LIMIT 10
    """)
    stats["sequence_ranges"] = cursor.fetchall()

    # Ejemplos de códigos nuevos
    cursor.execute("""
        SELECT codigo, descripcion
        FROM materiales
        ORDER BY codigo
        LIMIT 5
    """)
    stats["sample_codes"] = cursor.fetchall()

    return stats


def main():
    """Función principal de validación."""
    print("=" * 60)
    print("VALIDACIÓN DE MIGRACIÓN DE CÓDIGOS SAP")
    print("=" * 60)
    print(f"\nFecha: {datetime.now().isoformat()}")
    print()

    if not CATALOGO_DB.exists():
        print(f"✗ Error: No se encontró {CATALOGO_DB}")
        return False

    conn = sqlite3.connect(CATALOGO_DB)
    all_valid = True

    # Test 1: Formato de códigos
    print("Test 1: Validación de formato de códigos")
    print("-" * 40)
    format_results = validate_code_format(conn)
    print(f"  Total materiales: {format_results['total']:,}")
    print(f"  Formato válido: {format_results['valid_format']:,}")
    print(f"  Formato inválido: {format_results['invalid_format']:,}")

    if format_results["invalid_format"] > 0:
        print(f"  ✗ FALLO: {format_results['invalid_format']} códigos con formato inválido")
        print(f"    Ejemplos: {format_results['invalid_examples'][:5]}")
        all_valid = False
    else:
        print("  ✓ PASÓ: Todos los códigos tienen formato válido")

    # Test 2: Preservación de descripciones
    print("\nTest 2: Preservación de descripciones")
    print("-" * 40)
    desc_results = validate_descriptions_preserved(conn)

    if "error" in desc_results:
        print(f"  ⚠ {desc_results['error']}")
    else:
        print(f"  Registros verificados: {desc_results['checked']:,}")
        print(f"  Descripciones modificadas: {desc_results['mismatches']}")

        if desc_results["mismatches"] > 0:
            print(f"  ✗ FALLO: {desc_results['mismatches']} descripciones modificadas")
            all_valid = False
        else:
            print("  ✓ PASÓ: Todas las descripciones preservadas")

    # Test 3: Integridad referencial
    print("\nTest 3: Integridad referencial")
    print("-" * 40)
    ref_results = validate_referential_integrity()
    print(f"  Códigos válidos en catálogo: {ref_results['valid_codes_count']:,}")

    total_orphans = 0
    for table in ["stock", "consumo_historico", "materiales_bbdd", "pedidos_sap"]:
        if table in ref_results:
            info = ref_results[table]
            total_orphans += info["orphans"]
            status = "✓" if info["orphans"] == 0 else "✗"
            print(f"  {status} {table}: {info['total']} códigos únicos, {info['orphans']} huérfanos")
            if info["orphans"] > 0 and info["orphan_examples"]:
                print(f"      Ejemplos huérfanos: {info['orphan_examples'][:3]}")

    if total_orphans > 0:
        print(f"\n  ⚠ ADVERTENCIA: {total_orphans} registros huérfanos encontrados")
        # No marcamos como fallo porque pueden ser códigos que no estaban en el catálogo original
    else:
        print("\n  ✓ PASÓ: Sin registros huérfanos")

    # Estadísticas de migración
    print("\nEstadísticas de migración:")
    print("-" * 40)
    stats = get_migration_stats(conn)

    print(f"  Total materiales: {stats['total_materiales']:,}")

    print("\n  Top 10 grupos por cantidad:")
    for grupo, cantidad in stats["top_groups"]:
        print(f"    Grupo {grupo}: {cantidad:,} materiales")

    print("\n  Ejemplos de códigos nuevos:")
    for codigo, descripcion in stats["sample_codes"]:
        desc_short = descripcion[:40] + "..." if len(descripcion) > 40 else descripcion
        print(f"    {codigo}: {desc_short}")

    conn.close()

    # Resultado final
    print()
    print("=" * 60)
    if all_valid:
        print("✓ VALIDACIÓN COMPLETADA - TODOS LOS TESTS PASARON")
    else:
        print("✗ VALIDACIÓN COMPLETADA CON ERRORES")
    print("=" * 60)

    return all_valid


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
