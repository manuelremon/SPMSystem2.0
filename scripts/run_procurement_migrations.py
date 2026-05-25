#!/usr/bin/env python3
"""
Ejecuta todas las migraciones necesarias para el módulo de Procurement
directamente sobre data/spm.db (SQLite), sin necesidad de PostgreSQL.

Uso:
    python scripts/run_procurement_migrations.py
    python scripts/run_procurement_migrations.py -v
"""

import sys
import os
import argparse
import importlib.util
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = PROJECT_ROOT / "data" / "spm.db"

# Lista de migraciones: (número, archivo, estrategia)
# Estrategia: "sqlite_ddl" usa la variable SQLITE_DDL del módulo
#             "cursor_fn"  llama a fn(cursor, "sqlite")
#             "direct_sql" se ejecuta con SQL directo aquí mismo
MIGRATIONS = [
    ("095", "backend/migrations/095_fix_orden_compra_sqlite.py", "direct_conn"),
    ("034", "backend/migrations/034_ordenes_compra.py",          "patched_run_migration"),
    ("037", "backend/migrations/037_proveedor_scorecard.py",     "patched_run_migration"),
    ("047", "backend/migrations/047_contract_management.py",     "cursor_fn_up"),
    ("048", "backend/migrations/048_contract_items.py",          "cursor_fn_up"),
    ("049", "backend/migrations/049_contract_documents.py",      "cursor_fn_up"),
    ("050", "backend/migrations/050_rfq_tables.py",              "cursor_fn_upgrade"),
    ("051", "backend/migrations/051_rfq_award.py",               "cursor_fn_upgrade"),
    ("054", "backend/migrations/054_invoice_matching.py",        "cursor_fn_up"),
    ("084", "backend/migrations/084_procurement_sap_tables.py",  "patched_up"),
]


def load_module(path):
    full = PROJECT_ROOT / path
    if not full.exists():
        return None
    spec = importlib.util.spec_from_file_location(full.stem, full)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run_sqlite_ddl(mod, conn, num):
    """Usa SQLITE_DDL + SQLITE_INDEXES del módulo."""
    ddl_list = getattr(mod, "SQLITE_DDL", [])
    idx_list = getattr(mod, "SQLITE_INDEXES", [])
    cur = conn.cursor()
    for ddl in ddl_list:
        cur.execute(ddl)
    for idx in idx_list:
        cur.execute(idx)
    conn.commit()


def run_cursor_fn(mod, conn, fn_name, db_type="sqlite"):
    """Llama a fn(cursor, db_type) del módulo."""
    fn = getattr(mod, fn_name, None)
    if fn is None:
        raise ValueError(f"Función '{fn_name}' no encontrada en módulo")
    cur = conn.cursor()
    fn(cur, db_type)
    conn.commit()


def patch_db_to_sqlite(conn):
    """
    Parchea get_db_connection, get_db_transaction e is_using_postgresql
    para que usen la conexión SQLite local en lugar de PostgreSQL.

    Distintas migraciones usan distintas firmas de context manager:
      - get_db_transaction() as conn           → solo conn
      - get_db_transaction() as (conn, cursor) → tupla
    El fake debe soportar ambas mediante __iter__.
    """
    import backend.core.db as db_mod
    import contextlib

    original_get_conn = db_mod.get_db_connection
    original_get_tx = db_mod.get_db_transaction
    original_is_pg = db_mod.is_using_postgresql

    class _DualConn:
        """Wrapper que actúa como conn Y como (conn, cursor) según cómo se desempaque."""
        def __init__(self, c):
            self._c = c
        def cursor(self):
            return self._c.cursor()
        def commit(self):
            self._c.commit()
        def rollback(self):
            self._c.rollback()
        def execute(self, *a, **kw):
            return self._c.execute(*a, **kw)
        def close(self):
            pass  # no cerrar la conn compartida
        def __iter__(self):
            # Soporta: conn, cur = get_db_transaction()
            yield self
            yield self._c.cursor()
        def __getattr__(self, name):
            return getattr(self._c, name)

    @contextlib.contextmanager
    def _fake_conn(*args, **kwargs):
        yield _DualConn(conn)

    @contextlib.contextmanager
    def _fake_tx(*args, **kwargs):
        yield _DualConn(conn)

    def _not_pg():
        return False

    db_mod.get_db_connection = _fake_conn
    db_mod.get_db_transaction = _fake_tx
    db_mod.is_using_postgresql = _not_pg

    # Parchear módulos que ya importaron estas funciones
    for mod_name in list(sys.modules.keys()):
        mod = sys.modules[mod_name]
        if hasattr(mod, 'get_db_connection') and mod.get_db_connection is original_get_conn:
            mod.get_db_connection = _fake_conn
        if hasattr(mod, 'get_db_transaction') and mod.get_db_transaction is original_get_tx:
            mod.get_db_transaction = _fake_tx
        if hasattr(mod, 'is_using_postgresql') and mod.is_using_postgresql is original_is_pg:
            mod.is_using_postgresql = _not_pg

    return original_get_conn, original_get_tx, original_is_pg


