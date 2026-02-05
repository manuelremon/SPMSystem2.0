-- Migration 016: Historial de Parámetros MRP
-- Fecha: 2026-02-02
-- Propósito: Tabla de auditoría para tracking de cambios en parámetros MRP

-- ============================================================================
-- TABLA: Historial de cambios de parámetros MRP
-- ============================================================================

CREATE TABLE IF NOT EXISTS mrp_historial_parametros (
    id SERIAL PRIMARY KEY,
    material_codigo VARCHAR(50) NOT NULL,
    centro VARCHAR(20) NOT NULL,
    almacen VARCHAR(20) NOT NULL,
    campo_modificado VARCHAR(50) NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    modificado_por VARCHAR(50),
    modificado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT
);

-- ============================================================================
-- ÍNDICES PARA CONSULTAS RÁPIDAS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mrp_historial_material
    ON mrp_historial_parametros(material_codigo, centro);

CREATE INDEX IF NOT EXISTS idx_mrp_historial_fecha
    ON mrp_historial_parametros(modificado_at DESC);

CREATE INDEX IF NOT EXISTS idx_mrp_historial_usuario
    ON mrp_historial_parametros(modificado_por);

CREATE INDEX IF NOT EXISTS idx_mrp_historial_campo
    ON mrp_historial_parametros(campo_modificado);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE mrp_historial_parametros
    IS 'Almacena un registro de cada modificación de parámetros MRP para auditoría y trazabilidad';

COMMENT ON COLUMN mrp_historial_parametros.material_codigo
    IS 'Código SAP del material modificado';

COMMENT ON COLUMN mrp_historial_parametros.centro
    IS 'Centro de costo del material';

COMMENT ON COLUMN mrp_historial_parametros.almacen
    IS 'Almacén del material';

COMMENT ON COLUMN mrp_historial_parametros.campo_modificado
    IS 'Nombre del campo que fue modificado (ej: stock_seguridad, punto_pedido)';

COMMENT ON COLUMN mrp_historial_parametros.valor_anterior
    IS 'Valor anterior al cambio (serializado a texto)';

COMMENT ON COLUMN mrp_historial_parametros.valor_nuevo
    IS 'Valor nuevo después del cambio (serializado a texto)';

COMMENT ON COLUMN mrp_historial_parametros.modificado_por
    IS 'ID del usuario que realizó el cambio';

COMMENT ON COLUMN mrp_historial_parametros.modificado_at
    IS 'Timestamp exacto del cambio';

COMMENT ON COLUMN mrp_historial_parametros.observaciones
    IS 'Notas adicionales sobre el cambio (opcional)';

-- ============================================================================
-- VISTA: Cambios recientes de parámetros
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_cambios_recientes CASCADE;
CREATE VIEW v_mrp_cambios_recientes AS
SELECT
    material_codigo,
    centro,
    almacen,
    campo_modificado,
    valor_anterior,
    valor_nuevo,
    modificado_por,
    modificado_at,
    ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - modificado_at)) / 86400)::NUMERIC, 1) as dias_atras
FROM mrp_historial_parametros
ORDER BY modificado_at DESC
LIMIT 1000;

-- ============================================================================
-- VISTA: Resumen de cambios por usuario
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_cambios_por_usuario CASCADE;
CREATE VIEW v_mrp_cambios_por_usuario AS
SELECT
    modificado_por,
    COUNT(*) as total_cambios,
    COUNT(DISTINCT material_codigo) as materiales_modificados,
    COUNT(DISTINCT campo_modificado) as campos_distintos,
    MIN(modificado_at) as primer_cambio,
    MAX(modificado_at) as ultimo_cambio
FROM mrp_historial_parametros
WHERE modificado_por IS NOT NULL
GROUP BY modificado_por
ORDER BY total_cambios DESC;

-- ============================================================================
-- VISTA: Auditoría de campo específico
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_auditoria_campo CASCADE;
CREATE VIEW v_mrp_auditoria_campo AS
SELECT
    campo_modificado,
    COUNT(*) as total_cambios,
    COUNT(DISTINCT material_codigo) as materiales_afectados,
    COUNT(DISTINCT centro) as centros_afectados,
    MIN(modificado_at) as primer_cambio,
    MAX(modificado_at) as ultimo_cambio
FROM mrp_historial_parametros
GROUP BY campo_modificado
ORDER BY total_cambios DESC;

-- Registrar migración
INSERT INTO schema_migrations (version, applied_at)
VALUES (16, NOW())
ON CONFLICT DO NOTHING;
