#!/usr/bin/env python3
"""
Seed comprehensivo para todo el sistema SPM 2.0.

Puebla las ~192 tablas vacías con datos realistas y coherentes,
usando PostgreSQL via get_db_connection().

Uso:
    python scripts/seed_full_system.py                    # Seed todo
    python scripts/seed_full_system.py --module tms fms   # Seed selectivo
    python scripts/seed_full_system.py --clean             # Limpiar seed data
    python scripts/seed_full_system.py --status            # Ver estado tablas
    python scripts/seed_full_system.py -v                  # Verbose
"""

import sys
import os
import argparse
import time
from pathlib import Path

# Setup path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Set Flask env para que config cargue
os.environ.setdefault("FLASK_ENV", "development")


def get_connection():
    """Obtiene conexión PG via backend/core/db.py."""
    from backend.core.db import get_db_connection
    return get_db_connection("spm")


def show_status(conn):
    """Muestra conteo de registros por tabla."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = [r[0] for r in cursor.fetchall()]

    empty = []
    populated = []
    for t in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")  # noqa: S608
            count = cursor.fetchone()[0]
            if count > 0:
                populated.append((t, count))
            else:
                empty.append(t)
        except Exception:
            empty.append(t)

    print(f"\n{'='*60}")
    print(f"  ESTADO DE TABLAS SPM 2.0")
    print(f"{'='*60}")
    print(f"\n  Tablas con datos ({len(populated)}):")
    for t, c in sorted(populated, key=lambda x: -x[1]):
        print(f"    {t:<45} {c:>8,}")
    print(f"\n  Tablas vacías ({len(empty)}):")
    for t in sorted(empty):
        print(f"    {t}")
    print(f"\n  Total: {len(tables)} tablas | {len(populated)} con datos | {len(empty)} vacías")
    print(f"{'='*60}\n")


def run_seed(conn, modules, verbose=False, debug=False):
    """Ejecuta seed para los módulos seleccionados."""
    from scripts.seed_modules._refs import load_refs

    print("\n  Cargando datos de referencia...")
    refs = load_refs(conn, verbose=verbose)
    print(f"  OK: {len(refs.user_ids)} usuarios, {len(refs.material_codes)} materiales, "
          f"{len(refs.proveedor_cuits)} proveedores, {len(refs.solicitud_ids)} solicitudes\n")

    total_records = 0
    for mod_class in modules:
        mod = mod_class(conn, refs, verbose=verbose, debug=debug)
        print(f"  [{mod.name}] {mod.description}...", end=" ", flush=True)
        t0 = time.time()
        try:
            mod.seed()
            conn.commit()
            counts = mod.summary()
            n = sum(counts.values())
            total_records += n
            elapsed = time.time() - t0
            print(f"OK ({n} registros, {elapsed:.1f}s)")
            if verbose and counts:
                for table, count in sorted(counts.items()):
                    print(f"    {table}: {count}")
        except Exception as e:
            conn.rollback()
            print(f"ERROR: {e}")
            if verbose:
                import traceback
                traceback.print_exc()

    return total_records


def run_clean(conn, modules, verbose=False):
    """Limpia datos de seed en orden inverso."""
    from scripts.seed_modules._refs import load_refs
    refs = load_refs(conn, verbose=False)

    for mod_class in reversed(modules):
        mod = mod_class(conn, refs, verbose=verbose)
        print(f"  [{mod.name}] Limpiando...", end=" ", flush=True)
        try:
            mod.clean()
            conn.commit()
            print("OK")
        except Exception as e:
            conn.rollback()
            print(f"ERROR: {e}")


def main():
    parser = argparse.ArgumentParser(description="Seed comprehensivo SPM 2.0")
    parser.add_argument("--module", nargs="+", help="Módulos específicos a ejecutar")
    parser.add_argument("--clean", action="store_true", help="Limpiar datos de seed")
    parser.add_argument("--status", action="store_true", help="Ver estado de tablas")
    parser.add_argument("-v", "--verbose", action="store_true", help="Modo verbose")
    parser.add_argument("--debug", action="store_true", help="Mostrar errores de insert")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  SPM 2.0 - SEED COMPREHENSIVO")
    print("=" * 60)

    conn = get_connection()

    if args.status:
        show_status(conn)
        conn.close()
        return

    from scripts.seed_modules import SEED_MODULES, MODULE_MAP

    # Filtrar módulos si se especificaron
    if args.module:
        modules = []
        for name in args.module:
            if name in MODULE_MAP:
                modules.append(MODULE_MAP[name])
            else:
                print(f"  ERROR: Módulo '{name}' no encontrado.")
                print(f"  Disponibles: {', '.join(MODULE_MAP.keys())}")
                conn.close()
                sys.exit(1)
    else:
        modules = SEED_MODULES

    if args.clean:
        print(f"\n  Limpiando {len(modules)} módulos...\n")
        run_clean(conn, modules, verbose=args.verbose)
        print("\n  Limpieza completada.")
    else:
        print(f"\n  Ejecutando seed para {len(modules)} módulos...\n")
        t0 = time.time()
        total = run_seed(conn, modules, verbose=args.verbose, debug=args.debug)
        elapsed = time.time() - t0
        print(f"\n  Seed completado: {total:,} registros en {elapsed:.1f}s")

    conn.close()
    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
