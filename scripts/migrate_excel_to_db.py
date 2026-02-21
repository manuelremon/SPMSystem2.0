"""
Script de Migración: Excel → SQLite
====================================
Convierte archivos Excel de datos SAP a bases de datos SQLite.

Uso:
    python scripts/migrate_excel_to_db.py

Bases de datos generadas:
    - data/equivalentes.db  : Equivalencias de materiales
    - data/sap_data.db      : Stock, consumo histórico, pedidos SAP

Fecha: 2025-12-05
"""

import sqlite3
import sys
from pathlib import Path

# Agregar raíz del proyecto al path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas no está instalado.")
    print("Ejecuta: pip install pandas openpyxl")
    sys.exit(1)

# Rutas
DOCS_DIR = PROJECT_ROOT / "docs"
DATA_DIR = PROJECT_ROOT / "data"
XLSX_DIR = DATA_DIR / "xlsx"

# Configuración de archivos Excel y sus destinos
EXCEL_CONFIG = {
    # equivalentes.db - Base de datos de equivalencias de materiales
    "equivalentes.db": {
        "equivalencias_total_normalizado.xlsx": {
            "table": "equivalencias",
            "columns": {
                "Material_base": "material_base",
                "Texto breve base": "texto_breve_base",
                "Material equivalente": "material_equivalente",
                "Texto breve equivalente": "texto_breve_equivalente",
                "Tipo equiv.": "tipo_equiv",
                "Criterio": "criterio",
                "Motivo equivalencia": "motivo_equivalencia",
            },
            "indexes": [
                ("idx_equiv_material_base", "material_base"),
                ("idx_equiv_material_equiv", "material_equivalente"),
            ],
        }
    },
    # sap_data.db - Base de datos de datos SAP
    "sap_data.db": {
        "BBDD.xlsx": {
            "table": "materiales_bbdd",
            "columns": {
                "Sector": "sector",
                "Almacen": "almacen",
                "Centro": "centro",
                "Código Material": "codigo_material",
                "Codigo Material": "codigo_material",  # Variante sin tilde
                "Descripcion": "descripcion",
                "Descripción": "descripcion",  # Variante con tilde
                "Stock seguridad": "stock_seguridad",
                "Punto pedido": "punto_pedido",
                "Stock maximo": "stock_maximo",
                "Stock máximo": "stock_maximo",  # Variante con tilde
            },
            "indexes": [
                ("idx_bbdd_material", "codigo_material"),
                ("idx_bbdd_centro", "centro"),
            ],
        },
        "stock.xlsx": {
            "table": "stock",
            "columns": None,  # Auto-detectar columnas (archivo grande)
            "indexes": [
                ("idx_stock_centro", "centro"),
                ("idx_stock_almacen", "almacen"),
            ],
        },
        "consumo historico.xlsx": {
            "table": "consumo_historico",
            "columns": {
                "Fecha": "fecha",
                "Centro": "centro",
                "Almacen": "almacen",
                "Almacén": "almacen",  # Variante con tilde
                "Cantidad": "cantidad",
                "Material": "material",
                "Descripcion": "descripcion",
                "Descripción": "descripcion",  # Variante con tilde
            },
            "indexes": [
                ("idx_consumo_fecha", "fecha"),
                ("idx_consumo_material", "material"),
            ],
        },
        "Copia de ZPEN ME2M SAP.xlsx": {
            "table": "pedidos_sap",
            "columns": None,  # Auto-detectar columnas
            "indexes": [
                ("idx_pedidos_material", "material"),
                ("idx_pedidos_centro", "centro"),
            ],
        },
    },
}


def normalize_column_name(col: str) -> str:
    """Normaliza nombre de columna: sin espacios, lowercase, sin tildes."""
    import unicodedata

    # Remover tildes
    col = unicodedata.normalize("NFD", str(col))
    col = col.encode("ascii", "ignore").decode("utf-8")
    # Lowercase y reemplazar espacios
    col = col.lower().strip()
    col = col.replace(" ", "_")
    col = col.replace(".", "")
    return col


def read_excel_file(file_path: Path) -> pd.DataFrame:
    """Lee un archivo Excel y retorna un DataFrame."""
    print(f"  Leyendo: {file_path.name}...", end=" ", flush=True)
    try:
        df = pd.read_excel(file_path, engine="openpyxl")
        print(f"OK ({len(df):,} filas)")
        return df
    except Exception as e:
        print(f"ERROR: {e}")
        return None


