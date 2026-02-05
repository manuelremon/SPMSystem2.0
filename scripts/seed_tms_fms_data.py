"""
Script para generar datos de prueba para TMS/FMS

Genera 62 registros de prueba:
- FMS: 8 vehiculos, 6 conductores, 4 planes mantenimiento, 3 ordenes trabajo, 4 documentos
- TMS: 4 zonas, 5 rutas, 6 envios, 13 items, 5 eventos tracking, 3 reglas tarifarias, 1 consolidacion

Uso:
    python scripts/seed_tms_fms_data.py           # Insertar datos
    python scripts/seed_tms_fms_data.py --clean   # Limpiar y regenerar
    python scripts/seed_tms_fms_data.py -v        # Modo verbose

Nota: El script es idempotente y puede ejecutarse multiples veces.
"""

import os
import sqlite3
import sys
from datetime import datetime, timedelta
from random import choice, randint, uniform


def get_db_path():
    """Obtener path de la base de datos"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, "data", "spm.db")


def clean_data(conn, verbose=False):
    """Limpiar datos existentes de TMS/FMS"""
    cursor = conn.cursor()

    # Orden inverso al de creacion (FK constraints)
    tables = [
        # TMS
        "tms_audit_log",
        "tms_fuel_records",
        "tms_trip_settlements",
        "tms_trip_costs",
        "tms_tariff_rules",
        "tms_tracking_events",
        "tms_consol_items",
        "tms_consolidations",
        "tms_shipment_items",
        "tms_shipments",
        "tms_route_waypoints",
        "tms_routes",
        "tms_zones",
        # FMS
        "fms_inspection_items",
        "fms_inspections",
        "fms_vehicle_docs",
        "fms_wo_parts",
        "fms_work_orders",
        "fms_maintenance_plans",
        "fms_drivers",
        "fms_vehicles",
    ]

    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table}")
            if verbose:
                deleted = cursor.rowcount
                print(f"  - {table}: {deleted} registros eliminados")
        except sqlite3.Error as e:
            if verbose:
                print(f"  ! {table}: Error al limpiar ({e})")

    conn.commit()
    print(f"[OK] Datos existentes limpiados de {len(tables)} tablas")


def seed_fms_vehicles(conn, verbose=False):
    """Seed: fms_vehicles (8 vehiculos)"""
    cursor = conn.cursor()

    today = datetime.now()

    vehicles = [
        # Camiones
        ("ABC-1234", "ECO-001", "camion", "Freightliner", "Cascadia", 2020, "1FUJGHDV8LLBXXXXX",
         15000, 40, "diesel", 2.8, 45000, "disponible", 1, 0, "GPS-001",
         "SEG-2024-001", (today + timedelta(days=120)).strftime("%Y-%m-%d"),
         (today + timedelta(days=45)).strftime("%Y-%m-%d"), 50000,
         (today + timedelta(days=30)).strftime("%Y-%m-%d"), None),

        ("DEF-5678", "ECO-002", "camion", "Kenworth", "T680", 2019, "1XKYDP9X8KJ123456",
         12000, 35, "diesel", 3.0, 78000, "disponible", 1, 0, "GPS-002",
         "SEG-2024-002", (today + timedelta(days=90)).strftime("%Y-%m-%d"),
         (today + timedelta(days=60)).strftime("%Y-%m-%d"), 82000,
         (today + timedelta(days=15)).strftime("%Y-%m-%d"), None),

        ("GHI-9012", "ECO-003", "camion", "Volvo", "VNL", 2021, "4V4NC9EH9MN654321",
         18000, 50, "diesel", 2.5, 32000, "en_ruta", 0, 1, "GPS-003",
         "SEG-2024-003", (today + timedelta(days=200)).strftime("%Y-%m-%d"),
         (today + timedelta(days=30)).strftime("%Y-%m-%d"), 35000,
         (today + timedelta(days=45)).strftime("%Y-%m-%d"), None),

        # Camionetas
        ("JKL-3456", "ECO-004", "camioneta", "Ford", "F-150", 2022, "1FTFW1E87NFB12345",
         1500, 3, "gasolina", 8.5, 15000, "disponible", 0, 0, "GPS-004",
         "SEG-2024-004", (today + timedelta(days=180)).strftime("%Y-%m-%d"),
         (today + timedelta(days=90)).strftime("%Y-%m-%d"), 20000,
         (today + timedelta(days=60)).strftime("%Y-%m-%d"), None),

        ("MNO-7890", "ECO-005", "camioneta", "Toyota", "Hilux", 2020, "MROBN86V004123456",
         1200, 2.5, "diesel", 12.0, 45000, "disponible", 0, 0, "GPS-005",
         "SEG-2024-005", (today + timedelta(days=150)).strftime("%Y-%m-%d"),
         (today + timedelta(days=75)).strftime("%Y-%m-%d"), 50000,
         (today + timedelta(days=20)).strftime("%Y-%m-%d"), None),

        # Trailer
        ("PQR-2345", "ECO-006", "trailer", "Utility", "3000R", 2018, "1UYVS25348M123456",
         25000, 75, "diesel", 2.2, 120000, "en_mantenimiento", 0, 0, "GPS-006",
         "SEG-2024-006", (today + timedelta(days=60)).strftime("%Y-%m-%d"),
         (today + timedelta(days=15)).strftime("%Y-%m-%d"), 125000,
         (today + timedelta(days=5)).strftime("%Y-%m-%d"), None),

        # Van
        ("STU-6789", "ECO-007", "van", "Mercedes-Benz", "Sprinter", 2021, "WD3PE8CC8M5123456",
         3500, 12, "diesel", 7.0, 28000, "disponible", 1, 0, "GPS-007",
         "SEG-2024-007", (today + timedelta(days=220)).strftime("%Y-%m-%d"),
         (today + timedelta(days=100)).strftime("%Y-%m-%d"), 30000,
         (today + timedelta(days=75)).strftime("%Y-%m-%d"), None),

        # Rabon
        ("VWX-0123", "ECO-008", "rabon", "Isuzu", "NPR", 2019, "JALC4W16X97123456",
         5000, 20, "diesel", 5.5, 65000, "fuera_servicio", 0, 0, "GPS-008",
         "SEG-2024-008", (today - timedelta(days=10)).strftime("%Y-%m-%d"),
         (today - timedelta(days=5)).strftime("%Y-%m-%d"), 70000,
         (today - timedelta(days=30)).strftime("%Y-%m-%d"), None),
    ]

    for v in vehicles:
        cursor.execute("""
            INSERT OR IGNORE INTO fms_vehicles (
                placa, numero_economico, tipo, marca, modelo, anio, vin,
                capacidad_peso_kg, capacidad_vol_m3, tipo_combustible, rendimiento_km_lt,
                odometro_actual, estado, cadena_frio, hazmat_cert, gps_device_id,
                seguro_poliza, seguro_vigencia, verificacion_vig, prox_mantenimiento_km,
                prox_mantenimiento_fecha, foto_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, v)

    conn.commit()
    count = len(vehicles)
    if verbose:
        print(f"  + fms_vehicles: {count} vehiculos insertados")
    return count


