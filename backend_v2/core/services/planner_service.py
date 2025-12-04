"""
Servicio de Planner: lógica de negocio PASO 1–3 de tratamiento de solicitud
Separado de rutas para facilitar tests y reutilización
"""

from typing import Any, Dict, List

# Import con manejo de rutas relativas
try:
    from backend_v2.core.cache_loader import (get_consumo_cache,
                                              get_equivalencias_cache)
    from backend_v2.core.repository import (MaterialRepository,
                                            PresupuestoRepository,
                                            ProveedorRepository,
                                            SolicitudRepository,
                                            TratamientoRepository)
except ImportError:
    from core.cache_loader import get_consumo_cache, get_equivalencias_cache
    from core.repository import (MaterialRepository, PresupuestoRepository,
                                 ProveedorRepository, SolicitudRepository,
                                 TratamientoRepository)


def norm_codigo(val: str) -> str:
    """Normaliza código de material (elimina ceros y .0 finales)"""
    base = (val or "").strip()
    if base.endswith(".0"):
        base = base[:-2]
    return base.lstrip("0")


def _analizar_item_material(
    idx: int, item: Dict[str, Any], solicitud: Dict[str, Any], consumo_df
) -> Dict[str, Any]:
    """
    Analiza un item individual de la solicitud.
    Retorna información del material con stock, consumo y criticidad.
    """
    codigo = item.get("codigo", "")
    cantidad = float(item.get("cantidad", 0) or 0)
    precio_unitario = float(item.get("precio_unitario", 0) or 0)
    costo_item = cantidad * precio_unitario

    criticidad = (item.get("criticidad") or solicitud.get("criticidad") or "Normal").capitalize()

    stock_detalle = (
        MaterialRepository.get_stock_detalle(
            codigo,
            solicitud.get("centro"),
            solicitud.get("almacen_virtual") or solicitud.get("almacen"),
        )
        or []
    )
    stock_disponible = sum(float(d.get("cantidad") or 0) for d in stock_detalle)

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
        "consumo_promedio": consumo_promedio,
        "criticidad": criticidad,
    }


def _detectar_conflictos_item(
    idx: int, item: Dict[str, Any], material_info: Dict[str, Any], presupuesto_disponible: float
) -> List[Dict[str, Any]]:
    """
    Detecta conflictos para un item específico.
    Retorna lista de conflictos encontrados.
    """
    conflictos = []
    codigo = material_info["codigo"]
    cantidad = material_info["cantidad"]
    stock_disponible = material_info["stock_disponible"]
    precio_unitario = material_info["precio_unitario"]
    costo_item = material_info["costo_total"]
    consumo_promedio = material_info["consumo_promedio"]
    criticidad = material_info["criticidad"]
    descripcion = material_info["descripcion"]

    # Conflicto: Stock insuficiente
    if stock_disponible < cantidad:
        conflictos.append(
            {
                "tipo": "stock_insuficiente",
                "item_idx": idx,
                "codigo": codigo,
                "descripcion_material": descripcion or "Sin descripción",
                "cantidad_solicitada": cantidad,
                "cantidad_disponible": stock_disponible,
                "deficit": cantidad - stock_disponible,
                "sugerencia": "Considerar proveedor externo o material equivalente",
                "impacto_critico": criticidad.lower().startswith("cri"),
                "descripcion": f"Stock insuficiente: {descripcion or codigo} - Faltan {cantidad - stock_disponible} unidades",
            }
        )

    # Conflicto: Presupuesto insuficiente
    if costo_item > presupuesto_disponible:
        conflictos.append(
            {
                "tipo": "presupuesto_insuficiente",
                "item_idx": idx,
                "codigo": codigo,
                "descripcion_material": descripcion or "Sin descripción",
                "costo_item": costo_item,
                "presupuesto_disponible": presupuesto_disponible,
                "deficit_presupuesto": costo_item - presupuesto_disponible,
                "sugerencia": "Solicitar ampliación de presupuesto o reducir cantidad",
                "impacto_critico": True,
                "descripcion": f"Presupuesto insuficiente: {descripcion or codigo} requiere USD$ {costo_item:.2f}, disponible USD$ {presupuesto_disponible:.2f}",
            }
        )

    # Conflicto: Consumo inusual
    if consumo_promedio and cantidad > consumo_promedio * 1.5:
        porcentaje_exceso = ((cantidad / consumo_promedio) - 1) * 100
        conflictos.append(
            {
                "tipo": "consumo_inusual",
                "item_idx": idx,
                "codigo": codigo,
                "descripcion_material": descripcion or "Sin descripción",
                "cantidad_solicitada": cantidad,
                "consumo_promedio": consumo_promedio,
                "exceso_porcentaje": porcentaje_exceso,
                "sugerencia": "Verificar justificación del pedido con el solicitante",
                "impacto_critico": False,
                "descripcion": f"Consumo inusual: {descripcion or codigo} - Pedido {porcentaje_exceso:.1f}% mayor al promedio histórico",
            }
        )

    return conflictos


