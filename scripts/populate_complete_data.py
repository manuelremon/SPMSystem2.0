#!/usr/bin/env python
"""
Script para poblar la base de datos con datos completos de prueba.
Incluye: usuarios, proveedores, solicitudes, presupuestos, etc.
"""

import json
import os
import random
import sqlite3
from datetime import datetime, timedelta

# Ruta a la base de datos
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "spm.db")


def get_connection():
    return sqlite3.connect(DB_PATH)


def update_users_almacenes():
    """Completar almacenes para usuarios que no tienen asignados"""
    print("\n=== Actualizando almacenes de usuarios ===")
    conn = get_connection()
    cursor = conn.cursor()

    almacenes_por_usuario = {
        "2": '["0001", "0101"]',
        "3": '["0001", "9002"]',
        "4": '["0001", "0101", "9002"]',
        "6": '["0001", "0101", "9002", "9003"]',
        "7": '["0001", "0101", "9002", "9003", "9004"]',
        "9": '["0001", "9002"]',
        "10": '["0001", "0101"]',
    }

    for user_id, almacenes in almacenes_por_usuario.items():
        cursor.execute(
            "UPDATE usuarios SET almacenes = ? WHERE id_spm = ? AND (almacenes IS NULL OR almacenes = '')",
            (almacenes, user_id),
        )
        if cursor.rowcount > 0:
            print(f"  Usuario {user_id}: almacenes actualizados")

    conn.commit()
    conn.close()
    print("Almacenes de usuarios completados")


