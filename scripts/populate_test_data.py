"""
Script para poblar datos de prueba en spm.db
Permite testear el flujo completo: solicitudes, aprobaciones, planificación, etc.
"""

import json
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path


def get_connection():
    """Conexión a spm.db"""
    conn = sqlite3.connect(Path("data/spm.db"))
    conn.row_factory = sqlite3.Row
    return conn


def get_materiales():
    """Obtiene materiales del catálogo con precio"""
    conn = sqlite3.connect(Path("data/catalogo_materiales.db"))
    cur = conn.cursor()
    cur.execute(
        """
        SELECT codigo, descripcion, precio_usd, unidad_medida
        FROM materiales
        WHERE precio_usd > 0 AND precio_usd < 50000
        LIMIT 100
    """
    )
    materiales = cur.fetchall()
    conn.close()
    return materiales


def populate_presupuestos(conn):
    """Poblar presupuestos para todos los centros/sectores"""
    print("\n=== Poblando PRESUPUESTOS ===")

    cur = conn.cursor()

    # Combinaciones centro/sector
    presupuestos_data = [
        # Centro 1008 - Loma La Lata
        ("1008", "Mantenimiento", 2100110.00),
        ("1008", "Produccion", 1500000.00),
        ("1008", "Logistica", 800000.00),
        ("1008", "Compras", 500000.00),
        # Centro 1050 - UTE Rio Neuquén
        ("1050", "Mantenimiento", 1800000.00),
        ("1050", "Produccion", 1200000.00),
        ("1050", "Logistica", 600000.00),
        # Centro 1064 - Añelo
        ("1064", "Mantenimiento", 900000.00),
        ("1064", "Produccion", 700000.00),
        # Centro 1500 - MID Loma La Lata
        ("1500", "Mantenimiento", 200000.00),
        ("1500", "Planificacion", 150000.00),
    ]

    for centro, sector, monto in presupuestos_data:
        # Calcular saldo (80-95% del monto)
        saldo = monto * random.uniform(0.80, 0.95)
        monto_cents = int(monto * 100)
        saldo_cents = int(saldo * 100)

        cur.execute(
            """
            INSERT OR REPLACE INTO presupuestos
            (centro, sector, monto_usd, saldo_usd, version, monto_cents, saldo_cents)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        """,
            (centro, sector, monto, saldo, monto_cents, saldo_cents),
        )
        print(f"  Presupuesto: {centro}/{sector} = USD {monto:,.2f} (saldo: {saldo:,.2f})")

    conn.commit()
    print(f"  Total: {len(presupuestos_data)} presupuestos")


