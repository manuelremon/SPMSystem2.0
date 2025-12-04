#!/usr/bin/env python3
"""
SCRIPT DE POBLACIÓN COMPLETA - SPM
===================================
Carga TODOS los datos desde CSVs a la BD correctamente
"""

import csv
import os
import sqlite3

DB_PATH = "src/backend/core/data/spm.db"
DATA_DIR = "src/backend/data"

print("=" * 80)
print("CARGANDO DATOS COMPLETOS A SPM")
print("=" * 80)

if not os.path.exists(DB_PATH):
    print(f"❌ BD no encontrada: {DB_PATH}")
    exit(1)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("PRAGMA foreign_keys = ON")

# LIMPIAR
print("\n🧹 Limpiando...")
tablas = [
    "solicitud_tratamiento_eventos",
    "solicitud_tratamiento_log",
    "solicitud_items_tratamiento",
    "traslados",
    "planificador_asignaciones",
    "planificadores",
    "solpeds",
    "solicitudes",
    "outbox_emails",
    "notificaciones",
    "user_profile_requests",
    "usuarios",
    "materiales",
    "presupuesto_incorporaciones",
    "presupuestos",
    "catalog_puestos",
    "catalog_roles",
    "catalog_almacenes",
    "catalog_sectores",
    "catalog_centros",
]

for tabla in tablas:
    try:
        cursor.execute(f"DELETE FROM {tabla}")
        print(f"  ✓ {tabla}")
    except:
        pass
conn.commit()

