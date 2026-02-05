#!/usr/bin/env python3
"""
Script de auditoría de integridad de datos para SPM v3.0

Ejecutar: python scripts/audit_data_integrity.py
Con correcciones: python scripts/audit_data_integrity.py --fix
"""

import sqlite3
import json
import argparse
from datetime import datetime
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent.parent / "data"
SPM_DB = DATA_DIR / "spm.db"
SAP_DATA_DB = DATA_DIR / "sap_data.db"
CATALOGO_DB = DATA_DIR / "catalogo_materiales.db"
EQUIVALENTES_DB = DATA_DIR / "equivalentes.db"


class Issue:
    def __init__(self, severity: str, description: str, details: list = None, fix_sql: str = None):
        self.severity = severity
        self.description = description
        self.details = details or []
        self.fix_sql = fix_sql


def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def audit_spm_db() -> list:
    """Auditar integridad de data/spm.db"""
    issues = []
    conn = sqlite3.connect(SPM_DB)
    cursor = conn.cursor()

    log("Auditando spm.db...")

    # 1. Solicitudes con usuarios válidos
    cursor.execute("SELECT id_spm FROM usuarios")
    valid_users = set([r[0] for r in cursor.fetchall()])

    cursor.execute("SELECT id, id_usuario FROM solicitudes")
    for sol_id, user_id in cursor.fetchall():
        if str(user_id) not in valid_users:
            issues.append(Issue(
                "CRÍTICO",
                f"Solicitud {sol_id} tiene usuario inexistente: {user_id}",
                [sol_id],
                f"-- Requiere asignar usuario válido a solicitud {sol_id}"
            ))

    # 2. data_json debe ser JSON válido
    cursor.execute("SELECT id, data_json FROM solicitudes WHERE data_json IS NOT NULL")
    for sol_id, data_json in cursor.fetchall():
        if data_json:
            try:
                data = json.loads(data_json)
                # Verificar estructura esperada
                if not isinstance(data, dict):
                    issues.append(Issue("ALTO", f"Solicitud {sol_id}: data_json no es un objeto", [sol_id]))
            except json.JSONDecodeError as e:
                issues.append(Issue("CRÍTICO", f"Solicitud {sol_id}: JSON inválido - {e}", [sol_id]))

    # 3. Status válidos
    valid_statuses = ['draft', 'submitted', 'approved', 'rejected', 'processing', 'dispatched', 'closed', 'cancelled']
    cursor.execute("SELECT DISTINCT status FROM solicitudes")
    for (status,) in cursor.fetchall():
        if status not in valid_statuses:
            cursor.execute("SELECT COUNT(*) FROM solicitudes WHERE status = ?", (status,))
            count = cursor.fetchone()[0]
            issues.append(Issue(
                "CRÍTICO",
                f"Status inválido '{status}' en {count} solicitudes",
                [],
                f"UPDATE solicitudes SET status = 'draft' WHERE status = '{status}';"
            ))

    # 4. Decisiones huérfanas
    cursor.execute("""
        SELECT d.id, d.solicitud_id
        FROM decision_abastecimiento d
        LEFT JOIN solicitudes s ON d.solicitud_id = s.id
        WHERE s.id IS NULL
    """)
    orphans = cursor.fetchall()
    if orphans:
        ids = [r[0] for r in orphans]
        issues.append(Issue(
            "ALTO",
            f"{len(orphans)} decisiones de abastecimiento huérfanas",
            ids,
            f"DELETE FROM decision_abastecimiento WHERE id IN ({','.join(map(str, ids))});"
        ))

    # 5. Fuentes de decisión huérfanas
    cursor.execute("""
        SELECT f.id, f.decision_id
        FROM decision_abastecimiento_fuentes f
        LEFT JOIN decision_abastecimiento d ON f.decision_id = d.id
        WHERE d.id IS NULL
    """)
    orphan_fuentes = cursor.fetchall()
    if orphan_fuentes:
        ids = [r[0] for r in orphan_fuentes]
        issues.append(Issue(
            "ALTO",
            f"{len(orphan_fuentes)} fuentes de decisión huérfanas",
            ids,
            f"DELETE FROM decision_abastecimiento_fuentes WHERE id IN ({','.join(map(str, ids))});"
        ))

    # 6. Presupuestos con centro/sector válido
    cursor.execute("SELECT codigo FROM catalog_centros")
    valid_centros = set([r[0] for r in cursor.fetchall()])
    cursor.execute("SELECT nombre FROM catalog_sectores")
    valid_sectores = set([r[0] for r in cursor.fetchall()])

    cursor.execute("SELECT DISTINCT centro, sector FROM presupuestos")
    for centro, sector in cursor.fetchall():
        if centro not in valid_centros:
            issues.append(Issue("ALTO", f"Presupuesto con centro inválido: {centro}"))
        if sector not in valid_sectores:
            issues.append(Issue("ALTO", f"Presupuesto con sector inválido: {sector}"))

    # 7. Budget requests con usuario válido
    cursor.execute("""
        SELECT id, solicitante_id FROM budget_update_requests
        WHERE solicitante_id IS NOT NULL
    """)
    for bur_id, solicitante_id in cursor.fetchall():
        if str(solicitante_id) not in valid_users:
            issues.append(Issue(
                "ALTO",
                f"Budget request {bur_id} tiene usuario inexistente: {solicitante_id}"
            ))

    # 8. Montos negativos o nulos donde no debería
    cursor.execute("SELECT id, total_monto FROM solicitudes WHERE total_monto < 0")
    negative = cursor.fetchall()
    if negative:
        issues.append(Issue(
            "CRÍTICO",
            f"{len(negative)} solicitudes con monto negativo",
            [r[0] for r in negative]
        ))

    # 9. Usuarios con estado inválido
    valid_estados = ['Activo', 'Inactivo', 'Pendiente', 'Bloqueado', None, '']
    cursor.execute("SELECT id_spm, nombre, estado_registro FROM usuarios")
    for user_id, nombre, estado in cursor.fetchall():
        if estado and estado not in valid_estados:
            issues.append(Issue(
                "MEDIO",
                f"Usuario {user_id} ({nombre}) tiene estado inválido: {estado}"
            ))

    # 10. Emails duplicados
    cursor.execute("""
        SELECT mail, COUNT(*) as cnt FROM usuarios
        WHERE mail IS NOT NULL AND mail != ''
        GROUP BY mail HAVING cnt > 1
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        for email, count in duplicates:
            issues.append(Issue(
                "ALTO",
                f"Email duplicado '{email}' en {count} usuarios"
            ))

    # 11. Proveedores externos con datos incompletos
    cursor.execute("""
        SELECT cuit, nombre FROM proveedores_externos
        WHERE nombre IS NULL OR nombre = '' OR TRIM(nombre) = ''
    """)
    invalid_provs = cursor.fetchall()
    if invalid_provs:
        issues.append(Issue(
            "MEDIO",
            f"{len(invalid_provs)} proveedores externos sin nombre"
        ))

    # 12. Fechas en formato incorrecto
    cursor.execute("SELECT id, fecha_necesidad FROM solicitudes WHERE fecha_necesidad IS NOT NULL")
    for sol_id, fecha in cursor.fetchall():
        if fecha:
            try:
                # Intentar parsear la fecha
                if not any(c.isdigit() for c in fecha):
                    issues.append(Issue("MEDIO", f"Solicitud {sol_id}: fecha_necesidad inválida: {fecha}"))
            except:
                pass

    conn.close()
    return issues


def audit_sap_data_db() -> list:
    """Auditar integridad de data/sap_data.db"""
    issues = []
    conn = sqlite3.connect(SAP_DATA_DB)
    cursor = conn.cursor()

    log("Auditando sap_data.db...")

    # 1. Stock con valores negativos
    cursor.execute("SELECT COUNT(*) FROM stock WHERE stock < 0")
    negative_stock = cursor.fetchone()[0]
    if negative_stock:
        issues.append(Issue(
            "CRÍTICO",
            f"{negative_stock} registros de stock con valor negativo"
        ))

    # 2. Stock sin material
    cursor.execute("SELECT COUNT(*) FROM stock WHERE material IS NULL OR material = ''")
    no_material = cursor.fetchone()[0]
    if no_material:
        issues.append(Issue(
            "ALTO",
            f"{no_material} registros de stock sin código de material",
            [],
            "DELETE FROM stock WHERE material IS NULL OR material = '';"
        ))

    # 3. Precios negativos
    cursor.execute("SELECT COUNT(*) FROM stock WHERE precio < 0")
    negative_price = cursor.fetchone()[0]
    if negative_price:
        issues.append(Issue(
            "MEDIO",
            f"{negative_price} registros de stock con precio negativo"
        ))

    # 4. Consumo histórico con valores negativos
    cursor.execute("SELECT COUNT(*) FROM consumo_historico WHERE cantidad < 0")
    negative_consumo = cursor.fetchone()[0]
    if negative_consumo:
        issues.append(Issue(
            "ALTO",
            f"{negative_consumo} registros de consumo con cantidad negativa"
        ))

    # 5. Pedidos SAP con cantidades inválidas
    cursor.execute("SELECT COUNT(*) FROM pedidos_sap WHERE ctdpedida < 0 OR ctdentregada < 0")
    invalid_pedidos = cursor.fetchone()[0]
    if invalid_pedidos:
        issues.append(Issue(
            "ALTO",
            f"{invalid_pedidos} pedidos SAP con cantidades negativas"
        ))

    # 6. Pedidos con saldo pendiente inconsistente
    cursor.execute("""
        SELECT COUNT(*) FROM pedidos_sap
        WHERE ABS(saldo_pend - (ctdpedida - ctdentregada)) > 0.01
    """)
    inconsistent = cursor.fetchone()[0]
    if inconsistent:
        issues.append(Issue(
            "MEDIO",
            f"{inconsistent} pedidos SAP con saldo pendiente inconsistente",
            [],
            "UPDATE pedidos_sap SET saldo_pend = ROUND(ctdpedida - ctdentregada, 2);"
        ))

    # 7. Materiales sin descripción
    cursor.execute("SELECT COUNT(*) FROM stock WHERE material_descripcion IS NULL OR material_descripcion = ''")
    no_desc = cursor.fetchone()[0]
    if no_desc > 0:
        # Esto es solo informativo, no crítico
        log(f"  ℹ️  {no_desc} materiales en stock sin descripción (informativo)")

    # 8. Almacenes válidos
    valid_almacenes = ['AA001', 'AA012', 'AA101', 'II002', 'II003', 'II004']
    cursor.execute("SELECT DISTINCT almacen FROM stock")
    almacenes = [r[0] for r in cursor.fetchall()]
    invalid_almacenes = [a for a in almacenes if a not in valid_almacenes]
    if invalid_almacenes:
        issues.append(Issue(
            "CRÍTICO",
            f"Almacenes inválidos encontrados: {invalid_almacenes}"
        ))

    conn.close()
    return issues


def audit_catalogo_db() -> list:
    """Auditar integridad de data/catalogo_materiales.db"""
    issues = []
    conn = sqlite3.connect(CATALOGO_DB)
    cursor = conn.cursor()

    log("Auditando catalogo_materiales.db...")

    # 1. Materiales duplicados
    cursor.execute("""
        SELECT codigo, COUNT(*) as cnt FROM materiales
        GROUP BY codigo HAVING cnt > 1
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        issues.append(Issue(
            "CRÍTICO",
            f"{len(duplicates)} códigos de material duplicados en catálogo",
            [d[0] for d in duplicates[:10]]
        ))

    # 2. Materiales sin código
    cursor.execute("SELECT COUNT(*) FROM materiales WHERE codigo IS NULL OR codigo = ''")
    no_code = cursor.fetchone()[0]
    if no_code:
        issues.append(Issue(
            "CRÍTICO",
            f"{no_code} materiales sin código",
            [],
            "DELETE FROM materiales WHERE codigo IS NULL OR codigo = '';"
        ))

    # 3. Materiales sin descripción
    cursor.execute("SELECT COUNT(*) FROM materiales WHERE descripcion IS NULL OR descripcion = ''")
    no_desc = cursor.fetchone()[0]
    if no_desc:
        issues.append(Issue(
            "MEDIO",
            f"{no_desc} materiales sin descripción"
        ))

    # 4. Precios negativos
    cursor.execute("SELECT COUNT(*) FROM materiales WHERE precio_usd < 0")
    negative_price = cursor.fetchone()[0]
    if negative_price:
        issues.append(Issue(
            "MEDIO",
            f"{negative_price} materiales con precio negativo"
        ))

    conn.close()
    return issues


def audit_cross_database() -> list:
    """Auditar consistencia entre bases de datos"""
    issues = []

    log("Auditando consistencia entre bases de datos...")

    # Conectar a todas las BDs
    conn_spm = sqlite3.connect(SPM_DB)
    conn_sap = sqlite3.connect(SAP_DATA_DB)
    conn_cat = sqlite3.connect(CATALOGO_DB)

    cursor_spm = conn_spm.cursor()
    cursor_sap = conn_sap.cursor()
    cursor_cat = conn_cat.cursor()

    # 1. Materiales en solicitudes que no existen en catálogo
    cursor_cat.execute("SELECT codigo FROM materiales")
    valid_materials = set([r[0] for r in cursor_cat.fetchall()])

    cursor_spm.execute("SELECT id, data_json FROM solicitudes WHERE data_json IS NOT NULL")
    materials_not_in_catalog = set()
    for sol_id, data_json in cursor_spm.fetchall():
        if data_json:
            try:
                data = json.loads(data_json)
                items = data.get('items', [])
                for item in items:
                    material = item.get('material') or item.get('codigo_sap') or item.get('codigo')
                    if material and material not in valid_materials:
                        materials_not_in_catalog.add(material)
            except:
                pass

    if materials_not_in_catalog:
        issues.append(Issue(
            "ALTO",
            f"{len(materials_not_in_catalog)} materiales en solicitudes no existen en catálogo",
            list(materials_not_in_catalog)[:10]
        ))

    # 2. Materiales en stock que no existen en catálogo
    cursor_sap.execute("SELECT DISTINCT material FROM stock")
    stock_materials = set([r[0] for r in cursor_sap.fetchall()])

    missing_in_catalog = stock_materials - valid_materials
    if missing_in_catalog:
        issues.append(Issue(
            "MEDIO",
            f"{len(missing_in_catalog)} materiales en stock no están en catálogo",
            list(missing_in_catalog)[:10]
        ))

    # 3. Almacenes en solicitudes que no existen en catálogo spm
    cursor_spm.execute("SELECT codigo FROM catalog_almacenes")
    valid_almacenes_spm = set([r[0] for r in cursor_spm.fetchall()])

    cursor_spm.execute("SELECT DISTINCT almacen_virtual FROM solicitudes WHERE almacen_virtual IS NOT NULL AND almacen_virtual != ''")
    sol_almacenes = set([r[0] for r in cursor_spm.fetchall()])

    invalid_sol_almacenes = sol_almacenes - valid_almacenes_spm
    if invalid_sol_almacenes:
        issues.append(Issue(
            "MEDIO",
            f"Almacenes en solicitudes no catalogados: {invalid_sol_almacenes}"
        ))

    # 4. Centros en solicitudes vs centros en catálogo
    cursor_spm.execute("SELECT codigo FROM catalog_centros")
    valid_centros = set([r[0] for r in cursor_spm.fetchall()])

    cursor_spm.execute("SELECT DISTINCT centro FROM solicitudes WHERE centro IS NOT NULL AND centro != ''")
    sol_centros = set([r[0] for r in cursor_spm.fetchall()])

    invalid_sol_centros = sol_centros - valid_centros
    if invalid_sol_centros:
        issues.append(Issue(
            "MEDIO",
            f"Centros en solicitudes no catalogados: {invalid_sol_centros}"
        ))

    conn_spm.close()
    conn_sap.close()
    conn_cat.close()

    return issues


def apply_fixes(issues: list):
    """Aplicar correcciones automáticas"""
    log("\nAplicando correcciones automáticas...")

    fixes_applied = 0

    for issue in issues:
        if issue.fix_sql:
            try:
                # Determinar qué BD usar según el SQL
                if 'solicitudes' in issue.fix_sql or 'decision_' in issue.fix_sql or 'budget' in issue.fix_sql:
                    db_path = SPM_DB
                elif 'stock' in issue.fix_sql or 'pedidos_sap' in issue.fix_sql:
                    db_path = SAP_DATA_DB
                elif 'materiales' in issue.fix_sql:
                    db_path = CATALOGO_DB
                else:
                    continue

                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute(issue.fix_sql)
                conn.commit()
                conn.close()

                log(f"  ✓ Corregido: {issue.description}")
                fixes_applied += 1
            except Exception as e:
                log(f"  ❌ Error al corregir '{issue.description}': {e}")

    log(f"\nTotal correcciones aplicadas: {fixes_applied}")
    return fixes_applied


def main():
    parser = argparse.ArgumentParser(description="Auditoría de integridad de datos SPM v3.0")
    parser.add_argument("--fix", action="store_true", help="Aplicar correcciones automáticas")
    args = parser.parse_args()

    print("=" * 70)
    print("AUDITORÍA DE INTEGRIDAD DE DATOS - SPM v3.0")
    print("=" * 70)

    all_issues = []

    # Auditar cada base de datos
    print("\n" + "=" * 50)
    print("📦 AUDITORÍA DE spm.db")
    print("=" * 50)
    spm_issues = audit_spm_db()
    all_issues.extend(spm_issues)

    print("\n" + "=" * 50)
    print("📦 AUDITORÍA DE sap_data.db")
    print("=" * 50)
    sap_issues = audit_sap_data_db()
    all_issues.extend(sap_issues)

    print("\n" + "=" * 50)
    print("📦 AUDITORÍA DE catalogo_materiales.db")
    print("=" * 50)
    cat_issues = audit_catalogo_db()
    all_issues.extend(cat_issues)

    print("\n" + "=" * 50)
    print("🔗 AUDITORÍA CRUZADA ENTRE BASES DE DATOS")
    print("=" * 50)
    cross_issues = audit_cross_database()
    all_issues.extend(cross_issues)

    # Mostrar resumen
    print("\n" + "=" * 70)
    print("RESUMEN DE AUDITORÍA")
    print("=" * 70)

    by_severity = defaultdict(list)
    for issue in all_issues:
        by_severity[issue.severity].append(issue)

    for severity in ["CRÍTICO", "ALTO", "MEDIO", "BAJO"]:
        if severity in by_severity:
            print(f"\n🔴 {severity} ({len(by_severity[severity])} issues):")
            for issue in by_severity[severity]:
                print(f"   • {issue.description}")
                if issue.details:
                    print(f"     Detalles: {issue.details[:5]}{'...' if len(issue.details) > 5 else ''}")

    total = len(all_issues)
    fixable = len([i for i in all_issues if i.fix_sql])

    print(f"\n{'=' * 70}")
    print(f"TOTAL: {total} issues encontrados ({fixable} con corrección automática)")
    print("=" * 70)

    if args.fix and fixable > 0:
        apply_fixes(all_issues)
    elif fixable > 0:
        print(f"\n💡 Ejecuta con --fix para aplicar {fixable} correcciones automáticas")

    return 0 if total == 0 else 1


if __name__ == "__main__":
    exit(main())
