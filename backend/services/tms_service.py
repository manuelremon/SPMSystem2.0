"""
TMS Service - Logica de negocio para Transport Management System.

Maneja: envios, consolidacion LTL, tracking, costos, tarifas, cierres financieros.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, List, Optional

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
)
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
    """Crea un nuevo envio.

    Actual tms_shipments columns:
        id, codigo, solicitud_id, origen, destino, transportista, conductor,
        vehiculo_id, conductor_id, peso_kg, volumen_m3, estado, prioridad, tipo,
        fecha_salida, fecha_llegada_est, fecha_llegada_real, notas,
        consolidation_id, route_id, created_by, created_at, updated_at,
        fecha_entrega_real, origen_centro_id, destino_centro_id, destino_centro, origen_centro
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Generate code
        codigo = _generate_code("SHP", conn)

        # Calculate totals from items
        items = data.get("items", [])
        peso_total = sum(item.get("peso_kg", 0) for item in items)
        volumen_total = sum(item.get("volumen_m3", 0) for item in items)

        # Insert shipment — uses actual tms_shipments columns
        shipment_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_shipments (
                codigo, origen_centro_id, destino_centro_id, origen_centro, destino_centro,
                tipo, prioridad, peso_kg, volumen_m3,
                fecha_salida, notas, created_by
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            codigo,
            data.get("origen_centro_id"),
            data.get("destino_centro_id"),
            data.get("origen_centro", data.get("origen", "")),
            data.get("destino_centro", data.get("destino", "")),
            data.get("tipo", "standard"),
            data.get("prioridad", 3),
            peso_total,
            volumen_total,
            data.get("fecha_salida"),
            data.get("notas", data.get("instrucciones", "")),
            user_id
        ))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "CREATE", None, data, user_id)

        return obtener_envio(shipment_id)


def obtener_envio(shipment_id: int) -> Optional[dict]:
    """Obtiene envio por ID con sus tracking events.

    Actual tms_shipments columns: vehiculo_id, conductor_id (NOT vehicle_id, assigned_driver_id).
    """
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get shipment
        cursor.execute(f"""
            SELECT s.*,
                   r.nombre as ruta_nombre
            FROM tms_shipments s
            LEFT JOIN tms_routes r ON s.route_id = r.id
            WHERE s.id = {ph}
        """, (shipment_id,))
        row = cursor.fetchone()

        if not row:
            return None

        shipment = dict(row)

        # Get tracking events
        cursor.execute(f"""
            SELECT * FROM tms_tracking_events
            WHERE shipment_id = {ph}
            ORDER BY created_at DESC
        """, (shipment_id,))
        shipment["tracking"] = [dict(r) for r in cursor.fetchall()]

        # Get costs
        cursor.execute(f"""
            SELECT * FROM tms_shipment_costs
            WHERE shipment_id = {ph}
            ORDER BY created_at DESC
        """, (shipment_id,))
        shipment["costs"] = [dict(r) for r in cursor.fetchall()]

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
            SELECT s.*
            FROM tms_shipments s
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
    """Actualiza campos editables de un envio en estado draft/confirmed.

    Actual editable tms_shipments columns (not PKs/FKs/timestamps).
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Get current
        cursor.execute(f"SELECT * FROM tms_shipments WHERE id = {ph}", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        old_data = dict(row)

        # Validate state
        if old_data["estado"] not in ["draft", "confirmed"]:
            raise ValueError(f"No se puede editar envio en estado {old_data['estado']}")

        # Update allowed fields — only columns that actually exist in tms_shipments
        allowed_fields = [
            "origen_centro_id", "destino_centro_id", "origen_centro", "destino_centro",
            "origen", "destino", "tipo", "prioridad", "transportista", "conductor",
            "peso_kg", "volumen_m3", "fecha_salida", "fecha_llegada_est", "notas"
        ]

        update_fields = []
        params = []
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = {ph}")
                params.append(data[field])

        if update_fields:
            params.append(shipment_id)
            cursor.execute(f"""
                UPDATE tms_shipments
                SET {", ".join(update_fields)}, updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
            """, params)

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "UPDATE", old_data, data, user_id)

        return obtener_envio(shipment_id)


def transicionar_envio(shipment_id: int, nuevo_estado: str, user_id: str, razon: str = None) -> dict:
    """Cambia estado del envio validando FSM."""
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Get current state
        cursor.execute(f"SELECT estado FROM tms_shipments WHERE id = {ph}", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        estado_actual = row["estado"]

        # Validate transition
        if not validar_transicion_shipment(estado_actual, nuevo_estado):
            raise ValueError(f"Transicion invalida: {estado_actual} -> {nuevo_estado}")

        # Update state
        cursor.execute(f"""
            UPDATE tms_shipments
            SET estado = {ph}, updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (nuevo_estado, shipment_id))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "STATE_CHANGE",
                           {"estado": estado_actual},
                           {"estado": nuevo_estado, "razon": razon},
                           user_id)

        return obtener_envio(shipment_id)


