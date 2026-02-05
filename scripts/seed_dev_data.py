#!/usr/bin/env python3
"""
Script para poblar el sistema SPM con datos de prueba para desarrollo.

Genera:
- 15-20 proveedores externos con contactos
- 5-8 proveedores internos (almacenes)
- Presupuestos por centro/sector
- 200-500 items de stock
- Consumo historico de 12 meses
- 30-50 solicitudes en varios estados
- 5-10 Budget Update Requests

Uso:
    python scripts/seed_dev_data.py [--clean] [--verbose]

Opciones:
    --clean     Limpia datos de prueba antes de insertar
    --verbose   Muestra mas detalles durante la ejecucion
"""

import sqlite3
import random
import json
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from faker import Faker
    fake = Faker('es_AR')
except ImportError:
    print("ERROR: Se requiere el paquete 'faker'. Instalar con:")
    print("  pip install faker")
    sys.exit(1)

# Configuracion
DATA_DIR = Path(__file__).parent.parent / "data"
SPM_DB = DATA_DIR / "spm.db"
SAP_DB = DATA_DIR / "sap_data.db"

# Constantes para generacion
SEED_PREFIX = "SEED_"  # Prefijo para identificar datos de prueba
VERBOSE = False

# Rubros de proveedores
RUBROS = [
    "Materiales Industriales", "Equipos de Seguridad", "Herramientas",
    "Repuestos Mecanicos", "Electricidad", "Instrumentacion",
    "Servicios Tecnicos", "Quimicos", "Lubricantes", "Ferreteria",
    "Materiales de Construccion", "Equipos de Bombeo", "Valvulas",
    "Automatizacion", "Neumatica"
]

# Nombres de empresas ficticias
EMPRESAS = [
    "Suministros Industriales SA", "TecnoEquipos SRL", "Repuestos del Litoral",
    "Ferreteria Industrial Patagonica", "Grupo Metalurgico Norte",
    "Distribuidora Electromecanic", "Soluciones Hidraulicas SA",
    "Herramientas Profesionales", "Servicios Integrales Petroleros",
    "Materiales y Equipos SRL", "Instrumentacion Avanzada SA",
    "Componentes Industriales", "Bombas y Valvulas del Sur",
    "Automatizacion Industrial", "Quimicos del Centro SA",
    "Lubricantes Especiales SRL", "Servicios Tecnicos Mendoza",
    "Equipamiento Minero SA", "Accesorios Neumaticos", "Control Total SRL"
]

# Localidades de Argentina
LOCALIDADES = [
    ("Buenos Aires", "Buenos Aires"), ("Neuquen", "Neuquen"),
    ("Mendoza", "Mendoza"), ("Comodoro Rivadavia", "Chubut"),
    ("San Lorenzo", "Santa Fe"), ("Bahia Blanca", "Buenos Aires"),
    ("La Plata", "Buenos Aires"), ("Rosario", "Santa Fe"),
    ("Plaza Huincul", "Neuquen"), ("Cutral Co", "Neuquen")
]

# Estados de solicitud y sus distribuciones
ESTADOS_SOLICITUD = {
    'draft': 15,          # 15 borradores
    'submitted': 40,      # 40 pendientes
    'approved': 50,       # 50 aprobadas
    'processing': 35,     # 35 en proceso
    'rejected': 30,       # 30 rechazadas
    'closed': 30          # 30 cerradas
}

# Niveles de criticidad
CRITICIDADES = ['Baja', 'Normal', 'Alta', 'Critica']
CRITICIDAD_PESOS = [0.2, 0.5, 0.2, 0.1]  # Probabilidades

# Justificaciones comunes
JUSTIFICACIONES = [
    "Reposicion de stock minimo alcanzado",
    "Mantenimiento preventivo programado",
    "Reparacion urgente de equipo critico",
    "Proyecto de mejora operativa",
    "Reemplazo de componentes obsoletos",
    "Expansion de capacidad productiva",
    "Cumplimiento normativo de seguridad",
    "Actualizacion tecnologica",
    "Programa de eficiencia energetica",
    "Mantenimiento correctivo no planificado"
]


def log(msg: str):
    """Imprime mensaje si verbose esta activo."""
    if VERBOSE:
        print(f"  {msg}")


