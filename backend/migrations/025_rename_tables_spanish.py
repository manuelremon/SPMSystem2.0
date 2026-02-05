"""
Migracion 025: Renombrar Tablas a Espanol

Esta migracion renombra 25 tablas de spm.db para unificar la nomenclatura:
- Todas las tablas en espanol
- Nombres en singular
- Prefijos por dominio

Estrategia:
1. Renombrar tablas fisicas
2. Crear vistas de compatibilidad (temporales)
3. Actualizar referencias en codigo
4. Eliminar vistas de compatibilidad

Fecha: 2026-02-01
"""

import os
import sqlite3
import sys

# Mapeo de nombres: actual -> nuevo
TABLE_MAPPING = {
    # FASE 1: Ingles a Espanol
    "budget_update_requests": "presupuesto_solicitud_cambio",
    "push_subscriptions": "notificacion_push_suscripcion",
    "purchase_orders": "orden_compra",
    "outbox_emails": "email_bandeja_salida",

    # FASE 2: Unificar Proveedores
    "proveedores_externos": "proveedor_externo",
    "proveedores_internos": "proveedor_interno",
    "proveedor_ext_contactos": "proveedor_externo_contacto",
    "proveedor_ext_emails": "proveedor_externo_email",
    "proveedor_ext_telefonos": "proveedor_externo_telefono",
    "proveedor_precios_negociados": "proveedor_precio_negociado",

    # FASE 3: Unificar Catalogos
    "catalog_almacenes": "catalogo_almacen",
    "catalog_centros": "catalogo_centro",
    "catalog_puestos": "catalogo_puesto",
    "catalog_roles": "catalogo_rol",
    "catalog_sectores": "catalogo_sector",

    # FASE 4: Tablas Principales a Singular
    "solicitudes": "solicitud",
    "solicitudes_historial_estados": "solicitud_historial_estado",
    "usuarios": "usuario",
    "presupuestos": "presupuesto",
    "notificaciones": "notificacion",
    "mensajes": "mensaje",

    # FASE 5: Miscelaneas
    "solpeds": "solicitud_pedido_sap",
    "traslados": "solicitud_traslado",
    "trivias_scores": "trivia_score",
    "user_notification_preferences": "usuario_preferencia_notificacion",
    "user_profile_requests": "usuario_solicitud_perfil",
}


def get_db_path():
    """Obtiene la ruta a spm.db."""
    # Intentar rutas comunes
    paths = [
        "data/spm.db",
        "../data/spm.db",
        "/home/manuelremon/Documentos/SPMV3.0/data/spm.db",
    ]

    for path in paths:
        if os.path.exists(path):
            return path

    return None


def table_exists(cursor, table_name):
    """Verifica si una tabla existe."""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    return cursor.fetchone() is not None


def view_exists(cursor, view_name):
    """Verifica si una vista existe."""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='view' AND name=?",
        (view_name,)
    )
    return cursor.fetchone() is not None


