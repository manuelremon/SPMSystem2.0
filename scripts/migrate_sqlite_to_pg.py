#!/usr/bin/env python3
"""
Migra datos desde SQLite local a PostgreSQL en produccion.

Uso (dentro del container backend):
    python /tmp/migrate_sqlite_to_pg.py

Requisitos:
    - Archivos .db copiados a /tmp/ en el container
    - DATABASE_URL configurada en el entorno
"""

import os
import sqlite3
import sys
import time

import psycopg2
import psycopg2.extras

# ============================================================================
# CONFIGURACION
# ============================================================================

SQLITE_DIR = "/tmp"
BATCH_SIZE = 1000

# Mapeo: (sqlite_file, sqlite_table) -> (pg_table, column_mapping)
# column_mapping: None = mismas columnas, o dict {sqlite_col: pg_col}
# Si pg_table tiene 'id' SERIAL y sqlite no tiene 'id', se omite del INSERT

MIGRATIONS = {
    # === spm.db ===
    "spm": {
        # Tabla principal de usuarios
        "usuario": {
            "pg_table": "usuarios",
            "truncate": True,
            "columns": None,  # Mismas columnas
        },
        # Solicitudes
        "solicitud": {
            "pg_table": "solicitudes",
            "truncate": True,
            "columns": None,
        },
        # Notificaciones
        "notificacion": {
            "pg_table": "notificaciones",
            "truncate": True,
            "columns": None,
        },
        # Presupuestos
        "presupuesto": {
            "pg_table": "presupuestos",
            "truncate": True,
            "columns": None,
        },
        # Presupuesto ledger
        "presupuesto_ledger": {
            "pg_table": "presupuesto_ledger",
            "truncate": True,
            "columns": None,
        },
        # BUR (Budget Update Requests)
        "presupuesto_solicitud_cambio": {
            "pg_table": "budget_update_requests",
            "truncate": True,
            "columns": None,  # Mismas columnas
        },
        # Proveedores externos
        "proveedor_externo": {
            "pg_table": "proveedores_externos",
            "truncate": True,
            "columns": None,
        },
        # Contactos de proveedores
        "proveedor_externo_contacto": {
            "pg_table": "proveedor_ext_contactos",
            "truncate": True,
            "columns": None,
        },
        # Emails de proveedores
        "proveedor_externo_email": {
            "pg_table": "proveedor_ext_emails",
            "truncate": True,
            "columns": None,
        },
        # Telefonos de proveedores
        "proveedor_externo_telefono": {
            "pg_table": "proveedor_ext_telefonos",
            "truncate": True,
            "columns": None,
        },
        # Proveedores internos
        "proveedor_interno": {
            "pg_table": "proveedores_internos",
            "truncate": True,
            "columns": None,
        },
        # Precios negociados
        "proveedor_precio_negociado": {
            "pg_table": "proveedor_precios_negociados",
            "truncate": True,
            "columns": None,
        },
        # Config equivalencia scores
        "config_equivalencia_scores": {
            "pg_table": "config_equivalencia_scores",
            "truncate": True,
            "columns": None,
        },
        # Decision abastecimiento
        "decision_abastecimiento": {
            "pg_table": "decision_abastecimiento",
            "truncate": True,
            "columns": None,
        },
        # Fuentes de decision
        "decision_abastecimiento_fuentes": {
            "pg_table": "decision_abastecimiento_fuentes",
            "truncate": True,
            "columns": None,
        },
        # Historial estados solicitud
        "solicitud_historial_estado": {
            "pg_table": "solicitudes_historial_estados",
            "truncate": True,
            "columns": None,
        },
        # Items tratamiento
        "solicitud_items_tratamiento": {
            "pg_table": "solicitud_items_tratamiento",
            "truncate": True,
            "columns": None,
        },
        # Tratamiento log
        "solicitud_tratamiento_log": {
            "pg_table": "solicitud_tratamiento_log",
            "truncate": True,
            "columns": None,
        },
        # Catalogos
        "catalogo_sector": {
            "pg_table": "catalog_sectores",
            "truncate": True,
            "columns": None,
        },
        "catalogo_centro": {
            "pg_table": "catalog_centros",
            "truncate": True,
            "columns": None,
        },
        "catalogo_almacen": {
            "pg_table": "catalog_almacenes",
            "truncate": True,
            "columns": None,
        },
        "catalogo_rol": {
            "pg_table": "catalog_roles",
            "truncate": True,
            "columns": None,
        },
        "catalogo_puesto": {
            "pg_table": "catalog_puestos",
            "truncate": True,
            "columns": None,
        },
        # Vertex IA tables
        "vertex_conversations": {
            "pg_table": "vertex_conversations",
            "truncate": True,
            "columns": None,
        },
        "vertex_messages": {
            "pg_table": "vertex_messages",
            "truncate": True,
            "columns": None,
        },
        "vertex_user_memory": {
            "pg_table": "vertex_user_memory",
            "truncate": True,
            "columns": None,
        },
        "vertex_proactive_alerts": {
            "pg_table": "vertex_proactive_alerts",
            "truncate": True,
            "columns": None,
        },
    },
    # === sap_data.db ===
    "sap_data": {
        "stock": {
            "pg_table": "sap_stock",
            "truncate": True,
            # Renombrar ypf/ute_desc -> ypf_ute_desc, omitir rowid
            "column_rename": {"ypf/ute_desc": "ypf_ute_desc"},
            "columns": None,
        },
        "consumo_historico": {
            "pg_table": "sap_consumo_historico",
            "truncate": True,
            "columns": None,
        },
        "pedidos_sap": {
            "pg_table": "sap_pedidos",
            "truncate": True,
            "columns": None,
        },
        "materiales_bbdd": {
            "pg_table": "sap_materiales_bbdd",
            "truncate": True,
            "columns": None,
        },
    },
    # === master_materiales.db ===
    "master_materiales": {
        "catalogo_materiales": {
            "pg_table": "cat_materiales",
            "truncate": True,
            "columns": None,
        },
        "materiales_equivalencias": {
            "pg_table": "cat_equivalencias",
            "truncate": True,
            "columns": None,
        },
    },
}

