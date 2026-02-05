#!/usr/bin/env python
"""
Carga los dashboards predefinidos desde data/dashboards/ a la base de datos.

Uso:
    python scripts/load_default_dashboards.py
    python scripts/load_default_dashboards.py --force  # Sobreescribe existentes
"""

import json
import os
import sys
import uuid
from pathlib import Path

# Agregar path del proyecto
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime


def get_db_path():
    """Obtener path de la base de datos"""
    base_dir = Path(__file__).parent.parent
    return base_dir / "data" / "spm.db"


def get_dashboards_dir():
    """Obtener directorio de dashboards predefinidos"""
    base_dir = Path(__file__).parent.parent
    return base_dir / "data" / "dashboards"


def load_default_dashboards(force: bool = False):
    """Carga los dashboards predefinidos"""
    import sqlite3

    db_path = get_db_path()
    dashboards_dir = get_dashboards_dir()

    if not db_path.exists():
        print(f"[ERROR] Base de datos no encontrada: {db_path}")
        return False

    if not dashboards_dir.exists():
        print(f"[ERROR] Directorio de dashboards no encontrado: {dashboards_dir}")
        return False

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Buscar archivos JSON
        json_files = list(dashboards_dir.glob("*.json"))
        print(f"Encontrados {len(json_files)} dashboards predefinidos")

        for json_file in json_files:
            print(f"\nProcesando: {json_file.name}")

            with open(json_file, "r", encoding="utf-8") as f:
                dashboard_data = json.load(f)

            nombre = dashboard_data.get("nombre", json_file.stem)
            dashboard_uuid = f"default-{json_file.stem}"

            # Verificar si ya existe
            cursor.execute(
                "SELECT id FROM dashboard WHERE uuid = ?",
                (dashboard_uuid,),
            )
            existing = cursor.fetchone()

            if existing and not force:
                print(f"  - Ya existe (use --force para sobreescribir)")
                continue

            now = datetime.utcnow().isoformat() + "Z"

            if existing:
                # Actualizar existente
                cursor.execute(
                    """UPDATE dashboard SET
                       nombre = ?, descripcion = ?, tipo = ?, icono = ?, color = ?,
                       es_publico = 1, updated_at = ?
                       WHERE uuid = ?""",
                    (
                        nombre,
                        dashboard_data.get("descripcion"),
                        dashboard_data.get("tipo", "spreadsheet"),
                        dashboard_data.get("icono", "table"),
                        dashboard_data.get("color", "#3b82f6"),
                        now,
                        dashboard_uuid,
                    ),
                )
                dashboard_id = existing["id"]

                # Eliminar sheets y datasources existentes
                cursor.execute("DELETE FROM dashboard_sheet WHERE dashboard_id = ?", (dashboard_id,))
                cursor.execute("DELETE FROM dashboard_datasource WHERE dashboard_id = ?", (dashboard_id,))

                print(f"  + Actualizado: {nombre}")
            else:
                # Crear nuevo
                cursor.execute(
                    """INSERT INTO dashboard
                       (uuid, nombre, descripcion, owner_id, grupo_id, tipo, icono, color,
                        es_publico, version, created_at, updated_at)
                       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 1, 1, ?, ?)""",
                    (
                        dashboard_uuid,
                        nombre,
                        dashboard_data.get("descripcion"),
                        "system",
                        dashboard_data.get("tipo", "spreadsheet"),
                        dashboard_data.get("icono", "table"),
                        dashboard_data.get("color", "#3b82f6"),
                        now,
                        now,
                    ),
                )
                dashboard_id = cursor.lastrowid
                print(f"  + Creado: {nombre}")

            # Crear sheets
            sheets = dashboard_data.get("sheets", [])
            for idx, sheet in enumerate(sheets):
                sheet_data = sheet.get("data", {})
                cursor.execute(
                    """INSERT INTO dashboard_sheet
                       (dashboard_id, sheet_index, nombre, data, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        dashboard_id,
                        idx,
                        sheet.get("nombre", f"Hoja {idx + 1}"),
                        json.dumps(sheet_data),
                        now,
                        now,
                    ),
                )
                print(f"    - Hoja: {sheet.get('nombre', f'Hoja {idx + 1}')}")

            # Crear datasources
            datasources = dashboard_data.get("datasources", [])
            for ds in datasources:
                cursor.execute(
                    """INSERT INTO dashboard_datasource
                       (dashboard_id, nombre, tipo, filtros, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        dashboard_id,
                        ds.get("nombre"),
                        ds.get("tipo"),
                        json.dumps(ds.get("filtros", {})),
                        now,
                        now,
                    ),
                )
                print(f"    - Fuente: {ds.get('nombre')}")

        conn.commit()
        print(f"\n[OK] Dashboards predefinidos cargados exitosamente")
        return True

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error al cargar dashboards: {e}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    force = "--force" in sys.argv
    load_default_dashboards(force)
