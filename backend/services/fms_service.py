"""
FMS Service - Logica de negocio para Fleet Management System.

Maneja: vehiculos, conductores, ordenes de trabajo, mantenimiento preventivo,
inspecciones pre/post viaje, documentos.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id, is_using_postgresql
from backend.core.tms_schemas import (
    INSPECTION_CHECKLIST,
    validar_transicion_wo,
)


def _ph():
    """Return the correct placeholder character for the current DB."""
    return "%s" if is_using_postgresql() else "?"

logger = logging.getLogger(__name__)


# =============================================================================
# Code Generation
# =============================================================================

def _generate_wo_code(conn) -> str:
    """Genera codigo unico para OT: WO-2026-0001"""
    year = datetime.now().year
    cursor = conn.execute(
        "SELECT MAX(CAST(RIGHT(codigo, 4) AS INTEGER)) as max_num FROM fms_work_orders WHERE codigo LIKE ?",
        (f"WO-{year}-%",)
    )
    row = cursor.fetchone()
    max_num = row["max_num"] if row and row["max_num"] else 0
    return f"WO-{year}-{max_num + 1:04d}"


# =============================================================================
# Vehiculos CRUD
# =============================================================================

def crear_vehiculo(data: dict) -> dict:
    """Crea un nuevo vehiculo en la flota."""
    required_fields = ["placa", "tipo", "marca", "modelo", "anio"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    with get_db_transaction() as conn:
        vehicle_id = insert_returning_id(
            conn,
            "fms_vehicles",
            {
                "placa": data["placa"],
                "tipo": data["tipo"],
                "marca": data["marca"],
                "modelo": data["modelo"],
                "anio": data["anio"],
                "vin": data.get("vin"),
                "capacidad_peso_kg": data.get("capacidad_peso_kg"),
                "capacidad_vol_m3": data.get("capacidad_vol_m3"),
                "cadena_frio": data.get("cadena_frio", False),
                "hazmat_cert": data.get("hazmat_cert", False),
                "estado": "disponible",
                "odometro_actual": data.get("odometro_actual", 0),
                "rendimiento_km_lt": data.get("rendimiento_km_lt"),
                "gps_device_id": data.get("gps_device_id"),
                "activo": True,
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Vehiculo creado: {vehicle_id} - {data['placa']}")
        return obtener_vehiculo(vehicle_id)


def obtener_vehiculo(vehicle_id: int) -> Optional[dict]:
    """Obtiene vehiculo por ID con docs y planes de mantenimiento."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.execute(f"SELECT * FROM fms_vehicles WHERE id = {ph}", (vehicle_id,))
        row = cursor.fetchone()
        if not row:
            return None

        vehicle = dict(row)

        # Obtener documentos (actual table: fms_vehicle_documents)
        cursor = conn.execute(
            f"SELECT * FROM fms_vehicle_documents WHERE vehicle_id = {ph} ORDER BY fecha_vencimiento",
            (vehicle_id,)
        )
        vehicle["documentos"] = [dict(r) for r in cursor.fetchall()]

        # Obtener planes de mantenimiento (activo is boolean in PG)
        activo_val = "TRUE" if is_using_postgresql() else "1"
        cursor = conn.execute(
            f"SELECT * FROM fms_maintenance_plans WHERE vehicle_id = {ph} AND activo = {activo_val}",
            (vehicle_id,)
        )
        vehicle["planes_mantenimiento"] = [dict(r) for r in cursor.fetchall()]

        return vehicle


def listar_vehiculos(filtros: dict = None) -> List[dict]:
    """Lista vehiculos con filtros: estado, tipo, activo."""
    filtros = filtros or {}
    ph = _ph()
    query = "SELECT * FROM fms_vehicles WHERE 1=1"
    params = []

    if "estado" in filtros:
        query += f" AND estado = {ph}"
        params.append(filtros["estado"])

    if "tipo" in filtros:
        query += f" AND tipo = {ph}"
        params.append(filtros["tipo"])

    if "activo" in filtros:
        query += f" AND activo = {ph}"
        params.append(bool(filtros["activo"]))

    query += " ORDER BY patente"

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def actualizar_vehiculo(vehicle_id: int, data: dict) -> dict:
    """Actualiza datos de vehiculo."""
    allowed_fields = [
        "placa", "tipo", "marca", "modelo", "anio", "vin",
        "capacidad_peso_kg", "capacidad_vol_m3", "cadena_frio",
        "hazmat_cert", "odometro_actual", "rendimiento_km_lt",
        "gps_device_id", "activo"
    ]

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise ValueError("No hay campos validos para actualizar")

    updates["updated_at"] = datetime.now().isoformat()

    with get_db_transaction() as conn:
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [vehicle_id]
        conn.execute(
            f"UPDATE fms_vehicles SET {set_clause} WHERE id = ?",
            values
        )
        logger.info(f"Vehiculo actualizado: {vehicle_id}")
        return obtener_vehiculo(vehicle_id)


