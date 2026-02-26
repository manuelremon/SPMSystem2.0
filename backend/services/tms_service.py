"""
TMS Service - Logica de negocio para Transport Management System.

Maneja: envios, consolidacion LTL, tracking, costos, tarifas, cierres financieros.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id, is_using_postgresql
from backend.core.tms_schemas import (
    validar_transicion_shipment,
)

logger = logging.getLogger(__name__)


def _ph():
    """Return the correct placeholder character for the current DB."""
    return "%s" if is_using_postgresql() else "?"


# =============================================================================
# Code Generation
# =============================================================================

def _generate_code(prefix: str, conn) -> str:
    """Genera codigo unico tipo SHP-2026-0001"""
    cursor = conn.cursor()
    year = datetime.now().strftime("%Y")
    table_map = {"SHP": "tms_shipments", "CON": "tms_consolidations"}
    table = table_map.get(prefix, "tms_shipments")
    ph = _ph()
    cursor.execute(f"SELECT COUNT(*) as cnt FROM {table} WHERE codigo LIKE {ph}", (f"{prefix}-{year}-%",))
    row = cursor.fetchone()
    count = (row["cnt"] if row else 0) + 1
    return f"{prefix}-{year}-{count:04d}"


# =============================================================================
# Shipments CRUD
# =============================================================================

def crear_envio(data: dict, user_id: str) -> dict:
    """Crea un nuevo envio."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Generate code
        codigo = _generate_code("SHP", conn)

        # Calculate totals from items
        items = data.get("items", [])
        peso_total = sum(item.get("peso_kg", 0) for item in items)
        volumen_total = sum(item.get("volumen_m3", 0) for item in items)

        # Insert shipment
        shipment_id = insert_returning_id(cursor, """
            INSERT INTO tms_shipments (
                codigo, origen_centro_id, destino_centro_id, tipo,
                prioridad, requiere_cadena_frio, requiere_hazmat, peso_total_kg,
                volumen_total_m3, fecha_programada, instrucciones, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            codigo,
            data["origen_centro_id"],
            data["destino_centro_id"],
            data.get("tipo", "standard"),
            data.get("prioridad", 3),
            data.get("requiere_cadena_frio", False),
            data.get("requiere_hazmat", False),
            peso_total,
            volumen_total,
            data.get("fecha_programada"),
            data.get("instrucciones"),
            user_id
        ))

        # Insert items
        for item in items:
            cursor.execute("""
                INSERT INTO tms_shipment_items (
                    shipment_id, material_id, cantidad, peso_kg, volumen_m3, descripcion
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                shipment_id,
                item.get("material_id"),
                item["cantidad"],
                item.get("peso_kg", 0),
                item.get("volumen_m3", 0),
                item.get("descripcion")
            ))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "CREATE", None, data, user_id)

        return obtener_envio(shipment_id)


