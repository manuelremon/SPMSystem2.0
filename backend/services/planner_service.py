"""
Servicio de Planner: lógica de negocio PASO 1–3 de tratamiento de solicitud
Separado de rutas para facilitar tests y reutilización

V2: Integración completa de fuentes de datos:
- Proveedores externos con precios negociados
- Proveedores internos (transferencias entre centros)
- Equivalencias desde equivalentes.db
- Parámetros MRP desde sap_data.db
- Decisiones multi-fuente
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Import con manejo de rutas relativas
try:
    from backend.core.cache_loader import get_consumo_cache, get_equivalencias_cache
    from backend.core.repository_legacy import (
        DecisionAbastecimientoRepository,
        EquivalenciasRepository,
        MaterialRepository,
        MrpRepository,
        PresupuestoRepository,
        ProveedorExternoRepository,
        ProveedorInternoRepository,
        # Nuevos repositories V2
        ProveedorPreciosRepository,
        ProveedorRepository,
        SolicitudRepository,
        TratamientoRepository,
    )
except ImportError:
    from core.cache_loader import get_consumo_cache, get_equivalencias_cache
    from core.repository_legacy import (
        DecisionAbastecimientoRepository,
        EquivalenciasRepository,
        MaterialRepository,
        MrpRepository,
        PresupuestoRepository,
        ProveedorExternoRepository,
        ProveedorInternoRepository,
        # Nuevos repositories V2
        ProveedorPreciosRepository,
        ProveedorRepository,
        SolicitudRepository,
        TratamientoRepository,
    )


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
    Incluye stock de equivalencias para cálculo correcto de déficit.
    """
    # Soportar ambos keys para compatibilidad (material_id usado por item_schemas, codigo legacy)
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

    # Stock de equivalencias (materiales que pueden sustituir al original)
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

    # Stock total = local + equivalencias
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
        # Soportar ambos keys para compatibilidad
        codigo = (item.get("codigo") or item.get("material_id") or "").strip()
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

        # Calcular presupuesto real necesario (considerando stock local + equivalencias)
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


