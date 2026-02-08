"""
Motor de Recomendaciones de Compra
===================================
Genera recomendaciones inteligentes de compra basadas en múltiples criterios.

Scoring multi-criterio:
- Urgencia (stock < ROP): 40%
- Valor (ABC classification): 30%
- Tendencia (creciente): 20%
- Lead time (corto): 10%

FASE 5 - SPM v3.0
"""
import logging
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RecommendationEngine:
    """
    Motor de recomendaciones de compra con scoring multi-criterio.

    Evalúa:
    - Urgencia: niveles de stock vs ROP
    - Valor: clasificación ABC
    - Tendencia: crecimiento/decrecimiento de consumo
    - Lead time: tiempo de entrega vs días de cobertura
    """

    def __init__(self):
        self.criterios_pesos = {
            'urgencia': 0.40,
            'valor': 0.30,
            'tendencia': 0.20,
            'lead_time': 0.10
        }

    def calcular_score_urgencia(
        self,
        stock_actual: float,
        rop: float,
        demanda_promedio: float,
        demanda_std: float
    ) -> float:
        """
        Calcula score de urgencia (0-1).
        Mayor = más urgente comprar.

        Args:
            stock_actual: Stock actual
            rop: Punto de reorden (Reorder Point)
            demanda_promedio: Consumo promedio diario
            demanda_std: Desviación estándar del consumo

        Returns:
            Score de urgencia (0-1)
        """
        if stock_actual <= 0:
            return 1.0  # Crítico

        # Días de cobertura
        if demanda_promedio > 0:
            dias_cobertura = stock_actual / demanda_promedio
        else:
            dias_cobertura = 365.0

        # ROP en días
        if demanda_promedio > 0:
            rop_dias = rop / demanda_promedio
        else:
            rop_dias = 30.0

        # Score: qué tan bajo estamos del ROP
        if dias_cobertura >= rop_dias * 2:
            score = 0.0  # Abundante
        elif dias_cobertura >= rop_dias:
            score = 0.3  # Suficiente
        elif dias_cobertura >= rop_dias * 0.5:
            score = 0.7  # Bajo
        else:
            score = 1.0  # Crítico

        return score

    def calcular_score_valor(self, abc_clase: str) -> float:
        """
        Calcula score de valor basado en clasificación ABC.

        Args:
            abc_clase: 'A' (20% valor), 'B' (30% valor), 'C' (10% valor)

        Returns:
            Score de valor (0-1)
        """
        mapping = {'A': 1.0, 'B': 0.5, 'C': 0.2}
        return mapping.get(abc_clase, 0.3)

    def calcular_score_tendencia(
        self,
        consumo_historico: List[float]
    ) -> float:
        """
        Calcula score de tendencia (0-1).
        Mayor = consumo está aumentando.

        Args:
            consumo_historico: Lista de consumos recientes (últimos 30 días)

        Returns:
            Score de tendencia (0-1)
        """
        if len(consumo_historico) < 2:
            return 0.5

        consumo_historico = np.array(consumo_historico)

        # Regresión lineal simple
        x = np.arange(len(consumo_historico))
        slope = np.polyfit(x, consumo_historico, 1)[0]

        media = consumo_historico.mean()
        if media > 0:
            slope_norm = slope / media
        else:
            slope_norm = 0

        # Mapear slope a score [0-1]
        # slope_norm < -0.1 = 0.0 (decreciendo)
        # slope_norm = 0.0 = 0.5 (estable)
        # slope_norm > 0.1 = 1.0 (creciendo)

        score = max(0.0, min(1.0, 0.5 + slope_norm * 5))
        return score

    def calcular_score_lead_time(
        self,
        lead_time_dias: int,
        dias_cobertura: float
    ) -> float:
        """
        Calcula score de lead time (0-1).
        Mayor = lead time corto respecto a cobertura.

        Args:
            lead_time_dias: Días de tiempo de entrega
            dias_cobertura: Días que cubre el stock actual

        Returns:
            Score de lead time (0-1)
        """
        if dias_cobertura <= 0:
            return 1.0

        ratio = lead_time_dias / dias_cobertura

        # ratio < 0.5 = 0.0 (lead time es corto vs cobertura)
        # ratio = 1.0 = 0.5 (lead time = cobertura)
        # ratio > 2.0 = 1.0 (lead time es largo)

        score = max(0.0, min(1.0, (ratio - 0.5) / 1.5))
        return score

    def generar_recomendacion(
        self,
        material_codigo: str,
        stock_actual: float,
        rop: float,
        consumo_historico: List[float],
        demanda_promedio: float,
        demanda_std: float,
        abc_clase: str = 'C',
        lead_time_dias: int = 14,
        precio_unitario: float = 0.0,
        cantidad_eoq: float = 0.0
    ) -> Dict:
        """
        Genera una recomendación de compra con desglose de scoring.

        Args:
            material_codigo: Código del material
            stock_actual: Stock actual disponible
            rop: Punto de reorden
            consumo_historico: Últimos 30 días de consumo
            demanda_promedio: Consumo promedio diario
            demanda_std: Desviación estándar
            abc_clase: Clasificación ABC
            lead_time_dias: Tiempo de entrega
            precio_unitario: Precio por unidad
            cantidad_eoq: Cantidad económica de orden (EOQ)

        Returns:
            Dict con recomendación y detalles
        """
        # Calcular scores parciales
        dias_cobertura = stock_actual / max(demanda_promedio, 0.01)

        score_urgencia = self.calcular_score_urgencia(
            stock_actual, rop, demanda_promedio, demanda_std
        )
        score_valor = self.calcular_score_valor(abc_clase)
        score_tendencia = self.calcular_score_tendencia(consumo_historico)
        score_lead_time = self.calcular_score_lead_time(lead_time_dias, dias_cobertura)

        # Calcular score total
        score_total = (
            score_urgencia * self.criterios_pesos['urgencia'] +
            score_valor * self.criterios_pesos['valor'] +
            score_tendencia * self.criterios_pesos['tendencia'] +
            score_lead_time * self.criterios_pesos['lead_time']
        )

        # Estimar cantidad a comprar
        cantidad_sugerida = max(
            int(rop * 2 - stock_actual),  # Comprar hasta 2*ROP
            int(cantidad_eoq) if cantidad_eoq > 0 else int(demanda_promedio * 30)
        )

        # Justificación
        justificaciones = []

        if score_urgencia > 0.6:
            justificaciones.append(f"Stock bajo ({dias_cobertura:.1f} días de cobertura)")

        if score_tendencia > 0.6:
            justificaciones.append("Tendencia de consumo creciente")

        if score_valor > 0.6:
            justificaciones.append(f"Material clasificación {abc_clase} (alto valor)")

        if score_lead_time > 0.5:
            justificaciones.append(f"Lead time largo ({lead_time_dias} días)")

        if not justificaciones:
            justificaciones.append("Recomendación de compra preventiva")

        return {
            'material': material_codigo,
            'score_total': float(score_total),
            'desglose_scores': {
                'urgencia': float(score_urgencia),
                'valor': float(score_valor),
                'tendencia': float(score_tendencia),
                'lead_time': float(score_lead_time)
            },
            'cantidad_sugerida': cantidad_sugerida,
            'precio_estimado': float(cantidad_sugerida * precio_unitario),
            'dias_cobertura': float(dias_cobertura),
            'stock_actual': float(stock_actual),
            'rop': float(rop),
            'abc_clase': abc_clase,
            'justificacion': justificaciones,
            'urgencia_texto': self._urgencia_a_texto(score_urgencia),
            'creada_at': datetime.now().isoformat()
        }

    def generar_top_recomendaciones(
        self,
        materiales: List[Dict],
        limit: int = 10
    ) -> List[Dict]:
        """
        Genera top-N recomendaciones ordenadas por score.

        Args:
            materiales: Lista de dicts con info de materiales
            limit: Número máximo de recomendaciones

        Returns:
            Lista de recomendaciones ordenadas por score
        """
        recomendaciones = []

        for mat in materiales:
            try:
                rec = self.generar_recomendacion(
                    material_codigo=mat.get('codigo', 'UNKNOWN'),
                    stock_actual=float(mat.get('stock_actual', 0)),
                    rop=float(mat.get('rop', 0)),
                    consumo_historico=mat.get('consumo_historico', [0] * 30),
                    demanda_promedio=float(mat.get('demanda_promedio', 1)),
                    demanda_std=float(mat.get('demanda_std', 0)),
                    abc_clase=mat.get('abc_clase', 'C'),
                    lead_time_dias=int(mat.get('lead_time_dias', 14)),
                    precio_unitario=float(mat.get('precio_unitario', 0)),
                    cantidad_eoq=float(mat.get('cantidad_eoq', 0))
                )
                recomendaciones.append(rec)
            except Exception as e:
                logger.warning(f"Error en recomendación de {mat.get('codigo')}: {e}")

        # Ordenar por score
        recomendaciones.sort(key=lambda x: x['score_total'], reverse=True)

        return recomendaciones[:limit]

    @staticmethod
    def _urgencia_a_texto(score: float) -> str:
        """Convierte score a texto descriptivo"""
        if score < 0.25:
            return "Baja"
        elif score < 0.5:
            return "Media"
        elif score < 0.75:
            return "Alta"
        else:
            return "Crítica"


