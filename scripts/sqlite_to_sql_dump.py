#!/usr/bin/env python3
"""
Genera SQL INSERT puro desde SQLite para importar en PostgreSQL producción.

Genera un archivo .sql que puede ejecutarse con psql directamente,
sin necesidad de psycopg2 en el servidor destino.

Uso:
  python scripts/sqlite_to_sql_dump.py
  # Genera data/production_dump.sql
"""

import os
import sqlite3

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "production_dump.sql")

# ============================================================================
# Mapeos (mismos que migrate_sqlite_to_pg.py)
# ============================================================================

SPM_TABLE_MAP = {
    "usuario": "usuarios",
    "solicitud": "solicitudes",
    "notificacion": "notificaciones",
    "mensaje": "mensajes",
    "presupuesto": "presupuestos",
    "presupuesto_solicitud_cambio": "budget_update_requests",
    "presupuesto_ledger": "presupuesto_ledger",
    "presupuesto_incorporaciones": "presupuesto_incorporaciones",
    "catalogo_almacen": "catalog_almacenes",
    "catalogo_centro": "catalog_centros",
    "catalogo_puesto": "catalog_puestos",
    "catalogo_rol": "catalog_roles",
    "catalogo_sector": "catalog_sectores",
    "proveedor_externo": "proveedores_externos",
    "proveedor_externo_contacto": "proveedor_ext_contactos",
    "proveedor_externo_email": "proveedor_ext_emails",
    "proveedor_externo_telefono": "proveedor_ext_telefonos",
    "proveedor_interno": "proveedores_internos",
    "proveedor_precio_negociado": "proveedor_precios_negociados",
    "proveedores": "proveedores",
    "orden_compra": "purchase_orders",
    "solicitud_pedido_sap": "solpeds",
    "solicitud_traslado": "traslados",
    "email_bandeja_salida": "outbox_emails",
    "notificacion_push_suscripcion": "push_subscriptions",
    "trivia_score": "trivias_scores",
    "usuario_solicitud_perfil": "user_profile_requests",
    "reglas_aprobacion": "reglas_aprobacion",
    "aprobadores_delegados": "aprobadores_delegados",
    "archivos_adjuntos": "archivos_adjuntos",
    "config_almacenes": "config_almacenes",
    "config_equivalencia_scores": "config_equivalencia_scores",
    "config_lotes_excluidos": "config_lotes_excluidos",
    "decision_abastecimiento": "decision_abastecimiento",
    "decision_abastecimiento_fuentes": "decision_abastecimiento_fuentes",
    "solicitud_historial_estado": "solicitudes_historial_estados",
    "solicitud_items_tratamiento": "solicitud_items_tratamiento",
    "solicitud_tratamiento_eventos": "solicitud_tratamiento_eventos",
    "solicitud_tratamiento_log": "solicitud_tratamiento_log",
    "planificador_asignaciones": "planificador_asignaciones",
    "user_material_favorito": "user_material_favorito",
    "foro_posts": "foro_posts",
    "foro_respuestas": "foro_respuestas",
    "foro_likes": "foro_likes",
    "vertex_conversations": "vertex_conversations",
    "vertex_messages": "vertex_messages",
    "vertex_proactive_alerts": "vertex_proactive_alerts",
    "vertex_user_memory": "vertex_user_memory",
    "webhook": "webhook",
    "webhook_delivery": "webhook_delivery",
    "reporte_destinatario": "reporte_destinatario",
    "executive_kpi": "executive_kpi",
    "executive_snapshot": "executive_snapshot",
    "benchmark": "benchmark",
    "procurement_scorecard": "procurement_scorecard",
    "cashflow_simulacion": "cashflow_simulacion",
    "programa_descuento": "programa_descuento",
    "oferta_descuento": "oferta_descuento",
    "lista_precios": "lista_precios",
    "precio_item": "precio_item",
    "precio_historial": "precio_historial",
    "precio_negociacion": "precio_negociacion",
    "terminos_pago_proveedor": "terminos_pago_proveedor",
    "consignment_programa": "consignment_programa",
    "consignment_stock": "consignment_stock",
    "consignment_consumo": "consignment_consumo",
    "consignment_reconciliacion": "consignment_reconciliacion",
    "kanban_tablero": "kanban_tablero",
    "kanban_tarjeta": "kanban_tarjeta",
    "kanban_senal": "kanban_senal",
    "kanban_historial": "kanban_historial",
}

