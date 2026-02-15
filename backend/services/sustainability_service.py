"""
Servicio de Sostenibilidad y ESG.
Gestiona emisiones de carbono, scores ESG de proveedores y metas de sostenibilidad.
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def registrar_emision(data: Dict[str, Any]) -> Optional[int]:
    """
    Registra una emisión de carbono.

    Args:
        data: Dict con origen_tipo, origen_id, scope, categoria, cantidad,
              material_codigo, proveedor_cuit, envio_id, periodo, metadata

    Returns:
        ID de la emisión creada o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO emision_carbono
                (origen_tipo, origen_id, scope, categoria, cantidad,
                 material_codigo, proveedor_cuit, envio_id, periodo, metadata,
                 fecha_registro)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder})
            """, (
                data.get('origen_tipo'),
                data.get('origen_id'),
                data.get('scope'),
                data.get('categoria'),
                data.get('cantidad', 0.0),
                data.get('material_codigo'),
                data.get('proveedor_cuit'),
                data.get('envio_id'),
                data.get('periodo'),
                str(data.get('metadata')) if data.get('metadata') else None,
                datetime.utcnow()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            emision_id = cursor.fetchone()[0]
            logger.info(f"Emisión de carbono registrada: {emision_id}")
            return emision_id

    except Exception as e:
        logger.error(f"Error registrando emisión: {str(e)}", exc_info=True)
        return None


def obtener_emisiones(filtros: Dict[str, Any]) -> Dict[str, Any]:
    """
    Obtiene emisiones con paginación y filtros.

    Args:
        filtros: Dict con scope, categoria, periodo, material_codigo,
                 proveedor_cuit, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        # Build WHERE clause
        conditions = []
        params = []

        if filtros.get('scope'):
            conditions.append(f"scope = {placeholder}")
            params.append(filtros['scope'])

        if filtros.get('categoria'):
            conditions.append(f"categoria = {placeholder}")
            params.append(filtros['categoria'])

        if filtros.get('periodo'):
            conditions.append(f"periodo = {placeholder}")
            params.append(filtros['periodo'])

        if filtros.get('material_codigo'):
            conditions.append(f"material_codigo = {placeholder}")
            params.append(filtros['material_codigo'])

        if filtros.get('proveedor_cuit'):
            conditions.append(f"proveedor_cuit = {placeholder}")
            params.append(filtros['proveedor_cuit'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get total count
            cursor.execute(f"""
                SELECT COUNT(*) FROM emision_carbono
                WHERE {where_clause}
            """, params)
            total = cursor.fetchone()[0]

            # Get paginated items
            cursor.execute(f"""
                SELECT id, origen_tipo, origen_id, scope, categoria, cantidad,
                       material_codigo, proveedor_cuit, envio_id, periodo,
                       metadata, fecha_registro
                FROM emision_carbono
                WHERE {where_clause}
                ORDER BY fecha_registro DESC
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
        logger.error(f"Error obteniendo emisiones: {str(e)}", exc_info=True)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page}


def obtener_dashboard_sostenibilidad() -> Dict[str, Any]:
    """
    Obtiene datos del dashboard de sostenibilidad.

    Returns:
        Dict con emisiones_por_scope, emisiones_por_categoria, top_materiales,
        top_proveedores, metas, esg_promedio
    """
    dashboard = {
        'emisiones_por_scope': [],
        'emisiones_por_categoria': [],
        'top_materiales': [],
        'top_proveedores': [],
        'metas': [],
        'esg_promedio': 0.0
    }

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Emisiones por scope
            try:
                cursor.execute("""
                    SELECT scope, SUM(cantidad) as total
                    FROM emision_carbono
                    GROUP BY scope
                    ORDER BY total DESC
                """)
                dashboard['emisiones_por_scope'] = [
                    {'scope': row[0], 'total': row[1]}
                    for row in cursor.fetchall()
                ]
            except Exception as e:
                logger.debug(f"Error calculando emisiones por scope: {e}")

            # Emisiones por categoría
            try:
                cursor.execute("""
                    SELECT categoria, SUM(cantidad) as total
                    FROM emision_carbono
                    GROUP BY categoria
                    ORDER BY total DESC
                """)
                dashboard['emisiones_por_categoria'] = [
                    {'categoria': row[0], 'total': row[1]}
                    for row in cursor.fetchall()
                ]
            except Exception as e:
                logger.debug(f"Error calculando emisiones por categoría: {e}")

            # Top 10 materiales por emisiones
            try:
                cursor.execute("""
                    SELECT material_codigo, SUM(cantidad) as total
                    FROM emision_carbono
                    WHERE material_codigo IS NOT NULL
                    GROUP BY material_codigo
                    ORDER BY total DESC
                    LIMIT 10
                """)
                dashboard['top_materiales'] = [
                    {'material_codigo': row[0], 'total': row[1]}
                    for row in cursor.fetchall()
                ]
            except Exception as e:
                logger.debug(f"Error calculando top materiales: {e}")

            # Top 10 proveedores por emisiones
            try:
                cursor.execute("""
                    SELECT proveedor_cuit, SUM(cantidad) as total
                    FROM emision_carbono
                    WHERE proveedor_cuit IS NOT NULL
                    GROUP BY proveedor_cuit
                    ORDER BY total DESC
                    LIMIT 10
                """)
                dashboard['top_proveedores'] = [
                    {'proveedor_cuit': row[0], 'total': row[1]}
                    for row in cursor.fetchall()
                ]
            except Exception as e:
                logger.debug(f"Error calculando top proveedores: {e}")

            # Metas activas con progreso
            try:
                cursor.execute("""
                    SELECT id, tipo_meta, descripcion, valor_objetivo,
                           progreso_actual, unidad, fecha_objetivo, estado
                    FROM meta_sostenibilidad
                    WHERE estado IN ('active', 'in_progress')
                    ORDER BY fecha_objetivo ASC
                """)
                columns = [desc[0] for desc in cursor.description]
                dashboard['metas'] = [
                    dict(zip(columns, row)) for row in cursor.fetchall()
                ]
            except Exception as e:
                logger.debug(f"Error obteniendo metas: {e}")

            # Promedio ESG (último período)
            try:
                cursor.execute("""
                    SELECT AVG(overall_score)
                    FROM proveedor_esg_score
                    WHERE periodo = (SELECT MAX(periodo) FROM proveedor_esg_score)
                """)
                result = cursor.fetchone()[0]
                dashboard['esg_promedio'] = round(result or 0.0, 2)
            except Exception as e:
                logger.debug(f"Error calculando ESG promedio: {e}")

            return dashboard

    except Exception as e:
        logger.error(f"Error obteniendo dashboard de sostenibilidad: {str(e)}", exc_info=True)
        return dashboard


def registrar_esg_proveedor(data: Dict[str, Any]) -> Optional[int]:
    """
    Registra score ESG de un proveedor.

    Args:
        data: Dict con proveedor_cuit, periodo, environmental_score, social_score,
              governance_score, certificaciones_activas, incidentes_ambientales,
              incidentes_sociales, evaluado_por

    Returns:
        ID del registro creado o None si falla
    """
    try:
        # Calcular overall_score = E*0.4 + S*0.3 + G*0.3
        env_score = data.get('environmental_score', 0)
        soc_score = data.get('social_score', 0)
        gov_score = data.get('governance_score', 0)
        overall_score = (env_score * 0.4) + (soc_score * 0.3) + (gov_score * 0.3)

        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO proveedor_esg_score
                (proveedor_cuit, periodo, environmental_score, social_score,
                 governance_score, overall_score, certificaciones_activas,
                 incidentes_ambientales, incidentes_sociales, evaluado_por,
                 fecha_evaluacion)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder})
            """, (
                data.get('proveedor_cuit'),
                data.get('periodo'),
                env_score,
                soc_score,
                gov_score,
                overall_score,
                data.get('certificaciones_activas', 0),
                data.get('incidentes_ambientales', 0),
                data.get('incidentes_sociales', 0),
                data.get('evaluado_por'),
                datetime.utcnow()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            esg_id = cursor.fetchone()[0]
            logger.info(f"Score ESG registrado para proveedor {data.get('proveedor_cuit')}: {esg_id}")
            return esg_id

    except Exception as e:
        logger.error(f"Error registrando ESG de proveedor: {str(e)}", exc_info=True)
        return None


def obtener_esg_proveedores(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Obtiene scores ESG de proveedores.

    Args:
        filtros: Dict opcional con periodo

    Returns:
        Lista de scores ESG
    """
    try:
        filtros = filtros or {}
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            if filtros.get('periodo'):
                cursor.execute(f"""
                    SELECT id, proveedor_cuit, periodo, environmental_score,
                           social_score, governance_score, overall_score,
                           certificaciones_activas, incidentes_ambientales,
                           incidentes_sociales, evaluado_por, fecha_evaluacion
                    FROM proveedor_esg_score
                    WHERE periodo = {placeholder}
                    ORDER BY overall_score DESC
                """, (filtros['periodo'],))
            else:
                # Último período por defecto
                cursor.execute("""
                    SELECT id, proveedor_cuit, periodo, environmental_score,
                           social_score, governance_score, overall_score,
                           certificaciones_activas, incidentes_ambientales,
                           incidentes_sociales, evaluado_por, fecha_evaluacion
                    FROM proveedor_esg_score
                    WHERE periodo = (SELECT MAX(periodo) FROM proveedor_esg_score)
                    ORDER BY overall_score DESC
                """)

            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo ESG de proveedores: {str(e)}", exc_info=True)
        return []


def crear_meta(data: Dict[str, Any]) -> Optional[int]:
    """
    Crea una meta de sostenibilidad.

    Args:
        data: Dict con tipo_meta, descripcion, valor_objetivo, unidad,
              fecha_objetivo, creado_por

    Returns:
        ID de la meta creada o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO meta_sostenibilidad
                (tipo_meta, descripcion, valor_objetivo, progreso_actual,
                 unidad, fecha_objetivo, estado, creado_por, fecha_creacion)
                VALUES ({placeholder}, {placeholder}, {placeholder}, 0,
                        {placeholder}, {placeholder}, 'active', {placeholder},
                        {placeholder})
            """, (
                data.get('tipo_meta'),
                data.get('descripcion'),
                data.get('valor_objetivo'),
                data.get('unidad'),
                data.get('fecha_objetivo'),
                data.get('creado_por'),
                datetime.utcnow()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            meta_id = cursor.fetchone()[0]
            logger.info(f"Meta de sostenibilidad creada: {meta_id}")
            return meta_id

    except Exception as e:
        logger.error(f"Error creando meta de sostenibilidad: {str(e)}", exc_info=True)
        return None


def actualizar_meta(meta_id: int, data: Dict[str, Any]) -> bool:
    """
    Actualiza una meta de sostenibilidad.

    Args:
        meta_id: ID de la meta
        data: Dict con progreso_actual, estado

    Returns:
        True si se actualizó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE meta_sostenibilidad
                SET progreso_actual = {placeholder},
                    estado = {placeholder}
                WHERE id = {placeholder}
            """, (
                data.get('progreso_actual'),
                data.get('estado'),
                meta_id
            ))

            logger.info(f"Meta {meta_id} actualizada")
            return True

    except Exception as e:
        logger.error(f"Error actualizando meta {meta_id}: {str(e)}", exc_info=True)
        return False


def obtener_metas(estado: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Obtiene metas de sostenibilidad.

    Args:
        estado: Estado opcional ('active', 'in_progress', 'completed', 'cancelled')

    Returns:
        Lista de metas
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            if estado:
                cursor.execute(f"""
                    SELECT id, tipo_meta, descripcion, valor_objetivo,
                           progreso_actual, unidad, fecha_objetivo, estado,
                           creado_por, fecha_creacion
                    FROM meta_sostenibilidad
                    WHERE estado = {placeholder}
                    ORDER BY fecha_objetivo ASC
                """, (estado,))
            else:
                cursor.execute("""
                    SELECT id, tipo_meta, descripcion, valor_objetivo,
                           progreso_actual, unidad, fecha_objetivo, estado,
                           creado_por, fecha_creacion
                    FROM meta_sostenibilidad
                    ORDER BY fecha_objetivo ASC
                """)

            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo metas: {str(e)}", exc_info=True)
        return []


def registrar_huella_material(
    material_codigo: str,
    huella_base: float,
    unidad_base: str,
    fuente_dato: str
) -> bool:
    """
    Registra o actualiza la huella de carbono de un material.

    Args:
        material_codigo: Código del material
        huella_base: Huella base en kg CO2e
        unidad_base: Unidad base (ej: 'kg', 'unidad')
        fuente_dato: Fuente del dato

    Returns:
        True si se registró exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            if is_using_postgresql():
                cursor.execute(f"""
                    INSERT INTO material_huella_carbono
                    (material_codigo, huella_base, unidad_base, fuente_dato, fecha_actualizacion)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    ON CONFLICT (material_codigo)
                    DO UPDATE SET
                        huella_base = {placeholder},
                        unidad_base = {placeholder},
                        fuente_dato = {placeholder},
                        fecha_actualizacion = {placeholder}
                """, (
                    material_codigo, huella_base, unidad_base, fuente_dato, datetime.utcnow(),
                    huella_base, unidad_base, fuente_dato, datetime.utcnow()
                ))
            else:
                cursor.execute(f"""
                    INSERT OR REPLACE INTO material_huella_carbono
                    (material_codigo, huella_base, unidad_base, fuente_dato, fecha_actualizacion)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                """, (material_codigo, huella_base, unidad_base, fuente_dato, datetime.utcnow()))

            logger.info(f"Huella de carbono registrada para material {material_codigo}")
            return True

    except Exception as e:
        logger.error(f"Error registrando huella de material: {str(e)}", exc_info=True)
        return False


def obtener_huella_materiales() -> List[Dict[str, Any]]:
    """
    Obtiene todas las huellas de carbono de materiales.

    Returns:
        Lista de huellas de materiales
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT material_codigo, huella_base, unidad_base,
                       fuente_dato, fecha_actualizacion
                FROM material_huella_carbono
                ORDER BY material_codigo
            """)

            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo huellas de materiales: {str(e)}", exc_info=True)
        return []


def calcular_huella_orden_compra(oc_id: int) -> Dict[str, Any]:
    """
    Calcula la huella de carbono total de una orden de compra.

    Args:
        oc_id: ID de la orden de compra

    Returns:
        Dict con total_kg_co2e e items detallados
    """
    resultado = {
        'total_kg_co2e': 0.0,
        'items': []
    }

    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get OC items with carbon footprint
            cursor.execute(f"""
                SELECT
                    oi.material_codigo,
                    oi.cantidad,
                    mh.huella_base,
                    mh.unidad_base
                FROM orden_compra_item oi
                LEFT JOIN material_huella_carbono mh
                    ON oi.material_codigo = mh.material_codigo
                WHERE oi.orden_compra_id = {placeholder}
            """, (oc_id,))

            total = 0.0
            items = []

            for row in cursor.fetchall():
                material, cantidad, huella_base, unidad = row

                if huella_base is not None:
                    huella_total = huella_base * cantidad
                    total += huella_total

                    items.append({
                        'material_codigo': material,
                        'cantidad': cantidad,
                        'huella_unitaria': huella_base,
                        'unidad_base': unidad,
                        'huella_total': round(huella_total, 2)
                    })
                else:
                    items.append({
                        'material_codigo': material,
                        'cantidad': cantidad,
                        'huella_unitaria': None,
                        'unidad_base': None,
                        'huella_total': 0.0
                    })

            resultado['total_kg_co2e'] = round(total, 2)
            resultado['items'] = items

            logger.info(f"Huella calculada para OC {oc_id}: {resultado['total_kg_co2e']} kg CO2e")
            return resultado

    except Exception as e:
        logger.error(f"Error calculando huella de OC {oc_id}: {str(e)}", exc_info=True)
        return resultado
