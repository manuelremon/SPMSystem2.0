"""
Migración 046: Tablas de Inventory Aging y SLOB (Slow-moving and Obsolete)

Sprint 53: Inventory Aging & SLOB
- inventario_aging: Snapshots de aging analysis
- slob_disposicion: Propuestas de disposición de inventario SLOB

Fecha: 2026-02-15
"""

def upgrade_sqlite(conn):
    """Aplicar migración en SQLite (desarrollo)"""
    cursor = conn.cursor()

    # Tabla: inventario_aging
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventario_aging (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_codigo TEXT NOT NULL,
        almacen TEXT NOT NULL,
        cantidad REAL NOT NULL DEFAULT 0,
        valor REAL NOT NULL DEFAULT 0,
        fecha_ultimo_movimiento TEXT,
        dias_sin_movimiento INTEGER DEFAULT 0,
        categoria_aging TEXT NOT NULL CHECK (
            categoria_aging IN ('0-30', '31-60', '61-90', '91-180', '180+')
        ),
        es_slob INTEGER DEFAULT 0,
        snapshot_date TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Tabla: slob_disposicion
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS slob_disposicion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_codigo TEXT NOT NULL,
        almacen TEXT NOT NULL,
        cantidad REAL NOT NULL,
        tipo_disposicion TEXT NOT NULL CHECK (
            tipo_disposicion IN ('scrap', 'transfer', 'discount_sale', 'rework', 'donate')
        ),
        estado TEXT DEFAULT 'proposed' CHECK (
            estado IN ('proposed', 'approved', 'completed')
        ),
        notas TEXT,
        costo_recuperado REAL DEFAULT 0,
        propuesto_por INTEGER NOT NULL,
        aprobado_por INTEGER,
        completado_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (propuesto_por) REFERENCES usuarios(id),
        FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
    )
    """)

    # Índices para inventario_aging
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_material
    ON inventario_aging(material_codigo)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_categoria
    ON inventario_aging(categoria_aging)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_slob
    ON inventario_aging(es_slob)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_snapshot
    ON inventario_aging(snapshot_date)
    """)

    # Índices para slob_disposicion
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_disp_material
    ON slob_disposicion(material_codigo)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_disp_estado
    ON slob_disposicion(estado)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_disp_tipo
    ON slob_disposicion(tipo_disposicion)
    """)

    conn.commit()
    print("✓ Migración 046 (SQLite): Tablas de Inventory Aging y SLOB creadas")


def upgrade_postgresql(conn):
    """Aplicar migración en PostgreSQL (producción)"""
    cursor = conn.cursor()

    # Tabla: inventario_aging
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventario_aging (
        id SERIAL PRIMARY KEY,
        material_codigo TEXT NOT NULL,
        almacen TEXT NOT NULL,
        cantidad REAL NOT NULL DEFAULT 0,
        valor REAL NOT NULL DEFAULT 0,
        fecha_ultimo_movimiento TIMESTAMP,
        dias_sin_movimiento INTEGER DEFAULT 0,
        categoria_aging TEXT NOT NULL CHECK (
            categoria_aging IN ('0-30', '31-60', '61-90', '91-180', '180+')
        ),
        es_slob INTEGER DEFAULT 0,
        snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Tabla: slob_disposicion
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS slob_disposicion (
        id SERIAL PRIMARY KEY,
        material_codigo TEXT NOT NULL,
        almacen TEXT NOT NULL,
        cantidad REAL NOT NULL,
        tipo_disposicion TEXT NOT NULL CHECK (
            tipo_disposicion IN ('scrap', 'transfer', 'discount_sale', 'rework', 'donate')
        ),
        estado TEXT DEFAULT 'proposed' CHECK (
            estado IN ('proposed', 'approved', 'completed')
        ),
        notas TEXT,
        costo_recuperado REAL DEFAULT 0,
        propuesto_por INTEGER NOT NULL,
        aprobado_por INTEGER,
        completado_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (propuesto_por) REFERENCES usuarios(id),
        FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
    )
    """)

    # Índices para inventario_aging
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_material
    ON inventario_aging(material_codigo)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_categoria
    ON inventario_aging(categoria_aging)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_slob
    ON inventario_aging(es_slob)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_aging_snapshot
    ON inventario_aging(snapshot_date)
    """)

    # Índices para slob_disposicion
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_disp_material
    ON slob_disposicion(material_codigo)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_disp_estado
    ON slob_disposicion(estado)
    """)

    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_disp_tipo
    ON slob_disposicion(tipo_disposicion)
    """)

    conn.commit()
    print("✓ Migración 046 (PostgreSQL): Tablas de Inventory Aging y SLOB creadas")


def downgrade_sqlite(conn):
    """Revertir migración en SQLite"""
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS slob_disposicion")
    cursor.execute("DROP TABLE IF EXISTS inventario_aging")
    conn.commit()
    print("✓ Migración 046 (SQLite): Revertida")


def downgrade_postgresql(conn):
    """Revertir migración en PostgreSQL"""
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS slob_disposicion")
    cursor.execute("DROP TABLE IF EXISTS inventario_aging")
    conn.commit()
    print("✓ Migración 046 (PostgreSQL): Revertida")


def upgrade(db_type="sqlite"):
    """Entry point para aplicar migración"""
    from backend.core.db import get_db_connection

    conn = get_db_connection()
    try:
        if db_type == "postgresql":
            upgrade_postgresql(conn)
        else:
            upgrade_sqlite(conn)
    finally:
        conn.close()


def downgrade(db_type="sqlite"):
    """Entry point para revertir migración"""
    from backend.core.db import get_db_connection

    conn = get_db_connection()
    try:
        if db_type == "postgresql":
            downgrade_postgresql(conn)
        else:
            downgrade_sqlite(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    db_type = sys.argv[1] if len(sys.argv) > 1 else "sqlite"
    upgrade(db_type)
