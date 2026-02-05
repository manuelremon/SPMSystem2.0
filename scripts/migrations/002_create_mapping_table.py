#!/usr/bin/env python3
"""
Script 002: Crear tabla de mapeo de códigos de material
=======================================================

Este script genera la tabla de mapeo que relaciona códigos antiguos
con los nuevos códigos en formato GRUPO-SECUENCIA.

Formato nuevo: {grupo_articulos}-{secuencia_7_digitos}
Ejemplo: 1124-0000001, 1130-0000002

Uso:
    python scripts/migrations/002_create_mapping_table.py
"""

import sqlite3
from datetime import datetime
from pathlib import Path


# Configuración de rutas
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CATALOGO_DB = DATA_DIR / "catalogo_materiales.db"

# Grupo genérico para materiales sin clasificar
DEFAULT_GROUP = 9999


def generate_new_codes(conn: sqlite3.Connection) -> list:
    """
    Genera nuevos códigos basados en grupo_articulos + secuencia.

    Retorna lista de tuplas: (codigo_antiguo, codigo_nuevo, grupo_articulos)
    """
    cursor = conn.cursor()

    # Obtener todos los materiales ordenados por grupo y código original
    cursor.execute("""
        SELECT
            codigo,
            COALESCE(grupo_articulos, ?) AS grupo
        FROM materiales
        ORDER BY grupo, codigo
    """, (DEFAULT_GROUP,))

    materials = cursor.fetchall()
    group_counters = {}
    mapping = []

    for codigo_antiguo, grupo in materials:
        if grupo not in group_counters:
            group_counters[grupo] = 0
        group_counters[grupo] += 1

        # Formato: GRUPO-SECUENCIA (4 dígitos - 7 dígitos)
        codigo_nuevo = f"{grupo:04d}-{group_counters[grupo]:07d}"
        mapping.append((codigo_antiguo, codigo_nuevo, grupo))

    return mapping


def create_mapping_table(conn: sqlite3.Connection, mapping: list) -> int:
    """
    Crea la tabla de mapeo y la puebla con los datos generados.

    Retorna el número de registros insertados.
    """
    cursor = conn.cursor()

    # Eliminar tabla si existe (para permitir re-ejecución)
    cursor.execute("DROP TABLE IF EXISTS codigo_mapping")

    # Crear tabla de mapeo
    cursor.execute("""
        CREATE TABLE codigo_mapping (
            codigo_antiguo TEXT PRIMARY KEY,
            codigo_nuevo TEXT NOT NULL UNIQUE,
            grupo_articulos INTEGER NOT NULL,
            migrado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            aplicado INTEGER DEFAULT 0
        )
    """)

    # Crear índices para búsquedas rápidas
    cursor.execute("CREATE INDEX idx_mapping_nuevo ON codigo_mapping(codigo_nuevo)")
    cursor.execute("CREATE INDEX idx_mapping_grupo ON codigo_mapping(grupo_articulos)")

    # Insertar mapeos en lotes para mejor rendimiento
    batch_size = 5000
    for i in range(0, len(mapping), batch_size):
        batch = mapping[i:i + batch_size]
        cursor.executemany("""
            INSERT INTO codigo_mapping (codigo_antiguo, codigo_nuevo, grupo_articulos)
            VALUES (?, ?, ?)
        """, batch)

    conn.commit()
    return len(mapping)


def validate_mapping(conn: sqlite3.Connection) -> dict:
    """Valida que el mapeo sea correcto."""
    cursor = conn.cursor()

    results = {
        "total_mapped": 0,
        "unique_new_codes": 0,
        "groups_count": 0,
        "format_errors": 0,
        "sample_mappings": [],
    }

    # Contar total
    cursor.execute("SELECT COUNT(*) FROM codigo_mapping")
    results["total_mapped"] = cursor.fetchone()[0]

    # Verificar unicidad de códigos nuevos
    cursor.execute("SELECT COUNT(DISTINCT codigo_nuevo) FROM codigo_mapping")
    results["unique_new_codes"] = cursor.fetchone()[0]

    # Contar grupos
    cursor.execute("SELECT COUNT(DISTINCT grupo_articulos) FROM codigo_mapping")
    results["groups_count"] = cursor.fetchone()[0]

    # Verificar formato de códigos nuevos (NNNN-NNNNNNN)
    cursor.execute("""
        SELECT COUNT(*) FROM codigo_mapping
        WHERE codigo_nuevo NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
    """)
    results["format_errors"] = cursor.fetchone()[0]

    # Obtener ejemplos
    cursor.execute("""
        SELECT codigo_antiguo, codigo_nuevo, grupo_articulos
        FROM codigo_mapping
        ORDER BY grupo_articulos, codigo_antiguo
        LIMIT 10
    """)
    results["sample_mappings"] = cursor.fetchall()

    # Obtener distribución por grupo (top 10)
    cursor.execute("""
        SELECT grupo_articulos, COUNT(*) as cantidad
        FROM codigo_mapping
        GROUP BY grupo_articulos
        ORDER BY cantidad DESC
        LIMIT 10
    """)
    results["top_groups"] = cursor.fetchall()

    return results


def main():
    """Función principal."""
    print("=" * 60)
    print("CREAR TABLA DE MAPEO DE CÓDIGOS SAP")
    print("=" * 60)
    print()

    if not CATALOGO_DB.exists():
        print(f"✗ Error: No se encontró {CATALOGO_DB}")
        return False

    conn = sqlite3.connect(CATALOGO_DB)

    try:
        # Paso 1: Generar nuevos códigos
        print("Paso 1: Generando nuevos códigos...")
        mapping = generate_new_codes(conn)
        print(f"  ✓ Generados {len(mapping):,} mapeos")

        # Paso 2: Crear y poblar tabla de mapeo
        print("\nPaso 2: Creando tabla de mapeo...")
        count = create_mapping_table(conn, mapping)
        print(f"  ✓ Insertados {count:,} registros en codigo_mapping")

        # Paso 3: Validar mapeo
        print("\nPaso 3: Validando mapeo...")
        validation = validate_mapping(conn)

        print(f"  Total mapeados: {validation['total_mapped']:,}")
        print(f"  Códigos nuevos únicos: {validation['unique_new_codes']:,}")
        print(f"  Grupos distintos: {validation['groups_count']}")
        print(f"  Errores de formato: {validation['format_errors']}")

        if validation["total_mapped"] != validation["unique_new_codes"]:
            print("  ✗ ADVERTENCIA: Hay códigos nuevos duplicados!")
            return False

        print("\n  Ejemplos de mapeo:")
        print("  " + "-" * 50)
        print(f"  {'Código Antiguo':<15} {'Código Nuevo':<15} {'Grupo':<10}")
        print("  " + "-" * 50)
        for old, new, grupo in validation["sample_mappings"]:
            print(f"  {old:<15} {new:<15} {grupo:<10}")

        print("\n  Top 10 grupos por cantidad de materiales:")
        print("  " + "-" * 30)
        for grupo, cantidad in validation["top_groups"]:
            print(f"  Grupo {grupo:04d}: {cantidad:,} materiales")

        print()
        print("=" * 60)
        print("✓ TABLA DE MAPEO CREADA EXITOSAMENTE")
        print("=" * 60)

        return True

    except Exception as e:
        print(f"\n✗ Error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
