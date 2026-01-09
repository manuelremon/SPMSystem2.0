# Tests Archivados

Estos tests fueron archivados en enero 2026 porque son scripts exploratorios/de debug que no forman parte de la suite de tests automatizada.

## manual/

77 scripts de testing manual que incluyen:

- Scripts de inspeccion de BD (`check_*.py`, `inspect_*.py`)
- Scripts de prueba de API (`test_api*.py`, `test_approve*.py`)
- Scripts legacy con imports obsoletos (`legacy_test_*.py`)
- Scripts de debug (`debug_*.py`)
- Scripts de verificacion manual (`verify_*.py`)

## Uso

Estos scripts pueden servir como referencia para crear nuevos tests.
Para tests automatizados, usa los archivos en `tests/unit/`, `tests/integration/`, y `tests/e2e/`.

## Migracion

Si encuentras un test manual util, considera:
1. Refactorizarlo para usar pytest
2. Moverlo al directorio apropiado (unit, integration, o e2e)
3. Asegurar que funciona con el CI/CD actual