SAP_TABLE_MAP = {
    "stock": "sap_stock",
    "consumo_historico": "sap_consumo_historico",
    "pedidos_sap": "sap_pedidos",
    "materiales_bbdd": "sap_materiales_bbdd",
}

MASTER_TABLE_MAP = {
    "catalogo_materiales": "cat_materiales",
    "materiales_equivalencias": "cat_equivalencias",
}

# Columnas SQLite que no existen en PG
EXCLUDE_COLUMNS = {
    "sap_materiales_bbdd": {"demanda_estimada_anual", "consumo_promedio_anual", "rotacion"},
}

# Renombrar columnas SQLite → PG
COLUMN_RENAME = {
    "sap_stock": {"ypf/ute_desc": "ypf_ute_desc"},
}

# Columnas booleanas en PG — se llena dinámicamente desde producción
BOOLEAN_COLUMNS = {}


def escape_sql_value(val, is_bool=False):
    """Escapa un valor para SQL."""
    if val is None:
        return "NULL"
    if is_bool:
        if isinstance(val, int):
            return "TRUE" if val else "FALSE"
        if isinstance(val, str):
            return "TRUE" if val.lower() in ("1", "true", "t") else "FALSE"
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    # String: escapar comillas simples
    s = str(val).replace("'", "''")
    # Escapar backslashes para PG
    s = s.replace("\\", "\\\\")
    return f"'{s}'"


def get_pg_table_info_from_prod(ssh_cmd_prefix, pg_table):
    """Obtiene columnas y tipos de una tabla en PG producción via SSH.
    Retorna (list_of_columns, set_of_boolean_columns)."""
    import subprocess
    cmd = f'{ssh_cmd_prefix} "sudo docker exec spm-postgres psql -U spm -d spm_production -t -A -c \\"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=\'{pg_table}\' ORDER BY ordinal_position;\\""'
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            cols = []
            bools = set()
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = line.strip().split("|")
                if len(parts) >= 2:
                    col_name = parts[0].strip()
                    col_type = parts[1].strip()
                    cols.append(col_name)
                    if col_type == "boolean":
                        bools.add(col_name)
            return cols, bools
    except Exception:
        pass
    return None, None