def obtener_envio(shipment_id: int) -> Optional[dict]:
    """Obtiene envio por ID con sus items y tracking events."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get shipment
        cursor.execute("""
            SELECT s.*,
                   co.nombre as origen_nombre, cd.nombre as destino_nombre,
                   v.placa, d.nombre || ' ' || COALESCE(d.apellido, '') as conductor_nombre,
                   r.nombre as ruta_nombre
            FROM tms_shipments s
            LEFT JOIN centros co ON s.origen_centro_id = co.id
            LEFT JOIN centros cd ON s.destino_centro_id = cd.id
            LEFT JOIN fms_vehicles v ON s.vehicle_id = v.id
            LEFT JOIN fms_drivers d ON s.assigned_driver_id = d.id
            LEFT JOIN tms_routes r ON s.route_id = r.id
            WHERE s.id = ?
        """, (shipment_id,))
        row = cursor.fetchone()

        if not row:
            return None

        shipment = dict(row)

        # Get items
        cursor.execute("""
            SELECT i.*, m.codigo as material_codigo, m.nombre as material_nombre
            FROM tms_shipment_items i
            LEFT JOIN materiales m ON i.material_id = m.id
            WHERE i.shipment_id = ?
        """, (shipment_id,))
        shipment["items"] = [dict(r) for r in cursor.fetchall()]

        # Get tracking events
        cursor.execute("""
            SELECT * FROM tms_tracking_events
            WHERE shipment_id = ?
            ORDER BY created_at DESC
        """, (shipment_id,))
        shipment["tracking"] = [dict(r) for r in cursor.fetchall()]

        return shipment


def listar_envios(filtros: dict = None, page: int = 1, per_page: int = 20) -> dict:
    """Lista envios con filtros."""
    filtros = filtros or {}
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Build query
        where_clauses = []
        params = []

        if filtros.get("estado"):
            where_clauses.append(f"s.estado = {ph}")
            params.append(filtros["estado"])

        if filtros.get("created_by"):
            where_clauses.append(f"s.created_by = {ph}")
            params.append(filtros["created_by"])

        if filtros.get("fecha_desde"):
            where_clauses.append(f"s.created_at >= {ph}")
            params.append(filtros["fecha_desde"])

        if filtros.get("fecha_hasta"):
            where_clauses.append(f"s.created_at <= {ph}")
            params.append(filtros["fecha_hasta"])

        if filtros.get("prioridad"):
            where_clauses.append(f"s.prioridad = {ph}")
            params.append(filtros["prioridad"])

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Count
        cursor.execute(f"SELECT COUNT(*) as cnt FROM tms_shipments s WHERE {where_sql}", params)
        row = cursor.fetchone()
        total = (row["cnt"] if isinstance(row, dict) else row[0]) if row else 0

        # Fetch page
        offset = (page - 1) * per_page
        cursor.execute(f"""
            SELECT s.*,
                   v.patente,
                   d.nombre as conductor_nombre
            FROM tms_shipments s
            LEFT JOIN fms_vehicles v ON s.vehiculo_id = v.id
            LEFT JOIN fms_drivers d ON s.conductor_id = d.id
            WHERE {where_sql}
            ORDER BY s.created_at DESC
            LIMIT {ph} OFFSET {ph}
        """, params + [per_page, offset])

        items = [dict(r) for r in cursor.fetchall()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": (total + per_page - 1) // per_page
        }


def actualizar_envio(shipment_id: int, data: dict, user_id: str) -> dict:
    """Actualiza campos editables de un envio en estado draft/confirmed."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Get current
        cursor.execute("SELECT * FROM tms_shipments WHERE id = ?", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        old_data = dict(row)

        # Validate state
        if old_data["estado"] not in ["draft", "confirmed"]:
            raise ValueError(f"No se puede editar envio en estado {old_data['estado']}")

        # Update allowed fields
        allowed_fields = [
            "origen_centro_id", "destino_centro_id", "tipo",
            "prioridad", "requiere_cadena_frio", "requiere_hazmat",
            "fecha_programada", "instrucciones"
        ]

        update_fields = []
        params = []
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = ?")
                params.append(data[field])

        if update_fields:
            params.append(shipment_id)
            cursor.execute(f"""
                UPDATE tms_shipments
                SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, params)

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "UPDATE", old_data, data, user_id)

        return obtener_envio(shipment_id)


def transicionar_envio(shipment_id: int, nuevo_estado: str, user_id: str, razon: str = None) -> dict:
    """Cambia estado del envio validando FSM."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Get current state
        cursor.execute("SELECT estado FROM tms_shipments WHERE id = ?", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        estado_actual = row["estado"]

        # Validate transition
        if not validar_transicion_shipment(estado_actual, nuevo_estado):
            raise ValueError(f"Transicion invalida: {estado_actual} -> {nuevo_estado}")

        # Update state
        cursor.execute("""
            UPDATE tms_shipments
            SET estado = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (nuevo_estado, shipment_id))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "STATE_CHANGE",
                           {"estado": estado_actual},
                           {"estado": nuevo_estado, "razon": razon},
                           user_id)

        return obtener_envio(shipment_id)


def asignar_vehiculo_conductor(shipment_id: int, vehicle_id: int, driver_id: int,
                                route_id: int = None, user_id: str = "") -> dict:
    """Asigna vehiculo y conductor a un envio."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate shipment state
        cursor.execute("SELECT estado, peso_total_kg, volumen_total_m3 FROM tms_shipments WHERE id = ?", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if row["estado"] not in ["confirmed", "draft"]:
            raise ValueError("Envio debe estar en estado confirmed o draft")

        # Validate vehicle availability and capacity
        cursor.execute("SELECT * FROM fms_vehicles WHERE id = ? AND estado = ?", (vehicle_id, "disponible"))
        vehicle = cursor.fetchone()
        if not vehicle:
            raise ValueError(f"Vehiculo {vehicle_id} no disponible")

        if row["peso_total_kg"] > vehicle["capacidad_peso_kg"]:
            raise ValueError("Peso excede capacidad del vehiculo")

        if row["volumen_total_m3"] > vehicle["capacidad_vol_m3"]:
            raise ValueError("Volumen excede capacidad del vehiculo")

        # Validate driver
        cursor.execute("SELECT * FROM fms_drivers WHERE id = ? AND estado = ?", (driver_id, "activo"))
        if not cursor.fetchone():
            raise ValueError(f"Conductor {driver_id} no disponible")

        # Assign
        cursor.execute("""
            UPDATE tms_shipments
            SET vehicle_id = ?, assigned_driver_id = ?, route_id = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (vehicle_id, driver_id, route_id, "assigned", shipment_id))

        # Update vehicle status
        cursor.execute("UPDATE fms_vehicles SET estado = ? WHERE id = ?", ("en_ruta", vehicle_id))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "ASSIGN_VEHICLE",
                           None, {"vehicle_id": vehicle_id, "driver_id": driver_id}, user_id)

        return obtener_envio(shipment_id)


def confirmar_entrega(shipment_id: int, data: dict, user_id: str) -> dict:
    """Confirma entrega del envio."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate state
        cursor.execute("SELECT estado, vehicle_id FROM tms_shipments WHERE id = ?", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if row["estado"] != "in_transit":
            raise ValueError("Envio debe estar en transito para confirmar entrega")

        # Update shipment
        cursor.execute("""
            UPDATE tms_shipments
            SET estado = ?,
                fecha_entrega_real = ?,
                receptor_nombre = ?,
                receptor_firma_url = ?,
                evidencia_entrega_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            "delivered",
            data.get("fecha_entrega", datetime.now().isoformat()),
            data.get("receptor_nombre"),
            data.get("receptor_firma_url"),
            data.get("evidencia_entrega_url"),
            shipment_id
        ))

        # Free vehicle
        if row["vehicle_id"]:
            cursor.execute("UPDATE fms_vehicles SET estado = ? WHERE id = ?",
                         ("disponible", row["vehicle_id"]))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "DELIVERY_CONFIRMED", None, data, user_id)

        return obtener_envio(shipment_id)


# =============================================================================
# Tracking
# =============================================================================

def registrar_evento_tracking(shipment_id: int, data: dict, user_id: str) -> dict:
    """Registra evento de tracking GPS."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        event_id = insert_returning_id(cursor, """
            INSERT INTO tms_tracking_events (
                shipment_id, ubicacion_lat, ubicacion_lng, ubicacion_nombre,
                temperatura, evento_tipo, notas, evidencia_foto_url, registrado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            shipment_id,
            data.get("ubicacion_lat"),
            data.get("ubicacion_lng"),
            data.get("ubicacion_nombre"),
            data.get("temperatura"),
            data.get("evento_tipo", "checkpoint"),
            data.get("notas"),
            data.get("evidencia_foto_url"),
            user_id
        ))

        cursor.execute("SELECT * FROM tms_tracking_events WHERE id = ?", (event_id,))
        return dict(cursor.fetchone())


def obtener_tracking(shipment_id: int) -> List[dict]:
    """Obtiene eventos de tracking de un envio."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM tms_tracking_events
            WHERE shipment_id = ?
            ORDER BY created_at DESC
        """, (shipment_id,))
        return [dict(r) for r in cursor.fetchall()]


def obtener_envios_en_transito() -> List[dict]:
    """Obtiene envios en transito con ultima posicion."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*,
                   co.nombre as origen_nombre, cd.nombre as destino_nombre,
                   v.patente as placa, d.nombre as conductor_nombre,
                   t.latitud, t.longitud, t.created_at as ultima_actualizacion
            FROM tms_shipments s
            LEFT JOIN centros co ON s.origen_centro_id = co.codigo
            LEFT JOIN centros cd ON s.destino_centro_id = cd.codigo
            LEFT JOIN fms_vehicles v ON s.vehiculo_id = v.id
            LEFT JOIN fms_drivers d ON s.conductor_id = d.id
            LEFT JOIN (
                SELECT shipment_id, latitud, longitud, created_at,
                       ROW_NUMBER() OVER (PARTITION BY shipment_id ORDER BY created_at DESC) as rn
                FROM tms_tracking_events
            ) t ON s.id = t.shipment_id AND t.rn = 1
            WHERE s.estado = 'in_transit'
        """)
        return [dict(r) for r in cursor.fetchall()]


# =============================================================================
# Consolidacion LTL
# =============================================================================

def crear_consolidacion(data: dict, user_id: str) -> dict:
    """Crea consolidacion."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        codigo = _generate_code("CON", conn)

        consolidation_id = insert_returning_id(cursor, """
            INSERT INTO tms_consolidations (
                codigo, vehicle_id, driver_id, route_id, fecha_programada, created_by
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            codigo,
            data.get("vehicle_id"),
            data.get("driver_id"),
            data.get("route_id"),
            data.get("fecha_programada"),
            user_id
        ))

        # Add shipments if provided
        for shipment_id in data.get("shipment_ids", []):
            agregar_envio_a_consolidacion(consolidation_id, shipment_id, user_id)

        _registrar_auditoria(conn, "consolidation", consolidation_id, "CREATE", None, data, user_id)

        cursor.execute("SELECT * FROM tms_consolidations WHERE id = ?", (consolidation_id,))
        return dict(cursor.fetchone())


def sugerir_consolidaciones(fecha_corte: str = None) -> List[dict]:
    """Algoritmo de consolidacion LTL.

    Agrupa envios confirmados sin consolidar por destino y sugiere consolidaciones.
    Columnas reales de tms_shipments: id, codigo, origen, destino, peso_kg, volumen_m3, estado, consolidation_id, etc.
    Columnas reales de centros: codigo, nombre (no tiene 'id' ni 'zona').
    """
    ph = _ph()
    if not fecha_corte:
        fecha_corte = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get confirmed shipments not in consolidation
        cursor.execute(f"""
            SELECT s.id, s.codigo, s.origen, s.destino,
                   COALESCE(s.peso_kg, 0) as peso_kg,
                   COALESCE(s.volumen_m3, 0) as volumen_m3,
                   s.estado, s.tipo
            FROM tms_shipments s
            WHERE s.estado = 'confirmed'
              AND s.consolidation_id IS NULL
              AND s.created_at <= {ph}
        """, (fecha_corte,))

        shipments = [dict(r) for r in cursor.fetchall()]

        # Group by destination
        groups = {}
        for shp in shipments:
            key = (shp.get("origen") or "", shp.get("destino") or "")
            if key not in groups:
                groups[key] = []
            groups[key].append(shp)

        suggestions = []

        for (origen, destino), group_shipments in groups.items():
            if len(group_shipments) < 2:
                continue

            total_peso = sum(s.get("peso_kg", 0) or 0 for s in group_shipments)
            total_volumen = sum(s.get("volumen_m3", 0) or 0 for s in group_shipments)

            suggestions.append({
                "origen": origen,
                "destino": destino,
                "shipment_ids": [s["id"] for s in group_shipments],
                "shipment_count": len(group_shipments),
                "total_peso_kg": round(total_peso, 2),
                "total_volumen_m3": round(total_volumen, 2),
            })

        return suggestions


def agregar_envio_a_consolidacion(consolidation_id: int, shipment_id: int, user_id: str) -> dict:
    """Agrega envio a consolidacion."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate consolidation
        cursor.execute("SELECT * FROM tms_consolidations WHERE id = ?", (consolidation_id,))
        consolidation = cursor.fetchone()
        if not consolidation:
            raise ValueError(f"Consolidacion {consolidation_id} no encontrada")

        if consolidation["estado"] not in ["draft", "confirmed"]:
            raise ValueError(f"No se puede agregar a consolidacion en estado {consolidation['estado']}")

        # Validate shipment
        cursor.execute("SELECT * FROM tms_shipments WHERE id = ?", (shipment_id,))
        shipment = cursor.fetchone()
        if not shipment:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if shipment["consolidation_id"]:
            raise ValueError(f"Envio ya esta en consolidacion {shipment['consolidation_id']}")

        # Check capacity
        cursor.execute("""
            SELECT SUM(peso_total_kg) as peso, SUM(volumen_total_m3) as volumen
            FROM tms_shipments
            WHERE consolidation_id = ?
        """, (consolidation_id,))
        totals = cursor.fetchone()

        cursor.execute("SELECT * FROM fms_vehicles WHERE id = ?", (consolidation["vehicle_id"],))
        vehicle = cursor.fetchone()

        if vehicle:
            new_peso = (totals["peso"] or 0) + shipment["peso_total_kg"]
            new_volumen = (totals["volumen"] or 0) + shipment["volumen_total_m3"]

            if new_peso > vehicle["capacidad_peso_kg"]:
                raise ValueError("Peso excede capacidad del vehiculo")
            if new_volumen > vehicle["capacidad_vol_m3"]:
                raise ValueError("Volumen excede capacidad del vehiculo")

        # Add
        cursor.execute("""
            UPDATE tms_shipments
            SET consolidation_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (consolidation_id, shipment_id))

        _registrar_auditoria(conn, "consolidation", consolidation_id, "ADD_SHIPMENT",
                           None, {"shipment_id": shipment_id}, user_id)

        return obtener_envio(shipment_id)


def remover_envio_de_consolidacion(consolidation_id: int, shipment_id: int, user_id: str) -> dict:
    """Remueve envio de consolidacion."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE tms_shipments
            SET consolidation_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND consolidation_id = ?
        """, (shipment_id, consolidation_id))

        if cursor.rowcount == 0:
            raise ValueError(f"Envio {shipment_id} no esta en consolidacion {consolidation_id}")

        _registrar_auditoria(conn, "consolidation", consolidation_id, "REMOVE_SHIPMENT",
                           {"shipment_id": shipment_id}, None, user_id)

        return obtener_envio(shipment_id)


def listar_consolidaciones(filtros: dict = None) -> List[dict]:
    """Lista consolidaciones."""
    filtros = filtros or {}
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if filtros.get("estado"):
            where_clauses.append(f"c.estado = {ph}")
            params.append(filtros["estado"])

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        cursor.execute(f"""
            SELECT c.*,
                   COUNT(s.id) as shipment_count_calc,
                   SUM(s.peso_kg) as peso_total_calc,
                   SUM(s.volumen_m3) as volumen_total_calc
            FROM tms_consolidations c
            LEFT JOIN tms_shipments s ON s.consolidation_id = c.id
            WHERE {where_sql}
            GROUP BY c.id
            ORDER BY c.created_at DESC
        """, params)

        return [dict(r) for r in cursor.fetchall()]


# =============================================================================
# Rutas
# =============================================================================

def crear_ruta(data: dict, user_id: str) -> dict:
    """Crea ruta."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        route_id = insert_returning_id(cursor, """
            INSERT INTO tms_routes (
                nombre, origen_centro_id, destino_centro_id,
                distancia_km, tiempo_estimado_hrs, costo_base, tipo_via
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data["nombre"],
            data["origen_centro_id"],
            data["destino_centro_id"],
            data.get("distancia_km", 0),
            data.get("tiempo_estimado_hrs", 0),
            data.get("costo_base", 0),
            data.get("tipo_via", "carretera")
        ))

        cursor.execute("SELECT * FROM tms_routes WHERE id = ?", (route_id,))
        return dict(cursor.fetchone())


def listar_rutas(activas_only: bool = True) -> List[dict]:
    """Lista rutas."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # tms_routes.activo is a boolean column in PostgreSQL
        where_sql = "WHERE activo = TRUE" if activas_only and is_using_postgresql() else ("WHERE activo = 1" if activas_only else "")

        cursor.execute(f"""
            SELECT *
            FROM tms_routes
            {where_sql}
            ORDER BY nombre
        """)
        return [dict(r) for r in cursor.fetchall()]


def obtener_ruta(route_id: int) -> Optional[dict]:
    """Obtiene ruta por ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.*,
                   co.nombre as origen_nombre, cd.nombre as destino_nombre
            FROM tms_routes r
            LEFT JOIN centros co ON r.origen_centro_id = co.id
            LEFT JOIN centros cd ON r.destino_centro_id = cd.id
            WHERE r.id = ?
        """, (route_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def actualizar_ruta(route_id: int, data: dict) -> dict:
    """Actualiza ruta."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        allowed_fields = ["nombre", "distancia_km", "tiempo_estimado_hrs", "costo_base", "tipo_via", "activa"]
        update_fields = []
        params = []

        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = ?")
                params.append(data[field])

        if update_fields:
            params.append(route_id)
            cursor.execute(f"""
                UPDATE tms_routes
                SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, params)

        return obtener_ruta(route_id)


# =============================================================================
# Costos y Tarifas
# =============================================================================

def registrar_costo(shipment_id: int, data: dict, user_id: str) -> dict:
    """Registra costo para un envio."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cost_id = insert_returning_id(cursor, """
            INSERT INTO tms_trip_costs (
                shipment_id, category_id, concepto, monto, moneda,
                tipo_cambio, evidencia_url, proveedor_id, aprobado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            shipment_id,
            data.get("category_id"),
            data.get("concepto", data.get("tipo_costo", "")),
            data["monto"],
            data.get("moneda", "MXN"),
            data.get("tipo_cambio", 1.0),
            data.get("evidencia_url"),
            data.get("proveedor_id"),
            user_id
        ))

        cursor.execute("SELECT * FROM tms_trip_costs WHERE id = ?", (cost_id,))
        return dict(cursor.fetchone())


def obtener_costos_envio(shipment_id: int) -> List[dict]:
    """Obtiene costos de un envio."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM tms_trip_costs
            WHERE shipment_id = ?
            ORDER BY created_at DESC
        """, (shipment_id,))
        return [dict(r) for r in cursor.fetchall()]


