"""
Planner Service - Funciones helper compartidas

Utilidades comunes usadas por los pasos del planificador.
"""

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def norm_codigo(val: str) -> str:
    """Normaliza codigo de material (elimina ceros y .0 finales)"""
    base = (val or "").strip()
    if base.endswith(".0"):
        base = base[:-2]
    return base.lstrip("0")


def _calcular_score_opcion(opcion: Dict[str, Any], max_precio: float, max_plazo: float) -> float:
    """
    Calcula score de recomendacion multi-criterio (0-100) - VERSION LEGACY

    Pesos:
    - Costo: 40% (menor costo = mejor)
    - Plazo: 30% (menor plazo = mejor)
    - Rating: 20% (mayor rating = mejor)
    - Compatibilidad: 10% (mayor compatibilidad = mejor)
    """
    score = 0.0

    # Componente 1: Costo (40% peso) - menor costo = mejor
    precio = float(opcion.get("precio_unitario", 0) or 0)
    if max_precio > 0:
        score_costo = (1 - (precio / max_precio)) * 40
        score += score_costo
    else:
        score += 40

    # Componente 2: Plazo (30% peso) - menor plazo = mejor
    plazo = float(opcion.get("plazo_dias", 0) or 0)
    if max_plazo > 0:
        score_plazo = (1 - (plazo / max_plazo)) * 30
        score += score_plazo
    else:
        score += 30

    # Componente 3: Rating (20% peso) - mayor rating = mejor
    rating = float(opcion.get("rating", 0) or 0)
    score_rating = (rating / 5.0) * 20
    score += score_rating

    # Componente 4: Compatibilidad (10% peso) - mayor compatibilidad = mejor
    compatibilidad = float(opcion.get("compatibilidad_pct", 100) or 100)
    score_compatibilidad = (compatibilidad / 100.0) * 10
    score += score_compatibilidad

    # Bonus: Stock interno tiene bonus adicional de +5 puntos
    if opcion.get("tipo") == "stock":
        score += 5

    return max(0, min(100, score))


def _calcular_score_opcion_v2(opcion: Dict[str, Any], max_precio: float, max_plazo: float) -> float:
    """
    Score V2 con mas factores para el nuevo modelo multi-fuente.

    Pesos base (70%):
    - Costo: 35% (menor costo = mejor)
    - Plazo: 25% (menor plazo = mejor)
    - Rating: 10% (mayor rating = mejor)

    Nuevos factores (30%):
    - Compatibilidad: 15% (dinamico para equivalencias)
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

    # Componente 4: Compatibilidad (15% peso)
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

    # BONUS: Transferencia interna
    if opcion.get("tipo") == "transferencia":
        score += 2

    # PENALIZACION por proveedor incumplidor
    if opcion.get("calificacion") == "incumplidor":
        score -= 5

    return max(0, min(100, score))


def _build_proveedor_option(
    prov: Dict[str, Any],
    codigo_original: str,
    item: Dict[str, Any],
    cantidad: float,
    precio_unitario: float,
) -> Dict[str, Any]:
    """Construye opcion de proveedor para paso 2."""
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
        "observaciones": f"Proveedor externo - Plazo: {prov.get('plazo_entrega_dias', 0)} dias",
    }
