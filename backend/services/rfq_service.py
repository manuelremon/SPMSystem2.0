"""
Servicio RFQ (Request for Quotation)
Maneja la creacion, publicacion, evaluacion y adjudicacion de solicitudes de cotizacion
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


def _generar_numero_rfq(cursor) -> str:
    """
    Genera un numero unico de RFQ en formato RFQ-YYYYMMDD-XXX
    """
    fecha_hoy = datetime.now().strftime("%Y%m%d")
    prefijo = f"RFQ-{fecha_hoy}-"

    # Buscar el ultimo numero del dia
    cursor.execute("""
        SELECT numero_rfq FROM rfq
        WHERE numero_rfq LIKE ?
        ORDER BY numero_rfq DESC
        LIMIT 1
    """, (f"{prefijo}%",))

    row = cursor.fetchone()
    if row:
        ultimo_numero = int(row[0].split("-")[-1])
        siguiente = ultimo_numero + 1
    else:
        siguiente = 1

    return f"{prefijo}{siguiente:03d}"


def crear_rfq(data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    Crea un nuevo RFQ con items y proveedores invitados

    Args:
        data: {
            titulo, descripcion, fecha_cierre_ofertas,
            items: [{material_codigo, material_descripcion, cantidad_solicitada, unidad, especificaciones}],
            proveedores: [{proveedor_cuit, proveedor_nombre}]
        }
        user_id: ID del usuario creador

    Returns:
        RFQ creado con items y proveedores
    """
    if not data.get("titulo"):
        raise ValidationError("El titulo es obligatorio")

    if not data.get("items") or len(data["items"]) == 0:
        raise ValidationError("Debe incluir al menos un item")

    if not data.get("proveedores") or len(data["proveedores"]) == 0:
        raise ValidationError("Debe invitar al menos un proveedor")

    with get_db_transaction() as (conn, cursor):
        # Generar numero de RFQ
        numero_rfq = _generar_numero_rfq(cursor)

        # Crear RFQ
        cursor.execute("""
            INSERT INTO rfq (
                numero_rfq, estado, titulo, descripcion,
                fecha_cierre_ofertas, creado_por
            ) VALUES (?, 'draft', ?, ?, ?, ?)
        """, (
            numero_rfq,
            data["titulo"],
            data.get("descripcion"),
            data.get("fecha_cierre_ofertas"),
            user_id
        ))

        rfq_id = cursor.lastrowid

        # Insertar items
        for item in data["items"]:
            cursor.execute("""
                INSERT INTO rfq_item (
                    rfq_id, material_codigo, material_descripcion,
                    cantidad_solicitada, unidad, especificaciones
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                rfq_id,
                item["material_codigo"],
                item.get("material_descripcion"),
                item["cantidad_solicitada"],
                item.get("unidad", "UN"),
                item.get("especificaciones")
            ))

        # Insertar proveedores invitados
        for proveedor in data["proveedores"]:
            cursor.execute("""
                INSERT INTO rfq_proveedor (
                    rfq_id, proveedor_cuit, proveedor_nombre, estado_respuesta
                ) VALUES (?, ?, ?, 'invited')
            """, (
                rfq_id,
                proveedor["proveedor_cuit"],
                proveedor.get("proveedor_nombre")
            ))

        conn.commit()
        logger.info(f"RFQ {numero_rfq} creado por usuario {user_id}")

        return obtener_detalle_rfq(rfq_id)


def crear_rfq_desde_solicitud(solicitud_id: int, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    Crea un RFQ pre-poblado desde una solicitud existente

    Args:
        solicitud_id: ID de la solicitud origen
        data: {proveedores, fecha_cierre_ofertas, descripcion}
        user_id: ID del usuario creador

    Returns:
        RFQ creado
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener solicitud
        cursor.execute("""
            SELECT s.motivo, s.centro, s.sector
            FROM solicitudes s
            WHERE s.id = ?
        """, (solicitud_id,))

        solicitud = cursor.fetchone()
        if not solicitud:
            raise NotFoundError(f"Solicitud {solicitud_id} no encontrada")

        # Obtener items de la solicitud
        cursor.execute("""
            SELECT codigo_material, descripcion, cantidad, unidad_medida
            FROM items
            WHERE solicitud_id = ?
        """, (solicitud_id,))

        items = []
        for row in cursor.fetchall():
            items.append({
                "material_codigo": row[0],
                "material_descripcion": row[1],
                "cantidad_solicitada": row[2],
                "unidad": row[3]
            })

        if not items:
            raise ValidationError("La solicitud no tiene items")

    # Crear RFQ con los items de la solicitud
    titulo = f"RFQ desde Solicitud - {solicitud[1]}/{solicitud[2]}"

    rfq_data = {
        "titulo": titulo,
        "descripcion": data.get("descripcion") or solicitud[0],
        "fecha_cierre_ofertas": data.get("fecha_cierre_ofertas"),
        "items": items,
        "proveedores": data.get("proveedores", [])
    }

    rfq = crear_rfq(rfq_data, user_id)

    # Actualizar RFQ con la referencia a la solicitud
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE rfq SET solicitud_id = ? WHERE id = ?
        """, (solicitud_id, rfq["id"]))
        conn.commit()

    rfq["solicitud_id"] = solicitud_id
    logger.info(f"RFQ {rfq['numero_rfq']} creado desde solicitud {solicitud_id}")

    return rfq


