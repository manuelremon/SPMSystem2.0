#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para importar catalogo de materiales desde Excel a BD SQLite separada.

Fuente: data/Catalogo materiales .xlsx
Destino: data/catalogo_materiales.db

IMPORTANTE:
- Este script NO modifica spm.db ni sap_data.db
- El archivo Excel fuente NO es eliminado
- El script es idempotente (puede re-ejecutarse sin duplicar datos)

Autor: Claude Code
Fecha: 2025-12-06
"""

import sqlite3
import sys
from pathlib import Path

# Agregar el directorio raíz al path para imports
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas no está instalado. Ejecuta: pip install pandas openpyxl")
    sys.exit(1)

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl no está instalado. Ejecuta: pip install openpyxl")
    sys.exit(1)


# Rutas
EXCEL_PATH = ROOT_DIR / "data" / "Catalogo materiales .xlsx"
DB_PATH = ROOT_DIR / "data" / "catalogo_materiales.db"
BACKUP_DB_PATH = ROOT_DIR / "data" / "catalogo_materiales_backup.db"


def crear_tabla(conn: sqlite3.Connection) -> None:
    """Crea la tabla de materiales con la estructura definida."""
    cursor = conn.cursor()

    # Eliminar tabla si existe (para re-importación limpia)
    cursor.execute("DROP TABLE IF EXISTS materiales")

    # Crear tabla
    cursor.execute(
        """
        CREATE TABLE materiales (
            codigo TEXT PRIMARY KEY,
            descripcion TEXT NOT NULL,
            descripcion_larga TEXT,
            grupo_articulos INTEGER,
            unidad_medida TEXT DEFAULT 'UN',
            precio_usd REAL,
            activo INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """
    )

    # Crear índices para búsquedas rápidas
    cursor.execute("CREATE INDEX idx_materiales_descripcion ON materiales(descripcion)")
    cursor.execute("CREATE INDEX idx_materiales_grupo ON materiales(grupo_articulos)")
    cursor.execute("CREATE INDEX idx_materiales_activo ON materiales(activo)")

    conn.commit()
    print("✓ Tabla 'materiales' creada con índices")


def leer_excel() -> pd.DataFrame:
    """Lee el archivo Excel y retorna un DataFrame."""
    if not EXCEL_PATH.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {EXCEL_PATH}")

    print(f"Leyendo Excel: {EXCEL_PATH}")
    print("  (Esto puede tardar unos segundos debido al tamaño del archivo...)")

    # Leer Excel
    df = pd.read_excel(EXCEL_PATH, engine="openpyxl")

    print(f"  Filas totales en Excel: {len(df):,}")

    return df


def procesar_datos(df: pd.DataFrame) -> list:
    """
    Procesa el DataFrame para:
    1. Filtrar solo filas con Material válido
    2. Agrupar por Material
    3. Concatenar líneas de "Texto completo"
    4. Convertir precios al formato correcto

    Returns:
        Lista de tuplas (codigo, descripcion, descripcion_larga, grupo, um, precio)
    """
    # Mapeo de columnas (basado en el Excel proporcionado)
    COL_MATERIAL = "Material"
    COL_TEXTO_BREVE = "Texto breve material"
    COL_GRUPO = "Grupo de Artículos"
    COL_UM = "Unidad de Medida"
    COL_TEXTO_COMPLETO = "Texto completo material Español"
    COL_PRECIO = "Precio USD"

    # Verificar que existan las columnas
    columnas_requeridas = [COL_MATERIAL, COL_TEXTO_BREVE]
    for col in columnas_requeridas:
        if col not in df.columns:
            raise ValueError(f"Columna requerida no encontrada: {col}")

    # Filtrar filas donde Material NO es nulo
    df_valid = df[df[COL_MATERIAL].notna()].copy()
    print(f"  Filas con Material válido: {len(df_valid):,}")

    # Convertir Material a string (para evitar notación científica)
    df_valid[COL_MATERIAL] = df_valid[COL_MATERIAL].apply(
        lambda x: str(int(x)) if pd.notna(x) and isinstance(x, (int, float)) else str(x)
    )

    # Agrupar por Material
    materiales_unicos = df_valid[COL_MATERIAL].unique()
    print(f"  Materiales únicos: {len(materiales_unicos):,}")

    # Procesar cada material
    resultados = []
    errores = 0

    for idx, material in enumerate(materiales_unicos):
        if idx % 5000 == 0 and idx > 0:
            print(f"  Procesando... {idx:,}/{len(materiales_unicos):,}")

        try:
            # Obtener todas las filas de este material
            filas = df_valid[df_valid[COL_MATERIAL] == material]

            # Tomar valores de la primera fila
            primera = filas.iloc[0]

            codigo = str(material).strip()
            descripcion = (
                str(primera.get(COL_TEXTO_BREVE, "")).strip()
                if pd.notna(primera.get(COL_TEXTO_BREVE))
                else ""
            )
            grupo = int(primera.get(COL_GRUPO)) if pd.notna(primera.get(COL_GRUPO)) else None
            um = str(primera.get(COL_UM, "UN")).strip() if pd.notna(primera.get(COL_UM)) else "UN"

            # Precio: convertir formato europeo (7259,56) a float
            precio_raw = primera.get(COL_PRECIO)
            if pd.notna(precio_raw):
                if isinstance(precio_raw, str):
                    # Reemplazar coma por punto
                    precio = float(precio_raw.replace(".", "").replace(",", "."))
                else:
                    precio = float(precio_raw)
            else:
                precio = None

            # Concatenar todas las líneas de "Texto completo"
            lineas_texto = []
            for _, fila in filas.iterrows():
                texto = fila.get(COL_TEXTO_COMPLETO)
                if pd.notna(texto) and str(texto).strip():
                    lineas_texto.append(str(texto).strip())

            descripcion_larga = "\n".join(lineas_texto) if lineas_texto else None

            resultados.append((codigo, descripcion, descripcion_larga, grupo, um, precio))

        except Exception as e:
            errores += 1
            if errores <= 5:
                print(f"  ⚠ Error procesando material {material}: {e}")

    if errores > 5:
        print(f"  ⚠ Se omitieron {errores - 5} errores adicionales")

    print(f"  Materiales procesados correctamente: {len(resultados):,}")

    return resultados


def insertar_materiales(conn: sqlite3.Connection, materiales: list) -> int:
    """Inserta los materiales en la base de datos."""
    cursor = conn.cursor()

    # Insertar en lotes para mejor rendimiento
    BATCH_SIZE = 1000
    insertados = 0

    for i in range(0, len(materiales), BATCH_SIZE):
        batch = materiales[i : i + BATCH_SIZE]
        cursor.executemany(
            """
            INSERT OR REPLACE INTO materiales
            (codigo, descripcion, descripcion_larga, grupo_articulos, unidad_medida, precio_usd)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            batch,
        )
        insertados += len(batch)

        if insertados % 10000 == 0:
            print(f"  Insertados: {insertados:,}/{len(materiales):,}")

    conn.commit()
    return insertados


