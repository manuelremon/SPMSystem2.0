"""
Servicio de Multi-Moneda y Tasas de Cambio.
Proporciona funciones para gestión de tasas, conversiones y análisis de exposición cambiaria.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def registrar_tasa(moneda_origen: str, moneda_destino: str, tasa: float,
                   fecha: datetime, fuente: str = 'manual') -> bool:
    """
    Registra o actualiza una tasa de cambio.

    Args:
        moneda_origen: Código de moneda origen (ej: USD)
        moneda_destino: Código de moneda destino (ej: ARS)
        tasa: Tasa de cambio
        fecha: Fecha de la tasa
        fuente: Fuente de la tasa (manual, api, banco)

    Returns:
        bool: True si se registró exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # UPSERT: try to update, if not exists insert
            if is_using_postgresql():
                cursor.execute(f"""
                    INSERT INTO tipo_cambio (
                        moneda_origen, moneda_destino, tasa, fecha, fuente
                    ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                    ON CONFLICT (moneda_origen, moneda_destino, fecha)
                    DO UPDATE SET tasa = {ph}, fuente = {ph}
                """, (moneda_origen, moneda_destino, tasa, fecha, fuente, tasa, fuente))
            else:
                # SQLite: try update first
                cursor.execute(f"""
                    UPDATE tipo_cambio
                    SET tasa = {ph}, fuente = {ph}
                    WHERE moneda_origen = {ph}
                      AND moneda_destino = {ph}
                      AND fecha = {ph}
                """, (tasa, fuente, moneda_origen, moneda_destino, fecha))

                if cursor.rowcount == 0:
                    # Insert if no rows updated
                    cursor.execute(f"""
                        INSERT INTO tipo_cambio (
                            moneda_origen, moneda_destino, tasa, fecha, fuente
                        ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                    """, (moneda_origen, moneda_destino, tasa, fecha, fuente))

            conn.commit()
            logger.info(f"Tasa registrada: {moneda_origen}/{moneda_destino} = {tasa} ({fecha})")
            return True

    except Exception as e:
        logger.error(f"Error al registrar tasa: {e}")
        raise


