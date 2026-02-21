#!/usr/bin/env python3
"""
Script para migrar datos de SQLite (dev) a PostgreSQL (local o producción).

Lee datos de las 3 bases SQLite:
  - data/spm.db (usuarios, solicitudes, presupuestos, etc.)
  - data/sap_data.db (stock, consumo, pedidos SAP)
  - data/master_materiales.db (catálogo materiales, equivalencias)

E inserta en PostgreSQL donde las tablas ya existen (creadas por schema dump).

Uso:
  python scripts/migrate_sqlite_to_pg.py
  python scripts/migrate_sqlite_to_pg.py --pg-url postgresql://spm:pass@host:5432/spm_production
"""

import argparse
import os
import sqlite3
import sys
import time

import psycopg2
import psycopg2.extras

# Directorio de datos SQLite
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# URL por defecto de PG local dev
DEFAULT_PG_URL = "postgresql://spm:8300_@@localhost:5432/spm_dev"


# ============================================================================
# Mapeo: (archivo_sqlite, tabla_sqlite) -> tabla_pg
# ============================================================================

# spm.db: tabla real SQLite (español/singular) → tabla real PostgreSQL (legacy/plural)
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

# sap_data.db
SAP_TABLE_MAP = {
    "stock": "sap_stock",
    "consumo_historico": "sap_consumo_historico",
    "pedidos_sap": "sap_pedidos",
    "materiales_bbdd": "sap_materiales_bbdd",
}

# master_materiales.db
MASTER_TABLE_MAP = {
    "catalogo_materiales": "cat_materiales",
    "materiales_equivalencias": "cat_equivalencias",
}

# Columnas SQLite que no existen en PG (excluir)
EXCLUDE_COLUMNS = {
    "sap_materiales_bbdd": {"demanda_estimada_anual", "consumo_promedio_anual", "rotacion"},
}

# Renombrar columnas SQLite → PG (cuando el nombre difiere)
COLUMN_RENAME = {
    "sap_stock": {"ypf/ute_desc": "ypf_ute_desc"},
}


def get_sqlite_conn(db_file):
    path = os.path.join(DATA_DIR, db_file)
    if not os.path.exists(path):
        print(f"  WARN: No encontrado {path}")
        return None
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def get_pg_conn(pg_url):
    return psycopg2.connect(pg_url)


def get_pg_columns(pg_conn, table_name):
    cur = pg_conn.cursor()
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    cols = [row[0] for row in cur.fetchall()]
    cur.close()
    return cols


def get_pg_boolean_columns(pg_conn, table_name):
    cur = pg_conn.cursor()
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s AND data_type = 'boolean'
    """, (table_name,))
    cols = {row[0] for row in cur.fetchall()}
    cur.close()
    return cols


def table_exists_pg(pg_conn, table_name):
    cur = pg_conn.cursor()
    cur.execute("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s AND table_type = 'BASE TABLE'
    """, (table_name,))
    exists = cur.fetchone() is not None
    cur.close()
    return exists


