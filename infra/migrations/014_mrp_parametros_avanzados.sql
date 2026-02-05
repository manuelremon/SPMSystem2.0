-- Migration 014: Parámetros MRP Avanzados - Sistema de Parametrización
-- Fecha: 2026-02-02
-- Propósito: Agregar campos avanzados de MRP a sap_materiales_bbdd para cálculo
--            automático de parámetros (SS, ROP, EOQ, Stock Máximo, Coberturas)

-- ============================================================================
-- TABLA PRINCIPAL: Agregar campos MRP avanzados a sap_materiales_bbdd
-- ============================================================================

-- Parámetros de entrada (suministrados por usuario/Excel)
ALTER TABLE sap_materiales_bbdd
ADD COLUMN IF NOT EXISTS lead_time_dias INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS desv_std_demanda_diaria DECIMAL(10,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS desv_std_lead_time DECIMAL(10,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS costo_unitario DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS costo_por_pedido DECIMAL(10,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS tasa_mantenimiento DECIMAL(5,4) DEFAULT 0.2000,
ADD COLUMN IF NOT EXISTS nivel_servicio DECIMAL(5,4) DEFAULT 0.9500,
ADD COLUMN IF NOT EXISTS dias_laborables_año INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS cantidad_minima_pedido INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS cantidad_maxima_pedido INTEGER,
ADD COLUMN IF NOT EXISTS multiplo_pedido INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS categoria_abc VARCHAR(1),
ADD COLUMN IF NOT EXISTS critico BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metodo_reposicion VARCHAR(20) DEFAULT 'mrp',

-- Parámetros calculados (generados automáticamente)
ADD COLUMN IF NOT EXISTS demanda_anual DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS demanda_diaria DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS factor_z DECIMAL(5,3),
ADD COLUMN IF NOT EXISTS cantidad_pedido_eoq INTEGER,
ADD COLUMN IF NOT EXISTS cobertura_ss_dias DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS cobertura_eoq_dias DECIMAL(8,2),
ADD COLUMN IF NOT EXISTS pedidos_anuales DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS costo_total_anual DECIMAL(12,2),

-- Auditoría
ADD COLUMN IF NOT EXISTS parametros_calculados_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS parametros_calculados_por VARCHAR(50),
ADD COLUMN IF NOT EXISTS ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- ÍNDICES PARA CONSULTAS FRECUENTES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_materiales_mrp_centro_almacen
    ON sap_materiales_bbdd(centro, almacen);

CREATE INDEX IF NOT EXISTS idx_materiales_mrp_categoria
    ON sap_materiales_bbdd(categoria_abc);

CREATE INDEX IF NOT EXISTS idx_materiales_mrp_critico
    ON sap_materiales_bbdd(critico) WHERE critico = TRUE;

CREATE INDEX IF NOT EXISTS idx_materiales_mrp_metodo
    ON sap_materiales_bbdd(metodo_reposicion);

CREATE INDEX IF NOT EXISTS idx_materiales_mrp_fecha_calculo
    ON sap_materiales_bbdd(parametros_calculados_at DESC);

-- ============================================================================
-- COMENTARIOS (DOCUMENTACIÓN)
-- ============================================================================

COMMENT ON COLUMN sap_materiales_bbdd.lead_time_dias
    IS 'Tiempo de entrega del proveedor en días (input)';

COMMENT ON COLUMN sap_materiales_bbdd.desv_std_demanda_diaria
    IS 'Desviación estándar de la demanda diaria (input)';

COMMENT ON COLUMN sap_materiales_bbdd.desv_std_lead_time
    IS 'Desviación estándar del lead time en días (input)';

COMMENT ON COLUMN sap_materiales_bbdd.costo_unitario
    IS 'Precio unitario del material en USD (input)';

COMMENT ON COLUMN sap_materiales_bbdd.costo_por_pedido
    IS 'Costo administrativo por orden de compra en USD (input)';

COMMENT ON COLUMN sap_materiales_bbdd.tasa_mantenimiento
    IS 'Tasa de costo de mantenimiento anual (% sobre valor) (input)';

COMMENT ON COLUMN sap_materiales_bbdd.nivel_servicio
    IS 'Nivel de servicio deseado: 0.90-0.995 (input)';

COMMENT ON COLUMN sap_materiales_bbdd.dias_laborables_año
    IS 'Días operativos al año para cálculo de demanda diaria (input)';

COMMENT ON COLUMN sap_materiales_bbdd.cantidad_minima_pedido
    IS 'Cantidad mínima de compra requerida (input)';

COMMENT ON COLUMN sap_materiales_bbdd.cantidad_maxima_pedido
    IS 'Cantidad máxima de compra permitida, NULL sin límite (input)';

COMMENT ON COLUMN sap_materiales_bbdd.multiplo_pedido
    IS 'Múltiplo de compra (ej: cajas de 100) (input)';

COMMENT ON COLUMN sap_materiales_bbdd.categoria_abc
    IS 'Clasificación ABC: A (70-80% valor), B (15-20%), C (5-10%) (input)';

COMMENT ON COLUMN sap_materiales_bbdd.critico
    IS 'Repuesto crítico: obliga nivel servicio 99%+ (input)';

COMMENT ON COLUMN sap_materiales_bbdd.metodo_reposicion
    IS 'Método de reposición: mrp, punto_reorden, manual (input)';

COMMENT ON COLUMN sap_materiales_bbdd.demanda_anual
    IS 'Demanda estimada anual en unidades (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.demanda_diaria
    IS 'd = Demanda Anual / días_laborables_año (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.factor_z
    IS 'Factor de servicio: 0.90→1.28, 0.95→1.65, 0.99→2.33, 0.995→2.58 (output)';

COMMENT ON COLUMN sap_materiales_bbdd.cantidad_pedido_eoq
    IS 'EOQ = √(2×D×S/H) con restricciones aplicadas (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.cobertura_ss_dias
    IS 'Días de cobertura del stock de seguridad = SS/d (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.cobertura_eoq_dias
    IS 'Días de cobertura de lote = EOQ/d (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.pedidos_anuales
    IS 'Número de pedidos anuales = D/EOQ (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.costo_total_anual
    IS 'Costo total = (D/EOQ)×S + (EOQ/2)×H (output calculado)';

COMMENT ON COLUMN sap_materiales_bbdd.parametros_calculados_at
    IS 'Timestamp de último cálculo de parámetros (auditoría)';

COMMENT ON COLUMN sap_materiales_bbdd.parametros_calculados_por
    IS 'Usuario que realizó el último cálculo (auditoría)';

-- ============================================================================
-- VISTA: Materiales sin parámetros calculados (para revisión)
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_sin_parametros CASCADE;
CREATE VIEW v_mrp_sin_parametros AS
SELECT
    id,
    codigo_material,
    centro,
    almacen,
    descripcion,
    categoria_abc,
    critico,
    demanda_anual,
    lead_time_dias,
    parametros_calculados_at
FROM sap_materiales_bbdd
WHERE parametros_calculados_at IS NULL
  OR demanda_anual IS NULL
ORDER BY codigo_material;

-- ============================================================================
-- VISTA: Resumen de parámetros calculados
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_parametros_resumido CASCADE;
CREATE VIEW v_mrp_parametros_resumido AS
SELECT
    codigo_material,
    centro,
    almacen,
    categoria_abc,
    critico,
    demanda_anual,
    demanda_diaria,
    stock_de_seguridad as ss,
    punto_de_pedido as rop,
    stock_maximo,
    cantidad_pedido_eoq,
    cobertura_ss_dias,
    cobertura_eoq_dias,
    pedidos_anuales,
    costo_total_anual,
    nivel_servicio,
    lead_time_dias,
    metodo_reposicion,
    parametros_calculados_at,
    parametros_calculados_por,
    ROUND(100.0 * (CURRENT_DATE - DATE(parametros_calculados_at)) / 365, 1) as dias_desde_calculo
FROM sap_materiales_bbdd
WHERE parametros_calculados_at IS NOT NULL
ORDER BY codigo_material;

-- ============================================================================
-- VISTA: Materiales críticos con análisis de servicio
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_criticos CASCADE;
CREATE VIEW v_mrp_criticos AS
SELECT
    codigo_material,
    centro,
    almacen,
    descripcion,
    stock_de_seguridad as ss,
    punto_de_pedido as rop,
    stock_maximo,
    demanda_anual,
    lead_time_dias,
    nivel_servicio,
    factor_z,
    cobertura_ss_dias,
    CASE
        WHEN nivel_servicio >= 0.99 THEN 'Excelente'
        WHEN nivel_servicio >= 0.95 THEN 'Bueno'
        WHEN nivel_servicio >= 0.90 THEN 'Aceptable'
        ELSE 'Revisar'
    END as evaluacion_servicio,
    parametros_calculados_at
FROM sap_materiales_bbdd
WHERE critico = TRUE
ORDER BY codigo_material;

-- Registrar migración
INSERT INTO schema_migrations (version, applied_at)
VALUES (14, NOW())
ON CONFLICT DO NOTHING;
