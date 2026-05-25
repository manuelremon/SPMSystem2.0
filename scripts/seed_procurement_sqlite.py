#!/usr/bin/env python3
"""
Seed de datos de prueba para el módulo Procurement sobre SQLite.

Genera:
  - 40 órdenes de compra + 150 ítems + 200 historial
  - 15 RFQs + ítems, proveedores, ofertas, criterios, evaluaciones, adjudicaciones
  - 80 SAP SOLPEDs + 120 SAP Purchase Orders + 3 logs de importación
  - 10 evaluaciones de proveedor

Uso:
    python scripts/seed_procurement_sqlite.py
    python scripts/seed_procurement_sqlite.py --clean
    python scripts/seed_procurement_sqlite.py -v
"""

import sys
import os
import random
import argparse
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from faker import Faker
    fake = Faker('es_AR')
    Faker.seed(42)
except ImportError:
    print("ERROR: pip install faker")
    sys.exit(1)

random.seed(42)

DB_PATH = PROJECT_ROOT / "data" / "spm.db"

MONEDAS = ["USD", "ARS", "EUR"]
UNIDADES = ["UN", "KG", "LT", "MT", "M2", "GL"]
OC_ESTADOS = ["borrador", "pendiente_aprobacion", "aprobada", "enviada", "recepcion_parcial", "completada", "cancelada"]
RFQ_ESTADOS = ["draft", "published", "bidding", "evaluation", "awarded", "cancelled"]
ESTRATEGIAS = ["LIBERADA", "BLOQUEADA", "EN_PROCESO", "PENDIENTE"]
TERMINOS_PAGO = ["30 dias", "60 dias", "90 dias", "contado", "50% adelanto / 50% entrega"]

PROVEEDORES_SAP = [
    ("20-30546789-3", "Aceros Patagonia SA"),
    ("30-71234567-8", "Metalurgica del Norte SRL"),
    ("20-25678901-4", "Repuestos Industriales SA"),
    ("30-64523891-2", "Quimica del Litoral SA"),
    ("20-31987654-7", "Ferreteria Industrial Cordoba"),
    ("30-70234567-1", "Electronica Austral SRL"),
    ("20-28765432-9", "Lubricantes del Sur SA"),
    ("30-65789012-5", "Importadora Mendoza SA"),
    ("20-34567890-6", "Plasticos La Plata SRL"),
    ("30-72345678-0", "Herramientas Rosario SA"),
]


def rdate(days_back=180):
    delta = random.randint(1, days_back)
    return (datetime.now() - timedelta(days=delta)).strftime('%Y-%m-%d %H:%M:%S')


def fdate(days_min=10, days_max=120):
    delta = random.randint(days_min, days_max)
    return (datetime.now() + timedelta(days=delta)).strftime('%Y-%m-%d %H:%M:%S')


def money(lo=5000, hi=500000):
    return round(random.uniform(lo, hi), 2)


def pick(lst):
    return random.choice(lst)