def asignar_vehiculo_conductor(shipment_id: int, vehicle_id: int, driver_id: int,
                                route_id: int = None, user_id: str = "") -> dict:
    """Asigna vehiculo y conductor a un envio.

    Actual tms_shipments columns: vehiculo_id, conductor_id (NOT vehicle_id, assigned_driver_id).
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate shipment state — peso_kg, volumen_m3 are the actual columns
        cursor.execute(f"SELECT estado, peso_kg, volumen_m3 FROM tms_shipments WHERE id = {ph}", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if row["estado"] not in ["confirmed", "draft"]:
            raise ValueError("Envio debe estar en estado confirmed o draft")

        # Validate vehicle availability and capacity
        cursor.execute(f"SELECT * FROM fms_vehicles WHERE id = {ph} AND estado = {ph}", (vehicle_id, "disponible"))
        vehicle = cursor.fetchone()
        if not vehicle:
            raise ValueError(f"Vehiculo {vehicle_id} no disponible")

        if (row["peso_kg"] or 0) > (vehicle.get("capacidad_peso_kg") or 99999):
            raise ValueError("Peso excede capacidad del vehiculo")

        if (row["volumen_m3"] or 0) > (vehicle.get("capacidad_vol_m3") or 99999):
            raise ValueError("Volumen excede capacidad del vehiculo")

        # Validate driver
        cursor.execute(f"SELECT * FROM fms_drivers WHERE id = {ph} AND estado = {ph}", (driver_id, "activo"))
        if not cursor.fetchone():
            raise ValueError(f"Conductor {driver_id} no disponible")

        # Assign — actual columns: vehiculo_id, conductor_id
        cursor.execute(f"""
            UPDATE tms_shipments
            SET vehiculo_id = {ph}, conductor_id = {ph}, route_id = {ph}, estado = {ph}, updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (vehicle_id, driver_id, route_id, "assigned", shipment_id))

        # Update vehicle status
        cursor.execute(f"UPDATE fms_vehicles SET estado = {ph} WHERE id = {ph}", ("en_ruta", vehicle_id))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "ASSIGN_VEHICLE",
                           None, {"vehiculo_id": vehicle_id, "conductor_id": driver_id}, user_id)

        return obtener_envio(shipment_id)


def confirmar_entrega(shipment_id: int, data: dict, user_id: str) -> dict:
    """Confirma entrega del envio.

    Actual tms_shipments columns: vehiculo_id (NOT vehicle_id),
    fecha_entrega_real (exists), notas (for delivery notes).
    Columns receptor_nombre, receptor_firma_url, evidencia_entrega_url do NOT exist.
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate state — vehiculo_id is the actual column
        cursor.execute(f"SELECT estado, vehiculo_id FROM tms_shipments WHERE id = {ph}", (shipment_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if row["estado"] != "in_transit":
            raise ValueError("Envio debe estar en transito para confirmar entrega")

        # Update shipment — only use columns that actually exist
        cursor.execute(f"""
            UPDATE tms_shipments
            SET estado = {ph},
                fecha_entrega_real = {ph},
                fecha_llegada_real = {ph},
                notas = {ph},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (
            "delivered",
            data.get("fecha_entrega", datetime.now().isoformat()),
            data.get("fecha_entrega", datetime.now().isoformat()),
            data.get("notas", data.get("receptor_nombre", "")),
            shipment_id
        ))

        # Free vehicle
        if row["vehiculo_id"]:
            cursor.execute(f"UPDATE fms_vehicles SET estado = {ph} WHERE id = {ph}",
                         ("disponible", row["vehiculo_id"]))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "DELIVERY_CONFIRMED", None, data, user_id)

        return obtener_envio(shipment_id)


# =============================================================================
# Tracking
# =============================================================================

