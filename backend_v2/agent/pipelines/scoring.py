"""
Pipeline para sistema de puntuación y priorización.

Calcula puntuaciones para solicitudes y materiales.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ScoringPipeline:
    """
    Pipeline para calcular puntuaciones de priorización.

    Características:
    - Scoring de solicitudes por urgencia, presupuesto, complejidad
    - Scoring de materiales por demanda, disponibilidad, costo
    - Ponderación configurable
    - Ranking y priorización automática
    """

    def __init__(self):
        """Inicializa el pipeline de scoring."""
        self.weights = {
            "criticidad": 0.3,
            "fecha_urgencia": 0.25,
            "monto": 0.2,
            "complejidad": 0.15,
            "impacto": 0.1,
        }
        self.material_weights = {
            "demanda": 0.35,
            "disponibilidad": 0.25,
            "costo": 0.2,
            "rotacion": 0.2,
        }

    def score_solicitud(
        self, solicitud: Dict[str, Any], presupuesto_disponible: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calcula puntuación para una solicitud.

        Args:
            solicitud: Datos de la solicitud
            presupuesto_disponible: Presupuesto disponible (opcional)

        Returns:
            Diccionario con puntuaciones y ranking
        """
        try:
            scores = {}

            # Score de criticidad
            criticidad = solicitud.get("criticidad", "Normal")
            scores["criticidad"] = 1.0 if criticidad == "Alta" else 0.5

            # Score de urgencia (días para necesidad)
            fecha_necesidad = solicitud.get("fecha_necesidad")
            if fecha_necesidad:
                try:
                    fecha_nec = datetime.fromisoformat(fecha_necesidad)
                    dias_restantes = (fecha_nec - datetime.now()).days
                    scores["fecha_urgencia"] = self._urgency_score(dias_restantes)
                except:
                    scores["fecha_urgencia"] = 0.5
            else:
                scores["fecha_urgencia"] = 0.5

            # Score de monto
            total_monto = float(solicitud.get("total_monto", 0))
            max_monto = 100000.0  # Umbral de referencia
            scores["monto"] = min(total_monto / max_monto, 1.0)

            # Score de complejidad (número de items)
            data_json = solicitud.get("data_json", {})
            n_items = len(data_json.get("items", []))
            scores["complejidad"] = min(n_items / 20, 1.0)  # Max 20 items

            # Score de impacto (aproximado)
            scores["impacto"] = 0.5  # Default

            # Calcular score total ponderado
            total_score = sum(scores.get(key, 0) * weight for key, weight in self.weights.items())

            result = {
                "solicitud_id": solicitud.get("id"),
                "scores": scores,
                "total_score": float(total_score),
                "normalized_score": float(total_score),  # 0-1
                "priority_level": self._get_priority_level(total_score),
                "weights_used": self.weights,
            }

            # Ajustar por presupuesto si está disponible
            if presupuesto_disponible is not None:
                if total_monto > presupuesto_disponible:
                    result["presupuesto_ajuste"] = -0.2
                    result["total_score"] -= 0.2
                    result["puede_procesarse"] = False
                else:
                    result["puede_procesarse"] = True

            return result

        except Exception as e:
            logger.error(f"Error calculando score de solicitud: {e}")
            raise

    def score_material(
        self,
        material: Dict[str, Any],
        demanda_historica: float = 50.0,
        disponibilidad: float = 1.0,
        tiempo_entrega_dias: int = 7,
    ) -> Dict[str, Any]:
        """
        Calcula puntuación para un material.

        Args:
            material: Datos del material
            demanda_historica: Demanda histórica promedio
            disponibilidad: Disponibilidad (0-1)
            tiempo_entrega_dias: Días de entrega

        Returns:
            Diccionario con puntuaciones
        """
        try:
            scores = {}

            # Score de demanda
            max_demanda = 1000.0
            scores["demanda"] = min(demanda_historica / max_demanda, 1.0)

            # Score de disponibilidad
            scores["disponibilidad"] = disponibilidad

            # Score de costo
            precio = float(material.get("precio_usd", 0))
            max_precio = 10000.0
            scores["costo"] = 1.0 - min(precio / max_precio, 1.0)  # Inverso: menor precio = mejor

            # Score de rotación (tiempo de entrega)
            scores["rotacion"] = 1.0 - min(tiempo_entrega_dias / 30, 1.0)

            # Score total
            total_score = sum(
                scores.get(key, 0) * weight for key, weight in self.material_weights.items()
            )

            return {
                "material_codigo": material.get("codigo"),
                "descripcion": material.get("descripcion"),
                "scores": scores,
                "total_score": float(total_score),
                "priority": self._get_priority_level(total_score),
                "recomendacion": self._get_material_recommendation(total_score),
            }

        except Exception as e:
            logger.error(f"Error calculando score de material: {e}")
            raise

    def rank_solicitudes(self, solicitudes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Rankea múltiples solicitudes.

        Args:
            solicitudes: Lista de solicitudes

        Returns:
            Solicitudes rankeadas
        """
        try:
            scored_solicitudes = []

            for solicitud in solicitudes:
                score_result = self.score_solicitud(solicitud)
                scored_solicitudes.append(score_result)

            # Ordenar por score descendente
            sorted_solicitudes = sorted(
                scored_solicitudes, key=lambda x: x["total_score"], reverse=True
            )

            # Agregar ranking
            for idx, item in enumerate(sorted_solicitudes):
                item["rank"] = idx + 1

            return {
                "total_solicitudes": len(solicitudes),
                "solicitudes_rankeadas": sorted_solicitudes,
                "criterios": self.weights,
                "fecha_ranking": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error rankeando solicitudes: {e}")
            raise

    def rank_materiales(self, materiales: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Rankea múltiples materiales.

        Args:
            materiales: Lista de materiales

        Returns:
            Materiales rankeados
        """
        try:
            scored_materiales = []

            for material in materiales:
                score_result = self.score_material(material)
                scored_materiales.append(score_result)

            # Ordenar por score
            sorted_materiales = sorted(
                scored_materiales, key=lambda x: x["total_score"], reverse=True
            )

            # Agregar ranking
            for idx, item in enumerate(sorted_materiales):
                item["rank"] = idx + 1

            return {
                "total_materiales": len(materiales),
                "materiales_rankeados": sorted_materiales,
                "criterios": self.material_weights,
            }

        except Exception as e:
            logger.error(f"Error rankeando materiales: {e}")
            raise

    def get_next_priority_solicitud(
        self, solicitudes: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Retorna la siguiente solicitud a procesar.

        Args:
            solicitudes: Lista de solicitudes

        Returns:
            Solicitud con mayor prioridad
        """
        if not solicitudes:
            return None

        ranking = self.rank_solicitudes(solicitudes)
        if ranking["solicitudes_rankeadas"]:
            return ranking["solicitudes_rankeadas"][0]
        return None

    def _urgency_score(self, dias_restantes: int) -> float:
        """
        Calcula score de urgencia basado en días restantes.

        Args:
            dias_restantes: Días hasta la fecha necesaria

        Returns:
            Score 0-1
        """
        if dias_restantes <= 0:
            return 1.0  # Urgente
        elif dias_restantes <= 3:
            return 0.9
        elif dias_restantes <= 7:
            return 0.7
        elif dias_restantes <= 14:
            return 0.5
        elif dias_restantes <= 30:
            return 0.3
        else:
            return 0.1

    def _get_priority_level(self, score: float) -> str:
        """
        Mapea score numérico a nivel de prioridad.

        Args:
            score: Score 0-1

        Returns:
            "crítica", "alta", "media", "baja"
        """
        if score >= 0.8:
            return "crítica"
        elif score >= 0.6:
            return "alta"
        elif score >= 0.4:
            return "media"
        else:
            return "baja"

    def _get_material_recommendation(self, score: float) -> str:
        """
        Recomienda acción para material.

        Args:
            score: Score del material

        Returns:
            Recomendación de acción
        """
        if score >= 0.8:
            return "Aprovisionar inmediatamente"
        elif score >= 0.6:
            return "Priorizar en próximo pedido"
        elif score >= 0.4:
            return "Incluir en próxima compra"
        else:
            return "Incluir solo si hay oportunidad"

    def configure_weights(
        self, weights: Dict[str, float], material_weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Configura pesos personalizados.

        Args:
            weights: Nuevo diccionario de pesos para solicitudes
            material_weights: Nuevo diccionario de pesos para materiales

        Returns:
            Confirmación de configuración
        """
        # Validar que sumen aproximadamente 1.0
        total_weight = sum(weights.values())

        if not 0.9 <= total_weight <= 1.1:
            raise ValueError(f"Los pesos deben sumar ~1.0, actual: {total_weight}")

        self.weights = weights

        if material_weights:
            total_mat = sum(material_weights.values())
            if not 0.9 <= total_mat <= 1.1:
                raise ValueError(f"Pesos de materiales deben sumar ~1.0, actual: {total_mat}")
            self.material_weights = material_weights

        return {
            "status": "configurado",
            "weights": self.weights,
            "material_weights": self.material_weights,
        }

    def get_status(self) -> Dict[str, Any]:
        """Retorna estado del pipeline."""
        return {
            "weights": self.weights,
            "material_weights": self.material_weights,
            "version": "1.0",
        }