def calcular_flete(shipment_id: int) -> dict:
    """Calcula flete basado en tarifa."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get shipment
        cursor.execute("""
            SELECT s.*, r.distancia_km,
                   co.zona as zona_origen, cd.zona as zona_destino
            FROM tms_shipments s
            LEFT JOIN tms_routes r ON s.route_id = r.id
            LEFT JOIN centros co ON s.origen_centro_id = co.id
            LEFT JOIN centros cd ON s.destino_centro_id = cd.id
            WHERE s.id = ?
        """, (shipment_id,))
        shipment = cursor.fetchone()

        if not shipment:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        # Find applicable tariff
        cursor.execute("""
            SELECT * FROM tms_tariff_rules
            WHERE activa = 1
              AND (origen_zona IS NULL OR origen_zona = ?)
              AND (destino_zona IS NULL OR destino_zona = ?)
              AND (tipo_vehiculo IS NULL OR tipo_vehiculo = ?)
            ORDER BY
                (CASE WHEN origen_zona IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN destino_zona IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN tipo_vehiculo IS NOT NULL THEN 1 ELSE 0 END) DESC
            LIMIT 1
        """, (shipment["zona_origen"], shipment["zona_destino"], shipment.get("tipo")))

        tariff = cursor.fetchone()

        if not tariff:
            return {"error": "No se encontro tarifa aplicable", "flete": 0}

        # Calculate
        distancia = shipment["distancia_km"] or 0
        peso = shipment["peso_total_kg"] or 0
        volumen = shipment["volumen_total_m3"] or 0

        flete_base = tariff["tarifa_base_km"] * distancia
        flete_peso = tariff["tarifa_peso_kg"] * peso
        flete_volumen = tariff["tarifa_volumen_m3"] * volumen

        flete = max(flete_base, flete_peso, flete_volumen)

        # Recargos
        recargos = 0
        if shipment["requiere_cadena_frio"]:
            recargos += flete * tariff.get("recargo_frio_pct", 0) / 100
        if shipment["requiere_hazmat"]:
            recargos += flete * tariff.get("recargo_hazmat_pct", 0) / 100
        if shipment["prioridad"] and shipment["prioridad"] >= 4:
            recargos += flete * tariff.get("recargo_urgente_pct", 0) / 100

        flete_total = flete + recargos

        return {
            "flete_base": round(flete_base, 2),
            "flete_peso": round(flete_peso, 2),
            "flete_volumen": round(flete_volumen, 2),
            "recargos": round(recargos, 2),
            "flete_total": round(flete_total, 2),
            "tariff_id": tariff["id"],
            "tariff_nombre": tariff.get("nombre")
        }


def listar_tarifas(activas_only: bool = True) -> List[dict]:
    """Lista tarifas. Tabla real: tms_tariffs (columna: activo)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        bool_true = "TRUE" if is_using_postgresql() else "1"
        where_sql = f"WHERE activo = {bool_true}" if activas_only else ""
        cursor.execute(f"SELECT * FROM tms_tariffs {where_sql} ORDER BY created_at DESC")
        return [dict(r) for r in cursor.fetchall()]


