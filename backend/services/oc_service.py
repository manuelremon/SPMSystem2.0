"""
Servicio de Ordenes de Compra (OC).

Logica de negocio para:
- Creacion de ordenes de compra a partir de solicitudes aprobadas
- Gestion del ciclo de vida (borrador -> aprobada -> enviada -> completada)
- Recepcion de materiales con control de calidad
- Estadisticas y metricas de compras

Tablas involucradas:
- orden_compra: cabecera de la OC
- orden_compra_item: lineas de la OC
- orden_compra_historial: log de cambios de estado
- recepcion: recepciones de materiales
- recepcion_item: items de cada recepcion
"""

import logging
import math
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
    sql_datetime_now,
)
from backend.core.repository.solicitud import SolicitudRepository

logger = logging.getLogger(__name__)

# =============================================================================
# Transiciones de estado validas
# =============================================================================

ESTADO_TRANSICIONES: Dict[str, List[str]] = {
    "borrador": ["pendiente_aprobacion"],
    "pendiente_aprobacion": ["aprobada", "cancelada"],
    "aprobada": ["enviada", "cancelada"],
    "enviada": ["recepcion_parcial", "completada"],
    "recepcion_parcial": ["completada"],
}


def _validar_transicion(estado_actual: str, nuevo_estado: str) -> bool:
    """Valida si la transicion de estado es permitida."""
    destinos = ESTADO_TRANSICIONES.get(estado_actual, [])
    return nuevo_estado in destinos


# =============================================================================
# Generacion de numero de OC
# =============================================================================


