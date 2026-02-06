-- Migration 003: SAP Procurement Data (ZM65)
-- Fecha: 2026-01-09
-- Proposito: Importar datos de requisiciones SAP (SOLPED) y ordenes de compra

-- ============================================================================
-- TABLAS PARA DATOS SAP DE PROCUREMENT
-- ============================================================================

-- Requisiciones SAP (SOLPED) - datos importados de ZM65.xlsx
CREATE TABLE IF NOT EXISTS sap_solpeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solped_id INTEGER NOT NULL,               -- ID SAP de la requisicion (22612461, etc.)
    posicion INTEGER NOT NULL,                -- Posicion dentro de la requisicion (10, 20, 30...)
    clase_solped TEXT,                        -- NB, ZUB, ZDNB
    material_codigo TEXT NOT NULL,            -- Codigo SAP del material
    material_descripcion TEXT,                -- Texto breve del material
    grupo_articulos INTEGER,                  -- Grupo de articulos SAP
    cantidad REAL NOT NULL,                   -- Cantidad solicitada
    precio_unitario REAL,                     -- Precio unitario
    importe_total REAL,                       -- Importe total de la posicion
    moneda TEXT DEFAULT 'ARP',                -- ARP, USD, EUR
    unidad_medida TEXT DEFAULT 'UN',          -- Unidad de medida
    fecha_creacion DATE NOT NULL,             -- Fecha creacion solped
    fecha_entrega_solicitada DATE,            -- Fecha entrega requerida
    estrategia_liberacion TEXT,               -- LIBERADA, NO LIBERAD, S/ EST.LIB, EN PROC.LI
    fecha_liberacion DATE,                    -- Fecha de liberacion
    centro INTEGER NOT NULL,                  -- Centro SAP (1008, 1019, etc.)
    grupo_compras TEXT,                       -- Grupo de compras (144, 145, etc.)
    creado_por TEXT,                          -- Usuario que creo
    solicitante TEXT,                         -- Solicitante de la requisicion
    numero_necesidad TEXT,                    -- Numero de necesidad
    tipo_imputacion TEXT,                     -- Tipo de imputacion
    centro_costos TEXT,                       -- Centro de costos
    -- Auditoria de importacion
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    import_hash TEXT,                         -- Hash MD5 para deteccion incremental
    import_batch TEXT,                        -- Identificador del lote de importacion
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,               -- ID SAP del pedido
    posicion INTEGER,                         -- Posicion del pedido
    clase_pedido TEXT,                        -- Clase de pedido
    solped_id INTEGER,                        -- FK a sap_solpeds.solped_id
    solped_posicion INTEGER,                  -- Posicion de la solped asociada
    material_codigo TEXT NOT NULL,            -- Codigo SAP del material
    cantidad_pedida REAL,                     -- Cantidad pedida
    cantidad_recepcionada REAL DEFAULT 0,     -- Cantidad recibida
    unidad_medida TEXT DEFAULT 'UN',          -- Unidad de medida pedido
    unidad_medida_recepcion TEXT,             -- UM de recepcion
    valor_pedido REAL,                        -- Valor total del pedido
    valor_recibido REAL DEFAULT 0,            -- Valor recibido
    valor_facturado REAL DEFAULT 0,           -- Valor facturado por proveedor
    moneda_pedido TEXT DEFAULT 'ARP',         -- Moneda del pedido
    moneda_factura TEXT,                      -- Moneda de factura
    fecha_pedido DATE,                        -- Fecha del pedido
    fecha_entrega_prevista DATE,              -- Fecha de entrega esperada
    fecha_recepcion DATE,                     -- Fecha real de recepcion
    estrategia_liberacion TEXT,               -- Estado de liberacion
    fecha_liberacion DATE,                    -- Fecha de liberacion
    -- Proveedor
    proveedor_cuit TEXT,                      -- CUIT del proveedor
    proveedor_nombre TEXT,                    -- Nombre del proveedor
    contrato_marco TEXT,                      -- ID del contrato marco
    contrato_marco_posicion TEXT,             -- Posicion del contrato marco
    -- Auditoria
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    import_hash TEXT,
    import_batch TEXT
);

-- Indice unico para evitar duplicados (usando los campos directamente)
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,                   -- Nombre del archivo importado
    import_type TEXT NOT NULL,                -- 'ZM65', 'STOCK', etc.
    records_total INTEGER DEFAULT 0,          -- Total de registros en archivo
    records_inserted INTEGER DEFAULT 0,       -- Registros insertados
    records_updated INTEGER DEFAULT 0,        -- Registros actualizados
    records_skipped INTEGER DEFAULT 0,        -- Registros sin cambios
    records_error INTEGER DEFAULT 0,          -- Registros con error
    status TEXT DEFAULT 'started',            -- started, completed, failed
    error_message TEXT,                       -- Mensaje de error si fallo
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    user_id TEXT                              -- Usuario que ejecuto la importacion
);

-- ============================================================================
-- VISTAS PARA KPIs
-- ============================================================================

