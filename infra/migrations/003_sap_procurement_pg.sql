-- Migration 003: SAP Procurement Data (ZM65) - PostgreSQL Version
-- Fecha: 2026-01-09
-- Proposito: Importar datos de requisiciones SAP (SOLPED) y ordenes de compra

-- ============================================================================
-- TABLAS PARA DATOS SAP DE PROCUREMENT
-- ============================================================================

-- Requisiciones SAP (SOLPED) - datos importados de ZM65.xlsx
CREATE TABLE IF NOT EXISTS sap_solpeds (
    id SERIAL PRIMARY KEY,
    solped_id INTEGER NOT NULL,
    posicion INTEGER NOT NULL,
    clase_solped TEXT,
    material_codigo TEXT NOT NULL,
    material_descripcion TEXT,
    grupo_articulos INTEGER,
    cantidad REAL NOT NULL,
    precio_unitario REAL,
    importe_total REAL,
    moneda TEXT DEFAULT 'ARP',
    unidad_medida TEXT DEFAULT 'UN',
    fecha_creacion DATE NOT NULL,
    fecha_entrega_solicitada DATE,
    estrategia_liberacion TEXT,
    fecha_liberacion DATE,
    centro INTEGER NOT NULL,
    grupo_compras TEXT,
    creado_por TEXT,
    solicitante TEXT,
    numero_necesidad TEXT,
    tipo_imputacion TEXT,
    centro_costos TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    import_hash TEXT,
    import_batch TEXT,
    UNIQUE(solped_id, posicion)
);

