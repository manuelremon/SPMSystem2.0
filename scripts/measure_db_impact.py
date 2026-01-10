"""
Script para medir el impacto de la importacion de datos SAP en la base de datos.
Genera metricas de tamano, indices y rendimiento de queries.

Uso:
    python scripts/measure_db_impact.py [--db data/spm.db]
"""

import argparse
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path


def get_db_size(db_path: str) -> dict:
    """Obtiene tamano del archivo de BD"""
    path = Path(db_path)
    if not path.exists():
        return {'exists': False}

    size_bytes = path.stat().st_size
    return {
        'exists': True,
        'size_bytes': size_bytes,
        'size_mb': round(size_bytes / (1024 * 1024), 2),
        'size_kb': round(size_bytes / 1024, 2)
    }


def get_table_stats(conn: sqlite3.Connection, table_name: str) -> dict:
    """Obtiene estadisticas de una tabla"""
    try:
        # Conteo de filas
        count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]

        # Info de columnas
        columns = conn.execute(f"PRAGMA table_info({table_name})").fetchall()

        # Indices
        indexes = conn.execute(f"PRAGMA index_list({table_name})").fetchall()

        return {
            'rows': count,
            'columns': len(columns),
            'indexes': len(indexes),
            'index_names': [idx[1] for idx in indexes]
        }
    except Exception as e:
        return {'error': str(e)}


def benchmark_query(conn: sqlite3.Connection, name: str, query: str, iterations: int = 3) -> dict:
    """Ejecuta un benchmark de query"""
    times = []
    result_count = 0

    for _ in range(iterations):
        start = time.time()
        cursor = conn.execute(query)
        rows = cursor.fetchall()
        elapsed = (time.time() - start) * 1000  # ms
        times.append(elapsed)
        result_count = len(rows)

    return {
        'name': name,
        'iterations': iterations,
        'result_count': result_count,
        'min_ms': round(min(times), 2),
        'max_ms': round(max(times), 2),
        'avg_ms': round(sum(times) / len(times), 2)
    }