def paso_2_opciones_abastecimiento(solicitud_id: int, item_idx: int) -> Dict[str, Any]:
    """
    PASO 2: Opciones de abastecimiento para un item (V2 Multi-fuente)

    Genera opciones de 4 tipos:
    - stock: Stock disponible en el mismo centro
    - transferencia: Stock disponible en otros centros (proveedores internos)
    - proveedor: Proveedores externos con precios negociados
    - equivalencia: Materiales equivalentes desde equivalentes.db

    Retorna todas las opciones disponibles para que el usuario pueda
    seleccionar múltiples fuentes con cantidades editables.
    """
    solicitud = SolicitudRepository.get_by_id(solicitud_id)
    if not solicitud:
        raise ValueError(f"Solicitud {solicitud_id} no encontrada")

    items = SolicitudRepository.get_items(solicitud_id)
    if item_idx >= len(items):
        raise ValueError(f"Item index {item_idx} fuera de rango")

    item = items[item_idx]
    # Soportar ambos keys para compatibilidad
    codigo_original = item.get("codigo") or item.get("material_id") or ""
    cantidad_solicitada = float(item.get("cantidad", 0) or 0)
    precio_unitario_original = float(item.get("precio_unitario", 0) or 0)
    centro_solicitud = solicitud.get("centro", "")
    almacen_solicitud = solicitud.get("almacen_virtual") or solicitud.get("almacen", "")

    opciones = []

    # =========================================================================
    # 1. STOCK LOCAL (mismo centro)
    # =========================================================================
    detalle_stock_base = (
        MaterialRepository.get_stock_detalle(
            codigo_original,
            centro_solicitud,
            almacen_solicitud,
        )
        or []
    )
    stock_total_local = sum(float(d.get("cantidad") or 0) for d in detalle_stock_base)

    # Calcular consumo histórico promedio
    consumo_df = get_consumo_cache()
    consumo_promedio = 0
    if consumo_df is not None and not consumo_df.empty:
        df_item = consumo_df[consumo_df["codigo_norm"] == norm_codigo(codigo_original)]
        if not df_item.empty and "cantidad" in df_item.columns and "fecha" in df_item.columns:
            recientes = df_item.sort_values("fecha", ascending=False).head(180)
            if not recientes.empty:
                consumo_promedio = float(recientes["cantidad"].mean() or 0)

    # Agregar opción de stock local si hay disponible
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
                "costo_total": min(cantidad_solicitada, stock_total_local)
                * precio_unitario_original,
                "rating": 5.0,
                "compatibilidad_pct": 100,
                "observaciones": "Entrega inmediata desde almacén local",
                "detalle_stock": detalle_stock_base,
                "mismo_centro": True,
            }
        )

    # =========================================================================
    # 2. TRANSFERENCIAS (otros centros con stock)
    # =========================================================================
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
                    "precio_unitario": precio_unitario_original,  # Sin costo adicional
                    "costo_total": min(cantidad_solicitada, t["stock_disponible"])
                    * precio_unitario_original,
                    "rating": 4.5,  # Alto por ser interno
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

    # =========================================================================
    # 3. PROVEEDORES EXTERNOS (con precios negociados)
    # =========================================================================
    try:
        # Primero usar tabla nueva proveedores_externos
        proveedores_ext = ProveedorExternoRepository.list_activos_con_contacto()

        for prov in proveedores_ext:
            # Buscar precio negociado
            precio_info = ProveedorPreciosRepository.get_precio_vigente(
                prov["cuit"], codigo_original
            )
            precio_final = precio_info["precio_usd"] if precio_info else precio_unitario_original
            es_negociado = precio_info is not None

            # Convertir calificación a rating numérico
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
                    "cantidad_disponible": cantidad_solicitada,  # Disponibilidad bajo pedido
                    "cantidad_solicitada": cantidad_solicitada,
                    "disponibilidad_bajo_pedido": True,  # B1: Flag para indicar que es bajo pedido
                    "plazo_dias": prov.get("lead_time_dias") or 30,
                    "precio_unitario": precio_final,
                    "precio_es_negociado": es_negociado,
                    "costo_total": cantidad_solicitada * precio_final,
                    "rating": rating,
                    "calificacion": calificacion,  # Agregar calificación para scoring
                    "compatibilidad_pct": 100,
                    "observaciones": f"Proveedor externo - {prov.get('rubro', 'General')}",
                    "rubro": prov.get("rubro"),
                    "contacto": {
                        "email": prov.get("email_principal"),
                        "telefono": prov.get("telefono_principal"),
                    },
                }
            )

        # Fallback a tabla legacy si no hay proveedores externos
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

    # =========================================================================
    # 4. EQUIVALENCIAS (desde equivalentes.db)
    # =========================================================================
    equivalencias_agregadas = set()
    try:
        # Intentar BD de equivalencias primero
        equivalencias_db = EquivalenciasRepository.get_equivalencias_con_score(codigo_original)
        for eq in equivalencias_db:
            cod_eq = eq.get("codigo_equivalente", "")
            cod_norm = norm_codigo(cod_eq)
            if not cod_norm or cod_norm in equivalencias_agregadas:
                continue

            # Verificar stock del equivalente
            stock_eq_detalle = (
                MaterialRepository.get_stock_detalle(cod_eq, centro_solicitud, None) or []
            )
            stock_eq = sum(float(d.get("cantidad") or 0) for d in stock_eq_detalle)
            if stock_eq <= 0:
                continue  # Solo mostrar si hay stock

            # Obtener info del material equivalente
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
                    "plazo_dias": 1,  # Stock interno
                    "precio_unitario": precio_equiv,
                    "costo_total": min(cantidad_solicitada, stock_eq) * precio_equiv,
                    "rating": 4.8,
                    "compatibilidad_pct": eq.get("compatibilidad_pct", 85),
                    "tipo_equivalencia": eq.get("tipo_equiv", "E1_ESTRICTA"),
                    "criterio": eq.get("criterio", ""),
                    "motivo_equivalencia": eq.get("motivo_equivalencia", ""),
                    "observaciones": f"Equivalencia {eq.get('tipo_equiv', '')} - {eq.get('criterio', 'técnica')}",
                    "detalle_stock": stock_eq_detalle,
                }
            )
            equivalencias_agregadas.add(cod_norm)

        # Fallback a Excel cache si no hay en BD
        if not equivalencias_db:
            catalogo_eq = get_equivalencias_cache()
            if catalogo_eq is not None and not catalogo_eq.empty:
                df_eq = catalogo_eq[catalogo_eq["codigo_base_norm"] == norm_codigo(codigo_original)]
                for _, row in df_eq.head(5).iterrows():
                    cod_eq = str(row.get("codigo_equivalente") or "")
                    cod_norm = norm_codigo(cod_eq)
                    if not cod_norm or cod_norm in equivalencias_agregadas:
                        continue

                    descripcion_eq = row.get("descripcion_equivalente") or item.get(
                        "descripcion", ""
                    )
                    precio_equiv = precio_unitario_original

                    try:
                        mat_info = MaterialRepository.get_info(cod_eq)
                        if mat_info:
                            descripcion_eq = mat_info.get("descripcion", descripcion_eq)
                            precio_equiv = float(
                                mat_info.get("precio_usd", precio_equiv) or precio_equiv
                            )
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

    # =========================================================================
    # 5. INFORMACIÓN MRP
    # =========================================================================
    mrp_info = None
    mrp_alertas = []
    try:
        mrp_params = MrpRepository.get_parametros_mrp(codigo_original, centro_solicitud)
        if mrp_params:
            # Evaluar alertas MRP
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

    # =========================================================================
    # 6. CALCULAR SCORES Y ORDENAR
    # =========================================================================
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

    # =========================================================================
    # 7. OBTENER DECISIÓN PREVIA (si existe)
    # =========================================================================
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
        "multi_fuente": True,  # Indicador de que soporta selección múltiple
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

    # Actualizar estado: "Tratado" SOLO si todas las decisiones fueron guardadas sin errores,
    # "En tratamiento" si hubo errores parciales (no marcar como completado con errores)
    hay_errores = len(errores) > 0
    nuevo_estado = "Tratado" if guardadas == len(decisiones) and not hay_errores else "En tratamiento"
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
        "nombre_paso": "Confirmación y Cierre",
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
    Calcula score de recomendación multi-criterio (0-100) - VERSIÓN LEGACY

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


