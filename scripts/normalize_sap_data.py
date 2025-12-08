"""
Script de normalización de datos en sap_data.db

Problema: Los campos centro, almacen y material tienen formatos inconsistentes:
- stock tabla: REAL (1007.0, 1.0, 1000000006.0)
- otras tablas: INTEGER (1008, 1, 1000521238)

Objetivo: Normalizar todos los campos a TEXT con formato consistente:
- centro: "1008" (4 dígitos, sin padding)
- almacen: "0001" (4 dígitos, con padding de ceros)
- material: "1000000006" (sin ceros iniciales ni decimales)
"""

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


def normalize_centro(val) -> str:
    """Normaliza centro: 1008.0 → '1008', 1008 → '1008'"""
    if val is None:
        return ""
    return str(int(float(val)))


def normalize_almacen(val) -> str:
    """Normaliza almacen: 1.0 → '0001', 9004 → '9004'"""
    if val is None:
        return ""
    return str(int(float(val))).zfill(4)


def normalize_material(val) -> str:
    """Normaliza material: 1000000006.0 → '1000000006'"""
    if val is None:
        return ""
    return str(int(float(val)))


def backup_db(db_path: Path) -> Path:
    """Crea backup de la BD antes de modificar"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.parent / f"{db_path.stem}_backup_{timestamp}.db"
    shutil.copy(db_path, backup_path)
    print(f"Backup creado: {backup_path}")
    return backup_path


def normalize_stock_table(conn: sqlite3.Connection):
    """Normaliza la tabla stock (la más problemática)"""
    cur = conn.cursor()

    print("\n=== Normalizando tabla STOCK ===")

    # Verificar estructura actual
    cur.execute("PRAGMA table_info(stock)")
    columns = [row[1] for row in cur.fetchall()]
    print(f"Columnas: {columns}")

    # Contar registros
    cur.execute("SELECT COUNT(*) FROM stock")
    total = cur.fetchone()[0]
    print(f"Total registros: {total}")

    # Crear tabla temporal con tipos correctos
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS stock_normalized (
            dia TEXT,
            acreedor TEXT,
            acreedor_descripcion TEXT,
            regional TEXT,
            centro TEXT,
            centro_descripcion TEXT,
            "ypf/ute_desc" TEXT,
            almacen TEXT,
            grupo_de_articulos TEXT,
            gpo_articulos_descripcion TEXT,
            material TEXT,
            material_descripcion TEXT,
            cat_valoracion TEXT,
            elemento_pep TEXT,
            lote TEXT,
            stock REAL,
            um TEXT,
            precio REAL,
            stock_valorizado REAL,
            moneda TEXT,
            ubicacion TEXT,
            planificacion_categorias TEXT,
            sub_categorias TEXT,
            inmovilizado TEXT,
            critico TEXT,
            prevision_por_obsolescencia TEXT
        )
    """
    )

    # Migrar datos con normalización
    cur.execute("SELECT * FROM stock")
    rows = cur.fetchall()

    for row in rows:
        # Índices de las columnas que necesitan normalización
        # centro=4, almacen=7, material=10, grupo_de_articulos=8, cat_valoracion=12
        new_row = list(row)
        new_row[4] = normalize_centro(row[4])  # centro
        new_row[7] = normalize_almacen(row[7])  # almacen
        new_row[8] = normalize_material(row[8]) if row[8] else ""  # grupo_de_articulos
        new_row[10] = normalize_material(row[10])  # material
        new_row[12] = normalize_material(row[12]) if row[12] else ""  # cat_valoracion

        cur.execute(
            """
            INSERT INTO stock_normalized VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
            new_row,
        )

    # Verificar conteo
    cur.execute("SELECT COUNT(*) FROM stock_normalized")
    normalized_count = cur.fetchone()[0]
    print(f"Registros normalizados: {normalized_count}")

    # Reemplazar tabla original
    cur.execute("DROP TABLE stock")
    cur.execute("ALTER TABLE stock_normalized RENAME TO stock")

    # Crear índices
    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_material ON stock(material)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_centro_almacen ON stock(centro, almacen)")

    conn.commit()
    print("Tabla STOCK normalizada exitosamente")


def normalize_pedidos_table(conn: sqlite3.Connection):
    """Normaliza la tabla pedidos_sap"""
    cur = conn.cursor()

    print("\n=== Normalizando tabla PEDIDOS_SAP ===")

    cur.execute("SELECT COUNT(*) FROM pedidos_sap")
    total = cur.fetchone()[0]
    print(f"Total registros: {total}")

    # Crear tabla temporal
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pedidos_normalized (
            centro TEXT,
            almacen TEXT,
            pedido TEXT,
            posicion_pedido INTEGER,
            material TEXT,
            descripcion TEXT,
            ctdpedida REAL,
            ctdentregada REAL,
            saldo_pend REAL,
            um TEXT,
            fecdocum TEXT,
            fecentre TEXT,
            cls TEXT,
            solicitante TEXT,
            nombre_1 TEXT
        )
    """
    )

    cur.execute("SELECT * FROM pedidos_sap")
    for row in cur.fetchall():
        new_row = list(row)
        new_row[0] = normalize_centro(row[0])  # centro
        new_row[1] = normalize_almacen(row[1])  # almacen
        new_row[2] = str(row[2]) if row[2] else ""  # pedido
        new_row[4] = normalize_material(row[4])  # material

        cur.execute(
            "INSERT INTO pedidos_normalized VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", new_row
        )

    cur.execute("SELECT COUNT(*) FROM pedidos_normalized")
    print(f"Registros normalizados: {cur.fetchone()[0]}")

    cur.execute("DROP TABLE pedidos_sap")
    cur.execute("ALTER TABLE pedidos_normalized RENAME TO pedidos_sap")

    cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_material ON pedidos_sap(material)")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_pedidos_centro_almacen ON pedidos_sap(centro, almacen)"
    )

    conn.commit()
    print("Tabla PEDIDOS_SAP normalizada exitosamente")


