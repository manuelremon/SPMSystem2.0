"""
Script para importar datos MRP desde los archivos Excel a SQLite

Archivos fuente:
- docs/BBDD.xlsx: Materiales MRP con parametros (stock seguridad, punto pedido, etc)
- docs/stock.xlsx: Stock actual por centro/almacen/material
- docs/Copia de ZPEN ME2M SAP.xlsx: Pedidos en curso
- docs/consumo historico.xlsx: Consumo historico para calcular promedio mensual

Ejecutar desde el directorio raiz:
    python backend_v2/scripts/import_mrp_data.py
"""

import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Rutas a los archivos
ROOT_DIR = Path(__file__).parent.parent.parent
BBDD_PATH = ROOT_DIR / "docs" / "BBDD.xlsx"
STOCK_PATH = ROOT_DIR / "docs" / "stock.xlsx"
PEDIDOS_PATH = ROOT_DIR / "docs" / "Copia de ZPEN ME2M SAP.xlsx"
CONSUMO_PATH = ROOT_DIR / "docs" / "consumo historico.xlsx"
DB_PATH = ROOT_DIR / "backend_v2" / "spm.db"


def create_mrp_table(conn: sqlite3.Connection) -> None:
    """Crear tabla materiales_mrp si no existe"""
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS materiales_mrp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sector TEXT NOT NULL,
            almacen INTEGER NOT NULL,
            centro INTEGER NOT NULL,
            codigo_material TEXT NOT NULL,
            descripcion TEXT,
            stock_seguridad INTEGER DEFAULT 0,
            punto_pedido INTEGER DEFAULT 0,
            stock_maximo INTEGER DEFAULT 0,
            -- Datos reales de otros archivos
            stock_actual INTEGER DEFAULT 0,
            pedidos_en_curso INTEGER DEFAULT 0,
            consumo_promedio_mensual REAL DEFAULT 0,
            lead_time_dias INTEGER DEFAULT 30,
            -- Campos adicionales de stock.xlsx
            categoria_planificacion TEXT,
            sub_categoria TEXT,
            critico TEXT,
            inmovilizado TEXT,
            ubicacion TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(centro, almacen, codigo_material)
        )
    """
    )

    # Indices para busquedas rapidas
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mrp_centro ON materiales_mrp(centro)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mrp_almacen ON materiales_mrp(almacen)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mrp_sector ON materiales_mrp(sector)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_mrp_codigo ON materiales_mrp(codigo_material)")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_mrp_categoria ON materiales_mrp(categoria_planificacion)"
    )

    conn.commit()
    print("[OK] Tabla materiales_mrp creada/verificada")


def load_stock_data(stock_path: Path) -> pd.DataFrame:
    """Cargar datos de stock actual"""
    print(f"Leyendo stock: {stock_path}")
    df = pd.read_excel(stock_path, sheet_name="Export")

    # Renombrar y seleccionar columnas relevantes
    df = df.rename(
        columns={
            "Centro": "centro",
            "Almacén": "almacen",
            "Material": "codigo_material",
            "Stock": "stock_actual",
            "Planificación_Categorías": "categoria_planificacion",
            "Sub_Categorías": "sub_categoria",
            "Critico": "critico",
            "Inmovilizado": "inmovilizado",
            "Ubicacion": "ubicacion",
        }
    )

    # Convertir tipos - IMPORTANTE: Material viene como float, convertir a int primero
    df["centro"] = pd.to_numeric(df["centro"], errors="coerce").fillna(0).astype(int)
    df["almacen"] = pd.to_numeric(df["almacen"], errors="coerce").fillna(0).astype(int)
    # Convertir Material: float -> int -> string (evita notacion cientifica)
    df["codigo_material"] = (
        pd.to_numeric(df["codigo_material"], errors="coerce").fillna(0).astype(np.int64).astype(str)
    )
    df["stock_actual"] = pd.to_numeric(df["stock_actual"], errors="coerce").fillna(0).astype(int)

    # Agrupar por centro/almacen/material (puede haber duplicados por lote)
    stock_agg = (
        df.groupby(["centro", "almacen", "codigo_material"])
        .agg(
            {
                "stock_actual": "sum",
                "categoria_planificacion": "first",
                "sub_categoria": "first",
                "critico": "first",
                "inmovilizado": "first",
                "ubicacion": "first",
            }
        )
        .reset_index()
    )

    print(f"  -> {len(stock_agg):,} registros de stock (agrupados)")
    return stock_agg


def load_pedidos_data(pedidos_path: Path) -> pd.DataFrame:
    """Cargar pedidos en curso"""
    print(f"Leyendo pedidos: {pedidos_path}")
    df = pd.read_excel(pedidos_path, sheet_name="ZPEN ME2M SAP")

    df = df.rename(
        columns={
            "Centro": "centro",
            "Almacen": "almacen",
            "MATERIAL": "codigo_material",
            "SALDO PEND": "cantidad_pendiente",
        }
    )

    df["centro"] = pd.to_numeric(df["centro"], errors="coerce").fillna(0).astype(int)
    df["almacen"] = pd.to_numeric(df["almacen"], errors="coerce").fillna(0).astype(int)
    df["codigo_material"] = (
        pd.to_numeric(df["codigo_material"], errors="coerce").fillna(0).astype(np.int64).astype(str)
    )
    df["cantidad_pendiente"] = pd.to_numeric(df["cantidad_pendiente"], errors="coerce").fillna(0)

    # Sumar pedidos por centro/almacen/material
    pedidos_agg = (
        df.groupby(["centro", "almacen", "codigo_material"])
        .agg({"cantidad_pendiente": "sum"})
        .reset_index()
    )
    pedidos_agg = pedidos_agg.rename(columns={"cantidad_pendiente": "pedidos_en_curso"})

    print(f"  -> {len(pedidos_agg):,} materiales con pedidos en curso")
    return pedidos_agg


def load_consumo_data(consumo_path: Path) -> pd.DataFrame:
    """Cargar consumo historico y calcular promedio mensual"""
    print(f"Leyendo consumo historico: {consumo_path}")
    df = pd.read_excel(consumo_path, sheet_name="consumo historico")

    df = df.rename(
        columns={
            "Fecha": "fecha",
            "Centro": "centro",
            "Almacen": "almacen",
            "Cantidad": "cantidad",
            "Material": "codigo_material",
        }
    )

    df["centro"] = pd.to_numeric(df["centro"], errors="coerce").fillna(0).astype(int)
    df["almacen"] = pd.to_numeric(df["almacen"], errors="coerce").fillna(0).astype(int)
    df["codigo_material"] = (
        pd.to_numeric(df["codigo_material"], errors="coerce").fillna(0).astype(np.int64).astype(str)
    )
    df["cantidad"] = pd.to_numeric(df["cantidad"], errors="coerce").fillna(0)
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")

    # Calcular rango de fechas para determinar meses
    fecha_min = df["fecha"].min()
    fecha_max = df["fecha"].max()

    if pd.notna(fecha_min) and pd.notna(fecha_max):
        meses = max(1, (fecha_max - fecha_min).days / 30)
    else:
        meses = 6  # Default 6 meses

    print(f"  -> Periodo de consumo: {fecha_min} a {fecha_max} ({meses:.1f} meses)")

    # Sumar consumo total y calcular promedio mensual
    consumo_agg = (
        df.groupby(["centro", "almacen", "codigo_material"]).agg({"cantidad": "sum"}).reset_index()
    )
    consumo_agg["consumo_promedio_mensual"] = (consumo_agg["cantidad"] / meses).round(2)
    consumo_agg = consumo_agg.drop(columns=["cantidad"])

    print(f"  -> {len(consumo_agg):,} materiales con consumo historico")
    return consumo_agg


def import_mrp_data(conn: sqlite3.Connection) -> int:
    """Importar y cruzar datos de todos los archivos"""

    # 1. Cargar materiales MRP base (BBDD.xlsx)
    print(f"Leyendo BBDD materiales MRP: {BBDD_PATH}")
    df_mrp = pd.read_excel(BBDD_PATH, sheet_name="BBDD")

    df_mrp = df_mrp.rename(
        columns={
            "Sector": "sector",
            "Almacen": "almacen",
            "Centro": "centro",
            "Codigo Material": "codigo_material",
            "Descripcion": "descripcion",
            "Stock de seguridad": "stock_seguridad",
            "Punto de pedido": "punto_pedido",
            "Stock maximo": "stock_maximo",
        }
    )

    df_mrp["centro"] = pd.to_numeric(df_mrp["centro"], errors="coerce").fillna(0).astype(int)
    df_mrp["almacen"] = pd.to_numeric(df_mrp["almacen"], errors="coerce").fillna(0).astype(int)
    df_mrp["codigo_material"] = (
        pd.to_numeric(df_mrp["codigo_material"], errors="coerce")
        .fillna(0)
        .astype(np.int64)
        .astype(str)
    )
    df_mrp["descripcion"] = df_mrp["descripcion"].fillna("Sin descripcion")
    df_mrp["stock_seguridad"] = (
        pd.to_numeric(df_mrp["stock_seguridad"], errors="coerce").fillna(0).astype(int)
    )
    df_mrp["punto_pedido"] = (
        pd.to_numeric(df_mrp["punto_pedido"], errors="coerce").fillna(0).astype(int)
    )
    df_mrp["stock_maximo"] = (
        pd.to_numeric(df_mrp["stock_maximo"], errors="coerce").fillna(0).astype(int)
    )

    print(f"  -> {len(df_mrp):,} materiales MRP base")

    # 2. Cargar datos adicionales
    df_stock = load_stock_data(STOCK_PATH)
    df_pedidos = load_pedidos_data(PEDIDOS_PATH)
    df_consumo = load_consumo_data(CONSUMO_PATH)

    # 3. Cruzar datos
    print("\nCruzando datos...")

    # Merge con stock
    df_mrp = df_mrp.merge(
        df_stock[
            [
                "centro",
                "almacen",
                "codigo_material",
                "stock_actual",
                "categoria_planificacion",
                "sub_categoria",
                "critico",
                "inmovilizado",
                "ubicacion",
            ]
        ],
        on=["centro", "almacen", "codigo_material"],
        how="left",
    )

    # Merge con pedidos en curso
    df_mrp = df_mrp.merge(
        df_pedidos[["centro", "almacen", "codigo_material", "pedidos_en_curso"]],
        on=["centro", "almacen", "codigo_material"],
        how="left",
    )

    # Merge con consumo
    df_mrp = df_mrp.merge(
        df_consumo[["centro", "almacen", "codigo_material", "consumo_promedio_mensual"]],
        on=["centro", "almacen", "codigo_material"],
        how="left",
    )

    # Rellenar NaN con defaults
    df_mrp["stock_actual"] = df_mrp["stock_actual"].fillna(0).astype(int)
    df_mrp["pedidos_en_curso"] = df_mrp["pedidos_en_curso"].fillna(0).astype(int)
    df_mrp["consumo_promedio_mensual"] = df_mrp["consumo_promedio_mensual"].fillna(0).round(2)
    df_mrp["lead_time_dias"] = 30  # Default, podria venir de otro archivo

    # Estadisticas de cruce
    con_stock = (df_mrp["stock_actual"] > 0).sum()
    con_pedidos = (df_mrp["pedidos_en_curso"] > 0).sum()
    con_consumo = (df_mrp["consumo_promedio_mensual"] > 0).sum()

    print(f"  -> Materiales con stock actual: {con_stock:,}")
    print(f"  -> Materiales con pedidos en curso: {con_pedidos:,}")
    print(f"  -> Materiales con consumo historico: {con_consumo:,}")

    # 4. Insertar en BD
    print("\nInsertando en base de datos...")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM materiales_mrp")

    columns = [
        "sector",
        "almacen",
        "centro",
        "codigo_material",
        "descripcion",
        "stock_seguridad",
        "punto_pedido",
        "stock_maximo",
        "stock_actual",
        "pedidos_en_curso",
        "consumo_promedio_mensual",
        "lead_time_dias",
        "categoria_planificacion",
        "sub_categoria",
        "critico",
        "inmovilizado",
        "ubicacion",
    ]

    placeholders = ", ".join(["?" for _ in columns])
    insert_sql = (
        f"INSERT OR REPLACE INTO materiales_mrp ({', '.join(columns)}) VALUES ({placeholders})"
    )

    data_tuples = [
        tuple(row[col] if pd.notna(row[col]) else None for col in columns)
        for _, row in df_mrp.iterrows()
    ]
    cursor.executemany(insert_sql, data_tuples)
    conn.commit()

    return len(data_tuples)


def main():
    # Verificar archivos
    files_needed = [
        (BBDD_PATH, "BBDD materiales MRP"),
        (STOCK_PATH, "Stock actual"),
        (PEDIDOS_PATH, "Pedidos en curso"),
        (CONSUMO_PATH, "Consumo historico"),
    ]

    for path, desc in files_needed:
        if not path.exists():
            print(f"ERROR: No se encontro {desc}: {path}")
            sys.exit(1)

    print(f"Conectando a base de datos: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)

    try:
        create_mrp_table(conn)
        count = import_mrp_data(conn)
        print(f"\n[OK] Importados {count:,} materiales MRP correctamente")

        # Verificar
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM materiales_mrp")
        total = cursor.fetchone()[0]
        print(f"[OK] Total en base de datos: {total:,} registros")

        # Estadisticas de alertas
        print("\n=== ESTADISTICAS DE ALERTAS ===")

        # Materiales bajo stock de seguridad
        cursor.execute(
            """
            SELECT COUNT(*) FROM materiales_mrp
            WHERE stock_actual < stock_seguridad AND stock_seguridad > 0
        """
        )
        bajo_seguridad = cursor.fetchone()[0]
        print(f"  Materiales bajo stock de seguridad: {bajo_seguridad:,}")

        # Materiales en punto de pedido
        cursor.execute(
            """
            SELECT COUNT(*) FROM materiales_mrp
            WHERE stock_actual <= punto_pedido AND punto_pedido > 0 AND stock_actual >= stock_seguridad
        """
        )
        en_punto_pedido = cursor.fetchone()[0]
        print(f"  Materiales en punto de pedido: {en_punto_pedido:,}")

        # Materiales con pedidos en curso
        cursor.execute("SELECT COUNT(*) FROM materiales_mrp WHERE pedidos_en_curso > 0")
        con_pedidos = cursor.fetchone()[0]
        print(f"  Materiales con pedidos en curso: {con_pedidos:,}")

        # Distribucion por centro
        print("\nDistribucion por centro:")
        cursor.execute(
            "SELECT centro, COUNT(*) FROM materiales_mrp GROUP BY centro ORDER BY COUNT(*) DESC LIMIT 10"
        )
        for row in cursor.fetchall():
            print(f"  Centro {row[0]}: {row[1]:,} materiales")

    finally:
        conn.close()

    print("\n[OK] Importacion completada!")


if __name__ == "__main__":
    main()