def process_dataframe(df: pd.DataFrame, column_mapping: dict | None) -> pd.DataFrame:
    """Procesa DataFrame: renombra columnas y normaliza."""
    if column_mapping:
        # Renombrar columnas según mapeo
        rename_dict = {}
        for orig_col in df.columns:
            if orig_col in column_mapping:
                rename_dict[orig_col] = column_mapping[orig_col]
            else:
                rename_dict[orig_col] = normalize_column_name(orig_col)
        df = df.rename(columns=rename_dict)
    else:
        # Auto-normalizar nombres de columnas
        df.columns = [normalize_column_name(c) for c in df.columns]

    # Eliminar columnas duplicadas (mantener primera)
    df = df.loc[:, ~df.columns.duplicated()]

    return df


def create_database(db_path: Path, files_config: dict) -> bool:
    """Crea base de datos SQLite con tablas desde archivos Excel."""
    print(f"\n{'=' * 60}")
    print(f"Creando: {db_path.name}")
    print(f"{'=' * 60}")

    # Eliminar BD existente si existe
    if db_path.exists():
        print("  Eliminando BD existente...")
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    success = True

    for excel_file, config in files_config.items():
        # Buscar archivo en docs/ o data/xlsx/
        file_path = DOCS_DIR / excel_file
        if not file_path.exists():
            file_path = XLSX_DIR / excel_file
        if not file_path.exists():
            print(f"  ADVERTENCIA: No encontrado {excel_file}")
            continue

        # Leer Excel
        df = read_excel_file(file_path)
        if df is None:
            success = False
            continue

        # Procesar columnas
        df = process_dataframe(df, config.get("columns"))

        # Guardar en SQLite
        table_name = config["table"]
        print(f"  Guardando en tabla '{table_name}'...", end=" ", flush=True)
        try:
            df.to_sql(table_name, conn, if_exists="replace", index=False)
            print("OK")

            # Crear índices
            for idx_name, idx_col in config.get("indexes", []):
                # Verificar que la columna existe
                cursor = conn.execute(f"PRAGMA table_info({table_name})")
                columns = [row[1] for row in cursor.fetchall()]
                if idx_col in columns:
                    try:
                        conn.execute(
                            f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table_name}({idx_col})"
                        )
                        print(f"    Indice {idx_name} creado")
                    except sqlite3.OperationalError as e:
                        print(f"    Indice {idx_name}: {e}")
                else:
                    print(f"    Indice {idx_name}: columna '{idx_col}' no encontrada")

        except Exception as e:
            print(f"ERROR: {e}")
            success = False

    conn.commit()
    conn.close()

    # Mostrar tamaño final
    if db_path.exists():
        size_mb = db_path.stat().st_size / (1024 * 1024)
        print(f"  Tamaño final: {size_mb:.2f} MB")

    return success


def verify_databases():
    """Verifica las bases de datos creadas."""
    print(f"\n{'=' * 60}")
    print("Verificación de bases de datos")
    print(f"{'=' * 60}")

    for db_name in EXCEL_CONFIG.keys():
        db_path = DATA_DIR / db_name
        if not db_path.exists():
            print(f"\n{db_name}: NO ENCONTRADA")
            continue

        print(f"\n{db_name}:")
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]

        for table in tables:
            cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"  - {table}: {count:,} registros")

        conn.close()


def main():
    """Función principal de migración."""
    print("=" * 60)
    print("Migración Excel → SQLite")
    print("=" * 60)
    print(f"Directorio de datos: {DATA_DIR}")
    print(f"Directorio de Excel: {DOCS_DIR}")

    # Verificar que existan los archivos Excel
    print("\nVerificando archivos Excel...")
    all_files = []
    for db_config in EXCEL_CONFIG.values():
        all_files.extend(db_config.keys())

    missing = []
    for f in all_files:
        path = DOCS_DIR / f
        if path.exists():
            size_mb = path.stat().st_size / (1024 * 1024)
            print(f"  OK: {f} ({size_mb:.2f} MB)")
        else:
            path = XLSX_DIR / f
            if path.exists():
                size_mb = path.stat().st_size / (1024 * 1024)
                print(f"  OK: {f} ({size_mb:.2f} MB) [en xlsx/]")
            else:
                print(f"  FALTA: {f}")
                missing.append(f)

    if missing:
        print(f"\nADVERTENCIA: Faltan {len(missing)} archivos. Continuando con los disponibles...")

    # Crear bases de datos
    for db_name, files_config in EXCEL_CONFIG.items():
        db_path = DATA_DIR / db_name
        create_database(db_path, files_config)

    # Verificar resultados
    verify_databases()

    print("\n" + "=" * 60)
    print("Migracion completada!")
    print("=" * 60)


if __name__ == "__main__":
    main()
