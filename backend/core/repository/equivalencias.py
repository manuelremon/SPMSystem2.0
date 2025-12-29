"""
Repositorio para equivalencias de materiales
"""

import logging
from typing import Any, Dict, List

from backend.core.repository.base import _connect, _connect_equivalentes

logger = logging.getLogger(__name__)


class EquivalenciasRepository:
    """Repositorio para equivalencias de materiales desde equivalentes.db"""

    @staticmethod
    def get_equivalencias_con_score(codigo_material: str) -> List[Dict[str, Any]]:
        """
        Obtiene equivalencias desde equivalentes.db con score dinámico.
        Integra con config_equivalencia_scores para obtener compatibilidad_pct.
        """
        # Primero obtener los scores de configuración
        scores_config = EquivalenciasRepository._get_scores_config()

        conn_equiv = _connect_equivalentes()
        equivalencias = []
        try:
            cur = conn_equiv.cursor()
            # Intentar diferentes estructuras de tabla
            cur.execute(
                """
                SELECT name FROM sqlite_master WHERE type='table'
            """
            )
            tables = [row[0] for row in cur.fetchall()]

            # Buscar tabla de equivalencias
            equiv_table = None
            for t in tables:
                if "equiv" in t.lower():
                    equiv_table = t
                    break

            if not equiv_table:
                logger.warning("No se encontró tabla de equivalencias en equivalentes.db")
                return []

            # Obtener columnas de la tabla
            cur.execute(f"PRAGMA table_info({equiv_table})")
            columns = {row[1].lower() for row in cur.fetchall()}

            # Construir query según columnas disponibles
            if "codigo_original" in columns and "codigo_equivalente" in columns:
                cur.execute(
                    f"""
                    SELECT * FROM {equiv_table}
                    WHERE codigo_original = ? OR codigo_equivalente = ?
                """,
                    (codigo_material, codigo_material),
                )
            elif "material" in columns and "equivalente" in columns:
                cur.execute(
                    f"""
                    SELECT * FROM {equiv_table}
                    WHERE material = ? OR equivalente = ?
                """,
                    (codigo_material, codigo_material),
                )
            else:
                # Query genérica
                cur.execute(f"SELECT * FROM {equiv_table} LIMIT 100")

            for row in cur.fetchall():
                row_dict = dict(row)
                # Normalizar campos
                codigo_equiv = row_dict.get("codigo_equivalente", row_dict.get("equivalente", ""))
                tipo_equiv = row_dict.get("tipo_equiv", row_dict.get("tipo", "E1_ESTRICTA"))

                # Obtener compatibilidad desde config
                compatibilidad = scores_config.get(tipo_equiv, 85)

                equivalencias.append(
                    {
                        "codigo_original": codigo_material,
                        "codigo_equivalente": codigo_equiv,
                        "descripcion_equivalente": row_dict.get(
                            "descripcion", row_dict.get("desc_equivalente", "")
                        ),
                        "tipo_equiv": tipo_equiv,
                        "criterio": row_dict.get("criterio", ""),
                        "motivo_equivalencia": row_dict.get("motivo", row_dict.get("notas", "")),
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
