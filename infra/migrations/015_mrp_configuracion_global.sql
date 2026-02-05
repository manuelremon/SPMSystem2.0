-- Migration 015: Configuración Global MRP
-- Fecha: 2026-02-02
-- Propósito: Tabla de configuración global para valores por defecto de MRP

-- ============================================================================
-- TABLA: Configuración Global MRP
-- ============================================================================

CREATE TABLE IF NOT EXISTS mrp_configuracion (
    id SERIAL PRIMARY KEY,
    parametro VARCHAR(50) UNIQUE NOT NULL,
    valor_numerico DECIMAL(10,4),
    valor_texto VARCHAR(200),
    descripcion TEXT,
    categoria VARCHAR(30),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mrp_config_categoria
    ON mrp_configuracion(categoria);

CREATE INDEX IF NOT EXISTS idx_mrp_config_parametro
    ON mrp_configuracion(parametro);

-- ============================================================================
-- DATOS INICIALES: Valores por defecto
-- ============================================================================

INSERT INTO mrp_configuracion (parametro, valor_numerico, categoria, descripcion, updated_at)
VALUES
    ('lead_time_default', 30, 'lead_time', 'Lead time por defecto (días)', CURRENT_TIMESTAMP),
    ('costo_orden_default', 100, 'costos', 'Costo de ordenar por defecto (USD)', CURRENT_TIMESTAMP),
    ('tasa_mantenimiento_default', 0.20, 'costos', 'Tasa de mantenimiento por defecto (% anual)', CURRENT_TIMESTAMP),
    ('nivel_servicio_default', 0.95, 'servicio', 'Nivel de servicio por defecto (95%)', CURRENT_TIMESTAMP),
    ('nivel_servicio_critico', 0.99, 'servicio', 'Nivel de servicio para materiales críticos (99%)', CURRENT_TIMESTAMP),
    ('dias_laborables_default', 300, 'calendario', 'Días laborables al año', CURRENT_TIMESTAMP),
    ('cantidad_minima_default', 10, 'restricciones', 'Cantidad mínima de pedido por defecto', CURRENT_TIMESTAMP),
    ('multiplo_default', 1, 'restricciones', 'Múltiplo de pedido por defecto', CURRENT_TIMESTAMP),
    ('desv_std_demanda_default', 0.0, 'variabilidad', 'Desviación estándar demanda diaria por defecto', CURRENT_TIMESTAMP),
    ('desv_std_leadtime_default', 0.0, 'variabilidad', 'Desviación estándar lead time por defecto', CURRENT_TIMESTAMP)
ON CONFLICT (parametro) DO NOTHING;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE mrp_configuracion
    IS 'Almacena valores por defecto y configuración global del sistema MRP';

COMMENT ON COLUMN mrp_configuracion.parametro
    IS 'Nombre único del parámetro (ej: lead_time_default)';

COMMENT ON COLUMN mrp_configuracion.valor_numerico
    IS 'Valor numérico del parámetro (para valores no texto)';

COMMENT ON COLUMN mrp_configuracion.valor_texto
    IS 'Valor texto del parámetro (para valores no numéricos)';

COMMENT ON COLUMN mrp_configuracion.categoria
    IS 'Categoría del parámetro para agrupamiento (lead_time, costos, servicio, etc.)';

COMMENT ON COLUMN mrp_configuracion.updated_by
    IS 'Usuario que actualizó el parámetro (auditoría)';

-- ============================================================================
-- VISTA: Configuración actual
-- ============================================================================

DROP VIEW IF EXISTS v_mrp_config CASCADE;
CREATE VIEW v_mrp_config AS
SELECT
    parametro,
    valor_numerico,
    valor_texto,
    categoria,
    descripcion,
    updated_at,
    updated_by
FROM mrp_configuracion
ORDER BY categoria, parametro;

-- Registrar migración
INSERT INTO schema_migrations (version, applied_at)
VALUES (15, NOW())
ON CONFLICT DO NOTHING;