def crear_tarifa(data: dict) -> dict:
    """Crea tarifa."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        tariff_id = insert_returning_id(cursor, """
            INSERT INTO tms_tariff_rules (
                nombre, origen_zona, destino_zona, tipo_vehiculo, tipo_carga,
                tarifa_base_km, tarifa_peso_kg, tarifa_volumen_m3,
                recargo_frio_pct, recargo_hazmat_pct, recargo_urgente_pct
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["nombre"],
            data.get("origen_zona"),
            data.get("destino_zona"),
            data.get("tipo_vehiculo"),
            data.get("tipo_carga"),
            data.get("tarifa_base_km", 0),
            data.get("tarifa_peso_kg", 0),
            data.get("tarifa_volumen_m3", 0),
            data.get("recargo_frio_pct", 0),
            data.get("recargo_hazmat_pct", 0),
            data.get("recargo_urgente_pct", 0)
        ))

        cursor.execute("SELECT * FROM tms_tariff_rules WHERE id = ?", (tariff_id,))
        return dict(cursor.fetchone())


def actualizar_tarifa(tariff_id: int, data: dict) -> dict:
    """Actualiza tarifa."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        allowed_fields = [
            "nombre", "tarifa_base_km", "tarifa_peso_kg", "tarifa_volumen_m3",
            "recargo_frio_pct", "recargo_hazmat_pct", "recargo_urgente_pct", "activa"
        ]

        update_fields = []
        params = []
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = ?")
                params.append(data[field])

        if update_fields:
            params.append(tariff_id)
            cursor.execute(f"""
                UPDATE tms_tariff_rules
                SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, params)

        cursor.execute("SELECT * FROM tms_tariff_rules WHERE id = ?", (tariff_id,))
        return dict(cursor.fetchone())


