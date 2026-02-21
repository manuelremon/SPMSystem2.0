"""
Migracion 051: Tablas RFQ Award (Evaluacion y Adjudicacion)
Fecha: 2026-02-15
Sprints 57-58: RFQ Evaluation & Award
"""

def upgrade(cursor, db_type):
    """
    Crea las tablas de evaluacion y adjudicacion del sistema RFQ:
    - rfq_criterio_evaluacion: Criterios de evaluacion por RFQ
    - rfq_evaluacion: Puntajes calculados por proveedor
    - rfq_adjudicacion: Items adjudicados a proveedores
    """

    if db_type == "postgresql":
        # Tabla rfq_criterio_evaluacion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_criterio_evaluacion (
                id SERIAL PRIMARY KEY,
                rfq_id INTEGER NOT NULL,
                criterio TEXT CHECK (criterio IN ('price', 'lead_time', 'quality', 'payment_terms')),
                peso_porcentaje REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_evaluacion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_evaluacion (
                id SERIAL PRIMARY KEY,
                rfq_id INTEGER NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                puntaje_total REAL,
                puntaje_precio REAL,
                puntaje_lead_time REAL,
                puntaje_calidad REAL,
                puntaje_terminos REAL,
                evaluado_por TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
                FOREIGN KEY (evaluado_por) REFERENCES usuarios(id_spm) ON DELETE SET NULL
            )
        """)

        # Tabla rfq_adjudicacion
        # Nota: orden_compra_id sin FK porque orden_compra es una vista en PG (migracion 020)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_adjudicacion (
                id SERIAL PRIMARY KEY,
                rfq_id INTEGER NOT NULL,
                rfq_item_id INTEGER NOT NULL,
                proveedor_ganador_cuit TEXT NOT NULL,
                precio_adjudicado REAL NOT NULL,
                cantidad_adjudicada REAL NOT NULL,
                orden_compra_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
                FOREIGN KEY (rfq_item_id) REFERENCES rfq_item(id) ON DELETE CASCADE
            )
        """)

    else:  # SQLite
        # Tabla rfq_criterio_evaluacion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_criterio_evaluacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rfq_id INTEGER NOT NULL,
                criterio TEXT CHECK (criterio IN ('price', 'lead_time', 'quality', 'payment_terms')),
                peso_porcentaje REAL NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
            )
        """)

        # Tabla rfq_evaluacion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_evaluacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rfq_id INTEGER NOT NULL,
                proveedor_cuit TEXT NOT NULL,
                puntaje_total REAL,
                puntaje_precio REAL,
                puntaje_lead_time REAL,
                puntaje_calidad REAL,
                puntaje_terminos REAL,
                evaluado_por TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
                FOREIGN KEY (evaluado_por) REFERENCES usuarios(id_spm) ON DELETE SET NULL
            )
        """)

        # Tabla rfq_adjudicacion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rfq_adjudicacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rfq_id INTEGER NOT NULL,
                rfq_item_id INTEGER NOT NULL,
                proveedor_ganador_cuit TEXT NOT NULL,
                precio_adjudicado REAL NOT NULL,
                cantidad_adjudicada REAL NOT NULL,
                orden_compra_id INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
                FOREIGN KEY (rfq_item_id) REFERENCES rfq_item(id) ON DELETE CASCADE,
                FOREIGN KEY (orden_compra_id) REFERENCES orden_compra(id) ON DELETE SET NULL
            )
        """)

    # Indices para optimizar consultas
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_criterio_rfq ON rfq_criterio_evaluacion(rfq_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_eval_rfq ON rfq_evaluacion(rfq_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rfq_adj_rfq ON rfq_adjudicacion(rfq_id)")


def downgrade(cursor, db_type):
    """Elimina las tablas de evaluacion y adjudicacion en orden inverso"""
    cursor.execute("DROP TABLE IF EXISTS rfq_adjudicacion")
    cursor.execute("DROP TABLE IF EXISTS rfq_evaluacion")
    cursor.execute("DROP TABLE IF EXISTS rfq_criterio_evaluacion")
