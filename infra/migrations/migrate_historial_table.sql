-- Migration: Actualizar tabla solicitudes_historial_estados
-- Fecha: 2025-12-21
-- Descripción: Agrega campos faltantes e índices según migración 006

-- Si la tabla ya existe con schema viejo, añadir columnas faltantes
DO $$
BEGIN
    -- Agregar razon si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'solicitudes_historial_estados' AND column_name = 'razon'
    ) THEN
        ALTER TABLE solicitudes_historial_estados ADD COLUMN razon TEXT;
    END IF;

    -- Agregar metadata_json si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'solicitudes_historial_estados' AND column_name = 'metadata_json'
    ) THEN
        ALTER TABLE solicitudes_historial_estados ADD COLUMN metadata_json TEXT;
    END IF;
END $$;

-- Si la tabla no existe, crearla completa
CREATE TABLE IF NOT EXISTS solicitudes_historial_estados (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    razon TEXT,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_historial_solicitud ON solicitudes_historial_estados(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_historial_estado_nuevo ON solicitudes_historial_estados(estado_nuevo);
CREATE INDEX IF NOT EXISTS idx_historial_actor ON solicitudes_historial_estados(actor_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON solicitudes_historial_estados(created_at);

-- Verificar que audit_trail existe (por si acaso)
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    entidad TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    accion TEXT NOT NULL,
    actor_id TEXT,
    campo_modificado TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    actor_rol TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entidad ON audit_trail(entidad);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_trail(created_at);

SELECT 'Migration completed successfully' AS status;
