#!/usr/bin/env python3
"""
SCRIPT DE POBLACIÓN COMPLETA DE BASE DE DATOS - SPM
=====================================================
Lee archivos CSV y puebla la BD de forma íntegra y precisa.
"""

import csv
import os
import sqlite3
from datetime import datetime

# =====================================================================
# CONFIGURACIÓN
# =====================================================================

DB_PATH = "src/backend/core/data/spm.db"
DATA_DIR = "src/backend/data"

print("=" * 80)
print("POBLACIÓN COMPLETA DE BASE DE DATOS SPM")
print("=" * 80)
print()

# Verificar si la BD existe
if not os.path.exists(DB_PATH):
    print(f"❌ Base de datos no encontrada en: {DB_PATH}")
    exit(1)

# Conectar a la BD
conn = sqlite3.connect(DB_PATH)
conn.enable_load_extension(False)
cursor = conn.cursor()

# Habilitar foreign keys
cursor.execute("PRAGMA foreign_keys = ON")


# Función para limpiar la BD
def limpiar_tablas():
    """Limpia todas las tablas para empezar desde cero"""
    print("\n🧹 Limpiando tablas existentes...")
    tablas = [
        "solicitud_tratamiento_eventos",
        "solicitud_tratamiento_log",
        "solicitud_items_tratamiento",
        "traslados",
        "planificador_asignaciones",
        "planificadores",
        "solicitud_items",
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
            print(f"  ✓ Limpiada: {tabla}")
        except Exception as e:
            print(f"  ⚠ Error al limpiar {tabla}: {e}")

    conn.commit()


# =====================================================================
# 1. CARGAR ROLES
# =====================================================================
def cargar_roles():
    print("\n📋 Cargando ROLES...")
    roles_file = os.path.join(DATA_DIR, "Roles.csv")

    if not os.path.exists(roles_file):
        print(f"  ❌ No encontrado: {roles_file}")
        return []

    roles_map = {}
    with open(roles_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            nombre = row["nombre"].strip()
            cursor.execute(
                "INSERT INTO catalog_roles (nombre, descripcion, activo) VALUES (?, ?, ?)",
                (nombre, row.get("descripcion", "").strip(), int(row.get("activo", 1))),
            )
            roles_map[nombre] = cursor.lastrowid
            print(f"  ✓ {nombre}")

    conn.commit()
    return roles_map


# =====================================================================
# 2. CARGAR CENTROS
# =====================================================================
def cargar_centros():
    print("\n🏢 Cargando CENTROS...")
    centros_file = os.path.join(DATA_DIR, "Centros.csv")

    if not os.path.exists(centros_file):
        print(f"  ❌ No encontrado: {centros_file}")
        return {}

    centros_map = {}
    with open(centros_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            codigo = row["codigo"].strip()
            nombre = row["nombre"].strip()
            cursor.execute(
                "INSERT INTO catalog_centros (codigo, nombre, descripcion, activo) VALUES (?, ?, ?, ?)",
                (codigo, nombre, row.get("descripcion", "").strip(), int(row.get("activo", 1))),
            )
            centros_map[codigo] = cursor.lastrowid
            print(f"  ✓ {codigo} - {nombre}")

    conn.commit()
    return centros_map


# =====================================================================
# 3. CARGAR SECTORES
# =====================================================================
def cargar_sectores():
    print("\n📍 Cargando SECTORES...")
    sectores_file = os.path.join(DATA_DIR, "Sectores.csv")

    if not os.path.exists(sectores_file):
        print(f"  ❌ No encontrado: {sectores_file}")
        return {}

    sectores_map = {}
    with open(sectores_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            nombre = row["nombre"].strip()
            cursor.execute(
                "INSERT INTO catalog_sectores (nombre, descripcion, activo) VALUES (?, ?, ?)",
                (nombre, row.get("descripcion", "").strip(), int(row.get("activo", 1))),
            )
            sectores_map[nombre] = cursor.lastrowid
            print(f"  ✓ {nombre}")

    conn.commit()
    return sectores_map


# =====================================================================
# 4. CARGAR ALMACENES
# =====================================================================
def cargar_almacenes():
    print("\n🏪 Cargando ALMACENES...")
    almacenes_file = os.path.join(DATA_DIR, "Almacenes.csv")

    if not os.path.exists(almacenes_file):
        print(f"  ❌ No encontrado: {almacenes_file}")
        return {}

    almacenes_map = {}
    with open(almacenes_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            codigo = row["codigo"].strip()
            nombre = row["nombre"].strip()
            cursor.execute(
                "INSERT INTO catalog_almacenes (codigo, nombre, descripcion, activo) VALUES (?, ?, ?, ?)",
                (codigo, nombre, row.get("descripcion", "").strip(), int(row.get("activo", 1))),
            )
            almacenes_map[codigo] = cursor.lastrowid
            print(f"  ✓ {codigo} - {nombre}")

    conn.commit()
    return almacenes_map


# =====================================================================
# 5. CARGAR PUESTOS
# =====================================================================
def cargar_puestos():
    print("\n💼 Cargando PUESTOS...")
    puestos_file = os.path.join(DATA_DIR, "Puestos.csv")

    if not os.path.exists(puestos_file):
        print(f"  ❌ No encontrado: {puestos_file}")
        return {}

    puestos_map = {}
    with open(puestos_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            nombre = row["nombre"].strip()
            cursor.execute(
                "INSERT INTO catalog_puestos (nombre, descripcion, activo) VALUES (?, ?, ?)",
                (nombre, row.get("descripcion", "").strip(), int(row.get("activo", 1))),
            )
            puestos_map[nombre] = cursor.lastrowid
            print(f"  ✓ {nombre}")

    conn.commit()
    return puestos_map


# =====================================================================
# 6. CARGAR USUARIOS
# =====================================================================
def cargar_usuarios(roles_map):
    print("\n👥 Cargando USUARIOS...")
    usuarios_file = os.path.join(DATA_DIR, "Usuarios.csv")

    if not os.path.exists(usuarios_file):
        print(f"  ❌ No encontrado: {usuarios_file}")
        return {}

    usuarios_map = {}

    # Leer con separador ';'
    with open(usuarios_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            id_spm = row["ID SPM"].strip()
            apellido = row["Apellido"].strip()
            nombre = row["Nombre"].strip()
            mail = row["Mail"].strip()
            contrasena = row["Contraseña"].strip()
            posicion = row["Posicion"].strip()
            sector = row["Sector"].strip()
            centros = row["Centro"].strip()
            jefe = row["Jefe"].strip() if row.get("Jefe") else None
            gerente1 = row["Gerente1"].strip() if row.get("Gerente1") else None
            gerente2 = row["Gerente2"].strip() if row.get("Gerente2") else None
            telefono = row["Telefono"].strip() if row.get("Telefono") else None
            estado_registro = (
                row["Estado registro"].strip() if row.get("Estado registro") else "Activo"
            )
            id_ypf = row["ID YPF"].strip() if row.get("ID YPF") else None

            # Usar el rol tal como viene en el archivo
            rol = row["Rol"].strip()

            cursor.execute(
                """INSERT INTO usuarios
                   (id_spm, apellido, nombre, mail, contrasena, rol, posicion, sector, centros,
                    jefe, gerente1, gerente2, telefono, estado_registro, id_ypf)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    id_spm,
                    apellido,
                    nombre,
                    mail,
                    contrasena,
                    rol,
                    posicion,
                    sector,
                    centros,
                    jefe,
                    gerente1,
                    gerente2,
                    telefono,
                    estado_registro,
                    id_ypf,
                ),
            )
            usuarios_map[id_spm] = id_spm  # Mapear por id_spm
            print(f"  ✓ {id_spm} - {nombre} {apellido} ({mail})")

    conn.commit()
    return usuarios_map


# =====================================================================
# 7. CARGAR MATERIALES
# =====================================================================
def cargar_materiales():
    print("\n📦 Cargando MATERIALES...")
    materiales_file = os.path.join(DATA_DIR, "Materiales.csv.bak")

    if not os.path.exists(materiales_file):
        print(f"  ❌ No encontrado: {materiales_file}")
        return {}

    materiales_map = {}
    contador = 0

    try:
        with open(materiales_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")

            material_actual = None
            material_detalle = []

            for row in reader:
                linea = row.get("Linea", "").strip()
                material = row.get("Material", "").strip()
                texto_breve = row.get("Texto breve material", "").strip()
                unidad = row.get("Unidad de Medida", "").strip()
                precio = row.get("Precio USD", "").strip()

                # Si es línea 1, es un nuevo material
                if linea == "1" and material:
                    # Insertar material anterior si existe
                    if material_actual:
                        desc_completa = (
                            " | ".join(material_detalle)
                            if material_detalle
                            else material_actual["texto_breve"]
                        )
                        try:
                            precio_float = float(material_actual.get("precio", 0).replace(",", "."))
                        except:
                            precio_float = 0.0

                        cursor.execute(
                            """INSERT INTO materiales
                               (codigo, descripcion, texto_breve, unidad, precio_usd, activo, created_at, updated_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                material_actual["codigo"],
                                desc_completa,
                                material_actual["texto_breve"],
                                material_actual.get("unidad", "UNI"),
                                precio_float,
                                1,
                                datetime.now().isoformat(),
                                datetime.now().isoformat(),
                            ),
                        )
                        materiales_map[material_actual["codigo"]] = cursor.lastrowid
                        contador += 1
                        if contador <= 10 or contador % 100 == 0:
                            print(f"  ✓ Material {contador}: {material_actual['codigo']}")

                    # Iniciar nuevo material
                    material_actual = {
                        "codigo": material,
                        "texto_breve": texto_breve,
                        "unidad": unidad,
                        "precio": precio,
                    }
                    material_detalle = [texto_breve] if texto_breve else []

                elif linea != "1" and material_actual:
                    # Es una línea de detalle
                    texto_completo = row.get("Texto completo material Español", "").strip()
                    if texto_completo:
                        material_detalle.append(texto_completo)

            # Insertar el último material
            if material_actual:
                desc_completa = (
                    " | ".join(material_detalle)
                    if material_detalle
                    else material_actual["texto_breve"]
                )
                try:
                    precio_float = float(material_actual.get("precio", 0).replace(",", "."))
                except:
                    precio_float = 0.0

                cursor.execute(
                    """INSERT INTO materiales
                       (codigo, descripcion, texto_breve, unidad, precio_usd, activo, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        material_actual["codigo"],
                        desc_completa,
                        material_actual["texto_breve"],
                        material_actual.get("unidad", "UNI"),
                        precio_float,
                        1,
                        datetime.now().isoformat(),
                        datetime.now().isoformat(),
                    ),
                )
                materiales_map[material_actual["codigo"]] = cursor.lastrowid
                contador += 1

    except Exception as e:
        print(f"  ⚠ Error cargando materiales: {e}")

    print(f"  ✓ Total de materiales cargados: {contador}")
    conn.commit()
    return materiales_map


# =====================================================================
# 8. CARGAR PRESUPUESTOS
# =====================================================================
def cargar_presupuestos(centros_map, sectores_map):
    print("\n💰 Cargando PRESUPUESTOS...")
    presupuestos_file = os.path.join(DATA_DIR, "Presupuestos.csv")

    if not os.path.exists(presupuestos_file):
        print(f"  ❌ No encontrado: {presupuestos_file}")
        return

    with open(presupuestos_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            centro_cod = row["Centro"].strip()
            sector_nom = row["Sector"].strip()
            monto = float(row["Monto USD"].replace(",", "."))
            saldo = float(row["Saldo USD"].replace(",", "."))

            # Buscar IDs
            centro_id = centros_map.get(centro_cod)
            sector_id = sectores_map.get(sector_nom)

            if centro_id and sector_id:
                cursor.execute(
                    """INSERT INTO presupuestos
                       (centro_id, sector_id, monto_usd, saldo_usd, activo, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        centro_id,
                        sector_id,
                        monto,
                        saldo,
                        1,
                        datetime.now().isoformat(),
                        datetime.now().isoformat(),
                    ),
                )
                print(f"  ✓ {centro_cod}/{sector_nom}: ${monto:,.2f}")

    conn.commit()


# =====================================================================
# 9. CARGAR SOLICITUDES
# =====================================================================
def cargar_solicitudes(usuarios_map, centros_map, sectores_map):
    print("\n📝 Cargando SOLICITUDES...")
    solicitudes_file = os.path.join(DATA_DIR, "solicitudes_export.csv")

    if not os.path.exists(solicitudes_file):
        print(f"  ❌ No encontrado: {solicitudes_file}")
        return

    with open(solicitudes_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                id_usuario = row["id_usuario"].strip()
                centro_cod = row["centro"].strip()
                sector_nom = row["sector"].strip()
                justificacion = row["justificacion"].strip()
                status = row["status"].strip()
                total_monto = float(row["total_monto"])
                criticidad = row.get("criticidad", "Normal").strip()
                fecha_necesidad = row.get("fecha_necesidad", datetime.now().isoformat()).strip()

                # Buscar IDs
                usuario_id = usuarios_map.get(id_usuario)
                centro_id = centros_map.get(centro_cod)
                sector_id = sectores_map.get(sector_nom)
                aprobador_id = None
                if row.get("aprobador_id"):
                    aprobador_str = row["aprobador_id"].strip()
                    aprobador_id = usuarios_map.get(aprobador_str)

                # Guardar data_json original
                data_json = row.get("data_json", "{}")

                if usuario_id and centro_id and sector_id:
                    cursor.execute(
                        """INSERT INTO solicitudes
                           (usuario_id, centro_id, sector_id, justificacion, status, total_monto,
                            criticidad, fecha_necesidad, aprobador_id, data_json, created_at, updated_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            usuario_id,
                            centro_id,
                            sector_id,
                            justificacion,
                            status,
                            total_monto,
                            criticidad,
                            fecha_necesidad,
                            aprobador_id,
                            data_json,
                            datetime.now().isoformat(),
                            datetime.now().isoformat(),
                        ),
                    )
                    print(f"  ✓ Solicitud #{row['id']} - {status} - ${total_monto:,.2f}")
            except Exception as e:
                print(f"  ⚠ Error en solicitud: {e}")

    conn.commit()


# =====================================================================
# EJECUCIÓN PRINCIPAL
# =====================================================================

try:
    # Limpiar BD
    limpiar_tablas()

    # Cargar en orden de dependencias
    roles_map = cargar_roles()
    centros_map = cargar_centros()
    sectores_map = cargar_sectores()
    almacenes_map = cargar_almacenes()
    puestos_map = cargar_puestos()
    usuarios_map = cargar_usuarios(roles_map)
    materiales_map = cargar_materiales()
    cargar_presupuestos(centros_map, sectores_map)
    cargar_solicitudes(usuarios_map, centros_map, sectores_map)

    # Estadísticas finales
    print("\n" + "=" * 80)
    print("✅ POBLACIÓN COMPLETADA CON ÉXITO")
    print("=" * 80)

    # Contar registros
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

    print("\n✨ ¡La base de datos está lista para usar!\n")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback

    traceback.print_exc()

finally:
    conn.close()