def obtener_recomendaciones_material(
    material_codigo: str,
    centro: str = "1000"
) -> Dict:
    """
    Función de conveniencia para obtener recomendaciones de un material.

    Args:
        material_codigo: Código del material
        centro: Centro de distribución

    Returns:
        Dict con recomendación
    """
    try:
        from backend.core.db import get_db_connection, is_using_postgresql
        import pandas as pd

        engine = RecommendationEngine()

        # Obtener datos del material
        with get_db_connection("spm" if is_using_postgresql() else "sap_data") as conn:
            # Stock actual
            cursor = conn.cursor()
            cursor.execute(
                "SELECT cantidad FROM stock_actual WHERE material = ? AND centro = ?",
                (material_codigo, centro)
            )
            row = cursor.fetchone()
            stock_actual = row[0] if row else 0.0

            # Histórico de consumo
            df_consumo = pd.read_sql_query(
                """
                SELECT cantidad FROM consumo_historico
                WHERE material = ? AND centro = ?
                ORDER BY fecha_doc DESC LIMIT 30
                """,
                conn,
                params=[material_codigo, centro]
            )

        if len(df_consumo) == 0:
            return {'ok': False, 'error': 'Sin datos históricos'}

        consumo_historico = df_consumo['cantidad'].tolist()
        demanda_promedio = np.mean(consumo_historico)
        demanda_std = np.std(consumo_historico)

        # Estimar ROP (media + 2*std)
        rop = demanda_promedio + 2 * demanda_std

        rec = engine.generar_recomendacion(
            material_codigo=material_codigo,
            stock_actual=stock_actual,
            rop=rop,
            consumo_historico=consumo_historico,
            demanda_promedio=demanda_promedio,
            demanda_std=demanda_std,
            abc_clase='A',  # TODO: obtener de BD
            lead_time_dias=14
        )

        return {'ok': True, 'data': rec}

    except Exception as e:
        logger.error(f"Error en recomendaciones: {e}")
        return {'ok': False, 'error': str(e)}