def generar_cuit() -> str:
    """Genera un CUIT argentino valido."""
    tipo = random.choice([20, 23, 27, 30, 33])
    numero = random.randint(10000000, 99999999)
    return f"{tipo}-{numero:08d}-{random.randint(0, 9)}"


def get_materiales_catalogo(conn_sap: sqlite3.Connection, limit: int = 500) -> list:
    """Obtiene materiales del catalogo SAP."""
    cursor = conn_sap.execute("""
        SELECT DISTINCT material, material_descripcion, um, precio
        FROM stock
        WHERE material IS NOT NULL AND material != ''
        LIMIT ?
    """, (limit,))
    return cursor.fetchall()


def get_usuarios(conn_spm: sqlite3.Connection) -> list:
    """Obtiene usuarios del sistema."""
    cursor = conn_spm.execute("""
        SELECT id_spm, nombre, apellido, rol, centros
        FROM usuarios
        WHERE estado_registro = 'Activo'
    """)
    return cursor.fetchall()


def get_centros(conn_spm: sqlite3.Connection) -> list:
    """Obtiene centros del catalogo."""
    cursor = conn_spm.execute("SELECT codigo, nombre FROM catalog_centros WHERE activo = 1")
    return cursor.fetchall()


def get_sectores(conn_spm: sqlite3.Connection) -> list:
    """Obtiene sectores del catalogo."""
    cursor = conn_spm.execute("SELECT nombre FROM catalog_sectores WHERE activo = 1")
    return [row[0] for row in cursor.fetchall()]


def get_almacenes(conn_spm: sqlite3.Connection) -> list:
    """Obtiene almacenes del catalogo."""
    cursor = conn_spm.execute("SELECT codigo, nombre FROM catalog_almacenes WHERE activo = 1")
    return cursor.fetchall()


# ============================================================================
# FUNCIONES DE LIMPIEZA
# ============================================================================

def limpiar_datos_prueba(conn_spm: sqlite3.Connection, conn_sap: sqlite3.Connection):
    """Limpia todos los datos de prueba (prefijo SEED_)."""
    print("\n[LIMPIEZA] Eliminando datos de prueba anteriores...")

    # Limpiar proveedores externos y relacionados
    conn_spm.execute("DELETE FROM proveedor_precios_negociados WHERE cuit_proveedor LIKE 'SEED_%'")
    conn_spm.execute("DELETE FROM proveedor_ext_telefonos WHERE cuit_proveedor LIKE 'SEED_%'")
    conn_spm.execute("DELETE FROM proveedor_ext_emails WHERE cuit_proveedor LIKE 'SEED_%'")
    conn_spm.execute("DELETE FROM proveedor_ext_contactos WHERE cuit_proveedor LIKE 'SEED_%'")
    conn_spm.execute("DELETE FROM proveedores_externos WHERE cuit LIKE 'SEED_%'")
    log("Proveedores externos eliminados")

    # Limpiar proveedores internos
    conn_spm.execute("DELETE FROM proveedores_internos WHERE centro LIKE 'SEED_%'")
    log("Proveedores internos eliminados")

    # Limpiar solicitudes y relacionados (por justificacion con prefijo)
    conn_spm.execute("""
        DELETE FROM solicitud_items_tratamiento
        WHERE solicitud_id IN (SELECT id FROM solicitudes WHERE justificacion LIKE '[SEED]%')
    """)
    conn_spm.execute("""
        DELETE FROM solicitud_tratamiento_eventos
        WHERE solicitud_id IN (SELECT id FROM solicitudes WHERE justificacion LIKE '[SEED]%')
    """)
    conn_spm.execute("""
        DELETE FROM solicitud_tratamiento_log
        WHERE solicitud_id IN (SELECT id FROM solicitudes WHERE justificacion LIKE '[SEED]%')
    """)
    conn_spm.execute("""
        DELETE FROM decision_abastecimiento
        WHERE solicitud_id IN (SELECT id FROM solicitudes WHERE justificacion LIKE '[SEED]%')
    """)
    conn_spm.execute("""
        DELETE FROM notificaciones
        WHERE solicitud_id IN (SELECT id FROM solicitudes WHERE justificacion LIKE '[SEED]%')
    """)
    conn_spm.execute("DELETE FROM solicitudes WHERE justificacion LIKE '[SEED]%'")
    log("Solicitudes eliminadas")

    # Limpiar presupuesto_ledger de prueba
    conn_spm.execute("DELETE FROM presupuesto_ledger WHERE motivo LIKE '[SEED]%'")
    log("Ledger eliminado")

    # Limpiar BURs de prueba
    conn_spm.execute("DELETE FROM budget_update_requests WHERE justificacion LIKE '[SEED]%'")
    log("BURs eliminados")

    conn_spm.commit()
    print("[LIMPIEZA] Completada")


