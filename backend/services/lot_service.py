"""
Servicio de Trazabilidad de Lotes y Gestión de Recalls.
Proporciona funciones para gestión de lotes, trazabilidad y recalls.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_lote(data: Dict[str, Any]) -> int:
    """
    Crea un nuevo lote de inventario.

    Args:
        data: Dict con numero_lote, material_codigo, proveedor_cuit, orden_compra_id,
              cantidad_inicial, unidad, fecha_fabricacion, fecha_vencimiento,
              fecha_recepcion, almacen_id, ubicacion

    Returns:
        int: ID del lote creado
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        # Accept both 'cantidad_inicial' and 'cantidad'
        cantidad_inicial = data.get('cantidad_inicial') or data.get('cantidad')
        if cantidad_inicial is None:
            raise ValueError("cantidad_inicial o cantidad es requerido")

        # Provide defaults for optional required fields
        unidad = data.get('unidad', 'UN')
        almacen_id = data.get('almacen_id', 1)

        with get_db_transaction() as (conn, cursor):
            # Insert lote
            sql = f"""
                INSERT INTO lote (
                    numero_lote, material_codigo, proveedor_cuit, orden_compra_id,
                    cantidad_inicial, cantidad_disponible, unidad,
                    fecha_fabricacion, fecha_vencimiento, fecha_recepcion,
                    almacen_id, ubicacion, estado
                ) VALUES (
                    {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}
                )
            """

            cursor.execute(sql, (
                data['numero_lote'],
                data['material_codigo'],
                data.get('proveedor_cuit'),
                data.get('orden_compra_id'),
                cantidad_inicial,
                cantidad_inicial,  # cantidad_disponible = cantidad_inicial
                unidad,
                data.get('fecha_fabricacion'),
                data.get('fecha_vencimiento'),
                data.get('fecha_recepcion', datetime.now().date()),
                almacen_id,
                data.get('ubicacion'),
                'disponible'
            ))

            # Get lote_id
            if is_using_postgresql():
                cursor.execute("SELECT currval(pg_get_serial_sequence('lote', 'id'))")
                lote_id = cursor.fetchone()[0]
            else:
                lote_id = cursor.lastrowid

            # Create recepcion movement
            # PG schema: lote_movimiento(id, lote_id, tipo, cantidad, almacen_origen,
            #   almacen_destino, referencia, usuario_id, created_at)
            cursor.execute(f"""
                INSERT INTO lote_movimiento (
                    lote_id, tipo, cantidad, usuario_id
                ) VALUES ({ph}, {ph}, {ph}, {ph})
            """, (lote_id, 'recepcion', cantidad_inicial, data.get('usuario_id')))

            conn.commit()
            logger.info(f"Lote creado: {lote_id} - {data['numero_lote']}")
            return lote_id

    except Exception as e:
        logger.error(f"Error al crear lote: {e}")
        raise


