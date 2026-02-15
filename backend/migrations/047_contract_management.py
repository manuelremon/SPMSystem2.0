"""
Migración 047: Tablas de gestión de contratos
Fecha: 2026-02-15
Sprints: 54-56

Crea las tablas base para el módulo de gestión de contratos:
- contrato: contratos con proveedores (blanket PO, fixed price, etc.)
- contrato_historial: log de cambios de estado
"""

from backend.core.db import get_db_transaction, is_using_postgresql


def up():
    """Crear tablas de gestión de contratos"""
    with get_db_transaction() as (conn, cursor):
        is_pg = is_using_postgresql()

        # Tabla: contrato
        if is_pg:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato (
                    id SERIAL PRIMARY KEY,
                    numero_contrato TEXT UNIQUE NOT NULL,
                    tipo TEXT NOT NULL CHECK(tipo IN ('blanket_po', 'fixed_price', 'time_materials', 'framework')),
                    proveedor_cuit TEXT NOT NULL,
                    proveedor_nombre TEXT NOT NULL,
                    estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'under_negotiation', 'active', 'suspended', 'expired', 'terminated')),
                    fecha_inicio TIMESTAMP,
                    fecha_vencimiento TIMESTAMP,
                    valor_total REAL DEFAULT 0,
                    moneda TEXT DEFAULT 'ARS',
                    centro TEXT,
                    notas TEXT,
                    creado_por INTEGER NOT NULL,
                    aprobado_por INTEGER,
                    alerta_vencimiento INTEGER DEFAULT 0,
                    deleted INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    numero_contrato TEXT UNIQUE NOT NULL,
                    tipo TEXT NOT NULL CHECK(tipo IN ('blanket_po', 'fixed_price', 'time_materials', 'framework')),
                    proveedor_cuit TEXT NOT NULL,
                    proveedor_nombre TEXT NOT NULL,
                    estado TEXT DEFAULT 'draft' CHECK(estado IN ('draft', 'under_negotiation', 'active', 'suspended', 'expired', 'terminated')),
                    fecha_inicio TEXT,
                    fecha_vencimiento TEXT,
                    valor_total REAL DEFAULT 0,
                    moneda TEXT DEFAULT 'ARS',
                    centro TEXT,
                    notas TEXT,
                    creado_por INTEGER NOT NULL,
                    aprobado_por INTEGER,
                    alerta_vencimiento INTEGER DEFAULT 0,
                    deleted INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)

        # Tabla: contrato_historial
        if is_pg:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato_historial (
                    id SERIAL PRIMARY KEY,
                    contrato_id INTEGER NOT NULL,
                    estado_anterior TEXT,
                    estado_nuevo TEXT NOT NULL,
                    actor_id INTEGER NOT NULL,
                    razon TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contrato_historial (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    contrato_id INTEGER NOT NULL,
                    estado_anterior TEXT,
                    estado_nuevo TEXT NOT NULL,
                    actor_id INTEGER NOT NULL,
                    razon TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
                )
            """)

        # Índices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_estado ON contrato(estado)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_proveedor ON contrato(proveedor_cuit)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_tipo ON contrato(tipo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_contrato_vencimiento ON contrato(fecha_vencimiento)")

        conn.commit()
        print("✓ Migración 047: Tablas de contratos creadas")


def down():
    """Revertir tablas de gestión de contratos"""
    with get_db_transaction() as (conn, cursor):
        cursor.execute("DROP TABLE IF EXISTS contrato_historial")
        cursor.execute("DROP TABLE IF EXISTS contrato")
        conn.commit()
        print("✓ Migración 047: Tablas de contratos eliminadas")


if __name__ == "__main__":
    up()