def run_migration_sqlite():
    """Ejecuta la migracion en SQLite."""
    db_path = get_db_path()

    if not db_path:
        print("ERROR: No se encontro spm.db")
        return False

    print(f"Base de datos: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Verificar integridad antes
        print("\n=== Verificando integridad ===")
        result = cursor.execute("PRAGMA integrity_check").fetchone()
        if result[0] != "ok":
            print(f"ERROR: Base de datos corrupta: {result[0]}")
            return False
        print("Integridad OK")

        # Paso 1: Renombrar tablas
        print("\n=== PASO 1: Renombrar tablas ===")
        renamed = 0
        skipped = 0

        for old_name, new_name in TABLE_MAPPING.items():
            if not table_exists(cursor, old_name):
                if table_exists(cursor, new_name):
                    print(f"  [SKIP] {old_name} -> ya existe como {new_name}")
                    skipped += 1
                else:
                    print(f"  [WARN] {old_name} no existe")
                continue

            if table_exists(cursor, new_name):
                print(f"  [SKIP] {new_name} ya existe")
                skipped += 1
                continue

            try:
                cursor.execute(f"ALTER TABLE {old_name} RENAME TO {new_name}")
                print(f"  [OK] {old_name} -> {new_name}")
                renamed += 1
            except Exception as e:
                print(f"  [ERROR] {old_name}: {e}")

        print(f"\nRenombradas: {renamed}, Saltadas: {skipped}")

        # Paso 2: Crear vistas de compatibilidad
        print("\n=== PASO 2: Crear vistas de compatibilidad ===")
        views_created = 0

        for old_name, new_name in TABLE_MAPPING.items():
            if view_exists(cursor, old_name):
                print(f"  [SKIP] Vista {old_name} ya existe")
                continue

            if not table_exists(cursor, new_name):
                continue

            try:
                cursor.execute(f"CREATE VIEW {old_name} AS SELECT * FROM {new_name}")
                print(f"  [OK] Vista {old_name} -> {new_name}")
                views_created += 1
            except Exception as e:
                print(f"  [ERROR] Vista {old_name}: {e}")

        print(f"\nVistas creadas: {views_created}")

        # Guardar cambios
        print("\n=== Guardando cambios ===")
        conn.commit()

        # Verificar integridad despues
        result = cursor.execute("PRAGMA integrity_check").fetchone()
        if result[0] != "ok":
            print(f"ERROR: Integridad post-migracion fallida: {result[0]}")
            return False

        # Listar tablas finales
        print("\n=== Tablas finales ===")
        tables = cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        for t in tables:
            print(f"  - {t[0]}")

        # Listar vistas
        print("\n=== Vistas de compatibilidad ===")
        views = cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name"
        ).fetchall()
        for v in views:
            print(f"  - {v[0]}")

        conn.close()
        print("\nMigracion SQLite completada exitosamente!")
        return True

    except Exception as e:
        print(f"ERROR en migracion: {e}")
        import traceback
        traceback.print_exc()
        return False


def remove_compatibility_views():
    """Elimina las vistas de compatibilidad (ejecutar despues de actualizar codigo)."""
    db_path = get_db_path()

    if not db_path:
        print("ERROR: No se encontro spm.db")
        return False

    print(f"Base de datos: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("\n=== Eliminando vistas de compatibilidad ===")
        removed = 0

        for old_name in TABLE_MAPPING.keys():
            if view_exists(cursor, old_name):
                try:
                    cursor.execute(f"DROP VIEW {old_name}")
                    print(f"  [OK] Eliminada vista {old_name}")
                    removed += 1
                except Exception as e:
                    print(f"  [ERROR] {old_name}: {e}")

        conn.commit()
        conn.close()

        print(f"\nVistas eliminadas: {removed}")
        return True

    except Exception as e:
        print(f"ERROR: {e}")
        return False


def rollback_migration():
    """Revierte la migracion (para emergencias)."""
    db_path = get_db_path()

    if not db_path:
        print("ERROR: No se encontro spm.db")
        return False

    print(f"Base de datos: {db_path}")
    print("\n!!! ROLLBACK DE MIGRACION !!!")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Primero eliminar vistas
        for old_name in TABLE_MAPPING.keys():
            if view_exists(cursor, old_name):
                cursor.execute(f"DROP VIEW {old_name}")
                print(f"  Vista {old_name} eliminada")

        # Revertir nombres
        for old_name, new_name in TABLE_MAPPING.items():
            if table_exists(cursor, new_name):
                cursor.execute(f"ALTER TABLE {new_name} RENAME TO {old_name}")
                print(f"  {new_name} -> {old_name}")

        conn.commit()
        conn.close()

        print("\nRollback completado!")
        return True

    except Exception as e:
        print(f"ERROR en rollback: {e}")
        return False


def run_migration():
    """Ejecuta la migracion completa."""
    print("=" * 60)
    print("MIGRACION 025: Renombrar Tablas a Espanol")
    print("=" * 60)

    return run_migration_sqlite()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "--remove-views":
            success = remove_compatibility_views()
        elif sys.argv[1] == "--rollback":
            success = rollback_migration()
        else:
            print(f"Opcion desconocida: {sys.argv[1]}")
            print("Uso: python 025_rename_tables_spanish.py [--remove-views|--rollback]")
            sys.exit(1)
    else:
        success = run_migration()

    sys.exit(0 if success else 1)