def buscar_lotes(filtros: Dict[str, Any]) -> Dict[str, Any]:
    """
    Busca lotes con filtros y paginación.

    Args:
        filtros: Dict con material_codigo, estado, proveedor_cuit, almacen_id,
                numero_lote, vencimiento_antes, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause
            conditions = []
            params = []

            if filtros.get('material_codigo'):
                conditions.append(f"material_codigo = {ph}")
                params.append(filtros['material_codigo'])

            if filtros.get('estado'):
                conditions.append(f"estado = {ph}")
                params.append(filtros['estado'])

            if filtros.get('proveedor_cuit'):
                conditions.append(f"proveedor_cuit = {ph}")
                params.append(filtros['proveedor_cuit'])

            if filtros.get('almacen_id'):
                conditions.append(f"almacen_id = {ph}")
                params.append(filtros['almacen_id'])

            if filtros.get('numero_lote'):
                conditions.append(f"numero_lote LIKE {ph}")
                params.append(f"%{filtros['numero_lote']}%")

            if filtros.get('vencimiento_antes'):
                conditions.append(f"fecha_vencimiento <= {ph}")
                params.append(filtros['vencimiento_antes'])

            where_clause = ' AND '.join(conditions) if conditions else '1=1'

            # Count total
            cursor.execute(f"SELECT COUNT(*) FROM lote WHERE {where_clause}", params)
            total = cursor.fetchone()[0]

            # Get items
            cursor.execute(f"""
                SELECT id, numero_lote, material_codigo, proveedor_cuit, cantidad_inicial,
                       cantidad_disponible, unidad, fecha_fabricacion, fecha_vencimiento,
                       fecha_recepcion, almacen_id, ubicacion, estado, bloqueado_razon,
                       created_at
                FROM lote
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT {ph} OFFSET {ph}
            """, params + [per_page, offset])

            items = []
            for row in cursor.fetchall():
                items.append({
                    'id': row[0],
                    'numero_lote': row[1],
                    'material_codigo': row[2],
                    'proveedor_cuit': row[3],
                    'cantidad_inicial': float(row[4]) if row[4] else 0,
                    'cantidad_disponible': float(row[5]) if row[5] else 0,
                    'unidad': row[6],
                    'fecha_fabricacion': row[7].isoformat() if row[7] else None,
                    'fecha_vencimiento': row[8].isoformat() if row[8] else None,
                    'fecha_recepcion': row[9].isoformat() if row[9] else None,
                    'almacen_id': row[10],
                    'ubicacion': row[11],
                    'estado': row[12],
                    'bloqueado_razon': row[13],
                    'created_at': row[14].isoformat() if row[14] else None
                })

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error al buscar lotes: {e}")
        raise


def obtener_lote(lote_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtiene detalles de un lote con sus últimos movimientos.

    Args:
        lote_id: ID del lote

    Returns:
        Dict con datos del lote y movimientos recientes
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get lote — columnas reales: no tiene updated_at
            cursor.execute(f"""
                SELECT id, numero_lote, material_codigo, proveedor_cuit, orden_compra_id,
                       cantidad_inicial, cantidad_disponible, unidad, fecha_fabricacion,
                       fecha_vencimiento, fecha_recepcion, almacen_id, ubicacion, estado,
                       bloqueado_razon, created_at
                FROM lote
                WHERE id = {ph}
            """, (lote_id,))

            row = cursor.fetchone()
            if not row:
                return None

            lote = {
                'id': row[0],
                'numero_lote': row[1],
                'material_codigo': row[2],
                'proveedor_cuit': row[3],
                'orden_compra_id': row[4],
                'cantidad_inicial': float(row[5]) if row[5] else 0,
                'cantidad_disponible': float(row[6]) if row[6] else 0,
                'unidad': row[7],
                'fecha_fabricacion': row[8].isoformat() if row[8] else None,
                'fecha_vencimiento': row[9].isoformat() if row[9] else None,
                'fecha_recepcion': row[10].isoformat() if row[10] else None,
                'almacen_id': row[11],
                'ubicacion': row[12],
                'estado': row[13],
                'bloqueado_razon': row[14],
                'created_at': row[15].isoformat() if row[15] else None,
            }

            # Get recent movements
            # PG schema: lote_movimiento(id, lote_id, tipo, cantidad, almacen_origen,
            #   almacen_destino, referencia, usuario_id, created_at)
            cursor.execute(f"""
                SELECT id, tipo, cantidad, usuario_id,
                       almacen_destino, referencia, created_at
                FROM lote_movimiento
                WHERE lote_id = {ph}
                ORDER BY created_at DESC
                LIMIT 20
            """, (lote_id,))

            movimientos = []
            for mov_row in cursor.fetchall():
                movimientos.append({
                    'id': mov_row[0],
                    'tipo': mov_row[1],
                    'cantidad': float(mov_row[2]) if mov_row[2] else 0,
                    'usuario_id': mov_row[3],
                    'destino_ubicacion': mov_row[4],
                    'observaciones': mov_row[5],
                    'created_at': mov_row[6].isoformat() if mov_row[6] else None
                })

            lote['movimientos'] = movimientos
            return lote

    except Exception as e:
        logger.error(f"Error al obtener lote {lote_id}: {e}")
        raise


def consumir_lote(lote_id: int, cantidad: float, usuario_id: int,
                  solicitud_id: Optional[int] = None, destino: Optional[str] = None,
                  observaciones: Optional[str] = None) -> bool:
    """
    Consume cantidad de un lote, actualizando disponibilidad.

    Args:
        lote_id: ID del lote
        cantidad: Cantidad a consumir
        usuario_id: ID del usuario que consume
        solicitud_id: ID de solicitud asociada (opcional)
        destino: Destino del material (opcional)
        observaciones: Observaciones adicionales (opcional)

    Returns:
        bool: True si se consumió exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Verify available quantity
            cursor.execute(f"SELECT cantidad_disponible, estado FROM lote WHERE id = {ph}", (lote_id,))
            row = cursor.fetchone()

            if not row:
                raise ValueError(f"Lote {lote_id} no existe")

            cantidad_disponible = float(row[0]) if row[0] else 0
            estado = row[1]

            if estado in ('blocked', 'bloqueado'):
                raise ValueError(f"Lote {lote_id} está bloqueado")

            if cantidad > cantidad_disponible:
                raise ValueError(f"Cantidad insuficiente. Disponible: {cantidad_disponible}, Solicitado: {cantidad}")

            # Update cantidad_disponible
            nueva_cantidad = cantidad_disponible - cantidad
            nuevo_estado = 'agotado' if nueva_cantidad == 0 else estado

            cursor.execute(f"""
                UPDATE lote
                SET cantidad_disponible = {ph}, estado = {ph}
                WHERE id = {ph}
            """, (nueva_cantidad, nuevo_estado, lote_id))

            # Create movement
            # PG schema: lote_movimiento(lote_id, tipo, cantidad, almacen_destino,
            #   referencia, usuario_id)
            cursor.execute(f"""
                INSERT INTO lote_movimiento (
                    lote_id, tipo, cantidad, usuario_id,
                    almacen_destino, referencia
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """, (lote_id, 'consumo', cantidad, usuario_id, destino,
                  observaciones))

            conn.commit()
            logger.info(f"Lote {lote_id} consumido: {cantidad} unidades")
            return True

    except Exception as e:
        logger.error(f"Error al consumir lote {lote_id}: {e}")
        raise