-- Indices para sap_solpeds
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_material ON sap_solpeds(material_codigo);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_centro ON sap_solpeds(centro);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_fecha ON sap_solpeds(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_estado ON sap_solpeds(estrategia_liberacion);
CREATE INDEX IF NOT EXISTS idx_sap_solpeds_hash ON sap_solpeds(import_hash);

-- Ordenes de compra SAP (Pedidos) - datos importados de ZM65.xlsx
CREATE TABLE IF NOT EXISTS sap_purchase_orders (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    posicion INTEGER,
    clase_pedido TEXT,
    solped_id INTEGER,
    solped_posicion INTEGER,
    material_codigo TEXT NOT NULL,
    cantidad_pedida REAL,
    cantidad_recepcionada REAL DEFAULT 0,
    unidad_medida TEXT DEFAULT 'UN',
    unidad_medida_recepcion TEXT,
    valor_pedido REAL,
    valor_recibido REAL DEFAULT 0,
    valor_facturado REAL DEFAULT 0,
    moneda_pedido TEXT DEFAULT 'ARP',
    moneda_factura TEXT,
    fecha_pedido DATE,
    fecha_entrega_prevista DATE,
    fecha_recepcion DATE,
    estrategia_liberacion TEXT,
    fecha_liberacion DATE,
    proveedor_cuit TEXT,
    proveedor_nombre TEXT,
    contrato_marco TEXT,
    contrato_marco_posicion TEXT,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    import_hash TEXT,
    import_batch TEXT
);

-- Indice unico para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_sap_po_unique
ON sap_purchase_orders(pedido_id, posicion, solped_id, solped_posicion);

-- Indices para sap_purchase_orders
CREATE INDEX IF NOT EXISTS idx_sap_po_material ON sap_purchase_orders(material_codigo);
CREATE INDEX IF NOT EXISTS idx_sap_po_proveedor ON sap_purchase_orders(proveedor_cuit);
CREATE INDEX IF NOT EXISTS idx_sap_po_fecha ON sap_purchase_orders(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_sap_po_solped ON sap_purchase_orders(solped_id, solped_posicion);
CREATE INDEX IF NOT EXISTS idx_sap_po_hash ON sap_purchase_orders(import_hash);

-- Log de importaciones
CREATE TABLE IF NOT EXISTS sap_import_log (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    import_type TEXT NOT NULL,
    records_total INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_error INTEGER DEFAULT 0,
    status TEXT DEFAULT 'started',
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    user_id TEXT
);

-- ============================================================================
-- VISTAS PARA KPIs
-- ============================================================================

-- Vista: Lead Times (tiempos de ciclo)
DROP VIEW IF EXISTS v_sap_lead_times;
CREATE VIEW v_sap_lead_times AS
SELECT
    s.material_codigo,
    s.material_descripcion,
    p.proveedor_nombre,
    s.centro,
    s.solped_id,
    s.posicion as solped_posicion,
    p.pedido_id,
    s.fecha_creacion as fecha_solicitud,
    p.fecha_pedido,
    p.fecha_recepcion,
    s.fecha_entrega_solicitada,
    (p.fecha_pedido - s.fecha_creacion) as dias_aprobacion,
    (p.fecha_recepcion - p.fecha_pedido) as dias_entrega,
    (p.fecha_recepcion - s.fecha_creacion) as dias_total,
    (p.fecha_recepcion - s.fecha_entrega_solicitada) as dias_desviacion,
    s.cantidad,
    s.precio_unitario,
    s.importe_total,
    s.moneda
FROM sap_solpeds s
INNER JOIN sap_purchase_orders p
    ON s.solped_id = p.solped_id
    AND s.posicion = p.solped_posicion
WHERE p.fecha_recepcion IS NOT NULL
  AND p.fecha_pedido IS NOT NULL;

-- Vista: Cumplimiento de entregas por proveedor (OTIF)
DROP VIEW IF EXISTS v_sap_cumplimiento;
CREATE VIEW v_sap_cumplimiento AS
SELECT
    p.proveedor_cuit,
    p.proveedor_nombre,
    COUNT(*) as total_pedidos,
    SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) as entregas_a_tiempo,
    SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) as entregas_completas,
    SUM(CASE
        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
         AND p.cantidad_recepcionada >= p.cantidad_pedida
        THEN 1 ELSE 0
    END) as otif_count,
    ROUND(100.0 * SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_a_tiempo,
    ROUND(100.0 * SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_completas,
    ROUND(100.0 * SUM(CASE
        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
         AND p.cantidad_recepcionada >= p.cantidad_pedida
        THEN 1 ELSE 0
    END) / COUNT(*), 1) as pct_otif,
    SUM(p.valor_pedido) as valor_total_pedido,
    SUM(p.valor_recibido) as valor_total_recibido
FROM sap_purchase_orders p
INNER JOIN sap_solpeds s
    ON p.solped_id = s.solped_id
    AND p.solped_posicion = s.posicion
WHERE p.fecha_recepcion IS NOT NULL
GROUP BY p.proveedor_cuit, p.proveedor_nombre;

-- Vista: Analisis de costos por material/proveedor
DROP VIEW IF EXISTS v_sap_analisis_costos;
CREATE VIEW v_sap_analisis_costos AS
SELECT
    s.material_codigo,
    s.material_descripcion,
    p.proveedor_cuit,
    p.proveedor_nombre,
    s.moneda,
    AVG(s.precio_unitario) as precio_promedio,
    MIN(s.precio_unitario) as precio_minimo,
    MAX(s.precio_unitario) as precio_maximo,
    CASE
        WHEN AVG(s.precio_unitario) > 0
        THEN ROUND(((MAX(s.precio_unitario) - MIN(s.precio_unitario)) / AVG(s.precio_unitario) * 100)::NUMERIC, 2)
        ELSE 0
    END as variacion_pct,
    SUM(s.cantidad) as cantidad_total,
    SUM(s.importe_total) as importe_total,
    COUNT(*) as num_transacciones,
    MIN(s.fecha_creacion) as primera_transaccion,
    MAX(s.fecha_creacion) as ultima_transaccion
FROM sap_solpeds s
LEFT JOIN sap_purchase_orders p
    ON s.solped_id = p.solped_id
    AND s.posicion = p.solped_posicion
GROUP BY s.material_codigo, s.material_descripcion, p.proveedor_cuit, p.proveedor_nombre, s.moneda;

-- Vista: Resumen por centro
DROP VIEW IF EXISTS v_sap_resumen_centro;
CREATE VIEW v_sap_resumen_centro AS
SELECT
    s.centro,
    COUNT(DISTINCT s.solped_id) as total_solpeds,
    COUNT(*) as total_items,
    COUNT(DISTINCT s.material_codigo) as materiales_unicos,
    COUNT(DISTINCT p.proveedor_cuit) as proveedores_unicos,
    SUM(CASE WHEN s.estrategia_liberacion = 'LIBERADA' THEN 1 ELSE 0 END) as solpeds_liberadas,
    SUM(CASE WHEN p.fecha_recepcion IS NOT NULL THEN 1 ELSE 0 END) as items_recibidos,
    SUM(s.importe_total) as importe_total,
    AVG(p.fecha_recepcion - s.fecha_creacion) as lead_time_promedio
FROM sap_solpeds s
LEFT JOIN sap_purchase_orders p
    ON s.solped_id = p.solped_id
    AND s.posicion = p.solped_posicion
GROUP BY s.centro;

-- Vista: Pipeline de solicitudes (embudo de conversion)
DROP VIEW IF EXISTS v_sap_pipeline;
CREATE VIEW v_sap_pipeline AS
SELECT
    'Total Solpeds' as etapa,
    1 as orden,
    COUNT(*) as cantidad,
    100.0 as porcentaje
FROM sap_solpeds

UNION ALL

SELECT
    'Con Pedido' as etapa,
    2 as orden,
    COUNT(*) as cantidad,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM sap_solpeds), 1) as porcentaje
FROM sap_solpeds s
WHERE EXISTS (SELECT 1 FROM sap_purchase_orders p WHERE p.solped_id = s.solped_id AND p.solped_posicion = s.posicion)

UNION ALL

SELECT
    'Recibidos' as etapa,
    3 as orden,
    COUNT(*) as cantidad,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM sap_solpeds), 1) as porcentaje
FROM sap_purchase_orders
WHERE fecha_recepcion IS NOT NULL

UNION ALL

SELECT
    'Facturados' as etapa,
    4 as orden,
    COUNT(*) as cantidad,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM sap_solpeds), 1) as porcentaje
FROM sap_purchase_orders
WHERE valor_facturado > 0

ORDER BY orden;

-- Registrar migracion
INSERT INTO schema_migrations (version, applied_at)
VALUES (3, NOW())
ON CONFLICT DO NOTHING;