# 1. ROLES
print("\n📋 Roles...")
with open(os.path.join(DATA_DIR, "Roles.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cursor.execute(
            "INSERT INTO catalog_roles (nombre, descripcion, activo) VALUES (?, ?, ?)",
            (row["nombre"].strip(), row.get("descripcion", "").strip(), int(row.get("activo", 1))),
        )
        print(f"  ✓ {row['nombre']}")
conn.commit()

# 2. CENTROS
print("\n🏢 Centros...")
with open(os.path.join(DATA_DIR, "Centros.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cursor.execute(
            "INSERT INTO catalog_centros (codigo, nombre, descripcion, activo) VALUES (?, ?, ?, ?)",
            (
                row["codigo"].strip(),
                row["nombre"].strip(),
                row.get("descripcion", "").strip(),
                int(row.get("activo", 1)),
            ),
        )
        print(f"  ✓ {row['codigo']} - {row['nombre']}")
conn.commit()

# 3. SECTORES
print("\n📍 Sectores...")
with open(os.path.join(DATA_DIR, "Sectores.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cursor.execute(
            "INSERT INTO catalog_sectores (nombre, descripcion, activo) VALUES (?, ?, ?)",
            (row["nombre"].strip(), row.get("descripcion", "").strip(), int(row.get("activo", 1))),
        )
        print(f"  ✓ {row['nombre']}")
conn.commit()

# 4. ALMACENES
print("\n🏪 Almacenes...")
with open(os.path.join(DATA_DIR, "Almacenes.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cursor.execute(
            "INSERT INTO catalog_almacenes (codigo, nombre, descripcion, activo) VALUES (?, ?, ?, ?)",
            (
                row["codigo"].strip(),
                row["nombre"].strip(),
                row.get("descripcion", "").strip(),
                int(row.get("activo", 1)),
            ),
        )
        print(f"  ✓ {row['codigo']} - {row['nombre']}")
conn.commit()

# 5. PUESTOS
print("\n💼 Puestos...")
with open(os.path.join(DATA_DIR, "Puestos.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cursor.execute(
            "INSERT INTO catalog_puestos (nombre, descripcion, activo) VALUES (?, ?, ?)",
            (row["nombre"].strip(), row.get("descripcion", "").strip(), int(row.get("activo", 1))),
        )
        print(f"  ✓ {row['nombre']}")
conn.commit()

# 6. USUARIOS
print("\n👥 Usuarios...")
with open(os.path.join(DATA_DIR, "Usuarios.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        cursor.execute(
            """INSERT INTO usuarios
               (id_spm, apellido, nombre, mail, contrasena, rol, posicion, sector, centros,
                jefe, gerente1, gerente2, telefono, estado_registro, id_ypf)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                row["ID SPM"].strip(),
                row["Apellido"].strip(),
                row["Nombre"].strip(),
                row["Mail"].strip(),
                row["Contraseña"].strip(),
                row["Rol"].strip(),
                row["Posicion"].strip(),
                row["Sector"].strip(),
                row["Centro"].strip(),
                row.get("Jefe", "").strip() or None,
                row.get("Gerente1", "").strip() or None,
                row.get("Gerente2", "").strip() or None,
                row.get("Telefono", "").strip() or None,
                row.get("Estado registro", "Activo").strip(),
                row.get("ID YPF", "").strip() or None,
            ),
        )
        print(f"  ✓ {row['ID SPM']} - {row['Nombre']} {row['Apellido']}")
conn.commit()

# 7. MATERIALES
print("\n📦 Materiales...")
contador = 0
with open(os.path.join(DATA_DIR, "Materiales.csv.bak"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    material_actual = None
    material_detalle = []

    for row in reader:
        linea = row.get("Linea", "").strip()
        material = row.get("Material", "").strip()
        texto_breve = row.get("Texto breve material", "").strip()
        unidad = row.get("Unidad de Medida", "").strip()
        precio = row.get("Precio USD", "").strip()

        if linea == "1" and material:
            if material_actual:
                desc_breve = material_actual["texto_breve"] or material_actual["codigo"]
                desc_larga = " | ".join(material_detalle) if material_detalle else desc_breve
                try:
                    precio_float = float(material_actual.get("precio", 0).replace(",", "."))
                except:
                    precio_float = 0.0
                cursor.execute(
                    "INSERT INTO materiales (codigo, descripcion, descripcion_larga, precio_usd, unidad) VALUES (?, ?, ?, ?, ?)",
                    (
                        material_actual["codigo"],
                        desc_breve,
                        desc_larga,
                        precio_float,
                        material_actual.get("unidad", "UNI"),
                    ),
                )
                contador += 1
                if contador <= 5 or contador % 200 == 0:
                    print(f"  ✓ Material {contador}")

            material_actual = {
                "codigo": material,
                "texto_breve": texto_breve,
                "unidad": unidad,
                "precio": precio,
            }
            material_detalle = [texto_breve] if texto_breve else []
        elif linea != "1" and material_actual:
            txt = row.get("Texto completo material Español", "").strip()
            if txt:
                material_detalle.append(txt)

    if material_actual:
        desc_breve = material_actual["texto_breve"] or material_actual["codigo"]
        desc_larga = " | ".join(material_detalle) if material_detalle else desc_breve
        try:
            precio_float = float(material_actual.get("precio", 0).replace(",", "."))
        except:
            precio_float = 0.0
        cursor.execute(
            "INSERT INTO materiales (codigo, descripcion, descripcion_larga, precio_usd, unidad) VALUES (?, ?, ?, ?, ?)",
            (
                material_actual["codigo"],
                desc_breve,
                desc_larga,
                precio_float,
                material_actual.get("unidad", "UNI"),
            ),
        )
        contador += 1

print(f"  ✓ Total: {contador} materiales")
conn.commit()

# 8. PRESUPUESTOS
print("\n💰 Presupuestos...")
with open(os.path.join(DATA_DIR, "Presupuestos.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        try:
            monto = float(row["Monto USD"].replace(",", "."))
            saldo = float(row["Saldo USD"].replace(",", "."))
            cursor.execute(
                "INSERT INTO presupuestos (centro, sector, monto_usd, saldo_usd) VALUES (?, ?, ?, ?)",
                (row["Centro"].strip(), row["Sector"].strip(), monto, saldo),
            )
            print(f"  ✓ {row['Centro']}/{row['Sector']}: ${monto:,.2f}")
        except Exception as e:
            print(f"  ⚠ Error: {e}")
conn.commit()

# 9. SOLICITUDES
print("\n📝 Solicitudes...")
with open(os.path.join(DATA_DIR, "solicitudes_export.csv"), "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            monto = float(row.get("total_monto", 0))
            aprobador = None
            if row.get("aprobador_id"):
                try:
                    aprobador = str(int(row["aprobador_id"].strip()))
                except:
                    aprobador = row["aprobador_id"].strip()

            cursor.execute(
                """INSERT INTO solicitudes
                   (id_usuario, centro, sector, justificacion, status, total_monto,
                    criticidad, fecha_necesidad, centro_costos, almacen_virtual,
                    aprobador_id, data_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    row["id_usuario"].strip(),
                    row["centro"].strip(),
                    row["sector"].strip(),
                    row["justificacion"].strip(),
                    row["status"].strip(),
                    monto,
                    row.get("criticidad", "Normal").strip(),
                    row.get("fecha_necesidad", "").strip(),
                    row.get("centro_costos", "").strip(),
                    row.get("almacen_virtual", "").strip(),
                    aprobador,
                    row.get("data_json", "{}"),
                ),
            )
            print(f"  ✓ #{row['id']} - {row['id_usuario']} - {row['status']}")
        except Exception as e:
            print(f"  ⚠ Error: {e}")
conn.commit()

# RESUMEN
print("\n" + "=" * 80)
print("✅ CARGA COMPLETADA")
print("=" * 80)

cursor.execute("SELECT COUNT(*) FROM catalog_roles")
print(f"\n📋 Roles: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_centros")
print(f"🏢 Centros: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_sectores")
print(f"📍 Sectores: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_almacenes")
print(f"🏪 Almacenes: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM catalog_puestos")
print(f"💼 Puestos: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM usuarios")
print(f"👥 Usuarios: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM materiales")
print(f"📦 Materiales: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM presupuestos")
print(f"💰 Presupuestos: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM solicitudes")
print(f"📝 Solicitudes: {cursor.fetchone()[0]}")

print("\n✨ ¡Hecho!\n")
conn.close()