def populate_proveedores(conn):
    """Poblar proveedores externos e internos (nueva estructura V2)"""
    print("\n=== Poblando PROVEEDORES V2 ===")

    cur = conn.cursor()

    # PROVEEDORES EXTERNOS (empresas terceras)
    externos = [
        # (cuit, nombre, direccion, localidad, pais, origen, lead_time, rubro, calificacion)
        (
            "30-12345678-9",
            "Ferretería Industrial S.A.",
            "Av. Industrial 1234",
            "Neuquén",
            "Argentina",
            "local",
            7,
            "Ferretería",
            "cumplidor",
        ),
        (
            "30-23456789-0",
            "Suministros Petroleros Neuquén",
            "Ruta 22 Km 5",
            "Neuquén",
            "Argentina",
            "local",
            14,
            "Petrolero",
            "cumplidor",
        ),
        (
            "30-34567890-1",
            "Válvulas y Accesorios S.R.L.",
            "Parque Industrial 456",
            "Bahía Blanca",
            "Argentina",
            "local",
            21,
            "Válvulas",
            "incumplidor",
        ),
        (
            "30-45678901-2",
            "Metalúrgica del Sur",
            "Zona Industrial Norte",
            "Comodoro Rivadavia",
            "Argentina",
            "local",
            10,
            "Metalúrgica",
            "cumplidor",
        ),
        (
            "30-56789012-3",
            "Distribuidora Técnica Patagonia",
            "Av. Perón 789",
            "Cipolletti",
            "Argentina",
            "local",
            5,
            "Distribución",
            "cumplidor",
        ),
        (
            "US-9876543210",
            "Global Oil Parts Inc.",
            "5500 Industrial Blvd",
            "Houston TX",
            "USA",
            "exterior",
            30,
            "Importación",
            "sin_calificar",
        ),
        (
            "30-67890123-4",
            "Bombas y Compresores Ltda.",
            "Ruta 7 Km 12",
            "Mendoza",
            "Argentina",
            "local",
            15,
            "Bombas",
            "cumplidor",
        ),
    ]

    for ext in externos:
        cur.execute(
            """
            INSERT OR REPLACE INTO proveedores_externos
            (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
            ext,
        )
        print(f"  Externo: {ext[0]} - {ext[1]}")

    # Emails para proveedores externos
    emails = [
        ("30-12345678-9", "ventas@ferreteria-industrial.com.ar", "comercial", 1),
        ("30-23456789-0", "info@suministrospetroleros.com.ar", "comercial", 1),
        ("30-34567890-1", "contacto@valvulas-accesorios.com.ar", "comercial", 1),
        ("30-45678901-2", "ventas@metalurgicasur.com.ar", "comercial", 1),
        ("30-56789012-3", "pedidos@distecpatagonia.com.ar", "comercial", 1),
        ("US-9876543210", "sales@globaloilparts.com", "comercial", 1),
        ("30-67890123-4", "ventas@bombasycompresores.com.ar", "comercial", 1),
    ]

    for e in emails:
        cur.execute(
            """
            INSERT OR REPLACE INTO proveedor_ext_emails (cuit_proveedor, email, tipo, es_principal)
            VALUES (?, ?, ?, ?)
        """,
            e,
        )

    # PROVEEDORES INTERNOS (almacenes YPF)
    internos = [
        # (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email)
        (
            "1008",
            "0001",
            "UP Loma La Lata",
            "Mantenimiento",
            "Mantenimiento",
            "almacen-lll@ypf.com",
            "Carlos Pérez",
            "5",
            None,
            None,
        ),
        (
            "1008",
            "9002",
            "UP Loma La Lata",
            "Energía",
            "Energia",
            "energia-lll@ypf.com",
            "Juan García",
            None,
            "Pedro Sánchez",
            "psanchez@ypf.com",
        ),
        (
            "1008",
            "9003",
            "UP Loma La Lata",
            "Obras",
            "Obras",
            "obras-lll@ypf.com",
            "Luis López",
            "6",
            None,
            None,
        ),
        (
            "1008",
            "9004",
            "UP Loma La Lata",
            "Producción",
            "Produccion",
            "produccion-lll@ypf.com",
            "María Rodríguez",
            None,
            "Ana Torres",
            "atorres@ypf.com",
        ),
        (
            "1008",
            "0101",
            "UP Loma La Lata",
            "Críticos",
            "Mantenimiento",
            "criticos-lll@ypf.com",
            "Roberto Díaz",
            "5",
            None,
            None,
        ),
        (
            "1050",
            "0001",
            "UP UTE Rio Neuquén",
            "Mantenimiento",
            "Mantenimiento",
            "almacen-ute@ypf.com",
            "Fernando Ruiz",
            "3",
            None,
            None,
        ),
        (
            "1050",
            "9004",
            "UP UTE Rio Neuquén",
            "Producción",
            "Produccion",
            "produccion-ute@ypf.com",
            "Claudia Martín",
            None,
            "Jorge Paz",
            "jpaz@ypf.com",
        ),
        (
            "1064",
            "0001",
            "UP Añelo",
            "Mantenimiento",
            "Mantenimiento",
            "almacen-anelo@ypf.com",
            "Diego Romero",
            None,
            "Miguel Ángel",
            "mangel@ypf.com",
        ),
        (
            "1500",
            "0001",
            "MID Loma La Lata",
            "Mantenimiento",
            "Mantenimiento",
            "mid-lll@ypf.com",
            "Patricia Vega",
            "2",
            None,
            None,
        ),
    ]

    for i in internos:
        cur.execute(
            """
            INSERT OR REPLACE INTO proveedores_internos
            (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
            i,
        )
        print(f"  Interno: {i[0]}/{i[1]} - {i[2]} {i[3]}")

    conn.commit()
    print(f"  Total: {len(externos)} externos, {len(internos)} internos")


def populate_config_almacenes(conn):
    """Poblar configuración de almacenes"""
    print("\n=== Poblando CONFIG_ALMACENES ===")

    cur = conn.cursor()

    configs = [
        ("1008", "0001", "Mantenimiento General", True, "3"),  # Sergio Planner
        ("1008", "0101", "Críticos", False, "1"),  # Manu admin
        ("1008", "9002", "Energía", True, "3"),
        ("1008", "9004", "Producción", True, "3"),
        ("1050", "0001", "Mantenimiento UTE", True, "3"),
        ("1050", "0101", "Críticos UTE", False, "1"),
        ("1064", "0001", "Mantenimiento Añelo", True, "6"),  # Andres Garcia
        ("1500", "0001", "MID Mantenimiento", True, "2"),  # Laura Planner
    ]

    for centro, almacen, nombre, libre_disp, resp_id in configs:
        cur.execute(
            """
            INSERT OR REPLACE INTO config_almacenes
            (centro, almacen, nombre, libre_disponibilidad, responsable_id, excluido, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
        """,
            (centro, almacen, nombre, 1 if libre_disp else 0, resp_id),
        )
        print(f"  Config: {centro}/{almacen} - {nombre}")

    conn.commit()
    print(f"  Total: {len(configs)} configuraciones")


def populate_solicitudes(conn, materiales):
    """Poblar solicitudes en diferentes estados"""
    print("\n=== Poblando SOLICITUDES ===")

    cur = conn.cursor()

    # Estados para el flujo de trabajo
    estados = [
        "Borrador",
        "Enviada",
        "En Aprobación",
        "Aprobada",
        "Rechazada",
        "En tratamiento",
        "Tratado",
        "Despachada",
        "Cerrada",
    ]

    # Configuración de solicitudes a crear
    solicitudes_config = [
        # (id_usuario, centro, sector, status, num_items, criticidad)
        ("8", "1008", "Mantenimiento", "Borrador", 2, "Normal"),
        ("8", "1008", "Mantenimiento", "Enviada", 3, "Alta"),
        ("10", "1050", "Mantenimiento", "Enviada", 1, "Urgente"),
        ("9", "1500", "Mantenimiento", "En Aprobación", 4, "Normal"),
        ("8", "1008", "Mantenimiento", "Aprobada", 2, "Alta"),
        ("10", "1008", "Mantenimiento", "Aprobada", 3, "Normal"),
        ("8", "1050", "Mantenimiento", "Aprobada", 2, "Urgente"),
        ("9", "1500", "Mantenimiento", "Aprobada", 1, "Normal"),
        ("10", "1008", "Mantenimiento", "Rechazada", 2, "Normal"),
        ("8", "1008", "Mantenimiento", "En tratamiento", 3, "Alta"),
        ("10", "1050", "Mantenimiento", "En tratamiento", 2, "Normal"),
        ("8", "1008", "Mantenimiento", "Tratado", 2, "Normal"),
        ("10", "1008", "Mantenimiento", "Despachada", 1, "Alta"),
        ("8", "1050", "Mantenimiento", "Cerrada", 2, "Normal"),
    ]

    justificaciones = [
        "Reposición de stock de seguridad por consumo en mantenimiento preventivo",
        "Materiales requeridos para reparación de bomba P-101",
        "Repuestos para mantenimiento correctivo de compresor",
        "Actualización de equipos de instrumentación",
        "Materiales para proyecto de mejora continua",
        "Reemplazo de válvulas en línea de producción",
        "Elementos de seguridad para cuadrilla de mantenimiento",
        "Consumibles para taller mecánico",
        "Repuestos críticos para equipo en operación",
        "Material eléctrico para sistema de iluminación",
    ]

    centros_costos = ["CC-MANT-001", "CC-PROD-002", "CC-LOG-003", "CC-OPER-004"]
    almacenes = ["0001", "0101", "9002", "9004"]

    solicitud_id = 1

    for id_usuario, centro, sector, status, num_items, criticidad in solicitudes_config:
        # Generar items
        items = []
        total_monto = 0.0

        selected_materials = random.sample(materiales, min(num_items, len(materiales)))

        for i, mat in enumerate(selected_materials):
            cantidad = random.randint(1, 10)
            precio = float(mat[2]) if mat[2] else random.uniform(100, 5000)
            subtotal = cantidad * precio
            total_monto += subtotal

            items.append(
                {
                    "index": i,
                    "codigo": mat[0],
                    "codigo_sap": mat[0],
                    "descripcion": mat[1][:100] if mat[1] else f"Material {mat[0]}",
                    "cantidad": cantidad,
                    "unidad": mat[3] if mat[3] else "UN",
                    "precio_unitario": precio,
                    "subtotal": subtotal,
                    "observacion": "",
                }
            )

        # Fechas
        dias_atras = random.randint(1, 30)
        created_at = datetime.now() - timedelta(days=dias_atras)
        updated_at = created_at + timedelta(hours=random.randint(1, 48))
        fecha_necesidad = datetime.now() + timedelta(days=random.randint(7, 30))

        # Asignar planner solo si está en estado de planificación
        planner_id = None
        if status in ["Aprobada", "En tratamiento", "Tratado", "Despachada"]:
            planner_id = random.choice(["2", "3"])  # Laura o Sergio Planner

        # Asignar aprobador si fue aprobada/rechazada
        aprobador_id = None
        if status not in ["Borrador", "Enviada"]:
            aprobador_id = random.choice(["4", "5", "6"])  # Carlos, Maria, Andres

        data_json = json.dumps(
            {
                "items": items,
                "centro": centro,
                "sector": sector,
                "almacen": random.choice(almacenes),
            }
        )

        cur.execute(
            """
            INSERT INTO solicitudes
            (id_usuario, centro, sector, justificacion, centro_costos, almacen_virtual,
             criticidad, fecha_necesidad, data_json, status, aprobador_id, planner_id,
             total_monto, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                id_usuario,
                centro,
                sector,
                random.choice(justificaciones),
                random.choice(centros_costos),
                random.choice(almacenes),
                criticidad,
                fecha_necesidad.strftime("%Y-%m-%d"),
                data_json,
                status,
                aprobador_id,
                planner_id,
                total_monto,
                created_at.strftime("%Y-%m-%d %H:%M:%S"),
                updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )

        print(
            f"  Solicitud #{solicitud_id}: {status} | {centro}/{sector} | {num_items} items | USD {total_monto:,.2f}"
        )
        solicitud_id += 1

    conn.commit()
    print(f"  Total: {solicitud_id - 1} solicitudes")


def populate_tratamiento_items(conn):
    """Poblar decisiones de tratamiento para solicitudes en tratamiento/tratadas"""
    print("\n=== Poblando TRATAMIENTO DE ITEMS ===")

    cur = conn.cursor()

    # Obtener solicitudes en tratamiento o tratadas
    cur.execute(
        """
        SELECT id, data_json, planner_id
        FROM solicitudes
        WHERE status IN ('En tratamiento', 'Tratado', 'Despachada', 'Cerrada')
    """
    )
    solicitudes = cur.fetchall()

    decisiones_tipos = ["stock_interno", "compra_externa", "equivalente", "rechazado", "pendiente"]

    count = 0
    for sol in solicitudes:
        sol_id = sol[0]
        data = json.loads(sol[1] or "{}")
        items = data.get("items", [])
        planner_id = sol[2] or "3"

        for item in items:
            idx = item.get("index", 0)
            decision = random.choice(decisiones_tipos)
            cantidad_aprobada = item.get("cantidad", 1)

            if decision == "rechazado":
                cantidad_aprobada = 0
            elif decision == "pendiente":
                cantidad_aprobada = item.get("cantidad", 1) // 2

            comentarios = [
                "Stock disponible en almacén local",
                "Se requiere compra externa, proveedor sugerido",
                "Material equivalente disponible",
                "No hay stock ni alternativas disponibles",
                "Pendiente confirmación de disponibilidad",
            ]

            cur.execute(
                """
                INSERT OR REPLACE INTO solicitud_items_tratamiento
                (solicitud_id, item_index, decision, cantidad_aprobada, codigo_equivalente,
                 proveedor_sugerido, precio_unitario_estimado, comentario, updated_by, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
                (
                    sol_id,
                    idx,
                    decision,
                    cantidad_aprobada,
                    item.get("codigo") if decision == "equivalente" else None,
                    (
                        random.choice(["PROV001", "PROV002", "PROV003"])
                        if decision == "compra_externa"
                        else None
                    ),
                    item.get("precio_unitario", 0),
                    random.choice(comentarios),
                    planner_id,
                ),
            )
            count += 1

    conn.commit()
    print(f"  Total: {count} decisiones de tratamiento")


def populate_logs(conn):
    """Poblar logs de eventos"""
    print("\n=== Poblando LOGS DE EVENTOS ===")

    cur = conn.cursor()

    # Obtener todas las solicitudes no borrador
    cur.execute(
        """
        SELECT id, status, id_usuario, aprobador_id, planner_id, created_at
        FROM solicitudes
        WHERE status != 'Borrador'
    """
    )
    solicitudes = cur.fetchall()

    count = 0
    for sol in solicitudes:
        sol_id = sol[0]
        status = sol[1]
        usuario_id = sol[2]
        aprobador_id = sol[3]
        planner_id = sol[4]
        created = sol[5]

        eventos = []

        # Evento de envío
        if status != "Borrador":
            eventos.append(("solicitud_enviada", "Enviada", usuario_id, {}))

        # Evento de aprobación/rechazo
        if status in ["Aprobada", "En tratamiento", "Tratado", "Despachada", "Cerrada"]:
            eventos.append(
                (
                    "solicitud_aprobada",
                    "Aprobada",
                    aprobador_id or "5",
                    {"comentario": "Aprobado según presupuesto disponible"},
                )
            )
        elif status == "Rechazada":
            eventos.append(
                (
                    "solicitud_rechazada",
                    "Rechazada",
                    aprobador_id or "5",
                    {"motivo": "Sin presupuesto suficiente"},
                )
            )

        # Evento de planificación
        if status in ["En tratamiento", "Tratado", "Despachada", "Cerrada"]:
            eventos.append(("planificador_acepta", "En tratamiento", planner_id or "3", {}))

        if status in ["Tratado", "Despachada", "Cerrada"]:
            eventos.append(("planificador_finaliza", "Tratado", planner_id or "3", {}))

        for tipo, estado, actor, payload in eventos:
            cur.execute(
                """
                INSERT INTO solicitud_tratamiento_log
                (solicitud_id, item_index, actor_id, tipo, estado, payload_json, created_at)
                VALUES (?, NULL, ?, ?, ?, ?, datetime('now'))
            """,
                (sol_id, actor, tipo, estado, json.dumps(payload)),
            )
            count += 1

    conn.commit()
    print(f"  Total: {count} eventos registrados")


def main():
    print("=" * 60)
    print("SCRIPT DE POBLACIÓN DE DATOS DE PRUEBA")
    print("=" * 60)

    # Obtener materiales del catálogo
    materiales = get_materiales()
    print(f"\nMateriales disponibles para items: {len(materiales)}")

    # Conectar a spm.db
    conn = get_connection()

    try:
        # Poblar datos
        populate_presupuestos(conn)
        populate_proveedores(conn)
        populate_config_almacenes(conn)
        populate_solicitudes(conn, materiales)
        populate_tratamiento_items(conn)
        populate_logs(conn)

        print("\n" + "=" * 60)
        print("RESUMEN FINAL")
        print("=" * 60)

        cur = conn.cursor()
        tables = [
            "presupuestos",
            "proveedores",
            "config_almacenes",
            "solicitudes",
            "solicitud_items_tratamiento",
            "solicitud_tratamiento_log",
        ]

        for table in tables:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"  {table}: {count} registros")

        print("\n" + "=" * 60)
        print("DATOS DE PRUEBA CARGADOS EXITOSAMENTE")
        print("=" * 60)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
