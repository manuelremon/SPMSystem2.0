"""
Repositorios para operaciones de Proveedores
"""

import logging
from typing import Any, Dict, List, Optional

from backend.core.db import is_using_postgresql
from backend.core.repository.base import _connect, _connect_sap_data
from backend.core.repository.config import ConfigAlmacenesRepository

logger = logging.getLogger(__name__)


class ProveedorRepository:
    """Repositorio para operaciones de Proveedor"""

    @staticmethod
    def list_externos_activos() -> List[Dict[str, Any]]:
        """Lista proveedores externos y activos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id_proveedor, nombre, plazo_entrega_dias, rating
                FROM proveedores
                WHERE tipo = 'externo' AND activo = 1
            """
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()


class ProveedorPreciosRepository:
    """Repositorio para precios negociados con proveedores externos"""

    @staticmethod
    def get_precio_vigente(cuit: str, codigo_material: str) -> Optional[Dict[str, Any]]:
        """Obtiene precio negociado vigente para proveedor/material"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, cuit_proveedor, codigo_material, precio_usd, moneda,
                       fecha_vigencia_desde, fecha_vigencia_hasta, condicion_pago,
                       cantidad_minima, notas
                FROM proveedor_precios_negociados
                WHERE cuit_proveedor = ? AND codigo_material = ? AND activo = 1
                  AND fecha_vigencia_desde <= date('now')
                  AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= date('now'))
                ORDER BY fecha_vigencia_desde DESC
                LIMIT 1
            """,
                (cuit, codigo_material),
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def get_mejores_precios(codigo_material: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Top proveedores con mejor precio para un material"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT p.id, p.cuit_proveedor, p.codigo_material, p.precio_usd, p.moneda,
                       p.condicion_pago, p.cantidad_minima, pe.nombre as proveedor_nombre
                FROM proveedor_precios_negociados p
                LEFT JOIN proveedores_externos pe ON p.cuit_proveedor = pe.cuit
                WHERE p.codigo_material = ? AND p.activo = 1
                  AND p.fecha_vigencia_desde <= date('now')
                  AND (p.fecha_vigencia_hasta IS NULL OR p.fecha_vigencia_hasta >= date('now'))
                ORDER BY p.precio_usd ASC
                LIMIT ?
            """,
                (codigo_material, limit),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def crear_precio(
        cuit_proveedor: str,
        codigo_material: str,
        precio_usd: float,
        fecha_vigencia_desde: str,
        fecha_vigencia_hasta: Optional[str] = None,
        condicion_pago: Optional[str] = None,
        cantidad_minima: int = 1,
        notas: Optional[str] = None,
    ) -> int:
        """Crea un nuevo precio negociado"""
        conn = _connect()
        try:
            cur = conn.cursor()
            sql = """
                INSERT INTO proveedor_precios_negociados
                (cuit_proveedor, codigo_material, precio_usd, fecha_vigencia_desde,
                 fecha_vigencia_hasta, condicion_pago, cantidad_minima, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = (
                cuit_proveedor,
                codigo_material,
                precio_usd,
                fecha_vigencia_desde,
                fecha_vigencia_hasta,
                condicion_pago,
                cantidad_minima,
                notas,
            )
            if is_using_postgresql():
                sql = sql.replace("?", "%s") + " RETURNING id"
                cur.execute(sql, params)
                row = cur.fetchone()
                new_id = row["id"] if isinstance(row, dict) else row[0]
            else:
                cur.execute(sql, params)
                new_id = cur.lastrowid
            conn.commit()
            return new_id
        finally:
            conn.close()

    @staticmethod
    def listar_por_proveedor(cuit: str) -> List[Dict[str, Any]]:
        """Lista todos los precios de un proveedor"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, cuit_proveedor, codigo_material, precio_usd, moneda,
                       fecha_vigencia_desde, fecha_vigencia_hasta, condicion_pago,
                       cantidad_minima, notas, activo
                FROM proveedor_precios_negociados
                WHERE cuit_proveedor = ?
                ORDER BY codigo_material, fecha_vigencia_desde DESC
            """,
                (cuit,),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()


class ProveedorInternoRepository:
    """Repositorio para proveedores internos (centros/almacenes con stock)"""

    @staticmethod
    def get_opciones_transferencia(
        codigo_material: str, centro_destino: str
    ) -> List[Dict[str, Any]]:
        """
        Lista centros/almacenes con stock disponible para transferir.
        Excluye el centro destino y almacenes excluidos/sin libre disponibilidad.
        """
        # Obtener config de almacenes
        almacenes_config = ConfigAlmacenesRepository.get_all()
        almacenes_excluidos = {
            f"{c['centro']}_{c['almacen']}" for c in almacenes_config if c.get("excluido")
        }

        # Obtener stock de sap_data.db
        conn_sap = _connect_sap_data()
        opciones = []
        try:
            cur_sap = conn_sap.cursor()

            # Normalizar código de material (quitar ceros a la izquierda si es necesario)
            codigo_norm = codigo_material.lstrip("0") if codigo_material else ""

            # Buscar en tabla stock (la tabla principal de sap_data.db)
            cur_sap.execute(
                """
                SELECT centro, almacen, SUM(stock) as stock_disponible
                FROM stock
                WHERE material = ? AND centro != ? AND stock > 0
                GROUP BY centro, almacen
                ORDER BY SUM(stock) DESC
            """,
                (codigo_material, centro_destino),
            )
            rows = cur_sap.fetchall()

            for row in rows:
                centro = str(row["centro"] or "").strip()
                almacen_raw = str(row["almacen"] or "").strip()

                # Excluir registros con centro o almacén vacío
                if not centro or not almacen_raw:
                    continue

                almacen = almacen_raw.zfill(4)
                key = f"{centro}_{almacen}"

                # Excluir almacenes según config
                if key in almacenes_excluidos:
                    continue

                # Obtener info del proveedor interno
                proveedor_info = ProveedorInternoRepository._get_info_centro(centro, almacen)

                opciones.append(
                    {
                        "centro": centro,
                        "almacen": almacen,
                        "stock_disponible": float(row["stock_disponible"]),
                        "centro_nombre": proveedor_info.get("centro_nombre", f"Centro {centro}"),
                        "almacen_nombre": proveedor_info.get(
                            "almacen_nombre", f"Almacén {almacen}"
                        ),
                        "referente_nombre": proveedor_info.get("referente_nombre"),
                        "referente_email": proveedor_info.get("referente_email"),
                        "contacto_centro": proveedor_info.get("contacto_centro"),
                    }
                )
        except Exception as e:
            logger.warning(f"Error obteniendo opciones transferencia: {e}")
        finally:
            conn_sap.close()

        return opciones

    @staticmethod
    def _get_info_centro(centro: str, almacen: str) -> Dict[str, Any]:
        """Obtiene información del centro/almacén desde proveedores_internos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT centro_nombre, almacen_nombre, sector, contacto_centro,
                       responsable_centro, referente_nombre, referente_email
                FROM proveedores_internos
                WHERE centro = ? AND almacen = ?
            """,
                (centro, almacen),
            )
            row = cur.fetchone()
            if row:
                return dict(row)
            # Si no está en proveedores_internos, buscar en catalog_centros
            cur.execute("SELECT nombre FROM catalog_centros WHERE codigo = ?", (centro,))
            centro_row = cur.fetchone()
            return {"centro_nombre": centro_row["nombre"] if centro_row else f"Centro {centro}"}
        finally:
            conn.close()

    @staticmethod
    def get_lead_time_transferencia(centro_origen: str, centro_destino: str) -> int:
        """
        Estima días de transferencia entre centros.
        Por defecto 3 días. Podría parametrizarse en el futuro.
        """
        if centro_origen == centro_destino:
            return 1
        return 3


class ProveedorExternoRepository:
    """Repositorio para proveedores externos con info completa"""

    @staticmethod
    def list_activos_con_contacto() -> List[Dict[str, Any]]:
        """Lista proveedores externos activos con email y teléfono principal"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT pe.cuit, pe.nombre, pe.direccion, pe.localidad, pe.pais, pe.origen,
                       pe.lead_time_dias, pe.rubro, pe.calificacion,
                       (SELECT email FROM proveedor_ext_emails
                        WHERE cuit_proveedor = pe.cuit AND es_principal = true LIMIT 1) as email_principal,
                       (SELECT telefono FROM proveedor_ext_telefonos
                        WHERE proveedor_id = pe.id LIMIT 1) as telefono_principal
                FROM proveedores_externos pe
                WHERE pe.activo = true
                ORDER BY pe.nombre
            """
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def get_by_cuit(cuit: str) -> Optional[Dict[str, Any]]:
        """Obtiene proveedor externo por CUIT con contactos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT * FROM proveedores_externos WHERE cuit = ?
            """,
                (cuit,),
            )
            row = cur.fetchone()
            if not row:
                return None

            proveedor = dict(row)

            # Obtener contactos
            cur.execute(
                """
                SELECT * FROM proveedor_ext_contactos WHERE cuit_proveedor = ?
            """,
                (cuit,),
            )
            proveedor["contactos"] = [dict(r) for r in cur.fetchall()]

            # Obtener emails
            cur.execute(
                """
                SELECT * FROM proveedor_ext_emails WHERE cuit_proveedor = ?
            """,
                (cuit,),
            )
            proveedor["emails"] = [dict(r) for r in cur.fetchall()]

            # Obtener teléfonos
            cur.execute(
                """
                SELECT * FROM proveedor_ext_telefonos WHERE cuit_proveedor = ?
            """,
                (cuit,),
            )
            proveedor["telefonos"] = [dict(r) for r in cur.fetchall()]

            return proveedor
        finally:
            conn.close()