def unpatch_db(originals):
    import backend.core.db as db_mod
    db_mod.get_db_connection, db_mod.get_db_transaction, db_mod.is_using_postgresql = originals
    # Restaurar en módulos
    orig_conn, orig_tx, orig_pg = originals
    for mod_name in list(sys.modules.keys()):
        mod = sys.modules[mod_name]
        for attr, orig in [('get_db_connection', orig_conn), ('get_db_transaction', orig_tx), ('is_using_postgresql', orig_pg)]:
            try:
                if hasattr(mod, attr) and callable(getattr(mod, attr)):
                    setattr(mod, attr, orig)
            except Exception:
                pass


def run_migration(num, path, strategy, conn, verbose):
    full = PROJECT_ROOT / path
    if not full.exists():
        print(f"  [{num}] SKIP — archivo no encontrado")
        return True

    try:
        if strategy == "direct_conn":
            # Migración 095: acepta conn directamente
            mod = load_module(path)
            result = mod.run_migration(conn)
            ok = result is not False

        elif strategy == "patched_run_migration":
            # Migración usa run_migration() con get_db_connection/transaction internos
            mod = load_module(path)
            originals = patch_db_to_sqlite(conn)
            try:
                result = mod.run_migration()
                ok = result is not False
            finally:
                unpatch_db(originals)

        elif strategy == "patched_up":
            # Migración usa up() con get_db_connection internos
            mod = load_module(path)
            originals = patch_db_to_sqlite(conn)
            try:
                mod.up()
                ok = True
            finally:
                unpatch_db(originals)

        elif strategy == "cursor_fn_up":
            # up(cursor, db_type) — 047/048/049; o up() con patch — 054
            mod = load_module(path)
            fn = getattr(mod, "up", None)
            if fn is None:
                raise ValueError("función 'up' no encontrada")
            import inspect
            sig = inspect.signature(fn)
            if len(sig.parameters) >= 2:
                cur = conn.cursor()
                fn(cur, "sqlite")
                conn.commit()
            else:
                originals = patch_db_to_sqlite(conn)
                try:
                    fn()
                finally:
                    unpatch_db(originals)
            ok = True

        elif strategy == "cursor_fn_upgrade":
            mod = load_module(path)
            run_cursor_fn(mod, conn, "upgrade")
            ok = True

        else:
            print(f"  [{num}] SKIP — estrategia desconocida: {strategy}")
            return True

        print(f"  [{num}] OK")
        return ok

    except Exception as e:
        print(f"  [{num}] ERROR — {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return False


def verify_tables(conn):
    expected = [
        "orden_compra", "orden_compra_item", "orden_compra_historial",
        "recepcion", "recepcion_item",
        "proveedor_evaluacion", "proveedor_meta",
        "contrato", "contrato_historial",
        "rfq", "rfq_item", "rfq_proveedor", "rfq_oferta",
        "rfq_criterio_evaluacion", "rfq_evaluacion", "rfq_adjudicacion",
        "factura_proveedor", "factura_item", "matching_resultado",
        "sap_solpeds", "sap_purchase_orders", "sap_import_log",
    ]
    all_tables = {t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    missing = [t for t in expected if t not in all_tables]
    found = [t for t in expected if t in all_tables]
    print(f"\n  Tablas creadas: {len(found)}/{len(expected)}")
    if missing:
        print(f"  Tablas faltantes: {', '.join(missing)}")
    else:
        print("  Todas las tablas de procurement existen.")
    return len(missing) == 0


def main():
    parser = argparse.ArgumentParser(description="Ejecuta migraciones de procurement en SQLite")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: No se encontró {DB_PATH}")
        return 1

    print(f"\n=== Migraciones de Procurement → {DB_PATH} ===\n")

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = OFF")  # Evitar errores de FK durante migración

    failures = 0
    for num, path, strategy in MIGRATIONS:
        ok = run_migration(num, path, strategy, conn, args.verbose)
        if not ok:
            failures += 1

    conn.execute("PRAGMA foreign_keys = ON")
    all_ok = verify_tables(conn)
    conn.close()

    status = "OK" if failures == 0 else "COMPLETADO CON ERRORES"
    print(f"\n{status} — {len(MIGRATIONS) - failures}/{len(MIGRATIONS)} migraciones exitosas\n")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
