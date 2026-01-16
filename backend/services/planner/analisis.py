"""
Planner Service - Paso 1: Analisis integral de solicitud

Funciones para el analisis inicial de solicitudes:
- Analisis de items y stock
- Deteccion de conflictos
- Validacion de integridad
- Generacion de avisos y recomendaciones
"""

import logging
from typing import Any, Dict, List

from backend.core.cache_loader import get_consumo_cache
from backend.core.repository import (
    EquivalenciasRepository,
    MaterialRepository,
    PresupuestoRepository,
    SolicitudRepository,
    TratamientoRepository,
)
from backend.services.planner.helpers import norm_codigo

logger = logging.getLogger(__name__)


def _analizar_item_material(
    idx: int, item: Dict[str, Any], solicitud: Dict[str, Any], consumo_df
) -> Dict[str, Any]:
    """
    Analiza un item individual de la solicitud.
    Retorna informacion del material con stock, consumo y criticidad.
    Incluye stock de equivalencias para calculo correcto de deficit.
    """
    codigo = item.get("codigo") or item.get("material_id") or ""
    cantidad = float(item.get("cantidad", 0) or 0)
    precio_unitario = float(item.get("precio_unitario", 0) or 0)
    costo_item = cantidad * precio_unitario

    criticidad = (item.get("criticidad") or solicitud.get("criticidad") or "Normal").capitalize()

    # Stock local del material
    stock_detalle = (
        MaterialRepository.get_stock_detalle(
            codigo,
            solicitud.get("centro"),
            solicitud.get("almacen_virtual") or solicitud.get("almacen"),
        )
        or []
    )
    stock_disponible = sum(float(d.get("cantidad") or 0) for d in stock_detalle)

    # Stock de equivalencias
    stock_equivalencias = 0
    try:
        equivalencias = EquivalenciasRepository.get_equivalencias_con_score(codigo)
        for eq in equivalencias:
            cod_eq = eq.get("codigo_equivalente", "")
            if not cod_eq:
                continue
            stock_eq_detalle = (
                MaterialRepository.get_stock_detalle(
                    cod_eq,
                    solicitud.get("centro"),
                    solicitud.get("almacen_virtual") or solicitud.get("almacen"),
                )
                or []
            )
            stock_eq = sum(float(d.get("cantidad") or 0) for d in stock_eq_detalle)
            stock_equivalencias += stock_eq
    except Exception as e:
        logger.debug(f"Error obteniendo equivalencias para {codigo}: {e}")

    stock_total = stock_disponible + stock_equivalencias

    consumo_promedio = 0
    if consumo_df is not None and not consumo_df.empty:
        df_item = consumo_df[consumo_df["codigo_norm"] == norm_codigo(codigo)]
        if not df_item.empty and "cantidad" in df_item.columns and "fecha" in df_item.columns:
            recientes = df_item.sort_values("fecha", ascending=False).head(180)
            if not recientes.empty:
                consumo_promedio = float(recientes["cantidad"].mean() or 0)

    return {
        "idx": idx,
        "codigo": codigo,
        "descripcion": item.get("descripcion", ""),
        "cantidad": cantidad,
        "precio_unitario": precio_unitario,
        "costo_total": costo_item,
        "stock_disponible": stock_disponible,
        "stock_equivalencias": stock_equivalencias,
        "stock_total": stock_total,
        "consumo_promedio": consumo_promedio,
        "criticidad": criticidad,
    }