-- Vista: Lead Times (tiempos de ciclo)
CREATE VIEW IF NOT EXISTS v_sap_lead_times AS
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
    -- Tiempo solicitud -> pedido (dias de aprobacion)
    CAST(julianday(p.fecha_pedido) - julianday(s.fecha_creacion) AS INTEGER) as dias_aprobacion,
    -- Tiempo pedido -> recepcion (dias de entrega)
    CAST(julianday(p.fecha_recepcion) - julianday(p.fecha_pedido) AS INTEGER) as dias_entrega,
    -- Tiempo total (solicitud -> recepcion)
    CAST(julianday(p.fecha_recepcion) - julianday(s.fecha_creacion) AS INTEGER) as dias_total,
    -- Desviacion vs fecha solicitada (negativo = anticipado, positivo = atrasado)
    CAST(julianday(p.fecha_recepcion) - julianday(s.fecha_entrega_solicitada) AS INTEGER) as dias_desviacion,
    -- Montos
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
CREATE VIEW IF NOT EXISTS v_sap_cumplimiento AS
SELECT
    p.proveedor_cuit,
    p.proveedor_nombre,
    COUNT(*) as total_pedidos,
    -- Entregas a tiempo
    SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) as entregas_a_tiempo,
    -- Entregas completas (cantidad recibida >= cantidad pedida)
    SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) as entregas_completas,
    -- OTIF (On Time In Full) - a tiempo Y completas
    SUM(CASE
        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
         AND p.cantidad_recepcionada >= p.cantidad_pedida
        THEN 1 ELSE 0
    END) as otif_count,
    -- Porcentajes
    ROUND(100.0 * SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_a_tiempo,
    ROUND(100.0 * SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_completas,
    ROUND(100.0 * SUM(CASE
        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
         AND p.cantidad_recepcionada >= p.cantidad_pedida
        THEN 1 ELSE 0
    END) / COUNT(*), 1) as pct_otif,
    -- Valores
    SUM(p.valor_pedido) as valor_total_pedido,
    SUM(p.valor_recibido) as valor_total_recibido
FROM sap_purchase_orders p
INNER JOIN sap_solpeds s
    ON p.solped_id = s.solped_id
    AND p.solped_posicion = s.posicion
WHERE p.fecha_recepcion IS NOT NULL
GROUP BY p.proveedor_cuit, p.proveedor_nombre;

-- Vista: Analisis de costos por material/proveedor
CREATE VIEW IF NOT EXISTS v_sap_analisis_costos AS
SELECT
    s.material_codigo,
    s.material_descripcion,
    p.proveedor_cuit,
    p.proveedor_nombre,
    s.moneda,
    -- Precios
    AVG(s.precio_unitario) as precio_promedio,
    MIN(s.precio_unitario) as precio_minimo,
    MAX(s.precio_unitario) as precio_maximo,
    -- Variacion porcentual
    CASE
        WHEN AVG(s.precio_unitario) > 0
        THEN ROUND((MAX(s.precio_unitario) - MIN(s.precio_unitario)) / AVG(s.precio_unitario) * 100, 2)
        ELSE 0
    END as variacion_pct,
    -- Volumenes
    SUM(s.cantidad) as cantidad_total,
    SUM(s.importe_total) as importe_total,
    COUNT(*) as num_transacciones,
    -- Fechas
    MIN(s.fecha_creacion) as primera_transaccion,
    MAX(s.fecha_creacion) as ultima_transaccion
FROM sap_solpeds s
LEFT JOIN sap_purchase_orders p
    ON s.solped_id = p.solped_id
    AND s.posicion = p.solped_posicion
GROUP BY s.material_codigo, s.material_descripcion, p.proveedor_cuit, p.proveedor_nombre, s.moneda;

-- Vista: Resumen por centro
CREATE VIEW IF NOT EXISTS v_sap_resumen_centro AS
SELECT
    s.centro,
    COUNT(DISTINCT s.solped_id) as total_solpeds,
    COUNT(*) as total_items,
    COUNT(DISTINCT s.material_codigo) as materiales_unicos,
    COUNT(DISTINCT p.proveedor_cuit) as proveedores_unicos,
    SUM(CASE WHEN s.estrategia_liberacion = 'LIBERADA' THEN 1 ELSE 0 END) as solpeds_liberadas,
    SUM(CASE WHEN p.fecha_recepcion IS NOT NULL THEN 1 ELSE 0 END) as items_recibidos,
    SUM(s.importe_total) as importe_total,
    AVG(CAST(julianday(p.fecha_recepcion) - julianday(s.fecha_creacion) AS INTEGER)) as lead_time_promedio
FROM sap_solpeds s
LEFT JOIN sap_purchase_orders p
    ON s.solped_id = p.solped_id
    AND s.posicion = p.solped_posicion
GROUP BY s.centro;

-- Vista: Pipeline de solicitudes (embudo de conversion)
CREATE VIEW IF NOT EXISTS v_sap_pipeline AS
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

-- ============================================================================
-- AGREGAR COLUMNAS A proveedor_precios_negociados SI NO EXISTEN
-- ============================================================================

-- Nota: SQLite no soporta ADD COLUMN IF NOT EXISTS directamente
-- Estas columnas se agregan via el script de importacion si no existen

-- Registrar migracion
INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (3, datetime('now'));