# Orden de truncado para respetar FK constraints
TRUNCATE_ORDER = [
    # Primero hijos (FK dependientes)
    "vertex_messages",
    "vertex_user_memory",
    "vertex_proactive_alerts",
    "vertex_conversations",
    "decision_abastecimiento_fuentes",
    "decision_abastecimiento",
    "solicitud_items_tratamiento",
    "solicitud_tratamiento_log",
    "solicitudes_historial_estados",
    "budget_update_requests",
    "presupuesto_ledger",
    "proveedor_ext_contactos",
    "proveedor_ext_emails",
    "proveedor_ext_telefonos",
    "proveedor_precios_negociados",
    "solicitudes",
    "notificaciones",
    "presupuestos",
    "proveedores_externos",
    "proveedores_internos",
    "config_equivalencia_scores",
    "catalog_sectores",
    "catalog_centros",
    "catalog_almacenes",
    "catalog_roles",
    "catalog_puestos",
    "usuarios",
    # SAP tables (no FK)
    "sap_stock",
    "sap_consumo_historico",
    "sap_pedidos",
    "sap_materiales_bbdd",
    # Catalog tables (no FK)
    "cat_materiales",
    "cat_equivalencias",
]

# Orden de insercion (padres primero)
INSERT_ORDER = [
    # Padres primero
    ("spm", "usuario"),
    ("spm", "catalogo_sector"),
    ("spm", "catalogo_centro"),
    ("spm", "catalogo_almacen"),
    ("spm", "catalogo_rol"),
    ("spm", "catalogo_puesto"),
    ("spm", "presupuesto"),
    ("spm", "proveedor_externo"),
    ("spm", "proveedor_interno"),
    ("spm", "config_equivalencia_scores"),
    # Hijos
    ("spm", "solicitud"),
    ("spm", "notificacion"),
    ("spm", "presupuesto_ledger"),
    ("spm", "presupuesto_solicitud_cambio"),
    ("spm", "proveedor_externo_contacto"),
    ("spm", "proveedor_externo_email"),
    ("spm", "proveedor_externo_telefono"),
    ("spm", "proveedor_precio_negociado"),
    ("spm", "decision_abastecimiento"),
    ("spm", "decision_abastecimiento_fuentes"),
    ("spm", "solicitud_historial_estado"),
    ("spm", "solicitud_items_tratamiento"),
    ("spm", "solicitud_tratamiento_log"),
    # Vertex
    ("spm", "vertex_conversations"),
    ("spm", "vertex_messages"),
    ("spm", "vertex_user_memory"),
    ("spm", "vertex_proactive_alerts"),
    # SAP
    ("sap_data", "stock"),
    ("sap_data", "consumo_historico"),
    ("sap_data", "pedidos_sap"),
    ("sap_data", "materiales_bbdd"),
    # Master materiales
    ("master_materiales", "catalogo_materiales"),
    ("master_materiales", "materiales_equivalencias"),
]