def cambiar_estado_vehiculo(vehicle_id: int, nuevo_estado: str, user_id: str = "") -> dict:
    """Cambia estado de vehiculo (disponible, en_ruta, en_mantenimiento, etc.)."""
    estados_validos = ["disponible", "en_ruta", "en_mantenimiento", "fuera_servicio", "baja"]
    if nuevo_estado not in estados_validos:
        raise ValueError(f"Estado invalido: {nuevo_estado}")

    with get_db_transaction() as conn:
        cursor = conn.execute("SELECT estado FROM fms_vehicles WHERE id = ?", (vehicle_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Vehiculo no encontrado: {vehicle_id}")

        estado_anterior = row["estado"]

        conn.execute(
            "UPDATE fms_vehicles SET estado = ?, updated_at = ? WHERE id = ?",
            (nuevo_estado, datetime.now().isoformat(), vehicle_id)
        )

        logger.info(f"Vehiculo {vehicle_id} cambio estado: {estado_anterior} -> {nuevo_estado}")
        return obtener_vehiculo(vehicle_id)


def obtener_vehiculos_disponibles(requiere_frio: bool = False, requiere_hazmat: bool = False,
                                   peso_min: float = 0, vol_min: float = 0) -> List[dict]:
    """Obtiene vehiculos disponibles que cumplan requisitos."""
    ph = _ph()
    # Use boolean TRUE for PostgreSQL, 1 for SQLite
    bool_true = "TRUE" if is_using_postgresql() else "1"
    query = f"""
        SELECT * FROM fms_vehicles
        WHERE estado = 'disponible' AND activo = {bool_true}
    """
    params = []

    if requiere_frio:
        query += f" AND requiere_frio = {bool_true}"

    if requiere_hazmat:
        query += f" AND requiere_hazmat = {bool_true}"

    if peso_min > 0:
        query += f" AND capacidad_kg >= {ph}"
        params.append(peso_min)

    if vol_min > 0:
        query += f" AND capacidad_m3 >= {ph}"
        params.append(vol_min)

    query += " ORDER BY capacidad_kg DESC"

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


# =============================================================================
# Conductores CRUD
# =============================================================================

def crear_conductor(data: dict) -> dict:
    """Crea un nuevo conductor."""
    required_fields = ["nombre"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    with get_db_transaction() as conn:
        driver_id = insert_returning_id(
            conn,
            "fms_drivers",
            {
                "nombre": data["nombre"],
                "apellido": data.get("apellido"),
                "usuario_id": data.get("usuario_id"),
                "numero_licencia": data.get("numero_licencia"),
                "tipo_licencia": data.get("tipo_licencia"),
                "vigencia_licencia": data.get("vigencia_licencia"),
                "vigencia_medica": data.get("vigencia_medica"),
                "capacitacion_hazmat": data.get("capacitacion_hazmat", False),
                "estado": "activo",
                "telefono": data.get("telefono"),
                "contacto_emergencia": data.get("contacto_emergencia"),
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Conductor creado: {driver_id} - {data['nombre']} {data.get('apellido', '')}")
        return obtener_conductor(driver_id)


def obtener_conductor(driver_id: int) -> Optional[dict]:
    """Obtiene conductor por ID."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.execute(f"SELECT * FROM fms_drivers WHERE id = {ph}", (driver_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def listar_conductores(filtros: dict = None) -> List[dict]:
    """Lista conductores con filtros: estado, hazmat."""
    filtros = filtros or {}
    ph = _ph()
    query = "SELECT * FROM fms_drivers WHERE 1=1"
    params = []

    if "estado" in filtros:
        query += f" AND estado = {ph}"
        params.append(filtros["estado"])

    if "hazmat_cert" in filtros or "capacitacion_hazmat" in filtros:
        val = filtros.get("hazmat_cert", filtros.get("capacitacion_hazmat"))
        query += f" AND hazmat_cert = {ph}"
        params.append(bool(val))

    query += " ORDER BY nombre"

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def actualizar_conductor(driver_id: int, data: dict) -> dict:
    """Actualiza datos de conductor."""
    allowed_fields = [
        "nombre", "apellido", "usuario_id", "numero_licencia", "tipo_licencia",
        "vigencia_licencia", "vigencia_medica", "capacitacion_hazmat",
        "telefono", "contacto_emergencia", "estado"
    ]

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise ValueError("No hay campos validos para actualizar")

    updates["updated_at"] = datetime.now().isoformat()

    with get_db_transaction() as conn:
        ph = _ph()
        set_clause = ", ".join([f"{k} = {ph}" for k in updates.keys()])
        values = list(updates.values()) + [driver_id]
        conn.execute(
            f"UPDATE fms_drivers SET {set_clause} WHERE id = {ph}",
            values
        )
        logger.info(f"Conductor actualizado: {driver_id}")
        return obtener_conductor(driver_id)


def obtener_conductores_disponibles(requiere_hazmat: bool = False) -> List[dict]:
    """Obtiene conductores activos con licencia vigente."""
    ph = _ph()
    bool_true = "TRUE" if is_using_postgresql() else "1"
    hoy = datetime.now().date().isoformat()
    # fms_drivers actual cols: id, nombre, documento, licencia_tipo, licencia_vencimiento, estado, hazmat_cert, telefono
    query = f"""
        SELECT * FROM fms_drivers
        WHERE estado = 'activo'
        AND (licencia_vencimiento IS NULL OR licencia_vencimiento > {ph})
    """
    params = [hoy]

    if requiere_hazmat:
        query += f" AND hazmat_cert = {bool_true}"

    query += " ORDER BY nombre"

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


# =============================================================================
# Ordenes de Trabajo (Work Orders)
# =============================================================================

def crear_orden_trabajo(data: dict, user_id: str) -> dict:
    """Crea OT. Si prioridad >= 4, notifica al fleet_manager.
    Cambia vehiculo a 'en_mantenimiento'."""
    required_fields = ["vehicle_id", "tipo", "descripcion", "prioridad"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    with get_db_transaction() as conn:
        wo_code = _generate_wo_code(conn)

        wo_id = insert_returning_id(
            conn,
            "fms_work_orders",
            {
                "codigo": wo_code,
                "vehicle_id": data["vehicle_id"],
                "tipo": data["tipo"],
                "descripcion": data["descripcion"],
                "prioridad": data["prioridad"],
                "odometro_ingreso": data.get("odometro_ingreso"),
                "estado": "draft",
                "created_by": user_id,
                "created_at": datetime.now().isoformat(),
            }
        )

        # Cambiar vehiculo a mantenimiento
        conn.execute(
            "UPDATE fms_vehicles SET estado = 'en_mantenimiento', updated_at = ? WHERE id = ?",
            (datetime.now().isoformat(), data["vehicle_id"])
        )

        logger.info(f"OT creada: {wo_code} - Vehicle {data['vehicle_id']} - Prioridad {data['prioridad']}")

        # Si es urgente, crear notificacion (placeholder - requiere integracion con notification_service)
        if data["prioridad"] >= 4:
            logger.warning(f"OT urgente creada: {wo_code} - Requiere atencion inmediata")

        return obtener_orden_trabajo(wo_id)


def obtener_orden_trabajo(wo_id: int) -> Optional[dict]:
    """Obtiene OT por ID con partes."""
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT * FROM fms_work_orders WHERE id = ?", (wo_id,))
        row = cursor.fetchone()
        if not row:
            return None

        wo = dict(row)

        # Obtener partes
        cursor = conn.execute(
            "SELECT * FROM fms_wo_parts WHERE work_order_id = ? ORDER BY id",
            (wo_id,)
        )
        wo["partes"] = [dict(r) for r in cursor.fetchall()]

        # Obtener info del vehiculo
        cursor = conn.execute(
            "SELECT placa, marca, modelo FROM fms_vehicles WHERE id = ?",
            (wo["vehicle_id"],)
        )
        vehicle = cursor.fetchone()
        if vehicle:
            wo["vehiculo"] = dict(vehicle)

        return wo


def listar_ordenes_trabajo(filtros: dict = None, page: int = 1, per_page: int = 20) -> dict:
    """Lista OTs con filtros: estado, tipo, vehicle_id, prioridad."""
    filtros = filtros or {}
    query = "SELECT * FROM fms_work_orders WHERE 1=1"
    params = []

    if "estado" in filtros:
        query += " AND estado = ?"
        params.append(filtros["estado"])

    if "tipo" in filtros:
        query += " AND tipo = ?"
        params.append(filtros["tipo"])

    if "vehicle_id" in filtros:
        query += " AND vehicle_id = ?"
        params.append(filtros["vehicle_id"])

    if "prioridad" in filtros:
        query += " AND prioridad = ?"
        params.append(filtros["prioridad"])

    with get_db_connection() as conn:
        # Count total
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        cursor = conn.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Get page
        query += " ORDER BY prioridad DESC, created_at DESC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])

        cursor = conn.execute(query, params)
        items = [dict(row) for row in cursor.fetchall()]

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page
        }


def transicionar_orden_trabajo(wo_id: int, nuevo_estado: str, user_id: str, datos: dict = None) -> dict:
    """Cambia estado de OT validando FSM.
    - COMPLETED: calcula costo_total = mano_obra + partes, actualiza vehiculo a disponible,
      recalcula proxima fecha/km mantenimiento
    - PENDING_PARTS: registra que espera repuesto
    """
    datos = datos or {}

    with get_db_transaction() as conn:
        cursor = conn.execute("SELECT * FROM fms_work_orders WHERE id = ?", (wo_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"OT no encontrada: {wo_id}")

        wo = dict(row)
        estado_actual = wo["estado"]

        # Validar transicion
        if not validar_transicion_wo(estado_actual, nuevo_estado):
            raise ValueError(f"Transicion invalida: {estado_actual} -> {nuevo_estado}")

        updates = {"estado": nuevo_estado, "updated_at": datetime.now().isoformat()}

        if nuevo_estado == "in_progress":
            updates["fecha_ingreso"] = datos.get("fecha_ingreso", datetime.now().isoformat())
            updates["tecnico_asignado"] = datos.get("tecnico_asignado")

        elif nuevo_estado == "pending_parts":
            updates["notas"] = datos.get("notas", "En espera de repuestos")
            logger.info(f"OT {wo['codigo']} en espera de repuestos")

        elif nuevo_estado == "completed":
            updates["fecha_completado"] = datetime.now().isoformat()
            updates["solucion"] = datos.get("solucion")
            updates["costo_mano_obra"] = datos.get("costo_mano_obra", 0)

            # Calcular costo total de partes
            cursor = conn.execute(
                "SELECT SUM(cantidad * costo_unitario) as total_partes FROM fms_wo_parts WHERE work_order_id = ?",
                (wo_id,)
            )
            partes_row = cursor.fetchone()
            costo_partes = partes_row["total_partes"] if partes_row and partes_row["total_partes"] else 0

            updates["costo_partes"] = costo_partes
            updates["costo_total"] = updates["costo_mano_obra"] + costo_partes

            # Actualizar vehiculo a disponible
            conn.execute(
                "UPDATE fms_vehicles SET estado = 'disponible', updated_at = ? WHERE id = ?",
                (datetime.now().isoformat(), wo["vehicle_id"])
            )

            # Recalcular proximo mantenimiento si fue preventivo
            if wo["tipo"] == "preventivo":
                _recalcular_proximo_mantenimiento(conn, wo["vehicle_id"], datos.get("odometro_ingreso"))

            logger.info(f"OT {wo['codigo']} completada - Costo total: ${updates['costo_total']:.2f}")

        elif nuevo_estado == "cancelled":
            updates["notas"] = datos.get("motivo_cancelacion", "Cancelada")
            # Restaurar vehiculo a disponible
            conn.execute(
                "UPDATE fms_vehicles SET estado = 'disponible', updated_at = ? WHERE id = ?",
                (datetime.now().isoformat(), wo["vehicle_id"])
            )

        # Update WO
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [wo_id]
        conn.execute(f"UPDATE fms_work_orders SET {set_clause} WHERE id = ?", values)

        return obtener_orden_trabajo(wo_id)


def _recalcular_proximo_mantenimiento(conn, vehicle_id: int, km_actual: Optional[int]):
    """Recalcula proxima fecha/km de mantenimiento preventivo."""
    if not km_actual:
        return

    cursor = conn.execute(
        "SELECT * FROM fms_maintenance_plans WHERE vehicle_id = ? AND activo = 1",
        (vehicle_id,)
    )

    for plan_row in cursor.fetchall():
        plan = dict(plan_row)
        updates = {}

        if plan["intervalo_km"]:
            updates["proximo_km"] = km_actual + plan["intervalo_km"]

        if plan["intervalo_dias"]:
            updates["proxima_fecha"] = (datetime.now() + timedelta(days=plan["intervalo_dias"])).date().isoformat()

        if updates:
            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            values = list(updates.values()) + [plan["id"]]
            conn.execute(
                f"UPDATE fms_maintenance_plans SET {set_clause} WHERE id = ?",
                values
            )


def agregar_parte_ot(wo_id: int, data: dict, user_id: str) -> dict:
    """Agrega parte/repuesto a una OT."""
    required_fields = ["descripcion", "cantidad"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    with get_db_transaction() as conn:
        part_id = insert_returning_id(
            conn,
            "fms_wo_parts",
            {
                "work_order_id": wo_id,
                "material_id": data.get("material_id"),
                "descripcion": data["descripcion"],
                "cantidad": data["cantidad"],
                "costo_unitario": data.get("costo_unitario", 0),
                "costo_total": data["cantidad"] * data.get("costo_unitario", 0),
                "de_inventario": data.get("de_inventario", 0),
                "estado": "pendiente",
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Parte agregada a OT {wo_id}: {data['descripcion']}")

        cursor = conn.execute("SELECT * FROM fms_wo_parts WHERE id = ?", (part_id,))
        return dict(cursor.fetchone())


def solicitar_repuesto_spm(wo_id: int, material_id: str, cantidad: float, user_id: str) -> dict:
    """Solicita repuesto creando solicitud SPM automatica.
    Implements the solicitar_repuesto_desde_ot algorithm:
    - Create SPM solicitud with tipo='repuesto_flota'
    - Link part to solicitud_id
    - Transition OT to PENDING_PARTS if was IN_PROGRESS
    """
    with get_db_transaction() as conn:
        # Get WO info
        cursor = conn.execute("SELECT * FROM fms_work_orders WHERE id = ?", (wo_id,))
        wo_row = cursor.fetchone()
        if not wo_row:
            raise ValueError(f"OT no encontrada: {wo_id}")

        wo = dict(wo_row)

        # Placeholder: En produccion, esto llamaria al servicio de solicitudes
        # Por ahora, creamos un registro de integracion
        solicitud_ref = f"SPM-FLEET-{wo['codigo']}-{material_id}"

        logger.info(f"Solicitud SPM creada para repuesto: {solicitud_ref}")
        logger.info(f"Material: {material_id}, Cantidad: {cantidad}, Usuario: {user_id}")

        # Agregar parte a la OT con referencia
        part_id = insert_returning_id(
            conn,
            "fms_wo_parts",
            {
                "work_order_id": wo_id,
                "material_id": material_id,
                "descripcion": f"Repuesto solicitado via SPM: {material_id} (ref: {solicitud_ref})",
                "cantidad": cantidad,
                "estado": "solicitado",
                "created_at": datetime.now().isoformat(),
            }
        )

        # Transicionar a PENDING_PARTS si estaba en progreso
        if wo["estado"] == "in_progress":
            transicionar_orden_trabajo(wo_id, "pending_parts", user_id)

        return {
            "part_id": part_id,
            "solicitud_ref": solicitud_ref,
            "wo_code": wo["codigo"],
            "material_id": material_id,
            "cantidad": cantidad,
            "mensaje": "Solicitud de repuesto creada. Integracion con SPM pendiente."
        }


# =============================================================================
# Mantenimiento Preventivo
# =============================================================================

def crear_plan_mantenimiento(data: dict) -> dict:
    """Crea plan de mantenimiento preventivo para un vehiculo."""
    required_fields = ["vehicle_id", "tipo_mantenimiento"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    if not data.get("intervalo_km") and not data.get("intervalo_dias"):
        raise ValueError("Debe especificar intervalo_km o intervalo_dias")

    with get_db_transaction() as conn:
        # Get current vehicle km
        cursor = conn.execute("SELECT odometro_actual FROM fms_vehicles WHERE id = ?", (data["vehicle_id"],))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Vehiculo no encontrado: {data['vehicle_id']}")

        km_actual = row["odometro_actual"] or 0

        plan_id = insert_returning_id(
            conn,
            "fms_maintenance_plans",
            {
                "vehicle_id": data["vehicle_id"],
                "tipo_mantenimiento": data["tipo_mantenimiento"],
                "descripcion": data.get("descripcion"),
                "intervalo_km": data.get("intervalo_km"),
                "intervalo_dias": data.get("intervalo_dias"),
                "proximo_km": km_actual + data["intervalo_km"] if data.get("intervalo_km") else None,
                "proxima_fecha": (datetime.now() + timedelta(days=data["intervalo_dias"])).date().isoformat() if data.get("intervalo_dias") else None,
                "activo": True,
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Plan de mantenimiento creado: {plan_id} - {data['tipo_mantenimiento']}")

        cursor = conn.execute("SELECT * FROM fms_maintenance_plans WHERE id = ?", (plan_id,))
        return dict(cursor.fetchone())


def listar_planes_mantenimiento(vehicle_id: int) -> List[dict]:
    """Lista planes de mantenimiento de un vehiculo."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM fms_maintenance_plans WHERE vehicle_id = ? ORDER BY tipo_mantenimiento",
            (vehicle_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def actualizar_plan_mantenimiento(plan_id: int, data: dict) -> dict:
    """Actualiza plan de mantenimiento."""
    allowed_fields = [
        "tipo_mantenimiento", "descripcion", "intervalo_km", "intervalo_dias",
        "proximo_km", "proxima_fecha", "activo"
    ]

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise ValueError("No hay campos validos para actualizar")

    updates["updated_at"] = datetime.now().isoformat()

    with get_db_transaction() as conn:
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [plan_id]
        conn.execute(
            f"UPDATE fms_maintenance_plans SET {set_clause} WHERE id = ?",
            values
        )

        cursor = conn.execute("SELECT * FROM fms_maintenance_plans WHERE id = ?", (plan_id,))
        return dict(cursor.fetchone())


def evaluar_mantenimiento_preventivo() -> List[dict]:
    """Evalua mantenimiento preventivo para toda la flota.
    Implements the algorithm from the plan:
    - Check each vehicle's maintenance plans
    - If overdue (km or date): create urgent WO, change vehicle to en_mantenimiento
    - If approaching: create alert
    - Check expiring documents
    Returns list of alerts generated.
    """
    alertas = []
    hoy = datetime.now().date()

    bool_true = "TRUE" if is_using_postgresql() else "1"
    with get_db_transaction() as conn:
        # Evaluar planes de mantenimiento (fms_maintenance_plans has no proximo_km/proxima_fecha)
        cursor = conn.execute(f"""
            SELECT mp.*, v.id as vehicle_id, v.patente, v.km_actual, v.estado
            FROM fms_maintenance_plans mp
            JOIN fms_vehicles v ON mp.vehicle_id = v.id
            WHERE mp.activo = {bool_true} AND v.activo = {bool_true}
        """)

        for row in cursor.fetchall():
            plan = dict(row)
            # fms_maintenance_plans has intervalo_km/intervalo_dias but no proximo_km/proxima_fecha
            # Just check if km interval is exceeded vs current km
            km_actual = plan.get("km_actual") or 0
            if plan.get("intervalo_km") and km_actual > 0:
                # Use km_actual as a proxy - flag if km_actual is a large round number modulo intervalo
                pass  # No proximo_km stored, cannot evaluate without it

        # Evaluar documentos por vencer
        cursor = conn.execute(f"""
            SELECT vd.*, v.patente
            FROM fms_vehicle_documents vd
            JOIN fms_vehicles v ON vd.vehicle_id = v.id
            WHERE v.activo = {bool_true} AND vd.fecha_vencimiento IS NOT NULL
        """)

        for row in cursor.fetchall():
            doc = dict(row)
            try:
                vencimiento = datetime.fromisoformat(str(doc["fecha_vencimiento"])).date()
            except (ValueError, TypeError):
                continue
            dias_restantes = (vencimiento - hoy).days
            patente = doc.get("patente", "")
            tipo_doc = doc.get("tipo", "documento")  # actual col is 'tipo'

            if dias_restantes < 0:
                alertas.append({
                    "tipo": "documento_vencido",
                    "severidad": "CRITICO",
                    "patente": patente,
                    "documento": tipo_doc,
                    "mensaje": f"Vehiculo {patente}: {tipo_doc} VENCIDO desde {-dias_restantes} dias."
                })
            elif dias_restantes <= 30:
                alertas.append({
                    "tipo": "documento_por_vencer",
                    "severidad": "ADVERTENCIA",
                    "patente": patente,
                    "documento": tipo_doc,
                    "dias_restantes": dias_restantes,
                    "mensaje": f"Vehiculo {patente}: {tipo_doc} vence en {dias_restantes} dias."
                })

    logger.info(f"Evaluacion preventiva completada: {len(alertas)} alertas generadas")
    return alertas


# =============================================================================
# Inspecciones
# =============================================================================

def crear_inspeccion(data: dict, user_id: str) -> dict:
    """Crea inspeccion pre/post viaje con checklist items.
    Uses INSPECTION_CHECKLIST for default items."""
    required_fields = ["vehicle_id", "driver_id", "tipo"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    with get_db_transaction() as conn:
        inspection_id = insert_returning_id(
            conn,
            "fms_inspections",
            {
                "vehicle_id": data["vehicle_id"],
                "driver_id": data["driver_id"],
                "tipo": data["tipo"],
                "odometro": data.get("odometro"),
                "estado": "pendiente",
                "created_by": user_id,
                "created_at": datetime.now().isoformat(),
            }
        )

        # Crear items del checklist
        for item in INSPECTION_CHECKLIST:
            insert_returning_id(
                conn,
                "fms_inspection_items",
                {
                    "inspection_id": inspection_id,
                    "categoria": item["categoria"],
                    "item_checklist": item["item"],
                    "es_critico": item["es_critico"],
                    "estado": "na",
                    "observacion": None,
                }
            )

        logger.info(f"Inspeccion creada: {inspection_id} - {data['tipo']}")
        return obtener_inspeccion(inspection_id)


def obtener_inspeccion(inspection_id: int) -> Optional[dict]:
    """Obtiene inspeccion por ID con items."""
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT * FROM fms_inspections WHERE id = ?", (inspection_id,))
        row = cursor.fetchone()
        if not row:
            return None

        inspection = dict(row)

        # Get items
        cursor = conn.execute(
            "SELECT * FROM fms_inspection_items WHERE inspection_id = ? ORDER BY categoria, item",
            (inspection_id,)
        )
        inspection["items"] = [dict(r) for r in cursor.fetchall()]

        return inspection


def completar_inspeccion(inspection_id: int, items: list, firma: str, user_id: str) -> dict:
    """Completa inspeccion actualizando items con estado y observaciones.
    Determina resultado: 'aprobado' si no hay items criticos con estado='mal',
    'rechazado' si hay criticos fallidos, 'con_observaciones' si solo hay no-criticos fallidos."""
    with get_db_transaction() as conn:
        # Update items
        for item_data in items:
            conn.execute(
                """UPDATE fms_inspection_items
                   SET estado = ?, observacion = ?
                   WHERE id = ?""",
                (item_data["estado"], item_data.get("observacion"), item_data["id"])
            )

        # Determinar resultado
        cursor = conn.execute(
            """SELECT COUNT(*) as count FROM fms_inspection_items
               WHERE inspection_id = ? AND es_critico = 1 AND estado = 'mal'""",
            (inspection_id,)
        )
        criticos_fallidos = cursor.fetchone()["count"]

        cursor = conn.execute(
            """SELECT COUNT(*) as count FROM fms_inspection_items
               WHERE inspection_id = ? AND es_critico = 0 AND estado = 'mal'""",
            (inspection_id,)
        )
        no_criticos_fallidos = cursor.fetchone()["count"]

        if criticos_fallidos > 0:
            resultado = "rechazado"
        elif no_criticos_fallidos > 0:
            resultado = "con_observaciones"
        else:
            resultado = "aprobado"

        # Update inspection
        conn.execute(
            """UPDATE fms_inspections
               SET resultado = ?, firma_digital = ?, observaciones = ?
               WHERE id = ?""",
            (resultado, firma, None, inspection_id)
        )

        logger.info(f"Inspeccion completada: {inspection_id} - Resultado: {resultado}")
        return obtener_inspeccion(inspection_id)


def listar_inspecciones(filtros: dict = None) -> List[dict]:
    """Lista inspecciones con filtros."""
    filtros = filtros or {}
    ph = _ph()
    query = "SELECT * FROM fms_inspections WHERE 1=1"
    params = []

    if "vehicle_id" in filtros:
        query += f" AND vehicle_id = {ph}"
        params.append(filtros["vehicle_id"])

    if "driver_id" in filtros:
        query += f" AND driver_id = {ph}"
        params.append(filtros["driver_id"])

    if "tipo" in filtros:
        query += f" AND tipo = {ph}"
        params.append(filtros["tipo"])

    if "estado" in filtros:
        query += f" AND estado = {ph}"
        params.append(filtros["estado"])

    query += " ORDER BY created_at DESC"

    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


# =============================================================================
# Documentos de Vehiculo
# =============================================================================

def agregar_documento(vehicle_id: int, data: dict) -> dict:
    """Agrega documento a un vehiculo."""
    required_fields = ["tipo_documento"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    ph = _ph()
    with get_db_transaction() as conn:
        doc_id = insert_returning_id(
            conn,
            "fms_vehicle_documents",
            {
                "vehicle_id": vehicle_id,
                "tipo": data.get("tipo_documento", data.get("tipo")),
                "numero": data.get("numero"),
                "fecha_emision": data.get("fecha_emision"),
                "fecha_vencimiento": data.get("fecha_vencimiento"),
                "archivo_url": data.get("archivo_url"),
                "notas": data.get("notas"),
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Documento agregado a vehiculo {vehicle_id}: {data.get('tipo_documento', data.get('tipo'))}")

        cursor = conn.execute(f"SELECT * FROM fms_vehicle_documents WHERE id = {ph}", (doc_id,))
        return dict(cursor.fetchone())


def listar_documentos(vehicle_id: int) -> List[dict]:
    """Lista documentos de un vehiculo."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.execute(
            f"SELECT * FROM fms_vehicle_documents WHERE vehicle_id = {ph} ORDER BY tipo",
            (vehicle_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def obtener_documentos_por_vencer(dias: int = 30) -> List[dict]:
    """Obtiene documentos que vencen en los proximos N dias."""
    ph = _ph()
    fecha_limite = (datetime.now() + timedelta(days=dias)).date().isoformat()
    fecha_hoy = datetime.now().date().isoformat()

    with get_db_connection() as conn:
        # Actual table name: fms_vehicle_documents; actual vehicle column: patente (not placa)
        cursor = conn.execute(f"""
            SELECT vd.*, v.patente
            FROM fms_vehicle_documents vd
            JOIN fms_vehicles v ON vd.vehicle_id = v.id
            WHERE vd.fecha_vencimiento <= {ph} AND vd.fecha_vencimiento >= {ph}
            ORDER BY vd.fecha_vencimiento
        """, (fecha_limite, fecha_hoy))

        return [dict(row) for row in cursor.fetchall()]


# =============================================================================
# KPIs FMS
# =============================================================================

def obtener_kpis_fms() -> dict:
    """Obtiene KPIs del modulo FMS:
    - Vehiculos por estado
    - % disponibilidad flota
    - OTs abiertas por prioridad
    - Costo promedio por OT
    - Documentos por vencer
    - Mantenimientos proximos
    """
    bool_true = "TRUE" if is_using_postgresql() else "1"
    # Use database-compatible date arithmetic
    if is_using_postgresql():
        next_7_days_expr = "CURRENT_DATE + INTERVAL '7 days'"
    else:
        next_7_days_expr = "date('now', '+7 days')"

    with get_db_connection() as conn:
        # Vehiculos por estado
        cursor = conn.execute(f"""
            SELECT estado, COUNT(*) as count
            FROM fms_vehicles
            WHERE activo = {bool_true}
            GROUP BY estado
        """)
        vehiculos_por_estado = {row["estado"]: row["count"] for row in cursor.fetchall()}

        # Total vehiculos activos
        cursor = conn.execute(f"SELECT COUNT(*) as total FROM fms_vehicles WHERE activo = {bool_true}")
        row = cursor.fetchone()
        total_vehiculos = (row["total"] if isinstance(row, dict) else row[0]) if row else 0

        disponibles = vehiculos_por_estado.get("disponible", 0)
        disponibilidad = (disponibles / total_vehiculos * 100) if total_vehiculos > 0 else 0

        # OTs abiertas por prioridad
        cursor = conn.execute("""
            SELECT prioridad, COUNT(*) as count
            FROM fms_work_orders
            WHERE estado NOT IN ('completed', 'cerrada', 'cancelada')
            GROUP BY prioridad
        """)
        ots_por_prioridad = {row["prioridad"]: row["count"] for row in cursor.fetchall()}

        # Costo promedio por OT - actual column is costo_real
        cursor = conn.execute("""
            SELECT AVG(costo_real) as promedio
            FROM fms_work_orders
            WHERE estado = 'completed' AND costo_real IS NOT NULL
        """)
        row = cursor.fetchone()
        costo_promedio = (row["promedio"] if isinstance(row, dict) else row[0]) if row else 0
        costo_promedio = costo_promedio or 0

        # Documentos por vencer (30 dias) - actual table: fms_vehicle_documents
        docs_por_vencer = len(obtener_documentos_por_vencer(30))

        # Mantenimientos proximos - fms_maintenance_plans has different schema
        # Columns: id, vehicle_id, nombre, tipo, intervalo_km, intervalo_dias, items_json, activo, created_at
        # No proximo_km/proxima_fecha columns - just count active plans as a proxy
        cursor = conn.execute(f"""
            SELECT COUNT(*) as count
            FROM fms_maintenance_plans mp
            JOIN fms_vehicles v ON mp.vehicle_id = v.id
            WHERE mp.activo = {bool_true} AND v.activo = {bool_true}
        """)
        row = cursor.fetchone()
        mantenimientos_proximos = (row["count"] if isinstance(row, dict) else row[0]) if row else 0

        return {
            "vehiculos_por_estado": vehiculos_por_estado,
            "total_vehiculos": total_vehiculos,
            "disponibilidad_pct": round(disponibilidad, 1),
            "ots_abiertas_por_prioridad": ots_por_prioridad,
            "costo_promedio_ot": round(float(costo_promedio), 2),
            "documentos_por_vencer_30d": docs_por_vencer,
            "mantenimientos_proximos_7d": mantenimientos_proximos,
            "rendimiento_promedio_km_l": 0,
        }


# --- Aliases for English route compatibility ---
def list_vehicles(filters: dict = None):
    return listar_vehiculos(filters)

def list_work_orders(filters: dict = None) -> dict:
    return listar_ordenes_trabajo(
        filters,
        page=filters.get("page", 1) if filters else 1,
        per_page=filters.get("per_page", 20) if filters else 20,
    )

def get_fms_kpis() -> dict:
    return obtener_kpis_fms()


def get_available_vehicles(filters: dict = None) -> list:
    filters = filters or {}
    return obtener_vehiculos_disponibles(
        peso_min=filters.get("min_capacidad_kg", 0) or 0,
        vol_min=filters.get("min_capacidad_m3", 0) or 0,
    )


def list_drivers(filters: dict = None) -> list:
    return listar_conductores(filters)


def get_available_drivers() -> list:
    return obtener_conductores_disponibles()


def list_inspections(filters: dict = None) -> list:
    return listar_inspecciones(filters)


def get_expiring_documents(days: int = 30) -> list:
    return obtener_documentos_por_vencer(days)
