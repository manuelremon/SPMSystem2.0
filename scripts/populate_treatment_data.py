#!/usr/bin/env python3
"""
Script para popular datos ficticios en las nuevas tablas
- Proveedores (PROV001-PROV006)
- Material_equivalencias (materiales compatibles)
"""

import sqlite3
from pathlib import Path

# Ruta de la BD
DB_PATH = Path(__file__).resolve().parent.parent / "backend_v2" / "spm.db"

# Datos ficticios de proveedores
PROVEEDORES_DATA = [
    (
        "PROV001",
        "SuppliesMaster Ltd",
        "externo",
        7,
        4.5,
        1,
        "Proveedor externo con excelente calidad",
    ),
    (
        "PROV002",
        "Industrial Exports",
        "externo",
        10,
        4.2,
        1,
        "Especializado en insumos industriales",
    ),
    ("PROV003", "QuickSupply Co", "externo", 5, 4.1, 1, "Entregas rápidas, excelente servicio"),
    (
        "PROV004",
        "Premium Parts International",
        "externo",
        15,
        4.8,
        1,
        "Alta calidad, entregas internacionales",
    ),
    ("PROV005", "EcoSupplies", "externo", 12, 4.3, 1, "Productos sustentables y certificados"),
    (
        "PROV006",
        "Almacén Interno",
        "almacen_interno",
        1,
        5.0,
        1,
        "Stock interno - entrega inmediata",
    ),
]

# Equivalencias de materiales ficticias
# (codigo_original, codigo_equivalente, compatibilidad_pct, descripcion, notas)
EQUIVALENCIAS_DATA = [
    # Asumiendo que existen códigos como "MAT001", "MAT002", etc. en la BD
    # Las equivalencias son 95-100% compatibles generalmente
    # Este es un ejemplo; ajusta según los códigos reales en tu BD
]


def populate_providers():
    """Inserta los proveedores ficticios"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verificar si ya existen proveedores
        cursor.execute("SELECT COUNT(*) FROM proveedores")
        count = cursor.fetchone()[0]

        if count > 0:
            print(f"⚠️  Ya existen {count} proveedores en la BD. Saltando inserción.")
            conn.close()
            return True

        # Insertar proveedores
        cursor.executemany(
            """
            INSERT INTO proveedores
            (id_proveedor, nombre, tipo, plazo_entrega_dias, rating, activo, descripcion)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            PROVEEDORES_DATA,
        )

        conn.commit()
        print(f"✅ {len(PROVEEDORES_DATA)} proveedores insertados correctamente")

        # Mostrar proveedores insertados
        cursor.execute(
            "SELECT id_proveedor, nombre, tipo, plazo_entrega_dias, rating FROM proveedores ORDER BY id_proveedor"
        )
        providers = cursor.fetchall()
        print("\n📦 Proveedores creados:")
        for prov_id, nombre, tipo, plazo, rating in providers:
            print(f"   {prov_id}: {nombre} ({tipo}) - Plazo: {plazo}d, Rating: {rating}★")

        conn.close()
        return True

    except sqlite3.Error as e:
        print(f"❌ Error al insertar proveedores: {e}")
        return False


def populate_equivalencias():
    """Inserta equivalencias de materiales"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Primero, obtener todos los códigos de materiales disponibles
        cursor.execute("SELECT codigo FROM materiales ORDER BY codigo")
        materiales = [row[0] for row in cursor.fetchall()]

        if len(materiales) < 2:
            print(
                f"⚠️  Insuficientes materiales en BD ({len(materiales)}). Se necesitan al menos 2 para crear equivalencias."
            )
            conn.close()
            return True

        # Verificar si ya existen equivalencias
        cursor.execute("SELECT COUNT(*) FROM material_equivalencias")
        count = cursor.fetchone()[0]

        if count > 0:
            print(f"⚠️  Ya existen {count} equivalencias en la BD. Saltando inserción.")
            conn.close()
            return True

        # Crear algunas equivalencias automáticas entre materiales similares
        # Para este MVP, creamos equivalencias entre materiales secuenciales (simplificado)
        equivalencias = []
        for i in range(len(materiales) - 1):
            # Cada material tiene un equivalente con 95% compatibilidad
            equivalencias.append(
                (
                    materiales[i],
                    materiales[i + 1],
                    95,
                    f"Material equivalente para {materiales[i]}",
                    "Compatibilidad del 95% - reemplazable en mayoría de casos",
                )
            )

        if equivalencias:
            cursor.executemany(
                """
                INSERT INTO material_equivalencias
                (codigo_original, codigo_equivalente, compatibilidad_pct, descripcion, notas)
                VALUES (?, ?, ?, ?, ?)
            """,
                equivalencias,
            )

            conn.commit()
            print(f"✅ {len(equivalencias)} equivalencias de materiales insertadas")

            cursor.execute(
                """
                SELECT codigo_original, codigo_equivalente, compatibilidad_pct
                FROM material_equivalencias LIMIT 5
            """
            )
            print("\n🔗 Primeras equivalencias creadas:")
            for orig, equiv, compat in cursor.fetchall():
                print(f"   {orig} ↔ {equiv} ({compat}% compatible)")
        else:
            print("⚠️  No se pudieron crear equivalencias (insuficientes materiales)")

        conn.close()
        return True

    except sqlite3.Error as e:
        print(f"❌ Error al insertar equivalencias: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🚀 Poblando datos ficticios para tratamiento de solicitudes...\n")

    success = True
    success = populate_providers() and success
    print()
    success = populate_equivalencias() and success

    if success:
        print("\n✅ Datos poblados exitosamente")
    else:
        print("\n❌ Ocurrieron errores durante la población")