def _detectar_conflictos_item(
    idx: int, item: Dict[str, Any], material_info: Dict[str, Any], presupuesto_disponible: float
) -> List[Dict[str, Any]]:
    """Detecta conflictos para un item especifico."""
    conflictos = []
    codigo = material_info["codigo"]
    cantidad = material_info["cantidad"]
    stock_disponible = material_info["stock_disponible"]
    precio_unitario = material_info["precio_unitario"]
    costo_item = material_info["costo_total"]
    consumo_promedio = material_info["consumo_promedio"]
    criticidad = material_info["criticidad"]
    descripcion = material_info["descripcion"]

    # Stock insuficiente
    if stock_disponible < cantidad:
        conflictos.append(
            {
                "tipo": "stock_insuficiente",
                "item_idx": idx,
                "codigo": codigo,
                "descripcion_material": descripcion or "Sin descripcion",
                "cantidad_solicitada": cantidad,
                "cantidad_disponible": stock_disponible,
                "deficit": cantidad - stock_disponible,
                "sugerencia": "Considerar proveedor externo o material equivalente",
                "impacto_critico": criticidad.lower().startswith("cri"),
                "descripcion": f"Stock insuficiente: {descripcion or codigo} - Faltan {cantidad - stock_disponible} unidades",
            }
        )

    # Presupuesto insuficiente
    if costo_item > presupuesto_disponible:
        conflictos.append(
            {
                "tipo": "presupuesto_insuficiente",
                "item_idx": idx,
                "codigo": codigo,
                "descripcion_material": descripcion or "Sin descripcion",
                "costo_item": costo_item,
                "presupuesto_disponible": presupuesto_disponible,
                "deficit_presupuesto": costo_item - presupuesto_disponible,
                "sugerencia": "Solicitar ampliacion de presupuesto o reducir cantidad",
                "impacto_critico": True,
                "descripcion": f"Presupuesto insuficiente: {descripcion or codigo} requiere USD$ {costo_item:.2f}, disponible USD$ {presupuesto_disponible:.2f}",
            }
        )

    # Consumo inusual
    if consumo_promedio and cantidad > consumo_promedio * 1.5:
        porcentaje_exceso = ((cantidad / consumo_promedio) - 1) * 100
        conflictos.append(
            {
                "tipo": "consumo_inusual",
                "item_idx": idx,
                "codigo": codigo,
                "descripcion_material": descripcion or "Sin descripcion",
                "cantidad_solicitada": cantidad,
                "consumo_promedio": consumo_promedio,
                "exceso_porcentaje": porcentaje_exceso,
                "sugerencia": "Verificar justificacion del pedido con el solicitante",
                "impacto_critico": False,
                "descripcion": f"Consumo inusual: {descripcion or codigo} - Pedido {porcentaje_exceso:.1f}% mayor al promedio historico",
            }
        )

    return conflictos


def _generar_avisos_presupuesto(
    presupuesto_real_necesario: float,
    presupuesto_disponible: float,
    materiales_por_criticidad: Dict[str, List],
) -> List[Dict[str, Any]]:
    """Genera avisos relacionados con presupuesto y criticidad."""
    avisos = []

    if presupuesto_real_necesario > presupuesto_disponible:
        avisos.append(
            {
                "nivel": "warning",
                "mensaje": f"Presupuesto real necesario (USD$ {presupuesto_real_necesario:.2f}) excede disponible (USD$ {presupuesto_disponible:.2f})",
                "deficit": presupuesto_real_necesario - presupuesto_disponible,
                "detalle": f"Se requiere compra externa por USD$ {presupuesto_real_necesario:.2f} (items sin stock suficiente)",
            }
        )
    elif presupuesto_real_necesario > 0:
        avisos.append(
            {
                "nivel": "info",
                "mensaje": f"Se necesitara USD$ {presupuesto_real_necesario:.2f} para compra externa (stock insuficiente en algunos items)",
                "presupuesto_requerido": presupuesto_real_necesario,
            }
        )

    if len(materiales_por_criticidad["Critico"]) > 0:
        avisos.append(
            {
                "nivel": "info",
                "mensaje": f"{len(materiales_por_criticidad['Critico'])} material(es) de criticidad critica",
                "cantidad": len(materiales_por_criticidad["Critico"]),
            }
        )

    return avisos


