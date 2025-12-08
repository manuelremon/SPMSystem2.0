#!/usr/bin/env python3
"""
Migracion 005: Integracion de Datos del Planificador

Esta migracion:
1. Crea tabla proveedor_precios_negociados (precios pactados con proveedores)
2. Crea tabla config_equivalencia_scores (scores dinamicos por tipo de equivalencia)
3. Crea tabla decision_abastecimiento (cabecera de decision por item)
4. Crea tabla decision_abastecimiento_fuentes (multiples fuentes por decision)
5. Inserta datos iniciales de scores de equivalencia
"""

import sqlite3
from pathlib import Path

# Ubicacion de la BD
DB_PATH = Path("data/spm.db")

# ============================================================================
# 1. Tabla proveedor_precios_negociados
# ============================================================================

CREATE_PRECIOS_NEGOCIADOS = """
CREATE TABLE IF NOT EXISTS proveedor_precios_negociados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuit_proveedor TEXT NOT NULL,
    codigo_material TEXT NOT NULL,
    precio_usd REAL NOT NULL,
    moneda TEXT DEFAULT 'USD',
    fecha_vigencia_desde DATE NOT NULL,
    fecha_vigencia_hasta DATE,
    condicion_pago TEXT,
    cantidad_minima INTEGER DEFAULT 1,
    notas TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit),
    UNIQUE(cuit_proveedor, codigo_material, fecha_vigencia_desde)
)
"""

CREATE_PRECIOS_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_precios_material ON proveedor_precios_negociados(codigo_material);
CREATE INDEX IF NOT EXISTS idx_precios_proveedor ON proveedor_precios_negociados(cuit_proveedor);
CREATE INDEX IF NOT EXISTS idx_precios_vigencia ON proveedor_precios_negociados(fecha_vigencia_desde, fecha_vigencia_hasta);
CREATE INDEX IF NOT EXISTS idx_precios_activo ON proveedor_precios_negociados(activo);
"""

# ============================================================================
# 2. Tabla config_equivalencia_scores
# ============================================================================

CREATE_EQUIVALENCIA_SCORES = """
CREATE TABLE IF NOT EXISTS config_equivalencia_scores (
    tipo_equiv TEXT PRIMARY KEY,
    compatibilidad_pct INTEGER NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1
)
"""

# Datos iniciales de scores de equivalencia
# E0 = Duplicado tecnico (mismo material diferente codigo)
# E1 = Equivalencia estricta (intercambiable 1:1)
# E2 = Suplible (bajo condiciones especificas)
EQUIVALENCIA_SCORES_DATA = [
    ("E0_DUPLICADO", 100, "Duplicado tecnico - mismo material con diferente codigo SAP"),
    ("E1_ESTRICTA", 95, "Equivalencia tecnica estricta - intercambiable 1:1"),
    ("E2_SUPLIBLE", 85, "Suplible bajo condiciones - requiere validacion tecnica"),
]

INSERT_SCORE_SQL = """
INSERT OR IGNORE INTO config_equivalencia_scores (tipo_equiv, compatibilidad_pct, descripcion)
VALUES (?, ?, ?)
"""

# ============================================================================
# 3. Tabla decision_abastecimiento (cabecera de decision multi-fuente)
# ============================================================================

CREATE_DECISION_ABASTECIMIENTO = """
CREATE TABLE IF NOT EXISTS decision_abastecimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    item_index INTEGER NOT NULL,
    cantidad_solicitada REAL NOT NULL,
    cantidad_total_asignada REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente', 'parcial', 'completo', 'confirmado'
    )),
    comentario TEXT,
    planner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(solicitud_id, item_index),
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE,
    FOREIGN KEY (planner_id) REFERENCES usuarios(id_spm)
)
"""

# ============================================================================
# 4. Tabla decision_abastecimiento_fuentes (fuentes seleccionadas)
# ============================================================================

CREATE_DECISION_FUENTES = """
CREATE TABLE IF NOT EXISTS decision_abastecimiento_fuentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_id INTEGER NOT NULL,
    tipo_fuente TEXT NOT NULL CHECK (tipo_fuente IN (
        'stock', 'transferencia', 'proveedor', 'equivalencia'
    )),
    -- Para stock/transferencia (interno)
    centro_origen TEXT,
    almacen_origen TEXT,
    -- Para proveedor externo
    cuit_proveedor TEXT,
    proveedor_nombre TEXT,
    -- Para equivalencia
    codigo_material_equiv TEXT,
    tipo_equivalencia TEXT,
    -- Cantidades y precios
    cantidad_asignada REAL NOT NULL,
    precio_unitario REAL,
    precio_es_negociado INTEGER DEFAULT 0,
    plazo_dias INTEGER,
    -- Metadata
    score_opcion REAL,
    orden_prioridad INTEGER DEFAULT 1,
    notas TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES decision_abastecimiento(id) ON DELETE CASCADE,
    FOREIGN KEY (cuit_proveedor) REFERENCES proveedores_externos(cuit)
)
"""

CREATE_DECISION_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_decision_solicitud ON decision_abastecimiento(solicitud_id, item_index);
CREATE INDEX IF NOT EXISTS idx_decision_estado ON decision_abastecimiento(estado);
CREATE INDEX IF NOT EXISTS idx_fuentes_decision ON decision_abastecimiento_fuentes(decision_id);
CREATE INDEX IF NOT EXISTS idx_fuentes_tipo ON decision_abastecimiento_fuentes(tipo_fuente);
"""