# =============================================================================
# Cierre Financiero
# =============================================================================

def cerrar_viaje(shipment_id: int, costos_extra: list = None, user_id: str = "") -> dict:
    """Cierre financiero de viaje."""
    costos_extra = costos_extra or []

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate state
        cursor.execute("SELECT * FROM tms_shipments WHERE id = ?", (shipment_id,))
        shipment = cursor.fetchone()

        if not shipment:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if shipment["estado"] != "delivered":
            raise ValueError(f"Envio debe estar en estado delivered, actual: {shipment['estado']}")

        # Get existing costs
        cursor.execute("""
            SELECT concepto, SUM(monto) as total
            FROM tms_trip_costs
            WHERE shipment_id = ?
            GROUP BY concepto
        """, (shipment_id,))

        costos = {row["concepto"]: row["total"] for row in cursor.fetchall()}

        # Add extra costs
        for costo in costos_extra:
            registrar_costo(shipment_id, costo, user_id)
            tipo = costo.get("concepto", costo.get("tipo_costo", "otro"))
            costos[tipo] = costos.get(tipo, 0) + costo["monto"]

        # Calculate total costs
        costo_combustible = costos.get("combustible", 0)
        costo_peajes = costos.get("peajes", 0)
        costo_viaticos = costos.get("viaticos", 0)
        costo_otros = sum(v for k, v in costos.items() if k not in ["combustible", "peajes", "viaticos"])
        total_gastos = costo_combustible + costo_peajes + costo_viaticos + costo_otros

        # Calculate freight income
        flete_data = calcular_flete(shipment_id)
        ingreso_flete = flete_data.get("flete_total", 0)

        # Calculate margin
        margen_neto = ingreso_flete - total_gastos
        margen_pct = (margen_neto / ingreso_flete * 100) if ingreso_flete > 0 else 0

        # Check alerts
        cursor.execute("SELECT valor FROM tms_config WHERE clave = ?", ("margen_minimo_pct",))
        row = cursor.fetchone()
        margen_minimo = float(row["valor"]) if row else 15.0

        alertas = []
        if margen_pct < margen_minimo:
            alertas.append(f"Margen {margen_pct:.2f}% por debajo del minimo {margen_minimo}%")

        # Create settlement
        settlement_id = insert_returning_id(cursor, """
            INSERT INTO tms_trip_settlements (
                shipment_id, tipo, costo_combustible, costo_peajes, costo_viaticos,
                costo_otros, total_gastos, ingreso_flete, margen_neto, margen_pct,
                estado, cerrado_por, fecha_cierre, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        """, (
            shipment_id,
            "cierre",
            costo_combustible,
            costo_peajes,
            costo_viaticos,
            costo_otros,
            total_gastos,
            ingreso_flete,
            margen_neto,
            margen_pct,
            "cerrado",
            user_id,
            json.dumps(alertas) if alertas else None
        ))

        # Update shipment state
        cursor.execute("""
            UPDATE tms_shipments
            SET estado = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, ("settled", shipment_id))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "SETTLED", None,
                           {"settlement_id": settlement_id}, user_id)

        cursor.execute("SELECT * FROM tms_trip_settlements WHERE id = ?", (settlement_id,))
        return dict(cursor.fetchone())


def obtener_settlement(shipment_id: int) -> Optional[dict]:
    """Obtiene cierre financiero de un envio."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM tms_trip_settlements
            WHERE shipment_id = ?
        """, (shipment_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def listar_settlements(filtros: dict = None, page: int = 1, per_page: int = 20) -> dict:
    """Lista cierres financieros. Tabla real: tms_settlements."""
    filtros = filtros or {}
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if filtros.get("fecha_desde"):
            where_clauses.append(f"ts.created_at >= {ph}")
            params.append(filtros["fecha_desde"])

        if filtros.get("fecha_hasta"):
            where_clauses.append(f"ts.created_at <= {ph}")
            params.append(filtros["fecha_hasta"])

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Count
        cursor.execute(f"SELECT COUNT(*) as cnt FROM tms_settlements ts WHERE {where_sql}", params)
        total = cursor.fetchone()["cnt"]

        # Fetch
        offset = (page - 1) * per_page
        cursor.execute(f"""
            SELECT ts.*, s.codigo as shipment_codigo
            FROM tms_settlements ts
            LEFT JOIN tms_shipments s ON ts.shipment_id = s.id
            WHERE {where_sql}
            ORDER BY ts.created_at DESC
            LIMIT {ph} OFFSET {ph}
        """, params + [per_page, offset])

        items = [dict(r) for r in cursor.fetchall()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": (total + per_page - 1) // per_page
        }


# =============================================================================
# Registros de Combustible
# =============================================================================

def registrar_combustible(data: dict, user_id: str) -> dict:
    """Registra carga de combustible."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        fuel_id = insert_returning_id(cursor, """
            INSERT INTO tms_fuel_records (
                vehicle_id, shipment_id, litros, costo_litro, costo_total,
                odometro_km, estacion, evidencia_url, registrado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["vehicle_id"],
            data.get("shipment_id"),
            data["litros"],
            data.get("costo_litro", 0),
            data.get("costo_total", data["litros"] * data.get("costo_litro", 0)),
            data.get("odometro_km"),
            data.get("estacion"),
            data.get("evidencia_url"),
            user_id
        ))

        # Also register as cost if shipment provided
        if data.get("shipment_id"):
            registrar_costo(
                data["shipment_id"],
                {
                    "concepto": "combustible",
                    "monto": data.get("costo_total", data["litros"] * data.get("costo_litro", 0)),
                },
                user_id
            )

        cursor.execute("SELECT * FROM tms_fuel_records WHERE id = ?", (fuel_id,))
        return dict(cursor.fetchone())


