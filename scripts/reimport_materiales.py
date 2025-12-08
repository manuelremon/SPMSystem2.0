#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para reimportar materiales desde Excel con soporte para estructura multi-fila.

El Excel de SAP tiene una estructura donde la descripción larga se divide en múltiples filas:
- Fila 1: Material=1000000049, Texto="JUNTA ESPIROMETALICA PARA BRIDAS."
- Fila 2: Material=NaN, Texto="ESTILO: CON ANILL.CENTRADOR E INTERIOR."
- Fila 3: Material=NaN, Texto="DIAMETRO NOMINAL DE LA BRIDA: 12"."
- ... continúa hasta que aparece otro Material != NaN
"""

import sqlite3
import sys
from pathlib import Path

import pandas as pd

# Configurar encoding para Windows
if sys.platform == "win32":
    import codecs

    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer, "strict")
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.buffer, "strict")

# Rutas
EXCEL_PATH = Path("C:/Users/MANUE/SPMv2.0/data/Catalogo materiales .xlsx")
DB_PATH = Path("C:/Users/MANUE/SPMv2.0/data/catalogo_materiales.db")


def parse_excel_multirow(excel_path: Path) -> list[dict]:
    """
    Parsea el Excel con estructura multi-fila.

    Retorna lista de materiales con descripción larga concatenada.
    """
    print(f"[INFO] Leyendo Excel: {excel_path}")
    df = pd.read_excel(excel_path)

    print(f"[INFO] Total filas en Excel: {len(df)}")
    print(f"[INFO] Columnas: {df.columns.tolist()}")

    materiales = []
    current_material = None

    for idx, row in df.iterrows():
        material_code = row["Material"]
        texto_completo = row["Texto completo material Español"]

        # Si Material tiene valor, es un nuevo material
        if pd.notna(material_code):
            # Guardar material anterior si existe
            if current_material is not None:
                materiales.append(current_material)

            # Iniciar nuevo material
            current_material = {
                "codigo": str(int(material_code)),  # Convertir de float a int a str
                "descripcion": (
                    str(row["Texto breve material"])
                    if pd.notna(row["Texto breve material"])
                    else ""
                ),
                "descripcion_larga": str(texto_completo) if pd.notna(texto_completo) else "",
                "grupo_articulos": (
                    int(row["Grupo de Artículos"]) if pd.notna(row["Grupo de Artículos"]) else None
                ),
                "unidad_medida": (
                    str(row["Unidad de Medida"]) if pd.notna(row["Unidad de Medida"]) else "UN"
                ),
                "precio_usd": float(row["Precio USD"]) if pd.notna(row["Precio USD"]) else None,
            }
        else:
            # Material es NaN, esta fila es continuación de la descripción larga
            if current_material is not None and pd.notna(texto_completo):
                # Agregar salto de línea y el texto adicional
                current_material["descripcion_larga"] += "\n" + str(texto_completo)

    # No olvidar el último material
    if current_material is not None:
        materiales.append(current_material)

    print(f"[INFO] Materiales parseados: {len(materiales)}")
    return materiales


def update_database(materiales: list[dict], db_path: Path):
    """
    Actualiza la base de datos con los materiales parseados.
    """
    print(f"\n[INFO] Actualizando base de datos: {db_path}")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    updated = 0
    inserted = 0
    errors = 0

    for mat in materiales:
        try:
            # Intentar UPDATE primero
            cur.execute(
                """
                UPDATE materiales
                SET descripcion = ?,
                    descripcion_larga = ?,
                    grupo_articulos = ?,
                    unidad_medida = ?,
                    precio_usd = ?
                WHERE codigo = ?
            """,
                (
                    mat["descripcion"],
                    mat["descripcion_larga"],
                    mat["grupo_articulos"],
                    mat["unidad_medida"],
                    mat["precio_usd"],
                    mat["codigo"],
                ),
            )

            if cur.rowcount > 0:
                updated += 1
            else:
                # Si no actualizó, insertar
                cur.execute(
                    """
                    INSERT INTO materiales (codigo, descripcion, descripcion_larga, grupo_articulos, unidad_medida, precio_usd, activo)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                    (
                        mat["codigo"],
                        mat["descripcion"],
                        mat["descripcion_larga"],
                        mat["grupo_articulos"],
                        mat["unidad_medida"],
                        mat["precio_usd"],
                    ),
                )
                inserted += 1

        except Exception as e:
            errors += 1
            print(f"[ERROR] Material {mat['codigo']}: {e}")

    conn.commit()
    conn.close()

    print("\n[RESULTADO]")
    print(f"  - Actualizados: {updated}")
    print(f"  - Insertados: {inserted}")
    print(f"  - Errores: {errors}")


def verify_sample(db_path: Path):
    """Verifica algunos materiales de muestra."""
    print("\n[VERIFICACIÓN] Muestra de materiales:")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Verificar el material 1000000049
    cur.execute(
        "SELECT codigo, descripcion, descripcion_larga FROM materiales WHERE codigo = '1000000049'"
    )
    row = cur.fetchone()

    if row:
        print(f"\nMaterial: {row['codigo']}")
        print(f"Descripción: {row['descripcion']}")
        print(f"Descripción larga ({len(row['descripcion_larga'])} chars):")
        print(row["descripcion_larga"][:500])
        if len(row["descripcion_larga"]) > 500:
            print("...")

    # Estadísticas generales
    cur.execute(
        "SELECT COUNT(*) as total, AVG(LENGTH(descripcion_larga)) as avg_len FROM materiales"
    )
    stats = cur.fetchone()
    print("\nEstadísticas:")
    print(f"  - Total materiales: {stats['total']}")
    print(f"  - Longitud promedio desc_larga: {stats['avg_len']:.1f} chars")

    conn.close()


def main():
    print("=" * 60)
    print("REIMPORTACIÓN DE MATERIALES CON DESCRIPCIÓN LARGA COMPLETA")
    print("=" * 60)

    if not EXCEL_PATH.exists():
        print(f"[ERROR] No se encuentra el Excel: {EXCEL_PATH}")
        return 1

    if not DB_PATH.exists():
        print(f"[ERROR] No se encuentra la base de datos: {DB_PATH}")
        return 1

    # Parsear Excel
    materiales = parse_excel_multirow(EXCEL_PATH)

    # Mostrar ejemplo
    if materiales:
        ejemplo = next((m for m in materiales if m["codigo"] == "1000000049"), materiales[0])
        print(f"\n[EJEMPLO] Material {ejemplo['codigo']}:")
        print(f"  Descripción: {ejemplo['descripcion']}")
        print(f"  Desc. larga: {ejemplo['descripcion_larga'][:200]}...")

    # Confirmar
    response = input("\n¿Proceder con la actualización? (s/N): ").lower()
    if response != "s":
        print("[INFO] Operación cancelada")
        return 0

    # Actualizar BD
    update_database(materiales, DB_PATH)

    # Verificar
    verify_sample(DB_PATH)

    print("\n[OK] Proceso completado")
    return 0


if __name__ == "__main__":
    sys.exit(main())
