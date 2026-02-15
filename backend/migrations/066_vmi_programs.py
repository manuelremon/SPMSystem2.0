"""
Migración 066: Vendor Managed Inventory (VMI) Programs
Fecha: 2026-02-15
Descripción: Implementa programas VMI con inventario compartido, reposición automática y KPIs de desempeño
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_programa (
                id SERIAL PRIMARY KEY,
                proveedor_cuit TEXT NOT NULL,
                nombre TEXT NOT NULL,
                material_codigo TEXT,
                centro_id INTEGER,
                almacen_id INTEGER,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'active', 'suspended', 'terminated')),
                tipo_reposicion TEXT CHECK (tipo_reposicion IN ('min_max', 'eoq', 'periodic', 'forecast_based')),
                min_stock REAL DEFAULT 0,
                max_stock REAL DEFAULT 0,
                punto_pedido REAL DEFAULT 0,
                cantidad_pedido REAL DEFAULT 0,
                frecuencia_dias INTEGER DEFAULT 30,
                responsable_proveedor TEXT,
                responsable_interno INTEGER,
                fecha_inicio TIMESTAMP,
                fecha_fin TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(proveedor_cuit, material_codigo, centro_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_inventario_compartido (
                id SERIAL PRIMARY KEY,
                programa_id INTEGER REFERENCES vmi_programa(id) ON DELETE CASCADE,
                fecha DATE NOT NULL,
                stock_disponible REAL DEFAULT 0,
                stock_reservado REAL DEFAULT 0,
                stock_en_transito REAL DEFAULT 0,
                consumo_diario_promedio REAL DEFAULT 0,
                dias_inventario REAL DEFAULT 0,
                stock_proyectado_7d REAL DEFAULT 0,
                alerta TEXT DEFAULT 'ok' CHECK (alerta IN ('stock_bajo', 'reposicion_sugerida', 'ok')),
                sincronizado_por TEXT DEFAULT 'internal' CHECK (sincronizado_por IN ('internal', 'supplier')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(programa_id, fecha)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_reposicion (
                id SERIAL PRIMARY KEY,
                programa_id INTEGER REFERENCES vmi_programa(id) ON DELETE CASCADE,
                tipo TEXT CHECK (tipo IN ('automatic', 'manual', 'supplier_initiated')),
                cantidad_sugerida REAL,
                cantidad_aprobada REAL,
                fecha_sugerida TIMESTAMP,
                fecha_entrega_esperada TIMESTAMP,
                estado TEXT DEFAULT 'suggested' CHECK (estado IN ('suggested', 'approved', 'rejected', 'in_progress', 'delivered', 'cancelled')),
                orden_compra_id INTEGER,
                razon_rechazo TEXT,
                aprobado_por INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_kpi_snapshot (
                id SERIAL PRIMARY KEY,
                programa_id INTEGER REFERENCES vmi_programa(id) ON DELETE CASCADE,
                periodo TEXT NOT NULL,
                stockout_count INTEGER DEFAULT 0,
                dias_stockout INTEGER DEFAULT 0,
                fill_rate REAL DEFAULT 0,
                inventory_turnover REAL DEFAULT 0,
                lead_time_avg REAL DEFAULT 0,
                costo_almacenamiento REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(programa_id, periodo)
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_programa (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proveedor_cuit TEXT NOT NULL,
                nombre TEXT NOT NULL,
                material_codigo TEXT,
                centro_id INTEGER,
                almacen_id INTEGER,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'active', 'suspended', 'terminated')),
                tipo_reposicion TEXT CHECK (tipo_reposicion IN ('min_max', 'eoq', 'periodic', 'forecast_based')),
                min_stock REAL DEFAULT 0,
                max_stock REAL DEFAULT 0,
                punto_pedido REAL DEFAULT 0,
                cantidad_pedido REAL DEFAULT 0,
                frecuencia_dias INTEGER DEFAULT 30,
                responsable_proveedor TEXT,
                responsable_interno INTEGER,
                fecha_inicio TEXT,
                fecha_fin TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(proveedor_cuit, material_codigo, centro_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_inventario_compartido (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                programa_id INTEGER,
                fecha TEXT NOT NULL,
                stock_disponible REAL DEFAULT 0,
                stock_reservado REAL DEFAULT 0,
                stock_en_transito REAL DEFAULT 0,
                consumo_diario_promedio REAL DEFAULT 0,
                dias_inventario REAL DEFAULT 0,
                stock_proyectado_7d REAL DEFAULT 0,
                alerta TEXT DEFAULT 'ok' CHECK (alerta IN ('stock_bajo', 'reposicion_sugerida', 'ok')),
                sincronizado_por TEXT DEFAULT 'internal' CHECK (sincronizado_por IN ('internal', 'supplier')),
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(programa_id, fecha),
                FOREIGN KEY (programa_id) REFERENCES vmi_programa(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_reposicion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                programa_id INTEGER,
                tipo TEXT CHECK (tipo IN ('automatic', 'manual', 'supplier_initiated')),
                cantidad_sugerida REAL,
                cantidad_aprobada REAL,
                fecha_sugerida TEXT,
                fecha_entrega_esperada TEXT,
                estado TEXT DEFAULT 'suggested' CHECK (estado IN ('suggested', 'approved', 'rejected', 'in_progress', 'delivered', 'cancelled')),
                orden_compra_id INTEGER,
                razon_rechazo TEXT,
                aprobado_por INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (programa_id) REFERENCES vmi_programa(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vmi_kpi_snapshot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                programa_id INTEGER,
                periodo TEXT NOT NULL,
                stockout_count INTEGER DEFAULT 0,
                dias_stockout INTEGER DEFAULT 0,
                fill_rate REAL DEFAULT 0,
                inventory_turnover REAL DEFAULT 0,
                lead_time_avg REAL DEFAULT 0,
                costo_almacenamiento REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(programa_id, periodo),
                FOREIGN KEY (programa_id) REFERENCES vmi_programa(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vmi_programa_estado ON vmi_programa(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vmi_programa_proveedor ON vmi_programa(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vmi_inv_programa ON vmi_inventario_compartido(programa_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vmi_inv_fecha ON vmi_inventario_compartido(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vmi_repo_estado ON vmi_reposicion(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vmi_kpi_programa ON vmi_kpi_snapshot(programa_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 066: VMI Programs - Tablas vmi_programa, vmi_inventario_compartido, vmi_reposicion, vmi_kpi_snapshot creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_vmi_kpi_programa")
    cursor.execute("DROP INDEX IF EXISTS idx_vmi_repo_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_vmi_inv_fecha")
    cursor.execute("DROP INDEX IF EXISTS idx_vmi_inv_programa")
    cursor.execute("DROP INDEX IF EXISTS idx_vmi_programa_proveedor")
    cursor.execute("DROP INDEX IF EXISTS idx_vmi_programa_estado")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS vmi_kpi_snapshot")
    cursor.execute("DROP TABLE IF EXISTS vmi_reposicion")
    cursor.execute("DROP TABLE IF EXISTS vmi_inventario_compartido")
    cursor.execute("DROP TABLE IF EXISTS vmi_programa")

    conn.commit()
    conn.close()

    print("✅ Migración 066: Revertida exitosamente")


if __name__ == '__main__':
    up()