def obtener_rfqs(filtros: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Lista RFQs con filtros y paginacion

    Args:
        filtros: {estado, search, page, per_page}

    Returns:
        {rfqs: [...], total, page, per_page}
    """
    filtros = filtros or {}
    page = filtros.get("page", 1)
    per_page = filtros.get("per_page", 20)
    offset = (page - 1) * per_page

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Construir WHERE clause
        where_clauses = []
        params = []

        if filtros.get("estado"):
            where_clauses.append("r.estado = ?")
            params.append(filtros["estado"])

        if filtros.get("search"):
            where_clauses.append("(r.numero_rfq LIKE ? OR r.titulo LIKE ? OR r.descripcion LIKE ?)")
            search_term = f"%{filtros['search']}%"
            params.extend([search_term, search_term, search_term])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Contar total
        cursor.execute(f"""
            SELECT COUNT(*) FROM rfq r {where_sql}
        """, params)
        total = cursor.fetchone()[0]

        # Obtener RFQs
        cursor.execute(f"""
            SELECT
                r.id, r.numero_rfq, r.estado, r.titulo, r.descripcion,
                r.fecha_publicacion, r.fecha_cierre_ofertas, r.solicitud_id,
                r.creado_por, r.created_at, r.updated_at,
                u.nombre as creador_nombre
            FROM rfq r
            LEFT JOIN usuarios u ON r.creado_por = u.id_spm
            {where_sql}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        """, params + [per_page, offset])

        rfqs = []
        for row in cursor.fetchall():
            rfq = {
                "id": row[0],
                "numero_rfq": row[1],
                "estado": row[2],
                "titulo": row[3],
                "descripcion": row[4],
                "fecha_publicacion": row[5],
                "fecha_cierre_ofertas": row[6],
                "solicitud_id": row[7],
                "creado_por": row[8],
                "created_at": row[9],
                "updated_at": row[10],
                "creador_nombre": row[11]
            }

            # Contar items y proveedores
            cursor.execute("SELECT COUNT(*) FROM rfq_item WHERE rfq_id = ?", (row[0],))
            rfq["total_items"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM rfq_proveedor WHERE rfq_id = ?", (row[0],))
            rfq["total_proveedores"] = cursor.fetchone()[0]

            cursor.execute("""
                SELECT COUNT(DISTINCT proveedor_cuit)
                FROM rfq_oferta
                WHERE rfq_id = ?
            """, (row[0],))
            rfq["total_ofertas"] = cursor.fetchone()[0]

            rfqs.append(rfq)

    return {
        "rfqs": rfqs,
        "total": total,
        "page": page,
        "per_page": per_page
    }


def obtener_detalle_rfq(rfq_id: int) -> Dict[str, Any]:
    """
    Obtiene el detalle completo de un RFQ con items, proveedores y ofertas
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # RFQ principal
        cursor.execute("""
            SELECT
                r.id, r.numero_rfq, r.estado, r.titulo, r.descripcion,
                r.fecha_publicacion, r.fecha_cierre_ofertas, r.solicitud_id,
                r.creado_por, r.created_at, r.updated_at,
                u.nombre as creador_nombre
            FROM rfq r
            LEFT JOIN usuarios u ON r.creado_por = u.id_spm
            WHERE r.id = ?
        """, (rfq_id,))

        row = cursor.fetchone()
        if not row:
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        rfq = {
            "id": row[0],
            "numero_rfq": row[1],
            "estado": row[2],
            "titulo": row[3],
            "descripcion": row[4],
            "fecha_publicacion": row[5],
            "fecha_cierre_ofertas": row[6],
            "solicitud_id": row[7],
            "creado_por": row[8],
            "created_at": row[9],
            "updated_at": row[10],
            "creador_nombre": row[11]
        }

        # Items
        cursor.execute("""
            SELECT
                id, material_codigo, material_descripcion, cantidad_solicitada,
                unidad, especificaciones, created_at
            FROM rfq_item
            WHERE rfq_id = ?
        """, (rfq_id,))

        rfq["items"] = []
        for row in cursor.fetchall():
            rfq["items"].append({
                "id": row[0],
                "material_codigo": row[1],
                "material_descripcion": row[2],
                "cantidad_solicitada": row[3],
                "unidad": row[4],
                "especificaciones": row[5],
                "created_at": row[6]
            })

        # Proveedores
        cursor.execute("""
            SELECT
                id, proveedor_cuit, proveedor_nombre, estado_respuesta, created_at
            FROM rfq_proveedor
            WHERE rfq_id = ?
        """, (rfq_id,))

        rfq["proveedores"] = []
        for row in cursor.fetchall():
            rfq["proveedores"].append({
                "id": row[0],
                "proveedor_cuit": row[1],
                "proveedor_nombre": row[2],
                "estado_respuesta": row[3],
                "created_at": row[4]
            })

        # Contar ofertas
        cursor.execute("""
            SELECT COUNT(DISTINCT proveedor_cuit)
            FROM rfq_oferta
            WHERE rfq_id = ?
        """, (rfq_id,))
        rfq["total_ofertas"] = cursor.fetchone()[0]

    return rfq


def actualizar_rfq(rfq_id: int, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    Actualiza un RFQ en estado draft
    Solo permite actualizar titulo, descripcion, fecha_cierre_ofertas
    """
    with get_db_transaction() as (conn, cursor):
        # Verificar estado
        cursor.execute("SELECT estado, creado_por FROM rfq WHERE id = ?", (rfq_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        if row[0] != "draft":
            raise ValidationError("Solo se pueden editar RFQs en estado draft")

        # Actualizar campos permitidos
        updates = []
        params = []

        if "titulo" in data:
            updates.append("titulo = ?")
            params.append(data["titulo"])

        if "descripcion" in data:
            updates.append("descripcion = ?")
            params.append(data["descripcion"])

        if "fecha_cierre_ofertas" in data:
            updates.append("fecha_cierre_ofertas = ?")
            params.append(data["fecha_cierre_ofertas"])

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(rfq_id)

            cursor.execute(f"""
                UPDATE rfq
                SET {', '.join(updates)}
                WHERE id = ?
            """, params)

            conn.commit()
            logger.info(f"RFQ {rfq_id} actualizado por usuario {user_id}")

    return obtener_detalle_rfq(rfq_id)


def publicar_rfq(rfq_id: int, user_id: str) -> Dict[str, Any]:
    """
    Publica un RFQ (draft -> published)
    Establece la fecha de publicacion
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            SELECT estado, fecha_cierre_ofertas
            FROM rfq
            WHERE id = ?
        """, (rfq_id,))

        row = cursor.fetchone()
        if not row:
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        if row[0] != "draft":
            raise ValidationError(f"RFQ debe estar en estado draft (actual: {row[0]})")

        if not row[1]:
            raise ValidationError("Debe especificar fecha_cierre_ofertas antes de publicar")

        cursor.execute("""
            UPDATE rfq
            SET estado = 'published',
                fecha_publicacion = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (rfq_id,))

        conn.commit()
        logger.info(f"RFQ {rfq_id} publicado por usuario {user_id}")

    return obtener_detalle_rfq(rfq_id)


def registrar_oferta(rfq_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registra ofertas de un proveedor para items del RFQ

    Args:
        rfq_id: ID del RFQ
        data: {
            proveedor_cuit,
            ofertas: [{
                rfq_item_id, precio_unitario, moneda,
                lead_time_dias, terminos_pago, notas
            }]
        }

    Returns:
        {message, total_ofertas}
    """
    proveedor_cuit = data.get("proveedor_cuit")
    ofertas = data.get("ofertas", [])

    if not proveedor_cuit:
        raise ValidationError("proveedor_cuit es obligatorio")

    if not ofertas:
        raise ValidationError("Debe enviar al menos una oferta")

    with get_db_transaction() as (conn, cursor):
        # Verificar que el RFQ existe y esta abierto
        cursor.execute("""
            SELECT estado, fecha_cierre_ofertas
            FROM rfq
            WHERE id = ?
        """, (rfq_id,))

        row = cursor.fetchone()
        if not row:
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        if row[0] not in ("published", "bidding"):
            raise ValidationError(f"RFQ no esta abierto para ofertas (estado: {row[0]})")

        # Verificar que el proveedor esta invitado
        cursor.execute("""
            SELECT id FROM rfq_proveedor
            WHERE rfq_id = ? AND proveedor_cuit = ?
        """, (rfq_id, proveedor_cuit))

        if not cursor.fetchone():
            raise ValidationError("Proveedor no invitado a este RFQ")

        # Insertar ofertas
        for oferta in ofertas:
            cursor.execute("""
                INSERT INTO rfq_oferta (
                    rfq_id, rfq_item_id, proveedor_cuit, precio_unitario,
                    moneda, lead_time_dias, terminos_pago, notas
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rfq_id,
                oferta["rfq_item_id"],
                proveedor_cuit,
                oferta["precio_unitario"],
                oferta.get("moneda", "ARS"),
                oferta.get("lead_time_dias"),
                oferta.get("terminos_pago"),
                oferta.get("notas")
            ))

        # Actualizar estado del proveedor
        cursor.execute("""
            UPDATE rfq_proveedor
            SET estado_respuesta = 'submitted'
            WHERE rfq_id = ? AND proveedor_cuit = ?
        """, (rfq_id, proveedor_cuit))

        # Actualizar estado del RFQ a bidding si es necesario
        if row[0] == "published":
            cursor.execute("""
                UPDATE rfq
                SET estado = 'bidding', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (rfq_id,))

        conn.commit()
        logger.info(f"Proveedor {proveedor_cuit} envio {len(ofertas)} ofertas al RFQ {rfq_id}")

    return {
        "message": "Ofertas registradas exitosamente",
        "total_ofertas": len(ofertas)
    }


def obtener_ofertas(rfq_id: int) -> List[Dict[str, Any]]:
    """
    Obtiene todas las ofertas agrupadas por proveedor
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                o.id, o.rfq_item_id, o.proveedor_cuit, o.precio_unitario,
                o.moneda, o.lead_time_dias, o.terminos_pago, o.notas,
                o.submitted_at,
                i.material_codigo, i.material_descripcion, i.cantidad_solicitada, i.unidad,
                p.proveedor_nombre
            FROM rfq_oferta o
            JOIN rfq_item i ON o.rfq_item_id = i.id
            LEFT JOIN rfq_proveedor p ON o.rfq_id = p.rfq_id AND o.proveedor_cuit = p.proveedor_cuit
            WHERE o.rfq_id = ?
            ORDER BY o.proveedor_cuit, i.id
        """, (rfq_id,))

        ofertas = []
        for row in cursor.fetchall():
            ofertas.append({
                "id": row[0],
                "rfq_item_id": row[1],
                "proveedor_cuit": row[2],
                "precio_unitario": row[3],
                "moneda": row[4],
                "lead_time_dias": row[5],
                "terminos_pago": row[6],
                "notas": row[7],
                "submitted_at": row[8],
                "material_codigo": row[9],
                "material_descripcion": row[10],
                "cantidad_solicitada": row[11],
                "unidad": row[12],
                "proveedor_nombre": row[13]
            })

    return ofertas


def configurar_criterios(rfq_id: int, criterios: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Configura los criterios de evaluacion para un RFQ
    Valida que la suma de pesos sea 100

    Args:
        rfq_id: ID del RFQ
        criterios: [{criterio: 'price'|'lead_time'|'quality'|'payment_terms', peso_porcentaje}]

    Returns:
        {message, criterios}
    """
    if not criterios:
        raise ValidationError("Debe especificar al menos un criterio")

    # Validar suma de pesos
    suma_pesos = sum(c["peso_porcentaje"] for c in criterios)
    if abs(suma_pesos - 100.0) > 0.01:
        raise ValidationError(f"La suma de pesos debe ser 100 (actual: {suma_pesos})")

    # Validar criterios validos
    criterios_validos = {"price", "lead_time", "quality", "payment_terms"}
    for c in criterios:
        if c["criterio"] not in criterios_validos:
            raise ValidationError(f"Criterio invalido: {c['criterio']}")

    with get_db_transaction() as (conn, cursor):
        # Verificar que el RFQ existe
        cursor.execute("SELECT id FROM rfq WHERE id = ?", (rfq_id,))
        if not cursor.fetchone():
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        # Eliminar criterios anteriores
        cursor.execute("DELETE FROM rfq_criterio_evaluacion WHERE rfq_id = ?", (rfq_id,))

        # Insertar nuevos criterios
        for criterio in criterios:
            cursor.execute("""
                INSERT INTO rfq_criterio_evaluacion (rfq_id, criterio, peso_porcentaje)
                VALUES (?, ?, ?)
            """, (rfq_id, criterio["criterio"], criterio["peso_porcentaje"]))

        conn.commit()
        logger.info(f"Configurados {len(criterios)} criterios para RFQ {rfq_id}")

    return {
        "message": "Criterios configurados exitosamente",
        "criterios": criterios
    }


def calcular_puntajes(rfq_id: int) -> List[Dict[str, Any]]:
    """
    Calcula los puntajes de evaluacion para cada proveedor
    Normaliza scores: menor precio = 100, menor lead time = 100
    Calidad desde tabla proveedor_evaluacion si existe

    Returns:
        Lista de evaluaciones con puntajes
    """
    with get_db_transaction() as (conn, cursor):
        # Obtener criterios
        cursor.execute("""
            SELECT criterio, peso_porcentaje
            FROM rfq_criterio_evaluacion
            WHERE rfq_id = ?
        """, (rfq_id,))

        criterios = {}
        for row in cursor.fetchall():
            criterios[row[0]] = row[1]

        if not criterios:
            raise ValidationError("Debe configurar criterios de evaluacion primero")

        # Obtener proveedores con ofertas
        cursor.execute("""
            SELECT DISTINCT proveedor_cuit
            FROM rfq_oferta
            WHERE rfq_id = ?
        """, (rfq_id,))

        proveedores = [row[0] for row in cursor.fetchall()]

        if not proveedores:
            raise ValidationError("No hay ofertas para evaluar")

        evaluaciones = []

        for proveedor_cuit in proveedores:
            puntajes = {}

            # Puntaje de precio (normalizado)
            if "price" in criterios:
                cursor.execute("""
                    SELECT AVG(precio_unitario) as precio_promedio
                    FROM rfq_oferta
                    WHERE rfq_id = ? AND proveedor_cuit = ?
                """, (rfq_id, proveedor_cuit))
                precio_prov = cursor.fetchone()[0] or 0

                # Encontrar precio minimo
                cursor.execute("""
                    SELECT MIN(avg_precio) FROM (
                        SELECT AVG(precio_unitario) as avg_precio
                        FROM rfq_oferta
                        WHERE rfq_id = ?
                        GROUP BY proveedor_cuit
                    )
                """, (rfq_id,))
                precio_min = cursor.fetchone()[0] or 1

                # Normalizar: menor precio = 100
                if precio_prov > 0:
                    puntajes["price"] = (precio_min / precio_prov) * 100
                else:
                    puntajes["price"] = 0

            # Puntaje de lead time (normalizado)
            if "lead_time" in criterios:
                cursor.execute("""
                    SELECT AVG(lead_time_dias)
                    FROM rfq_oferta
                    WHERE rfq_id = ? AND proveedor_cuit = ? AND lead_time_dias IS NOT NULL
                """, (rfq_id, proveedor_cuit))
                lead_time_prov = cursor.fetchone()[0]

                if lead_time_prov:
                    # Encontrar lead time minimo
                    cursor.execute("""
                        SELECT MIN(avg_lead) FROM (
                            SELECT AVG(lead_time_dias) as avg_lead
                            FROM rfq_oferta
                            WHERE rfq_id = ? AND lead_time_dias IS NOT NULL
                            GROUP BY proveedor_cuit
                        )
                    """, (rfq_id,))
                    lead_time_min = cursor.fetchone()[0] or 1

                    # Normalizar: menor lead time = 100
                    puntajes["lead_time"] = (lead_time_min / lead_time_prov) * 100
                else:
                    puntajes["lead_time"] = 0

            # Puntaje de calidad (desde proveedor_evaluacion)
            if "quality" in criterios:
                cursor.execute("""
                    SELECT puntaje_total
                    FROM proveedor_evaluacion
                    WHERE proveedor_cuit = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (proveedor_cuit,))

                row = cursor.fetchone()
                puntajes["quality"] = row[0] if row else 50.0  # Default 50 si no hay evaluacion

            # Puntaje de terminos de pago (simplificado: 100 si tiene terminos, 50 si no)
            if "payment_terms" in criterios:
                cursor.execute("""
                    SELECT COUNT(*)
                    FROM rfq_oferta
                    WHERE rfq_id = ? AND proveedor_cuit = ?
                      AND terminos_pago IS NOT NULL AND terminos_pago != ''
                """, (rfq_id, proveedor_cuit))

                tiene_terminos = cursor.fetchone()[0] > 0
                puntajes["payment_terms"] = 100.0 if tiene_terminos else 50.0

            # Calcular puntaje total ponderado
            puntaje_total = sum(
                puntajes.get(criterio, 0) * (peso / 100.0)
                for criterio, peso in criterios.items()
            )

            # Guardar evaluacion
            cursor.execute("""
                INSERT INTO rfq_evaluacion (
                    rfq_id, proveedor_cuit, puntaje_total,
                    puntaje_precio, puntaje_lead_time, puntaje_calidad, puntaje_terminos
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                rfq_id,
                proveedor_cuit,
                puntaje_total,
                puntajes.get("price"),
                puntajes.get("lead_time"),
                puntajes.get("quality"),
                puntajes.get("payment_terms")
            ))

            evaluaciones.append({
                "proveedor_cuit": proveedor_cuit,
                "puntaje_total": round(puntaje_total, 2),
                "puntaje_precio": round(puntajes.get("price", 0), 2),
                "puntaje_lead_time": round(puntajes.get("lead_time", 0), 2),
                "puntaje_calidad": round(puntajes.get("quality", 0), 2),
                "puntaje_terminos": round(puntajes.get("payment_terms", 0), 2)
            })

        # Actualizar estado del RFQ a evaluation
        cursor.execute("""
            UPDATE rfq
            SET estado = 'evaluation', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (rfq_id,))

        conn.commit()
        logger.info(f"Calculados puntajes para {len(evaluaciones)} proveedores en RFQ {rfq_id}")

    # Ordenar por puntaje total descendente
    evaluaciones.sort(key=lambda x: x["puntaje_total"], reverse=True)

    return evaluaciones


def adjudicar_rfq(rfq_id: int, adjudicaciones: List[Dict[str, Any]], user_id: str) -> Dict[str, Any]:
    """
    Adjudica items del RFQ a proveedores ganadores

    Args:
        rfq_id: ID del RFQ
        adjudicaciones: [{
            rfq_item_id, proveedor_ganador_cuit,
            precio_adjudicado, cantidad_adjudicada
        }]
        user_id: ID del usuario que adjudica

    Returns:
        {message, total_adjudicaciones}
    """
    if not adjudicaciones:
        raise ValidationError("Debe especificar al menos una adjudicacion")

    with get_db_transaction() as (conn, cursor):
        # Verificar estado del RFQ
        cursor.execute("SELECT estado FROM rfq WHERE id = ?", (rfq_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        if row[0] not in ("bidding", "evaluation"):
            raise ValidationError(f"RFQ debe estar en estado bidding o evaluation (actual: {row[0]})")

        # Insertar adjudicaciones
        for adj in adjudicaciones:
            cursor.execute("""
                INSERT INTO rfq_adjudicacion (
                    rfq_id, rfq_item_id, proveedor_ganador_cuit,
                    precio_adjudicado, cantidad_adjudicada
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                rfq_id,
                adj["rfq_item_id"],
                adj["proveedor_ganador_cuit"],
                adj["precio_adjudicado"],
                adj["cantidad_adjudicada"]
            ))

        # Actualizar estado del RFQ a awarded
        cursor.execute("""
            UPDATE rfq
            SET estado = 'awarded', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (rfq_id,))

        conn.commit()
        logger.info(f"RFQ {rfq_id} adjudicado con {len(adjudicaciones)} items por usuario {user_id}")

    return {
        "message": "RFQ adjudicado exitosamente",
        "total_adjudicaciones": len(adjudicaciones)
    }


def generar_oc_desde_rfq(rfq_id: int, user_id: str) -> List[Dict[str, Any]]:
    """
    Genera ordenes de compra desde las adjudicaciones del RFQ
    Agrupa por proveedor y crea una OC por cada proveedor

    Returns:
        Lista de OCs creadas
    """
    with get_db_transaction() as (conn, cursor):
        # Verificar que el RFQ esta adjudicado
        cursor.execute("SELECT numero_rfq, estado FROM rfq WHERE id = ?", (rfq_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"RFQ {rfq_id} no encontrado")

        if row[1] != "awarded":
            raise ValidationError(f"RFQ debe estar adjudicado (estado actual: {row[1]})")

        numero_rfq = row[0]

        # Obtener adjudicaciones agrupadas por proveedor
        cursor.execute("""
            SELECT
                a.proveedor_ganador_cuit,
                p.proveedor_nombre,
                a.id, a.rfq_item_id, a.precio_adjudicado, a.cantidad_adjudicada,
                i.material_codigo, i.material_descripcion, i.unidad
            FROM rfq_adjudicacion a
            JOIN rfq_item i ON a.rfq_item_id = i.id
            LEFT JOIN rfq_proveedor p ON a.rfq_id = p.rfq_id
                AND a.proveedor_ganador_cuit = p.proveedor_cuit
            WHERE a.rfq_id = ? AND a.orden_compra_id IS NULL
            ORDER BY a.proveedor_ganador_cuit
        """, (rfq_id,))

        # Agrupar por proveedor
        proveedores_items = {}
        adjudicacion_ids = {}

        for row in cursor.fetchall():
            proveedor_cuit = row[0]
            proveedor_nombre = row[1]

            if proveedor_cuit not in proveedores_items:
                proveedores_items[proveedor_cuit] = {
                    "proveedor_nombre": proveedor_nombre,
                    "items": []
                }
                adjudicacion_ids[proveedor_cuit] = []

            proveedores_items[proveedor_cuit]["items"].append({
                "material_codigo": row[6],
                "material_descripcion": row[7],
                "cantidad": row[5],
                "precio_unitario": row[4],
                "unidad": row[8]
            })
            adjudicacion_ids[proveedor_cuit].append(row[2])

        if not proveedores_items:
            raise ValidationError("No hay adjudicaciones pendientes de generar OC")

        # Crear una OC por cada proveedor
        ordenes_creadas = []

        for proveedor_cuit, data in proveedores_items.items():
            # Calcular total
            total = sum(item["cantidad"] * item["precio_unitario"] for item in data["items"])

            # Insertar orden de compra
            cursor.execute("""
                INSERT INTO orden_compra (
                    numero_oc, proveedor_cuit, proveedor_nombre, total, estado,
                    observaciones, solicitante_id
                ) VALUES (?, ?, ?, ?, 'draft', ?, ?)
            """, (
                f"OC-{numero_rfq}-{proveedor_cuit[:4]}",
                proveedor_cuit,
                data["proveedor_nombre"],
                total,
                f"Generada desde {numero_rfq}",
                user_id
            ))

            oc_id = cursor.lastrowid

            # Insertar items de la OC
            for item in data["items"]:
                cursor.execute("""
                    INSERT INTO orden_compra_item (
                        orden_compra_id, material_codigo, material_descripcion,
                        cantidad, precio_unitario, unidad
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    oc_id,
                    item["material_codigo"],
                    item["material_descripcion"],
                    item["cantidad"],
                    item["precio_unitario"],
                    item["unidad"]
                ))

            # Actualizar adjudicaciones con el ID de la OC
            for adj_id in adjudicacion_ids[proveedor_cuit]:
                cursor.execute("""
                    UPDATE rfq_adjudicacion
                    SET orden_compra_id = ?
                    WHERE id = ?
                """, (oc_id, adj_id))

            ordenes_creadas.append({
                "oc_id": oc_id,
                "numero_oc": f"OC-{numero_rfq}-{proveedor_cuit[:4]}",
                "proveedor_cuit": proveedor_cuit,
                "proveedor_nombre": data["proveedor_nombre"],
                "total": total,
                "total_items": len(data["items"])
            })

        conn.commit()
        logger.info(f"Generadas {len(ordenes_creadas)} OCs desde RFQ {rfq_id}")

    return ordenes_creadas


def obtener_comparacion(rfq_id: int) -> Dict[str, Any]:
    """
    Genera una matriz de comparacion de ofertas
    Filas: items, Columnas: proveedores

    Returns:
        {
            items: [{id, material_codigo, descripcion, cantidad}],
            proveedores: [{cuit, nombre}],
            matriz: {item_id: {proveedor_cuit: {precio, lead_time, score}}}
        }
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener items
        cursor.execute("""
            SELECT id, material_codigo, material_descripcion, cantidad_solicitada, unidad
            FROM rfq_item
            WHERE rfq_id = ?
        """, (rfq_id,))

        items = []
        for row in cursor.fetchall():
            items.append({
                "id": row[0],
                "material_codigo": row[1],
                "descripcion": row[2],
                "cantidad": row[3],
                "unidad": row[4]
            })

        # Obtener proveedores que enviaron ofertas
        cursor.execute("""
            SELECT DISTINCT
                o.proveedor_cuit,
                p.proveedor_nombre
            FROM rfq_oferta o
            LEFT JOIN rfq_proveedor p ON o.rfq_id = p.rfq_id
                AND o.proveedor_cuit = p.proveedor_cuit
            WHERE o.rfq_id = ?
        """, (rfq_id,))

        proveedores = []
        for row in cursor.fetchall():
            proveedores.append({
                "cuit": row[0],
                "nombre": row[1]
            })

        # Obtener ofertas
        cursor.execute("""
            SELECT
                rfq_item_id, proveedor_cuit, precio_unitario,
                lead_time_dias, moneda
            FROM rfq_oferta
            WHERE rfq_id = ?
        """, (rfq_id,))

        # Construir matriz
        matriz = {}
        for row in cursor.fetchall():
            item_id = row[0]
            proveedor_cuit = row[1]

            if item_id not in matriz:
                matriz[item_id] = {}

            matriz[item_id][proveedor_cuit] = {
                "precio_unitario": row[2],
                "lead_time_dias": row[3],
                "moneda": row[4]
            }

        # Agregar puntajes si existen
        cursor.execute("""
            SELECT proveedor_cuit, puntaje_total
            FROM rfq_evaluacion
            WHERE rfq_id = ?
        """, (rfq_id,))

        puntajes = {}
        for row in cursor.fetchall():
            puntajes[row[0]] = row[1]

        # Agregar puntajes a la matriz
        for item_id in matriz:
            for proveedor_cuit in matriz[item_id]:
                matriz[item_id][proveedor_cuit]["score"] = puntajes.get(proveedor_cuit)

    return {
        "items": items,
        "proveedores": proveedores,
        "matriz": matriz
    }
