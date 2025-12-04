#!/usr/bin/env python3
"""Simple database inspection without encoding issues."""

import sqlite3

DB_PATH = "src/backend/core/data/spm.db"

try:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    print("=" * 60)
    print("TABLAS EN LA BASE DE DATOS")
    print("=" * 60)

    for table in tables:
        table_name = table[0]
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"  {table_name}: {count} registros")

    print("\n" + "=" * 60)
    print("DATOS EN TABLA: solicitudes")
    print("=" * 60)

    cursor.execute(
        """
        SELECT id, titulo, estado, usuario_id, centro
        FROM solicitudes
        LIMIT 5
    """
    )
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"  ID: {row['id']}, Estado: {row['estado']}, Centro: {row['centro']}")
    else:
        print("  [SIN DATOS]")

    print("\n" + "=" * 60)
    print("DATOS EN TABLA: materiales")
    print("=" * 60)

    cursor.execute(
        """
        SELECT id, nombre, codigo
        FROM materiales
        LIMIT 5
    """
    )
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"  ID: {row['id']}, Nombre: {row['nombre']}")
    else:
        print("  [SIN DATOS]")

    print("\n" + "=" * 60)
    print("DATOS EN TABLA: usuarios")
    print("=" * 60)

    cursor.execute(
        """
        SELECT id, username, email
        FROM usuarios
        LIMIT 5
    """
    )
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"  ID: {row['id']}, Username: {row['username']}")
    else:
        print("  [SIN DATOS]")

    print("\n" + "=" * 60)
    print("ESTADISTICAS POR ESTADO")
    print("=" * 60)

    cursor.execute(
        """
        SELECT estado, COUNT(*) as cantidad
        FROM solicitudes
        GROUP BY estado
    """
    )
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"  {row['estado']}: {row['cantidad']}")
    else:
        print("  [SIN DATOS]")

    conn.close()
    print("\n" + "=" * 60)
    print("INSPECCION COMPLETADA")
    print("=" * 60)

except Exception as e:
    print(f"ERROR: {e}")
    import traceback

    traceback.print_exc()
