-- Combined TMS + FMS tables for PostgreSQL
-- Schema matches the actual column names used by fms_service.py and tms_service.py
-- Run with: psql -U spm spm_production -f tms_fms_pg.sql

-- FMS Tables (referenced by TMS)
CREATE TABLE IF NOT EXISTS fms_vehicles (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE,
    patente TEXT,
    tipo TEXT DEFAULT 'camion',
    marca TEXT, modelo TEXT, anio INTEGER,
    capacidad_kg REAL DEFAULT 0,
    capacidad_m3 REAL DEFAULT 0,
    capacidad_peso_kg REAL DEFAULT 0,
    capacidad_vol_m3 REAL DEFAULT 0,
    requiere_frio BOOLEAN DEFAULT FALSE,
    requiere_hazmat BOOLEAN DEFAULT FALSE,
    tiene_gps BOOLEAN DEFAULT FALSE,
    estado TEXT DEFAULT 'disponible',
    km_actual REAL DEFAULT 0,
    proximo_mantenimiento DATE,
    notas TEXT, activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_drivers (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE,
    nombre TEXT NOT NULL, apellido TEXT,
    documento TEXT, licencia_tipo TEXT, licencia_vencimiento DATE,
    telefono TEXT, email TEXT,
    estado TEXT DEFAULT 'disponible',
    hazmat_cert BOOLEAN DEFAULT FALSE,
    capacitacion_hazmat BOOLEAN DEFAULT FALSE,
    habilitado_frio BOOLEAN DEFAULT FALSE,
    costo_dia REAL DEFAULT 0, calificacion REAL DEFAULT 5.0,
    viajes_totales INTEGER DEFAULT 0,
    notas TEXT, activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_maintenance_plans (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES fms_vehicles(id) ON DELETE CASCADE,
    nombre TEXT,
    tipo TEXT DEFAULT 'preventivo', descripcion TEXT,
    intervalo_km REAL, intervalo_dias INTEGER,
    frecuencia_km REAL, frecuencia_dias INTEGER,
    ultimo_servicio DATE, proximo_servicio DATE,
    items_json TEXT,
    costo_estimado REAL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_work_orders (
    id SERIAL PRIMARY KEY,
    codigo TEXT,
    vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
    tipo TEXT DEFAULT 'preventivo',
    estado TEXT DEFAULT 'pendiente',
    prioridad INTEGER DEFAULT 3,
    descripcion TEXT,
    fecha_programada DATE, fecha_inicio TIMESTAMP, fecha_fin TIMESTAMP,
    km_actual REAL DEFAULT 0,
    costo_estimado REAL DEFAULT 0,
    costo_repuestos REAL DEFAULT 0, costo_mano_obra REAL DEFAULT 0,
    costo_total REAL DEFAULT 0,
    taller TEXT, mecanico TEXT, tecnico TEXT,
    notas TEXT, created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_wo_parts (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES fms_work_orders(id) ON DELETE CASCADE,
    material_id TEXT, material_codigo TEXT, descripcion TEXT,
    cantidad REAL DEFAULT 1, costo_unitario REAL DEFAULT 0, costo_total REAL DEFAULT 0,
    de_inventario BOOLEAN DEFAULT FALSE,
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_inspections (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
    driver_id INTEGER REFERENCES fms_drivers(id),
    tipo TEXT DEFAULT 'pre_viaje',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    inspector_id TEXT,
    estado TEXT DEFAULT 'pendiente',
    resultado TEXT DEFAULT 'aprobado',
    items_json TEXT, observaciones TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_inspection_items (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES fms_inspections(id) ON DELETE CASCADE,
    categoria TEXT,
    item_checklist TEXT,
    es_critico BOOLEAN DEFAULT FALSE,
    estado TEXT DEFAULT 'ok',
    observacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fms_vehicle_documents (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    numero TEXT,
    fecha_emision DATE,
    fecha_vencimiento DATE,
    archivo_url TEXT,
    nombre TEXT, url TEXT, notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TMS Tables
CREATE TABLE IF NOT EXISTS tms_zones (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'general',
    centros_ids TEXT, activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_routes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    origen TEXT, destino TEXT,
    origen_centro_id TEXT, destino_centro_id TEXT,
    distancia_km REAL DEFAULT 0, tiempo_estimado_hrs REAL DEFAULT 0,
    costo_base REAL DEFAULT 0,
    tipo_via TEXT DEFAULT 'carretera',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_route_waypoints (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES tms_routes(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0,
    centro_id TEXT, lat REAL, lng REAL, nombre_parada TEXT,
    tiempo_parada_min INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_shipments (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    solicitud_id INTEGER,
    tipo TEXT DEFAULT 'standard',
    estado TEXT DEFAULT 'draft',
    origen TEXT, destino TEXT,
    origen_centro_id TEXT, destino_centro_id TEXT,
    origen_centro TEXT, destino_centro TEXT,
    transportista TEXT, conductor TEXT,
    vehiculo_id INTEGER REFERENCES fms_vehicles(id),
    conductor_id INTEGER REFERENCES fms_drivers(id),
    route_id INTEGER REFERENCES tms_routes(id),
    consolidation_id INTEGER,
    peso_kg REAL DEFAULT 0, volumen_m3 REAL DEFAULT 0,
    prioridad INTEGER DEFAULT 3,
    fecha_salida TIMESTAMP,
    fecha_llegada_est TIMESTAMP,
    fecha_llegada_real TIMESTAMP,
    fecha_entrega_real TIMESTAMP,
    notas TEXT,
    created_by TEXT NOT NULL DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_shipment_items (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
    solicitud_id INTEGER, material_id TEXT, descripcion TEXT,
    cantidad REAL DEFAULT 0, peso_kg REAL DEFAULT 0,
    volumen_m3 REAL DEFAULT 0, valor_declarado REAL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_shipment_costs (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
    tipo TEXT DEFAULT 'directo',
    concepto TEXT NOT NULL,
    monto REAL NOT NULL DEFAULT 0,
    moneda TEXT DEFAULT 'ARS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_consolidations (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    estado TEXT DEFAULT 'draft',
    tipo TEXT DEFAULT 'LTL',
    destino TEXT,
    fecha_corte TIMESTAMP,
    peso_total REAL DEFAULT 0,
    volumen_total REAL DEFAULT 0,
    shipments_count INTEGER DEFAULT 0,
    ahorro_estimado REAL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_consol_items (
    id SERIAL PRIMARY KEY,
    consolidation_id INTEGER NOT NULL REFERENCES tms_consolidations(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id),
    orden_carga INTEGER DEFAULT 0,
    peso_kg REAL DEFAULT 0, volumen_m3 REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_tracking_events (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
    latitud REAL, longitud REAL,
    velocidad REAL,
    evento TEXT NOT NULL,
    notas TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_tariffs (
    id SERIAL PRIMARY KEY,
    transportista_cuit TEXT,
    ruta_origen TEXT, ruta_destino TEXT,
    tipo_vehiculo TEXT,
    tarifa_base REAL DEFAULT 0,
    tarifa_por_km REAL DEFAULT 0,
    tarifa_por_kg REAL DEFAULT 0,
    vigencia_desde DATE, vigencia_hasta DATE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_settlements (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id),
    transportista_cuit TEXT,
    monto_base REAL DEFAULT 0,
    ajustes REAL DEFAULT 0,
    monto_final REAL DEFAULT 0,
    estado TEXT DEFAULT 'borrador',
    periodo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_cost_categories (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'variable', unidad_medida TEXT,
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    limite_monto REAL, activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_config (
    id SERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    tipo TEXT DEFAULT 'string', descripcion TEXT,
    created_by TEXT,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_audit_log (
    id SERIAL PRIMARY KEY,
    entidad TEXT NOT NULL, entidad_id INTEGER NOT NULL,
    accion TEXT NOT NULL,
    datos_antes TEXT, datos_despues TEXT,
    usuario_id TEXT NOT NULL DEFAULT '1', ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tms_shipments_estado ON tms_shipments(estado);
CREATE INDEX IF NOT EXISTS idx_tms_shipments_codigo ON tms_shipments(codigo);
CREATE INDEX IF NOT EXISTS idx_tms_tracking_shipment ON tms_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_fms_vehicles_estado ON fms_vehicles(estado);
CREATE INDEX IF NOT EXISTS idx_fms_drivers_estado ON fms_drivers(estado);
CREATE INDEX IF NOT EXISTS idx_fms_work_orders_vehicle ON fms_work_orders(vehicle_id);
