#!/usr/bin/env python3
"""
Migración 012: Columnas de Respuesta para Consultas de Stock

Esta migración agrega columnas a decision_abastecimiento_fuentes para:
1. Almacenar respuestas de consultas de stock (cantidad confirmada, fecha, comentarios)
2. Registrar quién y cuándo respondió
3. Trackear el estado de la consulta
"""

import sqlite3
from pathlib import Path

# Ubicación de la BD
DB_PATH = Path("data/spm.db")


def get_db_path():
    """Obtener ruta de la base de datos."""
    if DB_PATH.exists():
        return DB_PATH
    alt_path = Path("backend/spm.db")
    if alt_path.exists():
        return alt_path
    raise FileNotFoundError(f"Base de datos no encontrada en {DB_PATH}")


def column_exists(cursor, table_name: str, column_name: str) -> bool:
    """Verificar si una columna existe en una tabla."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


def run_migration():
    """Ejecutar migración."""
    print(">> Migración 012: Columnas de Respuesta para Consultas de Stock")

    try:
        db_path = get_db_path()
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        return False

    print(f">> Conectando a {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        table_name = "decision_abastecimiento_fuentes"

        # Verificar que la tabla existe
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        if not cursor.fetchone():
            print(f"ERROR: Tabla {table_name} no existe. Ejecutar migración 005 primero.")
            return False

        # Columnas a agregar
        columns_to_add = [
            ("cantidad_confirmada", "REAL"),
            ("fecha_disponibilidad", "TEXT"),
            ("respuesta_comentario", "TEXT"),
            ("respondido_por", "TEXT"),
            ("respondido_at", "TEXT"),
            ("estado_consulta", "TEXT DEFAULT 'pendiente'"),
        ]

        added_count = 0
        for col_name, col_type in columns_to_add:
            # Extraer solo el nombre de la columna para verificar
            base_name = col_name
            if column_exists(cursor, table_name, base_name):
                print(f"   - Columna {base_name} ya existe, saltando...")
                continue

            print(f">> Agregando columna {base_name}...")
            try:
                cursor.execute(
                    f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                )
                added_count += 1
                print(f"   OK: Columna {base_name} agregada")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"   - Columna {base_name} ya existe")
                else:
                    raise

        conn.commit()

        # Crear índice para consultas pendientes
        print(">> Creando índice para estado_consulta...")
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_fuentes_estado_consulta
                ON decision_abastecimiento_fuentes(estado_consulta)
            """)
            conn.commit()
            print("   OK: Índice creado")
        except sqlite3.OperationalError:
            print("   - Índice ya existe")

        # Verificar columnas
        print(">> Verificando columnas...")
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"   Columnas actuales: {', '.join(columns[-6:])}")

        print(f"\n>> Migración 012 completada. {added_count} columnas agregadas.")
        return True

    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    success = run_migration()
    exit(0 if success else 1)
