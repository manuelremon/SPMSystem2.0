"""
Planner Service - Paso 3: Guardar tratamiento y decisiones multi-fuente

Funciones para persistir decisiones de tratamiento:
- Guardar tratamiento completo
- Decisiones multi-fuente
- Resumen de decisiones
"""

import logging
from typing import Any, Dict, List, Optional

from backend.core.repository import (
    DecisionAbastecimientoRepository,
    PresupuestoRepository,
    SolicitudRepository,
    TratamientoRepository,
)

logger = logging.getLogger(__name__)


def paso_3_guardar_tratamiento(
    solicitud_id: int, decisiones: List[Dict[str, Any]], usuario_id: str
) -> Dict[str, Any]:
    """
    PASO 3: Guardar decisiones de tratamiento

    NOTA: El presupuesto se consume en el momento de APROBACION de la solicitud.
    Este paso NO consume presupuesto adicional - solo registra las decisiones.
    """
    if not decisiones:
        raise ValueError("Se requieren decisiones para guardar")

    solicitud = SolicitudRepository.get_by_id(solicitud_id)
    if not solicitud:
        raise ValueError(f"Solicitud {solicitud_id} no encontrada")

    guardadas = 0
    errores: List[Dict[str, Any]] = []

    for decision in decisiones:
        item_idx = decision.get("item_idx")
        if item_idx is None:
            continue

        try:
            TratamientoRepository.save_decision(
                solicitud_id=solicitud_id,
                item_idx=item_idx,
                decision_tipo=str(decision.get("decision_tipo", "stock")).lower(),
                cantidad_aprobada=decision.get("cantidad_aprobada", 0),
                codigo_material=decision.get("codigo_material"),
                proveedor_id=decision.get("id_proveedor"),
                precio_unitario=decision.get("precio_unitario_final"),
                observaciones=decision.get("observaciones", ""),
                updated_by=usuario_id,
            )
            guardadas += 1
        except Exception as e:
            errores.append({"item_idx": item_idx, "error": str(e)})

    # Mantener en in_treatment (la transición a treated/completed la hace /finalizar)
    hay_errores = len(errores) > 0
    nuevo_estado = "in_treatment"
    SolicitudRepository.update_status(solicitud_id, nuevo_estado)

    TratamientoRepository.log_evento(
        solicitud_id,
        None,
        "tratamiento_completado" if not hay_errores else "tratamiento_parcial",
        "PASO_3",
        {
            "total_decisiones": len(decisiones),
            "decisiones_guardadas": guardadas,
            "errores_count": len(errores),
            "nuevo_estado": nuevo_estado,
            "usuario": usuario_id,
        },
        actor_id=usuario_id,
    )

    return {
        "ok": not hay_errores,
        "solicitud_id": solicitud_id,
        "paso": 3,
        "nombre_paso": "Confirmacion y Cierre",
        "total_items": len(decisiones),
        "items_guardados": guardadas,
        "errores": errores,
        "nuevo_estado": nuevo_estado,
        "mensaje": (
            f"Tratamiento completado: {guardadas}/{len(decisiones)} items guardados"
            if guardadas > 0 and not hay_errores
            else f"Tratamiento parcial: {guardadas}/{len(decisiones)} items guardados, {len(errores)} errores"
            if hay_errores and guardadas > 0
            else "No se guardaron decisiones"
        ),
    }