def _generar_numero_oc(cursor) -> str:
    """
    Genera numero unico de OC con formato OC-YYYY-NNNNN.

    Consulta el maximo numero existente para el ano actual e incrementa.
    Si no hay ordenes previas para el ano, comienza en OC-YYYY-00001.

    Args:
        cursor: Cursor de base de datos activo.

    Returns:
        Numero de OC formateado (ej: OC-2026-00001).
    """
    year = datetime.now().strftime("%Y")
    prefix = f"OC-{year}-"

    cursor.execute(
        "SELECT numero_oc FROM orden_compra "
        "WHERE numero_oc LIKE ? "
        "ORDER BY numero_oc DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cursor.fetchone()

    if row:
        ultimo = row["numero_oc"]
        try:
            secuencia = int(ultimo.split("-")[-1]) + 1
        except (ValueError, IndexError):
            secuencia = 1
    else:
        secuencia = 1

    return f"{prefix}{secuencia:05d}"


# =============================================================================
# Helpers internos
# =============================================================================


def _generar_numero_recepcion(cursor, numero_oc: str) -> str:
    """
    Genera numero unico de recepcion con formato REC-{OC_NUM}-{SEQ}.

    Args:
        cursor: Cursor de base de datos activo.
        numero_oc: Numero de la OC asociada.

    Returns:
        Numero de recepcion formateado (ej: REC-OC-2026-00001-001).
    """
    prefix = f"REC-{numero_oc}-"
    cursor.execute(
        "SELECT numero_recepcion FROM recepcion "
        "WHERE numero_recepcion LIKE ? "
        "ORDER BY numero_recepcion DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cursor.fetchone()

    if row:
        ultimo = row["numero_recepcion"]
        try:
            secuencia = int(ultimo.split("-")[-1]) + 1
        except (ValueError, IndexError):
            secuencia = 1
    else:
        secuencia = 1

    return f"{prefix}{secuencia:03d}"


def _calcular_monto_total(items: List[Dict[str, Any]]) -> float:
    """Calcula monto total sumando cantidad * precio_unitario de cada item."""
    total = 0.0
    for item in items:
        cantidad = float(item.get("cantidad", 0))
        precio = float(item.get("precio_unitario", 0))
        total += cantidad * precio
    return round(total, 2)


def _registrar_historial(
    cursor,
    orden_id: int,
    estado_anterior: Optional[str],
    estado_nuevo: str,
    actor_id: int,
    razon: Optional[str] = None,
) -> None:
    """Registra entrada en el historial de cambios de la OC."""
    insert_returning_id(
        cursor,
        """
        INSERT INTO orden_compra_historial
            (orden_compra_id, estado_anterior, estado_nuevo, actor_id, razon)
        VALUES (?, ?, ?, ?, ?)
        """,
        (orden_id, estado_anterior, estado_nuevo, actor_id, razon),
    )


# =============================================================================
# OCService
# =============================================================================


class OCService:
    """
    Servicio para gestion de Ordenes de Compra.

    Maneja el ciclo de vida completo de las OC: creacion, aprobacion,
    envio al proveedor, recepcion de materiales y cierre.
    """

    @staticmethod
    def crear_orden(
        solicitud_id: Optional[int],
        proveedor_cuit: str,
        proveedor_nombre: str,
        centro: str,
        items: List[Dict[str, Any]],
        creado_por: int,
        notas: Optional[str] = None,
        moneda: str = "ARS",
    ) -> Dict[str, Any]:
        """
        Crea una nueva orden de compra.

        Genera un numero de OC automatico con formato OC-YYYY-NNNNN,
        inserta los items asociados y registra la entrada inicial en
        el historial.

        Args:
            solicitud_id: ID de la solicitud origen (puede ser None).
            proveedor_cuit: CUIT del proveedor.
            proveedor_nombre: Razon social del proveedor.
            centro: Centro de costo destino.
            items: Lista de items, cada uno con:
                - material_codigo (str): Codigo del material.
                - material_descripcion (str): Descripcion del material.
                - cantidad (float): Cantidad solicitada (> 0).
                - unidad (str): Unidad de medida.
                - precio_unitario (float): Precio por unidad (>= 0).
            creado_por: ID del usuario que crea la OC.
            notas: Notas u observaciones opcionales.
            moneda: Codigo de moneda (default ARS).

        Returns:
            Dict con la orden creada, incluyendo items y numero_oc.

        Raises:
            ValueError: Si no se proporcionan items o los datos son invalidos.
        """
        if not items:
            raise ValueError("La orden debe tener al menos un item")

        if not proveedor_cuit or not proveedor_cuit.strip():
            raise ValueError("El CUIT del proveedor es requerido")

        if not proveedor_nombre or not proveedor_nombre.strip():
            raise ValueError("El nombre del proveedor es requerido")

        monto_total = _calcular_monto_total(items)

        with get_db_transaction() as conn:
            cursor = conn.cursor()

            numero_oc = _generar_numero_oc(cursor)

            orden_id = insert_returning_id(
                cursor,
                """
                INSERT INTO orden_compra (
                    numero_oc, solicitud_id, proveedor_cuit, proveedor_nombre,
                    centro, estado, monto_total, moneda, notas, creado_por
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    numero_oc,
                    solicitud_id,
                    proveedor_cuit.strip(),
                    proveedor_nombre.strip(),
                    centro,
                    "borrador",
                    monto_total,
                    moneda,
                    notas,
                    creado_por,
                ),
            )

            for idx, item in enumerate(items, start=1):
                cantidad = float(item.get("cantidad", 0))
                precio_unitario = float(item.get("precio_unitario", 0))

                if cantidad <= 0:
                    raise ValueError(
                        f"Item {idx}: la cantidad debe ser mayor a 0"
                    )
                if precio_unitario < 0:
                    raise ValueError(
                        f"Item {idx}: el precio unitario no puede ser negativo"
                    )

                insert_returning_id(
                    cursor,
                    """
                    INSERT INTO orden_compra_item (
                        orden_compra_id, material_codigo, material_descripcion,
                        cantidad, unidad, precio_unitario, precio_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        orden_id,
                        item.get("material_codigo") or item.get("material_id", ""),
                        item.get("material_descripcion") or item.get("descripcion", ""),
                        cantidad,
                        item.get("unidad", "UN"),
                        precio_unitario,
                        round(cantidad * precio_unitario, 2),
                    ),
                )

            _registrar_historial(
                cursor,
                orden_id,
                estado_anterior=None,
                estado_nuevo="borrador",
                actor_id=creado_por,
                razon="Orden de compra creada",
            )

            logger.info(
                "OC creada: %s (orden_id=%d, solicitud_id=%s, creado_por=%d)",
                numero_oc,
                orden_id,
                solicitud_id,
                creado_por,
            )

        return OCService.obtener_orden(orden_id)

    @staticmethod
    def listar_ordenes(
        page: int = 1,
        per_page: int = 20,
        estado: Optional[str] = None,
        centro: Optional[str] = None,
        proveedor: Optional[str] = None,
        contrato_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Lista ordenes de compra con filtros y paginacion.

        Args:
            page: Numero de pagina (1-indexed).
            per_page: Cantidad de resultados por pagina.
            estado: Filtro por estado de la OC.
            centro: Filtro por centro de costo.
            proveedor: Filtro por nombre o CUIT de proveedor (busqueda parcial).

        Returns:
            Dict con:
                - ordenes: lista de ordenes de la pagina actual.
                - total: cantidad total de resultados.
                - page: pagina actual.
                - per_page: tamano de pagina.
                - pages: cantidad total de paginas.
        """
        where_clauses: List[str] = []
        params: List[Any] = []

        if estado:
            where_clauses.append("oc.estado = ?")
            params.append(estado)

        if centro:
            where_clauses.append("oc.centro = ?")
            params.append(centro)

        if proveedor:
            where_clauses.append(
                "(oc.proveedor_nombre LIKE ? OR oc.proveedor_cuit LIKE ?)"
            )
            like_val = f"%{proveedor}%"
            params.extend([like_val, like_val])

        if contrato_id:
            where_clauses.append("oc.contrato_id = ?")
            params.append(contrato_id)

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                f"SELECT COUNT(*) as cnt FROM orden_compra oc WHERE {where_sql}",
                params,
            )
            total = cursor.fetchone()["cnt"]

            offset = (page - 1) * per_page
            cursor.execute(
                f"""
                SELECT oc.*
                FROM orden_compra oc
                WHERE {where_sql}
                ORDER BY oc.created_at DESC
                LIMIT ? OFFSET ?
                """,
                params + [per_page, offset],
            )

            ordenes = [dict(r) for r in cursor.fetchall()]

            pages = math.ceil(total / per_page) if per_page > 0 else 0

            return {
                "ordenes": ordenes,
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": pages,
            }

    @staticmethod
    def obtener_orden(orden_id: int) -> Optional[Dict[str, Any]]:
        """
        Obtiene una orden de compra con sus items e historial.

        Args:
            orden_id: ID de la orden de compra.

        Returns:
            Dict con datos de la orden, items e historial, o None si no existe.
        """
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT * FROM orden_compra WHERE id = ?", (orden_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            orden = dict(row)

            cursor.execute(
                """
                SELECT * FROM orden_compra_item
                WHERE orden_compra_id = ?
                ORDER BY id
                """,
                (orden_id,),
            )
            orden["items"] = [dict(r) for r in cursor.fetchall()]

            cursor.execute(
                """
                SELECT * FROM orden_compra_historial
                WHERE orden_compra_id = ?
                ORDER BY created_at DESC
                """,
                (orden_id,),
            )
            orden["historial"] = [dict(r) for r in cursor.fetchall()]

            return orden

    @staticmethod
    def cambiar_estado(
        orden_id: int,
        nuevo_estado: str,
        actor_id: int,
        razon: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Cambia el estado de una orden de compra validando la transicion.

        Transiciones validas:
            borrador -> pendiente_aprobacion
            pendiente_aprobacion -> aprobada | cancelada
            aprobada -> enviada | cancelada
            enviada -> recepcion_parcial | completada
            recepcion_parcial -> completada

        Args:
            orden_id: ID de la orden de compra.
            nuevo_estado: Estado destino.
            actor_id: ID del usuario que realiza el cambio.
            razon: Motivo del cambio (opcional, requerido para cancelacion).

        Returns:
            Dict con: success, estado_anterior, estado_nuevo.

        Raises:
            ValueError: Si la orden no existe o la transicion es invalida.
        """
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT id, estado FROM orden_compra WHERE id = ?",
                (orden_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Orden {orden_id} no encontrada")

            estado_actual = row["estado"]

            if not _validar_transicion(estado_actual, nuevo_estado):
                raise ValueError(
                    f"Transicion invalida: {estado_actual} -> {nuevo_estado}. "
                    f"Transiciones permitidas desde '{estado_actual}': "
                    f"{ESTADO_TRANSICIONES.get(estado_actual, [])}"
                )

            if nuevo_estado == "cancelada" and not razon:
                raise ValueError(
                    "Se requiere una razon para cancelar la orden"
                )

            now_expr = sql_datetime_now()
            cursor.execute(
                f"""
                UPDATE orden_compra
                SET estado = ?, updated_at = {now_expr}
                WHERE id = ?
                """,
                (nuevo_estado, orden_id),
            )

            _registrar_historial(
                cursor, orden_id, estado_actual, nuevo_estado, actor_id, razon
            )

            logger.info(
                "OC %d: estado %s -> %s (actor=%d, razon=%s)",
                orden_id,
                estado_actual,
                nuevo_estado,
                actor_id,
                razon,
            )

            return {
                "success": True,
                "estado_anterior": estado_actual,
                "estado_nuevo": nuevo_estado,
            }

    @staticmethod
    def registrar_recepcion(
        orden_id: int,
        items_recibidos: List[Dict[str, Any]],
        recibido_por: int,
        notas: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Registra la recepcion de materiales para una orden de compra.

        Crea un registro de recepcion con sus items, actualiza las cantidades
        recibidas en los items de la OC, y ajusta automaticamente el estado
        de la orden (recepcion_parcial o completada).

        Args:
            orden_id: ID de la orden de compra.
            items_recibidos: Lista de items recibidos, cada uno con:
                - orden_compra_item_id (int): ID del item de la OC.
                - cantidad_recibida (float): Cantidad recibida (> 0).
                - estado_calidad (str): 'aceptado', 'rechazado' o 'parcial'.
                - notas (str, optional): Observaciones del item.
            recibido_por: ID del usuario que recibe.
            notas: Notas generales de la recepcion.

        Returns:
            Dict con: success, recepcion_id, estado_orden.

        Raises:
            ValueError: Si la orden no existe, no esta en estado valido,
                o las cantidades exceden lo pendiente.
        """
        if not items_recibidos:
            raise ValueError("Debe incluir al menos un item recibido")

        with get_db_transaction() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT id, estado, numero_oc FROM orden_compra WHERE id = ?",
                (orden_id,),
            )
            orden = cursor.fetchone()
            if not orden:
                raise ValueError(f"Orden {orden_id} no encontrada")

            estado = orden["estado"]
            if estado not in ("enviada", "recepcion_parcial"):
                raise ValueError(
                    f"No se puede registrar recepcion para orden en estado "
                    f"'{estado}'. La orden debe estar en estado 'enviada' o "
                    f"'recepcion_parcial'."
                )

            numero_recepcion = _generar_numero_recepcion(cursor, orden["numero_oc"])

            recepcion_id = insert_returning_id(
                cursor,
                """
                INSERT INTO recepcion
                    (orden_compra_id, numero_recepcion, recibido_por, notas)
                VALUES (?, ?, ?, ?)
                """,
                (orden_id, numero_recepcion, recibido_por, notas),
            )

            for item_rec in items_recibidos:
                oc_item_id = item_rec.get("orden_compra_item_id")
                cant_recibida = float(item_rec.get("cantidad_recibida", 0))
                estado_calidad = item_rec.get("estado_calidad", "aceptado")
                notas_item = item_rec.get("notas")

                if cant_recibida <= 0:
                    raise ValueError(
                        f"Item {oc_item_id}: la cantidad recibida debe ser "
                        f"mayor a 0"
                    )

                if estado_calidad not in ("aceptado", "rechazado", "parcial"):
                    raise ValueError(
                        f"Item {oc_item_id}: estado_calidad debe ser "
                        f"'aceptado', 'rechazado' o 'parcial'"
                    )

                cursor.execute(
                    """
                    SELECT id, cantidad, cantidad_recibida
                    FROM orden_compra_item
                    WHERE id = ? AND orden_compra_id = ?
                    """,
                    (oc_item_id, orden_id),
                )
                oc_item = cursor.fetchone()
                if not oc_item:
                    raise ValueError(
                        f"Item {oc_item_id} no pertenece a la orden {orden_id}"
                    )

                cantidad_total = float(oc_item["cantidad"])
                ya_recibido = float(oc_item["cantidad_recibida"] or 0)
                pendiente = cantidad_total - ya_recibido

                if cant_recibida > pendiente:
                    raise ValueError(
                        f"Item {oc_item_id}: cantidad recibida "
                        f"({cant_recibida}) excede lo pendiente ({pendiente})"
                    )

                insert_returning_id(
                    cursor,
                    """
                    INSERT INTO recepcion_item
                        (recepcion_id, orden_compra_item_id,
                         cantidad_recibida, estado_calidad, notas)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        recepcion_id,
                        oc_item_id,
                        cant_recibida,
                        estado_calidad,
                        notas_item,
                    ),
                )

                nueva_cantidad = ya_recibido + cant_recibida
                cursor.execute(
                    """
                    UPDATE orden_compra_item
                    SET cantidad_recibida = ?
                    WHERE id = ?
                    """,
                    (nueva_cantidad, oc_item_id),
                )

            cursor.execute(
                """
                SELECT
                    SUM(cantidad) as total_solicitada,
                    SUM(COALESCE(cantidad_recibida, 0)) as total_recibida
                FROM orden_compra_item
                WHERE orden_compra_id = ?
                """,
                (orden_id,),
            )
            totales = cursor.fetchone()
            total_solicitada = float(totales["total_solicitada"] or 0)
            total_recibida = float(totales["total_recibida"] or 0)

            if total_recibida >= total_solicitada:
                nuevo_estado = "completada"
            else:
                nuevo_estado = "recepcion_parcial"

            if nuevo_estado != estado:
                now_expr = sql_datetime_now()
                cursor.execute(
                    f"""
                    UPDATE orden_compra
                    SET estado = ?, updated_at = {now_expr}
                    WHERE id = ?
                    """,
                    (nuevo_estado, orden_id),
                )

                _registrar_historial(
                    cursor,
                    orden_id,
                    estado,
                    nuevo_estado,
                    recibido_por,
                    f"Recepcion registrada (recepcion_id={recepcion_id})",
                )

            logger.info(
                "Recepcion registrada: recepcion_id=%d, orden=%s, "
                "items=%d, estado_orden=%s",
                recepcion_id,
                orden["numero_oc"],
                len(items_recibidos),
                nuevo_estado,
            )

            return {
                "success": True,
                "recepcion_id": recepcion_id,
                "estado_orden": nuevo_estado,
            }

    @staticmethod
    def obtener_estadisticas(
        centro: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Obtiene estadisticas generales de ordenes de compra.

        Args:
            centro: Filtro por centro de costo (opcional).

        Returns:
            Dict con:
                - por_estado: conteo de OC por cada estado.
                - monto_total: suma de montos de todas las OC.
                - monto_por_estado: suma de montos agrupada por estado.
                - promedio_lead_time_dias: tiempo promedio entre creacion y
                  completado (solo OC completadas).
                - total_ordenes: cantidad total de ordenes.
        """
        where_clause = ""
        params: List[Any] = []

        if centro:
            where_clause = "WHERE oc.centro = ?"
            params.append(centro)

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                f"""
                SELECT
                    oc.estado,
                    COUNT(*) as cantidad,
                    COALESCE(SUM(oc.monto_total), 0) as monto
                FROM orden_compra oc
                {where_clause}
                GROUP BY oc.estado
                """,
                params,
            )
            rows = cursor.fetchall()

            por_estado: Dict[str, int] = {}
            monto_por_estado: Dict[str, float] = {}
            monto_total = 0.0
            total_ordenes = 0

            for row in rows:
                r = dict(row)
                estado = r["estado"]
                cantidad = r["cantidad"]
                monto = float(r["monto"])

                por_estado[estado] = cantidad
                monto_por_estado[estado] = monto
                monto_total += monto
                total_ordenes += cantidad

            if is_using_postgresql():
                lead_time_query = """
                    SELECT AVG(
                        EXTRACT(EPOCH FROM (h_fin.created_at - h_ini.created_at))
                        / 86400
                    ) as avg_lead
                    FROM orden_compra_historial h_fin
                    INNER JOIN orden_compra_historial h_ini
                        ON h_fin.orden_compra_id = h_ini.orden_compra_id
                    INNER JOIN orden_compra oc
                        ON oc.id = h_fin.orden_compra_id
                    WHERE h_fin.estado_nuevo = 'completada'
                      AND h_ini.estado_anterior IS NULL
                      AND h_ini.estado_nuevo = 'borrador'
                """
                lead_params: List[Any] = []
                if centro:
                    lead_time_query += " AND oc.centro = ?"
                    lead_params.append(centro)
            else:
                lead_time_query = """
                    SELECT AVG(
                        JULIANDAY(h_fin.created_at) - JULIANDAY(h_ini.created_at)
                    ) as avg_lead
                    FROM orden_compra_historial h_fin
                    INNER JOIN orden_compra_historial h_ini
                        ON h_fin.orden_compra_id = h_ini.orden_compra_id
                    INNER JOIN orden_compra oc
                        ON oc.id = h_fin.orden_compra_id
                    WHERE h_fin.estado_nuevo = 'completada'
                      AND h_ini.estado_anterior IS NULL
                      AND h_ini.estado_nuevo = 'borrador'
                """
                lead_params = []
                if centro:
                    lead_time_query += " AND oc.centro = ?"
                    lead_params.append(centro)

            cursor.execute(lead_time_query, lead_params)
            lead_row = cursor.fetchone()
            avg_lead = None
            if lead_row and lead_row["avg_lead"] is not None:
                avg_lead = round(float(lead_row["avg_lead"]), 1)

            return {
                "por_estado": por_estado,
                "monto_total": round(monto_total, 2),
                "monto_por_estado": monto_por_estado,
                "promedio_lead_time_dias": avg_lead,
                "total_ordenes": total_ordenes,
            }

    @staticmethod
    def generar_oc_desde_solicitud(
        solicitud_id: int,
        proveedor_cuit: str,
        proveedor_nombre: str,
        creado_por: int,
    ) -> Dict[str, Any]:
        """
        Genera una orden de compra a partir de una solicitud existente.

        Lee los items de la solicitud desde data_json y crea automaticamente
        una OC vinculada a la solicitud original.

        Args:
            solicitud_id: ID de la solicitud origen.
            proveedor_cuit: CUIT del proveedor seleccionado.
            proveedor_nombre: Razon social del proveedor.
            creado_por: ID del usuario que genera la OC.

        Returns:
            Dict con la orden creada (misma estructura que crear_orden).

        Raises:
            ValueError: Si la solicitud no existe, no tiene items, o no esta
                en estado aprobado/procesando.
        """
        solicitud = SolicitudRepository.get_by_id(solicitud_id)
        if not solicitud:
            raise ValueError(f"Solicitud {solicitud_id} no encontrada")

        status = solicitud.get("status", "")
        estados_validos = ("approved", "processing", "Aprobada", "En proceso")
        if status not in estados_validos:
            raise ValueError(
                f"La solicitud debe estar en estado aprobado o en proceso. "
                f"Estado actual: '{status}'"
            )

        items_solicitud = SolicitudRepository.get_items(solicitud_id)
        if not items_solicitud:
            raise ValueError(
                f"La solicitud {solicitud_id} no tiene items"
            )

        items_oc: List[Dict[str, Any]] = []
        for item in items_solicitud:
            items_oc.append({
                "material_codigo": item.get("material_codigo") or item.get("material_id", ""),
                "material_descripcion": item.get("material_descripcion") or item.get("descripcion", ""),
                "cantidad": item.get("cantidad", 0),
                "unidad": item.get("unidad", "UN"),
                "precio_unitario": item.get("precio_unitario", 0),
            })

        centro = solicitud.get("centro", "")

        logger.info(
            "Generando OC desde solicitud %d (%d items, proveedor=%s)",
            solicitud_id,
            len(items_oc),
            proveedor_nombre,
        )

        return OCService.crear_orden(
            solicitud_id=solicitud_id,
            proveedor_cuit=proveedor_cuit,
            proveedor_nombre=proveedor_nombre,
            centro=centro,
            items=items_oc,
            creado_por=creado_por,
            notas=f"Generada desde solicitud #{solicitud_id}",
        )
