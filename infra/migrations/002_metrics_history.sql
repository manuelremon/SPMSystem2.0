-- Migracion 002: Tablas para historico de metricas y alertas del sistema
-- Permite almacenar metricas de rendimiento para graficos de tendencias
-- y alertas cuando se cruzan umbrales criticos

-- Tabla para almacenar historico de metricas del sistema
CREATE TABLE IF NOT EXISTS metrics_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metric_type VARCHAR(50) NOT NULL,  -- 'cpu', 'memory', 'latency_p50', 'error_rate', 'cache_hit'
    metric_value REAL NOT NULL,
    metadata TEXT,  -- JSON opcional para datos adicionales
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_metrics_history_type_time ON metrics_history(metric_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_history_timestamp ON metrics_history(timestamp);

-- Tabla para alertas del sistema
CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    alert_type VARCHAR(50) NOT NULL,  -- 'critical', 'warning', 'info'
    metric_name VARCHAR(100) NOT NULL,
    threshold_value REAL,
    actual_value REAL,
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by INTEGER REFERENCES usuarios(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices para alertas
CREATE INDEX IF NOT EXISTS idx_system_alerts_timestamp ON system_alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged ON system_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);

-- Comentarios para documentacion
COMMENT ON TABLE metrics_history IS 'Historico de metricas del sistema para graficos de tendencias';
COMMENT ON TABLE system_alerts IS 'Alertas del sistema cuando metricas cruzan umbrales criticos';
