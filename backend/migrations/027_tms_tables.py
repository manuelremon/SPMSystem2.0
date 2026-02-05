"""
Migracion 027: Crear tablas para sistema TMS (Transport Management System)

Crea las tablas:
- tms_shipments: Envios/despachos
- tms_shipment_items: Items por envio
- tms_routes: Rutas predefinidas
- tms_route_waypoints: Paradas intermedias
- tms_consolidations: Consolidaciones LTL
- tms_consol_items: Items de consolidacion
- tms_tracking_events: Eventos de tracking GPS
- tms_trip_costs: Costos por viaje
- tms_cost_categories: Categorias de costos
- tms_tariff_rules: Reglas tarifarias
- tms_trip_settlements: Cierres financieros
- tms_fuel_records: Registros de combustible
- tms_zones: Zonas geograficas
- tms_config: Configuracion TMS
- tms_audit_log: Auditoria TMS
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
        # 1. Zonas geograficas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT DEFAULT 'general' CHECK(tipo IN ('origen', 'destino', 'general')),
                centros_ids TEXT,
                activa INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_zones creada")

        # 2. Rutas predefinidas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                origen_centro_id TEXT,
                destino_centro_id TEXT,
                distancia_km REAL DEFAULT 0,
                tiempo_estimado_hrs REAL DEFAULT 0,
                costo_base REAL DEFAULT 0,
                tipo_via TEXT DEFAULT 'carretera' CHECK(tipo_via IN ('carretera', 'autopista', 'mixta', 'urbana')),
                activa INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_routes creada")

        # 3. Paradas intermedias de rutas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_route_waypoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id INTEGER NOT NULL REFERENCES tms_routes(id) ON DELETE CASCADE,
                orden INTEGER NOT NULL DEFAULT 0,
                centro_id TEXT,
                lat REAL,
                lng REAL,
                nombre_parada TEXT,
                tiempo_parada_min INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_route_waypoints creada")

        # 4. Envios principales
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_shipments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                tipo TEXT DEFAULT 'standard' CHECK(tipo IN ('standard', 'express', 'ltl', 'ftl', 'consolidado')),
                estado TEXT DEFAULT 'draft' CHECK(estado IN (
                    'draft', 'confirmed', 'assigned', 'in_transit',
                    'delivered', 'incident', 'resolved', 'settled', 'closed', 'cancelled'
                )),
                origen_centro_id TEXT,
                destino_centro_id TEXT,
                fecha_solicitud TEXT DEFAULT CURRENT_TIMESTAMP,
                fecha_programada TEXT,
                fecha_despacho TEXT,
                fecha_entrega_estimada TEXT,
                fecha_entrega_real TEXT,
                prioridad INTEGER DEFAULT 3 CHECK(prioridad BETWEEN 1 AND 5),
                tipo_carga TEXT DEFAULT 'general' CHECK(tipo_carga IN ('general', 'perecedero', 'fragil', 'peligroso', 'valor_alto')),
                peso_total_kg REAL DEFAULT 0,
                volumen_total_m3 REAL DEFAULT 0,
                requiere_cadena_frio INTEGER DEFAULT 0,
                requiere_hazmat INTEGER DEFAULT 0,
                instrucciones TEXT,
                created_by TEXT NOT NULL,
                assigned_driver_id INTEGER REFERENCES fms_drivers(id),
                vehicle_id INTEGER REFERENCES fms_vehicles(id),
                route_id INTEGER REFERENCES tms_routes(id),
                consolidation_id INTEGER,
                cost_estimate REAL DEFAULT 0,
                cost_actual REAL DEFAULT 0,
                notas_entrega TEXT,
                receptor_nombre TEXT,
                receptor_firma_url TEXT,
                evidencia_entrega_url TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        """)
        print("+ Tabla tms_shipments creada")

        # 5. Items por envio
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_shipment_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
                solicitud_id INTEGER,
                material_id TEXT,
                descripcion TEXT,
                cantidad REAL DEFAULT 0,
                peso_kg REAL DEFAULT 0,
                volumen_m3 REAL DEFAULT 0,
                valor_declarado REAL DEFAULT 0,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_shipment_items creada")

        # 6. Consolidaciones LTL
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_consolidations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                master_shipment_id INTEGER REFERENCES tms_shipments(id),
                estado TEXT DEFAULT 'open' CHECK(estado IN ('open', 'full', 'dispatched', 'closed', 'cancelled')),
                tipo_consolidacion TEXT DEFAULT 'zona' CHECK(tipo_consolidacion IN ('zona', 'ruta', 'cliente', 'programada')),
                capacidad_peso_max REAL DEFAULT 0,
                capacidad_vol_max REAL DEFAULT 0,
                peso_utilizado REAL DEFAULT 0,
                volumen_utilizado REAL DEFAULT 0,
                pct_utilizacion REAL DEFAULT 0,
                fecha_corte TEXT,
                ruta_optimizada TEXT,
                vehicle_id INTEGER REFERENCES fms_vehicles(id),
                driver_id INTEGER REFERENCES fms_drivers(id),
                created_by TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_consolidations creada")

        # 7. Items de consolidacion
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_consol_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                consolidation_id INTEGER NOT NULL REFERENCES tms_consolidations(id) ON DELETE CASCADE,
                shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id),
                orden_carga INTEGER DEFAULT 0,
                peso_kg REAL DEFAULT 0,
                volumen_m3 REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_consol_items creada")

        # 8. Eventos de tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_tracking_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
                evento_tipo TEXT NOT NULL CHECK(evento_tipo IN (
                    'salida', 'parada', 'carga_combustible', 'checkpoint',
                    'incidencia', 'entrega_parcial', 'entrega', 'posicion', 'otro'
                )),
                ubicacion_lat REAL,
                ubicacion_lng REAL,
                ubicacion_nombre TEXT,
                temperatura REAL,
                notas TEXT,
                evidencia_foto_url TEXT,
                registrado_por TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_tracking_events creada")

        # 9. Categorias de costos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_cost_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT DEFAULT 'variable' CHECK(tipo IN ('fijo', 'variable')),
                unidad_medida TEXT,
                requiere_evidencia INTEGER DEFAULT 0,
                limite_monto REAL,
                activa INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_cost_categories creada")

        # 10. Costos por viaje
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_trip_costs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
                category_id INTEGER REFERENCES tms_cost_categories(id),
                concepto TEXT NOT NULL,
                monto REAL NOT NULL DEFAULT 0,
                moneda TEXT DEFAULT 'MXN' CHECK(moneda IN ('USD', 'MXN', 'EUR')),
                tipo_cambio REAL DEFAULT 1.0,
                evidencia_url TEXT,
                proveedor_id TEXT,
                estado_pago TEXT DEFAULT 'pendiente' CHECK(estado_pago IN ('pendiente', 'pagado', 'rechazado')),
                fecha_gasto TEXT DEFAULT CURRENT_TIMESTAMP,
                aprobado_por TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_trip_costs creada")

        # 11. Reglas tarifarias
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_tariff_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                origen_zona INTEGER REFERENCES tms_zones(id),
                destino_zona INTEGER REFERENCES tms_zones(id),
                tipo_vehiculo TEXT,
                tipo_carga TEXT,
                tarifa_base_km REAL DEFAULT 0,
                tarifa_peso_kg REAL DEFAULT 0,
                tarifa_volumen_m3 REAL DEFAULT 0,
                recargo_hazmat_pct REAL DEFAULT 0,
                recargo_frio_pct REAL DEFAULT 0,
                recargo_urgente_pct REAL DEFAULT 0,
                vigencia_desde TEXT,
                vigencia_hasta TEXT,
                activa INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_tariff_rules creada")

        # 12. Cierres financieros
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_trip_settlements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id),
                tipo TEXT DEFAULT 'cierre' CHECK(tipo IN ('cierre', 'ajuste')),
                costo_combustible REAL DEFAULT 0,
                costo_peajes REAL DEFAULT 0,
                costo_viaticos REAL DEFAULT 0,
                costo_otros REAL DEFAULT 0,
                total_gastos REAL DEFAULT 0,
                ingreso_flete REAL DEFAULT 0,
                margen_neto REAL DEFAULT 0,
                margen_pct REAL DEFAULT 0,
                estado TEXT DEFAULT 'borrador' CHECK(estado IN ('borrador', 'cerrado', 'aprobado', 'ajustado')),
                cerrado_por TEXT,
                fecha_cierre TEXT,
                notas TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_trip_settlements creada")

        # 13. Registros de combustible
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_fuel_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
                shipment_id INTEGER REFERENCES tms_shipments(id),
                litros REAL NOT NULL,
                costo_litro REAL NOT NULL,
                costo_total REAL NOT NULL,
                odometro_km REAL,
                estacion TEXT,
                evidencia_url TEXT,
                registrado_por TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_fuel_records creada")

        # 14. Configuracion TMS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                clave TEXT UNIQUE NOT NULL,
                valor TEXT NOT NULL,
                tipo TEXT DEFAULT 'string' CHECK(tipo IN ('string', 'number', 'boolean', 'json')),
                descripcion TEXT,
                updated_by TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_config creada")

        # 15. Auditoria TMS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tms_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entidad TEXT NOT NULL,
                entidad_id INTEGER NOT NULL,
                accion TEXT NOT NULL,
                datos_antes TEXT,
                datos_despues TEXT,
                usuario_id TEXT NOT NULL,
                ip_address TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla tms_audit_log creada")

        # 16. Indices
        indices = [
            ("idx_tms_shipments_codigo", "tms_shipments(codigo)"),
            ("idx_tms_shipments_estado", "tms_shipments(estado)"),
            ("idx_tms_shipments_created_by", "tms_shipments(created_by)"),
            ("idx_tms_shipments_driver", "tms_shipments(assigned_driver_id)"),
            ("idx_tms_shipments_vehicle", "tms_shipments(vehicle_id)"),
            ("idx_tms_shipments_fecha_prog", "tms_shipments(fecha_programada)"),
            ("idx_tms_shipment_items_shipment", "tms_shipment_items(shipment_id)"),
            ("idx_tms_shipment_items_solicitud", "tms_shipment_items(solicitud_id)"),
            ("idx_tms_consolidations_codigo", "tms_consolidations(codigo)"),
            ("idx_tms_consolidations_estado", "tms_consolidations(estado)"),
            ("idx_tms_consol_items_consolidation", "tms_consol_items(consolidation_id)"),
            ("idx_tms_consol_items_shipment", "tms_consol_items(shipment_id)"),
            ("idx_tms_tracking_shipment", "tms_tracking_events(shipment_id)"),
            ("idx_tms_tracking_tipo", "tms_tracking_events(evento_tipo)"),
            ("idx_tms_trip_costs_shipment", "tms_trip_costs(shipment_id)"),
            ("idx_tms_trip_settlements_shipment", "tms_trip_settlements(shipment_id)"),
            ("idx_tms_fuel_records_vehicle", "tms_fuel_records(vehicle_id)"),
            ("idx_tms_fuel_records_shipment", "tms_fuel_records(shipment_id)"),
            ("idx_tms_tariff_rules_zonas", "tms_tariff_rules(origen_zona, destino_zona)"),
            ("idx_tms_routes_centros", "tms_routes(origen_centro_id, destino_centro_id)"),
            ("idx_tms_audit_entidad", "tms_audit_log(entidad, entidad_id)"),
        ]

        for idx_name, idx_def in indices:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}")
        print("+ Indices TMS creados")

        # 17. Datos iniciales: categorias de costos
        categorias_iniciales = [
            ("Combustible", "variable", "litros", 1, None),
            ("Peajes", "variable", "unidad", 1, None),
            ("Viaticos", "variable", "dia", 0, 5000.0),
            ("Mantenimiento en ruta", "variable", "unidad", 1, 10000.0),
            ("Seguros", "fijo", "viaje", 0, None),
            ("Estacionamiento", "variable", "unidad", 0, 500.0),
            ("Multas", "variable", "unidad", 1, None),
            ("Carga/Descarga", "variable", "servicio", 0, 3000.0),
        ]
        for cat in categorias_iniciales:
            cursor.execute("""
                INSERT OR IGNORE INTO tms_cost_categories (nombre, tipo, unidad_medida, requiere_evidencia, limite_monto)
                VALUES (?, ?, ?, ?, ?)
            """, cat)
        print("+ Categorias de costos iniciales creadas")

        # 18. Configuracion inicial
        configs_iniciales = [
            ("VIATICO_DIARIO_CARRETERA", "800", "number", "Viatico diario para ruta carretera (MXN)"),
            ("VIATICO_DIARIO_AUTOPISTA", "1000", "number", "Viatico diario para ruta autopista (MXN)"),
            ("MARGEN_MINIMO_PCT", "15", "number", "Margen minimo aceptable (%)"),
            ("ALERTA_RETRASO_PCT", "20", "number", "% sobre tiempo estimado para alerta"),
            ("CAPACIDAD_MAX_PCT", "95", "number", "% maximo de capacidad vehicular"),
            ("CONSOLIDACION_AUTO", "true", "boolean", "Habilitar sugerencias automaticas de consolidacion"),
        ]
        for cfg in configs_iniciales:
            cursor.execute("""
                INSERT OR IGNORE INTO tms_config (clave, valor, tipo, descripcion)
                VALUES (?, ?, ?, ?)
            """, cfg)
        print("+ Configuracion TMS inicial creada")

        conn.commit()
        print("\n[OK] Migracion 027_tms_tables completada exitosamente")
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
            "tms_audit_log", "tms_config", "tms_fuel_records",
            "tms_trip_settlements", "tms_trip_costs", "tms_cost_categories",
            "tms_tariff_rules", "tms_tracking_events", "tms_consol_items",
            "tms_consolidations", "tms_shipment_items", "tms_shipments",
            "tms_route_waypoints", "tms_routes", "tms_zones",
        ]

        for tabla in tablas:
            cursor.execute(f"DROP TABLE IF EXISTS {tabla}")
            print(f"- Tabla {tabla} eliminada")

        conn.commit()
        print("\n[OK] Rollback TMS completado")
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