def dump_table(f, sqlite_conn, sqlite_table, pg_table, pg_columns=None):
    """Genera INSERT statements para una tabla."""
    cur = sqlite_conn.cursor()

    # Contar registros
    try:
        cur.execute(f"SELECT COUNT(*) FROM [{sqlite_table}]")
        total = cur.fetchone()[0]
    except Exception as e:
        print(f"  ERROR leyendo {sqlite_table}: {e}")
        return 0

    if total == 0:
        return 0

    # Columnas SQLite
    cur.execute(f"PRAGMA table_info([{sqlite_table}])")
    sqlite_cols = [row[1] for row in cur.fetchall()]

    excluded = EXCLUDE_COLUMNS.get(pg_table, set())
    rename = COLUMN_RENAME.get(pg_table, {})
    bool_cols = BOOLEAN_COLUMNS.get(pg_table, set())

    # Mapear columnas
    common_sqlite = []
    common_pg = []
    for c in sqlite_cols:
        if c in excluded:
            continue
        pg_name = rename.get(c, c)
        if pg_columns is None or pg_name in pg_columns:
            common_sqlite.append(c)
            common_pg.append(pg_name)

    if not common_pg:
        print(f"  WARN: Sin columnas comunes {sqlite_table} <-> {pg_table}")
        return 0

    # Leer datos — SELECT solo las columnas que necesitamos, en orden
    cols_str = ", ".join(f"[{c}]" for c in common_sqlite)
    cur.execute(f"SELECT {cols_str} FROM [{sqlite_table}]")

    pg_cols_str = ", ".join(f'"{c}"' for c in common_pg)
    bool_indices = {i for i, c in enumerate(common_pg) if c in bool_cols}

    # Transacción por tabla
    f.write(f'\n-- {pg_table}\n')
    f.write('BEGIN;\n')
    f.write(f'TRUNCATE TABLE "{pg_table}" CASCADE;\n')

    # Generar INSERTs en batches de 500 valores
    batch = []
    count = 0
    batch_size = 500

    for row in cur:
        values = []
        for i in range(len(common_sqlite)):
            val = row[i]
            values.append(escape_sql_value(val, is_bool=(i in bool_indices)))
        batch.append(f"({', '.join(values)})")
        count += 1

        if len(batch) >= batch_size:
            f.write(f'INSERT INTO "{pg_table}" ({pg_cols_str}) VALUES\n')
            f.write(",\n".join(batch))
            f.write(";\n")
            batch = []

    # Flush remaining
    if batch:
        f.write(f'INSERT INTO "{pg_table}" ({pg_cols_str}) VALUES\n')
        f.write(",\n".join(batch))
        f.write(";\n")

    f.write('COMMIT;\n')
    return count


def dump_db(f, sqlite_file, table_map, pg_columns_cache):
    """Genera SQL para todas las tablas de un archivo SQLite."""
    path = os.path.join(DATA_DIR, sqlite_file)
    if not os.path.exists(path):
        print(f"  WARN: No encontrado {path}")
        return 0

    conn = sqlite3.connect(path)
    total = 0

    f.write("\n-- ============================================\n")
    f.write(f"-- Fuente: {sqlite_file}\n")
    f.write("-- ============================================\n\n")

    for sqlite_table, pg_table in table_map.items():
        pg_cols = pg_columns_cache.get(pg_table)
        count = dump_table(f, conn, sqlite_table, pg_table, pg_cols)
        if count > 0:
            print(f"  OK: {sqlite_table} -> {pg_table}: {count} registros")
            total += count

    conn.close()
    return total


def main():

    print("Obteniendo columnas de producción...")
    ssh_prefix = "ssh -i ~/.ssh/oracle_vps_key -o StrictHostKeyChecking=no ubuntu@144.22.47.110"

    # Obtener todas las tablas PG y sus columnas + tipos booleanos
    pg_columns_cache = {}
    all_tables = set()
    for tmap in [SPM_TABLE_MAP, SAP_TABLE_MAP, MASTER_TABLE_MAP]:
        all_tables.update(tmap.values())

    for pg_table in sorted(all_tables):
        cols, bools = get_pg_table_info_from_prod(ssh_prefix, pg_table)
        if cols:
            pg_columns_cache[pg_table] = cols
            if bools:
                BOOLEAN_COLUMNS[pg_table] = bools

    print(f"  Columnas obtenidas para {len(pg_columns_cache)} tablas")
    print(f"  Tablas con booleanos: {len(BOOLEAN_COLUMNS)} ({', '.join(sorted(BOOLEAN_COLUMNS.keys()))})")

    print(f"\nGenerando dump SQL -> {OUTPUT_FILE}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("-- Production data dump from SQLite\n")
        f.write("-- Generated by sqlite_to_sql_dump.py\n")
        f.write("SET client_encoding = 'UTF8';\n\n")

        total = 0
        total += dump_db(f, "spm.db", SPM_TABLE_MAP, pg_columns_cache)
        total += dump_db(f, "sap_data.db", SAP_TABLE_MAP, pg_columns_cache)
        total += dump_db(f, "master_materiales.db", MASTER_TABLE_MAP, pg_columns_cache)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nDump generado: {OUTPUT_FILE} ({size_mb:.1f} MB)")
    print(f"Total registros: {total:,}")


if __name__ == "__main__":
    main()
