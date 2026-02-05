-- Migration 030: Rename usuarios -> usuario and set passwords
-- This fixes the table name mismatch between PostgreSQL schema (usuarios)
-- and Python code (usuario)

BEGIN;

-- Step 1: Rename table if it exists with old name
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        ALTER TABLE usuarios RENAME TO usuario;
        RAISE NOTICE 'Table usuarios renamed to usuario';
    ELSE
        RAISE NOTICE 'Table usuario already exists, skipping rename';
    END IF;
END $$;

-- Step 2: Update all foreign key constraints that reference the old table name
-- PostgreSQL automatically updates FK references when renaming a table,
-- so no additional FK changes are needed.

-- Step 3: Set password for all users to bcrypt hash of '8300_@'
UPDATE usuario SET contrasena = '$2b$12$.Mqtv0q6dvRZUtbQKmKfDe1dGwFxqcOyNfbs9caYTGmzdmynHMCcK';

-- Step 4: Register migration
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO schema_migrations (version) VALUES (30)
ON CONFLICT (version) DO NOTHING;

COMMIT;