def _generar_avisos_presupuesto(
    presupuesto_real_necesario: float,
    presupuesto_disponible: float,
    materiales_por_criticidad: Dict[str, List],
) -> List[Dict[str, Any]]:
    """
    Genera avisos relacionados con presupuesto y criticidad.
    """
    avisos = []

    # Aviso: Presupuesto real necesario vs disponible
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
                "mensaje": f"Se necesitará USD$ {presupuesto_real_necesario:.2f} para compra externa (stock insuficiente en algunos items)",
                "presupuesto_requerido": presupuesto_real_necesario,
            }
        )

    # Aviso: Materiales críticos
    if len(materiales_por_criticidad["Critico"]) > 0:
        avisos.append(
            {
                "nivel": "info",
                "mensaje": f"{len(materiales_por_criticidad['Critico'])} material(es) de criticidad crítica",
                "cantidad": len(materiales_por_criticidad["Critico"]),
            }
        )

    return avisos


def _validar_integridad_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Valida la integridad de los items de la solicitud.
    Retorna lista de conflictos de validación.
    """
    conflictos = []
    codigos_vistos = {}

    for idx, item in enumerate(items):
        codigo = (item.get("codigo") or "").strip()
        cantidad = float(item.get("cantidad", 0) or 0)
        precio_unitario = float(item.get("precio_unitario", 0) or 0)
        descripcion = item.get("descripcion", "")

        # Validación 1: Código vacío
        if not codigo:
            conflictos.append(
                {
                    "tipo": "validacion_codigo_vacio",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripción",
                    "sugerencia": "Debe especificar un código de material válido",
                    "impacto_critico": True,
                    "descripcion": f"Item {idx}: Código de material vacío o no especificado",
                }
            )
            continue  # No validar más este item

        # Validación 2: Precio unitario inválido
        if precio_unitario <= 0:
            conflictos.append(
                {
                    "tipo": "validacion_precio_invalido",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripción",
                    "precio_unitario": precio_unitario,
                    "sugerencia": "El precio unitario debe ser mayor a 0",
                    "impacto_critico": True,
                    "descripcion": f"Precio inválido: {descripcion or codigo} - Precio: USD$ {precio_unitario:.2f}",
                }
            )

        # Validación 3: Cantidad inválida
        if cantidad <= 0:
            conflictos.append(
                {
                    "tipo": "validacion_cantidad_invalida",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripción",
                    "cantidad": cantidad,
                    "sugerencia": "La cantidad debe ser mayor a 0",
                    "impacto_critico": True,
                    "descripcion": f"Cantidad inválida: {descripcion or codigo} - Cantidad: {cantidad}",
                }
            )

        # Validación 4: Items duplicados
        codigo_norm = norm_codigo(codigo)
        if codigo_norm in codigos_vistos:
            conflictos.append(
                {
                    "tipo": "validacion_duplicado",
                    "item_idx": idx,
                    "codigo": codigo,
                    "descripcion_material": descripcion or "Sin descripción",
                    "item_duplicado_idx": codigos_vistos[codigo_norm],
                    "sugerencia": "Consolidar items duplicados en una sola línea",
                    "impacto_critico": False,
                    "descripcion": f"Item duplicado: {descripcion or codigo} - Ya existe en item {codigos_vistos[codigo_norm]}",
                }
            )
        else:
            codigos_vistos[codigo_norm] = idx

        # Validación 5: Material obsoleto/inactivo
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
                            or mat_info.get("descripcion", "Sin descripción"),
                            "sugerencia": "Verificar material alternativo o reactivar en catálogo",
                            "impacto_critico": False,
                            "descripcion": f"Material obsoleto: {descripcion or codigo} - Material inactivo en catálogo",
                        }
                    )
        except Exception:
            # Si no se puede verificar, no es crítico
            pass

    return conflictos


def paso_1_analizar_solicitud(solicitud_id: int) -> Dict[str, Any]:
    """
    PASO 1: Análisis integral
    Retorna presupuesto, materiales por criticidad, conflictos, avisos, recomendaciones
    """
    # 1. Validar y obtener datos básicos
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
    presupuesto_real_necesario = 0  # Solo cuenta items que requieren compra externa
    consumo_df = get_consumo_cache()

    # 2.1. Validar integridad de items (antes de procesar)
    conflictos_validacion = _validar_integridad_items(items)
    conflictos.extend(conflictos_validacion)

    # 3. Procesar cada item
    for idx, item in enumerate(items):
        # Analizar material
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

        # Calcular presupuesto real necesario (solo déficit de stock)
        deficit_stock = max(0, material_info["cantidad"] - material_info["stock_disponible"])
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


def paso_2_opciones_abastecimiento(solicitud_id: int, item_idx: int) -> Dict[str, Any]:
    """
    PASO 2: Opciones de abastecimiento para un item
    Retorna stock interno, proveedores externos, equivalencias, mix
    """
    solicitud = SolicitudRepository.get_by_id(solicitud_id)
    if not solicitud:
        raise ValueError(f"Solicitud {solicitud_id} no encontrada")

    items = SolicitudRepository.get_items(solicitud_id)
    if item_idx >= len(items):
        raise ValueError(f"Item index {item_idx} fuera de rango")

    item = items[item_idx]
    codigo_original = item.get("codigo", "")
    cantidad_solicitada = float(item.get("cantidad", 0) or 0)
    precio_unitario_original = float(item.get("precio_unitario", 0) or 0)

    opciones = []
    equivalencias_norm = set()
    detalle_stock_base = (
        MaterialRepository.get_stock_detalle(
            codigo_original,
            solicitud.get("centro"),
            solicitud.get("almacen_virtual") or solicitud.get("almacen"),
        )
        or []
    )

    stock_total = sum(float(d.get("cantidad") or 0) for d in detalle_stock_base)

    # Calcular consumo histórico promedio
    consumo_df = get_consumo_cache()
    consumo_promedio = 0
    if consumo_df is not None and not consumo_df.empty:
        df_item = consumo_df[consumo_df["codigo_norm"] == norm_codigo(codigo_original)]
        if not df_item.empty and "cantidad" in df_item.columns and "fecha" in df_item.columns:
            recientes = df_item.sort_values("fecha", ascending=False).head(180)
            if not recientes.empty:
                consumo_promedio = float(recientes["cantidad"].mean() or 0)
    if stock_total > 0:
        opciones.append(
            {
                "opcion_id": "stock_interno",
                "tipo": "stock",
                "nombre": "Almacén Interno",
                "id_proveedor": "PROV006",
                "codigo_material": codigo_original,
                "descripcion": item.get("descripcion", ""),
                "cantidad_disponible": stock_total,
                "cantidad_solicitada": cantidad_solicitada,
                "plazo_dias": 1,
                "precio_unitario": precio_unitario_original,
                "costo_total": cantidad_solicitada * precio_unitario_original,
                "rating": 5.0,
                "compatibilidad_pct": 100,
                "observaciones": "Entrega inmediata desde almacén interno",
                "detalle_stock": detalle_stock_base,
            }
        )

    proveedores = ProveedorRepository.list_externos_activos()
    for prov in proveedores[:3]:  # Top 3
        opciones.append(
            _build_proveedor_option(
                prov, codigo_original, item, cantidad_solicitada, precio_unitario_original
            )
        )

    catalogo_eq = get_equivalencias_cache()
    if catalogo_eq is not None and not catalogo_eq.empty:
        df_eq = catalogo_eq[catalogo_eq["codigo_base_norm"] == norm_codigo(codigo_original)]
        for _, row in df_eq.iterrows():
            cod_eq = str(row.get("codigo_equivalente") or "")
            cod_norm = norm_codigo(cod_eq)
            if not cod_norm or cod_norm in equivalencias_norm:
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
                    "opcion_id": f"equivalencia_catalogo_{cod_norm}",
                    "tipo": "equivalencia",
                    "nombre": "Material equivalente (catálogo)",
                    "id_proveedor": "PROV006",
                    "codigo_material": cod_eq,
                    "codigo_original": codigo_original,
                    "descripcion": descripcion_eq,
                    "cantidad_disponible": cantidad_solicitada,
                    "cantidad_solicitada": cantidad_solicitada,
                    "plazo_dias": 1,
                    "precio_unitario": float(precio_equiv),
                    "costo_total": cantidad_solicitada * float(precio_equiv),
                    "rating": 5.0,
                    "compatibilidad_pct": 92,
                    "observaciones": f"Equivalencia por {row.get('criterio', 'atributos')}",
                    "motivo_equivalencia": str(row.get("motivo", "")),
                    "detalle_stock": detalle_stock_base,
                }
            )
            equivalencias_norm.add(cod_norm)

    if stock_total > 0 and stock_total < cantidad_solicitada and proveedores:
        prov = proveedores[0]
        restante = max(cantidad_solicitada - stock_total, 0)
        costo_mix = (stock_total * precio_unitario_original) + (restante * precio_unitario_original)
        opciones.append(
            {
                "opcion_id": "mix_stock_proveedor",
                "tipo": "mix",
                "nombre": "Stock + Proveedor externo",
                "id_proveedor": prov["id_proveedor"],
                "codigo_material": codigo_original,
                "descripcion": item.get("descripcion", ""),
                "cantidad_disponible": cantidad_solicitada,
                "cantidad_solicitada": cantidad_solicitada,
                "plazo_dias": prov.get("plazo_entrega_dias", 0),
                "precio_unitario": precio_unitario_original,
                "costo_total": costo_mix,
                "rating": prov.get("rating", 0),
                "compatibilidad_pct": 98,
                "observaciones": f"Usa {stock_total} de stock + resto proveedor {prov.get('nombre')}",
                "detalle_stock": detalle_stock_base,
            }
        )

    # Calcular scores de recomendación y ordenar opciones
    if opciones:
        # Calcular valores máximos para normalización
        max_precio = max((float(op.get("precio_unitario", 0) or 0) for op in opciones), default=1.0)
        max_plazo = max((float(op.get("plazo_dias", 0) or 0) for op in opciones), default=1.0)

        # Calcular score para cada opción
        for opcion in opciones:
            score = _calcular_score_opcion(opcion, max_precio, max_plazo)
            opcion["score_recomendacion"] = round(score, 2)
            opcion["is_recomendada"] = False  # Se marcará después

        # Ordenar por score descendente (mayor score = mejor opción)
        opciones.sort(key=lambda x: x.get("score_recomendacion", 0), reverse=True)

        # Marcar la mejor opción como recomendada
        if opciones:
            opciones[0]["is_recomendada"] = True

    TratamientoRepository.log_evento(
        solicitud_id,
        item_idx,
        "opciones_consultadas",
        "PASO_2",
        {
            "codigo": codigo_original,
            "cantidad": cantidad_solicitada,
            "opciones_disponibles": len(opciones),
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
            "stock_disponible": stock_total,
            "consumo_promedio": round(consumo_promedio, 2),
            "detalle_stock": detalle_stock_base,
        },
        "opciones": opciones,
    }


def paso_3_guardar_tratamiento(
    solicitud_id: int, decisiones: List[Dict[str, Any]], usuario_id: str
) -> Dict[str, Any]:
    """
    PASO 3: Guardar decisiones de tratamiento
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

    SolicitudRepository.update_status(solicitud_id, "En tratamiento")

    TratamientoRepository.log_evento(
        solicitud_id,
        None,
        "tratamiento_completado",
        "PASO_3",
        {
            "total_decisiones": len(decisiones),
            "decisiones_guardadas": guardadas,
            "usuario": usuario_id,
        },
        actor_id=usuario_id,
    )

    return {
        "solicitud_id": solicitud_id,
        "paso": 3,
        "nombre_paso": "Confirmación y Cierre",
        "total_items": len(decisiones),
        "items_guardados": guardadas,
        "errores": errores,
        "mensaje": (
            f"Tratamiento completado: {guardadas}/{len(decisiones)} items guardados"
            if guardadas > 0
            else "No se guardaron decisiones"
        ),
    }


