#!/usr/bin/env python3
"""
Migración de Materiales: Sufijos Únicos Globales

Este script migra la tabla `materiales` en `catalogo_materiales.db` para que el
sufijo (id_material) sea globalmente único, permitiendo usarlo como identificador primario.

ESTRATEGIA:
- El registro más antiguo (por `created_at`) conserva su sufijo original
- Los registros duplicados reciben sufijos nuevos del rango 5000000+
- Se crea una vista de compatibilidad para que el código existente siga funcionando

ANTES: 46,202 registros con 4,659 sufijos únicos (2,633 duplicados)
DESPUÉS: 46,202 registros con 46,202 sufijos únicos (0 duplicados)

Uso:
    python scripts/migrate_materiales_sufijo.py --analyze     # Solo análisis
    python scripts/migrate_materiales_sufijo.py --migrate     # Ejecutar migración
    python scripts/migrate_materiales_sufijo.py --verify      # Verificar resultado
    python scripts/migrate_materiales_sufijo.py --swap        # Activar nueva estructura
    python scripts/migrate_materiales_sufijo.py --rollback    # Revertir cambios

IMPORTANTE: Siempre hacer backup antes de migrar:
    cp data/catalogo_materiales.db data/backups/catalogo_materiales_$(date +%Y%m%d).db
"""

import argparse
import json
import os
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

# Agregar el directorio raíz al path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Rutas
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "catalogo_materiales.db"
MAPPING_FILE = DATA_DIR / "migration_sufijo_mapping.json"
BACKUP_DIR = DATA_DIR / "backups"

# Rango para nuevos sufijos (5,000,000+)
NEW_SUFFIX_START = 5000000


