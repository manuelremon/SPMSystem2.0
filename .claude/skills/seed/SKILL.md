---
name: seed
description: Regenera datos de desarrollo ejecutando seed_dev_data.py con las opciones correctas
disable-model-invocation: true
---

# Skill: Seed de Datos de Desarrollo

## Instrucciones

Cuando el usuario invoque `/seed`, ejecuta el script de seed de datos de desarrollo.

### Opciones disponibles

| Flag | Descripcion |
|------|-------------|
| (sin flags) | Genera datos sin limpiar los existentes |
| `--clean` | Limpia todos los datos existentes y regenera desde cero |
| `-v` / `--verbose` | Modo verbose con mas detalle en la salida |

### Ejecucion

1. **Si el usuario no especifica opciones**, pregunta si quiere:
   - Seed normal (agrega datos)
   - Seed limpio (`--clean` - borra y regenera)

2. **Ejecutar el comando:**

```bash
cd C:\Users\MANUE\Documents\GitHub\SPMSystem2.0
python scripts/seed_dev_data.py [opciones]
```

3. **Despues del seed**, informa al usuario:
   - Cuantos registros se crearon
   - Si hubo errores
   - Credenciales del usuario de prueba: `Usuario 1 (Manu) / password123 / Admin`

### Notas
- El script usa las bases de datos SQLite en `data/`
- No afecta la base de datos de produccion (PostgreSQL)
- El flag `--clean` eliminara TODOS los datos de desarrollo existentes
- El usuario de prueba principal es `id=1, username=Manu, rol=admin`
