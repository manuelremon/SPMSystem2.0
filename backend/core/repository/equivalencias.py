"""
Repositorio para equivalencias de materiales
"""

import logging
from typing import Any, Dict, List

from backend.core.repository.base import _connect, _connect_equivalentes

logger = logging.getLogger(__name__)


class EquivalenciasRepository:
    """Repositorio para equivalencias de materiales desde master_materiales.db"""

    @staticmethod
    def get_equivalencias_con_score(codigo_material: str) -> List[Dict[str, Any]]:
        """
        Obtiene equivalencias desde master_materiales.db - tabla materiales_equivalencias.
        Integra con config_equivalencia_scores para obtener compatibilidad_pct.
        """
        # Primero obtener los scores de configuración
        scores_config = EquivalenciasRepository._get_scores_config()

        conn_equiv = _connect_equivalentes()
        equivalencias = []
        try:
            cur = conn_equiv.cursor()

            # Tabla materiales_equivalencias en master_materiales.db
            cur.execute(
                """
                SELECT material_base, texto_breve_base, material_equivalente,
                       texto_breve_equivalente, tipo_equiv, criterio, motivo_equivalencia
                FROM materiales_equivalencias
                WHERE material_base = ? OR material_equivalente = ?
            """,
                (codigo_material, codigo_material),
            )

            for row in cur.fetchall():
                row_dict = dict(row)

                # Determinar cuál es el equivalente (el que no es el material buscado)
                if row_dict["material_base"] == codigo_material:
                    codigo_equiv = row_dict["material_equivalente"]
                    desc_equiv = row_dict["texto_breve_equivalente"]
                else:
                    codigo_equiv = row_dict["material_base"]
                    desc_equiv = row_dict["texto_breve_base"]

                tipo_equiv = row_dict.get("tipo_equiv") or "E1_ESTRICTA"

                # Obtener compatibilidad desde config
                compatibilidad = scores_config.get(tipo_equiv, 85)

                equivalencias.append(
                    {
                        "codigo_original": codigo_material,
                        "codigo_equivalente": codigo_equiv,
                        "descripcion_equivalente": desc_equiv or "",
                        "tipo_equiv": tipo_equiv,
                        "criterio": row_dict.get("criterio") or "",
                        "motivo_equivalencia": row_dict.get("motivo_equivalencia") or "",
                        "compatibilidad_pct": compatibilidad,
                    }
                )
        except Exception as e:
            logger.warning(f"Error obteniendo equivalencias: {e}")
        finally:
            conn_equiv.close()

        return equivalencias

    @staticmethod
    def _get_scores_config() -> Dict[str, int]:
        """Obtiene configuración de scores desde config_equivalencia_scores"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT tipo_equiv, compatibilidad_pct
                FROM config_equivalencia_scores WHERE activo = 1
            """
            )
            return {row["tipo_equiv"]: row["compatibilidad_pct"] for row in cur.fetchall()}
        except Exception:
            # Valores por defecto si la tabla no existe
            return {"E0_DUPLICADO": 100, "E1_ESTRICTA": 95, "E2_SUPLIBLE": 85}
        finally:
            conn.close()