def load_refs(conn):
    cur = conn.cursor()
    users = [r[0] for r in cur.execute("SELECT id_spm FROM usuario WHERE estado_registro='Activo' LIMIT 50").fetchall()]
    admins = [r[0] for r in cur.execute(
        "SELECT id_spm FROM usuario WHERE estado_registro='Activo' AND (rol LIKE '%admin%' OR rol LIKE '%planificador%') LIMIT 20"
    ).fetchall()]
    if not admins:
        admins = users[:5] if users else [1]
    solicitudes = [r[0] for r in cur.execute("SELECT id FROM solicitud LIMIT 200").fetchall()]
    proveedores = [r[0] for r in cur.execute("SELECT cuit FROM proveedor_externo LIMIT 50").fetchall()]
    if not proveedores:
        proveedores = [p[0] for p in PROVEEDORES_SAP]
    prov_names = {r[0]: r[1] for r in cur.execute("SELECT cuit, nombre FROM proveedor_externo LIMIT 50").fetchall()}
    centros = [r[0] for r in cur.execute("SELECT codigo FROM catalogo_centro LIMIT 10").fetchall()]
    if not centros:
        centros = ["1000", "1100", "1200", "1300"]
    materials = [r[0] for r in cur.execute("SELECT DISTINCT material FROM stock LIMIT 200").fetchall()] if _table_exists(conn, "stock") else []
    if not materials:
        from backend.core.db import get_db_connection as _gdb
        pass
    # Fallback to SAP data
    try:
        sap_conn = sqlite3.connect(str(PROJECT_ROOT / "data" / "sap_data.db"))
        sap_conn.row_factory = sqlite3.Row
        materials = [r[0] for r in sap_conn.execute("SELECT DISTINCT material FROM stock LIMIT 300").fetchall()]
        sap_conn.close()
    except Exception:
        materials = [f"MAT-{i:04d}" for i in range(1, 51)]

    return {
        "users": users or [1],
        "admins": admins,
        "solicitudes": solicitudes or [],
        "proveedores": proveedores,
        "prov_names": prov_names,
        "centros": centros,
        "materials": materials or [f"MAT-{i:04d}" for i in range(1, 51)],
    }


