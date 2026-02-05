#!/usr/bin/env python3
"""
Script para generar datos de prueba completos para SPM v3.0

Genera:
- 30 usuarios nuevos con roles y puestos válidos
- 500 solicitudes con estados coherentes
- Presupuestos y ledger histórico
- Notificaciones (leídas y no leídas)
- Posts del foro

Ejecutar: python scripts/seed_complete_data.py
"""

import sqlite3
import json
import random
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

# Configuración
DATA_DIR = Path(__file__).parent.parent / "data"
SPM_DB = DATA_DIR / "spm.db"
CATALOGO_DB = DATA_DIR / "catalogo_materiales.db"

# Fechas
START_DATE = datetime(2025, 1, 1)
END_DATE = datetime.now()

# Catálogos válidos
ROLES = [
    'Solicitante',
    'Solicitante, Aprobador Solicitudes',
    'Solicitante, Aprobador Solicitudes, Aprobador de Presupuesto',
    'Planificador',
    'Planificador, Solicitante',
    'Administrador'
]

PUESTOS = ['Planificador', 'Jefe', 'Gerente1', 'Gerente2', 'Director', 'Supervisor', 'Analista', 'Coordinador']
CENTROS = ['AA101', 'AA102', 'AA103', 'AA104', 'AA105', 'AA106']
SECTORES = ['Almacenes', 'Compras', 'Mantenimiento', 'Planificacion', 'Produccion', 'Logistica']
ALMACENES = ['AA001', 'AA012', 'AA101', 'II002', 'II003', 'II004']
CRITICIDADES = ['alta', 'media', 'baja']
STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'processing', 'closed']

# Nombres para generar usuarios
NOMBRES = [
    'Ana', 'Carlos', 'Maria', 'Pedro', 'Laura', 'Diego', 'Sofia', 'Miguel',
    'Valentina', 'Andres', 'Camila', 'Santiago', 'Isabella', 'Mateo', 'Lucia',
    'Sebastian', 'Emma', 'Daniel', 'Martina', 'Nicolas', 'Paula', 'Gabriel',
    'Antonella', 'Lucas', 'Catalina', 'Benjamin', 'Victoria', 'Tomas', 'Renata', 'Felipe'
]

APELLIDOS = [
    'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Hernandez', 'Perez',
    'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Reyes',
    'Morales', 'Jimenez', 'Ruiz', 'Alvarez', 'Romero', 'Mendez', 'Vargas', 'Castro',
    'Ortiz', 'Rubio', 'Molina', 'Delgado', 'Ramos', 'Navarro', 'Silva'
]

JUSTIFICACIONES = [
    'Reposición de stock mínimo para operaciones críticas',
    'Mantenimiento preventivo programado',
    'Solicitud urgente por falla de equipo',
    'Proyecto de mejora continua',
    'Reemplazo de componentes obsoletos',
    'Ampliación de capacidad operativa',
    'Cumplimiento de normativa de seguridad',
    'Optimización de procesos productivos',
    'Reparación de equipamiento crítico',
    'Actualización tecnológica planificada',
    'Soporte a nuevos proyectos',
    'Reducción de tiempos de parada',
    'Mejora de eficiencia energética',
    'Implementación de estándares de calidad',
    'Preparación para auditoría externa'
]

FORO_CATEGORIAS = ['General', 'Técnico', 'Procesos', 'Sistemas', 'Anuncios']

FORO_TITULOS = [
    '¿Cómo optimizar el proceso de aprobación?',
    'Nuevo procedimiento para solicitudes urgentes',
    'Tips para selección de proveedores',
    'Mejores prácticas en gestión de inventario',
    'Actualización del sistema - Nuevas funcionalidades',
    '¿Dudas sobre el módulo de presupuestos?',
    'Capacitación disponible para planificadores',
    'Cambios en política de compras',
    'Integración con SAP - Preguntas frecuentes',
    'Reportes mensuales - Cómo interpretarlos'
]


def random_date(start: datetime, end: datetime) -> datetime:
    """Generar fecha aleatoria entre start y end."""
    delta = end - start
    random_days = random.randint(0, delta.days)
    random_seconds = random.randint(0, 86400)
    return start + timedelta(days=random_days, seconds=random_seconds)