def registrar_evento_tracking(shipment_id: int, data: dict, user_id: str) -> dict:
    """Registra evento de tracking GPS.

    Actual tms_tracking_events columns:
        id, shipment_id, latitud, longitud, velocidad, evento, notas, timestamp, created_at
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        event_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_tracking_events (
                shipment_id, latitud, longitud, velocidad,
                evento, notas, timestamp
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            shipment_id,
            data.get("latitud", data.get("ubicacion_lat")),
            data.get("longitud", data.get("ubicacion_lng")),
            data.get("velocidad"),
            data.get("evento", data.get("evento_tipo", "checkpoint")),
            data.get("notas"),
            data.get("timestamp", datetime.now().isoformat())
        ))

        cursor.execute(f"SELECT * FROM tms_tracking_events WHERE id = {ph}", (event_id,))
        return dict(cursor.fetchone())


def obtener_tracking(shipment_id: int) -> List[dict]:
    """Obtiene eventos de tracking de un envio."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT * FROM tms_tracking_events
            WHERE shipment_id = {ph}
            ORDER BY created_at DESC
        """, (shipment_id,))
        return [dict(r) for r in cursor.fetchall()]


def obtener_envios_en_transito() -> List[dict]:
    """Obtiene envios en transito con ultima posicion.

    Actual tms_tracking_events columns: latitud, longitud (NOT ubicacion_lat/lng).
    Actual tms_shipments columns: vehiculo_id, conductor_id.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*,
                   t.latitud, t.longitud, t.created_at as ultima_actualizacion
            FROM tms_shipments s
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
    """Crea consolidacion.

    Actual tms_consolidations columns:
        id, codigo, estado, tipo, destino, fecha_corte, peso_total, volumen_total,
        shipments_count, ahorro_estimado, created_by, created_at, updated_at
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        codigo = _generate_code("CON", conn)

        consolidation_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_consolidations (
                codigo, tipo, destino, fecha_corte, created_by
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            codigo,
            data.get("tipo", "LTL"),
            data.get("destino"),
            data.get("fecha_corte", data.get("fecha_programada")),
            user_id
        ))

        # Add shipments if provided
        for shipment_id in data.get("shipment_ids", []):
            agregar_envio_a_consolidacion(consolidation_id, shipment_id, user_id)

        _registrar_auditoria(conn, "consolidation", consolidation_id, "CREATE", None, data, user_id)

        cursor.execute(f"SELECT * FROM tms_consolidations WHERE id = {ph}", (consolidation_id,))
        return dict(cursor.fetchone())


def sugerir_consolidaciones(fecha_corte: str = None) -> List[dict]:
    """Algoritmo de consolidacion LTL.

    Agrupa envios confirmados sin consolidar por destino y sugiere consolidaciones.
    Actual tms_shipments columns: peso_kg, volumen_m3, origen, destino, consolidation_id.
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
    """Agrega envio a consolidacion.

    Actual tms_shipments columns: peso_kg, volumen_m3 (NOT peso_total_kg, volumen_total_m3).
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate consolidation
        cursor.execute(f"SELECT * FROM tms_consolidations WHERE id = {ph}", (consolidation_id,))
        consolidation = cursor.fetchone()
        if not consolidation:
            raise ValueError(f"Consolidacion {consolidation_id} no encontrada")

        if consolidation["estado"] not in ["draft", "confirmed"]:
            raise ValueError(f"No se puede agregar a consolidacion en estado {consolidation['estado']}")

        # Validate shipment
        cursor.execute(f"SELECT * FROM tms_shipments WHERE id = {ph}", (shipment_id,))
        shipment = cursor.fetchone()
        if not shipment:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        if shipment["consolidation_id"]:
            raise ValueError(f"Envio ya esta en consolidacion {shipment['consolidation_id']}")

        # Add shipment to consolidation
        cursor.execute(f"""
            UPDATE tms_shipments
            SET consolidation_id = {ph}, updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (consolidation_id, shipment_id))

        # Update consolidation totals
        cursor.execute(f"""
            SELECT COUNT(id) as cnt,
                   COALESCE(SUM(peso_kg), 0) as peso,
                   COALESCE(SUM(volumen_m3), 0) as volumen
            FROM tms_shipments
            WHERE consolidation_id = {ph}
        """, (consolidation_id,))
        totals = cursor.fetchone()

        cursor.execute(f"""
            UPDATE tms_consolidations
            SET shipments_count = {ph},
                peso_total = {ph},
                volumen_total = {ph},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (
            totals["cnt"] if totals else 0,
            totals["peso"] if totals else 0,
            totals["volumen"] if totals else 0,
            consolidation_id
        ))

        _registrar_auditoria(conn, "consolidation", consolidation_id, "ADD_SHIPMENT",
                           None, {"shipment_id": shipment_id}, user_id)

        return obtener_envio(shipment_id)


def remover_envio_de_consolidacion(consolidation_id: int, shipment_id: int, user_id: str) -> dict:
    """Remueve envio de consolidacion."""
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(f"""
            UPDATE tms_shipments
            SET consolidation_id = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph} AND consolidation_id = {ph}
        """, (shipment_id, consolidation_id))

        if cursor.rowcount == 0:
            raise ValueError(f"Envio {shipment_id} no esta en consolidacion {consolidation_id}")

        # Update consolidation totals
        cursor.execute(f"""
            SELECT COUNT(id) as cnt,
                   COALESCE(SUM(peso_kg), 0) as peso,
                   COALESCE(SUM(volumen_m3), 0) as volumen
            FROM tms_shipments
            WHERE consolidation_id = {ph}
        """, (consolidation_id,))
        totals = cursor.fetchone()

        cursor.execute(f"""
            UPDATE tms_consolidations
            SET shipments_count = {ph},
                peso_total = {ph},
                volumen_total = {ph},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (
            totals["cnt"] if totals else 0,
            totals["peso"] if totals else 0,
            totals["volumen"] if totals else 0,
            consolidation_id
        ))

        _registrar_auditoria(conn, "consolidation", consolidation_id, "REMOVE_SHIPMENT",
                           {"shipment_id": shipment_id}, None, user_id)

        return obtener_envio(shipment_id)


