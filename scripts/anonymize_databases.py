#!/usr/bin/env python3
"""
Script de Anonimizacion de Datos
================================
Reemplaza datos sensibles de YPF S.A. con datos ficticios para demo.

Uso:
    python scripts/anonymize_databases.py

El script procesa las siguientes bases de datos:
- data/spm.db (usuarios, solicitudes, presupuestos, etc.)
- data/sap_data.db (stock, consumo historico)
- data/catalogo_materiales.db (catalogo de materiales)
- data/equivalentes.db (equivalencias de materiales)

IMPORTANTE: Crear backup antes de ejecutar!
"""

import sqlite3
import os
import sys
from pathlib import Path

# Directorio base del proyecto
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

# =============================================================================
# MAPEO DE ANONIMIZACION
# =============================================================================

# Centros: codigo original -> codigo nuevo
CENTRO_CODES = {
    "1008": "AA101",
    "1050": "AA102",
    "1064": "AA103",
    "1500": "AA104",
    "1501": "AA105",
    "1502": "AA106",
}

# Centros: nombre original -> nombre nuevo
CENTRO_NAMES = {
    "UP Loma La Lata": "Deposito 1",
    "UP UTE Rio Neuquen": "Deposito 2",
    "UP UTE Río Neuquén": "Deposito 2",
    "UP Anelo": "Deposito 3",
    "MID Loma La Lata": "Deposito 4",
    "MID Sierra Barrosa": "Deposito 5",
    "MID El Porton": "Deposito 6",
    "MID El Portón": "Deposito 6",
    "Loma La Lata": "Zona Industrial",
    "Sierra Barrosa": "Zona Comercial",
    "El Porton": "Zona Logistica",
    "El Portón": "Zona Logistica",
    "Anelo": "Sector Este",
    "Rio Neuquen": "Rio Central",
    "Río Neuquén": "Rio Central",
}

# Usuarios: nombre completo original -> datos nuevos
USUARIOS = {
    "Manu Remon": {"nombre": "Admin", "apellido": "Demo"},
    "Manuel Remon": {"nombre": "Admin", "apellido": "Demo"},
    "Laura Planner": {"nombre": "Laura", "apellido": "Planificador"},
    "Sergio Planner": {"nombre": "Sergio", "apellido": "Planificador"},
    "Carlos Perez": {"nombre": "Carlos", "apellido": "Usuario"},
    "Carlos Pérez": {"nombre": "Carlos", "apellido": "Usuario"},
    "Maria Lopez": {"nombre": "Maria", "apellido": "Aprobador"},
    "María López": {"nombre": "Maria", "apellido": "Aprobador"},
    "Andres Garcia": {"nombre": "Andres", "apellido": "Gerente"},
    "Andrés García": {"nombre": "Andres", "apellido": "Gerente"},
    "Luis Lopez": {"nombre": "Luis", "apellido": "Gerente"},
    "Luis López": {"nombre": "Luis", "apellido": "Gerente"},
    "Juan Levi": {"nombre": "Juan", "apellido": "Usuario"},
    "Pedro Mamani": {"nombre": "Pedro", "apellido": "Usuario"},
    "Roberto Rosas": {"nombre": "Roberto", "apellido": "Usuario"},
}

# Proveedores externos
PROVEEDORES_EXT = {
    "Ferreteria Industrial S.A.": "Proveedor Industrial A",
    "Ferretería Industrial S.A.": "Proveedor Industrial A",
    "Bombas y Valvulas SRL": "Proveedor Tecnico B",
    "Bombas y Válvulas SRL": "Proveedor Tecnico B",
    "Importadora Tecnica": "Proveedor Importador C",
    "Importadora Técnica": "Proveedor Importador C",
    "Suministros Petroleros Neuquen": "Proveedor Regional D",
    "Suministros Petroleros Neuquén": "Proveedor Regional D",
    "Valvulas y Accesorios S.R.L.": "Proveedor Accesorios E",
    "Válvulas y Accesorios S.R.L.": "Proveedor Accesorios E",
    "Metalurgica del Sur": "Proveedor Metalurgico F",
    "Metalúrgica del Sur": "Proveedor Metalurgico F",
    "Distribuidora Tecnica Patagonia": "Proveedor Distribuidor G",
    "Distribuidora Técnica Patagonia": "Proveedor Distribuidor G",
    "Importadora de Repuestos S.A.": "Proveedor Repuestos H",
    "Bombas y Compresores Ltda.": "Proveedor Bombas I",
    "Seguridad Industrial Arg": "Proveedor Seguridad J",
}