# =============================================================================
# Configuracion TMS
# =============================================================================

def obtener_config(clave: str) -> Any:
    """Obtiene configuracion TMS."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT valor FROM tms_config WHERE clave = ?", (clave,))
        row = cursor.fetchone()
        return row["valor"] if row else None


def actualizar_config(clave: str, valor: str, user_id: str) -> dict:
    """Actualiza configuracion TMS."""
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM tms_config WHERE clave = ?", (clave,))
        exists = cursor.fetchone()

        if exists:
            cursor.execute("""
                UPDATE tms_config
                SET valor = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE clave = ?
            """, (valor, user_id, clave))
        else:
            cursor.execute("""
                INSERT INTO tms_config (clave, valor, created_by)
                VALUES (?, ?, ?)
            """, (clave, valor, user_id))

        cursor.execute("SELECT * FROM tms_config WHERE clave = ?", (clave,))
        return dict(cursor.fetchone())


# =============================================================================
# KPIs TMS
# =============================================================================

def obtener_kpis_tms() -> dict:
    """Obtiene KPIs del modulo TMS."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Shipments by state
        cursor.execute("""
            SELECT estado, COUNT(*) as count
            FROM tms_shipments
            GROUP BY estado
        """)
        shipments_by_state = {row["estado"]: row["count"] for row in cursor.fetchall()}

        # In transit
        in_transit = shipments_by_state.get("in_transit", 0)

        # On-time delivery rate - use actual columns: fecha_llegada_real vs fecha_llegada_est
        cursor.execute("""
            SELECT
                COUNT(*) as total_delivered,
                SUM(CASE WHEN fecha_llegada_real <= fecha_llegada_est THEN 1 ELSE 0 END) as on_time
            FROM tms_shipments
            WHERE estado = 'entregado'
              AND fecha_llegada_real IS NOT NULL
              AND fecha_llegada_est IS NOT NULL
        """)
        delivery = cursor.fetchone()
        total_delivered = (delivery["total_delivered"] if isinstance(delivery, dict) else delivery[0]) or 0
        on_time_val = (delivery["on_time"] if isinstance(delivery, dict) else delivery[1]) or 0
        on_time_rate = (on_time_val / total_delivered * 100) if total_delivered > 0 else 0

        # Average cost per shipment from tms_shipment_costs (actual table name)
        cursor.execute("""
            SELECT AVG(monto) as avg_cost
            FROM tms_shipment_costs
        """)
        row = cursor.fetchone()
        avg_cost = (row["avg_cost"] if isinstance(row, dict) else row[0]) or 0

        # Average consolidation utilization
        cursor.execute("""
            SELECT AVG(
                CASE
                    WHEN c.peso_total > 0 THEN c.peso_total * 100.0
                    ELSE 0
                END
            ) as avg_util
            FROM tms_consolidations c
        """)
        row = cursor.fetchone()
        avg_util = (row["avg_util"] if isinstance(row, dict) else row[0]) or 0

        # Average settlement margin from tms_settlements (actual table name)
        cursor.execute("""
            SELECT AVG(
                CASE
                    WHEN total_cobrado > 0
                    THEN (total_cobrado - total_costos) / total_cobrado * 100
                    ELSE 0
                END
            ) as avg_margin
            FROM tms_settlements
        """)
        row = cursor.fetchone()
        avg_margin = (row["avg_margin"] if isinstance(row, dict) else row[0]) or 0

        # Top routes by volume
        cursor.execute("""
            SELECT r.nombre, COUNT(s.id) as shipment_count
            FROM tms_routes r
            LEFT JOIN tms_shipments s ON s.route_id = r.id
            WHERE s.id IS NOT NULL
            GROUP BY r.id, r.nombre
            ORDER BY shipment_count DESC
            LIMIT 5
        """)
        top_routes = [dict(row) for row in cursor.fetchall()]

        return {
            "shipments_by_state": shipments_by_state,
            "in_transit": in_transit,
            "on_time_delivery_rate": round(on_time_rate, 2),
            "avg_cost_per_shipment": round(float(avg_cost), 2),
            "avg_consolidation_utilization": round(float(avg_util), 2),
            "avg_margin_pct": round(float(avg_margin), 2),
            "top_routes": top_routes
        }