def listar_consolidaciones(filtros: dict = None) -> List[dict]:
    """Lista consolidaciones.

    Actual tms_consolidations columns:
        id, codigo, estado, tipo, destino, fecha_corte, peso_total, volumen_total,
        shipments_count, ahorro_estimado, created_by, created_at, updated_at
    PG requires all non-aggregated columns in GROUP BY.
    Since we have aggregate totals in the table itself, we can just select without aggregation.
    """
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
            SELECT c.*
            FROM tms_consolidations c
            WHERE {where_sql}
            ORDER BY c.created_at DESC
        """, params)

        return [dict(r) for r in cursor.fetchall()]


# =============================================================================
# Rutas
# =============================================================================

def crear_ruta(data: dict, user_id: str) -> dict:
    """Crea ruta.

    Actual tms_routes columns:
        id, nombre, origen, destino, distancia_km,
        tiempo_estimado_hrs, activo, created_at
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        route_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_routes (
                nombre, origen, destino,
                distancia_km, tiempo_estimado_hrs, activo
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            data["nombre"],
            data.get("origen", ""),
            data.get("destino", ""),
            data.get("distancia_km", 0),
            data.get("tiempo_estimado_hrs", 0),
            data.get("activo", True),
        ))

        cursor.execute(f"SELECT * FROM tms_routes WHERE id = {ph}", (route_id,))
        return dict(cursor.fetchone())


