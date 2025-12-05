#!/usr/bin/env python3
"""
Genera datos ficticios para demo del sistema SPM.

Ejecutar desde la raíz del proyecto:
    python backend_v2/scripts/seed_demo_data.py

Genera:
- Solicitudes con todos los estados posibles
- Items de materiales reales
- Historial de tratamiento
- Notificaciones del sistema
- Mensajes entre usuarios
- Posts del foro
"""

import json
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# Ruta a la base de datos
DB_PATH = Path(__file__).parent.parent / "spm.db"

# Estados posibles de solicitud
ESTADOS = ["draft", "submitted", "approved", "rejected", "processing", "dispatched", "closed"]

# Criticidades
CRITICIDADES = ["Baja", "Normal", "Alta", "Urgente"]

# Justificaciones realistas
JUSTIFICACIONES = [
    "Reposición de stock mínimo para mantenimiento preventivo",
    "Falla en bomba principal, requiere repuestos urgentes",
    "Proyecto de mejora de eficiencia energética",
    "Mantenimiento programado de compresor",
    "Reparación de válvula de seguridad",
    "Actualización de instrumentación de campo",
    "Reemplazo de sellos mecánicos por desgaste",
    "Contingencia por rotura de línea de proceso",
    "Cambio de rodamientos preventivo",
    "Instalación de nuevo medidor de flujo",
    "Reparación de tablero eléctrico",
    "Mantenimiento de sistema de lubricación",
    "Reposición de herramientas dañadas",
    "Proyecto de automatización de pozo",
    "Upgrade de sistema de control",
    "Reparación de intercambiador de calor",
    "Mantenimiento de generador de emergencia",
    "Cambio de filtros y elementos coalescentes",
    "Reparación de grúa de servicio",
    "Actualización de sistema de protección catódica",
]

# Usuarios y sus roles
USUARIOS = {
    "8": {
        "nombre": "Juan Levi",
        "rol": "Solicitante",
        "sector": "Mantenimiento",
        "centros": ["1050", "1008"],
    },
    "9": {
        "nombre": "Pedro Mamani",
        "rol": "Solicitante",
        "sector": "Mantenimiento",
        "centros": ["1500"],
    },
    "10": {
        "nombre": "Roberto Rosas",
        "rol": "Solicitante",
        "sector": "Mantenimiento",
        "centros": ["1008", "1050"],
    },
    "4": {
        "nombre": "Carlos Perez",
        "rol": "Jefe",
        "sector": "Planificacion",
        "centros": ["1008", "1050"],
    },
    "5": {
        "nombre": "Maria Lopez",
        "rol": "Jefa",
        "sector": "Mantenimiento",
        "centros": ["1008", "1050"],
    },
    "2": {
        "nombre": "Laura Planner",
        "rol": "Planificador",
        "sector": "Planificacion",
        "centros": ["1500"],
    },
    "3": {
        "nombre": "Sergio Planner",
        "rol": "Planificador",
        "sector": "Mantenimiento",
        "centros": ["1008", "1050"],
    },
    "6": {
        "nombre": "Andres Garcia",
        "rol": "Gerente1",
        "sector": "Mantenimiento",
        "centros": ["1008", "1050", "1064"],
    },
    "1": {
        "nombre": "Manu Remón",
        "rol": "Admin",
        "sector": "Mantenimiento",
        "centros": ["1008", "1050"],
    },
}

# Solicitantes (pueden crear solicitudes)
SOLICITANTES = ["8", "9", "10"]

# Aprobadores
APROBADORES = ["4", "5", "6"]

# Planificadores
PLANIFICADORES = ["2", "3"]


