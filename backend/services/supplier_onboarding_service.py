"""
Servicio de Supplier Onboarding & Development.
Gestiona onboarding de nuevos proveedores, documentación, evaluación y aprobación.
"""
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_onboarding(data: Dict[str, Any], user_id: int) -> Optional[int]:
    """
    Crea un nuevo registro de onboarding de proveedor.

    Args:
        data: Dict con razon_social, cuit, rubro, contacto_*, direccion, ciudad, provincia, pais, sitio_web
        user_id: ID del usuario que crea el registro

    Returns:
        ID del onboarding creado o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO supplier_onboarding
                (razon_social, cuit, rubro, contacto_nombre, contacto_email,
                 contacto_telefono, direccion, ciudad, provincia, pais, sitio_web,
                 estado, created_at, updated_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        'draft', {placeholder}, {placeholder})
            """, (
                data.get('razon_social'),
                data.get('cuit'),
                data.get('rubro'),
                data.get('contacto_nombre'),
                data.get('contacto_email'),
                data.get('contacto_telefono'),
                data.get('direccion'),
                data.get('ciudad'),
                data.get('provincia'),
                data.get('pais', 'Argentina'),
                data.get('sitio_web'),
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat(),
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            onboarding_id = cursor.fetchone()[0]

            # Registrar en historial
            cursor.execute(f"""
                INSERT INTO onboarding_historial
                (onboarding_id, estado_anterior, estado_nuevo, actor_id, notas, created_at)
                VALUES ({placeholder}, NULL, 'draft', {placeholder}, 'Registro creado', {placeholder})
            """, (
                onboarding_id,
                user_id,
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat()
            ))

            logger.info(f"Onboarding creado: {onboarding_id} para proveedor {data.get('razon_social')}")
            return onboarding_id

    except Exception as e:
        logger.error(f"Error creando onboarding: {str(e)}", exc_info=True)
        return None


def obtener_onboardings(filtros: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Obtiene registros de onboarding con paginación y filtros.

    Args:
        filtros: Dict opcional con estado, rubro, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        filtros = filtros or {}
        placeholder = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        # Build WHERE clause
        conditions = []
        params = []

        if filtros.get('estado'):
            conditions.append(f"estado = {placeholder}")
            params.append(filtros['estado'])

        if filtros.get('rubro'):
            conditions.append(f"rubro = {placeholder}")
            params.append(filtros['rubro'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get total count
            cursor.execute(f"""
                SELECT COUNT(*) FROM supplier_onboarding
                WHERE {where_clause}
            """, params)
            total = cursor.fetchone()[0]

            # Get paginated items
            cursor.execute(f"""
                SELECT id, razon_social, cuit, rubro, contacto_nombre, contacto_email,
                       estado, score_calificacion, created_at, updated_at
                FROM supplier_onboarding
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT {placeholder} OFFSET {placeholder}
            """, params + [per_page, offset])

            columns = [desc[0] for desc in cursor.description]
            items = [dict(zip(columns, row)) for row in cursor.fetchall()]

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error obteniendo onboardings: {str(e)}", exc_info=True)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page}


def obtener_detalle_onboarding(onboarding_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtiene el detalle completo de un onboarding.

    Args:
        onboarding_id: ID del onboarding

    Returns:
        Dict con onboarding, documentos, evaluaciones, historial
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get onboarding
            cursor.execute(f"""
                SELECT id, razon_social, cuit, rubro, contacto_nombre, contacto_email,
                       contacto_telefono, direccion, ciudad, provincia, pais, sitio_web,
                       estado, score_calificacion, evaluado_por, notas_rechazo,
                       created_at, updated_at
                FROM supplier_onboarding
                WHERE id = {placeholder}
            """, (onboarding_id,))

            onboarding_row = cursor.fetchone()
            if not onboarding_row:
                return None

            columns = [desc[0] for desc in cursor.description]
            onboarding = dict(zip(columns, onboarding_row))

            # Get documentos
            cursor.execute(f"""
                SELECT id, tipo_documento, nombre_archivo, path, estado,
                       fecha_vencimiento, revisado_por, notas_revision, created_at
                FROM onboarding_documento
                WHERE onboarding_id = {placeholder}
                ORDER BY created_at DESC
            """, (onboarding_id,))

            doc_columns = [desc[0] for desc in cursor.description]
            documentos = [dict(zip(doc_columns, row)) for row in cursor.fetchall()]

            # Get evaluaciones
            cursor.execute(f"""
                SELECT id, criterio, puntaje, peso, evaluador_id, comentarios, created_at
                FROM onboarding_evaluacion
                WHERE onboarding_id = {placeholder}
                ORDER BY created_at DESC
            """, (onboarding_id,))

            eval_columns = [desc[0] for desc in cursor.description]
            evaluaciones = [dict(zip(eval_columns, row)) for row in cursor.fetchall()]

            # Get historial
            cursor.execute(f"""
                SELECT id, estado_anterior, estado_nuevo, actor_id, notas, created_at
                FROM onboarding_historial
                WHERE onboarding_id = {placeholder}
                ORDER BY created_at DESC
            """, (onboarding_id,))

            hist_columns = [desc[0] for desc in cursor.description]
            historial = [dict(zip(hist_columns, row)) for row in cursor.fetchall()]

            return {
                'onboarding': onboarding,
                'documentos': documentos,
                'evaluaciones': evaluaciones,
                'historial': historial
            }

    except Exception as e:
        logger.error(f"Error obteniendo detalle de onboarding {onboarding_id}: {str(e)}", exc_info=True)
        return None


def actualizar_onboarding(onboarding_id: int, data: Dict[str, Any], user_id: int) -> bool:
    """
    Actualiza datos de un onboarding.

    Args:
        onboarding_id: ID del onboarding
        data: Dict con campos a actualizar
        user_id: ID del usuario que actualiza

    Returns:
        True si se actualizó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        # Build SET clause
        updates = []
        params = []

        for field in ['razon_social', 'rubro', 'contacto_nombre', 'contacto_email',
                      'contacto_telefono', 'direccion', 'ciudad', 'provincia', 'pais', 'sitio_web']:
            if field in data:
                updates.append(f"{field} = {placeholder}")
                params.append(data[field])

        if not updates:
            return False

        # Add updated_at
        updates.append(f"updated_at = {placeholder}")
        params.append(datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat())
        params.append(onboarding_id)

        set_clause = ", ".join(updates)

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE supplier_onboarding
                SET {set_clause}
                WHERE id = {placeholder}
            """, params)

            logger.info(f"Onboarding {onboarding_id} actualizado por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error actualizando onboarding {onboarding_id}: {str(e)}", exc_info=True)
        return False


def enviar_a_revision(onboarding_id: int, user_id: int) -> bool:
    """
    Cambia el estado de un onboarding a 'submitted'.

    Args:
        onboarding_id: ID del onboarding
        user_id: ID del usuario

    Returns:
        True si se cambió exitosamente
    """
    return _cambiar_estado(onboarding_id, 'submitted', user_id, 'Enviado a revisión')


def agregar_documento(onboarding_id: int, data: Dict[str, Any]) -> Optional[int]:
    """
    Agrega un documento al onboarding.

    Args:
        onboarding_id: ID del onboarding
        data: Dict con tipo_documento, nombre_archivo, path, fecha_vencimiento

    Returns:
        ID del documento creado o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO onboarding_documento
                (onboarding_id, tipo_documento, nombre_archivo, path, fecha_vencimiento, estado, created_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, 'pending', {placeholder})
            """, (
                onboarding_id,
                data.get('tipo_documento'),
                data.get('nombre_archivo'),
                data.get('path'),
                data.get('fecha_vencimiento'),
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            doc_id = cursor.fetchone()[0]
            logger.info(f"Documento {doc_id} agregado a onboarding {onboarding_id}")
            return doc_id

    except Exception as e:
        logger.error(f"Error agregando documento: {str(e)}", exc_info=True)
        return None


def revisar_documento(doc_id: int, aprobado: bool, user_id: int, notas: str = None) -> bool:
    """
    Aprueba o rechaza un documento.

    Args:
        doc_id: ID del documento
        aprobado: True para aprobar, False para rechazar
        user_id: ID del revisor
        notas: Notas de revisión

    Returns:
        True si se actualizó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        nuevo_estado = 'approved' if aprobado else 'rejected'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE onboarding_documento
                SET estado = {placeholder},
                    revisado_por = {placeholder},
                    notas_revision = {placeholder}
                WHERE id = {placeholder}
            """, (nuevo_estado, user_id, notas, doc_id))

            logger.info(f"Documento {doc_id} {nuevo_estado} por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error revisando documento {doc_id}: {str(e)}", exc_info=True)
        return False


def agregar_evaluacion(onboarding_id: int, data: Dict[str, Any], user_id: int) -> Optional[int]:
    """
    Agrega una evaluación de criterio y recalcula score total.

    Args:
        onboarding_id: ID del onboarding
        data: Dict con criterio, puntaje, peso, comentarios
        user_id: ID del evaluador

    Returns:
        ID de la evaluación creada o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Insertar evaluación
            cursor.execute(f"""
                INSERT INTO onboarding_evaluacion
                (onboarding_id, criterio, puntaje, peso, evaluador_id, comentarios, created_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
            """, (
                onboarding_id,
                data.get('criterio'),
                data.get('puntaje'),
                data.get('peso', 1.0),
                user_id,
                data.get('comentarios'),
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            eval_id = cursor.fetchone()[0]

            # Recalcular score total (weighted average)
            cursor.execute(f"""
                SELECT SUM(puntaje * peso) / NULLIF(SUM(peso), 0)
                FROM onboarding_evaluacion
                WHERE onboarding_id = {placeholder}
            """, (onboarding_id,))

            score_total = cursor.fetchone()[0]

            # Actualizar score en onboarding
            cursor.execute(f"""
                UPDATE supplier_onboarding
                SET score_calificacion = {placeholder},
                    evaluado_por = {placeholder},
                    updated_at = {placeholder}
                WHERE id = {placeholder}
            """, (
                score_total,
                user_id,
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat(),
                onboarding_id
            ))

            logger.info(f"Evaluación {eval_id} agregada a onboarding {onboarding_id}, nuevo score: {score_total}")
            return eval_id

    except Exception as e:
        logger.error(f"Error agregando evaluación: {str(e)}", exc_info=True)
        return None


def aprobar_onboarding(onboarding_id: int, user_id: int) -> bool:
    """
    Aprueba un onboarding y crea el proveedor en la tabla proveedores.

    Args:
        onboarding_id: ID del onboarding
        user_id: ID del usuario que aprueba

    Returns:
        True si se aprobó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Get onboarding data
            cursor.execute(f"""
                SELECT razon_social, cuit, rubro, contacto_nombre, contacto_email,
                       contacto_telefono, direccion, ciudad, provincia, pais, sitio_web
                FROM supplier_onboarding
                WHERE id = {placeholder}
            """, (onboarding_id,))

            onb_row = cursor.fetchone()
            if not onb_row:
                return False

            razon_social, cuit, rubro, contacto_nombre, contacto_email, \
                contacto_telefono, direccion, ciudad, provincia, pais, sitio_web = onb_row

            # Check if supplier already exists
            cursor.execute(f"""
                SELECT id FROM proveedores WHERE cuit = {placeholder}
            """, (cuit,))

            if cursor.fetchone():
                logger.warning(f"Proveedor con CUIT {cuit} ya existe")
                # Still update estado to approved
                _cambiar_estado(onboarding_id, 'approved', user_id, 'Aprobado (proveedor ya existía)')
                return True

            # Create supplier in proveedores table
            cursor.execute(f"""
                INSERT INTO proveedores
                (cuit, nombre, rubro, contacto, email, telefono, direccion, activo)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, 1)
            """, (
                cuit,
                razon_social,
                rubro,
                contacto_nombre,
                contacto_email,
                contacto_telefono,
                f"{direccion or ''}, {ciudad or ''}, {provincia or ''}, {pais or ''}".strip(', ')
            ))

            # Update onboarding estado to active
            _cambiar_estado(onboarding_id, 'active', user_id, 'Aprobado y proveedor creado')

            logger.info(f"Onboarding {onboarding_id} aprobado, proveedor {cuit} creado")
            return True

    except Exception as e:
        logger.error(f"Error aprobando onboarding {onboarding_id}: {str(e)}", exc_info=True)
        return False


def rechazar_onboarding(onboarding_id: int, user_id: int, razon: str) -> bool:
    """
    Rechaza un onboarding.

    Args:
        onboarding_id: ID del onboarding
        user_id: ID del usuario que rechaza
        razon: Razón del rechazo

    Returns:
        True si se rechazó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE supplier_onboarding
                SET notas_rechazo = {placeholder},
                    updated_at = {placeholder}
                WHERE id = {placeholder}
            """, (
                razon,
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat(),
                onboarding_id
            ))

            _cambiar_estado(onboarding_id, 'rejected', user_id, f'Rechazado: {razon}')

            logger.info(f"Onboarding {onboarding_id} rechazado por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error rechazando onboarding {onboarding_id}: {str(e)}", exc_info=True)
        return False


def obtener_kpis() -> Dict[str, Any]:
    """
    Obtiene KPIs agregados para el dashboard de onboarding.

    Returns:
        Dict con pending, approved_this_month, avg_score, expired_docs
    """
    kpis = {
        'pending': 0,
        'approved_this_month': 0,
        'avg_score': 0.0,
        'expired_docs': 0
    }

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Pending onboardings
            cursor.execute("""
                SELECT COUNT(*) FROM supplier_onboarding
                WHERE estado IN ('submitted', 'under_review')
            """)
            kpis['pending'] = cursor.fetchone()[0]

            # Approved this month
            if is_using_postgresql():
                cursor.execute("""
                    SELECT COUNT(*) FROM supplier_onboarding
                    WHERE estado = 'active'
                    AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)
                """)
            else:
                cursor.execute("""
                    SELECT COUNT(*) FROM supplier_onboarding
                    WHERE estado = 'active'
                    AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
                """)
            kpis['approved_this_month'] = cursor.fetchone()[0]

            # Average score
            cursor.execute("""
                SELECT AVG(score_calificacion)
                FROM supplier_onboarding
                WHERE score_calificacion IS NOT NULL
            """)
            result = cursor.fetchone()[0]
            kpis['avg_score'] = round(result or 0.0, 2)

            # Expired documents
            if is_using_postgresql():
                cursor.execute("""
                    SELECT COUNT(*) FROM onboarding_documento
                    WHERE estado = 'approved'
                    AND fecha_vencimiento IS NOT NULL
                    AND fecha_vencimiento < CURRENT_DATE
                """)
            else:
                cursor.execute("""
                    SELECT COUNT(*) FROM onboarding_documento
                    WHERE estado = 'approved'
                    AND fecha_vencimiento IS NOT NULL
                    AND fecha_vencimiento < date('now')
                """)
            kpis['expired_docs'] = cursor.fetchone()[0]

            return kpis

    except Exception as e:
        logger.error(f"Error obteniendo KPIs de onboarding: {str(e)}", exc_info=True)
        return kpis


def _cambiar_estado(onboarding_id: int, nuevo_estado: str, user_id: int, notas: str = None) -> bool:
    """
    Cambia el estado de un onboarding y registra en historial (internal helper).

    Args:
        onboarding_id: ID del onboarding
        nuevo_estado: Nuevo estado
        user_id: ID del usuario
        notas: Notas del cambio

    Returns:
        True si se cambió exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Get current estado
            cursor.execute(f"""
                SELECT estado FROM supplier_onboarding
                WHERE id = {placeholder}
            """, (onboarding_id,))

            row = cursor.fetchone()
            if not row:
                return False

            estado_anterior = row[0]

            # Update estado
            cursor.execute(f"""
                UPDATE supplier_onboarding
                SET estado = {placeholder},
                    updated_at = {placeholder}
                WHERE id = {placeholder}
            """, (
                nuevo_estado,
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat(),
                onboarding_id
            ))

            # Register in historial
            cursor.execute(f"""
                INSERT INTO onboarding_historial
                (onboarding_id, estado_anterior, estado_nuevo, actor_id, notas, created_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
            """, (
                onboarding_id,
                estado_anterior,
                nuevo_estado,
                user_id,
                notas,
                datetime.utcnow() if is_using_postgresql() else datetime.utcnow().isoformat()
            ))

            logger.info(f"Onboarding {onboarding_id} cambió de {estado_anterior} a {nuevo_estado}")
            return True

    except Exception as e:
        logger.error(f"Error cambiando estado de onboarding {onboarding_id}: {str(e)}", exc_info=True)
        return False
