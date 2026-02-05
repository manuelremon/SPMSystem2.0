#!/usr/bin/env python3
"""
Script para corregir inconsistencias en las bases de datos SPM v3.0

Ejecutar: python scripts/fix_db_inconsistencies.py
Con modo verbose: python scripts/fix_db_inconsistencies.py -v
Solo verificar (dry-run): python scripts/fix_db_inconsistencies.py --dry-run
"""

import sqlite3
import shutil
import json
import argparse
from datetime import datetime
from pathlib import Path

# Rutas de las bases de datos
DATA_DIR = Path(__file__).parent.parent / "data"
SPM_DB = DATA_DIR / "spm.db"
SAP_DATA_DB = DATA_DIR / "sap_data.db"
CATALOGO_DB = DATA_DIR / "catalogo_materiales.db"

# Almacenes válidos según el plan
ALMACENES_AA = ['AA001', 'AA012', 'AA101']  # Para lotes G-*
ALMACENES_II = ['II002', 'II003', 'II004']  # Para lotes I-*
ALMACENES_VALIDOS = ALMACENES_AA + ALMACENES_II


def log(msg: str, verbose: bool = True):
    """Imprimir mensaje con timestamp."""
    if verbose:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def backup_database(db_path: Path, verbose: bool = True) -> Path:
    """Crear backup de la base de datos."""
    backup_dir = DATA_DIR / "backups"
    backup_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{db_path.stem}_{timestamp}.db"

    shutil.copy2(db_path, backup_path)
    log(f"Backup creado: {backup_path.name}", verbose)
    return backup_path


def phase1_fix_spm_db(dry_run: bool = False, verbose: bool = True):
    """
    Fase 1: Correcciones en spm.db
    1. Status "Borrador" → "draft"
    2. Rol duplicado usuario ID 8
    3. Eliminar solicitud vacía ID 1
    """
    log("=" * 60, verbose)
    log("FASE 1: Correcciones en spm.db", verbose)
    log("=" * 60, verbose)

    if not dry_run:
        backup_database(SPM_DB, verbose)

    conn = sqlite3.connect(SPM_DB)
    cursor = conn.cursor()

    # 1. Corregir status "Borrador" → "draft"
    cursor.execute("SELECT COUNT(*) FROM solicitudes WHERE status = 'Borrador'")
    count = cursor.fetchone()[0]
    log(f"1. Solicitudes con status 'Borrador': {count}", verbose)

    if count > 0 and not dry_run:
        cursor.execute("UPDATE solicitudes SET status = 'draft' WHERE status = 'Borrador'")
        log(f"   → Corregidos {cursor.rowcount} registros", verbose)

    # 2. Corregir rol duplicado usuario ID 8
    cursor.execute("SELECT rol FROM usuarios WHERE id_spm = '8'")
    result = cursor.fetchone()
    if result:
        rol_actual = result[0]
        log(f"2. Rol usuario ID 8: '{rol_actual}'", verbose)

        if 'solicitante' in rol_actual.lower() and rol_actual != 'Solicitante':
            if not dry_run:
                cursor.execute("UPDATE usuarios SET rol = 'Solicitante' WHERE id_spm = '8'")
                log(f"   → Corregido a 'Solicitante'", verbose)
    else:
        log("2. Usuario ID 8 no encontrado (OK si es nuevo)", verbose)

    # 3. Eliminar solicitud vacía ID 1
    cursor.execute("""
        SELECT id, data_json, total_monto
        FROM solicitudes
        WHERE id = 1
    """)
    result = cursor.fetchone()
    if result:
        data_json_str = result[1] or ''
        monto = result[2] or 0
        log(f"3. Solicitud ID 1: data_json='{data_json_str[:50] if data_json_str else 'vacío'}...', monto={monto}", verbose)

        # Verificar si items está vacío dentro del JSON
        is_empty = False
        if not data_json_str or data_json_str in ['[]', '{}', '']:
            is_empty = True
        else:
            try:
                data = json.loads(data_json_str)
                items = data.get('items', [])
                is_empty = len(items) == 0
            except (json.JSONDecodeError, TypeError):
                is_empty = False

        if is_empty and monto == 0:
            if not dry_run:
                cursor.execute("DELETE FROM solicitudes WHERE id = 1")
                log(f"   → Eliminada solicitud vacía", verbose)
            else:
                log(f"   → Se eliminaría (items vacíos, monto=0)", verbose)
        else:
            log(f"   → No se elimina (tiene datos)", verbose)
    else:
        log("3. Solicitud ID 1 no existe (ya eliminada o nunca existió)", verbose)

    if not dry_run:
        conn.commit()
    conn.close()

    log("Fase 1 completada.\n", verbose)


