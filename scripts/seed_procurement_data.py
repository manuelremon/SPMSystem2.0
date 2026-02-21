#!/usr/bin/env python3
"""
Seed de datos SAP de Procurement para desarrollo.

Genera:
- 200 SOLPEDs (requisiciones) con 1-5 posiciones cada una
- 150 Purchase Orders vinculadas a SOLPEDs liberadas
- Historial de importación

Uso:
    python scripts/seed_procurement_data.py [--clean] [--verbose]
"""

import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.db import get_db_connection, get_db_transaction  # noqa: E402

VERBOSE = False

# Centros de costo reales del sistema
CENTROS = ['1001', '1007', '1059', '1060', '1061', '1062']

# Proveedores ficticios
PROVEEDORES = [
    ('20-12345678-9', 'Suministros Industriales SA'),
    ('30-98765432-1', 'TecnoEquipos SRL'),
    ('20-55667788-0', 'Repuestos del Litoral'),
    ('30-11223344-5', 'Ferreteria Industrial Patagonica'),
    ('20-99887766-3', 'Grupo Metalurgico Norte'),
    ('30-44556677-8', 'Distribuidora Electromecanica'),
    ('20-33221100-6', 'Soluciones Hidraulicas SA'),
    ('30-77889900-2', 'Herramientas Profesionales'),
    ('20-66554433-7', 'Instrumentacion Avanzada SA'),
    ('30-22110099-4', 'Componentes Industriales'),
    ('20-88776655-1', 'Bombas y Valvulas del Sur'),
    ('30-55443322-9', 'Automatizacion Industrial'),
    ('20-11009988-5', 'Quimicos del Centro SA'),
    ('30-99001122-3', 'Lubricantes Especiales SRL'),
    ('20-44332211-8', 'Equipamiento Minero SA'),
]

# Materiales ficticios con precios base
MATERIALES = [
    ('100001', 'Rodamiento SKF 6205-2RS', 45.0),
    ('100002', 'Aceite hidraulico ISO 46 x 20L', 120.0),
    ('100003', 'Junta viton DN50 PN16', 15.0),
    ('100004', 'Valvula esferica 2" ANSI 150', 350.0),
    ('100005', 'Cable SINTENAX 3x2.5mm 100m', 280.0),
    ('100006', 'Filtro aire comprimido 1"', 85.0),
    ('100007', 'Sensor presion 0-10bar 4-20mA', 420.0),
    ('100008', 'Correa trapecial B68', 22.0),
    ('100009', 'Manometro glicerina 0-16bar', 35.0),
    ('100010', 'Tubo acero inox 304 2" SCH40', 180.0),
    ('100011', 'Electrodo E7018 3.25mm x 25kg', 95.0),
    ('100012', 'Guante nitrilo descartable x100', 12.0),
    ('100013', 'Casco seguridad MSA V-Gard', 28.0),
    ('100014', 'Zapato seguridad puntera acero', 65.0),
    ('100015', 'Antiparras proteccion quimica', 18.0),
    ('100016', 'Retén mecanico 35x52x7 NBR', 8.0),
    ('100017', 'Bomba centrifuga 5HP trifasica', 1200.0),
    ('100018', 'Reductor velocidad i=20:1', 850.0),
    ('100019', 'PLC Siemens S7-1200 CPU1214C', 1500.0),
    ('100020', 'Variador frecuencia 7.5kW ABB', 980.0),
    ('100021', 'Contactor Siemens 3RT1 25A', 65.0),
    ('100022', 'Termocupla tipo K 300mm', 25.0),
    ('100023', 'Transmisor temperatura PT100', 180.0),
    ('100024', 'Caudalimetro electromagnetico 2"', 2200.0),
    ('100025', 'Grasa multiproposito EP2 x 18kg', 55.0),
    ('100026', 'Empaquetadura grafito expandido', 32.0),
    ('100027', 'Disco corte 115x1.0mm x 25u', 18.0),
    ('100028', 'Lija al agua grano 120 x 50u', 15.0),
    ('100029', 'Trapo industrial x 10kg', 22.0),
    ('100030', 'Cinta teflon 12mm x 100u', 8.0),
]

ESTRATEGIAS = ['LIBERADA', 'LIBERADA', 'LIBERADA', 'PENDIENTE', 'BLOQUEADA']
USUARIOS = ['JGONZALEZ', 'MRODRIGUEZ', 'APEREZ', 'CLOPEZ', 'RFERNANDEZ', 'LGARCIA']


