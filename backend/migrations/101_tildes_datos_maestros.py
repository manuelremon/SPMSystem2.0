"""
Migracion 101: Tildes en datos maestros visibles (sectores y nombres de centro).

Los catalogos y todas las tablas que los referencian usaban nombres sin tilde:
  sectores: Planificacion, Produccion, Logistica
  centros:  Deposito 1..6
Se renombran a su forma correcta en TODAS las columnas donde aparecen
(sector, sector_nombre, centro_nombre, centro_descripcion y el nombre en los
catalogos), para que el mismo dato se vea igual en todo el sistema.

Idempotente. Funciona en SQLite (dev) y PostgreSQL (prod, sobre tablas base).
Fecha: 2026-09-27
"""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

SECTORES = {"Planificacion": "Planificación", "Produccion": "Producción", "Logistica": "Logística"}
CENTROS = {f"Deposito {i}": f"Depósito {i}" for i in range(1, 7)}

COLUMNAS_SECTOR = ("sector", "sector_nombre")
COLUMNAS_CENTRO = ("centro_nombre", "centro_descripcion")
# Catalogos: la columna "nombre" solo se toca en estas tablas
CATALOGOS = {"catalogo_sector": SECTORES, "catalogo_centro": CENTROS}


def _filas(cur):
    return [tuple(r[i] for i in range(len(r))) for r in cur.fetchall()]


def _tablas_base(cur, is_pg):
    if is_pg:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_type='BASE TABLE'"
        )
    else:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    return [r[0] for r in _filas(cur)]


def _columnas(cur, tabla, is_pg):
    if is_pg:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=?",
            (tabla,),
        )
        return {r[0] for r in _filas(cur)}
    cur.execute(f'PRAGMA table_info("{tabla}")')
    return {r[1] for r in _filas(cur)}


def _renombrar(conn, is_pg, log):
    cur = conn.cursor()
    for tabla in _tablas_base(cur, is_pg):
        cols = _columnas(cur, tabla, is_pg)
        objetivos = [(c, SECTORES) for c in COLUMNAS_SECTOR if c in cols]
        objetivos += [(c, CENTROS) for c in COLUMNAS_CENTRO if c in cols]
        # En PG los catalogos pueden ser vistas sobre tablas con otro nombre: se
        # identifican por ser la tabla base con columnas (codigo|nombre) + activo
        if tabla in CATALOGOS and "nombre" in cols:
            objetivos.append(("nombre", CATALOGOS[tabla]))
        for col, mapa in objetivos:
            n = 0
            for viejo, nuevo in mapa.items():
                cur.execute(f'UPDATE "{tabla}" SET "{col}" = ? WHERE "{col}" = ?', (nuevo, viejo))
                n += cur.rowcount or 0
            if n:
                log.append(f"{tabla}.{col}: {n}")
    conn.commit()


def _catalogos_pg(conn, log):
    """En PG catalogo_sector/catalogo_centro son vistas: actualizar a traves de ellas."""
    cur = conn.cursor()
    for vista, mapa in CATALOGOS.items():
        try:
            for viejo, nuevo in mapa.items():
                cur.execute(f'UPDATE "{vista}" SET nombre = ? WHERE nombre = ?', (nuevo, viejo))
                if cur.rowcount:
                    log.append(f"{vista}.nombre: {cur.rowcount}")
            conn.commit()
        except Exception as e:  # la vista podria no ser actualizable
            conn.rollback()
            log.append(f"{vista}: no actualizable ({type(e).__name__})")


def up():
    from backend.core.db import get_db_connection, is_using_postgresql

    is_pg = is_using_postgresql()
    log = []
    with get_db_connection() as conn:
        _renombrar(conn, is_pg, log)
        if is_pg:
            _catalogos_pg(conn, log)
    if not is_pg:
        # SQLite: el stock vive en sap_data.db
        with get_db_connection("sap_data") as conn:
            _renombrar(conn, is_pg, log)
    for linea in log:
        print("  -", linea)
    print("Migration 101: sectores y nombres de centro con tildes")


def down():
    from backend.core.db import get_db_connection, is_using_postgresql

    global SECTORES, CENTROS, CATALOGOS
    SECTORES = {v: k for k, v in SECTORES.items()}
    CENTROS = {v: k for k, v in CENTROS.items()}
    CATALOGOS = {"catalogo_sector": SECTORES, "catalogo_centro": CENTROS}
    with get_db_connection() as conn:
        _renombrar(conn, is_using_postgresql(), [])


if __name__ == "__main__":
    up()