def migrate_table(sqlite_conn, pg_conn, sqlite_table, pg_table, batch_size=2000):
    """Migra una tabla de SQLite a PostgreSQL usando bulk inserts."""
    sqlite_cur = sqlite_conn.cursor()
    try:
        sqlite_cur.execute(f"SELECT COUNT(*) FROM [{sqlite_table}]")
        total = sqlite_cur.fetchone()[0]
    except Exception as e:
        print(f"  ERROR leyendo {sqlite_table}: {e}")
        return 0

    if total == 0:
        return 0

    # Columnas SQLite
    sqlite_cur.execute(f"PRAGMA table_info([{sqlite_table}])")
    sqlite_cols = [row[1] for row in sqlite_cur.fetchall()]

    # Columnas PG
    pg_cols = get_pg_columns(pg_conn, pg_table)
    if not pg_cols:
        print(f"  WARN: Tabla PG '{pg_table}' sin columnas")
        return 0

    # Columnas comunes (con renombramientos)
    excluded = EXCLUDE_COLUMNS.get(pg_table, set())
    rename = COLUMN_RENAME.get(pg_table, {})

    # Mapear: para cada columna SQLite, determinar nombre PG
    common_sqlite_cols = []  # nombres en SQLite
    common_pg_cols = []      # nombres en PG
    for c in sqlite_cols:
        if c in excluded:
            continue
        pg_name = rename.get(c, c)
        if pg_name in pg_cols:
            common_sqlite_cols.append(c)
            common_pg_cols.append(pg_name)

    if not common_pg_cols:
        print(f"  WARN: Sin columnas comunes {sqlite_table} <-> {pg_table}")
        return 0

    # Detectar BOOLEAN columns
    bool_cols = get_pg_boolean_columns(pg_conn, pg_table)
    bool_indices = {i for i, c in enumerate(common_pg_cols) if c in bool_cols}

    # Leer datos
    cols_str = ", ".join(f"[{c}]" for c in common_sqlite_cols)
    sqlite_cur.execute(f"SELECT {cols_str} FROM [{sqlite_table}]")

    # INSERT con execute_values (mucho más rápido que insert individual)
    pg_cols_str = ", ".join(f'"{c}"' for c in common_pg_cols)
    insert_sql = f'INSERT INTO "{pg_table}" ({pg_cols_str}) VALUES %s ON CONFLICT DO NOTHING'

    pg_cur = pg_conn.cursor()
    inserted = 0

    while True:
        batch = sqlite_cur.fetchmany(batch_size)
        if not batch:
            break

        values_list = []
        for row in batch:
            values = [row[c] for c in common_sqlite_cols]
            for idx in bool_indices:
                v = values[idx]
                if isinstance(v, int):
                    values[idx] = bool(v)
            values_list.append(tuple(values))

        try:
            psycopg2.extras.execute_values(
                pg_cur, insert_sql, values_list, page_size=batch_size
            )
            inserted += pg_cur.rowcount
            pg_conn.commit()
        except Exception as e:
            pg_conn.rollback()
            print(f"  ERROR bulk insert en {pg_table}: {e}")
            # Fallback: intentar row-by-row para encontrar la fila problemática
            single_sql = f'INSERT INTO "{pg_table}" ({pg_cols_str}) VALUES ({", ".join(["%s"] * len(common_pg_cols))}) ON CONFLICT DO NOTHING'
            for vals in values_list:
                try:
                    pg_cur.execute(single_sql, vals)
                    if pg_cur.rowcount > 0:
                        inserted += 1
                except Exception:
                    pg_conn.rollback()
                    continue
            pg_conn.commit()

    # Actualizar secuencia SERIAL si la tabla tiene 'id'
    if "id" in common_pg_cols:
        try:
            pg_cur.execute(f"""
                SELECT setval(pg_get_serial_sequence('"{pg_table}"', 'id'),
                       COALESCE((SELECT MAX(id) FROM "{pg_table}"), 0) + 1, false)
            """)
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()

    pg_cur.close()
    return inserted


