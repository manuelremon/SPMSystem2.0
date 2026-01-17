"""
Migracion 021: Renombrar Centros

Esta migracion actualiza los codigos y nombres de centros en todas las tablas.

Mapeo para PRODUCCION (codigos reales):
- 1008 (UP Loma La Lata) -> AA101 (Deposito 1)
- 1050 (UP UTE Rio Neuquen) -> AA102 (Deposito 2)
- 1064 (UP Anelo) -> AA103 (Deposito 3)
- 1500 (MID Loma La Lata) -> AA104 (Deposito 4)
- 1501 (MID Sierra Barrosa) -> AA105 (Deposito 5)
- 1502 (MID El Porton) -> AA106 (Deposito 6)

Fecha: 2026-01-17
"""

import os
import sys

# Mapeo de codigos - produccion
CENTRO_MAPPING = {
    "1008": "AA101",
    "1050": "AA102",
    "1064": "AA103",
    "1500": "AA104",
    "1501": "AA105",
    "1502": "AA106",
}

# Mapeo de codigo a nombre nuevo
CODIGO_TO_NOMBRE = {
    "1008": "Deposito 1",
    "1050": "Deposito 2",
    "1064": "Deposito 3",
    "1500": "Deposito 4",
    "1501": "Deposito 5",
    "1502": "Deposito 6",
}


def _update_csv_field(value, mapping):
    """Actualiza un campo CSV con el mapeo de centros."""
    if not value:
        return value
    parts = [p.strip() for p in value.split(",")]
    mapped = [mapping.get(p, p) for p in parts]
    return ",".join(mapped)


def run_migration_postgresql():
    """Ejecuta la migracion en PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL")

    print(f"DATABASE_URL presente: {bool(database_url)}")

    if not database_url:
        print("ERROR: DATABASE_URL no configurada")
        return False

    if not database_url.startswith("postgresql://"):
        print(f"DATABASE_URL no es PostgreSQL: {database_url[:20]}...")
        return False

    try:
        import psycopg2

        print("Conectando a PostgreSQL...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # ESTRATEGIA: Como codigo es PRIMARY KEY, necesitamos:
        # 1. Insertar nuevos centros
        # 2. Actualizar todas las referencias
        # 3. Eliminar centros viejos

        print("\n=== PASO 1: Insertar nuevos centros ===")
        for old_code, new_code in CENTRO_MAPPING.items():
            new_name = CODIGO_TO_NOMBRE.get(old_code, f"Centro {new_code}")
            try:
                cursor.execute(
                    """
                    INSERT INTO catalog_centros (codigo, nombre, activo)
                    VALUES (%s, %s, 1)
                    ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
                    """,
                    (new_code, new_name),
                )
                print(f"  Insertado/actualizado: {new_code} ({new_name})")
            except Exception as e:
                print(f"  Error insertando {new_code}: {e}")

        print("\n=== PASO 2: Actualizar referencias en tablas ===")

        # Lista de tablas y columnas a actualizar
        tables_with_centro = [
            ("usuarios", "centros", True),  # CSV field
            ("solicitudes", "centro", False),
            ("presupuestos", "centro", False),
            ("presupuesto_ledger", "centro", False),
            ("budget_update_requests", "centro", False),
            ("planificador_asignaciones", "centro", False),
            ("config_almacenes", "centro", False),
            ("proveedores_internos", "centro", False),
            ("decision_abastecimiento_fuentes", "centro_origen", False),
        ]

        for table, column, is_csv in tables_with_centro:
            print(f"\n  Actualizando {table}.{column}...")
            try:
                if is_csv:
                    # Campo CSV - necesita logica especial
                    cursor.execute(f"SELECT id_spm, {column} FROM {table} WHERE {column} IS NOT NULL")
                    rows = cursor.fetchall()
                    updated = 0
                    for row in rows:
                        user_id, old_value = row
                        new_value = _update_csv_field(old_value, CENTRO_MAPPING)
                        if new_value != old_value:
                            cursor.execute(
                                f"UPDATE {table} SET {column} = %s WHERE id_spm = %s",
                                (new_value, user_id),
                            )
                            updated += 1
                    print(f"    {updated} registros actualizados")
                else:
                    # Campo simple
                    for old_code, new_code in CENTRO_MAPPING.items():
                        cursor.execute(
                            f"UPDATE {table} SET {column} = %s WHERE {column} = %s",
                            (new_code, old_code),
                        )
                        count = cursor.rowcount
                        if count > 0:
                            print(f"    {old_code} -> {new_code}: {count} registros")
            except Exception as e:
                print(f"    Error en {table}: {e}")

        # Actualizar centro_nombre en proveedores_internos
        print("\n  Actualizando proveedores_internos.centro_nombre...")
        try:
            for old_code, new_code in CENTRO_MAPPING.items():
                new_name = CODIGO_TO_NOMBRE.get(old_code)
                if new_name:
                    cursor.execute(
                        "UPDATE proveedores_internos SET centro_nombre = %s WHERE centro = %s",
                        (new_name, new_code),
                    )
        except Exception as e:
            print(f"    Error: {e}")

        print("\n=== PASO 3: Desactivar centros viejos ===")
        for old_code in CENTRO_MAPPING.keys():
            try:
                cursor.execute(
                    "UPDATE catalog_centros SET activo = 0 WHERE codigo = %s",
                    (old_code,),
                )
                if cursor.rowcount > 0:
                    print(f"  Desactivado: {old_code}")
            except Exception as e:
                print(f"  Error desactivando {old_code}: {e}")

        print("\n=== Guardando cambios ===")
        conn.commit()
        conn.close()
        print("Migracion PostgreSQL completada exitosamente!")
        return True

    except ImportError:
        print("ERROR: psycopg2 no instalado")
        return False
    except Exception as e:
        print(f"ERROR en migracion: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_migration():
    """Ejecuta la migracion completa."""
    print("=" * 60)
    print("MIGRACION 021: Renombrar Centros")
    print("=" * 60)

    return run_migration_postgresql()


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
