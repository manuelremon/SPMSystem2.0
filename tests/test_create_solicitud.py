#!/usr/bin/env python3
"""
Script para crear una solicitud de prueba con materiales.
Esto nos permite validar el flujo completo: crear solicitud → agregar materiales → verificar BD
"""

import json
import os
import sys
from datetime import datetime, timedelta

# Agregar src al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.backend.core.db import get_connection


def crear_solicitud_prueba():
    """Crea una solicitud de prueba con materiales"""

    print("=" * 70)
    print("CREANDO SOLICITUD DE PRUEBA CON MATERIALES")
    print("=" * 70)

    # Datos de la solicitud
    usuario_id = "1"  # Usuario existente
    centro = "1008"
    sector = "Mantenimiento"
    justificacion = "Solicitud de prueba para verificar flujo"
    centro_costos = "TEST-001"
    almacen_virtual = "AV-TEST"
    criticidad = "Normal"
    fecha_necesidad = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")

    # Items/Materiales
    items = [
        {
            "codigo": "1000562340",
            "descripcion": "ABRAZADERA 6X10",
            "cantidad": 10,
            "precio_unitario": 1500.00,
            "comentario": "Para mantenimiento preventivo",
        },
        {
            "codigo": "1000028839",
            "descripcion": "RODAMIENTO NSK",
            "cantidad": 2,
            "precio_unitario": 5000.00,
            "comentario": "Reemplazo programado",
        },
    ]

    # Calcular total
    total_monto = sum(item["cantidad"] * item["precio_unitario"] for item in items)

    # Crear payload de data_json
    data_json = {
        "id_usuario": usuario_id,
        "centro": centro,
        "sector": sector,
        "justificacion": justificacion,
        "centro_costos": centro_costos,
        "almacen_virtual": almacen_virtual,
        "criticidad": criticidad,
        "fecha_necesidad": fecha_necesidad,
        "items": items,
        "total_monto": total_monto,
        "aprobador_id": "6",  # Simular que hay un aprobador
    }

    print("\n1. DATOS DE LA SOLICITUD")
    print(f"   Usuario ID: {usuario_id}")
    print(f"   Centro: {centro}")
    print(f"   Sector: {sector}")
    print(f"   Fecha de necesidad: {fecha_necesidad}")
    print(f"   Total Monto: ${total_monto:,.2f}")
    print(f"   Items: {len(items)}")

    print("\n2. ITEMS A AGREGAR")
    for i, item in enumerate(items, 1):
        subtotal = item["cantidad"] * item["precio_unitario"]
        print(f"   {i}. {item['codigo']} - {item['descripcion']}")
        print(
            f"      Cantidad: {item['cantidad']}, Precio Unit: ${item['precio_unitario']:,.2f}, Subtotal: ${subtotal:,.2f}"
        )

    print("\n3. INSERTANDO EN LA BASE DE DATOS...")

    try:
        with get_connection() as con:
            # Insertar solicitud
            cur = con.execute(
                """
                INSERT INTO solicitudes (
                    id_usuario, centro, sector, justificacion, centro_costos, almacen_virtual,
                    data_json, status, aprobador_id, total_monto, criticidad, fecha_necesidad,
                    planner_id, notificado_at, created_at, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                """,
                (
                    usuario_id,
                    centro,
                    sector,
                    justificacion,
                    centro_costos,
                    almacen_virtual,
                    json.dumps(data_json, ensure_ascii=False),
                    "pendiente_de_aprobacion",
                    "6",
                    total_monto,
                    criticidad,
                    fecha_necesidad,
                    None,
                    datetime.now().isoformat(),
                ),
            )

            sol_id = cur.lastrowid
            con.commit()

            print("\n✓ Solicitud creada exitosamente!")
            print(f"   ID de solicitud: {sol_id}")

            # Verificar que se creó correctamente
            con.row_factory = lambda cursor, row: {
                col[0]: row[idx] for idx, col in enumerate(cursor.description)
            }
            cursor = con.execute(
                "SELECT id, status, total_monto, created_at FROM solicitudes WHERE id = ?",
                (sol_id,),
            )
            row = cursor.fetchone()

            if row:
                print("\n4. VERIFICACION EN BD")
                print(f"   ID: {row['id']}")
                print(f"   Status: {row['status']}")
                print(f"   Total Monto: ${row['total_monto']:,.2f}")
                print(f"   Creada: {row['created_at']}")

                # Mostrar data_json completo
                con.row_factory = None  # Reset para fetch normal
                cursor = con.execute("SELECT data_json FROM solicitudes WHERE id = ?", (sol_id,))
                row = cursor.fetchone()
                if row:
                    data = json.loads(row[0])
                    print("\n5. DATA JSON GUARDADA")
                    print(f"   Items guardados: {len(data.get('items', []))}")
                    for item in data.get("items", []):
                        print(
                            f"     - {item['codigo']}: {item['cantidad']} x ${item['precio_unitario']} = ${item['cantidad'] * item['precio_unitario']}"
                        )

            print("\n" + "=" * 70)
            print("SOLICITUD CREADA EXITOSAMENTE")
            print("=" * 70)

    except Exception as e:
        print("\n✗ Error al crear la solicitud:")
        print(f"  {e}")
        import traceback

        traceback.print_exc()
        return False

    return True


if __name__ == "__main__":
    success = crear_solicitud_prueba()
    sys.exit(0 if success else 1)
