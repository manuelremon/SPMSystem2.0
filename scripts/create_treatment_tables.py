#!/usr/bin/env python3
"""
Script para crear las 4 tablas necesarias para el módulo de tratamiento de solicitudes
- proveedores
- material_equivalencias
- solicitud_items_tratamiento
- solicitud_tratamiento_log
"""

import sqlite3
from pathlib import Path

# Ruta de la BD
DB_PATH = Path(__file__).resolve().parent.parent / "backend_v2" / "spm.db"

# SQL para crear las tablas
CREATE_TABLES_SQL = """
-- Tabla: proveedores
-- Proveedores ficticios para el módulo de abastecimiento
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT CHECK(tipo IN ('externo', 'almacen_interno')) NOT NULL,
    plazo_entrega_dias INTEGER NOT NULL,
    rating REAL CHECK(rating >= 0 AND rating <= 5) NOT NULL,
    activo BOOLEAN DEFAULT 1,
    descripcion TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: material_equivalencias
-- Mapeo de materiales equivalentes con % de compatibilidad
CREATE TABLE IF NOT EXISTS material_equivalencias (
    id_equivalencia INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_original TEXT NOT NULL,
    codigo_equivalente TEXT NOT NULL,
    compatibilidad_pct INTEGER CHECK(compatibilidad_pct >= 0 AND compatibilidad_pct <= 100) NOT NULL,
    descripcion TEXT,
    notas TEXT,
    activo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (codigo_original) REFERENCES materiales(codigo),
    FOREIGN KEY (codigo_equivalente) REFERENCES materiales(codigo),
    UNIQUE(codigo_original, codigo_equivalente)
);

-- Tabla: solicitud_items_tratamiento
-- Decisiones de tratamiento por item de solicitud
CREATE TABLE IF NOT EXISTS solicitud_items_tratamiento (
    id_tratamiento INTEGER PRIMARY KEY AUTOINCREMENT,
    id_solicitud INTEGER NOT NULL,
    idx_item INTEGER NOT NULL,
    decision_tipo TEXT CHECK(decision_tipo IN ('stock', 'proveedor', 'equivalencia', 'rechazado')) NOT NULL,
    id_proveedor TEXT,
    codigo_material_final TEXT,
    cantidad_aprobada INTEGER NOT NULL,
    plazo_dias INTEGER,
    precio_unitario_final DECIMAL(10, 2),
    compatibilidad_pct INTEGER,
    motivo TEXT,
    usuario_id TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'confirmado', 'cancelado')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id) ON DELETE CASCADE,
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
    FOREIGN KEY (codigo_material_final) REFERENCES materiales(codigo),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id_spm),
    UNIQUE(id_solicitud, idx_item)
);

-- Tabla: solicitud_tratamiento_log
-- Auditoría y log de eventos de tratamiento
CREATE TABLE IF NOT EXISTS solicitud_tratamiento_log (
    id_log INTEGER PRIMARY KEY AUTOINCREMENT,
    id_solicitud INTEGER NOT NULL,
    evento_tipo TEXT NOT NULL,
    payload_json TEXT,
    usuario_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id_spm)
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);
CREATE INDEX IF NOT EXISTS idx_material_equiv_original ON material_equivalencias(codigo_original);
CREATE INDEX IF NOT EXISTS idx_material_equiv_equivalente ON material_equivalencias(codigo_equivalente);
CREATE INDEX IF NOT EXISTS idx_items_tratamiento_solicitud ON solicitud_items_tratamiento(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_items_tratamiento_estado ON solicitud_items_tratamiento(estado);
CREATE INDEX IF NOT EXISTS idx_tratamiento_log_solicitud ON solicitud_tratamiento_log(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_tratamiento_log_timestamp ON solicitud_tratamiento_log(timestamp);
"""


def create_tables():
    """Crea las tablas en la BD"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Dividir SQL en statements individuales y ejecutarlos
        statements = [s.strip() for s in CREATE_TABLES_SQL.split(";") if s.strip()]
        for i, statement in enumerate(statements):
            try:
                cursor.execute(statement)
            except sqlite3.Error as e:
                print(f"⚠️  Statement {i + 1} skipped (already exists or error): {str(e)[:50]}")

        conn.commit()

        print(f"✅ Tablas creadas exitosamente en {DB_PATH}")

        # Verificar tablas creadas
        cursor.execute(
            """
            SELECT name FROM sqlite_master
            WHERE type='table' AND name IN
            ('proveedores', 'material_equivalencias', 'solicitud_items_tratamiento', 'solicitud_tratamiento_log')
            ORDER BY name
        """
        )
        tables = cursor.fetchall()
        print("\n📋 Tablas creadas:")
        for (table_name,) in tables:
            print(f"   - {table_name}")

        conn.close()
        return True

    except sqlite3.Error as e:
        print(f"❌ Error al crear tablas: {e}")
        return False


if __name__ == "__main__":
    create_tables()