def listar_rutas(activas_only: bool = True) -> List[dict]:
    """Lista rutas. Actual column: activo (BOOLEAN)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        where_sql = "WHERE activo = TRUE" if activas_only else ""

        cursor.execute(f"""
            SELECT *
            FROM tms_routes
            {where_sql}
            ORDER BY nombre
        """)
        return [dict(r) for r in cursor.fetchall()]


def obtener_ruta(route_id: int) -> Optional[dict]:
    """Obtiene ruta por ID.

    Actual tms_routes columns (migration 027): origen_centro_id, destino_centro_id.
    """
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT *
            FROM tms_routes
            WHERE id = {ph}
        """, (route_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def actualizar_ruta(route_id: int, data: dict) -> dict:
    """Actualiza ruta.

    Actual tms_routes columns: nombre, origen, destino,
    distancia_km, tiempo_estimado_hrs, activo, created_at.
    """
    ph = _ph()
    # Map incoming field names to actual DB column names
    field_map = {
        "nombre": "nombre",
        "origen": "origen",
        "destino": "destino",
        "distancia_km": "distancia_km",
        "tiempo_estimado_hrs": "tiempo_estimado_hrs",
        "activo": "activo",
    }
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        allowed_fields = list(field_map.keys())
        update_fields = []
        params = []

        for field in allowed_fields:
            if field in data:
                db_col = field_map[field]
                update_fields.append(f"{db_col} = {ph}")
                params.append(data[field])

        if update_fields:
            params.append(route_id)
            cursor.execute(f"""
                UPDATE tms_routes
                SET {", ".join(update_fields)}
                WHERE id = {ph}
            """, params)

        return obtener_ruta(route_id)


# =============================================================================
# Costos y Tarifas
# =============================================================================

def registrar_costo(shipment_id: int, data: dict, user_id: str) -> dict:
    """Registra costo para un envio.

    Actual tms_shipment_costs columns:
        id, shipment_id, tipo, concepto, monto, moneda, created_at
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cost_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_shipment_costs (
                shipment_id, tipo, concepto, monto, moneda
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            shipment_id,
            data.get("tipo", "directo"),
            data.get("concepto", data.get("tipo_costo", "")),
            data["monto"],
            data.get("moneda", "ARS")
        ))

        cursor.execute(f"SELECT * FROM tms_shipment_costs WHERE id = {ph}", (cost_id,))
        return dict(cursor.fetchone())


def obtener_costos_envio(shipment_id: int) -> List[dict]:
    """Obtiene costos de un envio. Actual table: tms_shipment_costs."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT * FROM tms_shipment_costs
            WHERE shipment_id = {ph}
            ORDER BY created_at DESC
        """, (shipment_id,))
        return [dict(r) for r in cursor.fetchall()]


def calcular_flete(shipment_id: int) -> dict:
    """Calcula flete basado en tarifa.

    Actual tms_tariffs columns:
        id, transportista_cuit, ruta_origen, ruta_destino, tipo_vehiculo,
        tarifa_base, tarifa_por_km, tarifa_por_kg, vigencia_desde, vigencia_hasta, created_at, activo

    Actual tms_shipments columns: peso_kg, volumen_m3, route_id, origen, destino.
    """
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get shipment with route info
        cursor.execute(f"""
            SELECT s.*, r.distancia_km
            FROM tms_shipments s
            LEFT JOIN tms_routes r ON s.route_id = r.id
            WHERE s.id = {ph}
        """, (shipment_id,))
        shipment = cursor.fetchone()

        if not shipment:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        shipment = dict(shipment)

        # Find applicable tariff from tms_tariffs
        bool_true = "TRUE" if is_using_postgresql() else "1"
        cursor.execute(f"""
            SELECT * FROM tms_tariffs
            WHERE activo = {bool_true}
              AND (ruta_origen IS NULL OR ruta_origen = {ph})
              AND (ruta_destino IS NULL OR ruta_destino = {ph})
            ORDER BY
                (CASE WHEN ruta_origen IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN ruta_destino IS NOT NULL THEN 1 ELSE 0 END) DESC
            LIMIT 1
        """, (shipment.get("origen", ""), shipment.get("destino", "")))

        tariff = cursor.fetchone()

        if not tariff:
            return {"error": "No se encontro tarifa aplicable", "flete": 0}

        tariff = dict(tariff)

        # Calculate using actual tms_tariffs columns
        distancia = shipment.get("distancia_km") or 0
        peso = shipment.get("peso_kg") or 0

        flete_base = (tariff.get("tarifa_base") or 0)
        flete_km = (tariff.get("tarifa_por_km") or 0) * distancia
        flete_peso = (tariff.get("tarifa_por_kg") or 0) * peso

        flete_total = flete_base + flete_km + flete_peso

        return {
            "flete_base": round(float(flete_base), 2),
            "flete_km": round(float(flete_km), 2),
            "flete_peso": round(float(flete_peso), 2),
            "flete_total": round(float(flete_total), 2),
            "tariff_id": tariff["id"],
            "distancia_km": distancia
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
    """Crea tarifa.

    Actual tms_tariffs columns:
        id, transportista_cuit, ruta_origen, ruta_destino, tipo_vehiculo,
        tarifa_base, tarifa_por_km, tarifa_por_kg, vigencia_desde, vigencia_hasta, created_at, activo
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        tariff_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_tariffs (
                transportista_cuit, ruta_origen, ruta_destino, tipo_vehiculo,
                tarifa_base, tarifa_por_km, tarifa_por_kg,
                vigencia_desde, vigencia_hasta, activo
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            data.get("transportista_cuit"),
            data.get("ruta_origen", data.get("origen_zona")),
            data.get("ruta_destino", data.get("destino_zona")),
            data.get("tipo_vehiculo"),
            data.get("tarifa_base", 0),
            data.get("tarifa_por_km", data.get("tarifa_base_km", 0)),
            data.get("tarifa_por_kg", data.get("tarifa_peso_kg", 0)),
            data.get("vigencia_desde"),
            data.get("vigencia_hasta"),
            data.get("activo", True)
        ))

        cursor.execute(f"SELECT * FROM tms_tariffs WHERE id = {ph}", (tariff_id,))
        return dict(cursor.fetchone())