def hash_password(password: str) -> str:
    """Generar hash bcrypt-like para password."""
    # Usar un hash simple para demo (en producción usar bcrypt)
    return '$2b$12$' + hashlib.sha256(password.encode()).hexdigest()[:53]


def get_materials(cursor_cat, limit=100):
    """Obtener materiales aleatorios del catálogo."""
    cursor_cat.execute('''
        SELECT codigo, descripcion, precio_usd
        FROM materiales
        WHERE precio_usd > 0 AND precio_usd < 10000
        ORDER BY RANDOM()
        LIMIT ?
    ''', (limit,))
    return cursor_cat.fetchall()


def create_users(cursor, start_id=11, count=30):
    """Crear usuarios nuevos."""
    print(f"\nCreando {count} usuarios...")

    users_created = []

    for i in range(count):
        user_id = str(start_id + i)
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        rol = random.choice(ROLES)
        puesto = random.choice(PUESTOS)
        sector = random.choice(SECTORES)
        centros = ','.join(random.sample(CENTROS, random.randint(1, 3)))

        # Asignar jefes y gerentes (usuarios existentes 4-7)
        jefe = str(random.randint(4, 5)) if random.random() > 0.3 else None
        gerente1 = str(random.randint(6, 7)) if random.random() > 0.3 else None
        gerente2 = '7' if gerente1 == '6' else ('6' if gerente1 == '7' else None)

        email = f"{nombre.lower()}.{apellido.lower()}{user_id}@demo.local"
        password = hash_password('demo123')

        cursor.execute('''
            INSERT INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, posicion,
                                  sector, centros, jefe, gerente1, gerente2, telefono,
                                  estado_registro, id_ypf, almacenes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', ?, ?)
        ''', (user_id, nombre, apellido, rol, password, email, puesto, sector, centros,
              jefe, gerente1, gerente2, f'+54 11 {random.randint(1000, 9999)}-{random.randint(1000, 9999)}',
              f'YPF{user_id.zfill(6)}', random.choice(ALMACENES)))

        users_created.append({
            'id': user_id,
            'nombre': f"{nombre} {apellido}",
            'rol': rol,
            'centros': centros.split(',')
        })

    print(f"  ✓ {count} usuarios creados (IDs {start_id}-{start_id + count - 1})")
    return users_created