def add_proveedores_externos():
    """Agregar mas proveedores externos con sus contactos"""
    print("\n=== Agregando proveedores externos ===")
    conn = get_connection()
    cursor = conn.cursor()

    nuevos_proveedores = [
        (
            "30-78901234-5",
            "Instrumentacion Patagonica S.A.",
            "Parque Industrial Este",
            "Neuquen",
            "Argentina",
            "local",
            8,
            "Instrumentacion",
            "cumplidor",
            1,
            "Especialista en instrumentacion industrial",
        ),
        (
            "30-89012345-6",
            "Electricidad Industrial del Sur",
            "Av. Independencia 567",
            "General Roca",
            "Argentina",
            "local",
            6,
            "Electrica",
            "cumplidor",
            1,
            "Materiales electricos certificados",
        ),
        (
            "30-90123456-7",
            "Hidraulica Comahue SRL",
            "Ruta 151 Km 8",
            "Centenario",
            "Argentina",
            "local",
            12,
            "Hidraulica",
            "cumplidor",
            1,
            "Sistemas hidraulicos completos",
        ),
        (
            "30-01234567-8",
            "Seguridad Industrial Arg",
            "Calle 25 de Mayo 890",
            "Plottier",
            "Argentina",
            "local",
            3,
            "Seguridad",
            "cumplidor",
            1,
            "EPP y elementos de seguridad",
        ),
        (
            "DE-123456789",
            "Siemens AG",
            "Werner-von-Siemens 1",
            "Munich",
            "Alemania",
            "exterior",
            45,
            "Automatizacion",
            "cumplidor",
            1,
            "Automatizacion y control",
        ),
        (
            "BR-98765432100",
            "Petrobras Distribuidora",
            "Av. Republica do Chile 65",
            "Rio de Janeiro",
            "Brasil",
            "exterior",
            25,
            "Petrolero",
            "cumplidor",
            1,
            "Materiales especializados petroleros",
        ),
        (
            "30-11223344-5",
            "Aceros Patagonia S.A.",
            "Zona Industrial Sur",
            "Neuquen",
            "Argentina",
            "local",
            10,
            "Aceros",
            "cumplidor",
            1,
            "Aceros especiales para industria petrolera",
        ),
        (
            "30-22334455-6",
            "Lubricantes del Sur",
            "Ruta 22 Km 15",
            "Cipolletti",
            "Argentina",
            "local",
            4,
            "Lubricantes",
            "cumplidor",
            1,
            "Lubricantes industriales y automotrices",
        ),
        (
            "30-33445566-7",
            "Pinturas Industriales Nqn",
            "Av. Argentina 1500",
            "Neuquen",
            "Argentina",
            "local",
            5,
            "Pinturas",
            "sin_calificar",
            1,
            "Recubrimientos y pinturas industriales",
        ),
        (
            "CL-76543210-9",
            "Minera Chilena SpA",
            "Av. Providencia 2000",
            "Santiago",
            "Chile",
            "exterior",
            20,
            "Mineria",
            "cumplidor",
            1,
            "Equipamiento minero",
        ),
    ]

    for prov in nuevos_proveedores:
        try:
            cursor.execute(
                """INSERT INTO proveedores_externos
                (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion, activo, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                prov,
            )
            print(f"  + Proveedor: {prov[1]}")
        except sqlite3.IntegrityError:
            print(f"  = Ya existe: {prov[1]}")

    # Contactos
    contactos = [
        ("30-78901234-5", "Martin", "Quiroga", "Gerente Tecnico", 1),
        ("30-89012345-6", "Cecilia", "Vega", "Coordinadora Comercial", 1),
        ("30-90123456-7", "Diego", "Peralta", "Jefe de Ventas", 1),
        ("30-01234567-8", "Patricia", "Sosa", "Ejecutiva de Cuentas", 1),
        ("DE-123456789", "Hans", "Mueller", "Export Manager", 1),
        ("BR-98765432100", "Carlos", "Santos", "Gerente Regional", 1),
        ("30-11223344-5", "Ricardo", "Fuentes", "Director Comercial", 1),
        ("30-22334455-6", "Marta", "Gonzalez", "Jefa de Ventas", 1),
        ("30-33445566-7", "Pablo", "Rios", "Asesor Tecnico", 1),
        ("CL-76543210-9", "Francisca", "Araya", "Gerente Exportaciones", 1),
    ]
    for c in contactos:
        try:
            cursor.execute(
                "INSERT INTO proveedor_ext_contactos (cuit, nombre, apellido, cargo, principal) VALUES (?, ?, ?, ?, ?)",
                c,
            )
        except:
            pass

    # Emails
    emails = [
        ("30-78901234-5", "ventas@instrupatagonica.com.ar", "comercial", 1),
        ("30-89012345-6", "comercial@electriindsur.com.ar", "comercial", 1),
        ("30-90123456-7", "info@hidraulicacomahue.com.ar", "comercial", 1),
        ("30-01234567-8", "ventas@seguridadindarg.com.ar", "comercial", 1),
        ("DE-123456789", "export@siemens.de", "comercial", 1),
        ("BR-98765432100", "comercial@petrobras.com.br", "comercial", 1),
        ("30-11223344-5", "ventas@acerospatagonia.com.ar", "comercial", 1),
        ("30-22334455-6", "pedidos@lubricantesdelsur.com.ar", "comercial", 1),
        ("30-33445566-7", "info@pinturasindnqn.com.ar", "comercial", 1),
        ("CL-76543210-9", "export@minerachilena.cl", "comercial", 1),
    ]
    for e in emails:
        try:
            cursor.execute(
                "INSERT INTO proveedor_ext_emails (cuit, email, tipo, principal) VALUES (?, ?, ?, ?)",
                e,
            )
        except:
            pass

    # Telefonos
    telefonos = [
        ("30-78901234-5", "+54 299 4480000", "fijo"),
        ("30-89012345-6", "+54 298 4421500", "fijo"),
        ("30-90123456-7", "+54 299 4891000", "fijo"),
        ("30-01234567-8", "+54 299 4567890", "fijo"),
        ("DE-123456789", "+49 89 636 00", "fijo"),
        ("BR-98765432100", "+55 21 3224 1000", "fijo"),
        ("30-11223344-5", "+54 299 4483000", "fijo"),
        ("30-22334455-6", "+54 299 4770000", "fijo"),
        ("30-33445566-7", "+54 299 4428000", "fijo"),
        ("CL-76543210-9", "+56 2 2345 6789", "fijo"),
    ]
    for t in telefonos:
        try:
            cursor.execute(
                "INSERT INTO proveedor_ext_telefonos (cuit, telefono, tipo) VALUES (?, ?, ?)", t
            )
        except:
            pass

    conn.commit()
    conn.close()
    print("Proveedores agregados exitosamente")


def get_sample_materials():
    """Obtener materiales de muestra de la base de datos SAP"""
    sap_db = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sap_data.db")

    # Materiales de fallback con precios variados
    fallback_materials = [
        {
            "codigo": "1000038046",
            "descripcion": "TORN.S.FIN P.10 /E2H1900 BORNEMANN",
            "precio": 15000.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000510115",
            "descripcion": "ROTOR N 100277607600 /EP12563 BORNEMANN",
            "precio": 85000.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000061632",
            "descripcion": "SELL.M.0670 FLEXIBOX RRAL0670B2CY",
            "precio": 12500.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000100",
            "descripcion": 'VALVULA DE CONTROL 2"',
            "precio": 25000.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000200",
            "descripcion": "BOMBA CENTRIFUGA 5HP",
            "precio": 185000.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000300",
            "descripcion": "FILTRO DE AIRE INDUSTRIAL",
            "precio": 4500.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000400",
            "descripcion": "MOTOR ELECTRICO 10HP",
            "precio": 220000.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000500",
            "descripcion": "RODAMIENTO SKF 6205",
            "precio": 5500.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000600",
            "descripcion": "CORREA TRANSMISION B-68",
            "precio": 3200.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000000700",
            "descripcion": 'EMPAQUETADURA GRAFITO 1/2"',
            "precio": 1800.0,
            "unidad": "MT",
        },
        {
            "codigo": "1000000800",
            "descripcion": "ACEITE HIDRAULICO ISO 68",
            "precio": 8500.0,
            "unidad": "LT",
        },
        {
            "codigo": "1000000900",
            "descripcion": "GRASA MULTIPROPOSITO EP2",
            "precio": 4200.0,
            "unidad": "KG",
        },
        {
            "codigo": "1000001000",
            "descripcion": 'TUBO ACERO INOX 2" SCH40',
            "precio": 45000.0,
            "unidad": "MT",
        },
        {
            "codigo": "1000001100",
            "descripcion": 'BRIDA SLIP-ON 4" 150#',
            "precio": 18000.0,
            "unidad": "UNI",
        },
        {
            "codigo": "1000001200",
            "descripcion": 'JUNTA SPIROMETALICA 6"',
            "precio": 6500.0,
            "unidad": "UNI",
        },
    ]

    if not os.path.exists(sap_db):
        return fallback_materials

    try:
        conn = sqlite3.connect(sap_db)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT codigo_material, descripcion
            FROM materiales_bbdd
            LIMIT 30
        """
        )
        materials = []
        for row in cursor.fetchall():
            materials.append(
                {
                    "codigo": row[0],
                    "descripcion": row[1],
                    "precio": random.uniform(2000, 150000),
                    "unidad": "UNI",
                }
            )
        conn.close()
        return materials if materials else fallback_materials
    except:
        return fallback_materials