def actualizar_tarifa(tariff_id: int, data: dict) -> dict:
    """Actualiza tarifa.

    Actual tms_tariffs columns:
        transportista_cuit, ruta_origen, ruta_destino, tipo_vehiculo,
        tarifa_base, tarifa_por_km, tarifa_por_kg, vigencia_desde, vigencia_hasta, activo
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        allowed_fields = [
            "transportista_cuit", "ruta_origen", "ruta_destino", "tipo_vehiculo",
            "tarifa_base", "tarifa_por_km", "tarifa_por_kg",
            "vigencia_desde", "vigencia_hasta", "activo"
        ]

        update_fields = []
        params = []
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = {ph}")
                params.append(data[field])

        if update_fields:
            params.append(tariff_id)
            cursor.execute(f"""
                UPDATE tms_tariffs
                SET {", ".join(update_fields)}
                WHERE id = {ph}
            """, params)

        cursor.execute(f"SELECT * FROM tms_tariffs WHERE id = {ph}", (tariff_id,))
        return dict(cursor.fetchone())


# =============================================================================
# Cierre Financiero
# =============================================================================

def cerrar_viaje(shipment_id: int, costos_extra: list = None, user_id: str = "") -> dict:
    """Cierre financiero de viaje.

    Actual tms_settlements columns:
        id, shipment_id, transportista_cuit, monto_base, ajustes, monto_final,
        estado, periodo, created_at

    Actual tms_shipment_costs columns:
        id, shipment_id, tipo, concepto, monto, moneda, created_at
    """
    costos_extra = costos_extra or []
    ph = _ph()

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        # Validate state
        cursor.execute(f"SELECT * FROM tms_shipments WHERE id = {ph}", (shipment_id,))
        shipment = cursor.fetchone()

        if not shipment:
            raise ValueError(f"Envio {shipment_id} no encontrado")

        shipment = dict(shipment)

        if shipment["estado"] != "delivered":
            raise ValueError(f"Envio debe estar en estado delivered, actual: {shipment['estado']}")

        # Get existing costs from tms_shipment_costs
        cursor.execute(f"""
            SELECT concepto, SUM(monto) as total
            FROM tms_shipment_costs
            WHERE shipment_id = {ph}
            GROUP BY concepto
        """, (shipment_id,))

        costos = {row["concepto"]: row["total"] for row in cursor.fetchall()}

        # Add extra costs
        for costo in costos_extra:
            registrar_costo(shipment_id, costo, user_id)
            tipo = costo.get("concepto", costo.get("tipo_costo", "otro"))
            costos[tipo] = costos.get(tipo, 0) + costo["monto"]

        # Calculate totals
        total_costos = sum(v for v in costos.values())

        # Calculate freight income
        flete_data = calcular_flete(shipment_id)
        ingreso_flete = flete_data.get("flete_total", 0)

        # Ajustes and monto_final
        ajustes = ingreso_flete - total_costos
        monto_final = ingreso_flete

        # Create settlement in tms_settlements
        settlement_id = insert_returning_id(cursor, f"""
            INSERT INTO tms_settlements (
                shipment_id, transportista_cuit, monto_base, ajustes, monto_final,
                estado, periodo
            ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
        """, (
            shipment_id,
            shipment.get("transportista", ""),
            total_costos,
            ajustes,
            monto_final,
            "cerrado",
            datetime.now().strftime("%Y-%m")
        ))

        # Update shipment state
        cursor.execute(f"""
            UPDATE tms_shipments
            SET estado = {ph}, updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, ("settled", shipment_id))

        # Audit
        _registrar_auditoria(conn, "shipment", shipment_id, "SETTLED", None,
                           {"settlement_id": settlement_id}, user_id)

        cursor.execute(f"SELECT * FROM tms_settlements WHERE id = {ph}", (settlement_id,))
        return dict(cursor.fetchone())