def _table_exists(conn, name):
    return conn.execute(f"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone()[0] > 0


def clean_procurement(conn):
    tables = [
        "sap_import_log", "sap_purchase_orders", "sap_solpeds",
        "rfq_adjudicacion", "rfq_evaluacion", "rfq_criterio_evaluacion",
        "rfq_oferta", "rfq_proveedor", "rfq_item", "rfq",
        "orden_compra_historial", "orden_compra_item", "orden_compra",
        "proveedor_evaluacion",
        "matching_resultado", "factura_item", "factura_proveedor",
        "contrato_historial", "contrato",
    ]
    for t in tables:
        if _table_exists(conn, t):
            conn.execute(f"DELETE FROM {t}")
    conn.commit()
    print("  Datos de procurement limpiados.")


def seed_orden_compra(conn, refs, verbose):
    oc_ids = []
    for i in range(1, 41):
        estado = pick(OC_ESTADOS)
        sol_id = pick(refs["solicitudes"]) if refs["solicitudes"] and random.random() > 0.2 else None
        cuit = pick(refs["proveedores"])
        nombre = refs["prov_names"].get(cuit, fake.company())
        aprobado = pick(refs["admins"]) if estado not in ("borrador",) else None
        fecha_real = rdate(30) if estado in ("completada", "recepcion_parcial") else None

        try:
            cur = conn.execute("""
                INSERT INTO orden_compra
                (numero_oc, solicitud_id, proveedor_cuit, proveedor_nombre, centro,
                 estado, monto_total, moneda, fecha_emision, fecha_entrega_estimada,
                 fecha_entrega_real, notas, creado_por, aprobado_por, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                f"OC-{i:03d}-{random.randint(100,999)}",
                sol_id, cuit, nombre, pick(refs["centros"]),
                estado, money(5000, 500000), "ARS",
                rdate(180), fdate(10, 120), fecha_real,
                fake.sentence(nb_words=6),
                pick(refs["admins"]), aprobado,
                rdate(180), rdate(30),
            ))
            oc_ids.append(cur.lastrowid)
        except Exception:
            pass

    conn.commit()
    if verbose:
        print(f"  orden_compra: {len(oc_ids)} insertadas")
    return oc_ids


def seed_oc_items(conn, oc_ids, refs, verbose):
    count = 0
    for oc_id in oc_ids:
        for _ in range(random.randint(2, 5)):
            qty = round(random.uniform(1, 200), 2)
            price = money(100, 20000)
            try:
                conn.execute("""
                    INSERT INTO orden_compra_item
                    (orden_compra_id, material_codigo, material_descripcion,
                     cantidad, cantidad_recibida, precio_unitario, precio_total, unidad)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (oc_id, pick(refs["materials"]), fake.catch_phrase(),
                      qty, round(qty * random.uniform(0, 1), 2),
                      price, round(qty * price, 2), pick(UNIDADES)))
                count += 1
            except Exception:
                pass
    conn.commit()
    if verbose:
        print(f"  orden_compra_item: {count} insertados")


def seed_oc_historial(conn, oc_ids, refs, verbose):
    count = 0
    transitions = [
        ("borrador", "pendiente_aprobacion"),
        ("pendiente_aprobacion", "aprobada"),
        ("aprobada", "enviada"),
        ("enviada", "recepcion_parcial"),
        ("recepcion_parcial", "completada"),
    ]
    for oc_id in oc_ids:
        n = random.randint(1, 4)
        for i in range(n):
            t = transitions[i % len(transitions)]
            try:
                conn.execute("""
                    INSERT INTO orden_compra_historial
                    (orden_compra_id, estado_anterior, estado_nuevo, actor_id, razon, created_at)
                    VALUES (?,?,?,?,?,?)
                """, (oc_id, t[0], t[1], pick(refs["admins"]),
                      fake.sentence(nb_words=5), rdate(60)))
                count += 1
            except Exception:
                pass
    conn.commit()
    if verbose:
        print(f"  orden_compra_historial: {count} insertados")


def seed_rfq(conn, refs, verbose):
    rfq_ids = []
    rfq_item_ids = []
    for i in range(1, 16):
        estado = pick(RFQ_ESTADOS)
        sol_id = pick(refs["solicitudes"]) if refs["solicitudes"] and random.random() > 0.3 else None
        try:
            cur = conn.execute("""
                INSERT INTO rfq
                (numero_rfq, estado, titulo, descripcion,
                 fecha_publicacion, fecha_cierre_ofertas,
                 solicitud_id, creado_por, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (
                f"RFQ-{i:04d}",
                estado,
                f"Licitación {fake.bs().title()[:60]}",
                fake.paragraph(nb_sentences=2),
                rdate(60) if estado != "draft" else None,
                fdate(5, 30),
                sol_id,
                str(pick(refs["admins"])),
                rdate(90), rdate(10),
            ))
            rfq_id = cur.lastrowid
            rfq_ids.append(rfq_id)

            # Items del RFQ
            for _ in range(random.randint(2, 4)):
                cur2 = conn.execute("""
                    INSERT INTO rfq_item
                    (rfq_id, material_codigo, material_descripcion,
                     cantidad_solicitada, unidad, especificaciones)
                    VALUES (?,?,?,?,?,?)
                """, (rfq_id, pick(refs["materials"]), fake.catch_phrase(),
                      round(random.uniform(1, 100), 2), pick(UNIDADES),
                      fake.sentence(nb_words=8)))
                rfq_item_ids.append((rfq_id, cur2.lastrowid))
        except Exception:
            pass

    conn.commit()
    if verbose:
        print(f"  rfq: {len(rfq_ids)} insertados, rfq_item: {len(rfq_item_ids)}")
    return rfq_ids, rfq_item_ids


def seed_rfq_proveedores(conn, rfq_ids, refs, verbose):
    count = 0
    for rfq_id in rfq_ids:
        provs = random.sample(refs["proveedores"], min(3, len(refs["proveedores"])))
        for cuit in provs:
            try:
                conn.execute("""
                    INSERT INTO rfq_proveedor
                    (rfq_id, proveedor_cuit, proveedor_nombre, estado_respuesta)
                    VALUES (?,?,?,?)
                """, (rfq_id, cuit,
                      refs["prov_names"].get(cuit, fake.company()),
                      pick(["invited", "submitted", "declined"])))
                count += 1
            except Exception:
                pass
    conn.commit()
    if verbose:
        print(f"  rfq_proveedor: {count} insertados")


def seed_rfq_ofertas(conn, rfq_ids, rfq_item_ids, refs, verbose):
    count = 0
    for rfq_id in rfq_ids:
        items_del_rfq = [iid for (rid, iid) in rfq_item_ids if rid == rfq_id]
        provs = random.sample(refs["proveedores"], min(2, len(refs["proveedores"])))
        for cuit in provs:
            for item_id in items_del_rfq:
                try:
                    conn.execute("""
                        INSERT INTO rfq_oferta
                        (rfq_id, rfq_item_id, proveedor_cuit, precio_unitario,
                         moneda, lead_time_dias, terminos_pago, notas)
                        VALUES (?,?,?,?,?,?,?,?)
                    """, (rfq_id, item_id, cuit,
                          money(100, 50000), pick(MONEDAS),
                          random.randint(7, 90), pick(TERMINOS_PAGO),
                          fake.sentence(nb_words=5)))
                    count += 1
                except Exception:
                    pass
    conn.commit()
    if verbose:
        print(f"  rfq_oferta: {count} insertados")


def seed_rfq_criterios(conn, rfq_ids, verbose):
    count = 0
    criterios_base = [
        ("price", "Precio", 40),
        ("lead_time", "Tiempo de Entrega", 25),
        ("quality", "Calidad", 25),
        ("payment_terms", "Condiciones de Pago", 10),
    ]
    for rfq_id in rfq_ids:
        for nombre, _desc, peso in criterios_base:
            try:
                conn.execute("""
                    INSERT INTO rfq_criterio_evaluacion
                    (rfq_id, criterio, peso_porcentaje)
                    VALUES (?,?,?)
                """, (rfq_id, nombre, peso))
                count += 1
            except Exception:
                pass
    conn.commit()
    if verbose:
        print(f"  rfq_criterio_evaluacion: {count} insertados")


def seed_rfq_evaluaciones(conn, rfq_ids, refs, verbose):
    count = 0
    for rfq_id in rfq_ids:
        provs = random.sample(refs["proveedores"], min(2, len(refs["proveedores"])))
        for cuit in provs:
            try:
                conn.execute("""
                    INSERT INTO rfq_evaluacion
                    (rfq_id, proveedor_cuit, puntaje_total,
                     puntaje_precio, puntaje_lead_time, puntaje_calidad,
                     puntaje_terminos, evaluado_por)
                    VALUES (?,?,?,?,?,?,?,?)
                """, (rfq_id, cuit,
                      round(random.uniform(60, 100), 1),
                      round(random.uniform(50, 100), 1),
                      round(random.uniform(50, 100), 1),
                      round(random.uniform(50, 100), 1),
                      round(random.uniform(50, 100), 1),
                      pick(refs["admins"])))
                count += 1
            except Exception:
                pass
    conn.commit()
    if verbose:
        print(f"  rfq_evaluacion: {count} insertados")


def seed_sap_solpeds(conn, refs, verbose):
    rows = []
    centros = refs["centros"]
    materials = refs["materials"]
    for i in range(1, 81):
        solped_id = f"SP-{i:05d}"
        mat = pick(materials)
        centro = pick(centros)
        fecha = rdate(365)
        estrategia = pick(ESTRATEGIAS)
        qty = round(random.uniform(1, 500), 2)
        price = money(50, 5000)
        for pos in range(1, random.randint(2, 4)):
            try:
                conn.execute("""
                    INSERT INTO sap_solpeds
                    (solped_id, posicion, material_codigo, material_descripcion,
                     centro, fecha_creacion, cantidad, precio_unitario, importe_total,
                     moneda, estrategia_liberacion, fecha_entrega_solicitada,
                     creado_por, solicitante)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    solped_id, str(pos).zfill(3), mat,
                    fake.catch_phrase()[:80],
                    centro, fecha, qty, price, round(qty * price, 2),
                    pick(MONEDAS), estrategia,
                    fdate(5, 60),
                    fake.first_name(), fake.name(),
                ))
                rows.append((solped_id, str(pos).zfill(3), mat, centro, fecha, estrategia))
            except Exception:
                pass

    conn.commit()
    if verbose:
        print(f"  sap_solpeds: {len(rows)} insertados")
    return rows