def bloquear_lote(lote_id: int, razon: str, usuario_id: int) -> bool:
    """
    Bloquea un lote por razón especificada.

    Args:
        lote_id: ID del lote
        razon: Razón del bloqueo
        usuario_id: ID del usuario que bloquea

    Returns:
        bool: True si se bloqueó exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Update lote
            cursor.execute(f"""
                UPDATE lote
                SET estado = {ph}, bloqueado_razon = {ph}
                WHERE id = {ph}
            """, ('bloqueado', razon, lote_id))

            # Create movement
            cursor.execute(f"""
                INSERT INTO lote_movimiento (
                    lote_id, tipo, cantidad, usuario_id, referencia
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
            """, (lote_id, 'bloqueo', 0, usuario_id, razon))

            conn.commit()
            logger.info(f"Lote {lote_id} bloqueado: {razon}")
            return True

    except Exception as e:
        logger.error(f"Error al bloquear lote {lote_id}: {e}")
        raise


def desbloquear_lote(lote_id: int, usuario_id: int) -> bool:
    """
    Desbloquea un lote previamente bloqueado.

    Args:
        lote_id: ID del lote
        usuario_id: ID del usuario que desbloquea

    Returns:
        bool: True si se desbloqueó exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Update lote
            cursor.execute(f"""
                UPDATE lote
                SET estado = {ph}, bloqueado_razon = NULL
                WHERE id = {ph}
            """, ('disponible', lote_id))

            # Create movement
            cursor.execute(f"""
                INSERT INTO lote_movimiento (
                    lote_id, tipo, cantidad, usuario_id
                ) VALUES ({ph}, {ph}, {ph}, {ph})
            """, (lote_id, 'desbloqueo', 0, usuario_id))

            conn.commit()
            logger.info(f"Lote {lote_id} desbloqueado")
            return True

    except Exception as e:
        logger.error(f"Error al desbloquear lote {lote_id}: {e}")
        raise


def obtener_traceability_forward(lote_id: int, nivel: int = 0) -> List[Dict[str, Any]]:
    """
    Obtiene trazabilidad hacia adelante (lotes hijos).

    Args:
        lote_id: ID del lote padre
        nivel: Nivel de recursión (max 3)

    Returns:
        Lista de lotes descendientes
    """
    try:
        if nivel >= 3:
            return []

        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT g.lote_hijo_id, g.relacion, g.cantidad_utilizada, g.created_at,
                       l.numero_lote, l.material_codigo, l.cantidad_inicial, l.estado
                FROM lote_genealogia g
                JOIN lote l ON l.id = g.lote_hijo_id
                WHERE g.lote_padre_id = {ph}
                ORDER BY g.created_at
            """, (lote_id,))

            resultados = []
            for row in cursor.fetchall():
                hijo = {
                    'lote_id': row[0],
                    'relacion': row[1],
                    'cantidad_utilizada': float(row[2]) if row[2] else 0,
                    'fecha': row[3].isoformat() if row[3] else None,
                    'numero_lote': row[4],
                    'material_codigo': row[5],
                    'cantidad_inicial': float(row[6]) if row[6] else 0,
                    'estado': row[7],
                    'nivel': nivel + 1,
                    'hijos': obtener_traceability_forward(row[0], nivel + 1)
                }
                resultados.append(hijo)

            return resultados

    except Exception as e:
        logger.error(f"Error al obtener trazabilidad forward de lote {lote_id}: {e}")
        raise


def obtener_traceability_backward(lote_id: int, nivel: int = 0) -> List[Dict[str, Any]]:
    """
    Obtiene trazabilidad hacia atrás (lotes padres).

    Args:
        lote_id: ID del lote hijo
        nivel: Nivel de recursión (max 3)

    Returns:
        Lista de lotes ancestros
    """
    try:
        if nivel >= 3:
            return []

        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT g.lote_padre_id, g.relacion, g.cantidad_utilizada, g.created_at,
                       l.numero_lote, l.material_codigo, l.cantidad_inicial, l.estado
                FROM lote_genealogia g
                JOIN lote l ON l.id = g.lote_padre_id
                WHERE g.lote_hijo_id = {ph}
                ORDER BY g.created_at
            """, (lote_id,))

            resultados = []
            for row in cursor.fetchall():
                padre = {
                    'lote_id': row[0],
                    'relacion': row[1],
                    'cantidad_utilizada': float(row[2]) if row[2] else 0,
                    'fecha': row[3].isoformat() if row[3] else None,
                    'numero_lote': row[4],
                    'material_codigo': row[5],
                    'cantidad_inicial': float(row[6]) if row[6] else 0,
                    'estado': row[7],
                    'nivel': nivel + 1,
                    'padres': obtener_traceability_backward(row[0], nivel + 1)
                }
                resultados.append(padre)

            return resultados

    except Exception as e:
        logger.error(f"Error al obtener trazabilidad backward de lote {lote_id}: {e}")
        raise