def normalize_materiales_bbdd_table(conn: sqlite3.Connection):
    """Normaliza la tabla materiales_bbdd"""
    cur = conn.cursor()

    print("\n=== Normalizando tabla MATERIALES_BBDD ===")

    cur.execute("SELECT COUNT(*) FROM materiales_bbdd")
    total = cur.fetchone()[0]
    print(f"Total registros: {total}")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS materiales_bbdd_normalized (
            sector TEXT,
            almacen TEXT,
            centro TEXT,
            codigo_material TEXT,
            descripcion TEXT,
            stock_de_seguridad INTEGER,
            punto_de_pedido INTEGER,
            stock_maximo INTEGER
        )
    """
    )

    cur.execute("SELECT * FROM materiales_bbdd")
    for row in cur.fetchall():
        new_row = list(row)
        new_row[1] = normalize_almacen(row[1])  # almacen
        new_row[2] = normalize_centro(row[2])  # centro
        new_row[3] = normalize_material(row[3])  # codigo_material

        cur.execute("INSERT INTO materiales_bbdd_normalized VALUES (?,?,?,?,?,?,?,?)", new_row)

    cur.execute("SELECT COUNT(*) FROM materiales_bbdd_normalized")
    print(f"Registros normalizados: {cur.fetchone()[0]}")

    cur.execute("DROP TABLE materiales_bbdd")
    cur.execute("ALTER TABLE materiales_bbdd_normalized RENAME TO materiales_bbdd")

    cur.execute("CREATE INDEX IF NOT EXISTS idx_mrp_material ON materiales_bbdd(codigo_material)")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_mrp_centro_almacen ON materiales_bbdd(centro, almacen)"
    )

    conn.commit()
    print("Tabla MATERIALES_BBDD normalizada exitosamente")


def normalize_consumo_table(conn: sqlite3.Connection):
    """Normaliza la tabla consumo_historico"""
    cur = conn.cursor()

    print("\n=== Normalizando tabla CONSUMO_HISTORICO ===")

    cur.execute("SELECT COUNT(*) FROM consumo_historico")
    total = cur.fetchone()[0]
    print(f"Total registros: {total}")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS consumo_normalized (
            fecha TEXT,
            centro TEXT,
            almacen TEXT,
            cantidad REAL,
            material TEXT,
            descripcion TEXT
        )
    """
    )

    cur.execute("SELECT * FROM consumo_historico")
    for row in cur.fetchall():
        new_row = list(row)
        new_row[1] = normalize_centro(row[1])  # centro
        new_row[2] = normalize_almacen(row[2])  # almacen
        new_row[4] = normalize_material(row[4])  # material

        cur.execute("INSERT INTO consumo_normalized VALUES (?,?,?,?,?,?)", new_row)

    cur.execute("SELECT COUNT(*) FROM consumo_normalized")
    print(f"Registros normalizados: {cur.fetchone()[0]}")

    cur.execute("DROP TABLE consumo_historico")
    cur.execute("ALTER TABLE consumo_normalized RENAME TO consumo_historico")

    cur.execute("CREATE INDEX IF NOT EXISTS idx_consumo_material ON consumo_historico(material)")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_consumo_centro_almacen ON consumo_historico(centro, almacen)"
    )

    conn.commit()
    print("Tabla CONSUMO_HISTORICO normalizada exitosamente")


def verify_normalization(conn: sqlite3.Connection):
    """Verifica que la normalización fue exitosa"""
    cur = conn.cursor()

    print("\n=== VERIFICACIÓN POST-NORMALIZACIÓN ===")

    for table in ["stock", "pedidos_sap", "materiales_bbdd", "consumo_historico"]:
        print(f"\n--- {table} ---")
        if table == "materiales_bbdd":
            cur.execute(f"SELECT centro, almacen, codigo_material FROM {table} LIMIT 3")
            for r in cur.fetchall():
                print(f"  centro={repr(r[0])} almacen={repr(r[1])} codigo={repr(r[2])}")
        else:
            cur.execute(f"SELECT centro, almacen, material FROM {table} LIMIT 3")
            for r in cur.fetchall():
                print(f"  centro={repr(r[0])} almacen={repr(r[1])} material={repr(r[2])}")


def main():
    db_path = Path("data/sap_data.db")

    if not db_path.exists():
        print(f"ERROR: No se encontró {db_path}")
        return

    # Crear backup
    backup_db(db_path)

    # Conectar y normalizar
    conn = sqlite3.connect(db_path)

    try:
        normalize_stock_table(conn)
        normalize_pedidos_table(conn)
        normalize_materiales_bbdd_table(conn)
        normalize_consumo_table(conn)
        verify_normalization(conn)
        print("\n=== NORMALIZACIÓN COMPLETADA EXITOSAMENTE ===")
    except Exception as e:
        print(f"\nERROR durante normalización: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
