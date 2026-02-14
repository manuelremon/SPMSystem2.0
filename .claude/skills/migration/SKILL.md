---
name: migration
description: Crea una nueva migracion de base de datos SQLite/PostgreSQL siguiendo el patron del proyecto SPM System 2.0
disable-model-invocation: true
---

# Skill: Crear Migracion de Base de Datos

## Instrucciones

Cuando el usuario invoque `/migration`, sigue estos pasos:

### 1. Determinar el siguiente numero de migracion

Busca en `backend/migrations/` el archivo con el numero mas alto (formato `NNN_nombre.py`). El nuevo archivo sera `{siguiente_numero}_{nombre_descriptivo}.py`.

### 2. Preguntar al usuario

Si no se proporcionaron detalles, pregunta:
- Nombre descriptivo para la migracion (se convertira a snake_case)
- Que tablas/columnas se van a crear o modificar
- Tipos de datos necesarios

### 3. Crear el archivo de migracion

Usa este template exacto:

```python
"""Migration {NNN}: {Descripcion breve}"""


def migrate(conn, is_postgresql=False):
    cursor = conn.cursor()
    try:
        if is_postgresql:
            # PostgreSQL: usar IF NOT EXISTS, tipos nativos
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nombre_tabla (
                    id SERIAL PRIMARY KEY,
                    columna TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            # SQLite: verificar existencia manualmente si es ALTER TABLE
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nombre_tabla (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    columna TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Migration {NNN}: {e}")
```

### 4. Reglas importantes

- **Nombres de tablas en espanol** (convencion del proyecto desde migracion 025)
- **Siempre soportar dual SQLite/PostgreSQL** con el parametro `is_postgresql`
- **PostgreSQL usa** `SERIAL`, `IF NOT EXISTS` en ALTER TABLE, `TIMESTAMP`
- **SQLite usa** `INTEGER PRIMARY KEY AUTOINCREMENT`, `PRAGMA table_info()` para verificar columnas
- **Para ALTER TABLE en SQLite**: verificar si la columna existe con `PRAGMA table_info(tabla)`
- **Siempre hacer `conn.commit()`** al final
- **Wrap en try/except** con logging de warning (no error fatal)
- La funcion SIEMPRE se llama `migrate(conn, is_postgresql=False)`
- NO incluir funcion downgrade (el proyecto no usa rollbacks de migracion)

### 5. Verificar

Despues de crear el archivo, confirma:
- El numero de migracion es consecutivo
- El archivo sigue el patron exacto
- Los tipos de datos son correctos para ambos motores