def _generar_recomendaciones(conflictos: List[Dict], avisos: List[Dict]) -> List[Dict]:
    """Genera recomendaciones basadas en conflictos"""
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
                    "accion": "Solicitar ampliación de presupuesto",
                    "razon": f"Item {conflicto['item_idx']} requiere ${conflicto['costo_item']}",
                }
            )
        elif conflicto["tipo"] == "consumo_inusual":
            recomendaciones.append(
                {
                    "prioridad": "media",
                    "accion": "Verificar consumo histórico",
                    "razon": f"Pedido supera consumo promedio del material {conflicto['codigo']}",
                }
            )

    if len(avisos) > 0:
        recomendaciones.append(
            {
                "prioridad": "media",
                "accion": "Revisar avisos especiales antes de continuar",
                "razon": f"Hay {len(avisos)} avisos que requieren atención",
            }
        )

    return recomendaciones


def _build_proveedor_option(
    prov: Dict[str, Any],
    codigo_original: str,
    item: Dict[str, Any],
    cantidad: float,
    precio_unitario: float,
) -> Dict[str, Any]:
    return {
        "opcion_id": f"proveedor_{prov['id_proveedor']}",
        "tipo": "proveedor",
        "nombre": prov.get("nombre", "Proveedor externo"),
        "id_proveedor": prov["id_proveedor"],
        "codigo_material": codigo_original,
        "descripcion": item.get("descripcion", ""),
        "cantidad_disponible": cantidad,
        "cantidad_solicitada": cantidad,
        "plazo_dias": prov.get("plazo_entrega_dias", 0),
        "precio_unitario": precio_unitario,
        "costo_total": cantidad * precio_unitario,
        "rating": prov.get("rating", 0),
        "compatibilidad_pct": 100,
        "observaciones": f"Proveedor externo - Plazo: {prov.get('plazo_entrega_dias', 0)} días",
    }


