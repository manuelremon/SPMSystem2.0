"""
Planner Service - Paso 2: Opciones de abastecimiento

Genera opciones de abastecimiento para un item:
- Stock local
- Transferencias entre centros
- Proveedores externos
- Materiales equivalentes
"""

import logging
from typing import Any, Dict

from backend.core.cache_loader import get_consumo_cache, get_equivalencias_cache
from backend.core.repository import (
    DecisionAbastecimientoRepository,
    EquivalenciasRepository,
    MaterialRepository,
    MrpRepository,
    ProveedorExternoRepository,
    ProveedorInternoRepository,
    ProveedorPreciosRepository,
    ProveedorRepository,
    SolicitudRepository,
    TratamientoRepository,
)
from backend.services.planner.helpers import (
    _build_proveedor_option,
    _calcular_score_opcion_v2,
    norm_codigo,
)

logger = logging.getLogger(__name__)


def paso_2_opciones_abastecimiento(solicitud_id: int, item_idx: int) -> Dict[str, Any]:
    """
    PASO 2: Opciones de abastecimiento para un item (V2 Multi-fuente)

    Genera opciones de 4 tipos:
    - stock: Stock disponible en el mismo centro
    - transferencia: Stock disponible en otros centros
    - proveedor: Proveedores externos con precios negociados
    - equivalencia: Materiales equivalentes desde equivalentes.db
    """
    solicitud = SolicitudRepository.get_by_id(solicitud_id)
    if not solicitud:
        raise ValueError(f"Solicitud {solicitud_id} no encontrada")

    items = SolicitudRepository.get_items(solicitud_id)
    if item_idx >= len(items):
        raise ValueError(f"Item index {item_idx} fuera de rango")

    item = items[item_idx]
    codigo_original = item.get("codigo") or item.get("material") or item.get("material_id") or ""
    cantidad_solicitada = float(item.get("cantidad", 0) or 0)
    precio_unitario_original = float(item.get("precio_unitario") or item.get("precio_usd") or 0)
    centro_solicitud = solicitud.get("centro", "")
    almacen_solicitud = solicitud.get("almacen_virtual") or solicitud.get("almacen", "")

    opciones = []

    # 1. STOCK LOCAL
    detalle_stock_base = (
        MaterialRepository.get_stock_detalle(
            codigo_original,
            centro_solicitud,
            almacen_solicitud,
        )
        or []
    )
    stock_total_local = sum(float(d.get("cantidad") or 0) for d in detalle_stock_base)

    # Consumo historico promedio
    consumo_df = get_consumo_cache()
    consumo_promedio = 0
    if consumo_df is not None and not consumo_df.empty:
        df_item = consumo_df[consumo_df["codigo_norm"] == norm_codigo(codigo_original)]
        if not df_item.empty and "cantidad" in df_item.columns and "fecha" in df_item.columns:
            recientes = df_item.sort_values("fecha", ascending=False).head(180)
            if not recientes.empty:
                consumo_promedio = float(recientes["cantidad"].mean() or 0)

    if stock_total_local > 0:
        opciones.append(
            {
                "opcion_id": f"stock_{centro_solicitud}_{almacen_solicitud}",
                "tipo": "stock",
                "nombre": f"Stock Local ({centro_solicitud})",
                "centro_origen": centro_solicitud,
                "almacen_origen": almacen_solicitud,
                "codigo_material": codigo_original,
                "descripcion": item.get("descripcion", ""),
                "cantidad_disponible": stock_total_local,
                "cantidad_solicitada": cantidad_solicitada,
                "plazo_dias": 1,
                "precio_unitario": precio_unitario_original,
                "costo_total": min(cantidad_solicitada, stock_total_local) * precio_unitario_original,
                "rating": 5.0,
                "compatibilidad_pct": 100,
                "observaciones": "Entrega inmediata desde almacen local",
                "detalle_stock": detalle_stock_base,
                "mismo_centro": True,
            }
        )

    # 2. TRANSFERENCIAS
    try:
        transferencias = ProveedorInternoRepository.get_opciones_transferencia(
            codigo_original, centro_solicitud
        )
        for t in transferencias:
            lead_time = ProveedorInternoRepository.get_lead_time_transferencia(
                t["centro"], centro_solicitud
            )
            opciones.append(
                {
                    "opcion_id": f"transferencia_{t['centro']}_{t['almacen']}",
                    "tipo": "transferencia",
                    "nombre": f"Transferencia desde {t.get('centro_nombre', t['centro'])}",
                    "centro_origen": t["centro"],
                    "almacen_origen": t["almacen"],
                    "codigo_material": codigo_original,
                    "descripcion": item.get("descripcion", ""),
                    "cantidad_disponible": t["stock_disponible"],
                    "cantidad_solicitada": cantidad_solicitada,
                    "plazo_dias": lead_time,
                    "precio_unitario": precio_unitario_original,
                    "costo_total": min(cantidad_solicitada, t["stock_disponible"]) * precio_unitario_original,
                    "rating": 4.5,
                    "compatibilidad_pct": 100,
                    "observaciones": f"Transferencia interna - {t.get('almacen_nombre', t['almacen'])}",
                    "contacto": {
                        "nombre": t.get("referente_nombre"),
                        "email": t.get("referente_email") or t.get("contacto_centro"),
                    },
                }
            )
    except Exception as e:
        logger.warning(f"Error obteniendo transferencias: {e}")

    # 3. PROVEEDORES EXTERNOS
    try:
        proveedores_ext = ProveedorExternoRepository.list_activos_con_contacto()

        for prov in proveedores_ext:
            precio_info = ProveedorPreciosRepository.get_precio_vigente(
                prov["cuit"], codigo_original
            )
            precio_final = precio_info["precio_usd"] if precio_info else precio_unitario_original
            es_negociado = precio_info is not None

            calificacion = prov.get("calificacion", "sin_calificar")
            rating_map = {"cumplidor": 4.5, "incumplidor": 2.0, "sin_calificar": 3.5}
            rating = rating_map.get(calificacion, 3.5)

            opciones.append(
                {
                    "opcion_id": f"proveedor_{prov['cuit']}",
                    "tipo": "proveedor",
                    "nombre": prov["nombre"],
                    "cuit_proveedor": prov["cuit"],
                    "codigo_material": codigo_original,
                    "descripcion": item.get("descripcion", ""),
                    "cantidad_disponible": cantidad_solicitada,
                    "cantidad_solicitada": cantidad_solicitada,
                    "disponibilidad_bajo_pedido": True,
                    "plazo_dias": prov.get("lead_time_dias") or 30,
                    "precio_unitario": precio_final,
                    "precio_es_negociado": es_negociado,
                    "costo_total": cantidad_solicitada * precio_final,
                    "rating": rating,
                    "calificacion": calificacion,
                    "compatibilidad_pct": 100,
                    "observaciones": f"Proveedor externo - {prov.get('rubro', 'General')}",
                    "rubro": prov.get("rubro"),
                    "contacto": {
                        "email": prov.get("email_principal"),
                        "telefono": prov.get("telefono_principal"),
                    },
                }
            )

        # Fallback a tabla legacy
        if not proveedores_ext:
            proveedores_legacy = ProveedorRepository.list_externos_activos()
            for prov in proveedores_legacy[:5]:
                opciones.append(
                    _build_proveedor_option(
                        prov, codigo_original, item, cantidad_solicitada, precio_unitario_original
                    )
                )
    except Exception as e:
        logger.warning(f"Error obteniendo proveedores: {e}")

    # 4. EQUIVALENCIAS
    equivalencias_agregadas = set()
    try:
        equivalencias_db = EquivalenciasRepository.get_equivalencias_con_score(codigo_original)
        for eq in equivalencias_db:
            cod_eq = eq.get("codigo_equivalente", "")
            cod_norm = norm_codigo(cod_eq)
            if not cod_norm or cod_norm in equivalencias_agregadas:
                continue

            stock_eq_detalle = (
                MaterialRepository.get_stock_detalle(cod_eq, centro_solicitud, None) or []
            )
            stock_eq = sum(float(d.get("cantidad") or 0) for d in stock_eq_detalle)
            if stock_eq <= 0:
                continue

            descripcion_eq = eq.get("descripcion_equivalente", "")
            precio_equiv = precio_unitario_original
            try:
                mat_info = MaterialRepository.get_info(cod_eq)
                if mat_info:
                    descripcion_eq = mat_info.get("descripcion", descripcion_eq) or descripcion_eq
                    precio_equiv = float(mat_info.get("precio_usd", precio_equiv) or precio_equiv)
            except Exception:
                pass

            opciones.append(
                {
                    "opcion_id": f"equivalencia_{cod_norm}",
                    "tipo": "equivalencia",
                    "nombre": descripcion_eq or f"Equivalente {cod_eq}",
                    "codigo_material": cod_eq,
                    "codigo_original": codigo_original,
                    "descripcion": descripcion_eq,
                    "cantidad_disponible": stock_eq,
                    "cantidad_solicitada": cantidad_solicitada,
                    "plazo_dias": 1,
                    "precio_unitario": precio_equiv,
                    "costo_total": min(cantidad_solicitada, stock_eq) * precio_equiv,
                    "rating": 4.8,
                    "compatibilidad_pct": eq.get("compatibilidad_pct", 85),
                    "tipo_equivalencia": eq.get("tipo_equiv", "E1_ESTRICTA"),
                    "criterio": eq.get("criterio", ""),
                    "motivo_equivalencia": eq.get("motivo_equivalencia", ""),
                    "observaciones": f"Equivalencia {eq.get('tipo_equiv', '')} - {eq.get('criterio', 'tecnica')}",
                    "detalle_stock": stock_eq_detalle,
                }
            )
            equivalencias_agregadas.add(cod_norm)

        # Fallback a Excel cache
        if not equivalencias_db:
            catalogo_eq = get_equivalencias_cache()
            if catalogo_eq is not None and not catalogo_eq.empty:
                df_eq = catalogo_eq[catalogo_eq["codigo_base_norm"] == norm_codigo(codigo_original)]
                for _, row in df_eq.head(5).iterrows():
                    cod_eq = str(row.get("codigo_equivalente") or "")
                    cod_norm = norm_codigo(cod_eq)
                    if not cod_norm or cod_norm in equivalencias_agregadas:
                        continue

                    descripcion_eq = row.get("descripcion_equivalente") or item.get("descripcion", "")
                    precio_equiv = precio_unitario_original

                    try:
                        mat_info = MaterialRepository.get_info(cod_eq)
                        if mat_info:
                            descripcion_eq = mat_info.get("descripcion", descripcion_eq)
                            precio_equiv = float(mat_info.get("precio_usd", precio_equiv) or precio_equiv)
                    except Exception:
                        pass

                    opciones.append(
                        {
                            "opcion_id": f"equivalencia_legacy_{cod_norm}",
                            "tipo": "equivalencia",
                            "nombre": descripcion_eq or f"Equivalente {cod_eq}",
                            "codigo_material": cod_eq,
                            "codigo_original": codigo_original,
                            "descripcion": descripcion_eq,
                            "cantidad_disponible": cantidad_solicitada,
                            "cantidad_solicitada": cantidad_solicitada,
                            "plazo_dias": 1,
                            "precio_unitario": float(precio_equiv),
                            "costo_total": cantidad_solicitada * float(precio_equiv),
                            "rating": 4.5,
                            "compatibilidad_pct": 85,
                            "observaciones": f"Equivalencia por {row.get('criterio', 'atributos')}",
                            "motivo_equivalencia": str(row.get("motivo", "")),
                        }
                    )
                    equivalencias_agregadas.add(cod_norm)
    except Exception as e:
        logger.warning(f"Error obteniendo equivalencias: {e}")

    # 5. MRP INFO
    mrp_info = None
    mrp_alertas = []
    try:
        mrp_params = MrpRepository.get_parametros_mrp(codigo_original, centro_solicitud)
        if mrp_params:
            if stock_total_local < (mrp_params.get("punto_pedido") or 0):
                mrp_alertas.append(
                    {
                        "tipo": "bajo_punto_pedido",
                        "mensaje": f"Stock ({stock_total_local}) bajo punto de pedido ({mrp_params.get('punto_pedido')})",
                    }
                )
            if stock_total_local < (mrp_params.get("stock_seguridad") or 0):
                mrp_alertas.append(
                    {
                        "tipo": "bajo_stock_seguridad",
                        "mensaje": f"Stock ({stock_total_local}) bajo stock de seguridad ({mrp_params.get('stock_seguridad')})",
                    }
                )

            mrp_info = {
                "planificado": True,
                "punto_pedido": mrp_params.get("punto_pedido", 0),
                "stock_seguridad": mrp_params.get("stock_seguridad", 0),
                "stock_maximo": mrp_params.get("stock_maximo", 0),
                "lote_pedido": mrp_params.get("lote_pedido", 0),
                "lead_time": mrp_params.get("lead_time", 0),
                "alertas": mrp_alertas,
            }
    except Exception as e:
        logger.debug(f"Error obteniendo MRP: {e}")

    if not mrp_info:
        mrp_info = {"planificado": False, "alertas": []}

    # 6. CALCULAR SCORES
    if opciones:
        max_precio = max((float(op.get("precio_unitario", 0) or 0) for op in opciones), default=1.0)
        max_plazo = max((float(op.get("plazo_dias", 0) or 0) for op in opciones), default=1.0)

        for opcion in opciones:
            score = _calcular_score_opcion_v2(opcion, max_precio, max_plazo)
            opcion["score_recomendacion"] = round(score, 2)
            opcion["is_recomendada"] = False

        opciones.sort(key=lambda x: x.get("score_recomendacion", 0), reverse=True)

        if opciones:
            opciones[0]["is_recomendada"] = True

    # 7. DECISION PREVIA
    decision_previa = None
    try:
        decision_previa = DecisionAbastecimientoRepository.get_decision(solicitud_id, item_idx)
    except Exception:
        pass

    # Log del evento
    TratamientoRepository.log_evento(
        solicitud_id,
        item_idx,
        "opciones_consultadas",
        "PASO_2",
        {
            "codigo": codigo_original,
            "cantidad": cantidad_solicitada,
            "opciones_disponibles": len(opciones),
            "tipos_opciones": list(set(op["tipo"] for op in opciones)),
            "mejor_score": opciones[0].get("score_recomendacion") if opciones else 0,
        },
        actor_id="sistema",
    )

    return {
        "solicitud_id": solicitud_id,
        "item_idx": item_idx,
        "paso": 2,
        "nombre_paso": "Decision de Abastecimiento",
        "item": {
            "codigo": codigo_original,
            "descripcion": item.get("descripcion", ""),
            "cantidad": cantidad_solicitada,
            "precio_unitario_original": precio_unitario_original,
            "costo_total_original": cantidad_solicitada * precio_unitario_original,
            "stock_disponible": stock_total_local,
            "consumo_promedio": round(consumo_promedio, 2),
            "detalle_stock": detalle_stock_base,
        },
        "opciones": opciones,
        "mrp": mrp_info,
        "decision_previa": decision_previa,
        "multi_fuente": True,
    }
