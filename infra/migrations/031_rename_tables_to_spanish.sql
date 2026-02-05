-- Migration 031: Rename tables from English/plural to Spanish/singular
-- Applies migration 025 mapping to PostgreSQL production
-- Code uses the NEW (Spanish/singular) names

BEGIN;

-- Helper: rename only if old name exists and new name doesn't
DO $$
DECLARE
    renames TEXT[][] := ARRAY[
        -- Budget
        ['budget_update_requests', 'presupuesto_solicitud_cambio'],
        -- Proveedores
        ['proveedores_externos', 'proveedor_externo'],
        ['proveedores_internos', 'proveedor_interno'],
        ['proveedor_ext_contactos', 'proveedor_externo_contacto'],
        ['proveedor_ext_emails', 'proveedor_externo_email'],
        ['proveedor_ext_telefonos', 'proveedor_externo_telefono'],
        ['proveedor_precios_negociados', 'proveedor_precio_negociado'],
        -- Catalogos
        ['catalog_almacenes', 'catalogo_almacen'],
        ['catalog_centros', 'catalogo_centro'],
        ['catalog_puestos', 'catalogo_puesto'],
        ['catalog_roles', 'catalogo_rol'],
        ['catalog_sectores', 'catalogo_sector'],
        -- Core tables
        ['solicitudes', 'solicitud'],
        ['solicitudes_historial_estados', 'solicitud_historial_estado'],
        ['presupuestos', 'presupuesto'],
        ['notificaciones', 'notificacion'],
        ['mensajes', 'mensaje'],
        ['solpeds', 'solicitud_pedido_sap'],
        ['trivias_scores', 'trivia_score'],
        -- User tables
        ['user_notification_preferences', 'usuario_preferencia_notificacion'],
        ['user_profile_requests', 'usuario_solicitud_perfil']
    ];
    r TEXT[];
BEGIN
    FOREACH r SLICE 1 IN ARRAY renames
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = r[1])
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = r[2])
        THEN
            EXECUTE format('ALTER TABLE %I RENAME TO %I', r[1], r[2]);
            RAISE NOTICE 'Renamed % -> %', r[1], r[2];
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = r[2]) THEN
            RAISE NOTICE 'Already exists: %', r[2];
        ELSE
            RAISE NOTICE 'Source not found: %', r[1];
        END IF;
    END LOOP;
END $$;

-- Register migration
INSERT INTO schema_migrations (version) VALUES (31)
ON CONFLICT (version) DO NOTHING;

COMMIT;