def run_analysis(db_path: str) -> dict:
    """Ejecuta analisis completo de la BD"""
    print("=" * 60)
    print("ANALISIS DE IMPACTO EN BASE DE DATOS")
    print(f"Archivo: {db_path}")
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {
        'db_path': db_path,
        'timestamp': datetime.now().isoformat(),
        'file_info': get_db_size(db_path)
    }

    if not results['file_info']['exists']:
        print(f"Error: Base de datos no existe: {db_path}")
        return results

    print(f"\n[1] TAMANO DEL ARCHIVO")
    print(f"    Tamano: {results['file_info']['size_mb']} MB ({results['file_info']['size_bytes']:,} bytes)")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Tablas SAP
    print(f"\n[2] TABLAS SAP PROCUREMENT")
    sap_tables = ['sap_solpeds', 'sap_purchase_orders', 'sap_import_log']
    results['sap_tables'] = {}

    for table in sap_tables:
        stats = get_table_stats(conn, table)
        results['sap_tables'][table] = stats
        if 'error' not in stats:
            print(f"    {table}:")
            print(f"      - Filas: {stats['rows']:,}")
            print(f"      - Columnas: {stats['columns']}")
            print(f"      - Indices: {stats['indexes']} ({', '.join(stats['index_names'][:3])}...)")
        else:
            print(f"    {table}: {stats['error']}")

    # Vistas SAP
    print(f"\n[3] VISTAS SAP")
    views = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='view' AND name LIKE 'v_sap_%'"
    ).fetchall()
    results['sap_views'] = [v[0] for v in views]
    for view in results['sap_views']:
        print(f"    - {view}")

    # Benchmark de queries
    print(f"\n[4] BENCHMARK DE QUERIES")
    benchmarks = [
        ("Contar SOLPEDs", "SELECT COUNT(*) FROM sap_solpeds"),
        ("Contar POs", "SELECT COUNT(*) FROM sap_purchase_orders"),
        ("KPIs basicos", """
            SELECT
                COUNT(DISTINCT solped_id) as solpeds,
                COUNT(*) as items,
                SUM(importe_total) as total
            FROM sap_solpeds
        """),
        ("Lead times (vista)", "SELECT * FROM v_sap_lead_times LIMIT 100"),
        ("Cumplimiento (vista)", "SELECT * FROM v_sap_cumplimiento"),
        ("Busqueda material", "SELECT * FROM sap_solpeds WHERE material_codigo LIKE '1000%' LIMIT 50"),
        ("Join SOLPED-PO", """
            SELECT s.solped_id, s.material_descripcion, p.proveedor_nombre
            FROM sap_solpeds s
            LEFT JOIN sap_purchase_orders p ON s.solped_id = p.solped_id
            LIMIT 100
        """),
        ("Agregacion por centro", """
            SELECT centro, COUNT(*) as cnt, SUM(importe_total) as total
            FROM sap_solpeds
            GROUP BY centro
        """),
    ]

    results['benchmarks'] = []
    for name, query in benchmarks:
        try:
            bench = benchmark_query(conn, name, query)
            results['benchmarks'].append(bench)
            status = "OK" if bench['avg_ms'] < 100 else "LENTO" if bench['avg_ms'] < 500 else "MUY LENTO"
            print(f"    {name}:")
            print(f"      - Tiempo: {bench['avg_ms']}ms (min={bench['min_ms']}, max={bench['max_ms']})")
            print(f"      - Resultados: {bench['result_count']:,} filas")
            print(f"      - Estado: {status}")
        except Exception as e:
            print(f"    {name}: ERROR - {e}")
            results['benchmarks'].append({'name': name, 'error': str(e)})

    # Comparacion con otras tablas
    print(f"\n[5] COMPARACION CON OTRAS TABLAS")
    other_tables = ['solicitudes', 'usuarios', 'presupuestos', 'presupuesto_ledger']
    results['other_tables'] = {}

    for table in other_tables:
        stats = get_table_stats(conn, table)
        results['other_tables'][table] = stats
        if 'error' not in stats:
            print(f"    {table}: {stats['rows']:,} filas")

    # Espacio usado por indices
    print(f"\n[6] INDICES CREADOS PARA SAP")
    all_indexes = conn.execute("""
        SELECT name, tbl_name FROM sqlite_master
        WHERE type='index' AND (name LIKE 'idx_sap%' OR tbl_name LIKE 'sap_%')
    """).fetchall()
    results['sap_indexes'] = [(idx[0], idx[1]) for idx in all_indexes]
    for idx_name, tbl_name in results['sap_indexes']:
        print(f"    - {idx_name} (en {tbl_name})")

    # Resumen
    print(f"\n" + "=" * 60)
    print("RESUMEN DE IMPACTO")
    print("=" * 60)

    total_sap_rows = sum(
        stats.get('rows', 0)
        for stats in results['sap_tables'].values()
        if 'error' not in stats
    )
    total_other_rows = sum(
        stats.get('rows', 0)
        for stats in results['other_tables'].values()
        if 'error' not in stats
    )

    print(f"  Tamano BD: {results['file_info']['size_mb']} MB")
    print(f"  Filas SAP: {total_sap_rows:,}")
    print(f"  Filas otras tablas: {total_other_rows:,}")
    print(f"  Ratio SAP/Total: {total_sap_rows / max(total_sap_rows + total_other_rows, 1) * 100:.1f}%")
    print(f"  Indices SAP: {len(results['sap_indexes'])}")
    print(f"  Vistas SAP: {len(results['sap_views'])}")

    avg_query_time = sum(b.get('avg_ms', 0) for b in results['benchmarks'] if 'avg_ms' in b) / len(results['benchmarks'])
    print(f"  Query promedio: {avg_query_time:.1f}ms")

    conn.close()

    return results


def main():
    parser = argparse.ArgumentParser(description='Medir impacto en BD')
    parser.add_argument('--db', default='data/spm.db', help='Ruta a la base de datos')

    args = parser.parse_args()

    results = run_analysis(args.db)

    print(f"\nAnalisis completado.")


if __name__ == '__main__':
    main()