# Proveedores internos (almacenes YPF)
PROVEEDORES_INT = {
    "Electricidad Industrial YPF": "Almacen Electrico Interno",
    "Almacen Central Loma La Lata": "Almacen Central Norte",
    "Almacén Central Loma La Lata": "Almacen Central Norte",
    "Taller Mecanico Central": "Taller Mecanico Interno",
    "Taller Mecánico Central": "Taller Mecanico Interno",
}

# Geografias
GEOGRAFIAS = {
    "Neuquen": "Ciudad Norte",
    "Neuquén": "Ciudad Norte",
    "Cipolletti": "Ciudad Sur",
    "Cutral Co": "Ciudad Oeste",
    "Cutral Có": "Ciudad Oeste",
    "Plaza Huincul": "Ciudad Centro",
    "Centenario": "Ciudad Este",
    "Plottier": "Localidad A",
    "Senillosa": "Localidad B",
    "Argentina": "Pais Demo",
}

# Textos generales a reemplazar
TEXTOS_GENERALES = {
    "YPF": "ACME Energy",
    "ypf": "acme energy",
    "Yacimientos Petroliferos Fiscales": "ACME Energy Corp",
    "Yacimientos Petrolíferos Fiscales": "ACME Energy Corp",
}

# Emails
EMAIL_DOMAIN_OLD = "@spm.local"
EMAIL_DOMAIN_NEW = "@demo.local"

# Telefonos (patron argentino Neuquen)
TELEFONOS = {
    "2994565456": "5550001234",
    "299": "555",  # Prefijo area
}


def replace_text(text, mappings):
    """Reemplaza textos segun mapeo."""
    if text is None:
        return None
    result = str(text)
    for old, new in mappings.items():
        result = result.replace(old, new)
    return result


