-- =========================================================================
-- Migracion 029: Agregar tablas TMS, FMS y Dashboard
-- Fecha: 2026-02-05
-- Ejecutar: docker exec spm-postgres psql -U spm -d spm_production -f /path/to/029_add_tms_fms_dashboard.sql
-- Seguro: Usa IF NOT EXISTS en todas las tablas e indices
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Tablas Dashboard (6 tablas)
-- =========================================================================

CREATE TABLE IF NOT EXISTS dashboard_grupo (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    icono TEXT DEFAULT 'folder',
    color TEXT DEFAULT '#6366f1',
    orden INTEGER DEFAULT 0,
    owner_id TEXT NOT NULL,
    es_publico BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    owner_id TEXT NOT NULL,
    grupo_id INTEGER REFERENCES dashboard_grupo(id) ON DELETE SET NULL,
    tipo TEXT DEFAULT 'spreadsheet' CHECK(tipo IN ('spreadsheet', 'chart', 'mixed')),
    es_publico BOOLEAN DEFAULT FALSE,
    es_favorito BOOLEAN DEFAULT FALSE,
    icono TEXT DEFAULT 'table',
    color TEXT DEFAULT '#3b82f6',
    thumbnail TEXT,
    config TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_sheet (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
    sheet_index INTEGER DEFAULT 0,
    nombre TEXT DEFAULT 'Hoja 1',
    data TEXT NOT NULL,
    config TEXT,
    es_visible BOOLEAN DEFAULT TRUE,
    es_protegida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_datasource (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('stock', 'budget', 'solicitudes', 'forecast', 'mrp', 'custom')),
    query TEXT,
    filtros TEXT,
    cache_ttl INTEGER DEFAULT 300,
    ultimo_refresh TIMESTAMP,
    config TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_share (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    permiso TEXT DEFAULT 'view' CHECK(permiso IN ('view', 'edit', 'admin')),
    password_hash TEXT,
    max_accesos INTEGER,
    accesos_actuales INTEGER DEFAULT 0,
    expira_en TIMESTAMP,
    creado_por TEXT NOT NULL,
    nota TEXT,
    esta_activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_permiso (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL,
    permiso TEXT DEFAULT 'view' CHECK(permiso IN ('view', 'edit', 'admin')),
    otorgado_por TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(dashboard_id, usuario_id)
);

-- Indices Dashboard
CREATE INDEX IF NOT EXISTS idx_dashboard_uuid ON dashboard(uuid);
CREATE INDEX IF NOT EXISTS idx_dashboard_owner ON dashboard(owner_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_grupo ON dashboard(grupo_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_publico ON dashboard(es_publico);
CREATE INDEX IF NOT EXISTS idx_dashboard_sheet_dashboard ON dashboard_sheet(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_datasource_dashboard ON dashboard_datasource(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_datasource_tipo ON dashboard_datasource(tipo);
CREATE INDEX IF NOT EXISTS idx_dashboard_share_token ON dashboard_share(token);
CREATE INDEX IF NOT EXISTS idx_dashboard_share_dashboard ON dashboard_share(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_permiso_dashboard ON dashboard_permiso(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_permiso_usuario ON dashboard_permiso(usuario_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_grupo_owner ON dashboard_grupo(owner_id);

-- =========================================================================
-- 2. Tablas FMS - Fleet Management System (8 tablas)
-- FMS va antes que TMS porque TMS tiene FK a fms_vehicles/fms_drivers
-- =========================================================================

CREATE TABLE IF NOT EXISTS fms_vehicles (
    id SERIAL PRIMARY KEY,
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
    cadena_frio BOOLEAN DEFAULT FALSE,
    hazmat_cert BOOLEAN DEFAULT FALSE,
    gps_device_id TEXT,
    seguro_poliza TEXT,
    seguro_vigencia TEXT,
    verificacion_vig TEXT,
    prox_mantenimiento_km REAL,
    prox_mantenimiento_fecha TEXT,
    foto_url TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_drivers (
    id SERIAL PRIMARY KEY,
    usuario_id TEXT,
    nombre TEXT NOT NULL,
    apellido TEXT,
    numero_licencia TEXT,
    tipo_licencia TEXT CHECK(tipo_licencia IN ('A', 'B', 'C', 'D', 'E', 'federal')),
    vigencia_licencia TEXT,
    vigencia_medica TEXT,
    capacitacion_hazmat BOOLEAN DEFAULT FALSE,
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo', 'inactivo', 'vacaciones', 'incapacidad', 'baja')),
    telefono TEXT,
    contacto_emergencia TEXT,
    foto_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_maintenance_plans (
    id SERIAL PRIMARY KEY,
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
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_work_orders (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_wo_parts (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES fms_work_orders(id) ON DELETE CASCADE,
    material_id TEXT,
    descripcion TEXT,
    cantidad REAL DEFAULT 1,
    costo_unitario REAL DEFAULT 0,
    costo_total REAL DEFAULT 0,
    de_inventario BOOLEAN DEFAULT FALSE,
    solicitud_id INTEGER,
    estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'solicitado', 'recibido', 'instalado')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_vehicle_docs (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_inspections (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
    driver_id INTEGER NOT NULL REFERENCES fms_drivers(id),
    shipment_id INTEGER,
    tipo TEXT DEFAULT 'pre_trip' CHECK(tipo IN ('pre_trip', 'post_trip')),
    fecha TIMESTAMP DEFAULT NOW(),
    odometro REAL,
    resultado TEXT DEFAULT 'pendiente' CHECK(resultado IN ('pendiente', 'aprobado', 'rechazado', 'con_observaciones')),
    observaciones TEXT,
    firma_digital TEXT,
    aprobado_por TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fms_inspection_items (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES fms_inspections(id) ON DELETE CASCADE,
    item_checklist TEXT NOT NULL,
    categoria TEXT DEFAULT 'general',
    estado TEXT DEFAULT 'na' CHECK(estado IN ('ok', 'mal', 'na')),
    es_critico BOOLEAN DEFAULT FALSE,
    foto_evidencia_url TEXT,
    observacion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indices FMS
CREATE INDEX IF NOT EXISTS idx_fms_vehicles_placa ON fms_vehicles(placa);
CREATE INDEX IF NOT EXISTS idx_fms_vehicles_estado ON fms_vehicles(estado);
CREATE INDEX IF NOT EXISTS idx_fms_vehicles_tipo ON fms_vehicles(tipo);
CREATE INDEX IF NOT EXISTS idx_fms_drivers_usuario ON fms_drivers(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fms_drivers_estado ON fms_drivers(estado);
CREATE INDEX IF NOT EXISTS idx_fms_maintenance_vehicle ON fms_maintenance_plans(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fms_maintenance_prox_fecha ON fms_maintenance_plans(proxima_fecha);
CREATE INDEX IF NOT EXISTS idx_fms_wo_codigo ON fms_work_orders(codigo);
CREATE INDEX IF NOT EXISTS idx_fms_wo_vehicle ON fms_work_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fms_wo_estado ON fms_work_orders(estado);
CREATE INDEX IF NOT EXISTS idx_fms_wo_prioridad ON fms_work_orders(prioridad);
CREATE INDEX IF NOT EXISTS idx_fms_wo_parts_wo ON fms_wo_parts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_fms_wo_parts_solicitud ON fms_wo_parts(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_fms_vehicle_docs_vehicle ON fms_vehicle_docs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fms_vehicle_docs_venc ON fms_vehicle_docs(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_fms_inspections_vehicle ON fms_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fms_inspections_driver ON fms_inspections(driver_id);
CREATE INDEX IF NOT EXISTS idx_fms_inspections_fecha ON fms_inspections(fecha);
CREATE INDEX IF NOT EXISTS idx_fms_inspection_items_insp ON fms_inspection_items(inspection_id);

-- =========================================================================
-- 3. Tablas TMS - Transport Management System (15 tablas)
-- =========================================================================

CREATE TABLE IF NOT EXISTS tms_zones (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'general' CHECK(tipo IN ('origen', 'destino', 'general')),
    centros_ids TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_routes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    origen_centro_id TEXT,
    destino_centro_id TEXT,
    distancia_km REAL DEFAULT 0,
    tiempo_estimado_hrs REAL DEFAULT 0,
    costo_base REAL DEFAULT 0,
    tipo_via TEXT DEFAULT 'carretera' CHECK(tipo_via IN ('carretera', 'autopista', 'mixta', 'urbana')),
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_route_waypoints (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES tms_routes(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0,
    centro_id TEXT,
    lat REAL,
    lng REAL,
    nombre_parada TEXT,
    tiempo_parada_min INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_shipments (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    tipo TEXT DEFAULT 'standard' CHECK(tipo IN ('standard', 'express', 'ltl', 'ftl', 'consolidado')),
    estado TEXT DEFAULT 'draft' CHECK(estado IN (
        'draft', 'confirmed', 'assigned', 'in_transit',
        'delivered', 'incident', 'resolved', 'settled', 'closed', 'cancelled'
    )),
    origen_centro_id TEXT,
    destino_centro_id TEXT,
    fecha_solicitud TIMESTAMP DEFAULT NOW(),
    fecha_programada TIMESTAMP,
    fecha_despacho TIMESTAMP,
    fecha_entrega_estimada TIMESTAMP,
    fecha_entrega_real TIMESTAMP,
    prioridad INTEGER DEFAULT 3 CHECK(prioridad BETWEEN 1 AND 5),
    tipo_carga TEXT DEFAULT 'general' CHECK(tipo_carga IN ('general', 'perecedero', 'fragil', 'peligroso', 'valor_alto')),
    peso_total_kg REAL DEFAULT 0,
    volumen_total_m3 REAL DEFAULT 0,
    requiere_cadena_frio BOOLEAN DEFAULT FALSE,
    requiere_hazmat BOOLEAN DEFAULT FALSE,
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tms_shipment_items (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
    solicitud_id INTEGER,
    material_id TEXT,
    descripcion TEXT,
    cantidad REAL DEFAULT 0,
    peso_kg REAL DEFAULT 0,
    volumen_m3 REAL DEFAULT 0,
    valor_declarado REAL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_consolidations (
    id SERIAL PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    master_shipment_id INTEGER REFERENCES tms_shipments(id),
    estado TEXT DEFAULT 'open' CHECK(estado IN ('open', 'full', 'dispatched', 'closed', 'cancelled')),
    tipo_consolidacion TEXT DEFAULT 'zona' CHECK(tipo_consolidacion IN ('zona', 'ruta', 'cliente', 'programada')),
    capacidad_peso_max REAL DEFAULT 0,
    capacidad_vol_max REAL DEFAULT 0,
    peso_utilizado REAL DEFAULT 0,
    volumen_utilizado REAL DEFAULT 0,
    pct_utilizacion REAL DEFAULT 0,
    fecha_corte TIMESTAMP,
    ruta_optimizada TEXT,
    vehicle_id INTEGER REFERENCES fms_vehicles(id),
    driver_id INTEGER REFERENCES fms_drivers(id),
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_consol_items (
    id SERIAL PRIMARY KEY,
    consolidation_id INTEGER NOT NULL REFERENCES tms_consolidations(id) ON DELETE CASCADE,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id),
    orden_carga INTEGER DEFAULT 0,
    peso_kg REAL DEFAULT 0,
    volumen_m3 REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_tracking_events (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_cost_categories (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'variable' CHECK(tipo IN ('fijo', 'variable')),
    unidad_medida TEXT,
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    limite_monto REAL,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_trip_costs (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL REFERENCES tms_shipments(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES tms_cost_categories(id),
    concepto TEXT NOT NULL,
    monto REAL NOT NULL DEFAULT 0,
    moneda TEXT DEFAULT 'MXN' CHECK(moneda IN ('USD', 'MXN', 'EUR')),
    tipo_cambio REAL DEFAULT 1.0,
    evidencia_url TEXT,
    proveedor_id TEXT,
    estado_pago TEXT DEFAULT 'pendiente' CHECK(estado_pago IN ('pendiente', 'pagado', 'rechazado')),
    fecha_gasto TIMESTAMP DEFAULT NOW(),
    aprobado_por TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_tariff_rules (
    id SERIAL PRIMARY KEY,
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
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_trip_settlements (
    id SERIAL PRIMARY KEY,
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
    fecha_cierre TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_fuel_records (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES fms_vehicles(id),
    shipment_id INTEGER REFERENCES tms_shipments(id),
    litros REAL NOT NULL,
    costo_litro REAL NOT NULL,
    costo_total REAL NOT NULL,
    odometro_km REAL,
    estacion TEXT,
    evidencia_url TEXT,
    registrado_por TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_config (
    id SERIAL PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    tipo TEXT DEFAULT 'string' CHECK(tipo IN ('string', 'number', 'boolean', 'json')),
    descripcion TEXT,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tms_audit_log (
    id SERIAL PRIMARY KEY,
    entidad TEXT NOT NULL,
    entidad_id INTEGER NOT NULL,
    accion TEXT NOT NULL,
    datos_antes TEXT,
    datos_despues TEXT,
    usuario_id TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indices TMS
CREATE INDEX IF NOT EXISTS idx_tms_shipments_codigo ON tms_shipments(codigo);
CREATE INDEX IF NOT EXISTS idx_tms_shipments_estado ON tms_shipments(estado);
CREATE INDEX IF NOT EXISTS idx_tms_shipments_created_by ON tms_shipments(created_by);
CREATE INDEX IF NOT EXISTS idx_tms_shipments_driver ON tms_shipments(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_tms_shipments_vehicle ON tms_shipments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tms_shipments_fecha_prog ON tms_shipments(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_tms_shipment_items_shipment ON tms_shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tms_shipment_items_solicitud ON tms_shipment_items(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_tms_consolidations_codigo ON tms_consolidations(codigo);
CREATE INDEX IF NOT EXISTS idx_tms_consolidations_estado ON tms_consolidations(estado);
CREATE INDEX IF NOT EXISTS idx_tms_consol_items_consolidation ON tms_consol_items(consolidation_id);
CREATE INDEX IF NOT EXISTS idx_tms_consol_items_shipment ON tms_consol_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tms_tracking_shipment ON tms_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tms_tracking_tipo ON tms_tracking_events(evento_tipo);
CREATE INDEX IF NOT EXISTS idx_tms_trip_costs_shipment ON tms_trip_costs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tms_trip_settlements_shipment ON tms_trip_settlements(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tms_fuel_records_vehicle ON tms_fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tms_fuel_records_shipment ON tms_fuel_records(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tms_tariff_rules_zonas ON tms_tariff_rules(origen_zona, destino_zona);
CREATE INDEX IF NOT EXISTS idx_tms_routes_centros ON tms_routes(origen_centro_id, destino_centro_id);
CREATE INDEX IF NOT EXISTS idx_tms_audit_entidad ON tms_audit_log(entidad, entidad_id);

-- FK diferida: fms_inspections -> tms_shipments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fms_inspections_shipment_fk'
    ) THEN
        ALTER TABLE fms_inspections
            ADD CONSTRAINT fms_inspections_shipment_fk
            FOREIGN KEY (shipment_id) REFERENCES tms_shipments(id);
    END IF;
END $$;

-- =========================================================================
-- 4. Datos iniciales TMS
-- =========================================================================

-- Categorias de costos por defecto
INSERT INTO tms_cost_categories (nombre, tipo, unidad_medida, requiere_evidencia, limite_monto)
SELECT * FROM (VALUES
    ('Combustible', 'variable', 'litros', TRUE, NULL),
    ('Peajes', 'variable', 'unidad', TRUE, NULL),
    ('Viaticos', 'variable', 'dia', FALSE, 5000.0),
    ('Mantenimiento en ruta', 'variable', 'unidad', TRUE, 10000.0),
    ('Seguros', 'fijo', 'viaje', FALSE, NULL),
    ('Estacionamiento', 'variable', 'unidad', FALSE, 500.0),
    ('Multas', 'variable', 'unidad', TRUE, NULL),
    ('Carga/Descarga', 'variable', 'servicio', FALSE, 3000.0)
) AS v(nombre, tipo, unidad_medida, requiere_evidencia, limite_monto)
WHERE NOT EXISTS (SELECT 1 FROM tms_cost_categories LIMIT 1);

-- Configuracion TMS por defecto
INSERT INTO tms_config (clave, valor, tipo, descripcion)
SELECT * FROM (VALUES
    ('VIATICO_DIARIO_CARRETERA', '800', 'number', 'Viatico diario para ruta carretera (MXN)'),
    ('VIATICO_DIARIO_AUTOPISTA', '1000', 'number', 'Viatico diario para ruta autopista (MXN)'),
    ('MARGEN_MINIMO_PCT', '15', 'number', 'Margen minimo aceptable (%)'),
    ('ALERTA_RETRASO_PCT', '20', 'number', '% sobre tiempo estimado para alerta'),
    ('CAPACIDAD_MAX_PCT', '95', 'number', '% maximo de capacidad vehicular'),
    ('CONSOLIDACION_AUTO', 'true', 'boolean', 'Habilitar sugerencias automaticas de consolidacion')
) AS v(clave, valor, tipo, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM tms_config LIMIT 1);

-- Registrar migracion
INSERT INTO schema_migrations (version) VALUES (29)
ON CONFLICT (version) DO NOTHING;

COMMIT;