def obtener_settlement(shipment_id: int) -> Optional[dict]:
    """Obtiene cierre financiero de un envio. Actual table: tms_settlements."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT * FROM tms_settlements
            WHERE shipment_id = {ph}
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
    """Registra carga de combustible.

    Note: tms_fuel_records may not exist in production schema.
    This function is kept for backward compatibility but uses tms_shipment_costs as fallback.
    """
    # Register as a cost if shipment provided
    if data.get("shipment_id"):
        costo_total = data.get("costo_total", data.get("litros", 0) * data.get("costo_litro", 0))
        return registrar_costo(
            data["shipment_id"],
            {
                "tipo": "combustible",
                "concepto": "combustible",
                "monto": costo_total,
            },
            user_id
        )

    # If no shipment, just return the data as-is
    return {
        "vehicle_id": data.get("vehicle_id"),
        "litros": data.get("litros"),
        "costo_total": data.get("costo_total", data.get("litros", 0) * data.get("costo_litro", 0)),
        "registered": True
    }


# =============================================================================
# Configuracion TMS
# =============================================================================

def obtener_config(clave: str) -> Any:
    """Obtiene configuracion TMS.

    Note: tms_config may not exist in all environments.
    Returns None gracefully if table doesn't exist.
    """
    ph = _ph()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT valor FROM tms_config WHERE clave = {ph}", (clave,))
            row = cursor.fetchone()
            return row["valor"] if row else None
    except Exception:
        logger.warning("tms_config table not available, returning None for key: %s", clave)
        return None


def actualizar_config(clave: str, valor: str, user_id: str) -> dict:
    """Actualiza configuracion TMS.

    Note: tms_config may not exist in all environments.
    """
    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(f"SELECT id FROM tms_config WHERE clave = {ph}", (clave,))
        exists = cursor.fetchone()

        if exists:
            cursor.execute(f"""
                UPDATE tms_config
                SET valor = {ph}, updated_by = {ph}, updated_at = CURRENT_TIMESTAMP
                WHERE clave = {ph}
            """, (valor, user_id, clave))
        else:
            cursor.execute(f"""
                INSERT INTO tms_config (clave, valor, created_by)
                VALUES ({ph}, {ph}, {ph})
            """, (clave, valor, user_id))

        cursor.execute(f"SELECT * FROM tms_config WHERE clave = {ph}", (clave,))
        return dict(cursor.fetchone())


# =============================================================================
# KPIs TMS
# =============================================================================

def obtener_kpis_tms() -> dict:
    """Obtiene KPIs del modulo TMS.

    Uses actual table columns:
    - tms_shipments: fecha_llegada_real, fecha_llegada_est, estado
    - tms_shipment_costs: monto
    - tms_consolidations: peso_total
    - tms_settlements: monto_base, monto_final
    """
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

        # On-time delivery rate — actual columns: fecha_llegada_real, fecha_llegada_est
        cursor.execute("""
            SELECT
                COUNT(*) as total_delivered,
                SUM(CASE WHEN fecha_llegada_real <= fecha_llegada_est THEN 1 ELSE 0 END) as on_time
            FROM tms_shipments
            WHERE estado = 'delivered'
              AND fecha_llegada_real IS NOT NULL
              AND fecha_llegada_est IS NOT NULL
        """)
        delivery = cursor.fetchone()
        total_delivered = (delivery["total_delivered"] if isinstance(delivery, dict) else delivery[0]) or 0
        on_time_val = (delivery["on_time"] if isinstance(delivery, dict) else delivery[1]) or 0
        on_time_rate = (on_time_val / total_delivered * 100) if total_delivered > 0 else 0

        # Average cost per shipment from tms_shipment_costs
        cursor.execute("""
            SELECT AVG(total_cost) as avg_cost
            FROM (
                SELECT shipment_id, SUM(monto) as total_cost
                FROM tms_shipment_costs
                GROUP BY shipment_id
            ) sub
        """)
        row = cursor.fetchone()
        avg_cost = (row["avg_cost"] if isinstance(row, dict) else row[0]) or 0

        # Average consolidation utilization — actual column: peso_total
        cursor.execute("""
            SELECT AVG(COALESCE(peso_total, 0)) as avg_peso
            FROM tms_consolidations
        """)
        row = cursor.fetchone()
        avg_peso = (row["avg_peso"] if isinstance(row, dict) else row[0]) or 0

        # Average settlement margin from tms_settlements — actual columns: monto_base, monto_final
        cursor.execute("""
            SELECT AVG(
                CASE
                    WHEN monto_final > 0
                    THEN (monto_final - monto_base) / monto_final * 100
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
            "avg_consolidation_peso": round(float(avg_peso), 2),
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
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT clave, valor FROM tms_config")
            return {row[0]: row[1] for row in cursor.fetchall()}
    except Exception:
        logger.warning("tms_config table not available")
        return {}


# --- Additional English aliases for route compatibility ---

def create_shipment(user_id: str, data: dict) -> dict:
    """Alias: route passes (user_id, data), Spanish fn expects (data, user_id)."""
    return crear_envio(data, user_id)


def update_shipment(shipment_id: int, user_id: str, data: dict) -> dict:
    """Alias: route passes (shipment_id, user_id, data), Spanish fn expects (shipment_id, data, user_id)."""
    return actualizar_envio(shipment_id, data, user_id)


def transition_shipment(shipment_id: int, nuevo_estado: str, user_id: str, razon: str = "") -> dict:
    """Alias: wraps transicionar_envio and adds 'ok' key expected by route."""
    try:
        result = transicionar_envio(shipment_id, nuevo_estado, user_id, razon)
        if result:
            result["ok"] = True
        return result or {"ok": False, "error": "Transicion fallida"}
    except ValueError as e:
        return {"ok": False, "error": str(e)}


def assign_shipment(shipment_id: int, vehicle_id: int, driver_id: int,
                    route_id: int = None, user_id: str = "") -> dict:
    """Alias: same parameter order as asignar_vehiculo_conductor."""
    return asignar_vehiculo_conductor(shipment_id, vehicle_id, driver_id, route_id, user_id)


def deliver_shipment(shipment_id: int, receptor_nombre: str,
                     notas_entrega: str = "", user_id: str = "") -> dict:
    """Alias: route passes individual args, Spanish fn expects (shipment_id, data, user_id)."""
    data = {"receptor_nombre": receptor_nombre, "notas": notas_entrega}
    return confirmar_entrega(shipment_id, data, user_id)


def register_tracking(shipment_id: int, user_id: str, data: dict) -> dict:
    """Alias: route passes (shipment_id, user_id, data), Spanish fn expects (shipment_id, data, user_id)."""
    return registrar_evento_tracking(shipment_id, data, user_id)


def create_consolidation(user_id: str, data: dict) -> dict:
    """Alias: route passes (user_id, data), Spanish fn expects (data, user_id)."""
    return crear_consolidacion(data, user_id)


def add_shipment_to_consolidation(consolidation_id: int, shipment_id: int,
                                  user_id: str) -> dict:
    """Alias: same parameter order as agregar_envio_a_consolidacion."""
    return agregar_envio_a_consolidacion(consolidation_id, shipment_id, user_id)


def remove_shipment_from_consolidation(consolidation_id: int, shipment_id: int,
                                       user_id: str) -> dict:
    """Alias: same parameter order as remover_envio_de_consolidacion."""
    return remover_envio_de_consolidacion(consolidation_id, shipment_id, user_id)


def create_route(user_id: str, data: dict) -> dict:
    """Alias: route passes (user_id, data), Spanish fn expects (data, user_id)."""
    return crear_ruta(data, user_id)


def update_route(route_id: int, user_id: str, data: dict) -> dict:
    """Alias: route passes (route_id, user_id, data), Spanish fn expects (route_id, data)."""
    return actualizar_ruta(route_id, data)


def get_route(route_id: int, user_id: str = None) -> Optional[dict]:
    """Alias: route passes (route_id, user_id), Spanish fn expects (route_id)."""
    return obtener_ruta(route_id)


def register_cost(shipment_id: int, user_id: str, data: dict) -> dict:
    """Alias: route passes (shipment_id, user_id, data), Spanish fn expects (shipment_id, data, user_id)."""
    return registrar_costo(shipment_id, data, user_id)


def create_tariff(user_id: str, data: dict) -> dict:
    """Alias: route passes (user_id, data), Spanish fn expects (data)."""
    return crear_tarifa(data)


def update_tariff(tariff_id: int, user_id: str, data: dict) -> dict:
    """Alias: route passes (tariff_id, user_id, data), Spanish fn expects (tariff_id, data)."""
    return actualizar_tarifa(tariff_id, data)


def settle_shipment(shipment_id: int, user_id: str, notas: str = "") -> dict:
    """Alias: route passes (shipment_id, user_id, notas), Spanish fn expects (shipment_id, costos_extra, user_id)."""
    return cerrar_viaje(shipment_id, costos_extra=None, user_id=user_id)


def register_fuel(user_id: str, data: dict) -> dict:
    """Alias: route passes (user_id, data), Spanish fn expects (data, user_id)."""
    return registrar_combustible(data, user_id)


def update_config(config_key: str, value: str, user_id: str) -> dict:
    """Alias: route passes (config_key, value, user_id), Spanish fn expects (clave, valor, user_id)."""
    return actualizar_config(config_key, value, user_id)


def get_shipment(shipment_id: int, user_id: str = None) -> Optional[dict]:
    """Alias: route passes (shipment_id, user_id), Spanish fn expects (shipment_id)."""
    return obtener_envio(shipment_id)


def get_tracking(shipment_id: int, user_id: str = None) -> List[dict]:
    """Alias: route passes (shipment_id, user_id), Spanish fn expects (shipment_id)."""
    return obtener_tracking(shipment_id)


def get_shipment_costs(shipment_id: int, user_id: str = None) -> List[dict]:
    """Alias: route passes (shipment_id, user_id), Spanish fn expects (shipment_id)."""
    return obtener_costos_envio(shipment_id)


def get_settlement(shipment_id: int, user_id: str = None) -> Optional[dict]:
    """Alias: route passes (shipment_id, user_id), Spanish fn expects (shipment_id)."""
    return obtener_settlement(shipment_id)


def calculate_freight(shipment_id: int, user_id: str = None) -> dict:
    """Alias: route passes (shipment_id, user_id), Spanish fn expects (shipment_id)."""
    return calcular_flete(shipment_id)
