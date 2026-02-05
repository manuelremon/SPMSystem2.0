# Migración de Códigos SAP de Materiales

Esta carpeta contiene los scripts para migrar los códigos de material del catálogo SAP de un formato numérico a un formato estructurado.

## Formato de Códigos

**Antes:** Códigos numéricos de 8-10 dígitos (ej: `1000000006`)

**Después:** Formato `GRUPO-SECUENCIA` (ej: `1124-0000001`)
- 4 dígitos de grupo de artículos
- Guión separador
- 7 dígitos de secuencia autoincremental dentro del grupo

## Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `migrate_sap_codes.py` | **Script maestro** - Ejecuta todos los pasos |
| `001_backup_databases.py` | Crea backups de todas las bases de datos |
| `002_create_mapping_table.py` | Genera tabla de mapeo código_antiguo → código_nuevo |
| `003_migrate_material_codes.py` | Ejecuta la migración principal |
| `004_validate_migration.py` | Valida integridad y formato |
| `005_rollback_migration.py` | Restaura desde backup si hay problemas |

## Uso Rápido

```bash
# Ejecutar migración completa
python scripts/migrations/migrate_sap_codes.py

# Simulación (sin cambios reales)
python scripts/migrations/migrate_sap_codes.py --dry-run

# Rollback (restaurar desde backup)
python scripts/migrations/005_rollback_migration.py
```

## Ejecución Paso a Paso

Si prefiere ejecutar cada paso manualmente:

```bash
# 1. Crear backups
python scripts/migrations/001_backup_databases.py

# 2. Generar tabla de mapeo
python scripts/migrations/002_create_mapping_table.py

# 3. Ejecutar migración
python scripts/migrations/003_migrate_material_codes.py

# 4. Validar resultados
python scripts/migrations/004_validate_migration.py
```

## Bases de Datos Afectadas

| Base de Datos | Tablas Afectadas |
|--------------|------------------|
| `catalogo_materiales.db` | `materiales` (PK: codigo) |
| `sap_data.db` | `stock`, `materiales_bbdd`, `consumo_historico`, `pedidos_sap` |
| `equivalentes.db` | `equivalencias` (material_base, material_equivalente) |
| `spm.db` | `traslados`, `solpeds`, `proveedor_precios_negociados`, `decision_abastecimiento_fuentes` |

## Tabla de Mapeo

La tabla `codigo_mapping` se crea en `catalogo_materiales.db` para trazabilidad:

```sql
CREATE TABLE codigo_mapping (
    codigo_antiguo TEXT PRIMARY KEY,
    codigo_nuevo TEXT NOT NULL UNIQUE,
    grupo_articulos INTEGER NOT NULL,
    migrado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aplicado INTEGER DEFAULT 0
);
```

Esto permite:
- Auditar qué código antiguo corresponde a cada código nuevo
- Facilitar rollback si es necesario
- Depurar problemas post-migración

## Backups

Los backups se almacenan en:
```
backup/
└── pre_migration_codigos_sap/
    └── YYYYMMDD_HHMMSS/
        ├── catalogo_materiales.db
        ├── sap_data.db
        ├── equivalentes.db
        ├── spm.db
        └── manifest.txt
```

## Notas Importantes

1. **Descripciones NO cambian**: Solo se modifica el código, las descripciones permanecen intactas.

2. **Materiales sin grupo**: Se asignan al grupo genérico `9999`.

3. **Orden de secuencia**: Los códigos se asignan en orden del código original dentro de cada grupo.

4. **Integridad referencial**: Todas las tablas dependientes se actualizan automáticamente.

## Rollback

Si hay problemas después de la migración:

```bash
python scripts/migrations/005_rollback_migration.py
```

Esto restaurará todas las bases de datos desde el backup más reciente.
