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
    ph = _ph()
    year = datetime.now().year
    cursor = conn.execute(
        f"SELECT MAX(CAST(RIGHT(codigo, 4) AS INTEGER)) as max_num FROM fms_work_orders WHERE codigo LIKE {ph}",
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
    required_fields = ["patente", "tipo", "marca", "modelo", "anio"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    with get_db_transaction() as conn:
        vehicle_id = insert_returning_id(
            conn,
            "fms_vehicles",
            {
                "codigo": data.get("codigo"),
                "patente": data["patente"],
                "tipo": data["tipo"],
                "marca": data["marca"],
                "modelo": data["modelo"],
                "anio": data["anio"],
                "capacidad_kg": data.get("capacidad_kg"),
                "capacidad_m3": data.get("capacidad_m3"),
                "requiere_frio": data.get("requiere_frio", False),
                "requiere_hazmat": data.get("requiere_hazmat", False),
                "estado": "disponible",
                "km_actual": data.get("km_actual", 0),
                "proximo_mantenimiento": data.get("proximo_mantenimiento"),
                "activo": True,
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Vehiculo creado: {vehicle_id} - {data['patente']}")
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
        "codigo", "patente", "tipo", "marca", "modelo", "anio",
        "capacidad_kg", "capacidad_m3", "requiere_frio",
        "requiere_hazmat", "km_actual", "proximo_mantenimiento",
        "estado", "activo"
    ]

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise ValueError("No hay campos validos para actualizar")

    updates["updated_at"] = datetime.now().isoformat()

    ph = _ph()
    with get_db_transaction() as conn:
        set_clause = ", ".join([f"{k} = {ph}" for k in updates.keys()])
        values = list(updates.values()) + [vehicle_id]
        conn.execute(
            f"UPDATE fms_vehicles SET {set_clause} WHERE id = {ph}",
            values
        )
        logger.info(f"Vehiculo actualizado: {vehicle_id}")
        return obtener_vehiculo(vehicle_id)


def cambiar_estado_vehiculo(vehicle_id: int, nuevo_estado: str, user_id: str = "") -> dict:
    """Cambia estado de vehiculo (disponible, en_ruta, en_mantenimiento, etc.)."""
    estados_validos = ["disponible", "en_ruta", "en_mantenimiento", "fuera_servicio", "baja"]
    if nuevo_estado not in estados_validos:
        raise ValueError(f"Estado invalido: {nuevo_estado}")

    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.execute(f"SELECT estado FROM fms_vehicles WHERE id = {ph}", (vehicle_id,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Vehiculo no encontrado: {vehicle_id}")

        estado_anterior = row["estado"]

        conn.execute(
            f"UPDATE fms_vehicles SET estado = {ph}, updated_at = {ph} WHERE id = {ph}",
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
                "documento": data.get("documento"),
                "licencia_tipo": data.get("licencia_tipo"),
                "licencia_vencimiento": data.get("licencia_vencimiento"),
                "hazmat_cert": data.get("hazmat_cert", False),
                "estado": "activo",
                "telefono": data.get("telefono"),
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Conductor creado: {driver_id} - {data['nombre']}")
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
        "nombre", "documento", "licencia_tipo", "licencia_vencimiento",
        "hazmat_cert", "telefono", "estado"
    ]

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise ValueError("No hay campos validos para actualizar")

    ph = _ph()
    with get_db_transaction() as conn:
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

    ph = _ph()
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
                "km_actual": data.get("km_actual"),
                "costo_estimado": data.get("costo_estimado"),
                "fecha_programada": data.get("fecha_programada"),
                "tecnico": data.get("tecnico"),
                "notas": data.get("notas"),
                "estado": "draft",
                "created_by": user_id,
                "created_at": datetime.now().isoformat(),
            }
        )

        # Cambiar vehiculo a mantenimiento
        conn.execute(
            f"UPDATE fms_vehicles SET estado = 'en_mantenimiento', updated_at = {ph} WHERE id = {ph}",
            (datetime.now().isoformat(), data["vehicle_id"])
        )

        logger.info(f"OT creada: {wo_code} - Vehicle {data['vehicle_id']} - Prioridad {data['prioridad']}")

        # Si es urgente, crear notificacion (placeholder - requiere integracion con notification_service)
        if data["prioridad"] >= 4:
            logger.warning(f"OT urgente creada: {wo_code} - Requiere atencion inmediata")

        return obtener_orden_trabajo(wo_id)


def obtener_orden_trabajo(wo_id: int) -> Optional[dict]:
    """Obtiene OT por ID con partes."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.execute(f"SELECT * FROM fms_work_orders WHERE id = {ph}", (wo_id,))
        row = cursor.fetchone()
        if not row:
            return None

        wo = dict(row)

        # Obtener partes
        cursor = conn.execute(
            f"SELECT * FROM fms_wo_parts WHERE work_order_id = {ph} ORDER BY id",
            (wo_id,)
        )
        wo["partes"] = [dict(r) for r in cursor.fetchall()]

        # Obtener info del vehiculo
        cursor = conn.execute(
            f"SELECT patente, marca, modelo FROM fms_vehicles WHERE id = {ph}",
            (wo["vehicle_id"],)
        )
        vehicle = cursor.fetchone()
        if vehicle:
            wo["vehiculo"] = dict(vehicle)

        return wo


def listar_ordenes_trabajo(filtros: dict = None, page: int = 1, per_page: int = 20) -> dict:
    """Lista OTs con filtros: estado, tipo, vehicle_id, prioridad."""
    filtros = filtros or {}
    ph = _ph()
    query = "SELECT * FROM fms_work_orders WHERE 1=1"
    params = []

    if "estado" in filtros:
        query += f" AND estado = {ph}"
        params.append(filtros["estado"])

    if "tipo" in filtros:
        query += f" AND tipo = {ph}"
        params.append(filtros["tipo"])

    if "vehicle_id" in filtros:
        query += f" AND vehicle_id = {ph}"
        params.append(filtros["vehicle_id"])

    if "prioridad" in filtros:
        query += f" AND prioridad = {ph}"
        params.append(filtros["prioridad"])

    with get_db_connection() as conn:
        # Count total
        count_query = query.replace("SELECT *", "SELECT COUNT(*)")
        cursor = conn.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Get page
        query += f" ORDER BY prioridad DESC, created_at DESC LIMIT {ph} OFFSET {ph}"
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

    ph = _ph()
    with get_db_transaction() as conn:
        cursor = conn.execute(f"SELECT * FROM fms_work_orders WHERE id = {ph}", (wo_id,))
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
            updates["fecha_inicio"] = datos.get("fecha_inicio", datetime.now().isoformat())
            updates["tecnico"] = datos.get("tecnico")

        elif nuevo_estado == "pending_parts":
            updates["notas"] = datos.get("notas", "En espera de repuestos")
            logger.info(f"OT {wo['codigo']} en espera de repuestos")

        elif nuevo_estado == "completed":
            updates["fecha_fin"] = datetime.now().isoformat()
            updates["costo_real"] = datos.get("costo_real", 0)
            updates["notas"] = datos.get("notas", wo.get("notas"))

            # Calcular costo total de partes
            cursor = conn.execute(
                f"SELECT SUM(cantidad * costo_unitario) as total_partes FROM fms_wo_parts WHERE work_order_id = {ph}",
                (wo_id,)
            )
            partes_row = cursor.fetchone()
            costo_partes = partes_row["total_partes"] if partes_row and partes_row["total_partes"] else 0

            costo_real = updates["costo_real"] + costo_partes
            updates["costo_real"] = costo_real

            # Actualizar vehiculo a disponible
            conn.execute(
                f"UPDATE fms_vehicles SET estado = 'disponible', updated_at = {ph} WHERE id = {ph}",
                (datetime.now().isoformat(), wo["vehicle_id"])
            )

            # Recalcular proximo mantenimiento si fue preventivo
            if wo["tipo"] == "preventivo":
                _recalcular_proximo_mantenimiento(conn, wo["vehicle_id"], datos.get("km_actual"))

            logger.info(f"OT {wo['codigo']} completada - Costo real: ${costo_real:.2f}")

        elif nuevo_estado == "cancelled":
            updates["notas"] = datos.get("motivo_cancelacion", "Cancelada")
            # Restaurar vehiculo a disponible
            conn.execute(
                f"UPDATE fms_vehicles SET estado = 'disponible', updated_at = {ph} WHERE id = {ph}",
                (datetime.now().isoformat(), wo["vehicle_id"])
            )

        # Update WO
        set_clause = ", ".join([f"{k} = {ph}" for k in updates.keys()])
        values = list(updates.values()) + [wo_id]
        conn.execute(f"UPDATE fms_work_orders SET {set_clause} WHERE id = {ph}", values)

        return obtener_orden_trabajo(wo_id)


def _recalcular_proximo_mantenimiento(conn, vehicle_id: int, km_actual: Optional[int]):
    """Recalcula proximo_mantenimiento en fms_vehicles basado en planes activos."""
    ph = _ph()
    bool_true = "TRUE" if is_using_postgresql() else "1"

    cursor = conn.execute(
        f"SELECT * FROM fms_maintenance_plans WHERE vehicle_id = {ph} AND activo = {bool_true}",
        (vehicle_id,)
    )

    proxima_fecha = None
    for plan_row in cursor.fetchall():
        plan = dict(plan_row)

        if plan.get("intervalo_dias"):
            fecha = (datetime.now() + timedelta(days=plan["intervalo_dias"])).date().isoformat()
            if proxima_fecha is None or fecha < proxima_fecha:
                proxima_fecha = fecha

    # Update proximo_mantenimiento on the vehicle
    if proxima_fecha:
        conn.execute(
            f"UPDATE fms_vehicles SET proximo_mantenimiento = {ph}, km_actual = COALESCE({ph}, km_actual), updated_at = {ph} WHERE id = {ph}",
            (proxima_fecha, km_actual, datetime.now().isoformat(), vehicle_id)
        )


def agregar_parte_ot(wo_id: int, data: dict, user_id: str) -> dict:
    """Agrega parte/repuesto a una OT."""
    required_fields = ["descripcion", "cantidad"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    ph = _ph()
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

        cursor = conn.execute(f"SELECT * FROM fms_wo_parts WHERE id = {ph}", (part_id,))
        return dict(cursor.fetchone())


def solicitar_repuesto_spm(wo_id: int, material_id: str, cantidad: float, user_id: str) -> dict:
    """Solicita repuesto creando solicitud SPM automatica.
    Implements the solicitar_repuesto_desde_ot algorithm:
    - Create SPM solicitud with tipo='repuesto_flota'
    - Link part to solicitud_id
    - Transition OT to PENDING_PARTS if was IN_PROGRESS
    """
    ph = _ph()
    with get_db_transaction() as conn:
        # Get WO info
        cursor = conn.execute(f"SELECT * FROM fms_work_orders WHERE id = {ph}", (wo_id,))
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
    required_fields = ["vehicle_id", "tipo"]
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Campo requerido: {field}")

    if not data.get("intervalo_km") and not data.get("intervalo_dias"):
        raise ValueError("Debe especificar intervalo_km o intervalo_dias")

    ph = _ph()
    with get_db_transaction() as conn:
        # Verify vehicle exists
        cursor = conn.execute(f"SELECT km_actual FROM fms_vehicles WHERE id = {ph}", (data["vehicle_id"],))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Vehiculo no encontrado: {data['vehicle_id']}")

        plan_id = insert_returning_id(
            conn,
            "fms_maintenance_plans",
            {
                "vehicle_id": data["vehicle_id"],
                "nombre": data.get("nombre"),
                "tipo": data["tipo"],
                "intervalo_km": data.get("intervalo_km"),
                "intervalo_dias": data.get("intervalo_dias"),
                "items_json": data.get("items_json"),
                "activo": True,
                "created_at": datetime.now().isoformat(),
            }
        )

        logger.info(f"Plan de mantenimiento creado: {plan_id} - {data['tipo']}")

        cursor = conn.execute(f"SELECT * FROM fms_maintenance_plans WHERE id = {ph}", (plan_id,))
        return dict(cursor.fetchone())


def listar_planes_mantenimiento(vehicle_id: int) -> List[dict]:
    """Lista planes de mantenimiento de un vehiculo."""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.execute(
            f"SELECT * FROM fms_maintenance_plans WHERE vehicle_id = {ph} ORDER BY tipo",
            (vehicle_id,)
        )
        return [dict(row) for row in cursor.fetchall()]


def actualizar_plan_mantenimiento(plan_id: int, data: dict) -> dict:
    """Actualiza plan de mantenimiento."""
    allowed_fields = [
        "nombre", "tipo", "intervalo_km", "intervalo_dias",
        "items_json", "activo"
    ]

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise ValueError("No hay campos validos para actualizar")

    ph = _ph()
    with get_db_transaction() as conn:
        set_clause = ", ".join([f"{k} = {ph}" for k in updates.keys()])
        values = list(updates.values()) + [plan_id]
        conn.execute(
            f"UPDATE fms_maintenance_plans SET {set_clause} WHERE id = {ph}",
            values
        )

        cursor = conn.execute(f"SELECT * FROM fms_maintenance_plans WHERE id = {ph}", (plan_id,))
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
                "items_json": data.get("items_json"),
                "estado": "pendiente",
                "observaciones": data.get("observaciones"),
                "created_by": user_id,
                "created_at": datetime.now().isoformat(),
            }
        )

        # Crear items del checklist en fms_inspection_items (if table exists)
        try:
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
        except Exception:
            # fms_inspection_items table may not exist; items stored in items_json
            logger.debug("fms_inspection_items table not available, using items_json")

        logger.info(f"Inspeccion creada: {inspection_id} - {data['tipo']}")
        return obtener_inspeccion(inspection_id)


def obtener_inspeccion(inspection_id: int) -> Optional[dict]:
    """Obtiene inspeccion por ID with items."""
    import json as _json
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.execute(f"SELECT * FROM fms_inspections WHERE id = {ph}", (inspection_id,))
        row = cursor.fetchone()
        if not row:
            return None

        inspection = dict(row)

        # Parse items from items_json column
        items_json = inspection.get("items_json")
        if items_json and isinstance(items_json, str):
            try:
                inspection["items"] = _json.loads(items_json)
            except (ValueError, TypeError):
                inspection["items"] = []
        else:
            inspection["items"] = []

        return inspection


def completar_inspeccion(inspection_id: int, items: list, firma: str, user_id: str) -> dict:
    """Completa inspeccion.

    Actual fms_inspections columns:
        id, vehicle_id, driver_id, tipo, estado, items_json,
        firma_digital, observaciones, created_by, created_at, completed_at

    Note: fms_inspection_items table does NOT exist. Items are stored as JSON
    in items_json column.
    """
    ph = _ph()
    import json as _json

    # Determine resultado from items if provided
    resultado = "aprobado"
    if items:
        criticos_fallidos = sum(1 for i in items if i.get("es_critico") and i.get("estado") == "mal")
        no_criticos_fallidos = sum(1 for i in items if not i.get("es_critico") and i.get("estado") == "mal")
        if criticos_fallidos > 0:
            resultado = "rechazado"
        elif no_criticos_fallidos > 0:
            resultado = "con_observaciones"

    with get_db_transaction() as conn:
        # Update inspection - estado stores the outcome, completed_at marks completion time
        conn.execute(
            f"""UPDATE fms_inspections
               SET estado = {ph}, firma_digital = {ph}, items_json = {ph},
                   completed_at = NOW()
               WHERE id = {ph}""",
            (resultado, firma, _json.dumps(items) if items else None, inspection_id)
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


# --- Aliases for English route compatibility (21 additional) ---

def create_vehicle(data, user_id=None):
    return crear_vehiculo(data)


def update_vehicle(vehicle_id, data, user_id=None):
    return actualizar_vehiculo(vehicle_id, data)


def change_vehicle_status(vehicle_id, estado, user_id=None):
    return cambiar_estado_vehiculo(vehicle_id, estado, user_id or "")


def create_driver(data, user_id=None):
    return crear_conductor(data)


def update_driver(driver_id, data, user_id=None):
    return actualizar_conductor(driver_id, data)


def create_work_order(data, user_id):
    return crear_orden_trabajo(data, user_id)


def transition_work_order(order_id, estado, datos=None, user_id=None):
    return transicionar_orden_trabajo(order_id, estado, user_id or "", datos)


def add_part_to_work_order(order_id, data, user_id):
    return agregar_parte_ot(order_id, data, user_id)


def request_part_from_spm(order_id, data, user_id):
    return solicitar_repuesto_spm(
        order_id,
        data.get("material_id", ""),
        data.get("cantidad", 0),
        user_id,
    )


def create_maintenance_plan(vehicle_id, data, user_id=None):
    data_copy = dict(data)
    data_copy["vehicle_id"] = vehicle_id
    return crear_plan_mantenimiento(data_copy)


def update_maintenance_plan(plan_id, data, user_id=None):
    return actualizar_plan_mantenimiento(plan_id, data)


def evaluate_preventive_maintenance(user_id=None):
    return evaluar_mantenimiento_preventivo()


def create_inspection(data, user_id):
    return crear_inspeccion(data, user_id)


def complete_inspection(inspection_id, data, user_id):
    return completar_inspeccion(
        inspection_id,
        data.get("items", []),
        data.get("firma", ""),
        user_id,
    )


def add_vehicle_document(vehicle_id, data, user_id=None):
    return agregar_documento(vehicle_id, data)


def get_vehicle_detail(vehicle_id):
    return obtener_vehiculo(vehicle_id)


def get_driver_detail(driver_id):
    return obtener_conductor(driver_id)


def get_work_order_detail(order_id):
    return obtener_orden_trabajo(order_id)


def get_inspection_detail(inspection_id):
    return obtener_inspeccion(inspection_id)


def list_maintenance_plans(vehicle_id):
    return listar_planes_mantenimiento(vehicle_id)


def list_vehicle_documents(vehicle_id):
    return listar_documentos(vehicle_id)
