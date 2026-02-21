"""
ZM65 Importer - Importa archivos Excel de reporte SAP ZM65
(Seguimiento de requisiciones de compra)

Columnas esperadas del Excel ZM65:
  - Solped / Sol.pedido / Requisicion
  - Posicion / Pos
  - Material / Codigo material
  - Texto breve / Descripcion
  - Centro
  - Cantidad solicitada / Cantidad
  - Precio neto / Precio unitario
  - Importe / Valor neto
  - Moneda
  - Estrategia liberacion / Estado liberacion
  - Fecha creacion / Fecha solicitud
  - Fecha entrega / Fecha entrega solicitada
  - Creado por / Solicitante
  - Pedido / Numero pedido
  - Proveedor / CUIT proveedor
  - Nombre proveedor
  - Cantidad pedida
  - Cantidad recepcionada / Cantidad recibida
  - Valor pedido
  - Valor recibido
  - Fecha pedido
  - Fecha recepcion
  - Moneda pedido
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import openpyxl

from backend.core.db import get_db_transaction

logger = logging.getLogger(__name__)

# Mapeo flexible de nombres de columna del Excel a campos internos
SOLPED_COLUMN_MAP = {
    'solped': 'solped_id',
    'sol.pedido': 'solped_id',
    'sol pedido': 'solped_id',
    'requisicion': 'solped_id',
    'nro requisicion': 'solped_id',
    'numero requisicion': 'solped_id',

    'posicion': 'posicion',
    'pos': 'posicion',
    'pos.': 'posicion',
    'item': 'posicion',

    'material': 'material_codigo',
    'codigo material': 'material_codigo',
    'codigo': 'material_codigo',
    'nro material': 'material_codigo',

    'texto breve': 'material_descripcion',
    'descripcion': 'material_descripcion',
    'descripcion material': 'material_descripcion',
    'texto': 'material_descripcion',

    'centro': 'centro',
    'centro coste': 'centro',
    'ce.': 'centro',

    'cantidad solicitada': 'cantidad',
    'cantidad': 'cantidad',
    'cant.': 'cantidad',
    'cant. solicitada': 'cantidad',

    'precio neto': 'precio_unitario',
    'precio unitario': 'precio_unitario',
    'precio': 'precio_unitario',
    'precio unit.': 'precio_unitario',

    'importe': 'importe_total',
    'valor neto': 'importe_total',
    'importe total': 'importe_total',
    'valor total': 'importe_total',

    'moneda': 'moneda',
    'mon.': 'moneda',

    'estrategia liberacion': 'estrategia_liberacion',
    'estado liberacion': 'estrategia_liberacion',
    'liberacion': 'estrategia_liberacion',
    'estado': 'estrategia_liberacion',

    'fecha creacion': 'fecha_creacion',
    'fecha solicitud': 'fecha_creacion',
    'fe.creacion': 'fecha_creacion',
    'fec. creacion': 'fecha_creacion',

    'fecha entrega': 'fecha_entrega_solicitada',
    'fecha entrega solicitada': 'fecha_entrega_solicitada',
    'fe.entrega': 'fecha_entrega_solicitada',

    'creado por': 'creado_por',
    'solicitante': 'solicitante',
    'usuario': 'creado_por',
}

ORDER_COLUMN_MAP = {
    'pedido': 'pedido_id',
    'numero pedido': 'pedido_id',
    'nro pedido': 'pedido_id',
    'orden compra': 'pedido_id',
    'oc': 'pedido_id',

    'proveedor': 'proveedor_cuit',
    'cuit proveedor': 'proveedor_cuit',
    'cuit': 'proveedor_cuit',
    'nro proveedor': 'proveedor_cuit',

    'nombre proveedor': 'proveedor_nombre',
    'razon social': 'proveedor_nombre',

    'cantidad pedida': 'cantidad_pedida',
    'cant. pedida': 'cantidad_pedida',

    'cantidad recepcionada': 'cantidad_recepcionada',
    'cantidad recibida': 'cantidad_recepcionada',
    'cant. recibida': 'cantidad_recepcionada',
    'cant. recepcionada': 'cantidad_recepcionada',

    'valor pedido': 'valor_pedido',
    'importe pedido': 'valor_pedido',

    'valor recibido': 'valor_recibido',
    'importe recibido': 'valor_recibido',

    'fecha pedido': 'fecha_pedido',
    'fe.pedido': 'fecha_pedido',
    'fec. pedido': 'fecha_pedido',

    'fecha recepcion': 'fecha_recepcion',
    'fe.recepcion': 'fecha_recepcion',
    'fec. recepcion': 'fecha_recepcion',
    'fecha recibo': 'fecha_recepcion',

    'moneda pedido': 'moneda_pedido',
}


class ZM65Importer:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose

    def import_file(self, filepath: str, user_id: str = 'system') -> Dict[str, Any]:
        stats = {
            'solpeds_inserted': 0,
            'solpeds_updated': 0,
            'orders_inserted': 0,
            'orders_updated': 0,
            'errors': 0,
            'rows_processed': 0,
        }

        log_id = self._create_log(filepath, user_id)

        try:
            rows = self._read_excel(filepath)
            stats['rows_processed'] = len(rows)

            if not rows:
                self._update_log(log_id, stats, 'completed', 'No rows found in file')
                return stats

            for row in rows:
                try:
                    s_stats = self._upsert_solped(row)
                    stats['solpeds_inserted'] += s_stats.get('inserted', 0)
                    stats['solpeds_updated'] += s_stats.get('updated', 0)

                    if row.get('pedido_id'):
                        o_stats = self._upsert_order(row)
                        stats['orders_inserted'] += o_stats.get('inserted', 0)
                        stats['orders_updated'] += o_stats.get('updated', 0)
                except Exception as e:
                    stats['errors'] += 1
                    if self.verbose:
                        logger.warning(f"Error processing row: {e}")

            self._update_log(log_id, stats, 'completed')

        except Exception as e:
            logger.error(f"ZM65 import failed: {e}", exc_info=True)
            self._update_log(log_id, stats, 'failed', str(e))
            raise

        return stats

    def _read_excel(self, filepath: str) -> List[Dict[str, Any]]:
        wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
        ws = wb.active

        rows_iter = ws.iter_rows(values_only=False)
        header_row = next(rows_iter, None)
        if not header_row:
            return []

        headers = []
        for cell in header_row:
            val = str(cell.value or '').strip().lower()
            val = val.replace('á', 'a').replace('é', 'e').replace('í', 'i')
            val = val.replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
            headers.append(val)

        col_map = self._build_column_map(headers)

        if 'solped_id' not in col_map.values():
            raise ValueError(
                "No se encontro columna de SOLPED en el archivo. "
                f"Columnas encontradas: {headers}"
            )

        results = []
        for row in rows_iter:
            values = [cell.value for cell in row]
            if not any(values):
                continue

            record = {}
            for idx, header in enumerate(headers):
                field = col_map.get(header)
                if field and idx < len(values):
                    record[field] = values[idx]

            if not record.get('solped_id'):
                continue

            record['solped_id'] = str(record['solped_id']).strip()
            record['posicion'] = str(record.get('posicion') or '1').strip()

            for date_field in ['fecha_creacion', 'fecha_entrega_solicitada',
                               'fecha_pedido', 'fecha_recepcion']:
                record[date_field] = self._parse_date(record.get(date_field))

            for num_field in ['cantidad', 'precio_unitario', 'importe_total',
                              'cantidad_pedida', 'cantidad_recepcionada',
                              'valor_pedido', 'valor_recibido']:
                record[num_field] = self._parse_number(record.get(num_field))

            for str_field in ['material_codigo', 'material_descripcion', 'centro',
                              'moneda', 'estrategia_liberacion', 'creado_por',
                              'solicitante', 'pedido_id', 'proveedor_cuit',
                              'proveedor_nombre', 'moneda_pedido']:
                val = record.get(str_field)
                record[str_field] = str(val).strip() if val is not None else None

            if not record.get('moneda'):
                record['moneda'] = 'USD'
            if not record.get('moneda_pedido'):
                record['moneda_pedido'] = record.get('moneda', 'USD')

            if record.get('importe_total') is None and record.get('cantidad') and record.get('precio_unitario'):
                record['importe_total'] = record['cantidad'] * record['precio_unitario']

            results.append(record)

        wb.close()
        return results

    def _build_column_map(self, headers: List[str]) -> Dict[str, str]:
        combined = {**SOLPED_COLUMN_MAP, **ORDER_COLUMN_MAP}
        col_map = {}
        for header in headers:
            if header in combined:
                col_map[header] = combined[header]
        return col_map

    def _upsert_solped(self, row: Dict[str, Any]) -> Dict[str, int]:
        with get_db_transaction() as (conn, cur):
            cur.execute(
                "SELECT id FROM sap_solpeds WHERE solped_id = ? AND posicion = ?",
                (row['solped_id'], row['posicion'])
            )
            existing = cur.fetchone()

            if existing:
                cur.execute("""
                    UPDATE sap_solpeds SET
                        material_codigo = ?, material_descripcion = ?,
                        centro = ?, fecha_creacion = ?,
                        cantidad = ?, precio_unitario = ?, importe_total = ?,
                        moneda = ?, estrategia_liberacion = ?,
                        fecha_entrega_solicitada = ?, creado_por = ?, solicitante = ?
                    WHERE solped_id = ? AND posicion = ?
                """, (
                    row.get('material_codigo'), row.get('material_descripcion'),
                    row.get('centro'), row.get('fecha_creacion'),
                    row.get('cantidad'), row.get('precio_unitario'), row.get('importe_total'),
                    row.get('moneda'), row.get('estrategia_liberacion'),
                    row.get('fecha_entrega_solicitada'), row.get('creado_por'),
                    row.get('solicitante'),
                    row['solped_id'], row['posicion']
                ))
                return {'updated': 1, 'inserted': 0}
            else:
                cur.execute("""
                    INSERT INTO sap_solpeds
                    (solped_id, posicion, material_codigo, material_descripcion,
                     centro, fecha_creacion, cantidad, precio_unitario, importe_total,
                     moneda, estrategia_liberacion, fecha_entrega_solicitada,
                     creado_por, solicitante)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row['solped_id'], row['posicion'],
                    row.get('material_codigo'), row.get('material_descripcion'),
                    row.get('centro'), row.get('fecha_creacion'),
                    row.get('cantidad'), row.get('precio_unitario'), row.get('importe_total'),
                    row.get('moneda'), row.get('estrategia_liberacion'),
                    row.get('fecha_entrega_solicitada'), row.get('creado_por'),
                    row.get('solicitante')
                ))
                return {'inserted': 1, 'updated': 0}

    def _upsert_order(self, row: Dict[str, Any]) -> Dict[str, int]:
        pedido_id = row.get('pedido_id')
        if not pedido_id:
            return {'inserted': 0, 'updated': 0}

        with get_db_transaction() as (conn, cur):
            cur.execute(
                "SELECT id FROM sap_purchase_orders WHERE pedido_id = ? AND solped_id = ? AND solped_posicion = ?",
                (pedido_id, row['solped_id'], row['posicion'])
            )
            existing = cur.fetchone()

            if existing:
                cur.execute("""
                    UPDATE sap_purchase_orders SET
                        proveedor_cuit = ?, proveedor_nombre = ?,
                        centro = ?, material_codigo = ?,
                        cantidad_pedida = ?, cantidad_recepcionada = ?,
                        valor_pedido = ?, valor_recibido = ?,
                        fecha_pedido = ?, fecha_recepcion = ?, moneda_pedido = ?
                    WHERE pedido_id = ? AND solped_id = ? AND solped_posicion = ?
                """, (
                    row.get('proveedor_cuit'), row.get('proveedor_nombre'),
                    row.get('centro'), row.get('material_codigo'),
                    row.get('cantidad_pedida'), row.get('cantidad_recepcionada'),
                    row.get('valor_pedido'), row.get('valor_recibido'),
                    row.get('fecha_pedido'), row.get('fecha_recepcion'),
                    row.get('moneda_pedido'),
                    pedido_id, row['solped_id'], row['posicion']
                ))
                return {'updated': 1, 'inserted': 0}
            else:
                cur.execute("""
                    INSERT INTO sap_purchase_orders
                    (pedido_id, solped_id, solped_posicion,
                     proveedor_cuit, proveedor_nombre,
                     centro, material_codigo,
                     cantidad_pedida, cantidad_recepcionada,
                     valor_pedido, valor_recibido,
                     fecha_pedido, fecha_recepcion, moneda_pedido)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    pedido_id, row['solped_id'], row['posicion'],
                    row.get('proveedor_cuit'), row.get('proveedor_nombre'),
                    row.get('centro'), row.get('material_codigo'),
                    row.get('cantidad_pedida'), row.get('cantidad_recepcionada'),
                    row.get('valor_pedido'), row.get('valor_recibido'),
                    row.get('fecha_pedido'), row.get('fecha_recepcion'),
                    row.get('moneda_pedido')
                ))
                return {'inserted': 1, 'updated': 0}

    def _create_log(self, filepath: str, user_id: str) -> Optional[int]:
        filename = filepath.rsplit('/', 1)[-1].rsplit('\\', 1)[-1]
        try:
            with get_db_transaction() as (conn, cur):
                cur.execute("""
                    INSERT INTO sap_import_log (filename, user_id, status)
                    VALUES (?, ?, 'in_progress')
                    RETURNING id
                """, (filename, user_id))
                row = cur.fetchone()
                return row[0] if row else None
        except Exception as e:
            logger.warning(f"Could not create import log: {e}")
            return None

    def _update_log(
        self, log_id: Optional[int], stats: Dict, status: str,
        error_message: str = None
    ):
        if not log_id:
            return
        try:
            with get_db_transaction() as (conn, cur):
                cur.execute("""
                    UPDATE sap_import_log SET
                        finished_at = CURRENT_TIMESTAMP,
                        records_inserted = ?,
                        records_updated = ?,
                        records_error = ?,
                        status = ?,
                        error_message = ?
                    WHERE id = ?
                """, (
                    stats.get('solpeds_inserted', 0) + stats.get('orders_inserted', 0),
                    stats.get('solpeds_updated', 0) + stats.get('orders_updated', 0),
                    stats.get('errors', 0),
                    status,
                    error_message,
                    log_id
                ))
        except Exception as e:
            logger.warning(f"Could not update import log: {e}")

    @staticmethod
    def _parse_date(value) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d %H:%M:%S')
        val = str(value).strip()
        if not val:
            return None
        for fmt in ('%d/%m/%Y', '%d.%m.%Y', '%Y-%m-%d', '%d-%m-%Y',
                    '%d/%m/%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S'):
            try:
                return datetime.strptime(val, fmt).strftime('%Y-%m-%d %H:%M:%S')
            except ValueError:
                continue
        return None

    @staticmethod
    def _parse_number(value) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        val = str(value).strip().replace(',', '.')
        try:
            return float(val)
        except ValueError:
            return None
