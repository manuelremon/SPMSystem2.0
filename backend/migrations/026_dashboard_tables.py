"""
Migracion 026: Crear tablas para sistema de dashboards editables

Crea las tablas:
- dashboard: Dashboard principal con metadatos
- dashboard_grupo: Grupos/carpetas para organizar dashboards
- dashboard_sheet: Hojas de calculo (datos Fortune Sheet JSON)
- dashboard_datasource: Fuentes de datos conectadas
- dashboard_share: Tokens de comparticion publica
- dashboard_permiso: Permisos granulares por usuario
"""

import os
import sqlite3


def get_db_path():
    """Obtener path de la base de datos"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "data", "spm.db")


def migrate():
    """Ejecutar migracion"""
    db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Crear tabla dashboard_grupo (carpetas)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_grupo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                icono TEXT DEFAULT 'folder',
                color TEXT DEFAULT '#6366f1',
                orden INTEGER DEFAULT 0,
                owner_id TEXT NOT NULL,
                es_publico INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla dashboard_grupo creada o ya existia")

        # 2. Crear tabla dashboard principal
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                owner_id TEXT NOT NULL,
                grupo_id INTEGER REFERENCES dashboard_grupo(id) ON DELETE SET NULL,
                tipo TEXT DEFAULT 'spreadsheet' CHECK(tipo IN ('spreadsheet', 'chart', 'mixed')),
                es_publico INTEGER DEFAULT 0,
                es_favorito INTEGER DEFAULT 0,
                icono TEXT DEFAULT 'table',
                color TEXT DEFAULT '#3b82f6',
                thumbnail TEXT,
                config TEXT,
                version INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla dashboard creada o ya existia")

        # 3. Crear tabla dashboard_sheet (hojas de calculo)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_sheet (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
                sheet_index INTEGER DEFAULT 0,
                nombre TEXT DEFAULT 'Hoja 1',
                data TEXT NOT NULL,
                config TEXT,
                es_visible INTEGER DEFAULT 1,
                es_protegida INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla dashboard_sheet creada o ya existia")

        # 4. Crear tabla dashboard_datasource (fuentes de datos)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_datasource (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
                nombre TEXT NOT NULL,
                tipo TEXT NOT NULL CHECK(tipo IN ('stock', 'budget', 'solicitudes', 'forecast', 'mrp', 'custom')),
                query TEXT,
                filtros TEXT,
                cache_ttl INTEGER DEFAULT 300,
                ultimo_refresh TEXT,
                config TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla dashboard_datasource creada o ya existia")

        # 5. Crear tabla dashboard_share (comparticion publica)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_share (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
                token TEXT UNIQUE NOT NULL,
                permiso TEXT DEFAULT 'view' CHECK(permiso IN ('view', 'edit', 'admin')),
                password_hash TEXT,
                max_accesos INTEGER,
                accesos_actuales INTEGER DEFAULT 0,
                expira_en TEXT,
                creado_por TEXT NOT NULL,
                nota TEXT,
                esta_activo INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("+ Tabla dashboard_share creada o ya existia")

        # 6. Crear tabla dashboard_permiso (permisos por usuario)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_permiso (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dashboard_id INTEGER NOT NULL REFERENCES dashboard(id) ON DELETE CASCADE,
                usuario_id TEXT NOT NULL,
                permiso TEXT DEFAULT 'view' CHECK(permiso IN ('view', 'edit', 'admin')),
                otorgado_por TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(dashboard_id, usuario_id)
            )
        """)
        print("+ Tabla dashboard_permiso creada o ya existia")

        # 7. Crear indices para rendimiento
        indices = [
            ("idx_dashboard_uuid", "dashboard(uuid)"),
            ("idx_dashboard_owner", "dashboard(owner_id)"),
            ("idx_dashboard_grupo", "dashboard(grupo_id)"),
            ("idx_dashboard_publico", "dashboard(es_publico)"),
            ("idx_dashboard_sheet_dashboard", "dashboard_sheet(dashboard_id)"),
            ("idx_dashboard_datasource_dashboard", "dashboard_datasource(dashboard_id)"),
            ("idx_dashboard_datasource_tipo", "dashboard_datasource(tipo)"),
            ("idx_dashboard_share_token", "dashboard_share(token)"),
            ("idx_dashboard_share_dashboard", "dashboard_share(dashboard_id)"),
            ("idx_dashboard_permiso_dashboard", "dashboard_permiso(dashboard_id)"),
            ("idx_dashboard_permiso_usuario", "dashboard_permiso(usuario_id)"),
            ("idx_dashboard_grupo_owner", "dashboard_grupo(owner_id)"),
        ]

        for idx_name, idx_def in indices:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}")
        print("+ Indices creados")

        # 8. Insertar grupo por defecto
        cursor.execute("""
            INSERT OR IGNORE INTO dashboard_grupo (id, nombre, descripcion, owner_id, es_publico)
            VALUES (1, 'General', 'Dashboards generales del sistema', 'system', 1)
        """)
        print("+ Grupo por defecto creado")

        conn.commit()
        print("\n[OK] Migracion 026_dashboard_tables completada exitosamente")
        return True

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error en migracion: {e}")
        return False
    finally:
        conn.close()


def rollback():
    """Revertir migracion"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Eliminar tablas en orden inverso (por foreign keys)
        tablas = [
            "dashboard_permiso",
            "dashboard_share",
            "dashboard_datasource",
            "dashboard_sheet",
            "dashboard",
            "dashboard_grupo",
        ]

        for tabla in tablas:
            cursor.execute(f"DROP TABLE IF EXISTS {tabla}")
            print(f"- Tabla {tabla} eliminada")

        conn.commit()
        print("\n[OK] Rollback completado")
        return True
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error en rollback: {e}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback()
    else:
        migrate()