def seed_sap_purchase_orders(conn, solped_rows, verbose):
    count = 0
    for solped_id, posicion, mat, centro, fecha_solicitud, estrategia in solped_rows:
        if estrategia != "LIBERADA" and random.random() > 0.6:
            continue
        prov = pick(PROVEEDORES_SAP)
        qty = round(random.uniform(1, 100), 2)
        fecha_pedido = rdate(180)
        fecha_recepcion = rdate(90) if random.random() > 0.3 else None
        try:
            conn.execute("""
                INSERT INTO sap_purchase_orders
                (pedido_id, solped_id, solped_posicion, proveedor_cuit, proveedor_nombre,
                 centro, material_codigo, cantidad_pedida, cantidad_recepcionada,
                 valor_pedido, valor_recibido, fecha_pedido, fecha_recepcion, moneda_pedido)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                f"PO-{random.randint(100000, 999999)}",
                solped_id, posicion, prov[0], prov[1],
                centro, mat, qty,
                round(qty * random.uniform(0.8, 1.0), 2) if fecha_recepcion else 0,
                money(1000, 200000),
                money(800, 200000) if fecha_recepcion else 0,
                fecha_pedido, fecha_recepcion, pick(MONEDAS),
            ))
            count += 1
        except Exception:
            pass

    conn.commit()
    if verbose:
        print(f"  sap_purchase_orders: {count} insertados")


def seed_sap_import_log(conn, verbose):
    logs = [
        ("ZM65_2026Q1.xlsx", "2026-01-15 09:30:00", "2026-01-15 09:32:45", 245, 12, 0, "completed"),
        ("ZM65_2026Q2.xlsx", "2026-02-20 14:00:00", "2026-02-20 14:03:10", 312, 8, 3, "completed"),
        ("ZM65_2026Q3.xlsx", "2026-03-10 11:15:00", "2026-03-10 11:17:30", 189, 25, 1, "completed"),
    ]
    for fname, started, finished, inserted, updated, errors, status in logs:
        try:
            conn.execute("""
                INSERT INTO sap_import_log
                (filename, user_id, started_at, finished_at,
                 records_inserted, records_updated, records_error, status)
                VALUES (?,?,?,?,?,?,?,?)
            """, (fname, "1", started, finished, inserted, updated, errors, status))
        except Exception:
            pass
    conn.commit()
    if verbose:
        print("  sap_import_log: 3 insertados")


def seed_proveedor_evaluacion(conn, refs, verbose):
    count = 0
    periodos = ["2025-Q4", "2026-Q1", "2026-Q2"]
    for cuit, nombre in PROVEEDORES_SAP[:6]:
        for periodo in random.sample(periodos, random.randint(1, 2)):
            calidad = round(random.uniform(60, 100), 1)
            entrega = round(random.uniform(55, 100), 1)
            precio = round(random.uniform(50, 100), 1)
            servicio = round(random.uniform(60, 100), 1)
            global_score = round(calidad * 0.25 + entrega * 0.30 + precio * 0.25 + servicio * 0.20, 1)
            try:
                conn.execute("""
                    INSERT INTO proveedor_evaluacion
                    (proveedor_id, proveedor_nombre, periodo,
                     calidad_score, entrega_score, precio_score, servicio_score,
                     score_global, evaluado_por, notas)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                """, (cuit, nombre, periodo, calidad, entrega, precio, servicio,
                      global_score, pick(refs["admins"]),
                      fake.sentence(nb_words=8)))
                count += 1
            except Exception:
                pass
    conn.commit()
    if verbose:
        print(f"  proveedor_evaluacion: {count} insertados")


TIPOS_CONTRATO = ["blanket_po", "fixed_price", "time_materials", "framework"]
ESTADOS_CONTRATO = ["draft", "under_negotiation", "active", "suspended", "expired", "terminated"]


def seed_contratos(conn, refs, verbose):
    count = 0
    contrato_ids = []
    for i in range(1, 21):
        cuit = pick(refs["proveedores"])
        prov_nombre = refs["prov_names"].get(cuit, f"Proveedor {cuit}")
        estado = pick(ESTADOS_CONTRATO)
        tipo = pick(TIPOS_CONTRATO)
        fecha_ini = rdate(365)[:10]
        meses = random.randint(6, 36)
        fecha_fin = (datetime.strptime(fecha_ini, "%Y-%m-%d") + timedelta(days=meses * 30)).strftime("%Y-%m-%d")
        try:
            cur = conn.execute("""
                INSERT INTO contrato
                (numero_contrato, tipo, proveedor_cuit, proveedor_nombre, estado,
                 fecha_inicio, fecha_vencimiento, valor_total, moneda, centro,
                 creado_por, deleted)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,0)
            """, (
                f"CTR-{i:04d}", tipo, cuit, prov_nombre, estado,
                fecha_ini, fecha_fin, money(50000, 2000000),
                pick(MONEDAS), pick(refs["centros"]),
                pick(refs["admins"]),
            ))
            cid = cur.lastrowid
            contrato_ids.append(cid)
            count += 1
            # historial: al menos 1 entrada
            if estado != "draft":
                conn.execute("""
                    INSERT INTO contrato_historial
                    (contrato_id, estado_anterior, estado_nuevo, actor_id, razon)
                    VALUES (?,?,?,?,?)
                """, (cid, "draft", estado, pick(refs["admins"]), fake.sentence(nb_words=5)))
        except Exception:
            pass
    conn.commit()
    if verbose:
        print(f"  contrato: {count} insertados, contrato_historial: {len(contrato_ids)}")
    return contrato_ids


def seed_facturas(conn, refs, oc_ids, verbose):
    count_fac = 0
    count_items = 0
    count_match = 0
    ESTADOS_FACTURA = ["pending", "matched", "partial_match", "approved", "paid"]
    TIPOS_COMPROBANTE = ["A", "B", "C"]

    # Usar OCs aprobadas/completadas para facturas
    cur = conn.execute("SELECT id, proveedor_cuit, monto_total FROM orden_compra WHERE estado IN ('aprobada','completada','enviada') LIMIT 30")
    oc_rows = cur.fetchall()
    if not oc_rows:
        oc_rows = [(oid, pick(refs["proveedores"]), money(10000, 500000)) for oid in oc_ids[:20]]

    for oc_id, prov_cuit, monto_oc in oc_rows:
        estado = pick(ESTADOS_FACTURA)
        fecha_fac = rdate(180)[:10]
        fecha_vcto = (datetime.strptime(fecha_fac, "%Y-%m-%d") + timedelta(days=random.randint(30, 90))).strftime("%Y-%m-%d")
        monto = round(monto_oc * random.uniform(0.8, 1.0), 2) if monto_oc else money(10000, 200000)
        try:
            cur2 = conn.execute("""
                INSERT INTO factura_proveedor
                (numero_factura, orden_compra_id, proveedor_cuit, monto_total, moneda,
                 fecha_factura, fecha_vencimiento_pago, estado, tipo_comprobante, subido_por)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (
                f"FAC-{random.randint(10000, 99999):05d}", oc_id, prov_cuit,
                monto, pick(MONEDAS), fecha_fac, fecha_vcto, estado,
                pick(TIPOS_COMPROBANTE), pick(refs["users"]),
            ))
            fac_id = cur2.lastrowid
            count_fac += 1

            # 1-3 items por factura
            for _ in range(random.randint(1, 3)):
                mat = pick(refs["materials"])
                qty = round(random.uniform(1, 100), 2)
                pu = money(100, 5000)
                try:
                    conn.execute("""
                        INSERT INTO factura_item
                        (factura_id, material_codigo, cantidad_facturada, precio_unitario, precio_total)
                        VALUES (?,?,?,?,?)
                    """, (fac_id, mat, qty, pu, round(qty * pu, 2)))
                    count_items += 1
                except Exception:
                    pass

            # matching para facturas aprobadas/pagadas
            if estado in ("approved", "paid", "matched"):
                try:
                    estado_match = random.choice(["match", "match", "match", "quantity_mismatch", "price_mismatch"])
                    conn.execute("""
                        INSERT INTO matching_resultado
                        (factura_id, orden_compra_id, estado,
                         diferencia_cantidad, diferencia_precio, tolerancia_aplicada)
                        VALUES (?,?,?,?,?,?)
                    """, (fac_id, oc_id, estado_match,
                          round(random.uniform(0, 5), 2),
                          round(random.uniform(0, 200), 2),
                          round(random.uniform(0, 0.05), 3)))
                    count_match += 1
                except Exception:
                    pass
        except Exception:
            pass

    conn.commit()
    if verbose:
        print(f"  factura_proveedor: {count_fac} insertadas, factura_item: {count_items}, matching: {count_match}")
    return count_fac