def get_connection() -> sqlite3.Connection:
    """Obtiene conexión a la base de datos de materiales."""
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Base de datos no encontrada: {DB_PATH}")

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def analyze_collisions(verbose: bool = False) -> dict[str, list[dict]]:
    """
    Analiza sufijos duplicados y ordena por antigüedad.

    Returns:
        Dict con sufijos duplicados y lista de materiales ordenados por created_at
    """
    print("=== Análisis de Colisiones de Sufijos ===\n")

    with get_connection() as conn:
        cur = conn.cursor()

        # Estadísticas generales
        cur.execute("SELECT COUNT(*) FROM materiales")
        total = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(DISTINCT SUBSTR(codigo, 6, 7))
            FROM materiales
            WHERE LENGTH(codigo) >= 12
        """)
        unique_suffixes = cur.fetchone()[0]

        print(f"Total registros: {total:,}")
        print(f"Sufijos únicos actuales: {unique_suffixes:,}")
        print(f"Sufijos duplicados: {total - unique_suffixes:,}")

        # Encontrar sufijos con duplicados
        cur.execute("""
            SELECT SUBSTR(codigo, 6, 7) as sufijo, COUNT(*) as cnt
            FROM materiales
            WHERE LENGTH(codigo) >= 12
            GROUP BY sufijo
            HAVING cnt > 1
            ORDER BY cnt DESC
        """)

        duplicados_info = cur.fetchall()
        print(f"\nGrupos de sufijos duplicados: {len(duplicados_info)}")

        if verbose and duplicados_info:
            print("\nTop 10 sufijos más duplicados:")
            for row in duplicados_info[:10]:
                print(f"  Sufijo {row['sufijo']}: {row['cnt']} ocurrencias")

        # Obtener detalle de todos los duplicados
        duplicados = defaultdict(list)

        cur.execute("""
            SELECT
                SUBSTR(codigo, 6, 7) as sufijo,
                codigo,
                SUBSTR(codigo, 1, 4) as grupo,
                descripcion,
                COALESCE(created_at, '1900-01-01') as created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY SUBSTR(codigo, 6, 7)
                    ORDER BY COALESCE(created_at, '1900-01-01') ASC, codigo ASC
                ) as orden
            FROM materiales
            WHERE LENGTH(codigo) >= 12
              AND SUBSTR(codigo, 6, 7) IN (
                  SELECT SUBSTR(codigo, 6, 7)
                  FROM materiales
                  WHERE LENGTH(codigo) >= 12
                  GROUP BY SUBSTR(codigo, 6, 7)
                  HAVING COUNT(*) > 1
              )
            ORDER BY sufijo, orden
        """)

        for row in cur.fetchall():
            duplicados[row['sufijo']].append({
                'codigo': row['codigo'],
                'grupo': row['grupo'],
                'descripcion': row['descripcion'],
                'created_at': row['created_at'],
                'orden': row['orden']
            })

        # Calcular cuántos necesitan renumeración
        to_renumber = sum(len(items) - 1 for items in duplicados.values())
        print(f"Registros a renumerar: {to_renumber:,}")

        if verbose and duplicados:
            print("\n--- Ejemplos de colisiones ---")
            for sufijo in list(duplicados.keys())[:3]:
                print(f"\nSufijo {sufijo}:")
                for mat in duplicados[sufijo]:
                    status = "CONSERVA" if mat['orden'] == 1 else "RENUMERAR"
                    print(f"  [{status}] {mat['codigo']} - {mat['descripcion'][:50]}...")

        return dict(duplicados)


def generate_mapping(duplicados: dict[str, list[dict]]) -> dict[str, str]:
    """
    Genera el mapeo de códigos originales a nuevos sufijos.

    Para cada sufijo duplicado:
    - orden=1 → mantiene sufijo original (no aparece en mapping)
    - orden>1 → nuevo sufijo en rango 5000000+

    Returns:
        Dict {codigo_original: nuevo_sufijo}
    """
    print("\n=== Generando Mapeo de Nuevos Sufijos ===\n")

    mapping = {}
    next_suffix = NEW_SUFFIX_START

    for sufijo, materiales in duplicados.items():
        for mat in materiales:
            if mat['orden'] > 1:
                # Asignar nuevo sufijo
                new_suffix = str(next_suffix).zfill(7)
                mapping[mat['codigo']] = new_suffix
                next_suffix += 1

    print(f"Sufijos nuevos asignados: {len(mapping):,}")
    print(f"Rango de nuevos sufijos: {NEW_SUFFIX_START} - {next_suffix - 1}")

    # Guardar mapping a archivo
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)

    print(f"Mapping guardado en: {MAPPING_FILE}")

    return mapping


def create_new_table(conn: sqlite3.Connection) -> None:
    """Crea la nueva tabla con esquema optimizado."""
    cur = conn.cursor()

    # Verificar si ya existe
    cur.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='materiales_new'
    """)
    if cur.fetchone():
        print("Tabla materiales_new ya existe, eliminando...")
        cur.execute("DROP TABLE materiales_new")

    cur.execute("""
        CREATE TABLE materiales_new (
            id_material TEXT NOT NULL PRIMARY KEY,
            grupo_articulo TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            descripcion_larga TEXT,
            grupo_articulos INTEGER,
            unidad_medida TEXT DEFAULT 'UN',
            precio_usd REAL,
            activo INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            codigo_original TEXT
        )
    """)

    print("Tabla materiales_new creada exitosamente")


