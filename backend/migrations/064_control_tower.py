"""
Migración 064: Control Tower - Real-time Event Tracking & KPIs
Fecha: 2026-02-15
Descripción: Implementa torre de control con eventos en tiempo real, KPIs agregados y alertas consolidadas
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_tower_event (
                id SERIAL PRIMARY KEY,
                evento_tipo TEXT NOT NULL,
                entidad_tipo TEXT,
                entidad_id INTEGER,
                severidad TEXT CHECK (severidad IN ('info', 'warning', 'critical', 'success')),
                titulo TEXT NOT NULL,
                descripcion TEXT,
                centro_id INTEGER,
                proveedor_cuit TEXT,
                categoria TEXT CHECK (categoria IN ('procurement', 'logistics', 'quality', 'planning', 'finance')),
                metadata TEXT,
                leido INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_tower_kpi_snapshot (
                id SERIAL PRIMARY KEY,
                periodo TEXT NOT NULL,
                kpi_key TEXT NOT NULL,
                valor REAL,
                categoria TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(periodo, kpi_key)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_tower_alerta_agregada (
                id SERIAL PRIMARY KEY,
                tipo TEXT CHECK (tipo IN ('sla_breach', 'stock_critical', 'quality_issue', 'supplier_risk')),
                prioridad TEXT CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
                cantidad INTEGER DEFAULT 0,
                titulo TEXT NOT NULL,
                entidades TEXT,
                categoria TEXT,
                ultima_ocurrencia TIMESTAMP,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'acknowledged', 'resolved')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_tower_event (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                evento_tipo TEXT NOT NULL,
                entidad_tipo TEXT,
                entidad_id INTEGER,
                severidad TEXT CHECK (severidad IN ('info', 'warning', 'critical', 'success')),
                titulo TEXT NOT NULL,
                descripcion TEXT,
                centro_id INTEGER,
                proveedor_cuit TEXT,
                categoria TEXT CHECK (categoria IN ('procurement', 'logistics', 'quality', 'planning', 'finance')),
                metadata TEXT,
                leido INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_tower_kpi_snapshot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                periodo TEXT NOT NULL,
                kpi_key TEXT NOT NULL,
                valor REAL,
                categoria TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(periodo, kpi_key)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS control_tower_alerta_agregada (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT CHECK (tipo IN ('sla_breach', 'stock_critical', 'quality_issue', 'supplier_risk')),
                prioridad TEXT CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
                cantidad INTEGER DEFAULT 0,
                titulo TEXT NOT NULL,
                entidades TEXT,
                categoria TEXT,
                ultima_ocurrencia TEXT,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'acknowledged', 'resolved')),
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ct_event_categoria ON control_tower_event(categoria)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ct_event_entidad ON control_tower_event(entidad_tipo, entidad_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ct_event_created ON control_tower_event(created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ct_kpi_periodo ON control_tower_kpi_snapshot(periodo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ct_alerta_estado ON control_tower_alerta_agregada(estado)")

    conn.commit()
    conn.close()

    print("✅ Migración 064: Control Tower - Tablas control_tower_event, control_tower_kpi_snapshot, control_tower_alerta_agregada creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_ct_alerta_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_ct_kpi_periodo")
    cursor.execute("DROP INDEX IF EXISTS idx_ct_event_created")
    cursor.execute("DROP INDEX IF EXISTS idx_ct_event_entidad")
    cursor.execute("DROP INDEX IF EXISTS idx_ct_event_categoria")

    # Eliminar tablas
    cursor.execute("DROP TABLE IF EXISTS control_tower_alerta_agregada")
    cursor.execute("DROP TABLE IF EXISTS control_tower_kpi_snapshot")
    cursor.execute("DROP TABLE IF EXISTS control_tower_event")

    conn.commit()
    conn.close()

    print("✅ Migración 064: Revertida exitosamente")


if __name__ == '__main__':
    up()