def create_solicitudes():
    """Crear solicitudes adicionales en diferentes estados"""
    print("\n=== Creando solicitudes adicionales ===")
    conn = get_connection()
    cursor = conn.cursor()

    materials = get_sample_materials()

    # Configuracion de solicitudes a crear
    solicitudes_config = [
        # Borradores
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "Borrador",
            "criticidad": "Normal",
        },
        {
            "usuario": "9",
            "centro": "1500",
            "sector": "Mantenimiento",
            "status": "Borrador",
            "criticidad": "Baja",
        },
        {
            "usuario": "10",
            "centro": "1050",
            "sector": "Mantenimiento",
            "status": "Borrador",
            "criticidad": "Normal",
        },
        # Enviadas (pendientes de aprobacion)
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "Enviada",
            "criticidad": "Alta",
        },
        {
            "usuario": "9",
            "centro": "1500",
            "sector": "Planificacion",
            "status": "Enviada",
            "criticidad": "Urgente",
        },
        {
            "usuario": "10",
            "centro": "1050",
            "sector": "Mantenimiento",
            "status": "Enviada",
            "criticidad": "Normal",
        },
        {
            "usuario": "8",
            "centro": "1064",
            "sector": "Produccion",
            "status": "Enviada",
            "criticidad": "Alta",
        },
        # Aprobadas (listas para planificar)
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "Aprobada",
            "criticidad": "Normal",
            "aprobador": "4",
        },
        {
            "usuario": "9",
            "centro": "1500",
            "sector": "Mantenimiento",
            "status": "Aprobada",
            "criticidad": "Alta",
            "aprobador": "5",
        },
        {
            "usuario": "10",
            "centro": "1050",
            "sector": "Mantenimiento",
            "status": "Aprobada",
            "criticidad": "Urgente",
            "aprobador": "6",
        },
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Produccion",
            "status": "Aprobada",
            "criticidad": "Normal",
            "aprobador": "4",
        },
        {
            "usuario": "9",
            "centro": "1064",
            "sector": "Mantenimiento",
            "status": "Aprobada",
            "criticidad": "Alta",
            "aprobador": "6",
        },
        # En tratamiento (asignadas a planificador)
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "En tratamiento",
            "criticidad": "Alta",
            "aprobador": "4",
            "planner": "2",
        },
        {
            "usuario": "10",
            "centro": "1050",
            "sector": "Mantenimiento",
            "status": "En tratamiento",
            "criticidad": "Normal",
            "aprobador": "5",
            "planner": "3",
        },
        # Tratadas (procesadas por planificador)
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "Tratado",
            "criticidad": "Normal",
            "aprobador": "4",
            "planner": "2",
        },
        {
            "usuario": "9",
            "centro": "1500",
            "sector": "Planificacion",
            "status": "Tratado",
            "criticidad": "Alta",
            "aprobador": "6",
            "planner": "3",
        },
        # Despachadas
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "Despachada",
            "criticidad": "Normal",
            "aprobador": "4",
            "planner": "2",
        },
        {
            "usuario": "10",
            "centro": "1050",
            "sector": "Mantenimiento",
            "status": "Despachada",
            "criticidad": "Alta",
            "aprobador": "5",
            "planner": "3",
        },
        # Cerradas
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Mantenimiento",
            "status": "Cerrada",
            "criticidad": "Normal",
            "aprobador": "4",
            "planner": "2",
        },
        {
            "usuario": "9",
            "centro": "1500",
            "sector": "Mantenimiento",
            "status": "Cerrada",
            "criticidad": "Baja",
            "aprobador": "6",
            "planner": "2",
        },
        # Rechazadas
        {
            "usuario": "8",
            "centro": "1008",
            "sector": "Produccion",
            "status": "Rechazada",
            "criticidad": "Normal",
            "aprobador": "6",
        },
        {
            "usuario": "10",
            "centro": "1064",
            "sector": "Mantenimiento",
            "status": "Rechazada",
            "criticidad": "Baja",
            "aprobador": "4",
        },
    ]

    justificaciones = [
        "Reposicion de stock de seguridad por consumo en mantenimiento preventivo",
        "Reemplazo de componentes danados en linea de produccion",
        "Materiales para proyecto de mejora continua",
        "Repuestos para mantenimiento correctivo urgente",
        "Stock minimo para operacion normal de planta",
        "Materiales para parada programada de mantenimiento",
        "Insumos para reparacion de equipo critico",
        "Reposicion por rotura de equipo",
        "Materiales para ampliacion de capacidad",
        "Stock de emergencia para contingencias",
    ]

    centros_costos = ["CC-MANT-001", "CC-PROD-002", "CC-LOG-003", "CC-OPER-004", "CC-ADM-005"]
    almacenes = ["0001", "0101", "9002", "9003", "9004"]

    base_date = datetime.now()

    for i, config in enumerate(solicitudes_config):
        # Generar items aleatorios
        num_items = random.randint(1, 4)
        selected_materials = random.sample(materials, min(num_items, len(materials)))

        items = []
        total = 0
        for idx, mat in enumerate(selected_materials):
            cantidad = random.randint(1, 10)
            subtotal = mat["precio"] * cantidad
            total += subtotal
            items.append(
                {
                    "index": idx,
                    "codigo": mat["codigo"],
                    "codigo_sap": mat["codigo"],
                    "descripcion": mat["descripcion"],
                    "cantidad": cantidad,
                    "unidad": mat["unidad"],
                    "precio_unitario": mat["precio"],
                    "subtotal": subtotal,
                    "observacion": "",
                }
            )

        data_json = json.dumps(
            {
                "items": items,
                "centro": config["centro"],
                "sector": config["sector"],
                "almacen": random.choice(almacenes),
            }
        )

        # Fechas
        days_ago = random.randint(1, 30)
        created = base_date - timedelta(days=days_ago)
        updated = created + timedelta(hours=random.randint(1, 48))
        fecha_necesidad = (base_date + timedelta(days=random.randint(7, 45))).strftime("%Y-%m-%d")

        cursor.execute(
            """
            INSERT INTO solicitudes (
                id_usuario, centro, sector, justificacion, centro_costos,
                almacen_virtual, criticidad, fecha_necesidad, data_json,
                status, aprobador_id, planner_id, total_monto, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                config["usuario"],
                config["centro"],
                config["sector"],
                random.choice(justificaciones),
                random.choice(centros_costos),
                random.choice(almacenes),
                config["criticidad"],
                fecha_necesidad,
                data_json,
                config["status"],
                config.get("aprobador"),
                config.get("planner"),
                round(total, 2),
                created.strftime("%Y-%m-%d %H:%M:%S"),
                updated.strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )
        print(f"  + Solicitud {config['status']} - Usuario {config['usuario']} - ${total:,.2f}")

    conn.commit()
    conn.close()
    print(f"Creadas {len(solicitudes_config)} solicitudes")


def create_presupuestos_adicionales():
    """Agregar presupuestos para combinaciones faltantes"""
    print("\n=== Verificando presupuestos ===")
    conn = get_connection()
    cursor = conn.cursor()

    # Combinaciones que deberian existir
    combinaciones = [
        ("1064", "Logistica", 500000.0),
        ("1064", "Compras", 400000.0),
        ("1500", "Produccion", 300000.0),
        ("1500", "Logistica", 250000.0),
        ("1501", "Mantenimiento", 450000.0),
        ("1501", "Produccion", 350000.0),
        ("1502", "Mantenimiento", 400000.0),
        ("1502", "Produccion", 300000.0),
    ]

    for centro, sector, monto in combinaciones:
        cursor.execute(
            "SELECT 1 FROM presupuestos WHERE centro_id = ? AND sector = ?", (centro, sector)
        )
        if not cursor.fetchone():
            disponible = monto * random.uniform(0.6, 0.95)
            cursor.execute(
                """
                INSERT INTO presupuestos (centro_id, sector, monto_total, monto_disponible, version, responsable_id)
                VALUES (?, ?, ?, ?, 1, NULL)
            """,
                (centro, sector, monto, disponible),
            )
            print(f"  + Presupuesto {centro}/{sector}: ${monto:,.2f}")

    conn.commit()
    conn.close()
    print("Presupuestos verificados")


def create_notificaciones():
    """Crear notificaciones de ejemplo"""
    print("\n=== Creando notificaciones ===")
    conn = get_connection()
    cursor = conn.cursor()

    notificaciones = [
        ("8", "solicitud_aprobada", "Tu solicitud #25 ha sido aprobada", "/solicitud/25", 0),
        (
            "8",
            "solicitud_rechazada",
            "Tu solicitud #26 fue rechazada por presupuesto insuficiente",
            "/solicitud/26",
            0,
        ),
        (
            "9",
            "nueva_asignacion",
            "Se te ha asignado la solicitud #27 para planificar",
            "/planificador?solicitud=27",
            0,
        ),
        (
            "10",
            "material_despachado",
            "Los materiales de la solicitud #28 han sido despachados",
            "/solicitud/28",
            1,
        ),
        (
            "4",
            "pendiente_aprobacion",
            "Tienes 3 solicitudes pendientes de aprobacion",
            "/aprobaciones",
            0,
        ),
        (
            "5",
            "pendiente_aprobacion",
            "Tienes 2 solicitudes urgentes pendientes",
            "/aprobaciones",
            0,
        ),
        (
            "2",
            "nueva_asignacion",
            "Nueva solicitud asignada: Mantenimiento preventivo urgente",
            "/planificador",
            0,
        ),
        (
            "3",
            "recordatorio",
            "Recordatorio: 5 solicitudes en tratamiento requieren atencion",
            "/planificador",
            0,
        ),
    ]

    base_date = datetime.now()
    for user_id, tipo, mensaje, link, leido in notificaciones:
        created = base_date - timedelta(hours=random.randint(1, 72))
        try:
            cursor.execute(
                """
                INSERT INTO notificaciones (usuario_id, tipo, mensaje, link, leido, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (user_id, tipo, mensaje, link, leido, created.strftime("%Y-%m-%d %H:%M:%S")),
            )
        except:
            pass

    conn.commit()
    conn.close()
    print("Notificaciones creadas")


def show_summary():
    """Mostrar resumen de datos en la base"""
    print("\n" + "=" * 60)
    print("RESUMEN DE DATOS EN LA BASE DE DATOS")
    print("=" * 60)

    conn = get_connection()
    cursor = conn.cursor()

    # Usuarios
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    print(f"\nUsuarios: {cursor.fetchone()[0]}")

    # Solicitudes por estado
    print("\nSolicitudes por estado:")
    cursor.execute(
        "SELECT status, COUNT(*) FROM solicitudes GROUP BY status ORDER BY COUNT(*) DESC"
    )
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")

    # Presupuestos
    cursor.execute("SELECT COUNT(*) FROM presupuestos")
    print(f"\nPresupuestos: {cursor.fetchone()[0]}")

    # Proveedores externos
    cursor.execute("SELECT COUNT(*) FROM proveedores_externos")
    print(f"Proveedores externos: {cursor.fetchone()[0]}")

    # Notificaciones
    cursor.execute("SELECT COUNT(*) FROM notificaciones")
    print(f"Notificaciones: {cursor.fetchone()[0]}")

    conn.close()
    print("\n" + "=" * 60)


def main():
    print("=" * 60)
    print("POBLANDO BASE DE DATOS CON DATOS DE PRUEBA")
    print("=" * 60)

    update_users_almacenes()
    add_proveedores_externos()
    create_solicitudes()
    create_presupuestos_adicionales()
    create_notificaciones()
    show_summary()

    print("\n*** Datos poblados exitosamente ***")


if __name__ == "__main__":
    main()