def phase2_redistribute_warehouses(dry_run: bool = False, verbose: bool = True):
    """
    Fase 2: Redistribuir almacenes no válidos en sap_data.db
    - Lotes G-* → AA001, AA012, AA101
    - Lotes I-* → II002, II003, II004
    """
    log("=" * 60, verbose)
    log("FASE 2: Redistribuir almacenes en sap_data.db", verbose)
    log("=" * 60, verbose)

    if not dry_run:
        backup_database(SAP_DATA_DB, verbose)

    conn = sqlite3.connect(SAP_DATA_DB)
    cursor = conn.cursor()

    # Verificar almacenes actuales
    cursor.execute("SELECT DISTINCT almacen FROM stock ORDER BY almacen")
    almacenes_actuales = [row[0] for row in cursor.fetchall()]
    log(f"Almacenes actuales: {almacenes_actuales}", verbose)

    almacenes_invalidos = [a for a in almacenes_actuales if a not in ALMACENES_VALIDOS]
    log(f"Almacenes a redistribuir: {almacenes_invalidos}", verbose)

    if not almacenes_invalidos:
        log("No hay almacenes inválidos. Saltando...", verbose)
        conn.close()
        return

    # Contar registros por tipo de lote en almacenes inválidos
    cursor.execute("""
        SELECT
            CASE
                WHEN lote LIKE 'G-%' THEN 'G'
                WHEN lote LIKE 'I-%' THEN 'I'
                ELSE 'OTRO'
            END as tipo_lote,
            COUNT(*) as cantidad
        FROM stock
        WHERE almacen NOT IN (?, ?, ?, ?, ?, ?)
        GROUP BY tipo_lote
    """, ALMACENES_VALIDOS)

    for row in cursor.fetchall():
        log(f"  Lotes tipo {row[0]}: {row[1]} registros", verbose)

    if not dry_run:
        # Redistribuir lotes G-* a almacenes AA
        for i, almacen_destino in enumerate(ALMACENES_AA):
            cursor.execute(f"""
                UPDATE stock
                SET almacen = ?
                WHERE almacen NOT IN (?, ?, ?, ?, ?, ?)
                  AND lote LIKE 'G-%'
                  AND rowid % 3 = ?
            """, (almacen_destino, *ALMACENES_VALIDOS, i))
            log(f"  Lotes G-* → {almacen_destino}: {cursor.rowcount} registros", verbose)

        # Redistribuir lotes I-* a almacenes II
        for i, almacen_destino in enumerate(ALMACENES_II):
            cursor.execute(f"""
                UPDATE stock
                SET almacen = ?
                WHERE almacen NOT IN (?, ?, ?, ?, ?, ?)
                  AND lote LIKE 'I-%'
                  AND rowid % 3 = ?
            """, (almacen_destino, *ALMACENES_VALIDOS, i))
            log(f"  Lotes I-* → {almacen_destino}: {cursor.rowcount} registros", verbose)

        # Eliminar registros que no cumplen regla lote/almacén
        cursor.execute("""
            DELETE FROM stock
            WHERE almacen NOT IN (?, ?, ?, ?, ?, ?)
        """, ALMACENES_VALIDOS)
        if cursor.rowcount > 0:
            log(f"  Eliminados {cursor.rowcount} registros con lotes no conformes", verbose)

        conn.commit()

    # Verificar resultado
    cursor.execute("SELECT DISTINCT almacen FROM stock ORDER BY almacen")
    almacenes_finales = [row[0] for row in cursor.fetchall()]
    log(f"Almacenes finales: {almacenes_finales}", verbose)

    conn.close()
    log("Fase 2 completada.\n", verbose)