def migrate_data(dry_run: bool = False) -> int:
    """
    Ejecuta la migración de datos.

    Maneja dos formatos de código:
    - Estándar (12 chars): XXXX-XXXXXXX -> extrae sufijo y grupo
    - SAP directo (8-10 chars): código numérico -> usa como id_material, grupo='AUTO'

    Args:
        dry_run: Si es True, solo muestra lo que haría sin modificar la BD.

    Returns:
        Número de registros migrados.
    """
    print("\n=== Migración de Datos ===\n")

    # Cargar mapping
    if not MAPPING_FILE.exists():
        print("ERROR: No se encontró el archivo de mapping.")
        print("Ejecuta primero: python scripts/migrate_materiales_sufijo.py --analyze")
        return 0

    with open(MAPPING_FILE, encoding='utf-8') as f:
        mapping = json.load(f)

    print(f"Mapping cargado: {len(mapping):,} sufijos a renumerar")

    if dry_run:
        print("\n[DRY RUN] No se realizarán cambios")
        print("Ejecuta sin --dry-run para aplicar la migración")
        return len(mapping)

    migrated = 0
    short_codes = 0

    with get_connection() as conn:
        cur = conn.cursor()

        # Crear nueva tabla
        create_new_table(conn)

        # PARTE 1: Migrar materiales con formato estándar (XXXX-XXXXXXX)
        cur.execute("""
            SELECT
                codigo,
                SUBSTR(codigo, 6, 7) as sufijo_actual,
                SUBSTR(codigo, 1, 4) as grupo,
                descripcion,
                descripcion_larga,
                grupo_articulos,
                unidad_medida,
                precio_usd,
                activo,
                created_at
            FROM materiales
            WHERE LENGTH(codigo) >= 12
        """)

        standard_materials = cur.fetchall()
        print(f"Migrando {len(standard_materials):,} registros con formato estándar...")

        for i, mat in enumerate(standard_materials, 1):
            codigo = mat['codigo']
            sufijo_original = mat['sufijo_actual']

            # Determinar nuevo sufijo
            if codigo in mapping:
                nuevo_sufijo = mapping[codigo]
                codigo_original = codigo
            else:
                nuevo_sufijo = sufijo_original
                codigo_original = None  # No necesita trazabilidad

            cur.execute("""
                INSERT INTO materiales_new (
                    id_material, grupo_articulo, descripcion, descripcion_larga,
                    grupo_articulos, unidad_medida, precio_usd, activo,
                    created_at, codigo_original
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                nuevo_sufijo,
                mat['grupo'],
                mat['descripcion'],
                mat['descripcion_larga'],
                mat['grupo_articulos'],
                mat['unidad_medida'] or 'UN',
                mat['precio_usd'],
                mat['activo'] if mat['activo'] is not None else 1,
                mat['created_at'],
                codigo_original
            ))

            migrated += 1

            if i % 10000 == 0:
                print(f"  Progreso: {i:,}/{len(standard_materials):,} ({i*100//len(standard_materials)}%)")

        # PARTE 2: Migrar materiales con código SAP directo (sin formato XXXX-XXXXXXX)
        cur.execute("""
            SELECT
                codigo,
                descripcion,
                descripcion_larga,
                grupo_articulos,
                unidad_medida,
                precio_usd,
                activo,
                created_at
            FROM materiales
            WHERE LENGTH(codigo) < 12
        """)

        short_materials = cur.fetchall()
        if short_materials:
            print(f"\nMigrando {len(short_materials):,} registros con código SAP directo...")

            for mat in short_materials:
                codigo = mat['codigo']

                # Para códigos cortos, usar el código como id_material (padded a 10 dígitos)
                # y grupo 'AUTO' para indicar que fue auto-agregado
                id_material = codigo.zfill(10)  # Padding a 10 dígitos

                cur.execute("""
                    INSERT INTO materiales_new (
                        id_material, grupo_articulo, descripcion, descripcion_larga,
                        grupo_articulos, unidad_medida, precio_usd, activo,
                        created_at, codigo_original
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    id_material,
                    'AUTO',  # Grupo especial para auto-agregados
                    mat['descripcion'],
                    mat['descripcion_larga'],
                    mat['grupo_articulos'],
                    mat['unidad_medida'] or 'UN',
                    mat['precio_usd'],
                    mat['activo'] if mat['activo'] is not None else 1,
                    mat['created_at'],
                    codigo  # Guardar código original para trazabilidad
                ))

                migrated += 1
                short_codes += 1

        # Crear índices
        print("\nCreando índices...")
        cur.execute("CREATE INDEX idx_mat_grupo ON materiales_new(grupo_articulo)")
        cur.execute("CREATE INDEX idx_mat_desc ON materiales_new(descripcion)")
        cur.execute("CREATE INDEX idx_mat_original ON materiales_new(codigo_original)")

        conn.commit()

        print(f"\nMigración completada:")
        print(f"  - Registros formato estándar: {migrated - short_codes:,}")
        print(f"  - Registros código SAP directo: {short_codes:,}")
        print(f"  - Total migrados: {migrated:,}")

    return migrated