# ============================================================================
# FUNCIONES DE SEED
# ============================================================================

def seed_proveedores_externos(conn: sqlite3.Connection, cantidad: int = 18):
    """Genera proveedores externos con contactos, emails, telefonos y precios."""
    print(f"\n[PROVEEDORES EXTERNOS] Generando {cantidad} proveedores...")

    materiales_para_precios = []
    try:
        conn_sap = sqlite3.connect(SAP_DB)
        cursor = conn_sap.execute("""
            SELECT DISTINCT material FROM stock
            WHERE material IS NOT NULL LIMIT 100
        """)
        materiales_para_precios = [row[0] for row in cursor.fetchall()]
        conn_sap.close()
    except Exception as e:
        log(f"No se pudieron obtener materiales para precios: {e}")

    proveedores_creados = 0

    for i in range(cantidad):
        # Usar CUIT con prefijo SEED para identificar datos de prueba
        cuit = f"SEED_{i+1:03d}"
        nombre = EMPRESAS[i % len(EMPRESAS)]
        localidad, provincia = random.choice(LOCALIDADES)
        rubro = random.choice(RUBROS)
        lead_time = random.randint(3, 45)
        calificacion = random.choice(['cumplidor', 'incumplidor', 'sin_calificar'])

        try:
            conn.execute("""
                INSERT INTO proveedores_externos
                (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias,
                 rubro, calificacion, activo, notas)
                VALUES (?, ?, ?, ?, 'Argentina', ?, ?, ?, ?, 1, ?)
            """, (
                cuit, nombre, f"{fake.street_address()}", localidad,
                random.choice(['local', 'exterior']),
                lead_time, rubro, calificacion,
                f"Proveedor de {rubro.lower()} - {provincia}"
            ))

            # Agregar 1-3 contactos
            for j in range(random.randint(1, 3)):
                es_principal = 1 if j == 0 else 0
                conn.execute("""
                    INSERT INTO proveedor_ext_contactos
                    (cuit_proveedor, nombre, apellido, cargo, es_principal)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    cuit, fake.first_name(), fake.last_name(),
                    random.choice(['Ventas', 'Comercial', 'Gerente', 'Ejecutivo']),
                    es_principal
                ))

            # Agregar 1-2 emails
            for j in range(random.randint(1, 2)):
                dominio = nombre.lower().replace(' ', '').replace('.', '')[:10]
                conn.execute("""
                    INSERT INTO proveedor_ext_emails
                    (cuit_proveedor, email, tipo, es_principal)
                    VALUES (?, ?, ?, ?)
                """, (
                    cuit, f"{random.choice(['ventas', 'info', 'comercial'])}@{dominio}.com.ar",
                    random.choice(['comercial', 'facturacion', 'soporte']),
                    1 if j == 0 else 0
                ))

            # Agregar 1-2 telefonos
            for j in range(random.randint(1, 2)):
                conn.execute("""
                    INSERT INTO proveedor_ext_telefonos
                    (cuit_proveedor, telefono, tipo)
                    VALUES (?, ?, ?)
                """, (
                    cuit, fake.phone_number(),
                    random.choice(['fijo', 'celular', 'whatsapp'])
                ))

            # Agregar 2-5 precios negociados si hay materiales
            if materiales_para_precios:
                materiales_seleccionados = random.sample(
                    materiales_para_precios,
                    min(random.randint(2, 5), len(materiales_para_precios))
                )
                for mat in materiales_seleccionados:
                    precio = round(random.uniform(10, 5000), 2)
                    fecha_desde = datetime.now() - timedelta(days=random.randint(30, 180))
                    conn.execute("""
                        INSERT INTO proveedor_precios_negociados
                        (cuit_proveedor, codigo_material, precio_usd, moneda,
                         fecha_vigencia_desde, condicion_pago, cantidad_minima, activo)
                        VALUES (?, ?, ?, 'USD', ?, ?, ?, 1)
                    """, (
                        cuit, mat, precio, fecha_desde.strftime('%Y-%m-%d'),
                        random.choice(['Contado', '30 dias', '60 dias', '90 dias']),
                        random.randint(1, 10)
                    ))

            proveedores_creados += 1
            log(f"Proveedor {nombre} creado")

        except sqlite3.IntegrityError as e:
            log(f"Error creando proveedor {nombre}: {e}")

    conn.commit()
    print(f"[PROVEEDORES EXTERNOS] {proveedores_creados} proveedores creados")
    return proveedores_creados


def seed_proveedores_internos(conn: sqlite3.Connection):
    """Genera proveedores internos (almacenes de cada centro)."""
    print("\n[PROVEEDORES INTERNOS] Generando almacenes...")

    centros = get_centros(conn)
    almacenes = get_almacenes(conn)
    usuarios = get_usuarios(conn)

    if not centros or not almacenes:
        print("[PROVEEDORES INTERNOS] No hay centros o almacenes en el catalogo")
        return 0

    proveedores_creados = 0

    for centro_codigo, centro_nombre in centros:
        # Cada centro tiene 1-2 almacenes
        almacenes_centro = random.sample(almacenes, min(random.randint(1, 2), len(almacenes)))

        for almacen_codigo, almacen_nombre in almacenes_centro:
            # Seleccionar referente aleatorio
            referente = random.choice(usuarios) if usuarios else None

            # Usar prefijo SEED en centro para identificar datos de prueba
            centro_seed = f"SEED_{centro_codigo}"

            try:
                conn.execute("""
                    INSERT INTO proveedores_internos
                    (centro, almacen, centro_nombre, almacen_nombre, sector,
                     contacto_centro, responsable_centro, referente_id,
                     referente_nombre, referente_email, activo, notas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """, (
                    centro_seed, almacen_codigo, centro_nombre, almacen_nombre,
                    random.choice(['Mantenimiento', 'Operaciones', 'Servicios']),
                    fake.phone_number(), fake.name(),
                    referente[0] if referente else None,
                    f"{referente[1]} {referente[2]}" if referente else None,
                    f"{referente[1].lower()}@spm.local" if referente else None,
                    f"Almacen {almacen_nombre} del centro {centro_nombre}"
                ))
                proveedores_creados += 1
                log(f"Almacen {almacen_nombre} en {centro_nombre} creado")

            except sqlite3.IntegrityError as e:
                log(f"Error creando almacen: {e}")

    conn.commit()
    print(f"[PROVEEDORES INTERNOS] {proveedores_creados} almacenes creados")
    return proveedores_creados


def seed_presupuestos(conn: sqlite3.Connection):
    """Genera presupuestos por centro/sector."""
    print("\n[PRESUPUESTOS] Generando presupuestos...")

    centros = get_centros(conn)
    sectores = get_sectores(conn)

    if not centros or not sectores:
        print("[PRESUPUESTOS] No hay centros o sectores en el catalogo")
        return 0

    presupuestos_creados = 0
    presupuestos_actualizados = 0

    for centro_codigo, centro_nombre in centros:
        for sector in sectores:
            # Verificar si ya existe
            cursor = conn.execute(
                "SELECT 1 FROM presupuestos WHERE centro = ? AND sector = ?",
                (centro_codigo, sector)
            )
            existe = cursor.fetchone() is not None

            # Generar montos aleatorios
            monto = random.randint(100000, 500000)  # 100K - 500K USD
            consumo_pct = random.uniform(0, 0.7)  # 0-70% consumido
            saldo = int(monto * (1 - consumo_pct))
            monto_cents = monto * 100
            saldo_cents = saldo * 100

            try:
                if existe:
                    conn.execute("""
                        UPDATE presupuestos
                        SET monto_usd = ?, saldo_usd = ?, monto_cents = ?, saldo_cents = ?,
                            version = version + 1, updated_by = 'SEED'
                        WHERE centro = ? AND sector = ?
                    """, (monto, saldo, monto_cents, saldo_cents, centro_codigo, sector))
                    presupuestos_actualizados += 1
                else:
                    conn.execute("""
                        INSERT INTO presupuestos
                        (centro, sector, monto_usd, saldo_usd, monto_cents, saldo_cents, version, updated_by)
                        VALUES (?, ?, ?, ?, ?, ?, 1, 'SEED')
                    """, (centro_codigo, sector, monto, saldo, monto_cents, saldo_cents))
                    presupuestos_creados += 1

                log(f"Presupuesto {centro_codigo}/{sector}: ${monto:,} (saldo: ${saldo:,})")

            except sqlite3.IntegrityError as e:
                log(f"Error con presupuesto: {e}")

    conn.commit()
    print(f"[PRESUPUESTOS] {presupuestos_creados} creados, {presupuestos_actualizados} actualizados")
    return presupuestos_creados + presupuestos_actualizados


def seed_stock(conn_sap: sqlite3.Connection, cantidad: int = 300):
    """Genera registros de stock para materiales."""
    print(f"\n[STOCK] Verificando stock existente...")

    # Verificar cuantos registros de stock ya existen
    cursor = conn_sap.execute("SELECT COUNT(*) FROM stock")
    stock_existente = cursor.fetchone()[0]

    if stock_existente > 1000:
        print(f"[STOCK] Ya existen {stock_existente:,} registros de stock. Omitiendo seed.")
        return stock_existente

    print(f"[STOCK] Generando {cantidad} registros adicionales...")

    # Obtener materiales unicos existentes
    cursor = conn_sap.execute("""
        SELECT DISTINCT material, material_descripcion, um
        FROM stock
        WHERE material IS NOT NULL
        LIMIT 200
    """)
    materiales = cursor.fetchall()

    if not materiales:
        print("[STOCK] No hay materiales base para generar stock")
        return 0

    centros = ['1001', '1007', '1059', '1060', '1061', '1062']
    almacenes = ['AA001', 'AA012', 'AA101', 'II002', 'II003', 'II004']
    regionales = ['OESTE', 'NORTE', 'SUR', 'CENTRO']

    stock_creado = 0
    fecha_hoy = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for _ in range(cantidad):
        material, descripcion, um = random.choice(materiales)
        centro = random.choice(centros)
        almacen = random.choice(almacenes)

        stock_cant = random.randint(0, 500)
        precio = round(random.uniform(10, 2000), 2)
        valorizado = round(stock_cant * precio, 2)

        try:
            conn_sap.execute("""
                INSERT INTO stock
                (dia, regional, centro, almacen, material, material_descripcion,
                 stock, um, precio, stock_valorizado, moneda, critico, inmovilizado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?)
            """, (
                fecha_hoy, random.choice(regionales), centro, almacen,
                material, descripcion, stock_cant, um or 'UNI', precio, valorizado,
                random.choice(['SI', 'NO']),
                random.choice(['SI', 'NO', 'INMOVILIZADO'])
            ))
            stock_creado += 1
        except Exception as e:
            log(f"Error insertando stock: {e}")

    conn_sap.commit()
    print(f"[STOCK] {stock_creado} registros creados")
    return stock_creado


def seed_consumo_historico(conn_sap: sqlite3.Connection, cantidad: int = 200):
    """Genera consumo historico de 12 meses."""
    print(f"\n[CONSUMO] Verificando consumo existente...")

    cursor = conn_sap.execute("SELECT COUNT(*) FROM consumo_historico")
    consumo_existente = cursor.fetchone()[0]

    if consumo_existente > 5000:
        print(f"[CONSUMO] Ya existen {consumo_existente:,} registros. Omitiendo seed.")
        return consumo_existente

    print(f"[CONSUMO] Generando {cantidad} registros de consumo...")

    # Obtener materiales
    cursor = conn_sap.execute("""
        SELECT DISTINCT material, material_descripcion
        FROM stock
        WHERE material IS NOT NULL
        LIMIT 100
    """)
    materiales = cursor.fetchall()

    if not materiales:
        print("[CONSUMO] No hay materiales para generar consumo")
        return 0

    centros = ['1001', '1007', '1059', '1060', '1061']
    almacenes = ['AA001', 'II002', 'II003', 'II004']

    consumo_creado = 0
    fecha_base = datetime.now()

    for material, descripcion in random.sample(materiales, min(50, len(materiales))):
        # Generar patron estacional para este material
        base_consumo = random.randint(5, 100)

        # 12 meses de historia
        for mes in range(12):
            fecha = fecha_base - timedelta(days=mes * 30 + random.randint(0, 15))

            # Simulacion de estacionalidad
            factor_estacional = 1.0
            if mes in [0, 1, 11]:  # Verano (menos actividad)
                factor_estacional = 0.7
            elif mes in [5, 6, 7]:  # Invierno (mas actividad)
                factor_estacional = 1.3

            cantidad_consumo = max(1, int(base_consumo * factor_estacional * random.uniform(0.5, 1.5)))

            try:
                conn_sap.execute("""
                    INSERT INTO consumo_historico
                    (fecha, centro, almacen, material, descripcion, cantidad)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    fecha.strftime('%Y-%m-%d'),
                    random.choice(centros),
                    random.choice(almacenes),
                    material, descripcion, cantidad_consumo
                ))
                consumo_creado += 1
            except Exception as e:
                log(f"Error insertando consumo: {e}")

    conn_sap.commit()
    print(f"[CONSUMO] {consumo_creado} registros creados")
    return consumo_creado


