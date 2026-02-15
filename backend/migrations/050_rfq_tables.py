"""
Migracion 050: Tablas RFQ (Request for Quotation)
Fecha: 2026-02-15
Sprints 57-58: RFQ Creation, Bidding & Award
"""

def upgrade(cursor, db_type):
    """
    Crea las tablas principales del sistema RFQ:
    - rfq: Solicitudes de cotizacion
    - rfq_item: Items/materiales de cada RFQ
    - rfq_proveedor: Proveedores invitados a cada RFQ
    - rfq_oferta: Ofertas enviadas por proveedores
    """

    if db_type == "postgresql":
        # Tabla rfq
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq (
                id SERIAL PRIMARY KEY,
                numero_rfq TEXT UNIQUE NOT NULL,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'published', 'bidding', 'evaluation', 'awarded', 'cancelled')),
                titulo TEXT NOT NULL,
                descripcion TEXT,
                fecha_publicacion TIMESTAMP,
                fecha_cierre_ofertas TIMESTAMP,
                solicitud_id INTEGER,
                creado_por INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL,
                FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_item
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_item (
                id SERIAL PRIMARY KEY,
                rfq_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                material_descripcion TEXT,
                cantidad_solicitada REAL NOT NULL,
                unidad TEXT DEFAULT 'UN',
                especificaciones TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_proveedor
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_proveedor (
                id SERIAL PRIMARY KEY,
                rfq_id INTEGER NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                proveedor_nombre TEXT,
                estado_respuesta TEXT DEFAULT 'invited' CHECK (estado_respuesta IN ('invited', 'declined', 'submitted')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_oferta
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_oferta (
                id SERIAL PRIMARY KEY,
                rfq_id INTEGER NOT NULL,
                rfq_item_id INTEGER NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                precio_unitario REAL NOT NULL,
                moneda TEXT DEFAULT 'ARS',
                lead_time_dias INTEGER,
                terminos_pago TEXT,
                notas TEXT,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
                FOREIGN KEY (rfq_item_id) REFERENCES rfq_item(id) ON DELETE CASCADE
            )
        """)

    else:  # SQLite
        # Tabla rfq
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_rfq TEXT UNIQUE NOT NULL,
                estado TEXT DEFAULT 'draft' CHECK (estado IN ('draft', 'published', 'bidding', 'evaluation', 'awarded', 'cancelled')),
                titulo TEXT NOT NULL,
                descripcion TEXT,
                fecha_publicacion TEXT,
                fecha_cierre_ofertas TEXT,
                solicitud_id INTEGER,
                creado_por INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL,
                FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_item
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_item (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rfq_id INTEGER NOT NULL,
                material_codigo TEXT NOT NULL,
                material_descripcion TEXT,
                cantidad_solicitada REAL NOT NULL,
                unidad TEXT DEFAULT 'UN',
                especificaciones TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_proveedor
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_proveedor (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rfq_id INTEGER NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                proveedor_nombre TEXT,
                estado_respuesta TEXT DEFAULT 'invited' CHECK (estado_respuesta IN ('invited', 'declined', 'submitted')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_oferta
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_oferta (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rfq_id INTEGER NOT NULL,
                rfq_item_id INTEGER NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                precio_unitario REAL NOT NULL,
                moneda TEXT DEFAULT 'ARS',
                lead_time_dias INTEGER,
                terminos_pago TEXT,
                notas TEXT,
                submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
                FOREIGN KEY (rfq_item_id) REFERENCES rfq_item(id) ON DELETE CASCADE
            )
        """)

    # Indices para optimizar consultas
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_estado ON rfq(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_creado_por ON rfq(creado_por)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_item_rfq ON rfq_item(rfq_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_proveedor_rfq ON rfq_proveedor(rfq_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_oferta_rfq ON rfq_oferta(rfq_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_oferta_proveedor ON rfq_oferta(proveedor_cuit)")


def downgrade(cursor, db_type):
    """Elimina las tablas RFQ en orden inverso"""
    cursor.execute("DROP TABLE IF EXISTS rfq_oferta")
    cursor.execute("DROP TABLE IF EXISTS rfq_proveedor")
    cursor.execute("DROP TABLE IF EXISTS rfq_item")
    cursor.execute("DROP TABLE IF EXISTS rfq")
