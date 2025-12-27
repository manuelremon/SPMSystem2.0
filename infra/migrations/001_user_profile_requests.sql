-- Migracion 001: Crear tabla user_profile_requests si no existe
-- Esta tabla almacena solicitudes de cambio de perfil de usuarios

CREATE TABLE IF NOT EXISTS user_profile_requests(
    id SERIAL PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id_spm),
    tipo TEXT NOT NULL,
    payload TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_profile_requests_usuario ON user_profile_requests(usuario_id);
CREATE INDEX IF NOT EXISTS idx_profile_requests_estado ON user_profile_requests(estado);
CREATE INDEX IF NOT EXISTS idx_profile_requests_created ON user_profile_requests(created_at);