def seed_solicitudes(conn_spm: sqlite3.Connection, conn_sap: sqlite3.Connection):
    """Genera solicitudes en varios estados."""
    print("\n[SOLICITUDES] Generando solicitudes...")

    usuarios = get_usuarios(conn_spm)
    centros = get_centros(conn_spm)
    sectores = get_sectores(conn_spm)

    if not usuarios or not centros or not sectores:
        print("[SOLICITUDES] Faltan datos base (usuarios, centros o sectores)")
        return 0

    # Obtener materiales para items
    materiales = get_materiales_catalogo(conn_sap, 200)
    if not materiales:
        print("[SOLICITUDES] No hay materiales en el catalogo SAP")
        return 0

    # Separar usuarios por rol
    solicitantes = [u for u in usuarios if 'Solicitante' in u[3] or 'usuario' in u[3].lower()]
    aprobadores = [u for u in usuarios if 'Aprobador' in u[3] or 'coordinador' in u[3].lower()]
    planners = [u for u in usuarios if 'Planificador' in u[3] or 'planner' in u[3].lower()]

    if not solicitantes:
        solicitantes = usuarios  # Fallback

    solicitudes_creadas = 0
    total_objetivo = sum(ESTADOS_SOLICITUD.values())

    fecha_base = datetime.now()

    for estado, cantidad in ESTADOS_SOLICITUD.items():
        for i in range(cantidad):
            usuario = random.choice(solicitantes)
            centro_codigo, centro_nombre = random.choice(centros)
            sector = random.choice(sectores)

            # Generar items (1-5 por solicitud)
            num_items = random.randint(1, 5)
            items = []
            total_monto = 0

            for j in range(num_items):
                mat = random.choice(materiales)
                cantidad_item = random.randint(1, 50)
                precio = mat[3] if mat[3] and mat[3] > 0 else random.uniform(50, 1000)
                monto_item = cantidad_item * precio
                total_monto += monto_item

                items.append({
                    "codigo": mat[0],
                    "descripcion": mat[1] or "Material sin descripcion",
                    "cantidad": cantidad_item,
                    "unidad": mat[2] or "UNI",
                    "precio_estimado": round(precio, 2),
                    "monto": round(monto_item, 2)
                })

            # Determinar fechas segun estado
            dias_atras = random.randint(1, 60)
            created_at = fecha_base - timedelta(days=dias_atras)
            updated_at = created_at + timedelta(days=random.randint(0, dias_atras))
            fecha_necesidad = fecha_base + timedelta(days=random.randint(7, 60))

            # Criticidad con distribucion ponderada
            criticidad = random.choices(CRITICIDADES, weights=CRITICIDAD_PESOS)[0]

            # Justificacion marcada como SEED para poder limpiar
            justificacion = f"[SEED] {random.choice(JUSTIFICACIONES)}"

            # Datos adicionales segun estado
            aprobador_id = None
            planner_id = None

            if estado in ['approved', 'processing', 'closed']:
                aprobador_id = random.choice(aprobadores)[0] if aprobadores else None
            if estado in ['processing', 'closed']:
                planner_id = random.choice(planners)[0] if planners else None

            data_json = json.dumps({"items": items, "archivos": []})

            try:
                conn_spm.execute("""
                    INSERT INTO solicitudes
                    (id_usuario, centro, sector, justificacion, centro_costos,
                     almacen_virtual, criticidad, fecha_necesidad, data_json,
                     status, aprobador_id, planner_id, total_monto,
                     created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    usuario[0], centro_codigo, sector, justificacion,
                    f"CC-{centro_codigo}-{random.randint(1000, 9999)}",
                    random.choice(['AV001', 'AV002', 'AV003', None]),
                    criticidad, fecha_necesidad.strftime('%Y-%m-%d'), data_json,
                    estado, aprobador_id, planner_id, round(total_monto, 2),
                    created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    updated_at.strftime('%Y-%m-%d %H:%M:%S')
                ))
                solicitudes_creadas += 1
                log(f"Solicitud {estado} creada (${total_monto:,.2f})")

            except sqlite3.IntegrityError as e:
                log(f"Error creando solicitud: {e}")

    conn_spm.commit()
    print(f"[SOLICITUDES] {solicitudes_creadas}/{total_objetivo} solicitudes creadas")
    return solicitudes_creadas


def seed_budget_requests(conn: sqlite3.Connection, cantidad: int = 8):
    """Genera Budget Update Requests en varios estados."""
    print(f"\n[BUR] Generando {cantidad} Budget Update Requests...")

    usuarios = get_usuarios(conn)
    centros = get_centros(conn)
    sectores = get_sectores(conn)

    if not usuarios or not centros or not sectores:
        print("[BUR] Faltan datos base")
        return 0

    estados_bur = ['pendiente', 'aprobado_l1', 'aprobado', 'rechazado']
    bur_creados = 0
    fecha_base = datetime.now()

    for i in range(cantidad):
        usuario = random.choice(usuarios)
        centro_codigo, _ = random.choice(centros)
        sector = random.choice(sectores)

        # Obtener saldo actual del presupuesto
        cursor = conn.execute(
            "SELECT saldo_cents FROM presupuestos WHERE centro = ? AND sector = ?",
            (centro_codigo, sector)
        )
        row = cursor.fetchone()
        saldo_actual = row[0] if row else 10000000  # 100K por defecto

        # Monto solicitado (entre 10K y 500K USD)
        monto = random.randint(10000, 500000)
        monto_cents = monto * 100

        # Determinar nivel de aprobacion requerido
        if monto <= 200000:
            nivel = 'L1'
        elif monto <= 1000000:
            nivel = 'L2'
        else:
            nivel = 'ADMIN'

        estado = random.choice(estados_bur)
        justificacion = f"[SEED] Incremento de presupuesto para {random.choice(JUSTIFICACIONES).lower()}"

        # Determinar aprobadores segun estado
        aprobador_l1_id = None
        aprobador_l1_fecha = None
        aprobador_l2_id = None
        aprobador_l2_fecha = None
        aprobador_final_id = None
        aprobador_final_fecha = None
        rechazado_por = None
        motivo_rechazo = None
        fecha_rechazo = None

        dias_atras = random.randint(1, 30)
        created_at = fecha_base - timedelta(days=dias_atras)

        if estado == 'aprobado_l1':
            aprobador_l1_id = random.choice(usuarios)[0]
            aprobador_l1_fecha = (created_at + timedelta(days=1)).isoformat()
        elif estado == 'aprobado':
            aprobador_l1_id = random.choice(usuarios)[0]
            aprobador_l1_fecha = (created_at + timedelta(days=1)).isoformat()
            if nivel in ['L2', 'ADMIN']:
                aprobador_l2_id = random.choice(usuarios)[0]
                aprobador_l2_fecha = (created_at + timedelta(days=2)).isoformat()
            if nivel == 'ADMIN':
                aprobador_final_id = random.choice(usuarios)[0]
                aprobador_final_fecha = (created_at + timedelta(days=3)).isoformat()
        elif estado == 'rechazado':
            rechazado_por = random.choice(usuarios)[0]
            motivo_rechazo = random.choice([
                "Presupuesto excede el limite del periodo",
                "Justificacion insuficiente",
                "Requiere revision adicional",
                "No aprobado por gerencia"
            ])
            fecha_rechazo = (created_at + timedelta(days=1)).isoformat()

        try:
            conn.execute("""
                INSERT INTO budget_update_requests
                (centro, sector, monto_solicitado_cents, saldo_actual_cents,
                 nivel_aprobacion_requerido, estado, solicitante_id, solicitante_rol,
                 justificacion, aprobador_l1_id, aprobador_l1_fecha,
                 aprobador_l2_id, aprobador_l2_fecha, aprobador_final_id, aprobador_final_fecha,
                 rechazado_por, motivo_rechazo, fecha_rechazo, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                centro_codigo, sector, monto_cents, saldo_actual, nivel, estado,
                usuario[0], usuario[3], justificacion,
                aprobador_l1_id, aprobador_l1_fecha,
                aprobador_l2_id, aprobador_l2_fecha,
                aprobador_final_id, aprobador_final_fecha,
                rechazado_por, motivo_rechazo, fecha_rechazo,
                created_at.isoformat(), datetime.now().isoformat()
            ))
            bur_creados += 1
            log(f"BUR {estado} creado: ${monto:,} ({nivel})")

        except sqlite3.IntegrityError as e:
            log(f"Error creando BUR: {e}")

    conn.commit()
    print(f"[BUR] {bur_creados} Budget Update Requests creados")
    return bur_creados


