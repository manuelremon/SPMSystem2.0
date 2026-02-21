-- ==========================================
-- Script: Create all missing tables in PostgreSQL production
-- Generated from migrations 038-084
-- All statements use IF NOT EXISTS (safe to re-run)
-- ==========================================

-- MIGRATION 038: Auto-Approval Rules
CREATE TABLE IF NOT EXISTS regla_auto_aprobacion (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    condiciones_json TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    centro_id TEXT,
    prioridad INTEGER NOT NULL DEFAULT 100,
    creado_por INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_regla_auto_aprobacion_activo_prioridad ON regla_auto_aprobacion(activo, prioridad);
CREATE INDEX IF NOT EXISTS idx_regla_auto_aprobacion_centro ON regla_auto_aprobacion(centro_id);

-- MIGRATION 040: Escalation Rules
CREATE TABLE IF NOT EXISTS regla_escalacion (
    id SERIAL PRIMARY KEY,
    centro TEXT,
    criticidad TEXT NOT NULL DEFAULT 'media',
    timeout_dias INTEGER NOT NULL DEFAULT 3,
    escalate_to_role TEXT NOT NULL DEFAULT 'admin',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_regla_escalacion_activo ON regla_escalacion(activo);
CREATE INDEX IF NOT EXISTS idx_regla_escalacion_centro ON regla_escalacion(centro);

-- MIGRATION 041: Reporte Destinatarios
CREATE TABLE IF NOT EXISTS reporte_destinatario (
    id SERIAL PRIMARY KEY,
    reporte_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    nombre TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reporte_destinatario_reporte_id ON reporte_destinatario(reporte_id);
CREATE INDEX IF NOT EXISTS idx_reporte_destinatario_email ON reporte_destinatario(email);

-- MIGRATION 042: Webhooks
CREATE TABLE IF NOT EXISTS webhook (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    eventos TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS webhook_delivery (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL,
    evento TEXT NOT NULL,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    response_body TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES webhook(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webhook_activo ON webhook(activo);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook_created ON webhook_delivery(webhook_id, created_at DESC);

-- MIGRATION 043: User Material Favorites
CREATE TABLE IF NOT EXISTS user_material_favorito (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    material_codigo TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, material_codigo)
);
CREATE INDEX IF NOT EXISTS idx_user_material_favorito_user_id ON user_material_favorito(user_id);
CREATE INDEX IF NOT EXISTS idx_user_material_favorito_material ON user_material_favorito(material_codigo);

-- MIGRATION 045: Cost Savings
CREATE TABLE IF NOT EXISTS ahorro_costo (
    id SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    moneda TEXT DEFAULT 'ARS',
    material_codigo TEXT,
    proveedor_cuit TEXT,
    solicitud_id INTEGER,
    descripcion TEXT,
    registrado_por INTEGER NOT NULL,
    fecha_realizacion TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (monto >= 0)
);
CREATE TABLE IF NOT EXISTS meta_ahorro (
    id SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    periodo TEXT NOT NULL,
    meta_monto REAL NOT NULL,
    buyer_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (meta_monto >= 0)
);
CREATE INDEX IF NOT EXISTS idx_ahorro_categoria ON ahorro_costo(categoria);
CREATE INDEX IF NOT EXISTS idx_ahorro_tipo ON ahorro_costo(tipo);
CREATE INDEX IF NOT EXISTS idx_ahorro_fecha ON ahorro_costo(fecha_realizacion);
CREATE INDEX IF NOT EXISTS idx_ahorro_registrado_por ON ahorro_costo(registrado_por);
CREATE INDEX IF NOT EXISTS idx_meta_periodo ON meta_ahorro(periodo);

-- MIGRATION 046: Inventory Aging & SLOB
CREATE TABLE IF NOT EXISTS inventario_aging (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    almacen TEXT NOT NULL,
    cantidad REAL NOT NULL DEFAULT 0,
    valor REAL NOT NULL DEFAULT 0,
    fecha_ultimo_movimiento TIMESTAMP,
    dias_sin_movimiento INTEGER DEFAULT 0,
    categoria_aging TEXT NOT NULL,
    es_slob INTEGER DEFAULT 0,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS slob_disposicion (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    almacen TEXT NOT NULL,
    cantidad REAL NOT NULL,
    tipo_disposicion TEXT NOT NULL,
    estado TEXT DEFAULT 'proposed',
    notas TEXT,
    costo_recuperado REAL DEFAULT 0,
    propuesto_por INTEGER NOT NULL,
    aprobado_por INTEGER,
    completado_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aging_material ON inventario_aging(material_codigo);
CREATE INDEX IF NOT EXISTS idx_aging_categoria ON inventario_aging(categoria_aging);
CREATE INDEX IF NOT EXISTS idx_aging_slob ON inventario_aging(es_slob);
CREATE INDEX IF NOT EXISTS idx_aging_snapshot ON inventario_aging(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_disp_material ON slob_disposicion(material_codigo);
CREATE INDEX IF NOT EXISTS idx_disp_estado ON slob_disposicion(estado);
CREATE INDEX IF NOT EXISTS idx_disp_tipo ON slob_disposicion(tipo_disposicion);

-- MIGRATION 047: Contract Management
CREATE TABLE IF NOT EXISTS contrato (
    id SERIAL PRIMARY KEY,
    numero_contrato TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    proveedor_nombre TEXT NOT NULL,
    estado TEXT DEFAULT 'draft',
    fecha_inicio TIMESTAMP,
    fecha_vencimiento TIMESTAMP,
    valor_total REAL DEFAULT 0,
    moneda TEXT DEFAULT 'ARS',
    centro TEXT,
    notas TEXT,
    creado_por INTEGER NOT NULL,
    aprobado_por INTEGER,
    alerta_vencimiento INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS contrato_historial (
    id SERIAL PRIMARY KEY,
    contrato_id INTEGER NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    actor_id INTEGER NOT NULL,
    razon TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contrato_estado ON contrato(estado);
CREATE INDEX IF NOT EXISTS idx_contrato_proveedor ON contrato(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_contrato_tipo ON contrato(tipo);
CREATE INDEX IF NOT EXISTS idx_contrato_vencimiento ON contrato(fecha_vencimiento);

-- MIGRATION 048: Contract Items
CREATE TABLE IF NOT EXISTS contrato_item (
    id SERIAL PRIMARY KEY,
    contrato_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    material_descripcion TEXT,
    precio_unitario REAL NOT NULL,
    moneda TEXT DEFAULT 'ARS',
    cantidad_comprometida REAL,
    cantidad_consumida REAL DEFAULT 0,
    unidad TEXT DEFAULT 'UN',
    fecha_vigencia_desde TIMESTAMP,
    fecha_vigencia_hasta TIMESTAMP,
    activo INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contrato_item_contrato ON contrato_item(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_item_material ON contrato_item(material_codigo);
CREATE INDEX IF NOT EXISTS idx_contrato_item_activo ON contrato_item(activo);

-- MIGRATION 049: Contract Documents
CREATE TABLE IF NOT EXISTS contrato_documento (
    id SERIAL PRIMARY KEY,
    contrato_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    nombre_archivo TEXT NOT NULL,
    ruta_archivo TEXT NOT NULL,
    tamanio_bytes INTEGER,
    mime_type TEXT,
    subido_por INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contrato_doc_contrato ON contrato_documento(contrato_id);

-- MIGRATION 050: Contract Alerts
CREATE TABLE IF NOT EXISTS contrato_alerta (
    id SERIAL PRIMARY KEY,
    contrato_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    leida INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contrato_id) REFERENCES contrato(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contrato_alerta_contrato ON contrato_alerta(contrato_id);

-- MIGRATION 050-051: RFQ Tables
CREATE TABLE IF NOT EXISTS rfq (
    id SERIAL PRIMARY KEY,
    numero_rfq TEXT UNIQUE NOT NULL,
    estado TEXT DEFAULT 'draft',
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_publicacion TIMESTAMP,
    fecha_cierre_ofertas TIMESTAMP,
    solicitud_id INTEGER,
    creado_por TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rfq_item (
    id SERIAL PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    material_descripcion TEXT,
    cantidad_solicitada REAL NOT NULL,
    unidad TEXT DEFAULT 'UN',
    especificaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rfq_proveedor (
    id SERIAL PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    proveedor_nombre TEXT,
    estado_respuesta TEXT DEFAULT 'invited',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rfq_oferta (
    id SERIAL PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    rfq_item_id INTEGER NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    precio_unitario REAL NOT NULL,
    moneda TEXT DEFAULT 'ARS',
    lead_time_dias INTEGER,
    terminos_pago TEXT,
    notas TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
    FOREIGN KEY (rfq_item_id) REFERENCES rfq_item(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rfq_criterio_evaluacion (
    id SERIAL PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    criterio TEXT,
    peso_porcentaje REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rfq_evaluacion (
    id SERIAL PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    puntaje_total REAL,
    puntaje_precio REAL,
    puntaje_lead_time REAL,
    puntaje_calidad REAL,
    puntaje_terminos REAL,
    evaluado_por TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rfq_adjudicacion (
    id SERIAL PRIMARY KEY,
    rfq_id INTEGER NOT NULL,
    rfq_item_id INTEGER NOT NULL,
    proveedor_ganador_cuit TEXT NOT NULL,
    precio_adjudicado REAL NOT NULL,
    cantidad_adjudicada REAL NOT NULL,
    orden_compra_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq(id) ON DELETE CASCADE,
    FOREIGN KEY (rfq_item_id) REFERENCES rfq_item(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rfq_estado ON rfq(estado);
CREATE INDEX IF NOT EXISTS idx_rfq_creado_por ON rfq(creado_por);
CREATE INDEX IF NOT EXISTS idx_rfq_item_rfq ON rfq_item(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_proveedor_rfq ON rfq_proveedor(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_oferta_rfq ON rfq_oferta(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_oferta_proveedor ON rfq_oferta(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_rfq_criterio_rfq ON rfq_criterio_evaluacion(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_eval_rfq ON rfq_evaluacion(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_adj_rfq ON rfq_adjudicacion(rfq_id);

-- MIGRATION 052: Quality Inspection & NCR
CREATE TABLE IF NOT EXISTS inspeccion_entrada (
    id SERIAL PRIMARY KEY,
    recepcion_id INTEGER,
    numero_inspeccion TEXT UNIQUE NOT NULL,
    tipo TEXT,
    inspector_id INTEGER,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resultado TEXT,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inspeccion_item (
    id SERIAL PRIMARY KEY,
    inspeccion_id INTEGER NOT NULL,
    recepcion_item_id INTEGER,
    cantidad_inspeccionada REAL,
    cantidad_aprobada REAL DEFAULT 0,
    cantidad_rechazada REAL DEFAULT 0,
    resultado TEXT,
    defectos TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspeccion_id) REFERENCES inspeccion_entrada(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS inspeccion_defecto (
    id SERIAL PRIMARY KEY,
    inspeccion_item_id INTEGER NOT NULL,
    tipo_defecto TEXT,
    cantidad INTEGER DEFAULT 1,
    severidad TEXT,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspeccion_item_id) REFERENCES inspeccion_item(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ncr (
    id SERIAL PRIMARY KEY,
    numero_ncr TEXT UNIQUE NOT NULL,
    inspeccion_id INTEGER,
    proveedor_cuit TEXT,
    material_codigo TEXT,
    cantidad_afectada REAL,
    descripcion TEXT,
    severidad TEXT,
    estado TEXT DEFAULT 'open',
    reportado_por INTEGER,
    asignado_a INTEGER,
    fecha_resolucion TIMESTAMP,
    accion_correctiva TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspeccion_id) REFERENCES inspeccion_entrada(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS ncr_accion (
    id SERIAL PRIMARY KEY,
    ncr_id INTEGER NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT,
    actor_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ncr_historial (
    id SERIAL PRIMARY KEY,
    ncr_id INTEGER NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT,
    actor_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inspeccion_recepcion ON inspeccion_entrada(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_resultado ON inspeccion_entrada(resultado);
CREATE INDEX IF NOT EXISTS idx_ncr_estado ON ncr(estado);
CREATE INDEX IF NOT EXISTS idx_ncr_severidad ON ncr(severidad);
CREATE INDEX IF NOT EXISTS idx_ncr_proveedor ON ncr(proveedor_cuit);

-- MIGRATION 053: CAPA
CREATE TABLE IF NOT EXISTS capa (
    id SERIAL PRIMARY KEY,
    ncr_id INTEGER,
    tipo TEXT DEFAULT 'corrective',
    descripcion TEXT NOT NULL,
    causa_raiz TEXT,
    accion_propuesta TEXT,
    responsable_id INTEGER,
    fecha_limite DATE,
    estado TEXT DEFAULT 'open',
    efectividad TEXT,
    verificado_por INTEGER,
    fecha_verificacion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ncr_id) REFERENCES ncr(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_capa_ncr ON capa(ncr_id);
CREATE INDEX IF NOT EXISTS idx_capa_estado ON capa(estado);

-- MIGRATION 054: Invoice Matching
CREATE TABLE IF NOT EXISTS factura_proveedor (
    id SERIAL PRIMARY KEY,
    numero_factura TEXT UNIQUE NOT NULL,
    orden_compra_id INTEGER,
    proveedor_cuit TEXT NOT NULL,
    monto_total REAL NOT NULL,
    moneda TEXT DEFAULT 'ARS',
    fecha_factura TIMESTAMP NOT NULL,
    fecha_vencimiento_pago TIMESTAMP,
    estado TEXT DEFAULT 'pending',
    recepcion_id INTEGER,
    tipo_comprobante TEXT,
    subido_por INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS factura_item (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL,
    orden_compra_item_id INTEGER,
    material_codigo TEXT NOT NULL,
    cantidad_facturada REAL NOT NULL,
    precio_unitario REAL NOT NULL,
    precio_total REAL NOT NULL,
    FOREIGN KEY (factura_id) REFERENCES factura_proveedor(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS matching_resultado (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL,
    orden_compra_id INTEGER,
    recepcion_id INTEGER,
    estado TEXT DEFAULT 'match',
    diferencia_cantidad REAL DEFAULT 0,
    diferencia_precio REAL DEFAULT 0,
    tolerancia_aplicada REAL DEFAULT 0,
    aprobado_por INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (factura_id) REFERENCES factura_proveedor(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_factura_proveedor_estado ON factura_proveedor(estado);
CREATE INDEX IF NOT EXISTS idx_factura_proveedor_oc ON factura_proveedor(orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_factura_proveedor_cuit ON factura_proveedor(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_factura_item_factura ON factura_item(factura_id);
CREATE INDEX IF NOT EXISTS idx_matching_resultado_factura ON matching_resultado(factura_id);

-- MIGRATION 057: Demand Planning
CREATE TABLE IF NOT EXISTS plan_demanda (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    periodo_desde TEXT,
    periodo_hasta TEXT,
    estado TEXT DEFAULT 'draft',
    creado_por INTEGER,
    aprobado_por INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plan_demanda_detalle (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    usuario_id INTEGER,
    fuente TEXT,
    cantidad_pronosticada REAL NOT NULL,
    confianza REAL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plan_demanda(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS plan_demanda_consenso (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    cantidad_consenso REAL,
    cantidad_ml_baseline REAL,
    cantidad_promedio_entradas REAL,
    ajuste_manual REAL DEFAULT 0,
    aprobado_por INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plan_demanda(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_plan_demanda_estado ON plan_demanda(estado);
CREATE INDEX IF NOT EXISTS idx_plan_demanda_detalle_plan ON plan_demanda_detalle(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_demanda_detalle_material ON plan_demanda_detalle(material_codigo);
CREATE INDEX IF NOT EXISTS idx_plan_demanda_consenso_plan ON plan_demanda_consenso(plan_id);

-- MIGRATION 058: Returns / RMA
CREATE TABLE IF NOT EXISTS devolucion (
    id SERIAL PRIMARY KEY,
    numero_rma TEXT UNIQUE NOT NULL,
    tipo TEXT,
    orden_compra_id INTEGER,
    ncr_id INTEGER,
    proveedor_cuit TEXT,
    motivo TEXT,
    estado TEXT DEFAULT 'draft',
    monto_credito_esperado REAL DEFAULT 0,
    monto_credito_recibido REAL DEFAULT 0,
    creado_por INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS devolucion_item (
    id SERIAL PRIMARY KEY,
    devolucion_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    motivo_detalle TEXT,
    FOREIGN KEY (devolucion_id) REFERENCES devolucion(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS devolucion_historial (
    id SERIAL PRIMARY KEY,
    devolucion_id INTEGER NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT,
    actor_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (devolucion_id) REFERENCES devolucion(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_devolucion_estado ON devolucion(estado);
CREATE INDEX IF NOT EXISTS idx_devolucion_proveedor ON devolucion(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_devolucion_oc ON devolucion(orden_compra_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_item_dev ON devolucion_item(devolucion_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_hist_dev ON devolucion_historial(devolucion_id);

-- MIGRATION 059: Cycle Count
CREATE TABLE IF NOT EXISTS ciclo_conteo (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    almacen TEXT,
    tipo TEXT DEFAULT 'full',
    estado TEXT DEFAULT 'planned',
    fecha_programada DATE,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    responsable_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ciclo_conteo_item (
    id SERIAL PRIMARY KEY,
    conteo_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    ubicacion TEXT,
    stock_sistema REAL DEFAULT 0,
    stock_contado REAL,
    diferencia REAL,
    estado TEXT DEFAULT 'pending',
    contado_por INTEGER,
    fecha_conteo TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conteo_id) REFERENCES ciclo_conteo(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ciclo_conteo_estado ON ciclo_conteo(estado);
CREATE INDEX IF NOT EXISTS idx_ciclo_conteo_item_conteo ON ciclo_conteo_item(conteo_id);

-- MIGRATION 060: Lot Tracking
CREATE TABLE IF NOT EXISTS lote (
    id SERIAL PRIMARY KEY,
    numero_lote TEXT UNIQUE NOT NULL,
    material_codigo TEXT NOT NULL,
    proveedor_cuit TEXT,
    cantidad REAL DEFAULT 0,
    fecha_fabricacion DATE,
    fecha_vencimiento DATE,
    estado TEXT DEFAULT 'available',
    almacen TEXT,
    ubicacion TEXT,
    orden_compra_id INTEGER,
    recepcion_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lote_movimiento (
    id SERIAL PRIMARY KEY,
    lote_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    almacen_origen TEXT,
    almacen_destino TEXT,
    referencia TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lote_id) REFERENCES lote(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lote_material ON lote(material_codigo);
CREATE INDEX IF NOT EXISTS idx_lote_estado ON lote(estado);
CREATE INDEX IF NOT EXISTS idx_lote_vencimiento ON lote(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_lote_mov_lote ON lote_movimiento(lote_id);

-- MIGRATION 061: Recalls
CREATE TABLE IF NOT EXISTS recall (
    id SERIAL PRIMARY KEY,
    numero_recall TEXT UNIQUE NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT DEFAULT 'voluntary',
    severidad TEXT DEFAULT 'medium',
    estado TEXT DEFAULT 'initiated',
    material_codigo TEXT,
    proveedor_cuit TEXT,
    lotes_afectados TEXT,
    cantidad_afectada REAL DEFAULT 0,
    responsable_id INTEGER,
    fecha_inicio DATE,
    fecha_cierre DATE,
    accion_requerida TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS recall_accion (
    id SERIAL PRIMARY KEY,
    recall_id INTEGER NOT NULL,
    tipo TEXT,
    descripcion TEXT,
    responsable_id INTEGER,
    estado TEXT DEFAULT 'pending',
    fecha_completado TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recall_id) REFERENCES recall(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recall_estado ON recall(estado);
CREATE INDEX IF NOT EXISTS idx_recall_material ON recall(material_codigo);

-- MIGRATION 062: Consignment
CREATE TABLE IF NOT EXISTS consignacion (
    id SERIAL PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    almacen TEXT,
    estado TEXT DEFAULT 'active',
    fecha_inicio DATE,
    fecha_fin DATE,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS consignacion_item (
    id SERIAL PRIMARY KEY,
    consignacion_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    precio_unitario REAL,
    cantidad_consumida REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consignacion_id) REFERENCES consignacion(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_consignacion_estado ON consignacion(estado);
CREATE INDEX IF NOT EXISTS idx_consignacion_proveedor ON consignacion(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_consignacion_item_consignacion ON consignacion_item(consignacion_id);

-- MIGRATION 063: Customs / Trade
CREATE TABLE IF NOT EXISTS declaracion_aduanera (
    id SERIAL PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    tipo TEXT DEFAULT 'import',
    estado TEXT DEFAULT 'draft',
    proveedor_cuit TEXT,
    pais_origen TEXT,
    puerto_entrada TEXT,
    fecha_arribo DATE,
    valor_declarado REAL DEFAULT 0,
    moneda TEXT DEFAULT 'USD',
    arancel REAL DEFAULT 0,
    impuestos REAL DEFAULT 0,
    agente_aduanero TEXT,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS declaracion_aduanera_item (
    id SERIAL PRIMARY KEY,
    declaracion_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    valor_unitario REAL,
    codigo_arancelario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (declaracion_id) REFERENCES declaracion_aduanera(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_declaracion_estado ON declaracion_aduanera(estado);
CREATE INDEX IF NOT EXISTS idx_declaracion_tipo ON declaracion_aduanera(tipo);

-- MIGRATION 064: Kanban
CREATE TABLE IF NOT EXISTS kanban_tarjeta (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    almacen TEXT,
    punto_reorden REAL NOT NULL,
    cantidad_kanban REAL NOT NULL,
    num_kanbans INTEGER DEFAULT 2,
    lead_time_dias INTEGER DEFAULT 1,
    proveedor_cuit TEXT,
    estado TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kanban_senal (
    id SERIAL PRIMARY KEY,
    tarjeta_id INTEGER NOT NULL,
    tipo TEXT DEFAULT 'reorder',
    estado TEXT DEFAULT 'triggered',
    cantidad REAL,
    generado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completado_at TIMESTAMP,
    FOREIGN KEY (tarjeta_id) REFERENCES kanban_tarjeta(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_kanban_tarjeta_material ON kanban_tarjeta(material_codigo);
CREATE INDEX IF NOT EXISTS idx_kanban_tarjeta_estado ON kanban_tarjeta(estado);
CREATE INDEX IF NOT EXISTS idx_kanban_senal_tarjeta ON kanban_senal(tarjeta_id);

-- MIGRATION 065: Packaging
CREATE TABLE IF NOT EXISTS empaque_especificacion (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    tipo_empaque TEXT NOT NULL,
    instrucciones TEXT,
    peso_max REAL,
    dimensiones TEXT,
    material_empaque TEXT,
    etiquetado TEXT,
    activo INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS empaque_orden (
    id SERIAL PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    estado TEXT DEFAULT 'pending',
    prioridad TEXT DEFAULT 'media',
    fecha_requerida TIMESTAMP,
    completado_at TIMESTAMP,
    responsable_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS empaque_orden_item (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER NOT NULL,
    material_codigo TEXT NOT NULL,
    especificacion_id INTEGER,
    cantidad REAL NOT NULL,
    cantidad_empacada REAL DEFAULT 0,
    estado TEXT DEFAULT 'pending',
    FOREIGN KEY (orden_id) REFERENCES empaque_orden(id) ON DELETE CASCADE,
    FOREIGN KEY (especificacion_id) REFERENCES empaque_especificacion(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_empaque_espec_material ON empaque_especificacion(material_codigo);
CREATE INDEX IF NOT EXISTS idx_empaque_orden_estado ON empaque_orden(estado);
CREATE INDEX IF NOT EXISTS idx_empaque_orden_item_orden ON empaque_orden_item(orden_id);

-- MIGRATION 070: ECO (Engineering Change Orders)
CREATE TABLE IF NOT EXISTS eco (
    id SERIAL PRIMARY KEY,
    numero_eco TEXT UNIQUE NOT NULL,
    titulo TEXT,
    descripcion TEXT,
    tipo TEXT,
    prioridad TEXT DEFAULT 'media',
    estado TEXT DEFAULT 'draft',
    material_codigo TEXT,
    solicitante_id INTEGER,
    aprobador_id INTEGER,
    fecha_efectividad DATE,
    costo_estimado REAL DEFAULT 0,
    impacto_inventario TEXT,
    impacto_proveedores TEXT,
    justificacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS eco_item (
    id SERIAL PRIMARY KEY,
    eco_id INTEGER REFERENCES eco(id) ON DELETE CASCADE,
    tipo_cambio TEXT,
    campo_afectado TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    material_codigo_anterior TEXT,
    material_codigo_nuevo TEXT,
    proveedor_cuit_anterior TEXT,
    proveedor_cuit_nuevo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS eco_aprobacion (
    id SERIAL PRIMARY KEY,
    eco_id INTEGER REFERENCES eco(id) ON DELETE CASCADE,
    aprobador_id INTEGER,
    rol_aprobador TEXT,
    decision TEXT DEFAULT 'pending',
    comentarios TEXT,
    fecha_decision TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS eco_historial (
    id SERIAL PRIMARY KEY,
    eco_id INTEGER REFERENCES eco(id) ON DELETE CASCADE,
    estado_anterior TEXT,
    estado_nuevo TEXT,
    actor_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eco_estado ON eco(estado);
CREATE INDEX IF NOT EXISTS idx_eco_material ON eco(material_codigo);
CREATE INDEX IF NOT EXISTS idx_eco_solicitante ON eco(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_eco_item_eco ON eco_item(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_aprobacion_eco ON eco_aprobacion(eco_id);
CREATE INDEX IF NOT EXISTS idx_eco_historial_eco ON eco_historial(eco_id);

-- MIGRATION 071: Kitting & BOM
CREATE TABLE IF NOT EXISTS kit_bom (
    id SERIAL PRIMARY KEY,
    kit_codigo TEXT UNIQUE NOT NULL,
    nombre TEXT,
    descripcion TEXT,
    estado TEXT DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kit_bom_componente (
    id SERIAL PRIMARY KEY,
    kit_bom_id INTEGER REFERENCES kit_bom(id) ON DELETE CASCADE,
    material_codigo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    unidad TEXT,
    es_opcional INTEGER DEFAULT 0,
    alternativa_material TEXT,
    secuencia INTEGER DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kit_orden (
    id SERIAL PRIMARY KEY,
    numero_orden TEXT UNIQUE NOT NULL,
    kit_bom_id INTEGER REFERENCES kit_bom(id),
    cantidad_kits INTEGER DEFAULT 1,
    estado TEXT DEFAULT 'draft',
    prioridad TEXT DEFAULT 'media',
    almacen_id INTEGER,
    solicitante_id INTEGER,
    fecha_requerida TIMESTAMP,
    fecha_inicio TIMESTAMP,
    fecha_completado TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS kit_orden_detalle (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER REFERENCES kit_orden(id) ON DELETE CASCADE,
    componente_id INTEGER REFERENCES kit_bom_componente(id),
    lote_id INTEGER,
    cantidad_requerida REAL,
    cantidad_asignada REAL DEFAULT 0,
    cantidad_consumida REAL DEFAULT 0,
    estado TEXT DEFAULT 'pending',
    ubicacion_origen TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kit_bom_estado ON kit_bom(estado);
CREATE INDEX IF NOT EXISTS idx_kit_bom_componente_bom ON kit_bom_componente(kit_bom_id);
CREATE INDEX IF NOT EXISTS idx_kit_orden_estado ON kit_orden(estado);
CREATE INDEX IF NOT EXISTS idx_kit_orden_bom ON kit_orden(kit_bom_id);
CREATE INDEX IF NOT EXISTS idx_kit_orden_detalle_orden ON kit_orden_detalle(orden_id);
CREATE INDEX IF NOT EXISTS idx_kit_orden_detalle_comp ON kit_orden_detalle(componente_id);

-- MIGRATION 072: Supplier Portal
CREATE TABLE IF NOT EXISTS portal_proveedor_usuario (
    id SERIAL PRIMARY KEY,
    proveedor_cuit TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    password_hash TEXT,
    estado TEXT DEFAULT 'pending',
    ultimo_login TIMESTAMP,
    token_reset TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portal_proveedor_documento (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES portal_proveedor_usuario(id),
    accion TEXT,
    entidad_tipo TEXT,
    entidad_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS portal_proveedor_factura (
    id SERIAL PRIMARY KEY,
    numero_asn TEXT UNIQUE NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    orden_compra_id INTEGER,
    fecha_envio_estimada TIMESTAMP,
    transportista TEXT,
    guia_despacho TEXT,
    cantidad_total REAL DEFAULT 0,
    estado TEXT DEFAULT 'draft',
    notas TEXT,
    creado_por_portal INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portal_user_proveedor ON portal_proveedor_usuario(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_portal_user_email ON portal_proveedor_usuario(email);
CREATE INDEX IF NOT EXISTS idx_portal_doc_usuario ON portal_proveedor_documento(usuario_id);

-- MIGRATION 073: Supplier Onboarding
CREATE TABLE IF NOT EXISTS onboarding_proveedor (
    id SERIAL PRIMARY KEY,
    proveedor_cuit TEXT UNIQUE NOT NULL,
    nombre_empresa TEXT NOT NULL,
    contacto_nombre TEXT,
    contacto_email TEXT,
    contacto_telefono TEXT,
    estado TEXT DEFAULT 'pending',
    etapa TEXT DEFAULT 'registro',
    evaluacion_score REAL,
    documentos_completos INTEGER DEFAULT 0,
    aprobado_por INTEGER,
    fecha_aprobacion TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS onboarding_documento (
    id SERIAL PRIMARY KEY,
    onboarding_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    nombre_archivo TEXT,
    ruta_archivo TEXT,
    estado TEXT DEFAULT 'pending',
    verificado_por INTEGER,
    fecha_verificacion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (onboarding_id) REFERENCES onboarding_proveedor(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_onboarding_estado ON onboarding_proveedor(estado);
CREATE INDEX IF NOT EXISTS idx_onboarding_cuit ON onboarding_proveedor(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_onboarding_doc_onb ON onboarding_documento(onboarding_id);

-- MIGRATION 075: Price Management
CREATE TABLE IF NOT EXISTS precio_lista (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    proveedor_cuit TEXT,
    moneda TEXT DEFAULT 'ARS',
    fecha_vigencia_desde DATE,
    fecha_vigencia_hasta DATE,
    estado TEXT DEFAULT 'draft',
    notas TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS precio_lista_item (
    id SERIAL PRIMARY KEY,
    lista_id INTEGER REFERENCES precio_lista(id) ON DELETE CASCADE,
    material_codigo TEXT NOT NULL,
    precio_unitario REAL NOT NULL,
    unidad TEXT,
    cantidad_minima INTEGER DEFAULT 1,
    cantidad_maxima INTEGER,
    descuento_pct REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lista_id, material_codigo, cantidad_minima)
);
CREATE TABLE IF NOT EXISTS precio_negociacion (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT NOT NULL,
    proveedor_cuit TEXT,
    precio_anterior REAL,
    precio_nuevo REAL NOT NULL,
    descuento_negociado_pct REAL DEFAULT 0,
    negociado_por INTEGER,
    fecha DATE,
    notas TEXT,
    estado TEXT DEFAULT 'pending',
    aprobado_por INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_precio_lista_proveedor ON precio_lista(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_precio_lista_estado ON precio_lista(estado);
CREATE INDEX IF NOT EXISTS idx_precio_lista_item_lista ON precio_lista_item(lista_id);
CREATE INDEX IF NOT EXISTS idx_precio_lista_item_material ON precio_lista_item(material_codigo);
CREATE INDEX IF NOT EXISTS idx_precio_negociacion_material ON precio_negociacion(material_codigo);
CREATE INDEX IF NOT EXISTS idx_precio_negociacion_estado ON precio_negociacion(estado);

-- MIGRATION 076: Supplier Finance
CREATE TABLE IF NOT EXISTS financiamiento_proveedor (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    proveedor_cuit TEXT NOT NULL,
    factura_id INTEGER,
    monto_original REAL NOT NULL,
    monto_financiado REAL,
    tasa_descuento REAL DEFAULT 0,
    fecha_vencimiento DATE,
    estado TEXT DEFAULT 'pending',
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_proveedor_cuit ON financiamiento_proveedor(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_fin_estado ON financiamiento_proveedor(estado);

-- MIGRATION 077: Spend Analytics
CREATE TABLE IF NOT EXISTS spend_registro (
    id SERIAL PRIMARY KEY,
    periodo TEXT NOT NULL,
    proveedor_cuit TEXT,
    categoria TEXT,
    material_codigo TEXT,
    centro TEXT,
    monto REAL NOT NULL,
    moneda TEXT DEFAULT 'ARS',
    tipo_gasto TEXT,
    fuente TEXT DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS spend_presupuesto (
    id SERIAL PRIMARY KEY,
    periodo TEXT NOT NULL,
    categoria TEXT,
    centro TEXT,
    monto_presupuestado REAL NOT NULL,
    monto_ejecutado REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_spend_registro_periodo ON spend_registro(periodo);
CREATE INDEX IF NOT EXISTS idx_spend_registro_proveedor ON spend_registro(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_spend_registro_categoria ON spend_registro(categoria);
CREATE INDEX IF NOT EXISTS idx_spend_presupuesto_periodo ON spend_presupuesto(periodo);

-- MIGRATION 079: Production Planning
CREATE TABLE IF NOT EXISTS plan_produccion (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    periodo_desde DATE,
    periodo_hasta DATE,
    estado TEXT DEFAULT 'draft',
    responsable_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plan_produccion_material (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES plan_produccion(id) ON DELETE CASCADE,
    material_codigo TEXT NOT NULL,
    work_center_id INTEGER,
    fecha_programada DATE,
    cantidad_planificada REAL NOT NULL,
    cantidad_producida REAL DEFAULT 0,
    prioridad TEXT DEFAULT 'media',
    estado TEXT DEFAULT 'pendiente',
    kit_bom_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plan_produccion_historial (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES plan_produccion(id) ON DELETE CASCADE,
    trabajo_centro_id INTEGER,
    fecha DATE NOT NULL,
    capacidad_disponible REAL,
    capacidad_utilizada REAL DEFAULT 0,
    capacidad_comprometida REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_estado ON plan_produccion(estado);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_responsable ON plan_produccion(responsable_id);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_material_plan ON plan_produccion_material(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_material_codigo ON plan_produccion_material(material_codigo);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_material_fecha ON plan_produccion_material(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_plan_produccion_material_estado ON plan_produccion_material(estado);

-- MIGRATION 080: Warranty & Claims
CREATE TABLE IF NOT EXISTS garantia (
    id SERIAL PRIMARY KEY,
    material_codigo TEXT,
    proveedor_cuit TEXT,
    lote_id INTEGER,
    orden_compra_id INTEGER,
    tipo TEXT DEFAULT 'standard',
    duracion_meses INTEGER NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    condiciones TEXT,
    estado TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS garantia_historial (
    id SERIAL PRIMARY KEY,
    garantia_id INTEGER REFERENCES garantia(id) ON DELETE SET NULL,
    tipo TEXT,
    descripcion TEXT NOT NULL,
    cantidad_afectada REAL,
    costo_estimado REAL,
    estado TEXT DEFAULT 'draft',
    resolucion TEXT,
    monto_recuperado REAL DEFAULT 0,
    responsable_id INTEGER,
    fecha_resolucion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS garantia_reclamo (
    id SERIAL PRIMARY KEY,
    garantia_historial_id INTEGER REFERENCES garantia_historial(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    path TEXT,
    tipo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_garantia_material ON garantia(material_codigo);
CREATE INDEX IF NOT EXISTS idx_garantia_proveedor ON garantia(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_garantia_estado ON garantia(estado);
CREATE INDEX IF NOT EXISTS idx_garantia_fecha_fin ON garantia(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_garantia_historial_garantia ON garantia_historial(garantia_id);
CREATE INDEX IF NOT EXISTS idx_garantia_reclamo_historial ON garantia_reclamo(garantia_historial_id);

-- MIGRATION 084: SAP Procurement Tables
CREATE TABLE IF NOT EXISTS sap_solpeds (
    id SERIAL PRIMARY KEY,
    solped_id TEXT NOT NULL,
    posicion TEXT,
    material_codigo TEXT,
    material_descripcion TEXT,
    centro TEXT,
    fecha_creacion TIMESTAMP,
    cantidad REAL,
    precio_unitario REAL,
    importe_total REAL,
    moneda TEXT DEFAULT 'USD',
    estrategia_liberacion TEXT,
    fecha_entrega_solicitada TIMESTAMP,
    creado_por TEXT,
    solicitante TEXT,
    UNIQUE(solped_id, posicion)
);
CREATE TABLE IF NOT EXISTS sap_purchase_orders (
    id SERIAL PRIMARY KEY,
    pedido_id TEXT NOT NULL,
    solped_id TEXT,
    solped_posicion TEXT,
    proveedor_cuit TEXT,
    proveedor_nombre TEXT,
    centro TEXT,
    material_codigo TEXT,
    cantidad_pedida REAL,
    cantidad_recepcionada REAL,
    valor_pedido REAL,
    valor_recibido REAL,
    fecha_pedido TIMESTAMP,
    fecha_recepcion TIMESTAMP,
    moneda_pedido TEXT DEFAULT 'USD'
);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_solped_id ON sap_solpeds(solped_id);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_material ON sap_solpeds(material_codigo);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_centro ON sap_solpeds(centro);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_fecha ON sap_solpeds(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_sap_po_pedido_id ON sap_purchase_orders(pedido_id);
CREATE INDEX IF NOT EXISTS idx_sap_po_solped ON sap_purchase_orders(solped_id, solped_posicion);
CREATE INDEX IF NOT EXISTS idx_sap_po_proveedor ON sap_purchase_orders(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_sap_po_fecha_pedido ON sap_purchase_orders(fecha_pedido);

-- Also create the v_sap_pipeline view if not exists
CREATE OR REPLACE VIEW v_sap_pipeline AS
SELECT
    s.solped_id,
    s.posicion,
    s.material_codigo,
    s.material_descripcion,
    s.centro,
    s.fecha_creacion,
    s.cantidad,
    s.precio_unitario,
    s.importe_total,
    s.moneda,
    s.estrategia_liberacion,
    s.fecha_entrega_solicitada,
    po.pedido_id,
    po.proveedor_cuit,
    po.proveedor_nombre,
    po.cantidad_pedida,
    po.cantidad_recepcionada,
    po.valor_pedido,
    po.fecha_pedido,
    po.fecha_recepcion,
    CASE
        WHEN po.pedido_id IS NOT NULL AND po.cantidad_recepcionada >= po.cantidad_pedida THEN 'received'
        WHEN po.pedido_id IS NOT NULL THEN 'ordered'
        WHEN s.estrategia_liberacion IS NOT NULL THEN 'pending_release'
        ELSE 'requested'
    END as pipeline_status
FROM sap_solpeds s
LEFT JOIN sap_purchase_orders po ON s.solped_id = po.solped_id AND s.posicion = po.solped_posicion;

-- Done!
SELECT 'All tables created successfully' as status;