def get_random_date(days_back=90):
    """Genera una fecha aleatoria en los últimos N días"""
    delta = timedelta(days=random.randint(0, days_back))
    return (datetime.now() - delta).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_materials(conn, limit=50):
    """Obtiene materiales reales de la base de datos"""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT codigo, descripcion, unidad, precio_usd
        FROM materiales
        WHERE precio_usd > 0
        ORDER BY RANDOM()
        LIMIT ?
    """,
        (limit,),
    )
    return cursor.fetchall()


def create_solicitud_items(materials, num_items):
    """Crea items para una solicitud"""
    items = []
    selected = random.sample(materials, min(num_items, len(materials)))

    for mat in selected:
        codigo, descripcion, unidad, precio = mat
        cantidad = random.randint(1, 10)
        items.append(
            {
                "codigo_sap": codigo,
                "descripcion": descripcion[:100] if descripcion else f"Material {codigo}",
                "cantidad": cantidad,
                "unidad": unidad or "UN",
                "precio_unitario": float(precio) if precio else random.uniform(100, 5000),
            }
        )

    return items


def generate_solicitudes(conn, materials):
    """Genera solicitudes con diferentes estados"""
    cursor = conn.cursor()

    # Limpiar solicitudes existentes (excepto las primeras 10 si existen)
    cursor.execute("DELETE FROM solicitudes WHERE id > 10")
    cursor.execute("DELETE FROM notificaciones")
    cursor.execute("DELETE FROM mensajes")
    cursor.execute("DELETE FROM foro_posts")
    cursor.execute("DELETE FROM foro_respuestas")
    cursor.execute("DELETE FROM solicitud_tratamiento_log")
    conn.commit()

    solicitudes_creadas = []

    # Generar 30 solicitudes con distribución de estados
    estado_distribucion = {
        "draft": 3,
        "submitted": 5,
        "approved": 6,
        "rejected": 3,
        "processing": 5,
        "dispatched": 4,
        "closed": 4,
    }

    solicitud_id = 11  # Empezar después de las existentes

    for estado, cantidad in estado_distribucion.items():
        for _ in range(cantidad):
            # Seleccionar usuario aleatorio
            user_id = random.choice(SOLICITANTES)
            user = USUARIOS[user_id]

            # Seleccionar centro del usuario
            centro = random.choice(user["centros"])
            sector = user["sector"]

            # Generar items
            num_items = random.randint(1, 5)
            items = create_solicitud_items(materials, num_items)
            total_monto = sum(item["cantidad"] * item["precio_unitario"] for item in items)

            # Fechas coherentes con el estado
            created_at = get_random_date(90)
            updated_at = created_at

            # Criticidad basada en estado
            if estado in ["processing", "dispatched"]:
                criticidad = random.choice(["Alta", "Urgente", "Normal"])
            else:
                criticidad = random.choice(CRITICIDADES)

            # Aprobador y planner según estado
            aprobador_id = None
            planner_id = None

            if estado in ["approved", "processing", "dispatched", "closed"]:
                aprobador_id = random.choice(APROBADORES)
            if estado in ["processing", "dispatched", "closed"]:
                planner_id = random.choice(PLANIFICADORES)
            if estado == "rejected":
                aprobador_id = random.choice(APROBADORES)

            # Fecha de necesidad
            fecha_necesidad = (datetime.now() + timedelta(days=random.randint(7, 60))).strftime(
                "%Y-%m-%d"
            )

            # Insertar solicitud
            cursor.execute(
                """
                INSERT INTO solicitudes (
                    id, id_usuario, centro, sector, justificacion, centro_costos,
                    almacen_virtual, criticidad, fecha_necesidad, data_json,
                    status, aprobador_id, planner_id, total_monto, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    solicitud_id,
                    user_id,
                    centro,
                    sector,
                    random.choice(JUSTIFICACIONES),
                    f"CC-{centro}-{random.randint(100, 999)}",
                    random.choice(["0001", "0101", "9002", "9003"]),
                    criticidad,
                    fecha_necesidad,
                    json.dumps({"items": items}),
                    estado,
                    aprobador_id,
                    planner_id,
                    round(total_monto, 2),
                    created_at,
                    updated_at,
                ),
            )

            solicitudes_creadas.append(
                {
                    "id": solicitud_id,
                    "estado": estado,
                    "user_id": user_id,
                    "aprobador_id": aprobador_id,
                    "planner_id": planner_id,
                    "created_at": created_at,
                }
            )

            solicitud_id += 1

    conn.commit()
    return solicitudes_creadas