def migrate_db(sqlite_file, table_map, pg_url):
    """Migra todas las tablas de un archivo SQLite a PG (conexión nueva)."""
    print(f"\n{'='*60}")
    print(f"Migrando: {sqlite_file}")
    print(f"{'='*60}")

    sqlite_conn = get_sqlite_conn(sqlite_file)
    if sqlite_conn is None:
        return 0

    pg_conn = get_pg_conn(pg_url)
    pg_conn.autocommit = False

    total_migrated = 0
    for sqlite_table, pg_table in table_map.items():
        if not table_exists_pg(pg_conn, pg_table):
            print(f"  SKIP: {pg_table} no existe en PG")
            continue

        start = time.time()
        count = migrate_table(sqlite_conn, pg_conn, sqlite_table, pg_table)
        elapsed = time.time() - start

        if count > 0:
            print(f"  OK: {sqlite_table} -> {pg_table}: {count} registros ({elapsed:.1f}s)")
            total_migrated += count
        else:
            # Check if table had data in SQLite
            try:
                cur = sqlite_conn.cursor()
                cur.execute(f"SELECT COUNT(*) FROM [{sqlite_table}]")
                sqlite_count = cur.fetchone()[0]
                if sqlite_count > 0:
                    print(f"  OK: {sqlite_table} -> {pg_table}: {sqlite_count} ya existían")
            except Exception:
                pass

    sqlite_conn.close()
    pg_conn.close()
    print(f"  Total migrados desde {sqlite_file}: {total_migrated}")
    return total_migrated


def verify_migration(pg_url):
    print(f"\n{'='*60}")
    print("Verificación de datos en PostgreSQL")
    print(f"{'='*60}")

    checks = [
        ("usuarios", "Usuarios"),
        ("solicitudes", "Solicitudes"),
        ("presupuestos", "Presupuestos"),
        ("budget_update_requests", "BURs"),
        ("reglas_aprobacion", "Reglas aprobación"),
        ("notificaciones", "Notificaciones"),
        ("proveedores_externos", "Proveedores externos"),
        ("proveedores_internos", "Proveedores internos"),
        ("proveedor_precios_negociados", "Precios negociados"),
        ("sap_stock", "Stock SAP"),
        ("sap_consumo_historico", "Consumo histórico"),
        ("sap_pedidos", "Pedidos SAP"),
        ("sap_materiales_bbdd", "Materiales BBDD"),
        ("cat_materiales", "Catálogo materiales"),
        ("cat_equivalencias", "Equivalencias"),
        ("catalog_almacenes", "Catálogo almacenes"),
        ("catalog_centros", "Catálogo centros"),
        ("catalog_sectores", "Catálogo sectores"),
        ("catalog_roles", "Catálogo roles"),
        ("catalog_puestos", "Catálogo puestos"),
        ("config_equivalencia_scores", "Config equiv scores"),
        ("vertex_conversations", "Vertex conversations"),
        ("vertex_messages", "Vertex messages"),
    ]

    pg_conn = get_pg_conn(pg_url)
    cur = pg_conn.cursor()
    for table, label in checks:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            status = "OK" if count > 0 else "--"
            print(f"  {status}: {label:30s} = {count:>10,}")
        except Exception as e:
            pg_conn.rollback()
            print(f"  ERR: {label:30s} = {e}")
    cur.close()
    pg_conn.close()


def main():
    parser = argparse.ArgumentParser(description="Migrar datos de SQLite a PostgreSQL")
    parser.add_argument("--pg-url", default=None, help="URL de PostgreSQL")
    parser.add_argument("--verify-only", action="store_true", help="Solo verificar")
    args = parser.parse_args()

    # Determinar URL de PG
    pg_url = args.pg_url
    if not pg_url:
        env_path = os.path.join(os.path.dirname(DATA_DIR), ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        pg_url = line.strip().split("=", 1)[1]
                        break
    if not pg_url:
        pg_url = DEFAULT_PG_URL

    print(f"Conectando a PostgreSQL: {pg_url.split('@')[0].rsplit(':', 1)[0]}@...")

    if args.verify_only:
        verify_migration(pg_url)
        return

    start_total = time.time()

    migrate_db("spm.db", SPM_TABLE_MAP, pg_url)
    migrate_db("sap_data.db", SAP_TABLE_MAP, pg_url)
    migrate_db("master_materiales.db", MASTER_TABLE_MAP, pg_url)

    elapsed_total = time.time() - start_total
    print(f"\nMigración completada en {elapsed_total:.1f}s")

    verify_migration(pg_url)
    print("\nDone!")


if __name__ == "__main__":
    main()