def run_migration():
    """Ejecutar migracion"""
    print(f">> Conectando a {DB_PATH}...")

    if not DB_PATH.exists():
        # Intentar ruta alternativa
        alt_path = Path("backend/spm.db")
        if alt_path.exists():
            db_path = alt_path
        else:
            print(f"ERROR: Base de datos no encontrada en {DB_PATH}")
            return False
    else:
        db_path = DB_PATH

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Crear tabla proveedor_precios_negociados
        print(">> [1/6] Creando tabla proveedor_precios_negociados...")
        cursor.execute(CREATE_PRECIOS_NEGOCIADOS)
        cursor.executescript(CREATE_PRECIOS_INDEXES)
        print("   OK: Tabla e indices creados")

        # 2. Crear tabla config_equivalencia_scores
        print(">> [2/6] Creando tabla config_equivalencia_scores...")
        cursor.execute(CREATE_EQUIVALENCIA_SCORES)
        print("   OK: Tabla creada")

        # 3. Insertar datos iniciales de scores
        print(">> [3/6] Insertando scores de equivalencia...")
        for data in EQUIVALENCIA_SCORES_DATA:
            cursor.execute(INSERT_SCORE_SQL, data)
        conn.commit()
        cursor.execute("SELECT COUNT(*) FROM config_equivalencia_scores")
        count = cursor.fetchone()[0]
        print(f"   OK: {count} tipos de equivalencia configurados")

        # 4. Crear tabla decision_abastecimiento (cabecera multi-fuente)
        print(">> [4/6] Creando tabla decision_abastecimiento...")
        cursor.execute(CREATE_DECISION_ABASTECIMIENTO)
        print("   OK: Tabla de decisiones creada")

        # 5. Crear tabla decision_abastecimiento_fuentes
        print(">> [5/6] Creando tabla decision_abastecimiento_fuentes...")
        cursor.execute(CREATE_DECISION_FUENTES)
        cursor.executescript(CREATE_DECISION_INDEXES)
        print("   OK: Tabla de fuentes e indices creados")

        # 6. Verificar tablas
        print(">> [6/6] Verificando tablas...")
        tables_to_check = [
            "proveedor_precios_negociados",
            "config_equivalencia_scores",
            "decision_abastecimiento",
            "decision_abastecimiento_fuentes",
        ]
        for table in tables_to_check:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone():
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"   OK: {table} ({count} registros)")
            else:
                print(f"   ERROR: {table} no fue creada")
                return False

        # Mostrar scores configurados
        print("\n>> Scores de equivalencia configurados:")
        cursor.execute(
            "SELECT tipo_equiv, compatibilidad_pct, descripcion FROM config_equivalencia_scores"
        )
        for row in cursor.fetchall():
            print(f"   {row[0]}: {row[1]}% - {row[2]}")

        # Registrar migracion
        cursor.execute(
            """
            INSERT OR IGNORE INTO schema_migrations (version, applied_at)
            VALUES (5, datetime('now'))
        """
        )
        conn.commit()

        return True

    except Exception as e:
        print(f"ERROR durante migracion: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
        print(">> Conexion cerrada")


def main():
    print("=" * 70)
    print("  MIGRACION 005: Integracion de Datos del Planificador")
    print("=" * 70)
    print()

    success = run_migration()

    print()
    if success:
        print("OK: Migracion completada con exito!")
    else:
        print("ERROR: Migracion fallo. Revisa los errores arriba.")
    print()


if __name__ == "__main__":
    main()