def anonymize_spm_db():
    """Anonimiza la base de datos principal spm.db"""
    db_path = DATA_DIR / "spm.db"
    if not db_path.exists():
        print(f"  [SKIP] {db_path} no existe")
        return

    print(f"\n  Procesando {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Obtener lista de tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"  Tablas encontradas: {len(tables)}")

    # 1. Actualizar usuarios
    if "usuarios" in tables:
        print("    - Actualizando usuarios...")
        cursor.execute("SELECT id_spm, nombre, apellido, mail, telefono FROM usuarios")
        for row in cursor.fetchall():
            id_spm, nombre, apellido, mail, telefono = row
            nombre_completo = f"{nombre} {apellido}" if nombre and apellido else ""

            nuevo_nombre = nombre
            nuevo_apellido = apellido

            # Buscar en mapeo de usuarios
            for orig, datos in USUARIOS.items():
                if orig.lower() in nombre_completo.lower():
                    nuevo_nombre = datos["nombre"]
                    nuevo_apellido = datos["apellido"]
                    break

            # Actualizar email
            nuevo_mail = mail
            if mail and EMAIL_DOMAIN_OLD in mail:
                nuevo_mail = mail.replace(EMAIL_DOMAIN_OLD, EMAIL_DOMAIN_NEW)

            # Actualizar telefono
            nuevo_telefono = replace_text(telefono, TELEFONOS) if telefono else None

            cursor.execute("""
                UPDATE usuarios
                SET nombre = ?, apellido = ?, mail = ?, telefono = ?, id_ypf = NULL
                WHERE id_spm = ?
            """, (nuevo_nombre, nuevo_apellido, nuevo_mail, nuevo_telefono, id_spm))

        conn.commit()
        print(f"      Usuarios actualizados")

    # 2. Actualizar catalog_centros
    if "catalog_centros" in tables:
        print("    - Actualizando catalog_centros...")
        cursor.execute("SELECT codigo, nombre FROM catalog_centros")
        for row in cursor.fetchall():
            codigo_orig, nombre_orig = row
            codigo_nuevo = CENTRO_CODES.get(codigo_orig, codigo_orig)
            nombre_nuevo = replace_text(nombre_orig, CENTRO_NAMES)
            nombre_nuevo = replace_text(nombre_nuevo, TEXTOS_GENERALES)

            cursor.execute("""
                UPDATE catalog_centros SET codigo = ?, nombre = ?
                WHERE codigo = ?
            """, (codigo_nuevo, nombre_nuevo, codigo_orig))
        conn.commit()

    # 3. Actualizar presupuestos (centro)
    if "presupuestos" in tables:
        print("    - Actualizando presupuestos...")
        for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
            cursor.execute("UPDATE presupuestos SET centro = ? WHERE centro = ?",
                          (codigo_nuevo, codigo_orig))
        conn.commit()

    # 4. Actualizar presupuesto_ledger
    if "presupuesto_ledger" in tables:
        print("    - Actualizando presupuesto_ledger...")
        for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
            cursor.execute("UPDATE presupuesto_ledger SET centro = ? WHERE centro = ?",
                          (codigo_nuevo, codigo_orig))

        # Actualizar motivo si contiene referencias
        cursor.execute("SELECT id, motivo FROM presupuesto_ledger WHERE motivo IS NOT NULL")
        for row in cursor.fetchall():
            id_row, motivo = row
            nuevo_motivo = replace_text(motivo, CENTRO_NAMES)
            nuevo_motivo = replace_text(nuevo_motivo, TEXTOS_GENERALES)
            nuevo_motivo = replace_text(nuevo_motivo, GEOGRAFIAS)
            if nuevo_motivo != motivo:
                cursor.execute("UPDATE presupuesto_ledger SET motivo = ? WHERE id = ?",
                              (nuevo_motivo, id_row))
        conn.commit()

    # 5. Actualizar solicitudes
    if "solicitudes" in tables:
        print("    - Actualizando solicitudes...")
        for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
            cursor.execute("UPDATE solicitudes SET centro = ? WHERE centro = ?",
                          (codigo_nuevo, codigo_orig))

        # Actualizar justificacion
        cursor.execute("SELECT id, justificacion FROM solicitudes WHERE justificacion IS NOT NULL")
        for row in cursor.fetchall():
            id_row, justificacion = row
            nueva = replace_text(justificacion, CENTRO_NAMES)
            nueva = replace_text(nueva, TEXTOS_GENERALES)
            nueva = replace_text(nueva, GEOGRAFIAS)
            if nueva != justificacion:
                cursor.execute("UPDATE solicitudes SET justificacion = ? WHERE id = ?",
                              (nueva, id_row))
        conn.commit()

    # 6. Actualizar proveedores_externos (PK: cuit)
    if "proveedores_externos" in tables:
        print("    - Actualizando proveedores_externos...")
        cursor.execute("SELECT cuit, nombre, direccion, localidad FROM proveedores_externos")
        for row in cursor.fetchall():
            cuit, nombre, direccion, localidad = row
            nuevo_nombre = replace_text(nombre, PROVEEDORES_EXT)
            nuevo_nombre = replace_text(nuevo_nombre, TEXTOS_GENERALES)
            nueva_direccion = replace_text(direccion, GEOGRAFIAS) if direccion else None
            nueva_localidad = replace_text(localidad, GEOGRAFIAS) if localidad else None

            cursor.execute("""
                UPDATE proveedores_externos
                SET nombre = ?, direccion = ?, localidad = ?
                WHERE cuit = ?
            """, (nuevo_nombre, nueva_direccion, nueva_localidad, cuit))
        conn.commit()

    # 7. Actualizar proveedores_internos (PK: centro, almacen)
    if "proveedores_internos" in tables:
        print("    - Actualizando proveedores_internos...")
        # Primero actualizar codigos de centro
        for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
            cursor.execute("UPDATE proveedores_internos SET centro = ? WHERE centro = ?",
                          (codigo_nuevo, codigo_orig))

        # Luego actualizar nombres
        cursor.execute("SELECT centro, almacen, centro_nombre, almacen_nombre, referente_nombre, referente_email FROM proveedores_internos")
        for row in cursor.fetchall():
            centro, almacen, centro_nombre, almacen_nombre, ref_nombre, ref_email = row
            nuevo_centro_nombre = replace_text(centro_nombre, CENTRO_NAMES) if centro_nombre else None
            nuevo_centro_nombre = replace_text(nuevo_centro_nombre, TEXTOS_GENERALES) if nuevo_centro_nombre else None
            nuevo_almacen_nombre = replace_text(almacen_nombre, PROVEEDORES_INT) if almacen_nombre else None
            nuevo_almacen_nombre = replace_text(nuevo_almacen_nombre, CENTRO_NAMES) if nuevo_almacen_nombre else None
            nuevo_almacen_nombre = replace_text(nuevo_almacen_nombre, TEXTOS_GENERALES) if nuevo_almacen_nombre else None
            nuevo_ref_email = ref_email.replace(EMAIL_DOMAIN_OLD, EMAIL_DOMAIN_NEW) if ref_email and EMAIL_DOMAIN_OLD in ref_email else ref_email

            cursor.execute("""
                UPDATE proveedores_internos
                SET centro_nombre = ?, almacen_nombre = ?, referente_email = ?
                WHERE centro = ? AND almacen = ?
            """, (nuevo_centro_nombre, nuevo_almacen_nombre, nuevo_ref_email, centro, almacen))
        conn.commit()

    # 8. Actualizar mensajes
    if "mensajes" in tables:
        print("    - Actualizando mensajes...")
        cursor.execute("SELECT id, asunto, mensaje FROM mensajes")
        for row in cursor.fetchall():
            id_row, asunto, mensaje = row
            nuevo_asunto = replace_text(asunto, TEXTOS_GENERALES) if asunto else None
            nuevo_asunto = replace_text(nuevo_asunto, CENTRO_NAMES) if nuevo_asunto else None
            nuevo_mensaje = replace_text(mensaje, TEXTOS_GENERALES) if mensaje else None
            nuevo_mensaje = replace_text(nuevo_mensaje, CENTRO_NAMES) if nuevo_mensaje else None
            nuevo_mensaje = replace_text(nuevo_mensaje, GEOGRAFIAS) if nuevo_mensaje else None

            cursor.execute("UPDATE mensajes SET asunto = ?, mensaje = ? WHERE id = ?",
                          (nuevo_asunto, nuevo_mensaje, id_row))
        conn.commit()

    # 9. Actualizar planificador_asignaciones
    if "planificador_asignaciones" in tables:
        print("    - Actualizando planificador_asignaciones...")
        for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
            cursor.execute("UPDATE planificador_asignaciones SET centro = ? WHERE centro = ?",
                          (codigo_nuevo, codigo_orig))
        conn.commit()

    # 10. Actualizar otras tablas con referencia a centro
    tablas_con_centro = [
        "budget_update_requests",
        "traslados",
        "solpeds",
        "purchase_orders",
    ]
    for tabla in tablas_con_centro:
        if tabla in tables:
            print(f"    - Actualizando {tabla}...")
            for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
                try:
                    cursor.execute(f"UPDATE {tabla} SET centro = ? WHERE centro = ?",
                                  (codigo_nuevo, codigo_orig))
                except sqlite3.OperationalError:
                    pass  # La columna puede no existir
            conn.commit()

    conn.close()
    print(f"  [OK] spm.db anonimizado")


def anonymize_sap_data_db():
    """Anonimiza sap_data.db (stock y consumo historico)"""
    db_path = DATA_DIR / "sap_data.db"
    if not db_path.exists():
        print(f"  [SKIP] {db_path} no existe")
        return

    print(f"\n  Procesando {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Obtener lista de tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"  Tablas encontradas: {tables}")

    # Actualizar centros en todas las tablas que tengan la columna
    for tabla in tables:
        cursor.execute(f"PRAGMA table_info({tabla})")
        columns = [col[1] for col in cursor.fetchall()]

        if "centro" in columns:
            print(f"    - Actualizando {tabla}.centro...")
            for codigo_orig, codigo_nuevo in CENTRO_CODES.items():
                cursor.execute(f"UPDATE {tabla} SET centro = ? WHERE centro = ?",
                              (codigo_nuevo, codigo_orig))
            conn.commit()

        # Buscar columnas de texto que puedan contener referencias
        text_columns = [c for c in columns if c in ["descripcion", "nombre", "observaciones", "comentario"]]
        for col in text_columns:
            print(f"    - Revisando {tabla}.{col}...")
            cursor.execute(f"SELECT rowid, {col} FROM {tabla} WHERE {col} IS NOT NULL")
            for row in cursor.fetchall():
                rowid, valor = row
                nuevo = replace_text(valor, TEXTOS_GENERALES)
                nuevo = replace_text(nuevo, CENTRO_NAMES)
                nuevo = replace_text(nuevo, GEOGRAFIAS)
                if nuevo != valor:
                    cursor.execute(f"UPDATE {tabla} SET {col} = ? WHERE rowid = ?",
                                  (nuevo, rowid))
            conn.commit()

    conn.close()
    print(f"  [OK] sap_data.db anonimizado")


def anonymize_catalogo_materiales_db():
    """Anonimiza catalogo_materiales.db"""
    db_path = DATA_DIR / "catalogo_materiales.db"
    if not db_path.exists():
        print(f"  [SKIP] {db_path} no existe")
        return

    print(f"\n  Procesando {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Obtener lista de tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"  Tablas encontradas: {tables}")

    # Revisar descripciones por referencias a YPF
    for tabla in tables:
        cursor.execute(f"PRAGMA table_info({tabla})")
        columns = [col[1] for col in cursor.fetchall()]

        text_columns = [c for c in columns if c in ["descripcion", "nombre", "observaciones", "texto"]]
        for col in text_columns:
            print(f"    - Revisando {tabla}.{col}...")
            cursor.execute(f"SELECT rowid, {col} FROM {tabla} WHERE {col} LIKE '%YPF%' OR {col} LIKE '%Neuqu%' OR {col} LIKE '%Loma La Lata%'")
            updates = 0
            for row in cursor.fetchall():
                rowid, valor = row
                nuevo = replace_text(valor, TEXTOS_GENERALES)
                nuevo = replace_text(nuevo, CENTRO_NAMES)
                nuevo = replace_text(nuevo, GEOGRAFIAS)
                if nuevo != valor:
                    cursor.execute(f"UPDATE {tabla} SET {col} = ? WHERE rowid = ?",
                                  (nuevo, rowid))
                    updates += 1
            if updates > 0:
                print(f"      {updates} registros actualizados")
            conn.commit()

    conn.close()
    print(f"  [OK] catalogo_materiales.db anonimizado")


def anonymize_equivalentes_db():
    """Anonimiza equivalentes.db (si tiene referencias)"""
    db_path = DATA_DIR / "equivalentes.db"
    if not db_path.exists():
        print(f"  [SKIP] {db_path} no existe")
        return

    print(f"\n  Procesando {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Obtener lista de tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"  Tablas encontradas: {tables}")

    # Buscar referencias a YPF en columnas de texto
    for tabla in tables:
        cursor.execute(f"PRAGMA table_info({tabla})")
        columns = [col[1] for col in cursor.fetchall()]

        for col in columns:
            # Solo revisar columnas que puedan ser texto
            cursor.execute(f"SELECT typeof({col}) FROM {tabla} LIMIT 1")
            tipo = cursor.fetchone()
            if tipo and tipo[0] == "text":
                cursor.execute(f"SELECT COUNT(*) FROM {tabla} WHERE {col} LIKE '%YPF%'")
                count = cursor.fetchone()[0]
                if count > 0:
                    print(f"    - Encontradas {count} referencias a YPF en {tabla}.{col}")
                    cursor.execute(f"SELECT rowid, {col} FROM {tabla} WHERE {col} LIKE '%YPF%'")
                    for row in cursor.fetchall():
                        rowid, valor = row
                        nuevo = replace_text(valor, TEXTOS_GENERALES)
                        cursor.execute(f"UPDATE {tabla} SET {col} = ? WHERE rowid = ?",
                                      (nuevo, rowid))
                    conn.commit()

    conn.close()
    print(f"  [OK] equivalentes.db anonimizado")


def main():
    """Funcion principal"""
    print("=" * 60)
    print("SCRIPT DE ANONIMIZACION DE DATOS")
    print("=" * 60)
    print(f"\nDirectorio de datos: {DATA_DIR}")

    # Verificar que existe el directorio
    if not DATA_DIR.exists():
        print(f"\n[ERROR] El directorio {DATA_DIR} no existe!")
        sys.exit(1)

    # Listar bases de datos encontradas
    dbs = list(DATA_DIR.glob("*.db"))
    print(f"\nBases de datos encontradas: {len(dbs)}")
    for db in dbs:
        size_mb = db.stat().st_size / (1024 * 1024)
        print(f"  - {db.name} ({size_mb:.1f} MB)")

    print("\n" + "-" * 60)
    print("INICIANDO ANONIMIZACION...")
    print("-" * 60)

    # Procesar cada base de datos
    anonymize_spm_db()
    anonymize_sap_data_db()
    anonymize_catalogo_materiales_db()
    anonymize_equivalentes_db()

    print("\n" + "=" * 60)
    print("ANONIMIZACION COMPLETADA")
    print("=" * 60)
    print("\nVerificar que no queden referencias ejecutando:")
    print("  grep -r 'YPF' data/")
    print("  grep -r 'Loma La Lata' data/")
    print("  grep -r 'Neuquen' data/")


if __name__ == "__main__":
    main()
