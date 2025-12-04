#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Genera datos de prueba para las 14 tablas vacías de la base de datos.
Basado en estructuras reales inspeccionadas del esquema.
"""

import json
import sqlite3
from datetime import datetime

DB_PATH = "src/backend/core/data/spm.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def insert_planificadores(conn):
    """Insertar planificadores de prueba"""
    print("\n📋 Insertando PLANIFICADORES...")
    cursor = conn.cursor()

    # Obtener usuarios existentes
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 2")
    usuarios = cursor.fetchall()

    if not usuarios or len(usuarios) < 2:
        print("  ⚠ No hay suficientes usuarios")
        return

    planificadores = [
        (usuarios[0][0], "Planificador Central"),
        (usuarios[1][0], "Planificador Adicional"),
    ]
    for usuario_id, nombre in planificadores:
        try:
            cursor.execute(
                """
                INSERT INTO planificadores (usuario_id, nombre, activo, created_at)
                VALUES (?, ?, 1, ?)
            """,
                (usuario_id, nombre, datetime.now().isoformat()),
            )
            print(f"  ✓ {nombre}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_planificador_asignaciones(conn):
    """Insertar asignaciones de planificadores"""
    print("\n📍 Insertando PLANIFICADOR_ASIGNACIONES...")
    cursor = conn.cursor()

    # Obtener planificadores para usar sus IDs
    cursor.execute("SELECT id FROM planificadores LIMIT 1")
    planificador = cursor.fetchone()

    if not planificador:
        print("  ⚠ No hay planificadores para asignar")
        return

    planificador_id = planificador[0]

    asignaciones = [
        (planificador_id, "1008", "Mantenimiento", "ALM0001", 1),
        (planificador_id, "1500", "Almacenes", "ALM0012", 2),
    ]

    for p_id, centro, sector, almacen, prioridad in asignaciones:
        try:
            cursor.execute(
                """
                INSERT INTO planificador_asignaciones
                (planificador_id, centro, sector, almacen_virtual, prioridad, activo, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
                (p_id, centro, sector, almacen, prioridad, datetime.now().isoformat()),
            )
            print(f"  ✓ Centro {centro} / {sector}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_solpeds(conn):
    """Insertar ítems de solicitudes (solpeds)"""
    print("\n📦 Insertando SOLPEDS...")
    cursor = conn.cursor()

    # Obtener solicitudes existentes
    cursor.execute("SELECT id FROM solicitudes LIMIT 3")
    solicitudes = cursor.fetchall()

    if not solicitudes:
        print("  ⚠ No hay solicitudes para crear solpeds")
        return

    solpeds_data = [
        (solicitudes[0][0], 1, "Bombas de agua", "UND", 2, 850.00),
        (solicitudes[0][0], 2, "Filtros hidráulicos", "UND", 4, 120.50),
        (solicitudes[1][0], 1, "Casings de acero", "MT", 100, 45.00),
        (solicitudes[2][0], 1, "Sellos mecánicos", "UND", 6, 200.00),
    ]

    for solicitud_id, item_index, material, um, cantidad, precio in solpeds_data:
        try:
            cursor.execute(
                """
                INSERT INTO solpeds
                (solicitud_id, item_index, material, um, cantidad, precio_unitario_est,
                 status, created_by, updated_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'creada', '1', ?, ?)
            """,
                (
                    solicitud_id,
                    item_index,
                    material,
                    um,
                    cantidad,
                    precio,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ Solicitud {solicitud_id} - {material}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_notificaciones(conn):
    """Insertar notificaciones de prueba"""
    print("\n🔔 Insertando NOTIFICACIONES...")
    cursor = conn.cursor()

    # Obtener usuarios existentes
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 3")
    usuarios = cursor.fetchall()

    # Obtener solicitudes existentes
    cursor.execute("SELECT id FROM solicitudes LIMIT 2")
    solicitudes = cursor.fetchall()

    if not usuarios or not solicitudes:
        print("  ⚠ Datos insuficientes para crear notificaciones")
        return

    notificaciones = [
        (usuarios[0][0], solicitudes[0][0], "Solicitud #1 requiere aprobación"),
        (usuarios[1][0], solicitudes[0][0], "Solicitud #1 fue aprobada"),
        (usuarios[0][0], solicitudes[1][0], "Solicitud #2 fue actualizada"),
    ]

    for destinatario_id, solicitud_id, mensaje in notificaciones:
        try:
            cursor.execute(
                """
                INSERT INTO notificaciones
                (destinatario_id, solicitud_id, mensaje, leido, created_at)
                VALUES (?, ?, ?, 0, ?)
            """,
                (destinatario_id, solicitud_id, mensaje, datetime.now().isoformat()),
            )
            print(f"  ✓ Notificación para usuario {destinatario_id}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_outbox_emails(conn):
    """Insertar correos en la cola de salida"""
    print("\n📧 Insertando OUTBOX_EMAILS...")
    cursor = conn.cursor()

    emails = [
        (
            "juanlevi@ypf.com",
            "Solicitud de aprobación #1",
            "Se requiere aprobación de solicitud",
            "[]",
        ),
        (
            "robertorosas@ypf.com",
            "Solicitud de aprobación #2",
            "Solicitud pendiente de revisión",
            "[]",
        ),
        (
            "manuelremon@live.com.ar",
            "Reporte de solicitudes",
            "Resumen de solicitudes del día",
            "[]",
        ),
    ]

    for to_email, subject, body, attachments in emails:
        try:
            cursor.execute(
                """
                INSERT INTO outbox_emails
                (to_email, subject, body, attachments_json, status, created_at)
                VALUES (?, ?, ?, ?, 'queued', ?)
            """,
                (to_email, subject, body, attachments, datetime.now().isoformat()),
            )
            print(f"  ✓ Email a {to_email}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_archivos_adjuntos(conn):
    """Insertar archivos adjuntos de prueba"""
    print("\n📎 Insertando ARCHIVOS_ADJUNTOS...")
    cursor = conn.cursor()

    # Obtener solicitudes existentes
    cursor.execute("SELECT id FROM solicitudes LIMIT 1")
    solicitud = cursor.fetchone()

    # Obtener usuario
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 1")
    usuario = cursor.fetchone()

    if not solicitud or not usuario:
        print("  ⚠ Datos insuficientes para adjuntar archivos")
        return

    archivos = [
        (
            solicitud[0],
            "presupuesto_001.pdf",
            "presupuesto.pdf",
            "application/pdf",
            125000,
            "/uploads/presupuesto_001.pdf",
            usuario[0],
        ),
        (
            solicitud[0],
            "especificaciones.docx",
            "especificaciones.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            85000,
            "/uploads/especificaciones.docx",
            usuario[0],
        ),
        (
            solicitud[0],
            "fotografias.zip",
            "fotografias.zip",
            "application/zip",
            2500000,
            "/uploads/fotografias.zip",
            usuario[0],
        ),
    ]

    for (
        solicitud_id,
        nombre_archivo,
        nombre_original,
        tipo_mime,
        tamano,
        ruta,
        usuario_id,
    ) in archivos:
        try:
            cursor.execute(
                """
                INSERT INTO archivos_adjuntos
                (solicitud_id, nombre_archivo, nombre_original, tipo_mime, tamano_bytes,
                 ruta_archivo, usuario_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    solicitud_id,
                    nombre_archivo,
                    nombre_original,
                    tipo_mime,
                    tamano,
                    ruta,
                    usuario_id,
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ {nombre_original}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_presupuesto_incorporaciones(conn):
    """Insertar incorporaciones de presupuesto"""
    print("\n💰 Insertando PRESUPUESTO_INCORPORACIONES...")
    cursor = conn.cursor()

    # Obtener usuarios
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 2")
    usuarios = cursor.fetchall()

    if not usuarios or len(usuarios) < 2:
        print("  ⚠ No hay suficientes usuarios")
        return

    incorporaciones = [
        (
            "1008",
            "Mantenimiento",
            50000.00,
            "Ampliación presupuesto Q3",
            "pendiente",
            usuarios[0][0],
            usuarios[1][0],
        ),
        (
            "1500",
            "Almacenes",
            25000.00,
            "Reposición de ítems críticos",
            "aprobada",
            usuarios[0][0],
            usuarios[1][0],
        ),
    ]

    for centro, sector, monto, motivo, estado, solicitante_id, aprobador_id in incorporaciones:
        try:
            cursor.execute(
                """
                INSERT INTO presupuesto_incorporaciones
                (centro, sector, monto, motivo, estado, solicitante_id, aprobador_id,
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    centro,
                    sector,
                    monto,
                    motivo,
                    estado,
                    solicitante_id,
                    aprobador_id,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ {centro} - {motivo}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_purchase_orders(conn):
    """Insertar órdenes de compra"""
    print("\n🛒 Insertando PURCHASE_ORDERS...")
    cursor = conn.cursor()

    # Obtener solpeds existentes
    cursor.execute("SELECT id, solicitud_id FROM solpeds LIMIT 2")
    solpeds = cursor.fetchall()

    # Obtener usuario
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 1")
    usuario = cursor.fetchone()

    if not solpeds or not usuario:
        print("  ⚠ Datos insuficientes para crear órdenes de compra")
        return

    purchase_orders = [
        (
            solpeds[0][0],
            solpeds[0][1],
            "proveedor1@ejemplo.com",
            "Proveedor A",
            "PO-001",
            "emitida",
            1700.00,
            "USD",
            usuario[0],
        ),
        (
            solpeds[1][0],
            solpeds[1][1],
            "proveedor2@ejemplo.com",
            "Proveedor B",
            "PO-002",
            "emitida",
            482.00,
            "USD",
            usuario[0],
        ),
    ]

    for (
        solped_id,
        solicitud_id,
        proveedor_email,
        proveedor_nombre,
        numero,
        status,
        subtotal,
        moneda,
        created_by,
    ) in purchase_orders:
        try:
            cursor.execute(
                """
                INSERT INTO purchase_orders
                (solped_id, solicitud_id, proveedor_email, proveedor_nombre, numero,
                 status, subtotal, moneda, created_by, updated_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    solped_id,
                    solicitud_id,
                    proveedor_email,
                    proveedor_nombre,
                    numero,
                    status,
                    subtotal,
                    moneda,
                    created_by,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ {numero} - {proveedor_nombre}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_traslados(conn):
    """Insertar traslados de materiales"""
    print("\n🚚 Insertando TRASLADOS...")
    cursor = conn.cursor()

    # Obtener solicitudes
    cursor.execute("SELECT id FROM solicitudes LIMIT 2")
    solicitudes = cursor.fetchall()

    # Obtener usuario
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 1")
    usuario = cursor.fetchone()

    if not solicitudes or not usuario:
        print("  ⚠ Datos insuficientes para crear traslados")
        return

    traslados = [
        (
            solicitudes[0][0],
            1,
            "Bombas de agua",
            "UND",
            2,
            "1008",
            "ALM0001",
            "1500",
            "ALM0012",
            "planificado",
            "Ref-001",
            usuario[0],
        ),
        (
            solicitudes[1][0],
            1,
            "Casings",
            "MT",
            50,
            "1500",
            "ALM0012",
            "1008",
            "ALM0001",
            "completado",
            "Ref-002",
            usuario[0],
        ),
    ]

    for (
        solicitud_id,
        item_index,
        material,
        um,
        cantidad,
        origen_centro,
        origen_almacen,
        destino_centro,
        destino_almacen,
        status,
        referencia,
        created_by,
    ) in traslados:
        try:
            cursor.execute(
                """
                INSERT INTO traslados
                (solicitud_id, item_index, material, um, cantidad, origen_centro,
                 origen_almacen, destino_centro, destino_almacen, status, referencia,
                 created_by, updated_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    solicitud_id,
                    item_index,
                    material,
                    um,
                    cantidad,
                    origen_centro,
                    origen_almacen,
                    destino_centro,
                    destino_almacen,
                    status,
                    referencia,
                    created_by,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ {solicitud_id} - {material}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_solicitud_items_tratamiento(conn):
    """Insertar ítems de tratamiento de solicitudes"""
    print("\n⚙️  Insertando SOLICITUD_ITEMS_TRATAMIENTO...")
    cursor = conn.cursor()

    # Obtener solpeds
    cursor.execute("SELECT solicitud_id, item_index FROM solpeds LIMIT 3")
    solpeds = cursor.fetchall()

    # Obtener usuario
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 1")
    usuario = cursor.fetchone()

    if not solpeds or not usuario:
        print("  ⚠ Datos insuficientes para crear tratamientos")
        return

    for solicitud_id, item_index in solpeds:
        try:
            cursor.execute(
                """
                INSERT INTO solicitud_items_tratamiento
                (solicitud_id, item_index, decision, cantidad_aprobada,
                 codigo_equivalente, proveedor_sugerido, precio_unitario_estimado,
                 comentario, updated_by, updated_at)
                VALUES (?, ?, 'aprobado', ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    solicitud_id,
                    item_index,
                    100.0,
                    "EQUIV-001",
                    "Proveedor A",
                    150.00,
                    "Aprobado en tratamiento",
                    usuario[0],
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ Solicitud {solicitud_id} - Item {item_index}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_solicitud_tratamiento_log(conn):
    """Insertar logs de tratamiento de solicitudes"""
    print("\n📝 Insertando SOLICITUD_TRATAMIENTO_LOG...")
    cursor = conn.cursor()

    # Obtener solicitudes
    cursor.execute("SELECT id FROM solicitudes LIMIT 2")
    solicitudes = cursor.fetchall()

    # Obtener usuarios
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 2")
    usuarios = cursor.fetchall()

    if not solicitudes or len(usuarios) < 2:
        print("  ⚠ Datos insuficientes para crear logs")
        return

    logs = [
        (
            solicitudes[0][0],
            1,
            usuarios[0][0],
            "revision",
            "en_revision",
            json.dumps({"motivo": "Revisión inicial"}),
        ),
        (
            solicitudes[0][0],
            2,
            usuarios[0][0],
            "aprobacion",
            "aprobado",
            json.dumps({"motivo": "Presupuesto disponible"}),
        ),
        (
            solicitudes[1][0],
            1,
            usuarios[1][0],
            "rechazo",
            "rechazado",
            json.dumps({"motivo": "No hay presupuesto"}),
        ),
    ]

    for solicitud_id, item_index, actor_id, tipo, estado, payload in logs:
        try:
            cursor.execute(
                """
                INSERT INTO solicitud_tratamiento_log
                (solicitud_id, item_index, actor_id, tipo, estado, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    solicitud_id,
                    item_index,
                    actor_id,
                    tipo,
                    estado,
                    payload,
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ {tipo} - Solicitud {solicitud_id}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_solicitud_tratamiento_eventos(conn):
    """Insertar eventos de tratamiento de solicitudes"""
    print("\n📢 Insertando SOLICITUD_TRATAMIENTO_EVENTOS...")
    cursor = conn.cursor()

    # Obtener solicitudes y planificadores
    cursor.execute("SELECT id FROM solicitudes LIMIT 2")
    solicitudes = cursor.fetchall()

    # Obtener planificador
    cursor.execute("SELECT id FROM planificadores LIMIT 1")
    planificador = cursor.fetchone()

    if not solicitudes or not planificador:
        print("  ⚠ Datos insuficientes para crear eventos")
        return

    eventos = [
        (
            solicitudes[0][0],
            str(planificador[0]),
            "creacion",
            json.dumps({"accion": "Solicitud creada"}),
        ),
        (
            solicitudes[0][0],
            str(planificador[0]),
            "envio_aprobacion",
            json.dumps({"accion": "Enviado a aprobación"}),
        ),
        (
            solicitudes[1][0],
            str(planificador[0]),
            "recepcion",
            json.dumps({"accion": "Recibido por planner"}),
        ),
    ]

    for solicitud_id, planner_id, tipo, payload in eventos:
        try:
            cursor.execute(
                """
                INSERT INTO solicitud_tratamiento_eventos
                (solicitud_id, planner_id, tipo, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?)
            """,
                (solicitud_id, planner_id, tipo, payload, datetime.now().isoformat()),
            )
            print(f"  ✓ {tipo} - Solicitud {solicitud_id}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_user_profile_requests(conn):
    """Insertar solicitudes de cambio de perfil"""
    print("\n👤 Insertando USER_PROFILE_REQUESTS...")
    cursor = conn.cursor()

    # Obtener usuarios
    cursor.execute("SELECT id_spm FROM usuarios LIMIT 3")
    usuarios = cursor.fetchall()

    if len(usuarios) < 3:
        print("  ⚠ No hay suficientes usuarios")
        return

    profile_requests = [
        (usuarios[0][0], "role_change", json.dumps({"nueva_rol": "Aprobador"}), "pendiente"),
        (usuarios[1][0], "role_change", json.dumps({"nueva_rol": "Planificador"}), "aprobada"),
        (
            usuarios[2][0],
            "data_change",
            json.dumps({"nuevo_email": "newemail@ypf.com"}),
            "rechazada",
        ),
    ]

    for usuario_id, tipo, payload, estado in profile_requests:
        try:
            cursor.execute(
                """
                INSERT INTO user_profile_requests
                (usuario_id, tipo, payload, estado, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (
                    usuario_id,
                    tipo,
                    payload,
                    estado,
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                ),
            )
            print(f"  ✓ {tipo} - Usuario {usuario_id}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    conn.commit()


def insert_schema_migrations(conn):
    """Insertar historial de migraciones"""
    print("\n🔄 Insertando SCHEMA_MIGRATIONS...")
    cursor = conn.cursor()

    migrations = [
        (1,),
        (2,),
        (3,),
    ]

    for (version,) in migrations:
        try:
            cursor.execute(
                """
                INSERT INTO schema_migrations (version, applied_at)
                VALUES (?, ?)
            """,
                (version, datetime.now().isoformat()),
            )
            print(f"  ✓ Migration v{version}")
        except Exception as e:
            # Ignorar si ya existe
            if "UNIQUE constraint failed" not in str(e):
                print(f"  ✗ Error: {e}")

    conn.commit()


def main():
    print("=" * 70)
    print("🗂️  GENERADOR DE DATOS DE PRUEBA - TABLAS VACÍAS")
    print("=" * 70)

    try:
        conn = get_connection()

        # Insertar en orden de dependencias
        insert_planificadores(conn)
        insert_planificador_asignaciones(conn)
        insert_solpeds(conn)
        insert_notificaciones(conn)
        insert_outbox_emails(conn)
        insert_archivos_adjuntos(conn)
        insert_presupuesto_incorporaciones(conn)
        insert_purchase_orders(conn)
        insert_traslados(conn)
        insert_solicitud_items_tratamiento(conn)
        insert_solicitud_tratamiento_log(conn)
        insert_solicitud_tratamiento_eventos(conn)
        insert_user_profile_requests(conn)
        insert_schema_migrations(conn)

        conn.close()

        print("\n" + "=" * 70)
        print("✅ DATOS DE PRUEBA INSERTADOS EXITOSAMENTE")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