def log(msg):
    if VERBOSE:
        print(f"  [seed_procurement] {msg}")


def clean_procurement_data():
    """Elimina datos de procurement de desarrollo."""
    print("Limpiando datos de procurement...")
    with get_db_transaction() as (conn, cur):
        cur.execute("DELETE FROM sap_import_log")
        cur.execute("DELETE FROM sap_purchase_orders")
        cur.execute("DELETE FROM sap_solpeds")
    print("  Datos de procurement eliminados.")


def seed_solpeds():
    """Genera SOLPEDs con posiciones."""
    print("Generando SOLPEDs...")
    now = datetime.now()
    solpeds_created = 0
    items_created = 0

    for i in range(200):
        solped_id = f"{5000000 + i}"
        num_posiciones = random.randint(1, 5)
        fecha_creacion = now - timedelta(days=random.randint(10, 365))
        centro = random.choice(CENTROS)
        creado_por = random.choice(USUARIOS)
        estrategia = random.choice(ESTRATEGIAS)

        for pos in range(1, num_posiciones + 1):
            mat_codigo, mat_desc, precio_base = random.choice(MATERIALES)
            # Variacion de precio +/-20%
            precio = round(precio_base * random.uniform(0.8, 1.2), 2)
            cantidad = random.choice([1, 2, 5, 10, 20, 50, 100])
            importe = round(precio * cantidad, 2)
            fecha_entrega = fecha_creacion + timedelta(days=random.randint(14, 90))

            with get_db_transaction() as (conn, cur):
                cur.execute("""
                    INSERT INTO sap_solpeds
                    (solped_id, posicion, material_codigo, material_descripcion,
                     centro, fecha_creacion, cantidad, precio_unitario, importe_total,
                     moneda, estrategia_liberacion, fecha_entrega_solicitada,
                     creado_por, solicitante)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    solped_id, str(pos * 10), mat_codigo, mat_desc,
                    centro, fecha_creacion.strftime('%Y-%m-%d %H:%M:%S'),
                    cantidad, precio, importe,
                    'USD', estrategia,
                    fecha_entrega.strftime('%Y-%m-%d %H:%M:%S'),
                    creado_por, creado_por
                ))
            items_created += 1

        solpeds_created += 1
        log(f"SOLPED {solped_id} con {num_posiciones} items")

    print(f"  {solpeds_created} SOLPEDs, {items_created} items creados.")
    return solpeds_created


def seed_purchase_orders():
    """Genera Purchase Orders vinculadas a SOLPEDs liberadas."""
    print("Generando Purchase Orders...")
    orders_created = 0

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT solped_id, posicion, material_codigo, centro,
                   fecha_creacion, fecha_entrega_solicitada, cantidad,
                   precio_unitario, importe_total
            FROM sap_solpeds
            WHERE estrategia_liberacion = 'LIBERADA'
            ORDER BY fecha_creacion
        """)
        solpeds_liberadas = cur.fetchall()

    if not solpeds_liberadas:
        print("  No hay SOLPEDs liberadas para generar POs.")
        return 0

    # Agrupar por solped_id para generar un pedido por solped
    pedido_counter = 4500000
    processed_solpeds = set()

    for row in solpeds_liberadas:
        s = dict(row)
        solped_id = s['solped_id']

        if solped_id in processed_solpeds:
            # Usar el mismo pedido_id para todas las posiciones de la misma solped
            pass

        if solped_id not in processed_solpeds:
            pedido_counter += 1
            processed_solpeds.add(solped_id)

        pedido_id = str(pedido_counter)
        proveedor_cuit, proveedor_nombre = random.choice(PROVEEDORES)

        fecha_creacion = datetime.strptime(
            str(s['fecha_creacion'])[:19], '%Y-%m-%d %H:%M:%S'
        )
        # Fecha pedido: 3-15 dias despues de creacion
        fecha_pedido = fecha_creacion + timedelta(days=random.randint(3, 15))

        # 75% de las ordenes tienen recepcion
        tiene_recepcion = random.random() < 0.75
        fecha_recepcion = None
        cantidad_recepcionada = 0.0
        valor_recibido = 0.0

        cantidad_pedida = float(s['cantidad'] or 0)
        valor_pedido = float(s['importe_total'] or 0)

        if tiene_recepcion:
            # Fecha recepcion: entre 5 y 60 dias despues del pedido
            dias_entrega = random.randint(5, 60)
            fecha_recepcion = fecha_pedido + timedelta(days=dias_entrega)

            # 80% recibe cantidad completa, 20% parcial
            if random.random() < 0.80:
                cantidad_recepcionada = cantidad_pedida
                valor_recibido = valor_pedido
            else:
                pct = random.uniform(0.5, 0.95)
                cantidad_recepcionada = round(cantidad_pedida * pct, 2)
                valor_recibido = round(valor_pedido * pct, 2)

        with get_db_transaction() as (conn, cur):
            cur.execute("""
                INSERT INTO sap_purchase_orders
                (pedido_id, solped_id, solped_posicion,
                 proveedor_cuit, proveedor_nombre,
                 centro, material_codigo,
                 cantidad_pedida, cantidad_recepcionada,
                 valor_pedido, valor_recibido,
                 fecha_pedido, fecha_recepcion, moneda_pedido)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                pedido_id, solped_id, s['posicion'],
                proveedor_cuit, proveedor_nombre,
                s['centro'], s['material_codigo'],
                cantidad_pedida, cantidad_recepcionada,
                valor_pedido, valor_recibido,
                fecha_pedido.strftime('%Y-%m-%d %H:%M:%S'),
                fecha_recepcion.strftime('%Y-%m-%d %H:%M:%S') if fecha_recepcion else None,
                'USD'
            ))
        orders_created += 1
        log(f"PO {pedido_id} -> SOLPED {solped_id}/{s['posicion']}")

    print(f"  {orders_created} Purchase Orders creadas.")
    return orders_created


def seed_import_log():
    """Genera un registro de importacion exitosa."""
    print("Generando log de importacion...")
    with get_db_transaction() as (conn, cur):
        cur.execute("""
            SELECT COUNT(*) as c FROM sap_solpeds
        """)
        total_solpeds = cur.fetchone()['c']

        cur.execute("""
            SELECT COUNT(*) as c FROM sap_purchase_orders
        """)
        total_orders = cur.fetchone()['c']

        cur.execute("""
            INSERT INTO sap_import_log
            (filename, user_id, started_at, finished_at,
             records_inserted, records_updated, records_error, status)
            VALUES (?, ?, CURRENT_TIMESTAMP - INTERVAL '5 minutes',
                    CURRENT_TIMESTAMP, ?, 0, 0, 'completed')
        """, ('seed_dev_data.xlsx', '1', total_solpeds + total_orders))

    print(f"  Log de importacion creado ({total_solpeds} solpeds, {total_orders} orders).")


def ensure_views():
    """Crea/actualiza vistas de procurement."""
    print("Creando vistas de procurement...")
    try:
        from backend.services.procurement_service import ProcurementService
        ProcurementService.ensure_procurement_views()
        print("  Vistas creadas/actualizadas.")
    except Exception as e:
        print(f"  Warning: No se pudieron crear vistas: {e}")


def main():
    global VERBOSE
    import argparse
    parser = argparse.ArgumentParser(description='Seed procurement data')
    parser.add_argument('--clean', action='store_true', help='Limpiar datos antes de insertar')
    parser.add_argument('--verbose', action='store_true', help='Mostrar detalles')
    args = parser.parse_args()
    VERBOSE = args.verbose

    print("=" * 60)
    print("SEED: Datos de Procurement SAP")
    print("=" * 60)

    if args.clean:
        clean_procurement_data()

    # Verificar si ya hay datos
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as c FROM sap_solpeds")
        existing = cur.fetchone()['c']

    if existing > 0 and not args.clean:
        print(f"Ya existen {existing} registros en sap_solpeds. Use --clean para regenerar.")
        return

    seed_solpeds()
    seed_purchase_orders()
    seed_import_log()
    ensure_views()

    # Resumen final
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as c FROM sap_solpeds")
        total_s = cur.fetchone()['c']
        cur.execute("SELECT COUNT(*) as c FROM sap_purchase_orders")
        total_o = cur.fetchone()['c']
        cur.execute("SELECT COUNT(DISTINCT solped_id) as c FROM sap_solpeds")
        unique_s = cur.fetchone()['c']

    print()
    print("=" * 60)
    print("RESUMEN:")
    print(f"  SOLPEDs unicas:     {unique_s}")
    print(f"  Items de SOLPED:    {total_s}")
    print(f"  Purchase Orders:    {total_o}")
    print("=" * 60)


if __name__ == '__main__':
    main()