def _validar_integridad_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Valida la integridad de los items de la solicitud."""
    conflictos = []
    codigos_vistos = {}

    for idx, item in enumerate(items):
        codigo = (item.get("codigo") or item.get("material_id") or "").strip()
        cantidad = float(item.get("cantidad", 0) or 0)
        precio_unitario = float(item.get("precio_unitario", 0) or 0)
        descripcion = item.get("descripcion", "")

        # Codigo vacio
        if not codigo:
            conflictos.append(
                {
                    "tipo": "validacion_codigo_vacio",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripcion",
                    "sugerencia": "Debe especificar un codigo de material valido",
                    "impacto_critico": True,
                    "descripcion": f"Item {idx}: Codigo de material vacio o no especificado",
                }
            )
            continue

        # Precio invalido
        if precio_unitario <= 0:
            conflictos.append(
                {
                    "tipo": "validacion_precio_invalido",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripcion",
                    "precio_unitario": precio_unitario,
                    "sugerencia": "El precio unitario debe ser mayor a 0",
                    "impacto_critico": True,
                    "descripcion": f"Precio invalido: {descripcion or codigo} - Precio: USD$ {precio_unitario:.2f}",
                }
            )

        # Cantidad invalida
        if cantidad <= 0:
            conflictos.append(
                {
                    "tipo": "validacion_cantidad_invalida",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripcion",
                    "cantidad": cantidad,
                    "sugerencia": "La cantidad debe ser mayor a 0",
                    "impacto_critico": True,
                    "descripcion": f"Cantidad invalida: {descripcion or codigo} - Cantidad: {cantidad}",
                }
            )

        # Items duplicados
        codigo_norm = norm_codigo(codigo)
        if codigo_norm in codigos_vistos:
            conflictos.append(
                {
                    "tipo": "validacion_duplicado",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripcion",
                    "item_duplicado_idx": codigos_vistos[codigo_norm],
                    "sugerencia": "Consolidar items duplicados en una sola linea antes de continuar",
                    "impacto_critico": True,
                    "descripcion": f"Item duplicado: {descripcion or codigo} - Ya existe en item {codigos_vistos[codigo_norm]}",
                }
            )
        else:
            codigos_vistos[codigo_norm] = idx

        # Material obsoleto
        try:
            mat_info = MaterialRepository.get_info(codigo)
            if mat_info:
                activo = mat_info.get("activo", 1)
                if not activo or activo == 0:
                    conflictos.append(
                        {
                            "tipo": "validacion_material_obsoleto",
                            "item_idx": idx,
                            "codigo": codigo,
                            "descripcion_material": descripcion
                            or mat_info.get("descripcion", "Sin descripcion"),
                            "sugerencia": "Verificar material alternativo o reactivar en catalogo",
                            "impacto_critico": False,
                            "descripcion": f"Material obsoleto: {descripcion or codigo} - Material inactivo en catalogo",
                        }
                    )
        except Exception:
            pass

    return conflictos


def _generar_recomendaciones(conflictos: List[Dict], avisos: List[Dict]) -> List[Dict]:
    """Genera recomendaciones basadas en conflictos."""
    recomendaciones = []

    for conflicto in conflictos:
        if conflicto["tipo"] == "stock_insuficiente":
            recomendaciones.append(
                {
                    "prioridad": "alta",
                    "accion": "Buscar proveedores externos",
                    "razon": f"Stock insuficiente para item {conflicto['item_idx']}",
                }
            )
        elif conflicto["tipo"] == "presupuesto_insuficiente":
            recomendaciones.append(
                {
                    "prioridad": "muy_alta",
                    "accion": "Solicitar ampliacion de presupuesto",
                    "razon": f"Item {conflicto['item_idx']} requiere ${conflicto['costo_item']}",
                }
            )
        elif conflicto["tipo"] == "consumo_inusual":
            recomendaciones.append(
                {
                    "prioridad": "media",
                    "accion": "Verificar consumo historico",
                    "razon": f"Pedido supera consumo promedio del material {conflicto['codigo']}",
                }
            )

    if len(avisos) > 0:
        recomendaciones.append(
            {
                "prioridad": "media",
                "accion": "Revisar avisos especiales antes de continuar",
                "razon": f"Hay {len(avisos)} avisos que requieren atencion",
            }
        )

    return recomendaciones


def paso_1_analizar_solicitud(solicitud_id: int) -> Dict[str, Any]:
    """
    PASO 1: Analisis integral
    Retorna presupuesto, materiales por criticidad, conflictos, avisos, recomendaciones
    """
    # 1. Validar y obtener datos basicos
    solicitud = SolicitudRepository.get_by_id(solicitud_id)
    if not solicitud:
        raise ValueError(f"Solicitud {solicitud_id} no encontrada")

    items = SolicitudRepository.get_items(solicitud_id)
    presupuesto_info = PresupuestoRepository.get_disponible(
        solicitud["centro"], solicitud["sector"]
    )
    presupuesto_total = presupuesto_info["monto"]
    presupuesto_disponible = presupuesto_info["saldo"]

    # 2. Inicializar estructuras de datos
    total_solicitado = 0
    materiales_por_criticidad = {"Critico": [], "Normal": [], "Bajo": []}
    conflictos: List[Dict[str, Any]] = []
    presupuesto_real_necesario = 0
    consumo_df = get_consumo_cache()

    # 2.1. Validar integridad de items
    conflictos_validacion = _validar_integridad_items(items)
    conflictos.extend(conflictos_validacion)

    # 3. Procesar cada item
    for idx, item in enumerate(items):
        material_info = _analizar_item_material(idx, item, solicitud, consumo_df)

        total_solicitado += material_info["costo_total"]

        # Clasificar por criticidad
        criticidad = material_info["criticidad"]
        if criticidad.lower().startswith("cri"):
            materiales_por_criticidad["Critico"].append(material_info)
        elif criticidad.lower().startswith("baj"):
            materiales_por_criticidad["Bajo"].append(material_info)
        else:
            materiales_por_criticidad["Normal"].append(material_info)

        # Calcular presupuesto real necesario
        deficit_stock = max(0, material_info["cantidad"] - material_info["stock_total"])
        if deficit_stock > 0:
            presupuesto_real_necesario += deficit_stock * material_info["precio_unitario"]

        # Detectar conflictos del item
        conflictos_item = _detectar_conflictos_item(
            idx, item, material_info, presupuesto_disponible
        )
        conflictos.extend(conflictos_item)

    # 4. Generar avisos
    avisos = _generar_avisos_presupuesto(
        presupuesto_real_necesario, presupuesto_disponible, materiales_por_criticidad
    )

    # 5. Generar recomendaciones
    recomendaciones = _generar_recomendaciones(conflictos, avisos)

    TratamientoRepository.log_evento(
        solicitud_id,
        None,
        "analisis_iniciado",
        "PASO_1",
        {
            "presupuesto_disponible": presupuesto_disponible,
            "total_solicitado": total_solicitado,
            "conflictos_detectados": len(conflictos),
        },
        actor_id="sistema",
    )

    return {
        "solicitud_id": solicitud_id,
        "paso": 1,
        "nombre_paso": "Analisis Inicial",
        "resumen": {
            "presupuesto_total": presupuesto_total,
            "presupuesto_disponible": presupuesto_disponible,
            "total_solicitado": total_solicitado,
            "presupuesto_real_necesario": presupuesto_real_necesario,
            "diferencia_presupuesto": presupuesto_disponible - total_solicitado,
            "diferencia_presupuesto_real": presupuesto_disponible - presupuesto_real_necesario,
            "total_items": len(items),
            "conflictos_detectados": len(conflictos),
            "avisos": len(avisos),
            "puede_cubrirse_con_stock": presupuesto_real_necesario == 0,
        },
        "materiales_por_criticidad": materiales_por_criticidad,
        "conflictos": conflictos,
        "avisos": avisos,
        "recomendaciones": recomendaciones,
    }
