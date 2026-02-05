"""
Migracion 028: Crear tablas para sistema FMS (Fleet Management System)

Crea las tablas:
- fms_vehicles: Vehiculos de la flota
- fms_drivers: Conductores
- fms_maintenance_plans: Planes de mantenimiento preventivo
- fms_work_orders: Ordenes de trabajo (MRO)
- fms_wo_parts: Partes/repuestos por OT
- fms_vehicle_docs: Documentos de vehiculos
- fms_inspections: Inspecciones pre/post viaje
- fms_inspection_items: Items del checklist
"""

import os
import sqlite3


def get_db_path():
    """Obtener path de la base de datos"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "data", "spm.db")


def migrate():
    """Ejecutar migracion"""
    db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Vehiculos de la flota
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_vehicles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                placa TEXT UNIQUE NOT NULL,
                numero_economico TEXT UNIQUE,
                tipo TEXT DEFAULT 'camion' CHECK(tipo IN (
                    'camion', 'camioneta', 'trailer', 'van', 'rabon', 'torton', 'pipa', 'otro'
                )),
                marca TEXT,
                modelo TEXT,
                anio INTEGER,
                vin TEXT,
                capacidad_peso_kg REAL DEFAULT 0,
                capacidad_vol_m3 REAL DEFAULT 0,
                tipo_combustible TEXT DEFAULT 'diesel' CHECK(tipo_combustible IN ('diesel', 'gasolina', 'gas', 'electrico', 'hibrido')),
                rendimiento_km_lt REAL DEFAULT 0,
                odometro_actual REAL DEFAULT 0,
                estado TEXT DEFAULT 'disponible' CHECK(estado IN (
                    'disponible', 'en_ruta', 'en_mantenimiento', 'fuera_servicio', 'baja'
                )),
                cadena_frio INTEGER DEFAULT 0,
                hazmat_cert INTEGER DEFAULT 0,
                gps_device_id TEXT,
                seguro_poliza TEXT,
                seguro_vigencia TEXT,
                verificacion_vig TEXT,
                prox_mantenimiento_km REAL,
                prox_mantenimiento_fecha TEXT,
                foto_url TEXT,
                activo INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_vehicles creada")

        # 2. Conductores
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_drivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id TEXT,
                nombre TEXT NOT NULL,
                apellido TEXT,
                numero_licencia TEXT,
                tipo_licencia TEXT CHECK(tipo_licencia IN ('A', 'B', 'C', 'D', 'E', 'federal')),
                vigencia_licencia TEXT,
                vigencia_medica TEXT,
                capacitacion_hazmat INTEGER DEFAULT 0,
                estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo', 'vacaciones', 'incapacidad', 'baja')),
                telefono TEXT,
                contacto_emergencia TEXT,
                foto_url TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_drivers creada")

        # 3. Planes de mantenimiento preventivo
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_maintenance_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id) ON DELETE CASCADE,
                tipo_mantenimiento TEXT DEFAULT 'preventivo' CHECK(tipo_mantenimiento IN ('preventivo', 'predictivo', 'normativo')),
                nombre TEXT NOT NULL,
                descripcion TEXT,
                intervalo_km REAL,
                intervalo_dias INTEGER,
                ultimo_km REAL DEFAULT 0,
                ultima_fecha TEXT,
                proximo_km REAL,
                proxima_fecha TEXT,
                costo_estimado REAL DEFAULT 0,
                proveedor_preferido TEXT,
                activo INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_maintenance_plans creada")

        # 4. Ordenes de trabajo
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_work_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
                plan_id INTEGER REFERENCES fms_maintenance_plans(id),
                tipo TEXT DEFAULT 'correctivo' CHECK(tipo IN ('preventivo', 'correctivo', 'emergencia')),
                estado TEXT DEFAULT 'draft' CHECK(estado IN (
                    'draft', 'approved', 'in_progress', 'pending_parts',
                    'completed', 'closed', 'cancelled'
                )),
                prioridad INTEGER DEFAULT 3 CHECK(prioridad BETWEEN 1 AND 5),
                descripcion TEXT,
                diagnostico TEXT,
                solucion TEXT,
                odometro_ingreso REAL,
                fecha_ingreso TEXT,
                fecha_prometida TEXT,
                fecha_completado TEXT,
                costo_mano_obra REAL DEFAULT 0,
                costo_partes REAL DEFAULT 0,
                costo_total REAL DEFAULT 0,
                proveedor_taller TEXT,
                tecnico_asignado TEXT,
                notas TEXT,
                evidencia_url TEXT,
                created_by TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_work_orders creada")

        # 5. Partes/repuestos por OT
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_wo_parts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_order_id INTEGER NOT NULL REFERENCES fms_work_orders(id) ON DELETE CASCADE,
                material_id TEXT,
                descripcion TEXT,
                cantidad REAL DEFAULT 1,
                costo_unitario REAL DEFAULT 0,
                costo_total REAL DEFAULT 0,
                de_inventario INTEGER DEFAULT 0,
                solicitud_id INTEGER,
                estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'solicitado', 'recibido', 'instalado')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_wo_parts creada")

        # 6. Documentos de vehiculos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_vehicle_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id) ON DELETE CASCADE,
                tipo_documento TEXT NOT NULL CHECK(tipo_documento IN (
                    'seguro', 'verificacion', 'tarjeta_circulacion', 'permiso_sct',
                    'poliza_danos', 'factura', 'otro'
                )),
                numero TEXT,
                fecha_emision TEXT,
                fecha_vencimiento TEXT,
                archivo_url TEXT,
                alerta_dias_antes INTEGER DEFAULT 30,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_vehicle_docs creada")

        # 7. Inspecciones
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_inspections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
                driver_id INTEGER NOT NULL REFERENCES fms_drivers(id),
                shipment_id INTEGER REFERENCES tms_shipments(id),
                tipo TEXT DEFAULT 'pre_trip' CHECK(tipo IN ('pre_trip', 'post_trip')),
                fecha TEXT DEFAULT CURRENT_TIMESTAMP,
                odometro REAL,
                resultado TEXT DEFAULT 'pendiente' CHECK(resultado IN ('pendiente', 'aprobado', 'rechazado', 'con_observaciones')),
                observaciones TEXT,
                firma_digital TEXT,
                aprobado_por TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_inspections creada")

        # 8. Items del checklist de inspeccion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fms_inspection_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_id INTEGER NOT NULL REFERENCES fms_inspections(id) ON DELETE CASCADE,
                item_checklist TEXT NOT NULL,
                categoria TEXT DEFAULT 'general',
                estado TEXT DEFAULT 'na' CHECK(estado IN ('ok', 'mal', 'na')),
                es_critico INTEGER DEFAULT 0,
                foto_evidencia_url TEXT,
                observacion TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla fms_inspection_items creada")

        # 9. Indices FMS
        indices = [
            ("idx_fms_vehicles_placa", "fms_vehicles(placa)"),
            ("idx_fms_vehicles_estado", "fms_vehicles(estado)"),
            ("idx_fms_vehicles_tipo", "fms_vehicles(tipo)"),
            ("idx_fms_drivers_usuario", "fms_drivers(usuario_id)"),
            ("idx_fms_drivers_estado", "fms_drivers(estado)"),
            ("idx_fms_maintenance_vehicle", "fms_maintenance_plans(vehicle_id)"),
            ("idx_fms_maintenance_prox_fecha", "fms_maintenance_plans(proxima_fecha)"),
            ("idx_fms_wo_codigo", "fms_work_orders(codigo)"),
            ("idx_fms_wo_vehicle", "fms_work_orders(vehicle_id)"),
            ("idx_fms_wo_estado", "fms_work_orders(estado)"),
            ("idx_fms_wo_prioridad", "fms_work_orders(prioridad)"),
            ("idx_fms_wo_parts_wo", "fms_wo_parts(work_order_id)"),
            ("idx_fms_wo_parts_solicitud", "fms_wo_parts(solicitud_id)"),
            ("idx_fms_vehicle_docs_vehicle", "fms_vehicle_docs(vehicle_id)"),
            ("idx_fms_vehicle_docs_venc", "fms_vehicle_docs(fecha_vencimiento)"),
            ("idx_fms_inspections_vehicle", "fms_inspections(vehicle_id)"),
            ("idx_fms_inspections_driver", "fms_inspections(driver_id)"),
            ("idx_fms_inspections_fecha", "fms_inspections(fecha)"),
            ("idx_fms_inspection_items_insp", "fms_inspection_items(inspection_id)"),
        ]

        for idx_name, idx_def in indices:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}")
        print("+ Indices FMS creados")

        # 10. Checklist template items por defecto
        # Se insertaran como items al crear inspecciones basado en tipo de vehiculo

        conn.commit()
        print("\n[OK] Migracion 028_fms_tables completada exitosamente")
        return True

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error en migracion: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()


def rollback():
    """Revertir migracion"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        tablas = [
            "fms_inspection_items", "fms_inspections",
            "fms_vehicle_docs", "fms_wo_parts", "fms_work_orders",
            "fms_maintenance_plans", "fms_drivers", "fms_vehicles",
        ]

        for tabla in tablas:
            cursor.execute(f"DROP TABLE IF EXISTS {tabla}")
            print(f"- Tabla {tabla} eliminada")

        conn.commit()
        print("\n[OK] Rollback FMS completado")
        return True
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error en rollback: {e}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback()
    else:
        migrate()