def verificar_integridad(conn: sqlite3.Connection) -> dict:
    """Verifica la integridad de los datos importados."""
    cursor = conn.cursor()

    stats = {}

    # Total de materiales
    cursor.execute("SELECT COUNT(*) FROM materiales")
    stats["total"] = cursor.fetchone()[0]

    # Materiales con precio
    cursor.execute("SELECT COUNT(*) FROM materiales WHERE precio_usd IS NOT NULL")
    stats["con_precio"] = cursor.fetchone()[0]

    # Rango de precios
    cursor.execute(
        "SELECT MIN(precio_usd), MAX(precio_usd) FROM materiales WHERE precio_usd IS NOT NULL"
    )
    row = cursor.fetchone()
    stats["precio_min"] = row[0]
    stats["precio_max"] = row[1]

    # Materiales con descripción larga
    cursor.execute("SELECT COUNT(*) FROM materiales WHERE descripcion_larga IS NOT NULL")
    stats["con_desc_larga"] = cursor.fetchone()[0]

    # Grupos de artículos únicos
    cursor.execute(
        "SELECT COUNT(DISTINCT grupo_articulos) FROM materiales WHERE grupo_articulos IS NOT NULL"
    )
    stats["grupos_unicos"] = cursor.fetchone()[0]

    # Verificar que no haya descripciones vacías
    cursor.execute("SELECT COUNT(*) FROM materiales WHERE descripcion IS NULL OR descripcion = ''")
    stats["sin_descripcion"] = cursor.fetchone()[0]

    return stats


def main():
    """Función principal de importación."""
    print("=" * 60)
    print("IMPORTACIÓN DE CATÁLOGO DE MATERIALES")
    print("=" * 60)
    print()

    # Verificar que existe el Excel
    if not EXCEL_PATH.exists():
        print(f"ERROR: No se encontró el archivo Excel: {EXCEL_PATH}")
        return 1

    # Crear backup si ya existe la BD
    if DB_PATH.exists():
        import shutil

        print("Creando backup de BD existente...")
        shutil.copy2(DB_PATH, BACKUP_DB_PATH)
        print(f"  Backup guardado en: {BACKUP_DB_PATH}")

    try:
        # 1. Leer Excel
        print("\n[1/4] Leyendo archivo Excel...")
        df = leer_excel()

        # 2. Procesar datos
        print("\n[2/4] Procesando datos...")
        materiales = procesar_datos(df)

        if not materiales:
            print("ERROR: No se encontraron materiales para importar")
            return 1

        # 3. Crear BD e insertar datos
        print("\n[3/4] Creando base de datos e insertando materiales...")
        conn = sqlite3.connect(DB_PATH)
        crear_tabla(conn)
        insertados = insertar_materiales(conn, materiales)
        print(f"✓ Insertados: {insertados:,} materiales")

        # 4. Verificar integridad
        print("\n[4/4] Verificando integridad de datos...")
        stats = verificar_integridad(conn)

        conn.close()

        # Mostrar resumen
        print("\n" + "=" * 60)
        print("RESUMEN DE IMPORTACIÓN")
        print("=" * 60)
        print(f"  Base de datos: {DB_PATH}")
        print(f"  Total materiales: {stats['total']:,}")
        print(f"  Con precio: {stats['con_precio']:,}")
        print(f"  Rango precios: USD {stats['precio_min']:.2f} - {stats['precio_max']:.2f}")
        print(f"  Con descripción larga: {stats['con_desc_larga']:,}")
        print(f"  Grupos de artículos: {stats['grupos_unicos']}")
        print(f"  Sin descripción: {stats['sin_descripcion']}")

        # Verificar estadísticas esperadas
        if stats["total"] < 40000:
            print(
                f"\n⚠ ADVERTENCIA: Se esperaban ~44,461 materiales pero solo hay {stats['total']:,}"
            )
        else:
            print("\n✓ IMPORTACIÓN COMPLETADA EXITOSAMENTE")

        return 0

    except Exception as e:
        print(f"\nERROR durante la importación: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