# =============================================================================
# Audit
# =============================================================================

def _registrar_auditoria(conn, entidad: str, entidad_id: int, accion: str,
                         datos_antes: dict = None, datos_despues: dict = None,
                         usuario_id: str = "", ip: str = None):
    """Registra accion en tms_audit_log."""
    ph = _ph()
    cursor = conn.cursor()
    cursor.execute(f"""
        INSERT INTO tms_audit_log (entidad, entidad_id, accion, datos_antes, datos_despues, usuario_id, ip_address)
        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
    """, (
        entidad, entidad_id, accion,
        json.dumps(datos_antes) if datos_antes else None,
        json.dumps(datos_despues) if datos_despues else None,
        usuario_id, ip
    ))


# --- Aliases for English route compatibility ---
def list_shipments(user_id: str = None, filters: dict = None) -> dict:
    return listar_envios(filters, page=filters.get("page", 1) if filters else 1,
                          per_page=filters.get("per_page", 20) if filters else 20)

def list_consolidations(user_id: str = None, filters: dict = None):
    return listar_consolidaciones(filters)

def list_routes(user_id: str = None, filters: dict = None):
    return listar_rutas(activas_only=True)

def get_kpis(user_id: str = None, filters: dict = None) -> dict:
    return obtener_kpis_tms()


def get_in_transit_shipments(user_id: str = None) -> list:
    return obtener_envios_en_transito()


def suggest_consolidations(user_id: str = None, destino: str = None, max_suggestions: int = 10) -> list:
    return sugerir_consolidaciones()


def list_tariffs(user_id: str = None, filters: dict = None) -> list:
    activas_only = filters.get("activo", True) if filters else True
    return listar_tarifas(activas_only=activas_only)


def list_settlements(user_id: str = None, filters: dict = None) -> dict:
    filters = filters or {}
    return listar_settlements(filters, page=filters.get("page", 1), per_page=filters.get("per_page", 20))


def get_config(user_id: str = None) -> dict:
    """Retorna todas las configs TMS como dict."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT clave, valor FROM tms_config")
        return {row[0]: row[1] for row in cursor.fetchall()}
