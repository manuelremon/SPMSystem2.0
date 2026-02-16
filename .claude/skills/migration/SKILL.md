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
"""
Migracion {NNN}: {Titulo descriptivo}
Fecha: {YYYY-MM-DD}
Descripcion: {Descripcion detallada de lo que hace}
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            # PostgreSQL: usar SERIAL, TIMESTAMP, y sintaxis FK completa
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nombre_tabla (
                    id SERIAL PRIMARY KEY,
                    columna TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            # SQLite: usar INTEGER PRIMARY KEY AUTOINCREMENT y TEXT para fechas
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nombre_tabla (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    columna TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)

        # Crear indices (misma sintaxis para ambos)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tabla_columna ON nombre_tabla(columna)")

        conn.commit()

    print("Migracion {NNN}: {descripcion} - Tablas creadas")


def down():
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Eliminar indices primero
        cursor.execute("DROP INDEX IF EXISTS idx_tabla_columna")

        # Eliminar tablas
        cursor.execute("DROP TABLE IF EXISTS nombre_tabla")

        conn.commit()

    print("Migracion {NNN}: Revertida exitosamente")


if __name__ == '__main__':
    up()
```

### 4. Reglas importantes

- **Nombres de tablas en espanol** (convencion del proyecto desde migracion 025)
- **Siempre soportar dual SQLite/PostgreSQL** con `is_using_postgresql()`
- **Import**: `from backend.core.db import get_db_connection, is_using_postgresql`
- **Connection**: usar `with get_db_connection() as conn:` (context manager)
- **Funcion principal**: siempre `def up():` (sin parametros)
- **Funcion rollback**: siempre `def down():` (sin parametros)
- **Entry point**: incluir `if __name__ == '__main__': up()`
- **PostgreSQL usa**: `SERIAL PRIMARY KEY`, `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, `CHECK()` constraints
- **SQLite usa**: `INTEGER PRIMARY KEY AUTOINCREMENT`, `TEXT DEFAULT (datetime('now'))`, `CHECK()` constraints
- **Para ALTER TABLE en SQLite**: verificar si la columna existe con `PRAGMA table_info(tabla)`
- **Siempre hacer `conn.commit()`** dentro del `with` block
- **Indices**: crear al final, sintaxis identica para ambos motores
- **Print de confirmacion** despues del `with` block

### 5. Verificar

Despues de crear el archivo, confirma:
- El numero de migracion es consecutivo
- El archivo sigue el patron exacto (imports, `up()`, `down()`, `__main__`)
- Los tipos de datos son correctos para ambos motores
- Las fechas usan `TIMESTAMP` en PG y `TEXT DEFAULT (datetime('now'))` en SQLite