def obtener_tasa(moneda_origen: str, moneda_destino: str,
                 fecha: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """
    Obtiene una tasa de cambio para una fecha específica.

    Args:
        moneda_origen: Código de moneda origen
        moneda_destino: Código de moneda destino
        fecha: Fecha de la tasa (opcional, usa fecha actual si no se provee)

    Returns:
        Dict con tasa, fecha, fuente o None si no existe
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'
        fecha_busqueda = fecha or datetime.now()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Try exact date first
            cursor.execute(f"""
                SELECT tasa, fecha, fuente
                FROM tipo_cambio
                WHERE moneda_origen = {ph}
                  AND moneda_destino = {ph}
                  AND fecha = {ph}
                ORDER BY fecha DESC
                LIMIT 1
            """, (moneda_origen, moneda_destino, fecha_busqueda))

            row = cursor.fetchone()

            # If not found, get latest available before the date
            if not row:
                cursor.execute(f"""
                    SELECT tasa, fecha, fuente
                    FROM tipo_cambio
                    WHERE moneda_origen = {ph}
                      AND moneda_destino = {ph}
                      AND fecha <= {ph}
                    ORDER BY fecha DESC
                    LIMIT 1
                """, (moneda_origen, moneda_destino, fecha_busqueda))

                row = cursor.fetchone()

            if not row:
                return None

            return {
                'tasa': float(row[0]),
                'fecha': row[1].isoformat() if row[1] else None,
                'fuente': row[2]
            }

    except Exception as e:
        logger.error(f"Error al obtener tasa {moneda_origen}/{moneda_destino}: {e}")
        raise


def convertir_monto(monto: float, moneda_origen: str, moneda_destino: str,
                    fecha: Optional[datetime] = None, entidad_tipo: Optional[str] = None,
                    entidad_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Convierte un monto de una moneda a otra.

    Args:
        monto: Monto a convertir
        moneda_origen: Código de moneda origen
        moneda_destino: Código de moneda destino
        fecha: Fecha para la tasa (opcional)
        entidad_tipo: Tipo de entidad (orden_compra, factura, etc.) para logging
        entidad_id: ID de entidad para logging

    Returns:
        Dict con monto_original, monto_convertido, tasa_aplicada, moneda_origen, moneda_destino
    """
    try:
        # Same currency, no conversion needed
        if moneda_origen == moneda_destino:
            return {
                'monto_original': monto,
                'monto_convertido': monto,
                'tasa_aplicada': 1.0,
                'moneda_origen': moneda_origen,
                'moneda_destino': moneda_destino
            }

        # Get exchange rate
        tasa_info = obtener_tasa(moneda_origen, moneda_destino, fecha)

        if not tasa_info:
            raise ValueError(f"No se encontró tasa de cambio para {moneda_origen}/{moneda_destino}")

        tasa = tasa_info['tasa']
        monto_convertido = monto * tasa

        # Log conversion if entidad provided
        if entidad_tipo and entidad_id:
            ph = '%s' if is_using_postgresql() else '?'

            with get_db_transaction() as (conn, cursor):
                cursor.execute(f"""
                    INSERT INTO conversion_log (
                        entidad_tipo, entidad_id, moneda_origen, moneda_destino,
                        monto_original, monto_convertido, tasa_aplicada, fecha
                    ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                """, (
                    entidad_tipo, entidad_id, moneda_origen, moneda_destino,
                    monto, monto_convertido, tasa, datetime.now()
                ))
                conn.commit()

        logger.info(f"Conversión: {monto} {moneda_origen} = {monto_convertido} {moneda_destino} (tasa: {tasa})")

        return {
            'monto_original': monto,
            'monto_convertido': monto_convertido,
            'tasa_aplicada': tasa,
            'moneda_origen': moneda_origen,
            'moneda_destino': moneda_destino,
            'fecha_tasa': tasa_info['fecha']
        }

    except Exception as e:
        logger.error(f"Error al convertir monto: {e}")
        raise


def obtener_tasas_historicas(moneda_origen: Optional[str] = None,
                             moneda_destino: Optional[str] = None,
                             dias: int = 30) -> List[Dict[str, Any]]:
    """
    Obtiene tasas históricas para un período.

    Args:
        moneda_origen: Filtro por moneda origen (opcional)
        moneda_destino: Filtro por moneda destino (opcional)
        dias: Número de días hacia atrás (default 30)

    Returns:
        Lista de tasas históricas
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'
        fecha_desde = datetime.now() - timedelta(days=dias)

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause
            conditions = [f"fecha >= {ph}"]
            params = [fecha_desde]

            if moneda_origen:
                conditions.append(f"moneda_origen = {ph}")
                params.append(moneda_origen)

            if moneda_destino:
                conditions.append(f"moneda_destino = {ph}")
                params.append(moneda_destino)

            cursor.execute(f"""
                SELECT moneda_origen, moneda_destino, tasa, fecha, fuente
                FROM tipo_cambio
                WHERE {' AND '.join(conditions)}
                ORDER BY fecha DESC
            """, params)

            tasas = []
            for row in cursor.fetchall():
                tasas.append({
                    'moneda_origen': row[0],
                    'moneda_destino': row[1],
                    'tasa': float(row[2]),
                    'fecha': row[3].isoformat() if row[3] else None,
                    'fuente': row[4]
                })

            return tasas

    except Exception as e:
        logger.error(f"Error al obtener tasas históricas: {e}")
        raise


def obtener_tasas_ultimas() -> List[Dict[str, Any]]:
    """
    Obtiene la última tasa para cada par de monedas.

    Returns:
        Lista de últimas tasas por par
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                # PostgreSQL: use DISTINCT ON
                cursor.execute("""
                    SELECT DISTINCT ON (moneda_origen, moneda_destino)
                        moneda_origen, moneda_destino, tasa, fecha, fuente
                    FROM tipo_cambio
                    ORDER BY moneda_origen, moneda_destino, fecha DESC
                """)
            else:
                # SQLite: use subquery with MAX(fecha)
                cursor.execute("""
                    SELECT tc.moneda_origen, tc.moneda_destino, tc.tasa, tc.fecha, tc.fuente
                    FROM tipo_cambio tc
                    INNER JOIN (
                        SELECT moneda_origen, moneda_destino, MAX(fecha) as max_fecha
                        FROM tipo_cambio
                        GROUP BY moneda_origen, moneda_destino
                    ) latest ON tc.moneda_origen = latest.moneda_origen
                                AND tc.moneda_destino = latest.moneda_destino
                                AND tc.fecha = latest.max_fecha
                    ORDER BY tc.moneda_origen, tc.moneda_destino
                """)

            tasas = []
            for row in cursor.fetchall():
                tasas.append({
                    'moneda_origen': row[0],
                    'moneda_destino': row[1],
                    'tasa': float(row[2]),
                    'fecha': row[3].isoformat() if row[3] else None,
                    'fuente': row[4]
                })

            return tasas

    except Exception as e:
        logger.error(f"Error al obtener últimas tasas: {e}")
        raise


def calcular_exposicion_cambiaria() -> List[Dict[str, Any]]:
    """
    Calcula la exposición cambiaria total por moneda.

    Returns:
        Lista con exposición por moneda (total y equivalente ARS)
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get active OCs by currency (excluding ARS)
            # Use state values that match the actual orden_compra constraint
            cursor.execute(f"""
                SELECT moneda, SUM(monto_total) as total
                FROM orden_compra
                WHERE estado IN ({ph}, {ph}, {ph})
                  AND moneda IS NOT NULL
                  AND moneda != {ph}
                GROUP BY moneda
            """, ('borrador', 'pendiente_aprobacion', 'aprobada', 'ARS'))

            exposicion = []
            for row in cursor.fetchall():
                moneda = row[0]
                total = float(row[1]) if row[1] else 0

                # Convert to ARS
                try:
                    conversion = convertir_monto(total, moneda, 'ARS')
                    equivalente_ars = conversion['monto_convertido']
                except Exception as e:
                    logger.warning(f"No se pudo convertir {moneda} a ARS: {e}")
                    equivalente_ars = None

                exposicion.append({
                    'moneda': moneda,
                    'total': total,
                    'equivalente_ars': equivalente_ars
                })

            return exposicion

    except Exception as e:
        logger.error(f"Error al calcular exposición cambiaria: {e}")
        return []


def calcular_ganancia_perdida(periodo: Optional[int] = None) -> Dict[str, Any]:
    """
    Calcula ganancias/pérdidas por diferencias cambiarias.

    Args:
        periodo: Número de días hacia atrás (opcional, None = todas)

    Returns:
        Dict con ganancia_total, perdida_total, neto
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause for periodo
            fecha_condition = ""
            params = []

            if periodo:
                fecha_desde = datetime.now() - timedelta(days=periodo)
                fecha_condition = f"AND oc.fecha_entrega_real >= {ph}"
                params.append(fecha_desde)

            # Get completed OCs with different currency than ARS
            cursor.execute(f"""
                SELECT oc.id, oc.moneda, oc.monto_total, oc.created_at, oc.fecha_entrega_real
                FROM orden_compra oc
                WHERE oc.estado = {ph}
                  AND oc.moneda IS NOT NULL
                  AND oc.moneda != {ph}
                  AND oc.fecha_entrega_real IS NOT NULL
                  {fecha_condition}
            """, ['completada', 'ARS'] + params)

            ganancia_total = 0
            perdida_total = 0

            for row in cursor.fetchall():
                oc_id = row[0]
                moneda = row[1]
                monto = float(row[2])
                fecha_creacion = row[3]
                fecha_pago = row[4]  # fecha_entrega_real

                try:
                    # Get rate at creation
                    tasa_creacion_info = obtener_tasa(moneda, 'ARS', fecha_creacion)
                    if not tasa_creacion_info:
                        continue
                    tasa_creacion = tasa_creacion_info['tasa']

                    # Get rate at payment
                    tasa_pago_info = obtener_tasa(moneda, 'ARS', fecha_pago)
                    if not tasa_pago_info:
                        continue
                    tasa_pago = tasa_pago_info['tasa']

                    # Calculate difference
                    monto_creacion_ars = monto * tasa_creacion
                    monto_pago_ars = monto * tasa_pago
                    diferencia = monto_pago_ars - monto_creacion_ars

                    if diferencia > 0:
                        perdida_total += diferencia
                    else:
                        ganancia_total += abs(diferencia)

                except Exception as e:
                    logger.warning(f"Error al calcular diferencia cambiaria para OC {oc_id}: {e}")
                    continue

            return {
                'ganancia_total': round(ganancia_total, 2),
                'perdida_total': round(perdida_total, 2),
                'neto': round(ganancia_total - perdida_total, 2)
            }

    except Exception as e:
        logger.error(f"Error al calcular ganancias/pérdidas: {e}")
        return {
            'ganancia_total': 0,
            'perdida_total': 0,
            'neto': 0
        }


def obtener_dashboard_monedas() -> Dict[str, Any]:
    """
    Obtiene datos consolidados para dashboard de monedas.

    Returns:
        Dict con tasas_actuales, exposicion, ganancia_perdida, tendencias
    """
    try:
        # Get current rates for main currencies
        tasas_actuales = {}
        for moneda in ['USD', 'EUR', 'BRL']:
            tasa_info = obtener_tasa(moneda, 'ARS')
            if tasa_info:
                tasas_actuales[moneda] = tasa_info

        # Get currency exposure
        exposicion = calcular_exposicion_cambiaria()

        # Get P&L for last 30 days
        ganancia_perdida = calcular_ganancia_perdida(periodo=30)

        # Get 30-day trends for main currencies
        tendencias = {}
        for moneda in ['USD', 'EUR', 'BRL']:
            historico = obtener_tasas_historicas(
                moneda_origen=moneda,
                moneda_destino='ARS',
                dias=30
            )
            # Group by date, take first value per date (already sorted DESC)
            by_date = {}
            for t in historico:
                fecha = t['fecha']
                if fecha not in by_date:
                    by_date[fecha] = t['tasa']

            # Convert to list sorted by date ASC
            tendencias[moneda] = [
                {'fecha': fecha, 'tasa': tasa}
                for fecha, tasa in sorted(by_date.items())
            ]

        return {
            'tasas_actuales': tasas_actuales,
            'exposicion': exposicion,
            'ganancia_perdida': ganancia_perdida,
            'tendencias': tendencias
        }

    except Exception as e:
        logger.error(f"Error al obtener dashboard de monedas: {e}")
        raise


def obtener_ajustes_pendientes() -> List[Dict[str, Any]]:
    """
    Obtiene OCs con diferencias cambiarias significativas que requieren ajuste presupuestario.

    Returns:
        Lista de OCs con diferencias > 5%
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get active OCs in foreign currency
            cursor.execute(f"""
                SELECT id, numero_oc, moneda, monto_total, created_at, proveedor_cuit
                FROM orden_compra
                WHERE estado IN ({ph}, {ph})
                  AND moneda IS NOT NULL
                  AND moneda != {ph}
            """, ('pendiente_aprobacion', 'aprobada', 'ARS'))

            ajustes_pendientes = []

            for row in cursor.fetchall():
                oc_id = row[0]
                numero_orden = row[1]
                moneda = row[2]
                monto = float(row[3])
                fecha_creacion = row[4]
                proveedor_cuit = row[5]

                try:
                    # Get rate at creation
                    tasa_creacion_info = obtener_tasa(moneda, 'ARS', fecha_creacion)
                    if not tasa_creacion_info:
                        continue
                    tasa_creacion = tasa_creacion_info['tasa']

                    # Get current rate
                    tasa_actual_info = obtener_tasa(moneda, 'ARS')
                    if not tasa_actual_info:
                        continue
                    tasa_actual = tasa_actual_info['tasa']

                    # Calculate difference
                    monto_original_ars = monto * tasa_creacion
                    monto_actual_ars = monto * tasa_actual
                    diferencia_ars = monto_actual_ars - monto_original_ars
                    diferencia_pct = (diferencia_ars / monto_original_ars * 100) if monto_original_ars > 0 else 0

                    # Flag if difference > 5%
                    if abs(diferencia_pct) > 5:
                        ajustes_pendientes.append({
                            'oc_id': oc_id,
                            'numero_orden': numero_orden,
                            'proveedor_cuit': proveedor_cuit,
                            'moneda': moneda,
                            'monto': monto,
                            'tasa_creacion': tasa_creacion,
                            'tasa_actual': tasa_actual,
                            'monto_original_ars': round(monto_original_ars, 2),
                            'monto_actual_ars': round(monto_actual_ars, 2),
                            'diferencia_ars': round(diferencia_ars, 2),
                            'diferencia_pct': round(diferencia_pct, 2)
                        })

                except Exception as e:
                    logger.warning(f"Error al calcular ajuste para OC {oc_id}: {e}")
                    continue

            return ajustes_pendientes

    except Exception as e:
        logger.error(f"Error al obtener ajustes pendientes: {e}")
        raise