def _calcular_score_opcion(opcion: Dict[str, Any], max_precio: float, max_plazo: float) -> float:
    """
    Calcula score de recomendación multi-criterio (0-100)

    Pesos:
    - Costo: 40% (menor costo = mejor)
    - Plazo: 30% (menor plazo = mejor)
    - Rating: 20% (mayor rating = mejor)
    - Compatibilidad: 10% (mayor compatibilidad = mejor)

    Args:
        opcion: Diccionario con datos de la opción
        max_precio: Precio máximo entre todas las opciones (para normalizar)
        max_plazo: Plazo máximo entre todas las opciones (para normalizar)

    Returns:
        Score entre 0 y 100
    """
    score = 0.0

    # Componente 1: Costo (40% peso) - menor costo = mejor
    precio = float(opcion.get("precio_unitario", 0) or 0)
    if max_precio > 0:
        score_costo = (1 - (precio / max_precio)) * 40
        score += score_costo
    else:
        score += 40  # Si todos los precios son 0, dar puntuación máxima

    # Componente 2: Plazo (30% peso) - menor plazo = mejor
    plazo = float(opcion.get("plazo_dias", 0) or 0)
    if max_plazo > 0:
        score_plazo = (1 - (plazo / max_plazo)) * 30
        score += score_plazo
    else:
        score += 30  # Si todos los plazos son 0, dar puntuación máxima

    # Componente 3: Rating (20% peso) - mayor rating = mejor
    rating = float(opcion.get("rating", 0) or 0)
    score_rating = (rating / 5.0) * 20  # Normalizado a 5.0 máximo
    score += score_rating

    # Componente 4: Compatibilidad (10% peso) - mayor compatibilidad = mejor
    compatibilidad = float(opcion.get("compatibilidad_pct", 100) or 100)
    score_compatibilidad = (compatibilidad / 100.0) * 10
    score += score_compatibilidad

    # Bonus: Stock interno tiene bonus adicional de +5 puntos
    if opcion.get("tipo") == "stock":
        score += 5

    # Asegurar que el score esté en rango [0, 100]
    return max(0, min(100, score))