def seed_fms_drivers(conn, verbose=False):
    """Seed: fms_drivers (6 conductores)"""
    cursor = conn.cursor()

    today = datetime.now()

    drivers = [
        (None, "Juan", "Perez Garcia", "LIC-001234", "federal",
         (today + timedelta(days=365)).strftime("%Y-%m-%d"),
         (today + timedelta(days=180)).strftime("%Y-%m-%d"), 1, "activo",
         "555-0101", "Maria Perez: 555-0102", None),

        (None, "Carlos", "Ramirez Lopez", "LIC-005678", "C",
         (today + timedelta(days=200)).strftime("%Y-%m-%d"),
         (today + timedelta(days=90)).strftime("%Y-%m-%d"), 0, "activo",
         "555-0201", "Ana Ramirez: 555-0202", None),

        (None, "Luis", "Martinez Hernandez", "LIC-009012", "B",
         (today + timedelta(days=150)).strftime("%Y-%m-%d"),
         (today + timedelta(days=120)).strftime("%Y-%m-%d"), 0, "activo",
         "555-0301", "Sofia Martinez: 555-0302", None),

        (None, "Miguel", "Gonzalez Torres", "LIC-003456", "federal",
         (today + timedelta(days=400)).strftime("%Y-%m-%d"),
         (today + timedelta(days=200)).strftime("%Y-%m-%d"), 1, "activo",
         "555-0401", "Laura Gonzalez: 555-0402", None),

        (None, "Roberto", "Sanchez Flores", "LIC-007890", "C",
         (today + timedelta(days=180)).strftime("%Y-%m-%d"),
         (today + timedelta(days=100)).strftime("%Y-%m-%d"), 0, "vacaciones",
         "555-0501", "Patricia Sanchez: 555-0502", None),

        (None, "Fernando", "Morales Diaz", "LIC-002345", "A",
         (today + timedelta(days=250)).strftime("%Y-%m-%d"),
         (today + timedelta(days=150)).strftime("%Y-%m-%d"), 0, "inactivo",
         "555-0601", "Elena Morales: 555-0602", None),
    ]

    for d in drivers:
        cursor.execute("""
            INSERT OR IGNORE INTO fms_drivers (
                usuario_id, nombre, apellido, numero_licencia, tipo_licencia,
                vigencia_licencia, vigencia_medica, capacitacion_hazmat, estado,
                telefono, contacto_emergencia, foto_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, d)

    conn.commit()
    count = len(drivers)
    if verbose:
        print(f"  + fms_drivers: {count} conductores insertados")
    return count


def seed_fms_maintenance_plans(conn, verbose=False):
    """Seed: fms_maintenance_plans (4 planes para vehiculos 1-3)"""
    cursor = conn.cursor()

    today = datetime.now()

    plans = [
        # Vehicle 1 (ECO-001, 45000 km)
        (1, "preventivo", "Cambio de aceite", "Cambio de aceite motor y filtros", 5000, 90,
         40000, (today - timedelta(days=60)).strftime("%Y-%m-%d"), 45000,
         (today + timedelta(days=30)).strftime("%Y-%m-%d"), 1500, None, 1),

        (1, "preventivo", "Revision de frenos", "Inspeccion sistema de frenos", 20000, 180,
         40000, (today - timedelta(days=120)).strftime("%Y-%m-%d"), 60000,
         (today + timedelta(days=90)).strftime("%Y-%m-%d"), 8000, None, 1),

        # Vehicle 2 (ECO-002, 78000 km)
        (2, "preventivo", "Alineacion y balanceo", "Alineacion, balanceo y rotacion", 15000, 120,
         75000, (today - timedelta(days=45)).strftime("%Y-%m-%d"), 90000,
         (today + timedelta(days=60)).strftime("%Y-%m-%d"), 2500, None, 1),

        # Vehicle 3 (ECO-003, 32000 km)
        (3, "preventivo", "Servicio mayor", "Servicio mayor completo", 50000, 365,
         0, (today - timedelta(days=200)).strftime("%Y-%m-%d"), 50000,
         (today + timedelta(days=165)).strftime("%Y-%m-%d"), 25000, "Servicio Freightliner CDMX", 1),
    ]

    for p in plans:
        cursor.execute("""
            INSERT INTO fms_maintenance_plans (
                vehicle_id, tipo_mantenimiento, nombre, descripcion, intervalo_km, intervalo_dias,
                ultimo_km, ultima_fecha, proximo_km, proxima_fecha, costo_estimado,
                proveedor_preferido, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, p)

    conn.commit()
    count = len(plans)
    if verbose:
        print(f"  + fms_maintenance_plans: {count} planes insertados")
    return count


def seed_fms_work_orders(conn, verbose=False):
    """Seed: fms_work_orders (3 ordenes de trabajo)"""
    cursor = conn.cursor()

    today = datetime.now()

    # Nota: columna 'codigo' es el codigo unico (NO wo_code)
    wos = [
        # Correctivo en draft
        ("WO-2026-001", 2, None, "correctivo", "draft", 4,
         "Fuga de aceite motor detectada", None, None, 78000,
         today.strftime("%Y-%m-%d"), (today + timedelta(days=2)).strftime("%Y-%m-%d"), None,
         0, 0, 0, "Taller Express", None, None, None, "1"),

        # Preventivo en progreso
        ("WO-2026-002", 1, 1, "preventivo", "in_progress", 2,
         "Cambio de aceite programado", "Sistema lubricacion OK", None, 45000,
         (today - timedelta(days=1)).strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d"), None,
         800, 700, 1500, "Lubricentro Norte", "Tec. Jose Ramirez", None, None, "1"),

        # Emergencia completada
        ("WO-2026-003", 6, None, "emergencia", "completed", 5,
         "Falla de transmision en ruta", "Transmision requiere rebuild completo",
         "Rebuild de transmision realizado, pruebas OK", 120000,
         (today - timedelta(days=10)).strftime("%Y-%m-%d"),
         (today - timedelta(days=8)).strftime("%Y-%m-%d"),
         (today - timedelta(days=3)).strftime("%Y-%m-%d"),
         35000, 28000, 63000, "Transmisiones Hernandez", "Tec. Miguel Torres",
         "Cliente autorizo costo. Garantia 6 meses.", None, "1"),
    ]

    for wo in wos:
        cursor.execute("""
            INSERT OR IGNORE INTO fms_work_orders (
                codigo, vehicle_id, plan_id, tipo, estado, prioridad,
                descripcion, diagnostico, solucion, odometro_ingreso,
                fecha_ingreso, fecha_prometida, fecha_completado,
                costo_mano_obra, costo_partes, costo_total, proveedor_taller,
                tecnico_asignado, notas, evidencia_url, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, wo)

    conn.commit()
    count = len(wos)
    if verbose:
        print(f"  + fms_work_orders: {count} ordenes insertadas")
    return count


def seed_fms_vehicle_docs(conn, verbose=False):
    """Seed: fms_vehicle_docs (4 documentos)"""
    cursor = conn.cursor()

    today = datetime.now()

    docs = [
        # Vehicle 1
        (1, "seguro", "SEG-2024-001",
         (today - timedelta(days=200)).strftime("%Y-%m-%d"),
         (today + timedelta(days=120)).strftime("%Y-%m-%d"), None, 30, None),

        # Vehicle 2
        (2, "verificacion", "VER-2024-002",
         (today - timedelta(days=120)).strftime("%Y-%m-%d"),
         (today + timedelta(days=60)).strftime("%Y-%m-%d"), None, 15,
         "Verificacion estado de Mexico"),

        # Vehicle 3
        (3, "tarjeta_circulacion", "TC-2024-003",
         (today - timedelta(days=365)).strftime("%Y-%m-%d"),
         (today + timedelta(days=30)).strftime("%Y-%m-%d"), None, 30,
         "Renovar pronto"),

        # Vehicle 1
        (1, "permiso_sct", "SCT-2024-001",
         (today - timedelta(days=180)).strftime("%Y-%m-%d"),
         (today + timedelta(days=180)).strftime("%Y-%m-%d"), None, 45,
         "Permiso federal carga"),
    ]

    for doc in docs:
        cursor.execute("""
            INSERT INTO fms_vehicle_docs (
                vehicle_id, tipo_documento, numero, fecha_emision, fecha_vencimiento,
                archivo_url, alerta_dias_antes, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, doc)

    conn.commit()
    count = len(docs)
    if verbose:
        print(f"  + fms_vehicle_docs: {count} documentos insertados")
    return count


def seed_tms_zones(conn, verbose=False):
    """Seed: tms_zones (4 zonas)"""
    cursor = conn.cursor()

    zones = [
        ("Zona Norte", "general", "001,002,003", 1),
        ("Zona Sur", "general", "004,005", 1),
        ("Zona Centro", "general", "006,007,008", 1),
        ("Zona Golfo", "general", "009,010", 1),
    ]

    for z in zones:
        cursor.execute("""
            INSERT OR IGNORE INTO tms_zones (nombre, tipo, centros_ids, activa)
            VALUES (?, ?, ?, ?)
        """, z)

    conn.commit()
    count = len(zones)
    if verbose:
        print(f"  + tms_zones: {count} zonas insertadas")
    return count


def seed_tms_routes(conn, verbose=False):
    """Seed: tms_routes (5 rutas)"""
    cursor = conn.cursor()

    routes = [
        ("CDMX - Monterrey", "001", "002", 920, 10.5, 18000, "autopista", 1),
        ("CDMX - Guadalajara", "001", "003", 550, 6.5, 11000, "autopista", 1),
        ("CDMX - Veracruz", "001", "009", 420, 5.5, 8500, "carretera", 1),
        ("Monterrey - Guadalajara", "002", "003", 780, 9.0, 15000, "mixta", 1),
        ("Guadalajara - Leon", "003", "004", 210, 2.5, 4200, "autopista", 1),
    ]

    for r in routes:
        cursor.execute("""
            INSERT OR IGNORE INTO tms_routes (
                nombre, origen_centro_id, destino_centro_id, distancia_km,
                tiempo_estimado_hrs, costo_base, tipo_via, activa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, r)

    conn.commit()
    count = len(routes)
    if verbose:
        print(f"  + tms_routes: {count} rutas insertadas")
    return count


def seed_tms_shipments(conn, verbose=False):
    """Seed: tms_shipments (6 envios en varios estados)"""
    cursor = conn.cursor()

    today = datetime.now()

    shipments = [
        # Draft
        ("SHIP-2026-001", "standard", "draft", "001", "003",
         today.strftime("%Y-%m-%d"), None, None, None, None, 3, "general",
         5000, 15, 0, 0, "Entregar en horario matutino", "1", None, None, None,
         None, 0, 0, None, None, None, None),

        # Confirmed
        ("SHIP-2026-002", "express", "confirmed", "001", "002",
         (today - timedelta(days=1)).strftime("%Y-%m-%d"),
         (today + timedelta(days=2)).strftime("%Y-%m-%d"), None,
         (today + timedelta(days=2, hours=10)).strftime("%Y-%m-%d %H:%M:%S"), None,
         1, "fragil", 1200, 4, 0, 0, "Manejo con cuidado - equipo electronico", "1",
         None, None, 1, None, 11500, 0, None, None, None, None),

        # Assigned
        ("SHIP-2026-003", "ftl", "assigned", "001", "009",
         (today - timedelta(days=2)).strftime("%Y-%m-%d"),
         (today + timedelta(days=1)).strftime("%Y-%m-%d"), None,
         (today + timedelta(days=1, hours=14)).strftime("%Y-%m-%d %H:%M:%S"), None,
         2, "general", 8500, 25, 0, 0, None, "1", 1, 1, 3, None, 8500, 0,
         None, None, None, None),

        # In transit
        ("SHIP-2026-004", "ftl", "in_transit", "002", "003",
         (today - timedelta(days=3)).strftime("%Y-%m-%d"),
         (today - timedelta(days=1)).strftime("%Y-%m-%d"),
         (today - timedelta(days=1, hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
         today.strftime("%Y-%m-%d") + " 18:00:00", None,
         2, "perecedero", 12000, 35, 1, 0, "Mantener cadena de frio", "1", 4, 3, 4,
         None, 15000, 0, None, None, None, None),

        # Delivered
        ("SHIP-2026-005", "standard", "delivered", "003", "004",
         (today - timedelta(days=5)).strftime("%Y-%m-%d"),
         (today - timedelta(days=2)).strftime("%Y-%m-%d"),
         (today - timedelta(days=2, hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
         (today - timedelta(days=1)).strftime("%Y-%m-%d") + " 10:00:00",
         (today - timedelta(days=1)).strftime("%Y-%m-%d") + " 09:30:00",
         3, "general", 3500, 10, 0, 0, None, "1", 2, 2, 5, None, 4200, 4150,
         "Entrega sin novedad", "Jose Martinez", None, None),

        # Closed
        ("SHIP-2026-006", "ltl", "closed", "001", "003",
         (today - timedelta(days=10)).strftime("%Y-%m-%d"),
         (today - timedelta(days=7)).strftime("%Y-%m-%d"),
         (today - timedelta(days=7, hours=7)).strftime("%Y-%m-%d %H:%M:%S"),
         (today - timedelta(days=6)).strftime("%Y-%m-%d") + " 15:00:00",
         (today - timedelta(days=6)).strftime("%Y-%m-%d") + " 14:45:00",
         3, "general", 2800, 8, 0, 0, None, "1", 3, 4, 2, None, 3800, 3750,
         "Entregado y liquidado", "Ana Lopez", None, None),
    ]

    for s in shipments:
        cursor.execute("""
            INSERT OR IGNORE INTO tms_shipments (
                codigo, tipo, estado, origen_centro_id, destino_centro_id,
                fecha_solicitud, fecha_programada, fecha_despacho, fecha_entrega_estimada,
                fecha_entrega_real, prioridad, tipo_carga, peso_total_kg, volumen_total_m3,
                requiere_cadena_frio, requiere_hazmat, instrucciones, created_by,
                assigned_driver_id, vehicle_id, route_id, consolidation_id,
                cost_estimate, cost_actual, notas_entrega, receptor_nombre,
                receptor_firma_url, evidencia_entrega_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, s)

    conn.commit()
    count = len(shipments)
    if verbose:
        print(f"  + tms_shipments: {count} envios insertados")
    return count


def seed_tms_shipment_items(conn, verbose=False):
    """Seed: tms_shipment_items (2-3 items por envio)"""
    cursor = conn.cursor()

    items = [
        # Shipment 1 (draft)
        (1, None, "MAT-001", "Tornillos acero inox 1/4", 500, 250, 0.5, 5000, None),
        (1, None, "MAT-002", "Tuercas acero inox 1/4", 500, 200, 0.4, 4000, None),

        # Shipment 2 (confirmed)
        (2, None, "MAT-010", "Laptop Dell Latitude 7420", 10, 150, 0.2, 25000, "Fragil"),
        (2, None, "MAT-011", "Monitor Dell 24 pulgadas", 10, 200, 0.5, 15000, "Fragil"),

        # Shipment 3 (assigned)
        (3, None, "MAT-020", "Cajas carton reforzado", 200, 1000, 4, 8000, None),
        (3, None, "MAT-021", "Cinta adhesiva industrial", 50, 150, 0.8, 2500, None),
        (3, None, "MAT-022", "Etiquetas termicas", 100, 80, 0.3, 1200, None),

        # Shipment 4 (in_transit)
        (4, None, "MAT-030", "Productos lacteos - queso", 300, 3600, 10, 45000, "Cadena frio"),
        (4, None, "MAT-031", "Productos lacteos - yogurt", 500, 4000, 12, 35000, "Cadena frio"),

        # Shipment 5 (delivered)
        (5, None, "MAT-040", "Herramientas manuales", 50, 500, 2, 12000, None),
        (5, None, "MAT-041", "Herramientas electricas", 20, 400, 1.5, 18000, None),

        # Shipment 6 (closed)
        (6, None, "MAT-050", "Material oficina - papeleria", 100, 300, 1.5, 8000, None),
        (6, None, "MAT-051", "Material oficina - tintas", 50, 150, 0.8, 6000, None),
    ]

    for item in items:
        cursor.execute("""
            INSERT INTO tms_shipment_items (
                shipment_id, solicitud_id, material_id, descripcion, cantidad,
                peso_kg, volumen_m3, valor_declarado, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, item)

    conn.commit()
    count = len(items)
    if verbose:
        print(f"  + tms_shipment_items: {count} items insertados")
    return count


def seed_tms_tracking_events(conn, verbose=False):
    """Seed: tms_tracking_events (5 eventos para shipment 4 in_transit)"""
    cursor = conn.cursor()

    today = datetime.now()

    # Eventos para shipment 4 (in_transit)
    events = [
        (4, "salida", 19.4326, -99.1332, "Centro CDMX", None,
         "Salida del centro de distribucion", None, "1",
         (today - timedelta(days=1, hours=6)).strftime("%Y-%m-%d %H:%M:%S")),

        (4, "checkpoint", 20.5888, -100.3899, "Queretaro - Autopista", None,
         "Paso por caseta Queretaro", None, "4",
         (today - timedelta(days=1, hours=3)).strftime("%Y-%m-%d %H:%M:%S")),

        (4, "parada", 20.6597, -103.3496, "Gasolinera Guadalajara", None,
         "Parada para combustible y descanso", None, "4",
         (today - timedelta(hours=18)).strftime("%Y-%m-%d %H:%M:%S")),

        (4, "checkpoint", 21.8853, -102.2916, "Aguascalientes - Autopista", None,
         "Paso por caseta Aguascalientes", None, "4",
         (today - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S")),

        (4, "posicion", 24.1234, -102.5678, "Carretera a Leon", 4.5,
         "En transito, temperatura cadena frio OK", None, "4",
         (today - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")),
    ]

    for event in events:
        cursor.execute("""
            INSERT INTO tms_tracking_events (
                shipment_id, evento_tipo, ubicacion_lat, ubicacion_lng, ubicacion_nombre,
                temperatura, notas, evidencia_foto_url, registrado_por, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, event)

    conn.commit()
    count = len(events)
    if verbose:
        print(f"  + tms_tracking_events: {count} eventos insertados")
    return count


def seed_tms_tariff_rules(conn, verbose=False):
    """Seed: tms_tariff_rules (3 reglas tarifarias)"""
    cursor = conn.cursor()

    today = datetime.now()

    rules = [
        ("Tarifa base nacional", 1, 2, None, None, 18.5, 0.8, 45.0, 0, 0, 0,
         (today - timedelta(days=90)).strftime("%Y-%m-%d"),
         (today + timedelta(days=275)).strftime("%Y-%m-%d"), 1),

        ("Tarifa express prioritaria", None, None, None, None, 25.0, 1.2, 65.0, 0, 0, 50,
         (today - timedelta(days=60)).strftime("%Y-%m-%d"),
         (today + timedelta(days=305)).strftime("%Y-%m-%d"), 1),

        ("Tarifa cadena frio", None, None, None, "perecedero", 22.0, 1.0, 55.0, 0, 30, 0,
         (today - timedelta(days=30)).strftime("%Y-%m-%d"),
         (today + timedelta(days=335)).strftime("%Y-%m-%d"), 1),
    ]

    for rule in rules:
        cursor.execute("""
            INSERT INTO tms_tariff_rules (
                nombre, origen_zona, destino_zona, tipo_vehiculo, tipo_carga,
                tarifa_base_km, tarifa_peso_kg, tarifa_volumen_m3,
                recargo_hazmat_pct, recargo_frio_pct, recargo_urgente_pct,
                vigencia_desde, vigencia_hasta, activa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rule)

    conn.commit()
    count = len(rules)
    if verbose:
        print(f"  + tms_tariff_rules: {count} reglas insertadas")
    return count


def seed_tms_consolidations(conn, verbose=False):
    """Seed: tms_consolidations (1 consolidacion abierta)"""
    cursor = conn.cursor()

    today = datetime.now()

    consolidations = [
        ("CONSOL-2026-001", None, "open", "zona", 15000, 40, 0, 0, 0,
         (today + timedelta(days=3)).strftime("%Y-%m-%d"), None, None, None, "1"),
    ]

    for c in consolidations:
        cursor.execute("""
            INSERT OR IGNORE INTO tms_consolidations (
                codigo, master_shipment_id, estado, tipo_consolidacion,
                capacidad_peso_max, capacidad_vol_max, peso_utilizado, volumen_utilizado,
                pct_utilizacion, fecha_corte, ruta_optimizada, vehicle_id, driver_id, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, c)

    conn.commit()
    count = len(consolidations)
    if verbose:
        print(f"  + tms_consolidations: {count} consolidaciones insertadas")
    return count


def print_summary(counts):
    """Imprimir resumen de registros creados"""
    print("\n" + "="*60)
    print("RESUMEN DE DATOS GENERADOS")
    print("="*60)

    fms_total = sum([counts.get(k, 0) for k in counts if k.startswith('fms_')])
    tms_total = sum([counts.get(k, 0) for k in counts if k.startswith('tms_')])

    print("\nFMS (Fleet Management System):")
    print(f"  - Vehiculos:           {counts.get('fms_vehicles', 0)}")
    print(f"  - Conductores:         {counts.get('fms_drivers', 0)}")
    print(f"  - Planes mantenimiento:{counts.get('fms_maintenance_plans', 0)}")
    print(f"  - Ordenes de trabajo:  {counts.get('fms_work_orders', 0)}")
    print(f"  - Documentos vehiculos:{counts.get('fms_vehicle_docs', 0)}")
    print(f"  SUBTOTAL FMS:          {fms_total}")

    print("\nTMS (Transport Management System):")
    print(f"  - Zonas:               {counts.get('tms_zones', 0)}")
    print(f"  - Rutas:               {counts.get('tms_routes', 0)}")
    print(f"  - Envios:              {counts.get('tms_shipments', 0)}")
    print(f"  - Items de envio:      {counts.get('tms_shipment_items', 0)}")
    print(f"  - Eventos tracking:    {counts.get('tms_tracking_events', 0)}")
    print(f"  - Reglas tarifarias:   {counts.get('tms_tariff_rules', 0)}")
    print(f"  - Consolidaciones:     {counts.get('tms_consolidations', 0)}")
    print(f"  SUBTOTAL TMS:          {tms_total}")

    print(f"\nTOTAL REGISTROS:       {fms_total + tms_total}")
    print("="*60)


def main():
    """Entry point principal"""
    verbose = '-v' in sys.argv or '--verbose' in sys.argv
    clean = '--clean' in sys.argv

    db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"[ERROR] Base de datos no encontrada: {db_path}")
        return 1

    print("="*60)
    print("SEED TMS/FMS - Datos de desarrollo")
    print("="*60)
    print(f"Base de datos: {db_path}\n")

    conn = sqlite3.connect(db_path)
    counts = {}

    try:
        if clean:
            print("[INFO] Limpiando datos existentes...")
            clean_data(conn, verbose)
            print()

        print("[INFO] Insertando datos de prueba...\n")

        # FMS primero (TMS depende de FMS para vehicle_id y driver_id)
        print("FMS (Fleet Management System):")
        counts['fms_vehicles'] = seed_fms_vehicles(conn, verbose)
        counts['fms_drivers'] = seed_fms_drivers(conn, verbose)
        counts['fms_maintenance_plans'] = seed_fms_maintenance_plans(conn, verbose)
        counts['fms_work_orders'] = seed_fms_work_orders(conn, verbose)
        counts['fms_vehicle_docs'] = seed_fms_vehicle_docs(conn, verbose)

        print("\nTMS (Transport Management System):")
        counts['tms_zones'] = seed_tms_zones(conn, verbose)
        counts['tms_routes'] = seed_tms_routes(conn, verbose)
        counts['tms_shipments'] = seed_tms_shipments(conn, verbose)
        counts['tms_shipment_items'] = seed_tms_shipment_items(conn, verbose)
        counts['tms_tracking_events'] = seed_tms_tracking_events(conn, verbose)
        counts['tms_tariff_rules'] = seed_tms_tariff_rules(conn, verbose)
        counts['tms_consolidations'] = seed_tms_consolidations(conn, verbose)

        print_summary(counts)
        print("\n[OK] Seed completado exitosamente")
        return 0

    except Exception as e:
        print(f"\n[ERROR] Error al generar datos: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
