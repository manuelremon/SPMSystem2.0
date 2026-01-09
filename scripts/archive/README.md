# Scripts Archivados

Estos scripts fueron archivados en enero 2026 porque ya no son necesarios para el desarrollo activo.

## migrations/

Scripts de migracion de SQLite a PostgreSQL completados en diciembre 2025:

- `migrate_proveedores.py` - Migracion de proveedores completada
- `migrate_sqlite_catalogs_to_postgres.py` - Migracion de catalogos completada
- `sync_sqlite_to_postgres.py` - Sincronizacion inicial completada

**ADVERTENCIA**: No ejecutar estos scripts en produccion - las migraciones ya fueron completadas.

## utilities/

Scripts de utilidad obsoletos o redundantes:

- `spm_manager.py` - Menu interactivo antiguo, reemplazado por scripts individuales
- `verify_production_setup.py` - Verificaciones manuales, reemplazado por health checks
- `show_production_status.py` - Inspeccion manual, reemplazado por health checks
- `populate_test_data.py` - Redundante con populate_complete_data.py
- `populate_treatment_data.py` - Nunca utilizado
- `analyze_repo.py` - Analisis estatico antiguo
- `spec_extractor.py` - Extractor de specs obsoleto

## Uso

Si necesitas referenciar codigo de estos scripts, estan disponibles aqui.
Para nuevos desarrollos, usa los scripts en `scripts/` (directorio principal).