def main():
    parser = argparse.ArgumentParser(description="Seed procurement SQLite")
    parser.add_argument("--clean", action="store_true", help="Limpiar datos existentes")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: {DB_PATH} no encontrado")
        return 1

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = OFF")

    print(f"\n=== Seed Procurement SQLite → {DB_PATH} ===\n")

    if args.clean:
        clean_procurement(conn)

    print("  Cargando referencias...")
    refs = load_refs(conn)
    print(f"  usuarios={len(refs['users'])}, proveedores={len(refs['proveedores'])}, "
          f"materiales={len(refs['materials'])}, solicitudes={len(refs['solicitudes'])}")
    print()

    oc_ids = seed_orden_compra(conn, refs, args.verbose)
    seed_oc_items(conn, oc_ids, refs, args.verbose)
    seed_oc_historial(conn, oc_ids, refs, args.verbose)

    rfq_ids, rfq_item_ids = seed_rfq(conn, refs, args.verbose)
    seed_rfq_proveedores(conn, rfq_ids, refs, args.verbose)
    seed_rfq_ofertas(conn, rfq_ids, rfq_item_ids, refs, args.verbose)
    seed_rfq_criterios(conn, rfq_ids, args.verbose)
    seed_rfq_evaluaciones(conn, rfq_ids, refs, args.verbose)

    solped_rows = seed_sap_solpeds(conn, refs, args.verbose)
    seed_sap_purchase_orders(conn, solped_rows, args.verbose)
    seed_sap_import_log(conn, args.verbose)

    seed_proveedor_evaluacion(conn, refs, args.verbose)
    seed_contratos(conn, refs, args.verbose)
    seed_facturas(conn, refs, oc_ids, args.verbose)

    conn.execute("PRAGMA foreign_keys = ON")
    conn.close()

    print("\n=== Verificación ===")
    conn2 = sqlite3.connect(str(DB_PATH))
    tables = ["orden_compra", "orden_compra_item", "orden_compra_historial",
              "rfq", "rfq_item", "rfq_proveedor", "rfq_oferta",
              "rfq_criterio_evaluacion", "rfq_evaluacion",
              "contrato", "contrato_historial",
              "factura_proveedor", "factura_item", "matching_resultado",
              "sap_solpeds", "sap_purchase_orders", "sap_import_log",
              "proveedor_evaluacion"]
    total = 0
    for t in tables:
        try:
            count = conn2.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            total += count
            print(f"  {t:<35} {count:>6} registros")
        except Exception as e:
            print(f"  {t:<35} ERROR: {e}")
    conn2.close()
    print(f"\n  Total: {total} registros insertados\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