def registrar_genealogia(lote_padre_id: int, lote_hijo_id: int,
                        relacion: str, cantidad_utilizada: float) -> int:
    """
    Registra relación genealógica entre lotes.

    Args:
        lote_padre_id: ID del lote padre
        lote_hijo_id: ID del lote hijo
        relacion: Tipo de relación
        cantidad_utilizada: Cantidad del padre utilizada en el hijo

    Returns:
        int: ID del registro de genealogía
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO lote_genealogia (
                    lote_padre_id, lote_hijo_id, relacion, cantidad_utilizada
                ) VALUES ({ph}, {ph}, {ph}, {ph})
            """, (lote_padre_id, lote_hijo_id, relacion, cantidad_utilizada))

            if is_using_postgresql():
                cursor.execute("SELECT currval(pg_get_serial_sequence('lote_genealogia', 'id'))")
                genealogia_id = cursor.fetchone()[0]
            else:
                genealogia_id = cursor.lastrowid

            conn.commit()
            logger.info(f"Genealogía registrada: {lote_padre_id} -> {lote_hijo_id}")
            return genealogia_id

    except Exception as e:
        logger.error(f"Error al registrar genealogía: {e}")
        raise


def crear_recall(data: Dict[str, Any]) -> int:
    """
    Crea un recall y bloquea lotes afectados.

    Args:
        data: Dict con titulo, severidad, tipo, razon, material_codigo,
              proveedor_cuit, responsable_id, plan_accion, costo_estimado

    Returns:
        int: ID del recall creado
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Generate numero_recall
            year = datetime.now().year
            cursor.execute(f"""
                SELECT COUNT(*) FROM recall
                WHERE numero_recall LIKE {ph}
            """, (f'RCL-{year}-%',))
            count = cursor.fetchone()[0] + 1
            numero_recall = f"RCL-{year}-{count:04d}"

            # Insert recall — all fields have safe defaults for flexible callers
            titulo = data.get('titulo', f'Recall {numero_recall}')
            # PG recall.severidad values: 'low', 'medium', 'high', 'critical'
            # (no Spanish translations in PG schema)
            raw_severidad = data.get('severidad', 'medium')
            severidad = raw_severidad
            tipo = data.get('tipo', 'voluntary')
            descripcion = data.get('descripcion', data.get('razon', data.get('motivo', '')))
            responsable_id = data.get('responsable_id', 0)

            # PG schema: recall(id, numero_recall, titulo, descripcion, tipo, severidad,
            #   estado, material_codigo, proveedor_cuit, lotes_afectados,
            #   cantidad_afectada, responsable_id, fecha_inicio, fecha_cierre,
            #   accion_requerida, created_at, updated_at)
            cursor.execute(f"""
                INSERT INTO recall (
                    numero_recall, titulo, descripcion, tipo, severidad, material_codigo,
                    proveedor_cuit, responsable_id, accion_requerida,
                    estado, fecha_inicio
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """, (
                numero_recall, titulo, descripcion, tipo,
                severidad, data.get('material_codigo'), data.get('proveedor_cuit'),
                responsable_id, data.get('accion_requerida', data.get('plan_accion', '')),
                'initiated', datetime.now()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT currval(pg_get_serial_sequence('recall', 'id'))")
                recall_id = cursor.fetchone()[0]
            else:
                recall_id = cursor.lastrowid

            # Find affected lotes
            conditions = ["estado IN ('disponible', 'reservado', 'available')"]
            params = []

            if data.get('material_codigo'):
                conditions.append(f"material_codigo = {ph}")
                params.append(data['material_codigo'])

            if data.get('proveedor_cuit'):
                conditions.append(f"proveedor_cuit = {ph}")
                params.append(data['proveedor_cuit'])

            cursor.execute(f"""
                SELECT id, numero_lote, cantidad_disponible
                FROM lote
                WHERE {' AND '.join(conditions)}
            """, params)

            lotes_afectados = cursor.fetchall()

            # Block affected lotes and create recall_lote entries
            for lote_row in lotes_afectados:
                lote_id = lote_row[0]
                cantidad = lote_row[2]

                # Block lote
                cursor.execute(f"""
                    UPDATE lote
                    SET estado = {ph}, bloqueado_razon = {ph}
                    WHERE id = {ph}
                """, ('bloqueado', f"Recall {numero_recall}", lote_id))

                # Create recall_lote
                cursor.execute(f"""
                    INSERT INTO recall_lote (
                        recall_id, lote_id, cantidad_afectada, estado_recuperacion
                    ) VALUES ({ph}, {ph}, {ph}, {ph})
                """, (recall_id, lote_id, cantidad, 'pending'))

                # Create movement
                cursor.execute(f"""
                    INSERT INTO lote_movimiento (
                        lote_id, tipo, cantidad, usuario_id, referencia
                    ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                """, (lote_id, 'bloqueo', 0, responsable_id,
                      f"Recall {numero_recall}: {descripcion}"))

            conn.commit()
            logger.info(f"Recall creado: {numero_recall} - {len(lotes_afectados)} lotes afectados")
            return recall_id

    except Exception as e:
        logger.error(f"Error al crear recall: {e}")
        raise


def obtener_recalls(filtros: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Obtiene recalls con filtros y paginación.

    Args:
        filtros: Dict con estado, severidad, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        filtros = filtros or {}
        ph = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause
            conditions = []
            params = []

            if filtros.get('estado'):
                conditions.append(f"estado = {ph}")
                params.append(filtros['estado'])

            if filtros.get('severidad'):
                conditions.append(f"severidad = {ph}")
                params.append(filtros['severidad'])

            where_clause = ' AND '.join(conditions) if conditions else '1=1'

            # Count total
            cursor.execute(f"SELECT COUNT(*) FROM recall WHERE {where_clause}", params)
            total = cursor.fetchone()[0]

            # Get items
            # PG schema: recall(id, numero_recall, titulo, descripcion, tipo, severidad,
            #   estado, material_codigo, proveedor_cuit, lotes_afectados,
            #   cantidad_afectada, responsable_id, fecha_inicio, fecha_cierre,
            #   accion_requerida, created_at, updated_at)
            cursor.execute(f"""
                SELECT r.id, r.numero_recall, r.titulo, r.severidad, r.tipo, r.descripcion,
                       r.material_codigo, r.proveedor_cuit, r.responsable_id, r.estado,
                       r.fecha_inicio, r.fecha_cierre,
                       COUNT(rl.id) as lotes_afectados_count
                FROM recall r
                LEFT JOIN recall_lote rl ON rl.recall_id = r.id
                WHERE {where_clause}
                GROUP BY r.id, r.numero_recall, r.titulo, r.severidad, r.tipo, r.descripcion,
                         r.material_codigo, r.proveedor_cuit, r.responsable_id, r.estado,
                         r.fecha_inicio, r.fecha_cierre
                ORDER BY r.fecha_inicio DESC
                LIMIT {ph} OFFSET {ph}
            """, params + [per_page, offset])

            items = []
            for row in cursor.fetchall():
                items.append({
                    'id': row[0],
                    'numero_recall': row[1],
                    'titulo': row[2],
                    'severidad': row[3],
                    'tipo': row[4],
                    'razon': row[5],
                    'material_codigo': row[6],
                    'proveedor_cuit': row[7],
                    'responsable_id': row[8],
                    'estado': row[9],
                    'fecha_inicio': row[10].isoformat() if row[10] else None,
                    'fecha_cierre': row[11].isoformat() if row[11] else None,
                    'costo_estimado': 0,
                    'lotes_afectados': row[12]
                })

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error al obtener recalls: {e}")
        raise


def obtener_detalle_recall(recall_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtiene detalle completo de un recall.

    Args:
        recall_id: ID del recall

    Returns:
        Dict con datos del recall y lotes afectados
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get recall
            # PG schema: recall(id, numero_recall, titulo, descripcion, tipo, severidad,
            #   estado, material_codigo, proveedor_cuit, lotes_afectados,
            #   cantidad_afectada, responsable_id, fecha_inicio, fecha_cierre,
            #   accion_requerida, created_at, updated_at)
            cursor.execute(f"""
                SELECT id, numero_recall, titulo, severidad, tipo, descripcion, material_codigo,
                       proveedor_cuit, responsable_id, accion_requerida,
                       estado, fecha_inicio, fecha_cierre, created_at
                FROM recall
                WHERE id = {ph}
            """, (recall_id,))

            row = cursor.fetchone()
            if not row:
                return None

            recall = {
                'id': row[0],
                'numero_recall': row[1],
                'titulo': row[2],
                'severidad': row[3],
                'tipo': row[4],
                'razon': row[5],
                'material_codigo': row[6],
                'proveedor_cuit': row[7],
                'responsable_id': row[8],
                'plan_accion': row[9],
                'costo_estimado': 0,
                'estado': row[10],
                'fecha_inicio': row[11].isoformat() if row[11] else None,
                'fecha_cierre': row[12].isoformat() if row[12] else None,
                'created_at': row[13].isoformat() if row[13] else None
            }

            # Get affected lotes
            cursor.execute(f"""
                SELECT rl.id, rl.lote_id, rl.cantidad_afectada, rl.estado_recuperacion,
                       rl.fecha_recuperacion, l.numero_lote, l.material_codigo,
                       l.almacen_id, l.ubicacion, l.estado
                FROM recall_lote rl
                JOIN lote l ON l.id = rl.lote_id
                WHERE rl.recall_id = {ph}
                ORDER BY l.numero_lote
            """, (recall_id,))

            lotes = []
            for lote_row in cursor.fetchall():
                lotes.append({
                    'id': lote_row[0],
                    'lote_id': lote_row[1],
                    'cantidad_afectada': float(lote_row[2]) if lote_row[2] else 0,
                    'estado_recuperacion': lote_row[3],
                    'fecha_recuperacion': lote_row[4].isoformat() if lote_row[4] else None,
                    'numero_lote': lote_row[5],
                    'material_codigo': lote_row[6],
                    'almacen_id': lote_row[7],
                    'ubicacion': lote_row[8],
                    'estado_lote': lote_row[9]
                })

            recall['lotes'] = lotes
            return recall

    except Exception as e:
        logger.error(f"Error al obtener detalle de recall {recall_id}: {e}")
        raise


def marcar_lote_recuperado(recall_id: int, lote_id: int) -> bool:
    """
    Marca un lote como recuperado en un recall.

    Args:
        recall_id: ID del recall
        lote_id: ID del lote

    Returns:
        bool: True si se marcó exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE recall_lote
                SET estado_recuperacion = {ph}, fecha_recuperacion = {ph}
                WHERE recall_id = {ph} AND lote_id = {ph}
            """, ('retrieved', datetime.now(), recall_id, lote_id))

            conn.commit()
            logger.info(f"Lote {lote_id} marcado como recuperado en recall {recall_id}")
            return True

    except Exception as e:
        logger.error(f"Error al marcar lote recuperado: {e}")
        raise


def check_vencimientos(dias: int = 30) -> List[Dict[str, Any]]:
    """
    Encuentra lotes próximos a vencer.

    Args:
        dias: Días de anticipación para la alerta

    Returns:
        Lista de lotes próximos a vencer
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'
        fecha_limite = (datetime.now() + timedelta(days=dias)).date()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT id, numero_lote, material_codigo, cantidad_disponible,
                       fecha_vencimiento, almacen_id, ubicacion,
                       CAST(julianday(fecha_vencimiento) - julianday('now') AS INTEGER) as dias_restantes
                FROM lote
                WHERE estado = {ph}
                  AND fecha_vencimiento IS NOT NULL
                  AND fecha_vencimiento <= {ph}
                ORDER BY fecha_vencimiento
            """ if not is_using_postgresql() else f"""
                SELECT id, numero_lote, material_codigo, cantidad_disponible,
                       fecha_vencimiento, almacen_id, ubicacion,
                       EXTRACT(DAY FROM fecha_vencimiento - CURRENT_DATE) as dias_restantes
                FROM lote
                WHERE estado = {ph}
                  AND fecha_vencimiento IS NOT NULL
                  AND fecha_vencimiento <= {ph}
                ORDER BY fecha_vencimiento
            """, ('disponible', fecha_limite))

            lotes = []
            for row in cursor.fetchall():
                lotes.append({
                    'id': row[0],
                    'numero_lote': row[1],
                    'material_codigo': row[2],
                    'cantidad_disponible': float(row[3]) if row[3] else 0,
                    'fecha_vencimiento': row[4].isoformat() if row[4] else None,
                    'almacen_id': row[5],
                    'ubicacion': row[6],
                    'dias_restantes': int(row[7]) if row[7] is not None else 0
                })

            return lotes

    except Exception as e:
        logger.error(f"Error al verificar vencimientos: {e}")
        raise


def obtener_kpis() -> Dict[str, Any]:
    """
    Obtiene KPIs de lotes: activos, bloqueados, por vencer (30d), recalls activos.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Lotes activos (disponible + reservado)
            cursor.execute("SELECT COUNT(*) FROM lote WHERE estado IN ('disponible', 'reservado', 'available')")
            lotes_activos = cursor.fetchone()[0]

            # Lotes bloqueados
            cursor.execute("SELECT COUNT(*) FROM lote WHERE estado IN ('bloqueado', 'blocked')")
            lotes_bloqueados = cursor.fetchone()[0]

            # Lotes por vencer (próximos 30 días)
            cursor.execute("""
                SELECT COUNT(*) FROM lote
                WHERE estado IN ('disponible', 'reservado', 'available')
                AND fecha_vencimiento IS NOT NULL
                AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'
                AND fecha_vencimiento >= CURRENT_DATE
            """)
            lotes_por_vencer = cursor.fetchone()[0]

            # Recalls activos
            cursor.execute("SELECT COUNT(*) FROM recall WHERE estado IN ('initiated', 'en_proceso', 'active', 'in_progress', 'draft')")
            recalls_activos = cursor.fetchone()[0]

            return {
                'lotes_activos': lotes_activos,
                'lotes_bloqueados': lotes_bloqueados,
                'lotes_por_vencer': lotes_por_vencer,
                'recalls_activos': recalls_activos,
            }

    except Exception as e:
        logger.error(f"Error al obtener KPIs de lotes: {e}")
        raise
