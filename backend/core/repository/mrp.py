"""
Repositorio para parámetros MRP
"""

import logging
from typing import Any, Dict, List, Optional

from backend.core.repository.base import _connect_sap_data

logger = logging.getLogger(__name__)


class MrpRepository:
    """Repositorio para parámetros MRP desde sap_data.db"""

    @staticmethod
    def get_parametros_mrp(codigo_material: str, centro: str) -> Optional[Dict[str, Any]]:
        """Obtiene parámetros MRP desde sap_data.db"""
        conn_sap = _connect_sap_data()
        try:
            cur = conn_sap.cursor()
            # Buscar tabla MRP
            cur.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type='table' AND (name LIKE '%%mrp%%' OR name LIKE '%%param%%')
            """
            )
            mrp_tables = [row[0] for row in cur.fetchall()]

            if not mrp_tables:
                return None

            # Intentar con la primera tabla MRP encontrada
            for table in mrp_tables:
                try:
                    cur.execute(f"PRAGMA table_info({table})")
                    columns = {row[1].lower() for row in cur.fetchall()}

                    if "material" in columns or "codigo" in columns:
                        material_col = "material" if "material" in columns else "codigo"
                        centro_col = "centro" if "centro" in columns else None

                        if centro_col:
                            cur.execute(
                                f"SELECT * FROM {table} WHERE {material_col} = ? AND {centro_col} = ?",
                                (codigo_material, centro),
                            )
                        else:
                            cur.execute(
                                f"SELECT * FROM {table} WHERE {material_col} = ?",
                                (codigo_material,),
                            )

                        row = cur.fetchone()
                        if row:
                            row_dict = dict(row)
                            return {
                                "punto_pedido": row_dict.get(
                                    "punto_pedido", row_dict.get("pto_pedido", 0)
                                ),
                                "stock_seguridad": row_dict.get(
                                    "stock_seguridad", row_dict.get("stk_seg", 0)
                                ),
                                "stock_maximo": row_dict.get(
                                    "stock_maximo", row_dict.get("stk_max", 0)
                                ),
                                "lote_pedido": row_dict.get("lote_pedido", row_dict.get("lote", 0)),
                                "lead_time": row_dict.get(
                                    "lead_time", row_dict.get("plazo_entrega", 0)
                                ),
                            }
                except Exception as e:
                    logger.debug(f"Error consultando tabla {table}: {e}")
                    continue
        except Exception as e:
            logger.warning(f"Error obteniendo parámetros MRP: {e}")
        finally:
            conn_sap.close()

        return None

    @staticmethod
    def get_pedidos_en_curso(codigo_material: str, centro: str) -> List[Dict[str, Any]]:
        """Lista pedidos pendientes de recepción"""
        conn_sap = _connect_sap_data()
        pedidos = []
        try:
            cur = conn_sap.cursor()
            # Buscar tabla de pedidos
            cur.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type='table' AND (name LIKE '%%pedido%%' OR name LIKE '%%orden%%')
            """
            )
            pedido_tables = [row[0] for row in cur.fetchall()]

            for table in pedido_tables:
                try:
                    cur.execute(f"PRAGMA table_info({table})")
                    columns = {row[1].lower() for row in cur.fetchall()}

                    if "material" in columns or "codigo" in columns:
                        material_col = "material" if "material" in columns else "codigo"
                        cur.execute(
                            f"""
                            SELECT * FROM {table}
                            WHERE {material_col} = ?
                            ORDER BY fecha_entrega
                            LIMIT 10
                        """,
                            (codigo_material,),
                        )
                        for row in cur.fetchall():
                            pedidos.append(dict(row))
                        break
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Error obteniendo pedidos en curso: {e}")
        finally:
            conn_sap.close()

        return pedidos

    @staticmethod
    def get_consumo_historico(codigo_material: str, centro: str, meses: int = 12) -> Dict[str, Any]:
        """Obtiene consumo histórico promedio"""
        conn_sap = _connect_sap_data()
        try:
            cur = conn_sap.cursor()
            # Buscar tabla de consumo
            cur.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type='table' AND name LIKE '%%consumo%%'
            """
            )
            consumo_tables = [row[0] for row in cur.fetchall()]

            for table in consumo_tables:
                try:
                    cur.execute(f"PRAGMA table_info({table})")
                    columns = {row[1].lower() for row in cur.fetchall()}

                    if "material" in columns or "codigo" in columns:
                        material_col = "material" if "material" in columns else "codigo"
                        cur.execute(
                            f"""
                            SELECT AVG(cantidad) as promedio, SUM(cantidad) as total,
                                   COUNT(*) as registros
                            FROM {table}
                            WHERE {material_col} = ?
                        """,
                            (codigo_material,),
                        )
                        row = cur.fetchone()
                        if row:
                            return {
                                "promedio_mensual": float(row["promedio"] or 0),
                                "total": float(row["total"] or 0),
                                "registros": int(row["registros"] or 0),
                            }
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Error obteniendo consumo histórico: {e}")
        finally:
            conn_sap.close()

        return {"promedio_mensual": 0, "total": 0, "registros": 0}
