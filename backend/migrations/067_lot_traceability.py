"""
Migración 067: Lot Traceability & Recall Management
Fecha: 2026-02-15
Descripción: Implementa trazabilidad de lotes, genealogía, movimientos y gestión de recalls
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_using_postgresql():
        # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lote (
                id SERIAL PRIMARY KEY,
                numero_lote TEXT UNIQUE NOT NULL,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                orden_compra_id INTEGER,
                cantidad_inicial REAL,
                cantidad_disponible REAL,
                unidad TEXT,
                fecha_fabricacion TIMESTAMP,
                fecha_vencimiento TIMESTAMP,
                fecha_recepcion TIMESTAMP,
                almacen_id INTEGER,
                ubicacion TEXT,
                estado TEXT DEFAULT 'available' CHECK (estado IN ('available', 'reserved', 'consumed', 'blocked', 'recalled')),
                calidad_estado TEXT DEFAULT 'pending' CHECK (calidad_estado IN ('pending', 'approved', 'rejected', 'quarantine')),
                inspeccion_id INTEGER,
                certificado_calidad_path TEXT,
                bloqueado_razon TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lote_movimiento (
                id SERIAL PRIMARY KEY,
                lote_id INTEGER REFERENCES lote(id) ON DELETE CASCADE,
                tipo TEXT CHECK (tipo IN ('recepcion', 'consumo', 'transferencia', 'ajuste', 'bloqueo', 'desbloqueo')),
                cantidad REAL,
                origen_ubicacion TEXT,
                destino_ubicacion TEXT,
                solicitud_id INTEGER,
                orden_produccion TEXT,
                usuario_id INTEGER,
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lote_genealogia (
                id SERIAL PRIMARY KEY,
                lote_padre_id INTEGER REFERENCES lote(id) ON DELETE CASCADE,
                lote_hijo_id INTEGER REFERENCES lote(id) ON DELETE CASCADE,
                relacion TEXT CHECK (relacion IN ('componente_producto', 'reproceso', 'split', 'merge')),
                cantidad_utilizada REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(lote_padre_id, lote_hijo_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recall (
                id SERIAL PRIMARY KEY,
                numero_recall TEXT UNIQUE NOT NULL,
                titulo TEXT NOT NULL,
                severidad TEXT CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
                tipo TEXT CHECK (tipo IN ('quality', 'safety', 'regulatory', 'voluntary')),
                razon TEXT,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                lotes_afectados TEXT,
                cantidad_total_afectada REAL DEFAULT 0,
                fecha_inicio TIMESTAMP,
                fecha_cierre TIMESTAMP,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'investigating', 'in_progress', 'completed', 'cancelled')),
                responsable_id INTEGER,
                plan_accion TEXT,
                costo_estimado REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recall_lote (
                id SERIAL PRIMARY KEY,
                recall_id INTEGER REFERENCES recall(id) ON DELETE CASCADE,
                lote_id INTEGER REFERENCES lote(id) ON DELETE CASCADE,
                cantidad_afectada REAL,
                ubicacion_actual TEXT,
                estado_recuperacion TEXT DEFAULT 'pending' CHECK (estado_recuperacion IN ('pending', 'identified', 'retrieved', 'disposed')),
                fecha_recuperacion TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(recall_id, lote_id)
            )
        """)

    else:
        # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lote (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_lote TEXT UNIQUE NOT NULL,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                orden_compra_id INTEGER,
                cantidad_inicial REAL,
                cantidad_disponible REAL,
                unidad TEXT,
                fecha_fabricacion TEXT,
                fecha_vencimiento TEXT,
                fecha_recepcion TEXT,
                almacen_id INTEGER,
                ubicacion TEXT,
                estado TEXT DEFAULT 'available' CHECK (estado IN ('available', 'reserved', 'consumed', 'blocked', 'recalled')),
                calidad_estado TEXT DEFAULT 'pending' CHECK (calidad_estado IN ('pending', 'approved', 'rejected', 'quarantine')),
                inspeccion_id INTEGER,
                certificado_calidad_path TEXT,
                bloqueado_razon TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lote_movimiento (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lote_id INTEGER,
                tipo TEXT CHECK (tipo IN ('recepcion', 'consumo', 'transferencia', 'ajuste', 'bloqueo', 'desbloqueo')),
                cantidad REAL,
                origen_ubicacion TEXT,
                destino_ubicacion TEXT,
                solicitud_id INTEGER,
                orden_produccion TEXT,
                usuario_id INTEGER,
                observaciones TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (lote_id) REFERENCES lote(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS lote_genealogia (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lote_padre_id INTEGER,
                lote_hijo_id INTEGER,
                relacion TEXT CHECK (relacion IN ('componente_producto', 'reproceso', 'split', 'merge')),
                cantidad_utilizada REAL,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(lote_padre_id, lote_hijo_id),
                FOREIGN KEY (lote_padre_id) REFERENCES lote(id) ON DELETE CASCADE,
                FOREIGN KEY (lote_hijo_id) REFERENCES lote(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recall (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_recall TEXT UNIQUE NOT NULL,
                titulo TEXT NOT NULL,
                severidad TEXT CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
                tipo TEXT CHECK (tipo IN ('quality', 'safety', 'regulatory', 'voluntary')),
                razon TEXT,
                material_codigo TEXT,
                proveedor_cuit TEXT,
                lotes_afectados TEXT,
                cantidad_total_afectada REAL DEFAULT 0,
                fecha_inicio TEXT,
                fecha_cierre TEXT,
                estado TEXT DEFAULT 'active' CHECK (estado IN ('active', 'investigating', 'in_progress', 'completed', 'cancelled')),
                responsable_id INTEGER,
                plan_accion TEXT,
                costo_estimado REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recall_lote (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recall_id INTEGER,
                lote_id INTEGER,
                cantidad_afectada REAL,
                ubicacion_actual TEXT,
                estado_recuperacion TEXT DEFAULT 'pending' CHECK (estado_recuperacion IN ('pending', 'identified', 'retrieved', 'disposed')),
                fecha_recuperacion TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(recall_id, lote_id),
                FOREIGN KEY (recall_id) REFERENCES recall(id) ON DELETE CASCADE,
                FOREIGN KEY (lote_id) REFERENCES lote(id) ON DELETE CASCADE
            )
        """)

    # Crear índices (misma sintaxis para ambos)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lote_material ON lote(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lote_estado ON lote(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lote_vencimiento ON lote(fecha_vencimiento)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lote_mov_lote ON lote_movimiento(lote_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lote_mov_tipo ON lote_movimiento(tipo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_recall_estado ON recall(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_recall_material ON recall(material_codigo)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_recall_lote_recall ON recall_lote(recall_id)")

    conn.commit()
    conn.close()

    print("✅ Migración 067: Lot Traceability & Recall - Tablas lote, lote_movimiento, lote_genealogia, recall, recall_lote creadas")


def down():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Eliminar índices primero
    cursor.execute("DROP INDEX IF EXISTS idx_recall_lote_recall")
    cursor.execute("DROP INDEX IF EXISTS idx_recall_material")
    cursor.execute("DROP INDEX IF EXISTS idx_recall_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_lote_mov_tipo")
    cursor.execute("DROP INDEX IF EXISTS idx_lote_mov_lote")
    cursor.execute("DROP INDEX IF EXISTS idx_lote_vencimiento")
    cursor.execute("DROP INDEX IF EXISTS idx_lote_estado")
    cursor.execute("DROP INDEX IF EXISTS idx_lote_material")

    # Eliminar tablas en orden inverso (respetando FKs)
    cursor.execute("DROP TABLE IF EXISTS recall_lote")
    cursor.execute("DROP TABLE IF EXISTS recall")
    cursor.execute("DROP TABLE IF EXISTS lote_genealogia")
    cursor.execute("DROP TABLE IF EXISTS lote_movimiento")
    cursor.execute("DROP TABLE IF EXISTS lote")

    conn.commit()
    conn.close()

    print("✅ Migración 067: Revertida exitosamente")


if __name__ == '__main__':
    up()