# ============================================================================
# MAIN
# ============================================================================

def main():
    global VERBOSE

    parser = argparse.ArgumentParser(description='Poblar SPM con datos de prueba')
    parser.add_argument('--clean', action='store_true', help='Limpia datos de prueba antes')
    parser.add_argument('--verbose', '-v', action='store_true', help='Modo verbose')
    args = parser.parse_args()

    VERBOSE = args.verbose

    print("=" * 60)
    print("SPM v3.0 - Seed de Datos de Desarrollo")
    print("=" * 60)

    # Verificar que existen las bases de datos
    if not SPM_DB.exists():
        print(f"ERROR: No se encuentra {SPM_DB}")
        sys.exit(1)
    if not SAP_DB.exists():
        print(f"ERROR: No se encuentra {SAP_DB}")
        sys.exit(1)

    print(f"\nBases de datos:")
    print(f"  SPM: {SPM_DB}")
    print(f"  SAP: {SAP_DB}")

    # Conectar
    conn_spm = sqlite3.connect(SPM_DB)
    conn_sap = sqlite3.connect(SAP_DB)

    # Habilitar foreign keys
    conn_spm.execute("PRAGMA foreign_keys = ON")

    try:
        # Limpiar si se solicita
        if args.clean:
            limpiar_datos_prueba(conn_spm, conn_sap)

        # Ejecutar seeds
        resumen = {}

        resumen['proveedores_externos'] = seed_proveedores_externos(conn_spm, 18)
        resumen['proveedores_internos'] = seed_proveedores_internos(conn_spm)
        resumen['presupuestos'] = seed_presupuestos(conn_spm)
        resumen['stock'] = seed_stock(conn_sap, 300)
        resumen['consumo'] = seed_consumo_historico(conn_sap, 200)
        resumen['solicitudes'] = seed_solicitudes(conn_spm, conn_sap)
        resumen['bur'] = seed_budget_requests(conn_spm, 8)

        # Resumen final
        print("\n" + "=" * 60)
        print("RESUMEN DE DATOS GENERADOS")
        print("=" * 60)
        for key, value in resumen.items():
            print(f"  {key.replace('_', ' ').title()}: {value}")
        print("=" * 60)
        print("\nSeed completado exitosamente!")
        print("\nPara verificar en el frontend:")
        print("  1. Inicia el backend: python wsgi.py")
        print("  2. Inicia el frontend: cd frontend && npm run dev")
        print("  3. Navega a http://localhost:5173")

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn_spm.close()
        conn_sap.close()


if __name__ == "__main__":
    main()
