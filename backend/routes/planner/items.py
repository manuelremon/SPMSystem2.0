"""
Planner - Items de Solicitudes

Endpoints para gestion de items dentro de solicitudes:
- Guardar tratamiento de items
- Obtener tratamiento previo (rehidratar)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.errors import error_validation
from backend.core.fsm import (
    EstadoSolicitud,
    TransicionInvalidaError,
    cambiar_estado,
    normalizar_estado,
)
from backend.core.roles import require_auth
from backend.routes.planner_helpers import _require_solicitud_access
from backend.routes.planner.helpers import _log_evento

logger = logging.getLogger(__name__)

items_bp = Blueprint("items", __name__)


@items_bp.route("/solicitudes/<int:solicitud_id>/items", methods=["PATCH"])
@require_auth
def tratar_items(solicitud_id):
    """
    Guarda tratamiento de items: espera un array items con item_index, decision, cantidad_aprobada, comentario, etc.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    actor = str(
        user.get("id_spm")
        or user.get("usuario")
        or user.get("id")
        or data.get("actor_id")
        or "planner"
    )

    # Validacion basica de items de tratamiento (Sprint 3.4)
    if not items:
        return error_validation("Se requiere al menos un item para tratar")

    errores = []
    for idx, it in enumerate(items):
        if it.get("item_index") is None:
            errores.append(f"Item {idx}: item_index es requerido")
            continue

        # Validar cantidad_aprobada
        cant = it.get("cantidad_aprobada")
        if cant is not None:
            try:
                cant = float(cant)
                if cant < 0:
                    errores.append(f"Item {idx}: cantidad_aprobada no puede ser negativa")
            except (TypeError, ValueError):
                errores.append(f"Item {idx}: cantidad_aprobada debe ser un numero")

        # Validar precio_unitario_estimado
        precio = it.get("precio_unitario_estimado")
        if precio is not None:
            try:
                precio = float(precio)
                if precio < 0:
                    errores.append(f"Item {idx}: precio_unitario_estimado no puede ser negativo")
            except (TypeError, ValueError):
                errores.append(f"Item {idx}: precio_unitario_estimado debe ser un numero")

    if errores:
        return error_validation("; ".join(errores))

    with get_db_transaction() as conn:
        cur = conn.cursor()
        for it in items:
            idx = it.get("item_index")
            if idx is None:
                continue
            cur.execute(
                """
                INSERT INTO solicitud_items_tratamiento (solicitud_id, item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido, precio_unitario_estimado, comentario, updated_by)
                VALUES (?,?,?,?,?,?,?,?,?)
                ON CONFLICT(solicitud_id, item_index) DO UPDATE SET
                    decision=excluded.decision,
                    cantidad_aprobada=excluded.cantidad_aprobada,
                    codigo_equivalente=excluded.codigo_equivalente,
                    proveedor_sugerido=excluded.proveedor_sugerido,
                    precio_unitario_estimado=excluded.precio_unitario_estimado,
                    comentario=excluded.comentario,
                    updated_by=excluded.updated_by,
                    updated_at=CURRENT_TIMESTAMP
                """,
                (
                    solicitud_id,
                    idx,
                    it.get("decision") or "",
                    it.get("cantidad_aprobada") or 0,
                    it.get("codigo_equivalente") or "",
                    it.get("proveedor_sugerido") or "",
                    it.get("precio_unitario_estimado") or 0,
                    it.get("comentario") or "",
                    actor,
                ),
            )
            _log_evento(
                solicitud_id, idx, "item_tratado", it.get("decision") or "", it, actor=actor
            )

    # Usar FSM para asegurar estado correcto (si no esta ya en tratamiento)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status FROM solicitudes WHERE id=?", (solicitud_id,))
            row = cur.fetchone()
            if row:
                estado_actual = normalizar_estado(row["status"])
                if estado_actual != "in_treatment":
                    cambiar_estado(
                        solicitud_id=solicitud_id,
                        nuevo_estado=EstadoSolicitud.IN_TREATMENT,
                        actor_id=actor,
                        razon="Items tratados",
                        metadata={"items_count": len(items)},
                    )
    except TransicionInvalidaError:
        pass

    return jsonify({"ok": True}), 200


@items_bp.route("/solicitudes/<int:solicitud_id>/tratamiento", methods=["GET"])
@require_auth
def obtener_tratamiento(solicitud_id):
    """Rehidrata decisiones previas para mostrarlas al planificador."""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido,
                      precio_unitario_estimado, comentario, updated_by, updated_at
               FROM solicitud_items_tratamiento WHERE solicitud_id=?""",
            (solicitud_id,),
        )
        rows = cur.fetchall()

    data = [dict(r) for r in rows]
    return jsonify({"ok": True, "data": data}), 200
