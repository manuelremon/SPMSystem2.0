#!/usr/bin/env python
"""
Verificar si existen asignaciones de planificadores.
"""

import sqlite3

DB_PATH = "src/backend/core/data/spm.db"

with sqlite3.connect(DB_PATH) as con:
    con.row_factory = lambda cursor, row: {
        col[0]: row[idx] for idx, col in enumerate(cursor.description)
    }

    print("=" * 60)
    print("ASIGNACIONES DE PLANIFICADORES")
    print("=" * 60)

    # Ver tabla planificador_asignaciones
    rows = con.execute("SELECT * FROM planificador_asignaciones").fetchall()
    print(f"\nTotal registros: {len(rows)}")

    if rows:
        for row in rows:
            print(f"\n  Centro: {row.get('centro')}")
            print(f"  Sector: {row.get('sector')}")
            print(f"  Almacén Virtual: {row.get('almacen_virtual')}")
            print(f"  Planificador: {row.get('planificador_id')}")
            print(f"  Usuario ID: {row.get('usuario_id')}")
    else:
        print("\n  (vacía - no hay asignaciones)")

    # Ver tabla planificadores
    print("\n" + "=" * 60)
    print("PLANIFICADORES")
    print("=" * 60)

    planners = con.execute("SELECT * FROM planificadores").fetchall()
    print(f"\nTotal registros: {len(planners)}")

    if planners:
        for p in planners:
            print(f"\n  Usuario ID: {p.get('usuario_id')}")
            user = con.execute(
                "SELECT nombre, sector FROM usuarios WHERE id_spm=?", (p.get("usuario_id"),)
            ).fetchone()
            if user:
                print(f"  Nombre: {user.get('nombre')}")
                print(f"  Sector: {user.get('sector')}")
    else:
        print("\n  (vacía - no hay planificadores)")

    # Ver catálogos
    print("\n" + "=" * 60)
    print("CATÁLOGOS DISPONIBLES")
    print("=" * 60)

    centros = con.execute("SELECT DISTINCT nombre FROM catalog_centros ORDER BY nombre").fetchall()
    print(f"\nCentros ({len(centros)}):")
    for c in centros:
        print(f"  - {c.get('nombre')}")

    sectores = con.execute(
        "SELECT DISTINCT nombre FROM catalog_sectores ORDER BY nombre"
    ).fetchall()
    print(f"\nSectores ({len(sectores)}):")
    for s in sectores:
        print(f"  - {s.get('nombre')}")

    almacenes = con.execute(
        "SELECT DISTINCT nombre FROM catalog_almacenes ORDER BY nombre"
    ).fetchall()
    print(f"\nAlmacenes ({len(almacenes)}):")
    for a in almacenes:
        print(f"  - {a.get('nombre')}")