def generate_tratamiento_log(conn, solicitudes):
    """Genera historial de tratamiento para solicitudes"""
    cursor = conn.cursor()

    for sol in solicitudes:
        logs = []
        base_date = datetime.fromisoformat(sol["created_at"].replace("Z", ""))

        # Log de creación
        logs.append(
            {
                "solicitud_id": sol["id"],
                "actor_id": sol["user_id"],
                "tipo": "creacion",
                "estado": "draft",
                "payload_json": json.dumps({"accion": "Solicitud creada"}),
                "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )

        if sol["estado"] != "draft":
            # Log de envío
            base_date += timedelta(hours=random.randint(1, 24))
            logs.append(
                {
                    "solicitud_id": sol["id"],
                    "actor_id": sol["user_id"],
                    "tipo": "envio",
                    "estado": "submitted",
                    "payload_json": json.dumps({"accion": "Solicitud enviada para aprobación"}),
                    "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )

        if sol["estado"] in ["approved", "processing", "dispatched", "closed"]:
            # Log de aprobación
            base_date += timedelta(hours=random.randint(2, 48))
            logs.append(
                {
                    "solicitud_id": sol["id"],
                    "actor_id": sol["aprobador_id"],
                    "tipo": "aprobacion",
                    "estado": "approved",
                    "payload_json": json.dumps(
                        {
                            "accion": "Solicitud aprobada",
                            "comentario": "Aprobado según presupuesto disponible",
                        }
                    ),
                    "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )

        if sol["estado"] == "rejected":
            # Log de rechazo
            base_date += timedelta(hours=random.randint(2, 48))
            motivos_rechazo = [
                "Presupuesto insuficiente para este período",
                "Material no prioritario, diferir al próximo mes",
                "Requiere justificación técnica adicional",
                "Solicitar cotización alternativa",
            ]
            logs.append(
                {
                    "solicitud_id": sol["id"],
                    "actor_id": sol["aprobador_id"],
                    "tipo": "rechazo",
                    "estado": "rejected",
                    "payload_json": json.dumps(
                        {"accion": "Solicitud rechazada", "motivo": random.choice(motivos_rechazo)}
                    ),
                    "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )

        if sol["estado"] in ["processing", "dispatched", "closed"]:
            # Log de asignación a planner
            base_date += timedelta(hours=random.randint(1, 12))
            logs.append(
                {
                    "solicitud_id": sol["id"],
                    "actor_id": sol["planner_id"],
                    "tipo": "asignacion",
                    "estado": "processing",
                    "payload_json": json.dumps(
                        {"accion": "Asignado a planificador para tratamiento"}
                    ),
                    "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )

        if sol["estado"] in ["dispatched", "closed"]:
            # Log de despacho
            base_date += timedelta(days=random.randint(1, 7))
            logs.append(
                {
                    "solicitud_id": sol["id"],
                    "actor_id": sol["planner_id"],
                    "tipo": "despacho",
                    "estado": "dispatched",
                    "payload_json": json.dumps(
                        {
                            "accion": "Material despachado",
                            "guia": f"GD-{random.randint(1000, 9999)}",
                        }
                    ),
                    "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )

        if sol["estado"] == "closed":
            # Log de cierre
            base_date += timedelta(days=random.randint(1, 3))
            logs.append(
                {
                    "solicitud_id": sol["id"],
                    "actor_id": sol["user_id"],
                    "tipo": "cierre",
                    "estado": "closed",
                    "payload_json": json.dumps(
                        {"accion": "Solicitud cerrada", "conformidad": "Material recibido conforme"}
                    ),
                    "created_at": base_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )

        # Insertar logs
        for log in logs:
            cursor.execute(
                """
                INSERT INTO solicitud_tratamiento_log (
                    solicitud_id, item_index, actor_id, tipo, estado, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    log["solicitud_id"],
                    None,
                    log["actor_id"],
                    log["tipo"],
                    log["estado"],
                    log["payload_json"],
                    log["created_at"],
                ),
            )

    conn.commit()


def generate_notificaciones(conn, solicitudes):
    """Genera notificaciones del sistema"""
    cursor = conn.cursor()

    for sol in solicitudes:
        # Notificación al solicitante según estado
        mensaje = ""
        tipo = "info"

        if sol["estado"] == "submitted":
            mensaje = f"Tu solicitud #{sol['id']} ha sido enviada y está pendiente de aprobación"
            tipo = "info"
        elif sol["estado"] == "approved":
            mensaje = f"Tu solicitud #{sol['id']} ha sido aprobada"
            tipo = "success"
        elif sol["estado"] == "rejected":
            mensaje = f"Tu solicitud #{sol['id']} ha sido rechazada. Revisa los comentarios"
            tipo = "warning"
        elif sol["estado"] == "processing":
            mensaje = f"Tu solicitud #{sol['id']} está siendo procesada por el planificador"
            tipo = "info"
        elif sol["estado"] == "dispatched":
            mensaje = f"El material de tu solicitud #{sol['id']} ha sido despachado"
            tipo = "success"
        elif sol["estado"] == "closed":
            mensaje = f"Tu solicitud #{sol['id']} ha sido cerrada exitosamente"
            tipo = "success"

        if mensaje:
            cursor.execute(
                """
                INSERT INTO notificaciones (
                    destinatario_id, solicitud_id, mensaje, leido, tipo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            """,
                (
                    sol["user_id"],
                    sol["id"],
                    mensaje,
                    random.choice([0, 1]),
                    tipo,
                    sol["created_at"],
                ),
            )

        # Notificación al aprobador para solicitudes enviadas
        if sol["estado"] == "submitted":
            for aprobador in APROBADORES[:2]:
                cursor.execute(
                    """
                    INSERT INTO notificaciones (
                        destinatario_id, solicitud_id, mensaje, leido, tipo, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                    (
                        aprobador,
                        sol["id"],
                        f"Nueva solicitud #{sol['id']} requiere tu aprobación",
                        random.choice([0, 1]),
                        "info",
                        sol["created_at"],
                    ),
                )

        # Notificación al planificador para solicitudes aprobadas
        if sol["estado"] in ["approved", "processing"]:
            for planner in PLANIFICADORES:
                cursor.execute(
                    """
                    INSERT INTO notificaciones (
                        destinatario_id, solicitud_id, mensaje, leido, tipo, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                    (
                        planner,
                        sol["id"],
                        f"Solicitud #{sol['id']} aprobada, lista para tratamiento",
                        random.choice([0, 1]),
                        "info",
                        sol["created_at"],
                    ),
                )

    conn.commit()


def generate_mensajes(conn, solicitudes):
    """Genera mensajes entre usuarios"""
    cursor = conn.cursor()

    asuntos = [
        "Consulta sobre solicitud",
        "Urgente: Material requerido",
        "Seguimiento de pedido",
        "Aclaración sobre especificaciones",
        "Confirmación de recepción",
        "Cambio de prioridad",
        "Consulta sobre stock",
        "Coordinación de entrega",
    ]

    mensajes_texto = [
        "Hola, quería consultar sobre el estado de esta solicitud. ¿Hay novedades?",
        "Necesitamos acelerar este pedido debido a una contingencia en campo.",
        "Los materiales fueron recibidos conforme. Gracias por la gestión.",
        "¿Podrían indicar una fecha estimada de entrega?",
        "El material especificado no está disponible. ¿Aceptan equivalente?",
        "Se requiere cambiar la cantidad solicitada. Por favor revisar.",
        "Confirmo la correcta recepción del material.",
        "Favor coordinar la entrega para el turno de la mañana.",
    ]

    # Generar algunos mensajes relacionados con solicitudes
    for sol in random.sample(solicitudes, min(15, len(solicitudes))):
        remitente = sol["user_id"]
        destinatario = sol["aprobador_id"] or random.choice(APROBADORES)

        cursor.execute(
            """
            INSERT INTO mensajes (
                remitente_id, destinatario_id, solicitud_id, asunto, mensaje,
                leido, tipo, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                remitente,
                destinatario,
                sol["id"],
                random.choice(asuntos),
                random.choice(mensajes_texto),
                random.choice([0, 1]),
                "mensaje",
                sol["created_at"],
            ),
        )

        # A veces agregar respuesta
        if random.random() > 0.5:
            cursor.execute(
                """
                INSERT INTO mensajes (
                    remitente_id, destinatario_id, solicitud_id, asunto, mensaje,
                    leido, tipo, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    destinatario,
                    remitente,
                    sol["id"],
                    f"Re: {random.choice(asuntos)}",
                    random.choice(mensajes_texto),
                    random.choice([0, 1]),
                    "mensaje",
                    get_random_date(30),
                ),
            )

    conn.commit()


def generate_foro_posts(conn):
    """Genera posts del foro"""
    cursor = conn.cursor()

    posts_data = [
        {
            "titulo": "Mejores prácticas para solicitudes urgentes",
            "contenido": "Comparto algunas recomendaciones para gestionar solicitudes urgentes de manera eficiente...",
            "categoria": "tips",
        },
        {
            "titulo": "Nuevo proceso de aprobación de presupuesto",
            "contenido": "A partir de este mes, las solicitudes mayores a $10,000 requieren doble aprobación...",
            "categoria": "anuncios",
        },
        {
            "titulo": "Problema con materiales del proveedor X",
            "contenido": "¿Alguien más ha tenido problemas con los tiempos de entrega del proveedor X?",
            "categoria": "general",
        },
        {
            "titulo": "Capacitación: Sistema SPM 2.0",
            "contenido": "Se realizará una capacitación virtual el próximo viernes sobre las nuevas funcionalidades...",
            "categoria": "anuncios",
        },
        {
            "titulo": "Consulta sobre equivalencias de materiales",
            "contenido": "¿Cuál es el procedimiento para solicitar un material equivalente cuando el original no está disponible?",
            "categoria": "consultas",
        },
        {
            "titulo": "Optimización de tiempos de entrega",
            "contenido": "Hemos logrado reducir los tiempos de entrega en un 30% con estas estrategias...",
            "categoria": "tips",
        },
    ]

    respuestas_genericas = [
        "Excelente información, muy útil!",
        "Gracias por compartir, lo tendré en cuenta.",
        "Totalmente de acuerdo con este enfoque.",
        "¿Podrías ampliar un poco más sobre este punto?",
        "En mi experiencia, esto ha funcionado muy bien.",
    ]

    for post in posts_data:
        autor_id = random.choice(list(USUARIOS.keys()))
        autor = USUARIOS[autor_id]

        cursor.execute(
            """
            INSERT INTO foro_posts (
                autor_id, autor_nombre, titulo, contenido, categoria,
                likes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (
                autor_id,
                autor["nombre"],
                post["titulo"],
                post["contenido"],
                post["categoria"],
                random.randint(0, 15),
                get_random_date(60),
            ),
        )

        post_id = cursor.lastrowid

        # Agregar algunas respuestas
        num_respuestas = random.randint(0, 4)
        for _ in range(num_respuestas):
            resp_autor_id = random.choice(list(USUARIOS.keys()))
            resp_autor = USUARIOS[resp_autor_id]

            cursor.execute(
                """
                INSERT INTO foro_respuestas (
                    post_id, autor_id, autor_nombre, contenido, created_at
                ) VALUES (?, ?, ?, ?, ?)
            """,
                (
                    post_id,
                    resp_autor_id,
                    resp_autor["nombre"],
                    random.choice(respuestas_genericas),
                    get_random_date(30),
                ),
            )

    conn.commit()


def main():
    """Ejecuta la generación de datos demo"""
    print("=" * 60)
    print("  SPM - Generador de Datos Demo")
    print("=" * 60)

    if not DB_PATH.exists():
        print(f"ERROR: Base de datos no encontrada en {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)

    try:
        # Obtener materiales
        print("\n[1/5] Obteniendo materiales de la base de datos...")
        materials = get_materials(conn, limit=100)
        print(f"      {len(materials)} materiales disponibles")

        # Generar solicitudes
        print("\n[2/5] Generando solicitudes con diferentes estados...")
        solicitudes = generate_solicitudes(conn, materials)
        print(f"      {len(solicitudes)} solicitudes creadas")

        # Estado breakdown
        estados_count = {}
        for sol in solicitudes:
            estados_count[sol["estado"]] = estados_count.get(sol["estado"], 0) + 1
        for estado, count in estados_count.items():
            print(f"         - {estado}: {count}")

        # Generar historial
        print("\n[3/5] Generando historial de tratamiento...")
        generate_tratamiento_log(conn, solicitudes)
        print("      Historial creado")

        # Generar notificaciones
        print("\n[4/5] Generando notificaciones...")
        generate_notificaciones(conn, solicitudes)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM notificaciones")
        notif_count = cursor.fetchone()[0]
        print(f"      {notif_count} notificaciones creadas")

        # Generar mensajes
        print("\n[5/5] Generando mensajes y posts del foro...")
        generate_mensajes(conn, solicitudes)
        generate_foro_posts(conn)
        cursor.execute("SELECT COUNT(*) FROM mensajes")
        msg_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM foro_posts")
        post_count = cursor.fetchone()[0]
        print(f"      {msg_count} mensajes, {post_count} posts del foro")

        print("\n" + "=" * 60)
        print("  DATOS DEMO GENERADOS EXITOSAMENTE!")
        print("=" * 60)
        print("\nUsuarios de prueba (contraseña: 'a'):")
        print("  - admin (id=1): Administrador completo")
        print("  - Usuario 8 (Juan Levi): Solicitante")
        print("  - Usuario 4 (Carlos Perez): Aprobador")
        print("  - Usuario 2 (Laura Planner): Planificador")
        print()

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback

        traceback.print_exc()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