def guardar_decision_multifuente(
    solicitud_id: int,
    item_idx: int,
    cantidad_solicitada: float,
    fuentes: List[Dict[str, Any]],
    planner_id: str,
    comentario: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Guarda una decision de abastecimiento con multiples fuentes.

    Args:
        solicitud_id: ID de la solicitud
        item_idx: Indice del item
        cantidad_solicitada: Cantidad total solicitada
        fuentes: Lista de fuentes seleccionadas con cantidades
        planner_id: ID del planificador
        comentario: Comentario opcional

    Returns:
        Diccionario con la decision guardada y sus fuentes

    Raises:
        ValueError: Si el presupuesto es insuficiente o hay demasiadas fuentes
    """
    # Validar limite de fuentes
    MAX_FUENTES_POR_ITEM = 4
    if len(fuentes) > MAX_FUENTES_POR_ITEM:
        raise ValueError(f"Maximo {MAX_FUENTES_POR_ITEM} fuentes permitidas por item")

    # Validar presupuesto antes de guardar
    total_costo_fuentes_externas = sum(
        float(f.get("cantidad_asignada", 0)) * float(f.get("precio_unitario", 0))
        for f in fuentes
        if f.get("tipo_fuente", f.get("tipo")) not in ("stock", "transferencia", "equivalencia")
    )

    if total_costo_fuentes_externas > 0:
        solicitud = SolicitudRepository.get_by_id(solicitud_id)
        if solicitud:
            centro = solicitud.get("centro", "")
            sector = solicitud.get("sector", "")

            presupuesto_info = PresupuestoRepository.get_disponible(centro, sector)
            if presupuesto_info:
                saldo_disponible = float(presupuesto_info.get("saldo", presupuesto_info.get("saldo_disponible", 0)))
                if total_costo_fuentes_externas > saldo_disponible:
                    raise ValueError(
                        f"Presupuesto insuficiente. Requerido: ${total_costo_fuentes_externas:.2f}, "
                        f"Disponible: ${saldo_disponible:.2f}"
                    )
            else:
                logger.warning(
                    f"[PLANNER] No se encontro presupuesto para {centro}/{sector}, "
                    f"continuando sin validacion"
                )

    # Crear o actualizar la cabecera de decision
    decision_id = DecisionAbastecimientoRepository.crear_o_actualizar_decision(
        solicitud_id=solicitud_id,
        item_index=item_idx,
        cantidad_solicitada=cantidad_solicitada,
        planner_id=planner_id,
        comentario=comentario,
    )

    # Limpiar fuentes anteriores
    DecisionAbastecimientoRepository.limpiar_fuentes(decision_id)

    # Agregar nuevas fuentes
    fuentes_guardadas = []
    for idx, fuente in enumerate(fuentes):
        try:
            fuente_id = DecisionAbastecimientoRepository.agregar_fuente(
                decision_id=decision_id,
                tipo_fuente=fuente.get("tipo", "stock"),
                cantidad_asignada=float(fuente.get("cantidad_asignada", 0)),
                centro_origen=fuente.get("centro_origen"),
                almacen_origen=fuente.get("almacen_origen"),
                cuit_proveedor=fuente.get("cuit_proveedor"),
                proveedor_nombre=fuente.get("proveedor_nombre"),
                codigo_material_equiv=fuente.get("codigo_material_equiv"),
                tipo_equivalencia=fuente.get("tipo_equivalencia"),
                precio_unitario=fuente.get("precio_unitario"),
                precio_es_negociado=fuente.get("precio_es_negociado", False),
                plazo_dias=fuente.get("plazo_dias"),
                score_opcion=fuente.get("score_opcion"),
                orden_prioridad=idx + 1,
                notas=fuente.get("notas"),
            )
            fuentes_guardadas.append(
                {
                    "id": fuente_id,
                    "tipo": fuente.get("tipo"),
                    "cantidad": fuente.get("cantidad_asignada"),
                }
            )
        except Exception as e:
            logger.error(f"Error guardando fuente {idx}: {e}")

    # Obtener decision actualizada
    decision = DecisionAbastecimientoRepository.get_decision(solicitud_id, item_idx)

    # Log del evento
    TratamientoRepository.log_evento(
        solicitud_id,
        item_idx,
        "decision_multifuente_guardada",
        "PASO_2",
        {
            "decision_id": decision_id,
            "fuentes_guardadas": len(fuentes_guardadas),
            "cantidad_total_asignada": decision.get("cantidad_total_asignada") if decision else 0,
            "estado": decision.get("estado") if decision else "pendiente",
        },
        actor_id=planner_id,
    )

    return {
        "decision_id": decision_id,
        "solicitud_id": solicitud_id,
        "item_idx": item_idx,
        "fuentes_guardadas": len(fuentes_guardadas),
        "decision": decision,
    }


def obtener_resumen_decisiones(solicitud_id: int) -> Dict[str, Any]:
    """Obtiene resumen de todas las decisiones de una solicitud."""
    decisiones = DecisionAbastecimientoRepository.get_decisiones_solicitud(solicitud_id)

    total_items = len(decisiones)
    items_completos = sum(1 for d in decisiones if d.get("estado") == "completo")
    items_confirmados = sum(1 for d in decisiones if d.get("estado") == "confirmado")
    items_parciales = sum(1 for d in decisiones if d.get("estado") == "parcial")
    items_pendientes = sum(1 for d in decisiones if d.get("estado") == "pendiente")

    return {
        "solicitud_id": solicitud_id,
        "total_items": total_items,
        "items_completos": items_completos,
        "items_confirmados": items_confirmados,
        "items_parciales": items_parciales,
        "items_pendientes": items_pendientes,
        "porcentaje_completado": (
            (items_completos + items_confirmados) / total_items * 100 if total_items > 0 else 0
        ),
        "listo_para_confirmar": items_pendientes == 0 and items_parciales == 0,
        "decisiones": decisiones,
    }