def verify_migration() -> bool:
    """
    Verifica la integridad de la migración.

    Returns:
        True si la verificación es exitosa, False en caso contrario.
    """
    print("\n=== Verificación de Migración ===\n")

    success = True

    with get_connection() as conn:
        cur = conn.cursor()

        # 1. Verificar que existe materiales_new
        cur.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='materiales_new'
        """)
        if not cur.fetchone():
            print("ERROR: Tabla materiales_new no existe")
            print("Ejecuta primero: --migrate")
            return False

        # 2. Confirmar unicidad de id_material
        cur.execute("""
            SELECT id_material, COUNT(*) as cnt
            FROM materiales_new
            GROUP BY id_material
            HAVING cnt > 1
        """)
        duplicados = cur.fetchall()

        if duplicados:
            print(f"ERROR: Se encontraron {len(duplicados)} id_material duplicados")
            for d in duplicados[:5]:
                print(f"  {d['id_material']}: {d['cnt']} ocurrencias")
            success = False
        else:
            print("✓ No hay id_material duplicados")

        # 3. Conteo coincide
        cur.execute("SELECT COUNT(*) FROM materiales")
        count_original = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM materiales_new")
        count_new = cur.fetchone()[0]

        if count_original == count_new:
            print(f"✓ Conteo coincide: {count_original:,} registros")
        else:
            print(f"ERROR: Conteo no coincide - Original: {count_original:,}, Nuevo: {count_new:,}")
            success = False

        # 4. Formato correcto (7 dígitos para estándar, 10 para SAP directo)
        cur.execute("""
            SELECT COUNT(*) FROM materiales_new
            WHERE LENGTH(id_material) NOT IN (7, 10)
        """)
        invalid_format = cur.fetchone()[0]

        if invalid_format == 0:
            print("✓ Todos los id_material tienen formato correcto (7 o 10 dígitos)")
        else:
            print(f"ERROR: {invalid_format:,} registros con formato incorrecto")
            cur.execute("""
                SELECT id_material, LENGTH(id_material) as len
                FROM materiales_new
                WHERE LENGTH(id_material) NOT IN (7, 10)
                LIMIT 5
            """)
            for row in cur.fetchall():
                print(f"  {row['id_material']} (len={row['len']})")
            success = False

        # Verificar registros SAP directo
        cur.execute("""
            SELECT COUNT(*) FROM materiales_new
            WHERE grupo_articulo = 'AUTO'
        """)
        auto_count = cur.fetchone()[0]
        if auto_count > 0:
            print(f"✓ Registros con código SAP directo: {auto_count:,}")

        # 5. Nuevos sufijos en rango correcto (solo registros renumerados, no AUTO)
        cur.execute("""
            SELECT
                MIN(CAST(id_material AS INTEGER)) as min_val,
                MAX(CAST(id_material AS INTEGER)) as max_val,
                COUNT(*) as cnt
            FROM materiales_new
            WHERE codigo_original IS NOT NULL
              AND grupo_articulo != 'AUTO'
        """)
        row = cur.fetchone()

        if row['cnt'] > 0:
            if row['min_val'] >= NEW_SUFFIX_START:
                print(f"✓ Sufijos renumerados en rango correcto: {row['min_val']:,} - {row['max_val']:,}")
            else:
                print(f"ERROR: Algunos sufijos renumerados están fuera de rango: {row['min_val']}")
                success = False
            print(f"  Total renumerados por colisión: {row['cnt']:,}")
        else:
            print("✓ No hay registros renumerados por colisión")

        # 6. Mostrar estadísticas
        cur.execute("SELECT COUNT(DISTINCT grupo_articulo) FROM materiales_new")
        grupos = cur.fetchone()[0]
        print(f"\nEstadísticas finales:")
        print(f"  Total registros: {count_new:,}")
        print(f"  Grupos de artículo únicos: {grupos:,}")
        print(f"  Sufijos únicos: {count_new:,} (100%)")

    if success:
        print("\n✓ VERIFICACIÓN EXITOSA - Listo para swap")
    else:
        print("\n✗ VERIFICACIÓN FALLIDA - Revisar errores antes de continuar")

    return success


def swap_tables() -> bool:
    """
    Activa la nueva estructura:
    1. Renombra materiales → materiales_old
    2. Renombra materiales_new → materiales_data
    3. Crea vista materiales para compatibilidad

    Returns:
        True si el swap es exitoso.
    """
    print("\n=== Activando Nueva Estructura ===\n")

    # Verificar primero
    if not verify_migration():
        print("\nAbortando swap debido a errores de verificación")
        return False

    with get_connection() as conn:
        cur = conn.cursor()

        # Verificar que existe materiales_new
        cur.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='materiales_new'
        """)
        if not cur.fetchone():
            print("ERROR: Tabla materiales_new no existe")
            return False

        # Verificar que no existe materiales_old (de un swap anterior)
        cur.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='materiales_old'
        """)
        if cur.fetchone():
            print("ADVERTENCIA: materiales_old ya existe (swap previo)")
            print("Eliminando materiales_old...")
            cur.execute("DROP TABLE materiales_old")

        # Ejecutar swap
        print("1. Renombrando materiales → materiales_old")
        cur.execute("ALTER TABLE materiales RENAME TO materiales_old")

        print("2. Renombrando materiales_new → materiales_data")
        cur.execute("ALTER TABLE materiales_new RENAME TO materiales_data")

        print("3. Creando vista de compatibilidad 'materiales'")
        # La vista genera el código según el tipo:
        # - Formato estándar: XXXX-XXXXXXX
        # - SAP directo (AUTO): solo el id_material (sin prefijo)
        cur.execute("""
            CREATE VIEW materiales AS
            SELECT
                id_material,
                grupo_articulo,
                CASE
                    WHEN grupo_articulo = 'AUTO' THEN codigo_original
                    ELSE grupo_articulo || '-' || id_material
                END AS codigo,
                descripcion,
                descripcion_larga,
                grupo_articulos,
                unidad_medida,
                precio_usd,
                activo,
                created_at,
                codigo_original
            FROM materiales_data
        """)

        conn.commit()

        # Verificar vista
        cur.execute("SELECT COUNT(*) FROM materiales")
        count = cur.fetchone()[0]

        print(f"\n✓ Swap completado exitosamente")
        print(f"  Vista 'materiales' funcional con {count:,} registros")
        print(f"  Tabla original guardada como 'materiales_old'")

        # Mostrar ejemplo
        cur.execute("SELECT codigo, descripcion FROM materiales LIMIT 3")
        print("\nEjemplos de la vista:")
        for row in cur.fetchall():
            print(f"  {row['codigo']} - {row['descripcion'][:50]}...")

    return True


def rollback() -> bool:
    """
    Revierte los cambios realizados por migrate o swap.

    Returns:
        True si el rollback es exitoso.
    """
    print("\n=== Rollback ===\n")

    with get_connection() as conn:
        cur = conn.cursor()

        # Verificar estado actual
        cur.execute("""
            SELECT name, type FROM sqlite_master
            WHERE name IN ('materiales', 'materiales_new', 'materiales_old', 'materiales_data')
            ORDER BY name
        """)
        objects = {row['name']: row['type'] for row in cur.fetchall()}

        print("Estado actual:")
        for name, obj_type in objects.items():
            print(f"  {name}: {obj_type}")

        # Caso 1: Después de swap (materiales es vista, existe materiales_old)
        if objects.get('materiales') == 'view' and 'materiales_old' in objects:
            print("\nRevertiendo swap...")

            cur.execute("DROP VIEW materiales")
            print("  - Vista materiales eliminada")

            if 'materiales_data' in objects:
                cur.execute("DROP TABLE materiales_data")
                print("  - Tabla materiales_data eliminada")

            cur.execute("ALTER TABLE materiales_old RENAME TO materiales")
            print("  - Tabla materiales_old renombrada a materiales")

            conn.commit()
            print("\n✓ Rollback de swap completado")
            return True

        # Caso 2: Después de migrate (existe materiales_new)
        if 'materiales_new' in objects:
            print("\nEliminando tabla materiales_new...")
            cur.execute("DROP TABLE materiales_new")
            conn.commit()
            print("✓ Tabla materiales_new eliminada")
            return True

        # Caso 3: No hay nada que revertir
        print("No hay cambios que revertir")
        return True


def print_status() -> None:
    """Muestra el estado actual de las tablas."""
    print("\n=== Estado Actual ===\n")

    with get_connection() as conn:
        cur = conn.cursor()

        cur.execute("""
            SELECT name, type FROM sqlite_master
            WHERE name LIKE 'materiales%'
            ORDER BY name
        """)

        for row in cur.fetchall():
            print(f"  {row['name']}: {row['type']}")

            # Mostrar conteo
            try:
                cur.execute(f"SELECT COUNT(*) FROM {row['name']}")
                count = cur.fetchone()[0]
                print(f"    → {count:,} registros")
            except Exception:
                pass


def main():
    """Punto de entrada principal."""
    parser = argparse.ArgumentParser(
        description="Migración de materiales a sufijos únicos globales",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # 1. Analizar colisiones (primer paso)
  python scripts/migrate_materiales_sufijo.py --analyze

  # 2. Ejecutar migración
  python scripts/migrate_materiales_sufijo.py --migrate

  # 3. Verificar resultado
  python scripts/migrate_materiales_sufijo.py --verify

  # 4. Activar nueva estructura
  python scripts/migrate_materiales_sufijo.py --swap

  # Si algo sale mal:
  python scripts/migrate_materiales_sufijo.py --rollback
"""
    )

    parser.add_argument(
        '--analyze', action='store_true',
        help='Analiza colisiones de sufijos y genera mapping'
    )
    parser.add_argument(
        '--migrate', action='store_true',
        help='Ejecuta la migración de datos'
    )
    parser.add_argument(
        '--verify', action='store_true',
        help='Verifica la integridad de la migración'
    )
    parser.add_argument(
        '--swap', action='store_true',
        help='Activa la nueva estructura (renombra tablas)'
    )
    parser.add_argument(
        '--rollback', action='store_true',
        help='Revierte los cambios realizados'
    )
    parser.add_argument(
        '--status', action='store_true',
        help='Muestra el estado actual de las tablas'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Solo muestra lo que haría sin modificar la BD'
    )
    parser.add_argument(
        '-v', '--verbose', action='store_true',
        help='Muestra información detallada'
    )

    args = parser.parse_args()

    # Verificar que la BD existe
    if not DB_PATH.exists():
        print(f"ERROR: Base de datos no encontrada: {DB_PATH}")
        sys.exit(1)

    # Crear directorio de backups si no existe
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Ejecutar acción solicitada
    if args.status:
        print_status()
    elif args.analyze:
        duplicados = analyze_collisions(verbose=args.verbose)
        if duplicados:
            generate_mapping(duplicados)
    elif args.migrate:
        if args.dry_run:
            print("[DRY RUN] Simulando migración...\n")
        migrate_data(dry_run=args.dry_run)
    elif args.verify:
        verify_migration()
    elif args.swap:
        swap_tables()
    elif args.rollback:
        rollback()
    else:
        # Sin argumentos, mostrar ayuda y estado
        parser.print_help()
        print_status()


if __name__ == "__main__":
    main()