def create_solicitudes(cursor, cursor_cat, users, count=500):
    """Crear solicitudes con estados coherentes."""
    print(f"\nCreando {count} solicitudes...")

    # Obtener materiales del catálogo
    materials = get_materials(cursor_cat, 500)

    # Obtener todos los usuarios para asignaciones
    cursor.execute("SELECT id_spm, nombre, apellido, rol FROM usuarios")
    all_users = cursor.fetchall()

    # Filtrar aprobadores y planificadores
    aprobadores = [u for u in all_users if 'Aprobador' in u[3] or 'Administrador' in u[3]]
    planificadores = [u for u in all_users if 'Planificador' in u[3] or 'Administrador' in u[3]]
    solicitantes = [u for u in all_users if 'Solicitante' in u[3]]

    solicitudes_created = []

    for i in range(count):
        # Usuario solicitante
        user = random.choice(solicitantes) if solicitantes else random.choice(all_users)
        user_id = user[0]

        # Fechas
        created_at = random_date(START_DATE, END_DATE)
        updated_at = created_at + timedelta(hours=random.randint(1, 72))
        fecha_necesidad = created_at + timedelta(days=random.randint(7, 60))

        # Datos básicos
        centro = random.choice(CENTROS)
        sector = random.choice(SECTORES)
        almacen = random.choice(ALMACENES)
        criticidad = random.choice(CRITICIDADES)
        justificacion = random.choice(JUSTIFICACIONES)

        # Estado con distribución realista
        status_weights = {
            'draft': 0.05,
            'submitted': 0.10,
            'approved': 0.25,
            'rejected': 0.10,
            'processing': 0.20,
            'closed': 0.30
        }
        status = random.choices(list(status_weights.keys()),
                               weights=list(status_weights.values()))[0]

        # Items (1-5 materiales)
        num_items = random.randint(1, 5)
        items_materials = random.sample(materials, min(num_items, len(materials)))
        items = []
        total_monto = 0

        for mat in items_materials:
            cantidad = random.randint(1, 50)
            precio = float(mat[2]) if mat[2] else random.uniform(10, 500)
            subtotal = cantidad * precio
            total_monto += subtotal

            items.append({
                'material': mat[0],
                'descripcion': mat[1],
                'cantidad': cantidad,
                'unidad': 'UN',
                'precio_usd': round(precio, 2),
                'subtotal': round(subtotal, 2)
            })

        data_json = json.dumps({'items': items, 'archivos': []})

        # Asignar aprobador y planificador según estado
        aprobador_id = None
        planner_id = None

        if status in ['approved', 'rejected', 'processing', 'closed']:
            aprobador_id = random.choice(aprobadores)[0] if aprobadores else '1'

        if status in ['processing', 'closed']:
            planner_id = random.choice(planificadores)[0] if planificadores else '2'

        cursor.execute('''
            INSERT INTO solicitudes (id_usuario, centro, sector, justificacion, centro_costos,
                                    almacen_virtual, criticidad, fecha_necesidad, data_json,
                                    status, aprobador_id, planner_id, total_monto, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, centro, sector, justificacion, f'CC-{centro}-{sector[:3].upper()}',
              almacen, criticidad, fecha_necesidad.strftime('%Y-%m-%d'), data_json,
              status, aprobador_id, planner_id, round(total_monto, 2),
              created_at.strftime('%Y-%m-%d %H:%M:%S'), updated_at.strftime('%Y-%m-%d %H:%M:%S')))

        sol_id = cursor.lastrowid
        solicitudes_created.append({
            'id': sol_id,
            'status': status,
            'user_id': user_id,
            'centro': centro,
            'sector': sector,
            'monto': total_monto,
            'created_at': created_at
        })

    # Distribución de estados
    status_counts = {}
    for s in solicitudes_created:
        status_counts[s['status']] = status_counts.get(s['status'], 0) + 1

    print(f"  ✓ {count} solicitudes creadas")
    print(f"  Distribución: {status_counts}")

    return solicitudes_created


def create_presupuestos(cursor, solicitudes):
    """Crear/actualizar presupuestos y generar ledger histórico."""
    print("\nCreando presupuestos y ledger histórico...")

    # Limpiar presupuestos existentes
    cursor.execute("DELETE FROM presupuesto_ledger")
    cursor.execute("DELETE FROM presupuestos")

    # Crear presupuesto inicial para cada combinación centro/sector
    presupuestos = {}
    for centro in CENTROS:
        for sector in SECTORES:
            monto_inicial = random.randint(500000, 2000000)  # 500K - 2M USD
            monto_cents = monto_inicial * 100

            presupuestos[(centro, sector)] = {
                'monto_cents': monto_cents,
                'saldo_cents': monto_cents,
                'movimientos': []
            }

    # Procesar solicitudes aprobadas/cerradas para consumir presupuesto
    solicitudes_sorted = sorted(solicitudes, key=lambda x: x['created_at'])

    for sol in solicitudes_sorted:
        if sol['status'] in ['approved', 'processing', 'closed']:
            key = (sol['centro'], sol['sector'])
            if key in presupuestos:
                monto_cents = int(sol['monto'] * 100)
                pres = presupuestos[key]

                saldo_anterior = pres['saldo_cents']
                saldo_posterior = saldo_anterior - monto_cents

                if saldo_posterior >= 0:
                    pres['saldo_cents'] = saldo_posterior
                    pres['movimientos'].append({
                        'tipo': 'consumo_aprobacion',  # Tipo válido según CHECK constraint
                        'monto_cents': -monto_cents,
                        'saldo_anterior': saldo_anterior,
                        'saldo_posterior': saldo_posterior,
                        'referencia_id': sol['id'],
                        'created_at': sol['created_at']
                    })

    # Agregar incorporaciones aleatorias de presupuesto (usando BUR aprobados)
    for key in presupuestos:
        num_incorporaciones = random.randint(1, 3)
        for _ in range(num_incorporaciones):
            pres = presupuestos[key]
            monto_inc = random.randint(50000, 200000) * 100  # 50K-200K USD
            saldo_anterior = pres['saldo_cents']
            saldo_posterior = saldo_anterior + monto_inc
            pres['saldo_cents'] = saldo_posterior

            fecha = random_date(START_DATE, END_DATE)
            pres['movimientos'].append({
                'tipo': 'bur_aprobado',  # Tipo válido según CHECK constraint
                'monto_cents': monto_inc,
                'saldo_anterior': saldo_anterior,
                'saldo_posterior': saldo_posterior,
                'referencia_id': None,
                'created_at': fecha
            })

    # Insertar presupuestos
    for (centro, sector), pres in presupuestos.items():
        cursor.execute('''
            INSERT INTO presupuestos (centro, sector, monto_usd, saldo_usd, version,
                                     updated_by, monto_cents, saldo_cents)
            VALUES (?, ?, ?, ?, 1, '1', ?, ?)
        ''', (centro, sector, pres['monto_cents'] / 100, pres['saldo_cents'] / 100,
              pres['monto_cents'], pres['saldo_cents']))

    # Insertar ledger
    ledger_count = 0
    for (centro, sector), pres in presupuestos.items():
        # Ordenar movimientos por fecha
        movimientos = sorted(pres['movimientos'], key=lambda x: x['created_at'])

        for i, mov in enumerate(movimientos):
            idempotency_key = f"{centro}-{sector}-{mov['tipo']}-{i}-{mov['created_at'].timestamp()}"

            cursor.execute('''
                INSERT INTO presupuesto_ledger (idempotency_key, centro, sector, tipo_movimiento,
                                               monto_cents, saldo_anterior_cents, saldo_posterior_cents,
                                               referencia_tipo, referencia_id, actor_id, actor_rol,
                                               motivo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1', 'Admin', ?, ?)
            ''', (idempotency_key, centro, sector, mov['tipo'], mov['monto_cents'],
                  mov['saldo_anterior'], mov['saldo_posterior'],
                  'solicitud' if mov['referencia_id'] else None, mov['referencia_id'],
                  f"{'Consumo por aprobación de solicitud' if mov['tipo'] == 'consumo_aprobacion' else 'Incorporación por BUR aprobado'}",
                  mov['created_at'].strftime('%Y-%m-%d %H:%M:%S')))
            ledger_count += 1

    print(f"  ✓ {len(presupuestos)} presupuestos creados")
    print(f"  ✓ {ledger_count} movimientos en ledger")


def create_notificaciones(cursor, solicitudes, users):
    """Crear notificaciones coherentes."""
    print("\nCreando notificaciones...")

    cursor.execute("DELETE FROM notificaciones")

    # Obtener todos los usuarios
    cursor.execute("SELECT id_spm, nombre, apellido FROM usuarios")
    all_users = {u[0]: f"{u[1]} {u[2]}" for u in cursor.fetchall()}

    notif_count = 0

    NOTIF_TEMPLATES = {
        'submitted': [
            "Nueva solicitud #{id} requiere su aprobación",
            "Solicitud #{id} enviada para revisión",
        ],
        'approved': [
            "Su solicitud #{id} ha sido aprobada",
            "Solicitud #{id} aprobada - Pendiente de planificación",
        ],
        'rejected': [
            "Su solicitud #{id} ha sido rechazada",
            "Solicitud #{id} rechazada - Revisar observaciones",
        ],
        'processing': [
            "Solicitud #{id} en proceso de planificación",
            "Su solicitud #{id} está siendo procesada",
        ],
        'closed': [
            "Solicitud #{id} completada exitosamente",
            "Su solicitud #{id} ha sido cerrada",
        ]
    }

    for sol in solicitudes:
        if sol['status'] == 'draft':
            continue

        templates = NOTIF_TEMPLATES.get(sol['status'], [])
        if not templates:
            continue

        mensaje = random.choice(templates).format(id=sol['id'])
        destinatario = sol['user_id']
        leido = 1 if random.random() > 0.3 else 0  # 70% leídas

        created_at = sol['created_at'] + timedelta(minutes=random.randint(1, 60))

        cursor.execute('''
            INSERT INTO notificaciones (destinatario_id, solicitud_id, mensaje, leido, created_at, tipo)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (destinatario, sol['id'], mensaje, leido,
              created_at.strftime('%Y-%m-%d %H:%M:%S'),
              sol['status']))
        notif_count += 1

        # Notificación adicional para aprobadores en solicitudes submitted
        if sol['status'] == 'submitted' and random.random() > 0.5:
            # Notificar a un aprobador aleatorio
            aprobador = random.choice([u for u in all_users.keys() if int(u) >= 4 and int(u) <= 7])
            cursor.execute('''
                INSERT INTO notificaciones (destinatario_id, solicitud_id, mensaje, leido, created_at, tipo)
                VALUES (?, ?, ?, ?, ?, 'pendiente_aprobacion')
            ''', (aprobador, sol['id'], f"Solicitud #{sol['id']} pendiente de su aprobación",
                  random.randint(0, 1), created_at.strftime('%Y-%m-%d %H:%M:%S')))
            notif_count += 1

    # Contar leídas vs no leídas
    cursor.execute("SELECT leido, COUNT(*) FROM notificaciones GROUP BY leido")
    stats = {r[0]: r[1] for r in cursor.fetchall()}

    print(f"  ✓ {notif_count} notificaciones creadas")
    print(f"  Leídas: {stats.get(1, 0)}, No leídas: {stats.get(0, 0)}")


def create_foro(cursor):
    """Crear posts y respuestas del foro."""
    print("\nCreando contenido del foro...")

    cursor.execute("DELETE FROM foro_likes")
    cursor.execute("DELETE FROM foro_respuestas")
    cursor.execute("DELETE FROM foro_posts")

    # Obtener usuarios
    cursor.execute("SELECT id_spm, nombre, apellido FROM usuarios")
    users = [(u[0], f"{u[1]} {u[2]}") for u in cursor.fetchall()]

    CONTENIDOS_POST = [
        "Quería compartir mi experiencia con el nuevo proceso de aprobaciones. Ha sido muy eficiente desde que implementamos los niveles de autorización automáticos. ¿Alguien más ha notado mejoras?",
        "Les comparto algunos tips que me han funcionado para agilizar las solicitudes:\n1. Completar toda la información desde el inicio\n2. Adjuntar cotizaciones cuando sea posible\n3. Usar las plantillas predefinidas",
        "Importante: A partir del próximo mes, todas las solicitudes mayores a $100,000 USD requerirán aprobación del directorio. Por favor planifiquen con anticipación.",
        "¿Alguien sabe cómo configurar las alertas de stock mínimo? Necesito que me notifique cuando llegue al punto de reorden.",
        "Excelente noticia: ya está disponible el módulo de reportes avanzados. Pueden generar análisis de consumo histórico y proyecciones.",
        "Recordatorio: La capacitación sobre el nuevo módulo de presupuestos será este viernes a las 10am. Es obligatoria para todos los planificadores.",
        "¿Cuál es el tiempo promedio de aprobación que están teniendo? En nuestro sector ha mejorado bastante.",
        "Sugerencia: Sería útil poder duplicar solicitudes anteriores para materiales recurrentes. ¿Qué opinan?",
        "Consulta técnica: ¿Cómo se manejan las equivalencias de materiales cuando el original está en falta?",
        "Gracias al equipo de sistemas por las mejoras en la velocidad del sistema. Se nota mucho la diferencia."
    ]

    RESPUESTAS = [
        "Totalmente de acuerdo. También he notado mejoras en los tiempos de respuesta.",
        "Gracias por compartir, muy útil la información.",
        "¿Podrías dar más detalles sobre esto?",
        "Excelente aporte, lo voy a implementar.",
        "En mi experiencia, esto funciona muy bien.",
        "Interesante, no sabía que se podía hacer así.",
        "Confirmo, a nosotros también nos está funcionando.",
        "Buena pregunta, también me gustaría saber.",
        "Creo que esto debería ser una funcionalidad estándar.",
        "Muy buena sugerencia, ojalá lo implementen pronto."
    ]

    posts_created = []

    # Crear 10-15 posts
    num_posts = random.randint(10, 15)
    for i in range(num_posts):
        autor = random.choice(users)
        titulo = random.choice(FORO_TITULOS) if i < len(FORO_TITULOS) else f"Consulta sobre procesos #{i}"
        contenido = random.choice(CONTENIDOS_POST)
        categoria = random.choice(FORO_CATEGORIAS)
        created_at = random_date(START_DATE, END_DATE)
        likes = random.randint(0, 20)

        cursor.execute('''
            INSERT INTO foro_posts (autor_id, autor_nombre, titulo, contenido, categoria, likes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (autor[0], autor[1], titulo, contenido, categoria, likes,
              created_at.strftime('%Y-%m-%d %H:%M:%S'), created_at.strftime('%Y-%m-%d %H:%M:%S')))

        post_id = cursor.lastrowid
        posts_created.append({'id': post_id, 'created_at': created_at})

    # Crear respuestas (2-5 por post)
    respuestas_count = 0
    for post in posts_created:
        num_respuestas = random.randint(2, 5)
        for j in range(num_respuestas):
            autor = random.choice(users)
            contenido = random.choice(RESPUESTAS)
            created_at = post['created_at'] + timedelta(hours=random.randint(1, 72))

            cursor.execute('''
                INSERT INTO foro_respuestas (post_id, autor_id, autor_nombre, contenido, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (post['id'], autor[0], autor[1], contenido, created_at.strftime('%Y-%m-%d %H:%M:%S')))
            respuestas_count += 1

    # Crear algunos likes
    likes_count = 0
    for post in posts_created:
        num_likes = random.randint(0, 10)
        likers = random.sample(users, min(num_likes, len(users)))
        for liker in likers:
            try:
                cursor.execute('''
                    INSERT INTO foro_likes (post_id, usuario_id, created_at)
                    VALUES (?, ?, ?)
                ''', (post['id'], liker[0], datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
                likes_count += 1
            except:
                pass  # Ignorar duplicados

    print(f"  ✓ {len(posts_created)} posts creados")
    print(f"  ✓ {respuestas_count} respuestas creadas")
    print(f"  ✓ {likes_count} likes registrados")


def main():
    print("=" * 70)
    print("GENERACIÓN DE DATOS DE PRUEBA - SPM v3.0")
    print("=" * 70)
    print(f"Período: {START_DATE.strftime('%Y-%m-%d')} a {END_DATE.strftime('%Y-%m-%d')}")

    # Conexiones
    conn_spm = sqlite3.connect(SPM_DB)
    conn_cat = sqlite3.connect(CATALOGO_DB)
    cursor_spm = conn_spm.cursor()
    cursor_cat = conn_cat.cursor()

    try:
        # 1. Crear usuarios
        users = create_users(cursor_spm, start_id=11, count=30)

        # 2. Crear solicitudes
        solicitudes = create_solicitudes(cursor_spm, cursor_cat, users, count=500)

        # 3. Crear presupuestos y ledger
        create_presupuestos(cursor_spm, solicitudes)

        # 4. Crear notificaciones
        create_notificaciones(cursor_spm, solicitudes, users)

        # 5. Crear foro
        create_foro(cursor_spm)

        # Commit
        conn_spm.commit()

        print("\n" + "=" * 70)
        print("✅ GENERACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 70)

        # Resumen final
        cursor_spm.execute("SELECT COUNT(*) FROM usuarios")
        print(f"\nUsuarios totales: {cursor_spm.fetchone()[0]}")
        cursor_spm.execute("SELECT COUNT(*) FROM solicitudes")
        print(f"Solicitudes totales: {cursor_spm.fetchone()[0]}")
        cursor_spm.execute("SELECT COUNT(*) FROM presupuestos")
        print(f"Presupuestos: {cursor_spm.fetchone()[0]}")
        cursor_spm.execute("SELECT COUNT(*) FROM presupuesto_ledger")
        print(f"Movimientos en ledger: {cursor_spm.fetchone()[0]}")
        cursor_spm.execute("SELECT COUNT(*) FROM notificaciones")
        print(f"Notificaciones: {cursor_spm.fetchone()[0]}")
        cursor_spm.execute("SELECT COUNT(*) FROM foro_posts")
        print(f"Posts del foro: {cursor_spm.fetchone()[0]}")
        cursor_spm.execute("SELECT COUNT(*) FROM foro_respuestas")
        print(f"Respuestas del foro: {cursor_spm.fetchone()[0]}")

    except Exception as e:
        conn_spm.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        conn_spm.close()
        conn_cat.close()


if __name__ == "__main__":
    main()