def phase3_consolidate_duplicates(dry_run: bool = False, verbose: bool = True):
    """
    Fase 3: Consolidar duplicados en tabla stock
    Agrupar por centro/almacén/material/lote y sumar stock
    """
    log("=" * 60, verbose)
    log("FASE 3: Consolidar duplicados en stock", verbose)
    log("=" * 60, verbose)

    conn = sqlite3.connect(SAP_DATA_DB)
    cursor = conn.cursor()

    # Contar duplicados
    cursor.execute("""
        SELECT COUNT(*) FROM (
            SELECT centro, almacen, material, lote, COUNT(*) as cnt
            FROM stock
            GROUP BY centro, almacen, material, lote
            HAVING cnt > 1
        )
    """)
    duplicados = cursor.fetchone()[0]
    log(f"Combinaciones duplicadas encontradas: {duplicados}", verbose)

    if duplicados == 0:
        log("No hay duplicados. Saltando...", verbose)
        conn.close()
        return

    cursor.execute("SELECT COUNT(*) FROM stock")
    total_antes = cursor.fetchone()[0]
    log(f"Total registros antes: {total_antes}", verbose)

    if not dry_run:
        # Crear tabla consolidada con las columnas reales
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_consolidado AS
            SELECT
                MAX(dia) as dia,
                centro,
                MAX(centro_descripcion) as centro_descripcion,
                almacen,
                MAX(grupo_de_articulos) as grupo_de_articulos,
                MAX(gpo_articulos_descripcion) as gpo_articulos_descripcion,
                material,
                MAX(material_descripcion) as material_descripcion,
                lote,
                SUM(stock) as stock,
                MAX(um) as um,
                MAX(precio) as precio,
                SUM(stock_valorizado) as stock_valorizado,
                MAX(moneda) as moneda,
                MAX(ubicacion) as ubicacion
            FROM stock
            GROUP BY centro, almacen, material, lote
        """)

        # Verificar cuenta
        cursor.execute("SELECT COUNT(*) FROM stock_consolidado")
        total_consolidado = cursor.fetchone()[0]
        log(f"Total registros consolidados: {total_consolidado}", verbose)

        # Reemplazar tabla original
        cursor.execute("DROP TABLE stock")
        cursor.execute("ALTER TABLE stock_consolidado RENAME TO stock")

        # Crear índices para performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_material ON stock(material)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_almacen ON stock(almacen)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_centro ON stock(centro)")

        conn.commit()
        log(f"Registros eliminados por consolidación: {total_antes - total_consolidado}", verbose)

    conn.close()
    log("Fase 3 completada.\n", verbose)


def phase4_sync_catalog(dry_run: bool = False, verbose: bool = True):
    """
    Fase 4: Sincronizar catálogo de materiales
    - Agregar materiales en stock que no están en catálogo
    - Corregir saldos en pedidos_sap
    """
    log("=" * 60, verbose)
    log("FASE 4: Sincronizar catálogo y corregir pedidos", verbose)
    log("=" * 60, verbose)

    # Conectar a ambas bases de datos
    conn_sap = sqlite3.connect(SAP_DATA_DB)
    conn_cat = sqlite3.connect(CATALOGO_DB)
    cursor_sap = conn_sap.cursor()
    cursor_cat = conn_cat.cursor()

    if not dry_run:
        backup_database(CATALOGO_DB, verbose)

    # Obtener materiales en stock
    cursor_sap.execute("SELECT DISTINCT material FROM stock")
    materiales_stock = set(row[0] for row in cursor_sap.fetchall())
    log(f"Materiales en stock: {len(materiales_stock)}", verbose)

    # Obtener materiales en catálogo
    cursor_cat.execute("SELECT DISTINCT codigo FROM materiales")
    materiales_catalogo = set(row[0] for row in cursor_cat.fetchall())
    log(f"Materiales en catálogo: {len(materiales_catalogo)}", verbose)

    # Materiales faltantes en catálogo
    faltantes = materiales_stock - materiales_catalogo
    log(f"Materiales en stock sin catálogo: {len(faltantes)}", verbose)

    if faltantes and not dry_run:
        # Obtener estructura de la tabla materiales
        cursor_cat.execute("PRAGMA table_info(materiales)")
        columnas = [col[1] for col in cursor_cat.fetchall()]
        log(f"Columnas en catálogo: {columnas}", verbose)

        # Insertar materiales faltantes con datos mínimos
        for material in faltantes:
            # Obtener info del material desde stock si existe
            cursor_sap.execute("""
                SELECT material, centro, almacen
                FROM stock
                WHERE material = ?
                LIMIT 1
            """, (material,))
            info = cursor_sap.fetchone()

            if 'codigo' in columnas:
                cursor_cat.execute("""
                    INSERT OR IGNORE INTO materiales (codigo, descripcion, activo)
                    VALUES (?, ?, 1)
                """, (material, f"Material {material} (auto-agregado)"))

        conn_cat.commit()
        log(f"  → Agregados {len(faltantes)} materiales al catálogo", verbose)

    # Corregir saldos en pedidos_sap
    log("\nCorrigiendo saldos en pedidos_sap...", verbose)
    cursor_sap.execute("""
        SELECT COUNT(*) FROM pedidos_sap
        WHERE ABS(saldo_pend - (ctdpedida - ctdentregada)) > 0.01
    """)
    errores_saldo = cursor_sap.fetchone()[0]
    log(f"Registros con saldo incorrecto: {errores_saldo}", verbose)

    if errores_saldo > 0 and not dry_run:
        cursor_sap.execute("""
            UPDATE pedidos_sap
            SET saldo_pend = ROUND(ctdpedida - ctdentregada, 2)
            WHERE ABS(saldo_pend - (ctdpedida - ctdentregada)) > 0.01
        """)
        conn_sap.commit()
        log(f"  → Corregidos {cursor_sap.rowcount} registros", verbose)

    conn_sap.close()
    conn_cat.close()
    log("Fase 4 completada.\n", verbose)


def verify_corrections(verbose: bool = True):
    """Verificar que todas las correcciones se aplicaron correctamente."""
    log("=" * 60, verbose)
    log("VERIFICACIÓN FINAL", verbose)
    log("=" * 60, verbose)

    all_ok = True

    # 1. Verificar status consistentes
    conn = sqlite3.connect(SPM_DB)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT status FROM solicitudes")
    statuses = [row[0] for row in cursor.fetchall()]
    conn.close()

    if 'Borrador' in statuses:
        log("❌ Aún existen status 'Borrador'", verbose)
        all_ok = False
    else:
        log("✓ Status consistentes (sin 'Borrador')", verbose)

    # 2. Verificar almacenes válidos
    conn = sqlite3.connect(SAP_DATA_DB)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT almacen FROM stock ORDER BY almacen")
    almacenes = [row[0] for row in cursor.fetchall()]

    invalidos = [a for a in almacenes if a not in ALMACENES_VALIDOS]
    if invalidos:
        log(f"❌ Almacenes inválidos: {invalidos}", verbose)
        all_ok = False
    else:
        log(f"✓ Almacenes válidos: {almacenes}", verbose)

    # 3. Verificar regla lote-almacén
    cursor.execute("""
        SELECT COUNT(*) FROM stock
        WHERE (almacen LIKE 'AA%' AND lote NOT LIKE 'G-%')
           OR (almacen LIKE 'II%' AND lote NOT LIKE 'I-%')
    """)
    violaciones = cursor.fetchone()[0]
    if violaciones > 0:
        log(f"❌ {violaciones} registros violan regla lote-almacén", verbose)
        all_ok = False
    else:
        log("✓ Regla lote-almacén cumplida", verbose)

    # 4. Verificar sin duplicados
    cursor.execute("""
        SELECT COUNT(*) FROM (
            SELECT centro, almacen, material, lote, COUNT(*) as cnt
            FROM stock
            GROUP BY centro, almacen, material, lote
            HAVING cnt > 1
        )
    """)
    duplicados = cursor.fetchone()[0]
    if duplicados > 0:
        log(f"❌ {duplicados} combinaciones duplicadas", verbose)
        all_ok = False
    else:
        log("✓ Sin duplicados en stock", verbose)

    conn.close()

    if all_ok:
        log("\n✓ TODAS LAS VERIFICACIONES PASARON", verbose)
    else:
        log("\n❌ ALGUNAS VERIFICACIONES FALLARON", verbose)

    return all_ok


def main():
    parser = argparse.ArgumentParser(
        description="Corregir inconsistencias en bases de datos SPM v3.0"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        default=True,
        help="Modo verbose (por defecto: activado)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo mostrar qué se haría, sin modificar"
    )
    parser.add_argument(
        "--phase",
        type=int,
        choices=[1, 2, 3, 4],
        help="Ejecutar solo una fase específica"
    )

    args = parser.parse_args()

    log("=" * 60, args.verbose)
    log("CORRECCIÓN DE INCONSISTENCIAS EN BASES DE DATOS SPM v3.0", args.verbose)
    log("=" * 60, args.verbose)

    if args.dry_run:
        log("*** MODO DRY-RUN: No se modificará ningún archivo ***\n", args.verbose)

    # Verificar que las bases de datos existen
    for db in [SPM_DB, SAP_DATA_DB, CATALOGO_DB]:
        if not db.exists():
            print(f"ERROR: No se encuentra {db}")
            return 1

    # Ejecutar fases
    if args.phase is None or args.phase == 1:
        phase1_fix_spm_db(args.dry_run, args.verbose)

    if args.phase is None or args.phase == 2:
        phase2_redistribute_warehouses(args.dry_run, args.verbose)

    if args.phase is None or args.phase == 3:
        phase3_consolidate_duplicates(args.dry_run, args.verbose)

    if args.phase is None or args.phase == 4:
        phase4_sync_catalog(args.dry_run, args.verbose)

    # Verificación final
    if not args.dry_run:
        verify_corrections(args.verbose)

    log("\nProceso completado.", args.verbose)
    return 0


if __name__ == "__main__":
    exit(main())