def _calcular_score_opcion_v2(opcion: Dict[str, Any], max_precio: float, max_plazo: float) -> float:
    """
    Score V2 con más factores para el nuevo modelo multi-fuente.

    Pesos base (70%):
    - Costo: 35% (menor costo = mejor)
    - Plazo: 25% (menor plazo = mejor)
    - Rating: 10% (mayor rating = mejor)

    Nuevos factores (30%):
    - Compatibilidad: 15% (dinámico para equivalencias)
    - Disponibilidad: 10% (cubre cantidad solicitada)
    - Tipo preferido: 5% (stock > transferencia > proveedor)

    Bonus adicionales:
    - Stock local del mismo centro: +5
    - Precio negociado: +3
    - Transferencia interna: +2
    """
    score = 0.0

    # Componente 1: Costo (35% peso)
    precio = float(opcion.get("precio_unitario", 0) or 0)
    if max_precio > 0:
        score += (1 - (precio / max_precio)) * 35
    else:
        score += 35

    # Componente 2: Plazo (25% peso)
    plazo = float(opcion.get("plazo_dias", 0) or 0)
    if max_plazo > 0:
        score += (1 - (plazo / max_plazo)) * 25
    else:
        score += 25

    # Componente 3: Rating (10% peso)
    rating = float(opcion.get("rating", 0) or 0)
    score += (rating / 5.0) * 10

    # Componente 4: Compatibilidad (15% peso) - dinámico para equivalencias
    compatibilidad = float(opcion.get("compatibilidad_pct", 100) or 100)
    score += (compatibilidad / 100.0) * 15

    # Componente 5: Disponibilidad (10% peso)
    cantidad_disponible = float(opcion.get("cantidad_disponible", 0) or 0)
    cantidad_solicitada = float(opcion.get("cantidad_solicitada", 1) or 1)
    if cantidad_solicitada > 0:
        cobertura = min(cantidad_disponible / cantidad_solicitada, 1.0)
        score += cobertura * 10

    # Componente 6: Tipo preferido (5% peso)
    tipo_scores = {
        "stock": 5,
        "transferencia": 4,
        "equivalencia": 3,
        "proveedor": 2,
        "mix": 1,
    }
    score += tipo_scores.get(opcion.get("tipo", ""), 0)

    # BONUS: Stock local del mismo centro
    if opcion.get("tipo") == "stock" and opcion.get("mismo_centro"):
        score += 5

    # BONUS: Precio negociado
    if opcion.get("precio_es_negociado"):
        score += 3

    # BONUS: Transferencia interna (preferir interno sobre externo)
    if opcion.get("tipo") == "transferencia":
        score += 2

    # G2: PENALIZACIÓN por proveedor incumplidor
    if opcion.get("calificacion") == "incumplidor":
        score -= 5

    return max(0, min(100, score))


# =============================================================================
# FUNCIONES PARA DECISIONES MULTI-FUENTE
# =============================================================================


def guardar_decision_multifuente(
    solicitud_id: int,
    item_idx: int,
    cantidad_solicitada: float,
    fuentes: List[Dict[str, Any]],
    planner_id: str,
    comentario: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Guarda una decisión de abastecimiento con múltiples fuentes.

    Args:
        solicitud_id: ID de la solicitud
        item_idx: Índice del item
        cantidad_solicitada: Cantidad total solicitada
        fuentes: Lista de fuentes seleccionadas con cantidades
        planner_id: ID del planificador
        comentario: Comentario opcional

    Returns:
        Diccionario con la decisión guardada y sus fuentes
    """
    # Crear o actualizar la cabecera de decisión
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

    # Obtener decisión actualizada
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
    """
    Obtiene resumen de todas las decisiones de una solicitud.
    """
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