def create_vertex_tables(pg_conn):
    """Crea tablas vertex si no existen."""
    cur = pg_conn.cursor()

    print("\n=== Creando tablas vertex (si no existen) ===")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS vertex_conversations (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT,
            started_at TIMESTAMP DEFAULT NOW(),
            ended_at TIMESTAMP,
            context TEXT DEFAULT '{}',
            summary TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS vertex_messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER NOT NULL,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            tokens_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            metadata TEXT DEFAULT '{}'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS vertex_user_memory (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            fact_key VARCHAR(100) NOT NULL,
            fact_value TEXT NOT NULL,
            learned_at TIMESTAMP DEFAULT NOW(),
            confidence FLOAT DEFAULT 1.0,
            expires_at TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS vertex_proactive_alerts (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            alert_type VARCHAR(50) NOT NULL,
            priority INTEGER DEFAULT 5,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            context TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            shown_at TIMESTAMP,
            dismissed_at TIMESTAMP,
            actioned_at TIMESTAMP
        )
    """)

    pg_conn.commit()
    print("  Tablas vertex creadas/verificadas")


def get_sqlite_conn(db_name):
    """Obtiene conexion SQLite."""
    db_path = os.path.join(SQLITE_DIR, f"{db_name}.db")
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"SQLite no encontrado: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_pg_conn():
    """Obtiene conexion PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL no configurada")
    return psycopg2.connect(database_url)


def truncate_tables(pg_conn):
    """Trunca todas las tablas destino."""
    cur = pg_conn.cursor()
    print("\n=== Truncando tablas destino ===")

    for table in TRUNCATE_ORDER:
        try:
            cur.execute(f"TRUNCATE TABLE {table} CASCADE")
            print(f"  [OK] TRUNCATE {table}")
        except Exception as e:
            pg_conn.rollback()
            print(f"  [SKIP] {table}: {e}")

    pg_conn.commit()
    print("  Truncado completado")


def migrate_table(sqlite_conn, pg_conn, db_name, sqlite_table, config):
    """Migra una tabla de SQLite a PostgreSQL."""
    pg_table = config["pg_table"]
    column_rename = config.get("column_rename", {})

    # Leer datos de SQLite
    try:
        rows = sqlite_conn.execute(f"SELECT * FROM [{sqlite_table}]").fetchall()
    except Exception as e:
        print(f"  [ERROR] No se pudo leer {sqlite_table}: {e}")
        return 0

    if not rows:
        print(f"  [SKIP] {sqlite_table} -> {pg_table}: 0 filas")
        return 0

    # Obtener columnas de SQLite
    sqlite_cols = rows[0].keys()

    # Obtener columnas de PG con tipos
    pg_cur = pg_conn.cursor()
    pg_cur.execute(
        "SELECT column_name, data_type FROM information_schema.columns "
        f"WHERE table_name = %s ORDER BY ordinal_position",
        (pg_table,)
    )
    pg_cols_info = {r[0]: r[1] for r in pg_cur.fetchall()}

    # Mapear columnas SQLite -> PG
    col_mapping = []
    for sc in sqlite_cols:
        pg_col = column_rename.get(sc, sc)
        if pg_col in pg_cols_info:
            col_mapping.append((sc, pg_col, pg_cols_info[pg_col]))

    if not col_mapping:
        print(f"  [ERROR] No hay columnas comunes entre {sqlite_table} y {pg_table}")
        return 0

    pg_col_names = [m[1] for m in col_mapping]
    boolean_indices = {i for i, m in enumerate(col_mapping) if m[2] == "boolean"}
    placeholders = ", ".join(["%s"] * len(pg_col_names))
    col_list = ", ".join(pg_col_names)
    insert_sql = f"INSERT INTO {pg_table} ({col_list}) VALUES ({placeholders})"

    # Insertar en batches
    total = len(rows)
    inserted = 0

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        values = []
        for row in batch:
            row_data = []
            for idx, (sc, pc, dt) in enumerate(col_mapping):
                val = row[sc]
                # Convertir INTEGER 0/1 -> boolean para columnas PG boolean
                if idx in boolean_indices and isinstance(val, int):
                    val = bool(val)
                row_data.append(val)
            values.append(tuple(row_data))

        try:
            psycopg2.extras.execute_batch(pg_cur, insert_sql, values, page_size=100)
            inserted += len(batch)
        except Exception as e:
            pg_conn.rollback()
            print(f"  [ERROR] Batch {i}-{i+len(batch)} de {pg_table}: {e}")
            # Intentar fila por fila para encontrar la problematica
            for j, v in enumerate(values):
                try:
                    pg_cur.execute(insert_sql, v)
                    inserted += 1
                except Exception as e2:
                    print(f"    Fila {i+j} error: {e2}")
                    print(f"    Datos: {v[:5]}...")
                    pg_conn.rollback()

    pg_conn.commit()

    # Reset sequences si la tabla tiene id SERIAL
    if "id" in pg_cols_info and any(m[1] == "id" for m in col_mapping):
        try:
            pg_cur.execute(
                f"SELECT setval(pg_get_serial_sequence('{pg_table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {pg_table}), 0) + 1, false)"
            )
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()

    print(f"  [OK] {sqlite_table} -> {pg_table}: {inserted}/{total} filas")
    return inserted


def update_passwords(pg_conn):
    """Actualiza todas las contrasenas a bcrypt hash de '8300_@'."""
    import bcrypt

    password = "8300_@"
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    cur = pg_conn.cursor()
    cur.execute("UPDATE usuarios SET contrasena = %s", (hashed,))
    count = cur.rowcount
    pg_conn.commit()

    print(f"\n=== Passwords actualizados: {count} usuarios con password '8300_@' ===")


def verify_migration(pg_conn):
    """Verifica conteos post-migracion."""
    cur = pg_conn.cursor()

    print("\n" + "=" * 60)
    print("VERIFICACION POST-MIGRACION")
    print("=" * 60)

    tables_to_check = [
        ("usuarios", 120),
        ("solicitudes", 501),
        ("notificaciones", 8),
        ("presupuestos", 36),
        ("presupuesto_ledger", 1),
        ("budget_update_requests", 32),
        ("proveedores_externos", 18),
        ("proveedor_ext_contactos", 36),
        ("proveedor_ext_emails", 28),
        ("proveedor_ext_telefonos", 23),
        ("proveedores_internos", 25),
        ("proveedor_precios_negociados", 66),
        ("config_equivalencia_scores", 3),
        ("decision_abastecimiento", 1),
        ("decision_abastecimiento_fuentes", 2),
        ("solicitudes_historial_estados", 2),
        ("solicitud_items_tratamiento", 1),
        ("solicitud_tratamiento_log", 16),
        ("catalog_sectores", 6),
        ("catalog_centros", 6),
        ("catalog_almacenes", 6),
        ("catalog_roles", 4),
        ("catalog_puestos", 8),
        ("vertex_conversations", 2),
        ("vertex_messages", 18),
        ("vertex_user_memory", 2),
        ("sap_stock", 149997),
        ("sap_consumo_historico", 20424),
        ("sap_pedidos", 602),
        ("sap_materiales_bbdd", 7309),
        ("cat_materiales", 44461),
        ("cat_equivalencias", 180065),
    ]

    all_ok = True
    for table, expected in tables_to_check:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            actual = cur.fetchone()[0]
            status = "OK" if actual == expected else "MISMATCH"
            if status == "MISMATCH":
                all_ok = False
            print(f"  {table}: {actual}/{expected} {'✓' if status == 'OK' else '✗ MISMATCH'}")
        except Exception as e:
            all_ok = False
            print(f"  {table}: ERROR - {e}")
            pg_conn.rollback()

    return all_ok


def create_compatibility_views(pg_conn):
    """Crea vistas de compatibilidad post-025 (singular) si no existen."""
    cur = pg_conn.cursor()

    print("\n=== Creando vistas de compatibilidad (migr. 025 naming) ===")

    views = {
        # solicitud -> solicitudes (ya existe como tabla)
        # usuario -> usuarios (ya existe como vista)
        "presupuesto_solicitud_cambio":
            "SELECT * FROM budget_update_requests",
        "proveedor_externo":
            "SELECT * FROM proveedores_externos",
        "proveedor_interno":
            "SELECT * FROM proveedores_internos",
        "proveedor_externo_contacto":
            "SELECT * FROM proveedor_ext_contactos",
        "proveedor_externo_email":
            "SELECT * FROM proveedor_ext_emails",
        "proveedor_externo_telefono":
            "SELECT * FROM proveedor_ext_telefonos",
        "proveedor_precio_negociado":
            "SELECT * FROM proveedor_precios_negociados",
        "solicitud":
            "SELECT * FROM solicitudes",
        "presupuesto":
            "SELECT * FROM presupuestos",
        "notificacion":
            "SELECT * FROM notificaciones",
        "mensaje":
            "SELECT * FROM mensajes",
        "solicitud_historial_estado":
            "SELECT * FROM solicitudes_historial_estados",
        "catalogo_sector":
            "SELECT * FROM catalog_sectores",
        "catalogo_centro":
            "SELECT * FROM catalog_centros",
        "catalogo_almacen":
            "SELECT * FROM catalog_almacenes",
        "catalogo_rol":
            "SELECT * FROM catalog_roles",
        "catalogo_puesto":
            "SELECT * FROM catalog_puestos",
        "trivia_score":
            "SELECT * FROM trivias_scores",
        "solicitud_pedido_sap":
            "SELECT * FROM solpeds",
        "solicitud_traslado":
            "SELECT * FROM traslados",
        "orden_compra":
            "SELECT * FROM purchase_orders",
        "email_bandeja_salida":
            "SELECT * FROM outbox_emails",
        "notificacion_push_suscripcion":
            "SELECT * FROM push_subscriptions",
        "usuario_preferencia_notificacion":
            "SELECT * FROM user_notification_preferences" if False else None,
        "usuario_solicitud_perfil":
            "SELECT * FROM user_profile_requests",
    }

    for view_name, select_sql in views.items():
        if select_sql is None:
            continue
        try:
            cur.execute(f"CREATE OR REPLACE VIEW {view_name} AS {select_sql}")
            print(f"  [OK] Vista {view_name}")
        except Exception as e:
            pg_conn.rollback()
            print(f"  [SKIP] {view_name}: {e}")

    pg_conn.commit()
    print("  Vistas de compatibilidad creadas")


def main():
    """Ejecuta la migracion completa."""
    print("=" * 60)
    print("MIGRACION SQLite -> PostgreSQL")
    print(f"Directorio SQLite: {SQLITE_DIR}")
    print("=" * 60)

    # Verificar archivos SQLite
    for db in ["spm", "sap_data", "master_materiales"]:
        path = os.path.join(SQLITE_DIR, f"{db}.db")
        if not os.path.exists(path):
            print(f"ERROR: No se encuentra {path}")
            sys.exit(1)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  {db}.db: {size_mb:.1f} MB")

    # Conectar a PostgreSQL
    pg_conn = get_pg_conn()
    print(f"\nConectado a PostgreSQL")

    start_time = time.time()

    # Paso 0: Crear tablas vertex
    create_vertex_tables(pg_conn)

    # Paso 1: Truncar tablas destino
    truncate_tables(pg_conn)

    # Paso 2: Migrar datos en orden
    print("\n=== Migrando datos ===")
    total_rows = 0

    for db_name, sqlite_table in INSERT_ORDER:
        config = MIGRATIONS[db_name][sqlite_table]
        sqlite_conn = get_sqlite_conn(db_name)
        try:
            count = migrate_table(sqlite_conn, pg_conn, db_name, sqlite_table, config)
            total_rows += count
        finally:
            sqlite_conn.close()

    elapsed = time.time() - start_time
    print(f"\nTotal migrado: {total_rows:,} filas en {elapsed:.1f}s")

    # Paso 3: Actualizar passwords
    update_passwords(pg_conn)

    # Paso 4: Crear vistas de compatibilidad
    create_compatibility_views(pg_conn)

    # Paso 5: Verificar
    all_ok = verify_migration(pg_conn)

    pg_conn.close()

    print("\n" + "=" * 60)
    if all_ok:
        print("MIGRACION COMPLETADA EXITOSAMENTE")
    else:
        print("MIGRACION COMPLETADA CON DISCREPANCIAS")
    print("=" * 60)

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
