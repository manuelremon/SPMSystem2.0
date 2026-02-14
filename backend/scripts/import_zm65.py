"""
Script de importacion incremental para datos ZM65 (Requisiciones SAP)

Uso:
    python -m backend.scripts.import_zm65 <archivo.xlsx>
    python -m backend.scripts.import_zm65 data/xlsx/ZM65.xlsx

Ejemplo:
    python -m backend.scripts.import_zm65 data/xlsx/ZM65.xlsx --verbose
"""

import argparse
import hashlib
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Agregar el directorio raiz al path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

try:
    import pandas as pd
except ImportError:
    print("Error: pandas no esta instalado. Ejecuta: pip install pandas openpyxl")
    sys.exit(1)


class ZM65Importer:
    """Importador incremental de datos ZM65 (Requisiciones SAP)"""

    # Mapeo de columnas Excel -> columnas DB
    COLUMN_MAPPING_SOLPED = {
        'solped': 'solped_id',
        'posicion solped': 'posicion',
        'clase solped': 'clase_solped',
        'Material': 'material_codigo',
        'Texto breve': 'material_descripcion',
        'Grupo articulos': 'grupo_articulos',
        'cantidad solped': 'cantidad',
        'precio solped': 'precio_unitario',
        'importe total posicion solped': 'importe_total',
        'moneda solped': 'moneda',
        'UM': 'unidad_medida',
        'fecha creacion solped': 'fecha_creacion',
        'fecha entrega solped': 'fecha_entrega_solicitada',
        'estrategia liberacion solped': 'estrategia_liberacion',
        'fecha liberacion': 'fecha_liberacion',
        'Centro': 'centro',
        'Grupo de compras': 'grupo_compras',
        'Creado por': 'creado_por',
        'Solicitante': 'solicitante',
        'numero necesidad': 'numero_necesidad',
        'tipo imputacion': 'tipo_imputacion',
        'centro de costos': 'centro_costos',
    }

    COLUMN_MAPPING_PO = {
        'Pedido': 'pedido_id',
        'posicion pedido': 'posicion',
        'clase pedido': 'clase_pedido',
        'solped': 'solped_id',
        'posicion solped': 'solped_posicion',
        'Material': 'material_codigo',
        'Cantidad pedido': 'cantidad_pedida',
        'Cantidad Recepcionada': 'cantidad_recepcionada',
        'UM': 'unidad_medida',
        'UM.1': 'unidad_medida_recepcion',
        'Valor Pedido': 'valor_pedido',
        'Valor Recibido': 'valor_recibido',
        'Valor Facturado por proveedor': 'valor_facturado',
        'moneda pedido': 'moneda_pedido',
        'moneda factura proveedor': 'moneda_factura',
        'Fecha Pedido': 'fecha_pedido',
        'Fecha Entrega Pedido': 'fecha_entrega_prevista',
        'fecha recepcion': 'fecha_recepcion',
        'estrategia liberacion pedido': 'estrategia_liberacion',
        'fecha liberacion pedido': 'fecha_liberacion',
        'Proveedor cuit': 'proveedor_cuit',
        'nombre proveedor': 'proveedor_nombre',
        'contrato marco proveedor': 'contrato_marco',
        'posicion contrato marco proveedor': 'contrato_marco_posicion',
    }

    def __init__(self, db_path: str = 'data/spm.db', verbose: bool = False):
        self.db_path = Path(db_path)
        self.verbose = verbose
        self.stats = {
            'solpeds_inserted': 0,
            'solpeds_updated': 0,
            'solpeds_skipped': 0,
            'po_inserted': 0,
            'po_updated': 0,
            'po_skipped': 0,
            'errors': 0
        }
        self.import_batch = datetime.now().strftime('%Y%m%d_%H%M%S')

    def log(self, message: str, level: str = 'info'):
        """Log con timestamp"""
        if self.verbose or level in ('error', 'warning'):
            timestamp = datetime.now().strftime('%H:%M:%S')
            prefix = {'info': '[INFO]', 'warning': '[WARN]', 'error': '[ERROR]'}.get(level, '[INFO]')
            print(f"{timestamp} {prefix} {message}")

    def calculate_hash(self, row: pd.Series, fields: list) -> str:
        """Genera hash MD5 de campos clave para deteccion de cambios"""
        values = [str(row.get(f, '')) for f in fields]
        return hashlib.md5('|'.join(values).encode()).hexdigest()

    def parse_date(self, value) -> Optional[str]:
        """Convierte fecha a formato ISO"""
        if pd.isna(value) or value == '' or value is None:
            return None
        try:
            if isinstance(value, str):
                # Intentar varios formatos
                for fmt in ['%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y']:
                    try:
                        return datetime.strptime(value.strip(), fmt).strftime('%Y-%m-%d')
                    except ValueError:
                        continue
            elif hasattr(value, 'strftime'):
                return value.strftime('%Y-%m-%d')
            return None
        except Exception:
            return None

    def clean_value(self, value) -> Any:
        """Limpia valores para insercion en BD"""
        if pd.isna(value):
            return None
        if isinstance(value, float) and value != value:  # NaN check
            return None
        if isinstance(value, str):
            value = value.strip()
            return value if value else None
        return value

    def ensure_tables_exist(self, conn: sqlite3.Connection):
        """Crea las tablas si no existen"""
        migration_path = ROOT_DIR / 'infra' / 'migrations' / '003_sap_procurement.sql'
        if migration_path.exists():
            self.log(f"Ejecutando migracion: {migration_path}")
            with open(migration_path, 'r', encoding='utf-8') as f:
                sql = f.read()
            conn.executescript(sql)
            conn.commit()
        else:
            self.log(f"Archivo de migracion no encontrado: {migration_path}", 'warning')

    def import_file(self, xlsx_path: str, user_id: str = 'system') -> Dict[str, Any]:
        """
        Importa archivo Excel ZM65 con deteccion incremental

        Args:
            xlsx_path: Ruta al archivo Excel
            user_id: ID del usuario que ejecuta la importacion

        Returns:
            Diccionario con estadisticas de importacion
        """
        xlsx_path = Path(xlsx_path)
        if not xlsx_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {xlsx_path}")

        self.log(f"Leyendo archivo: {xlsx_path}")
        df = pd.read_excel(xlsx_path)
        self.log(f"Registros en archivo: {len(df)}")

        # Conectar a la BD
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row

        import_log_id = None
        try:
            # Asegurar que las tablas existen
            self.ensure_tables_exist(conn)

            # Registrar inicio de importacion
            import_log_id = self._start_import_log(conn, xlsx_path.name, len(df), user_id)

            # Importar SOLPEDs
            self.log("Importando SOLPEDs...")
            self._import_solpeds(conn, df)

            # Importar Purchase Orders
            self.log("Importando Purchase Orders...")
            self._import_purchase_orders(conn, df)

            # Actualizar precios negociados
            self.log("Actualizando precios negociados...")
            self._update_supplier_prices(conn)

            # Finalizar log de importacion
            self._finish_import_log(conn, import_log_id)

            conn.commit()
            self.log("Importacion completada exitosamente")

        except Exception as e:
            conn.rollback()
            self.log(f"Error durante importacion: {e}", 'error')
            if import_log_id:
                self._fail_import_log(conn, import_log_id, str(e))
            raise
        finally:
            conn.close()

        return self.stats

    def _start_import_log(self, conn: sqlite3.Connection, filename: str, total: int, user_id: str) -> int:
        """Registra inicio de importacion"""
        cursor = conn.execute("""
            INSERT INTO sap_import_log (filename, import_type, records_total, status, user_id)
            VALUES (?, 'ZM65', ?, 'started', ?)
        """, (filename, total, user_id))
        return cursor.lastrowid

    def _finish_import_log(self, conn: sqlite3.Connection, log_id: int):
        """Actualiza log con resultados"""
        conn.execute("""
            UPDATE sap_import_log
            SET status = 'completed',
                completed_at = datetime('now'),
                records_inserted = ?,
                records_updated = ?,
                records_skipped = ?,
                records_error = ?
            WHERE id = ?
        """, (
            self.stats['solpeds_inserted'] + self.stats['po_inserted'],
            self.stats['solpeds_updated'] + self.stats['po_updated'],
            self.stats['solpeds_skipped'] + self.stats['po_skipped'],
            self.stats['errors'],
            log_id
        ))

    def _fail_import_log(self, conn: sqlite3.Connection, log_id: int, error: str):
        """Marca importacion como fallida"""
        try:
            conn.execute("""
                UPDATE sap_import_log
                SET status = 'failed',
                    completed_at = datetime('now'),
                    error_message = ?
                WHERE id = ?
            """, (error, log_id))
            conn.commit()
        except Exception:
            pass

    def _import_solpeds(self, conn: sqlite3.Connection, df: pd.DataFrame):
        """Importa registros de SOLPEDs"""
        hash_fields = ['solped', 'posicion solped', 'cantidad solped', 'precio solped', 'estrategia liberacion solped']

        for _, row in df.iterrows():
            try:
                solped_id = int(row.get('solped', 0))
                posicion = int(row.get('posicion solped', 0))

                if not solped_id or not posicion:
                    self.stats['errors'] += 1
                    continue

                # Calcular hash
                new_hash = self.calculate_hash(row, hash_fields)

                # Verificar si existe y si cambio
                existing = conn.execute(
                    "SELECT import_hash FROM sap_solpeds WHERE solped_id = ? AND posicion = ?",
                    (solped_id, posicion)
                ).fetchone()

                if existing:
                    if existing['import_hash'] == new_hash:
                        self.stats['solpeds_skipped'] += 1
                        continue
                    # Actualizar
                    self._update_solped(conn, row, new_hash)
                    self.stats['solpeds_updated'] += 1
                else:
                    # Insertar
                    self._insert_solped(conn, row, new_hash)
                    self.stats['solpeds_inserted'] += 1

            except Exception as e:
                self.log(f"Error en fila SOLPED: {e}", 'warning')
                self.stats['errors'] += 1

    def _insert_solped(self, conn: sqlite3.Connection, row: pd.Series, hash_val: str):
        """Inserta un registro SOLPED"""
        conn.execute("""
            INSERT INTO sap_solpeds (
                solped_id, posicion, clase_solped, material_codigo, material_descripcion,
                grupo_articulos, cantidad, precio_unitario, importe_total, moneda,
                unidad_medida, fecha_creacion, fecha_entrega_solicitada, estrategia_liberacion,
                fecha_liberacion, centro, grupo_compras, creado_por, solicitante,
                numero_necesidad, tipo_imputacion, centro_costos, import_hash, import_batch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int(row.get('solped', 0)),
            int(row.get('posicion solped', 0)),
            self.clean_value(row.get('clase solped')),
            str(int(row.get('Material', 0))) if pd.notna(row.get('Material')) else None,
            self.clean_value(row.get('Texto breve')),
            self.clean_value(row.get('Grupo articulos')),
            self.clean_value(row.get('cantidad solped')),
            self.clean_value(row.get('precio solped')),
            self.clean_value(row.get('importe total posicion solped')),
            self.clean_value(row.get('moneda solped')) or 'ARP',
            self.clean_value(row.get('UM')) or 'UN',
            self.parse_date(row.get('fecha creacion solped')),
            self.parse_date(row.get('fecha entrega solped')),
            self.clean_value(row.get('estrategia liberacion solped')),
            self.parse_date(row.get('fecha liberacion')),
            int(row.get('Centro', 0)) if pd.notna(row.get('Centro')) else None,
            self.clean_value(row.get('Grupo de compras')),
            self.clean_value(row.get('Creado por')),
            self.clean_value(row.get('Solicitante')),
            self.clean_value(row.get('numero necesidad')),
            self.clean_value(row.get('tipo imputacion')),
            self.clean_value(row.get('centro de costos')),
            hash_val,
            self.import_batch
        ))

    def _update_solped(self, conn: sqlite3.Connection, row: pd.Series, hash_val: str):
        """Actualiza un registro SOLPED existente"""
        conn.execute("""
            UPDATE sap_solpeds SET
                clase_solped = ?, material_descripcion = ?, grupo_articulos = ?,
                cantidad = ?, precio_unitario = ?, importe_total = ?, moneda = ?,
                unidad_medida = ?, fecha_entrega_solicitada = ?, estrategia_liberacion = ?,
                fecha_liberacion = ?, grupo_compras = ?, creado_por = ?, solicitante = ?,
                numero_necesidad = ?, tipo_imputacion = ?, centro_costos = ?,
                import_hash = ?, updated_at = datetime('now')
            WHERE solped_id = ? AND posicion = ?
        """, (
            self.clean_value(row.get('clase solped')),
            self.clean_value(row.get('Texto breve')),
            self.clean_value(row.get('Grupo articulos')),
            self.clean_value(row.get('cantidad solped')),
            self.clean_value(row.get('precio solped')),
            self.clean_value(row.get('importe total posicion solped')),
            self.clean_value(row.get('moneda solped')) or 'ARP',
            self.clean_value(row.get('UM')) or 'UN',
            self.parse_date(row.get('fecha entrega solped')),
            self.clean_value(row.get('estrategia liberacion solped')),
            self.parse_date(row.get('fecha liberacion')),
            self.clean_value(row.get('Grupo de compras')),
            self.clean_value(row.get('Creado por')),
            self.clean_value(row.get('Solicitante')),
            self.clean_value(row.get('numero necesidad')),
            self.clean_value(row.get('tipo imputacion')),
            self.clean_value(row.get('centro de costos')),
            hash_val,
            int(row.get('solped', 0)),
            int(row.get('posicion solped', 0))
        ))

    def _import_purchase_orders(self, conn: sqlite3.Connection, df: pd.DataFrame):
        """Importa registros de Purchase Orders"""
        hash_fields = ['Pedido', 'posicion pedido', 'Cantidad pedido', 'Cantidad Recepcionada', 'Valor Pedido']

        # Solo filas con pedido
        df_with_po = df[df['Pedido'].notna()]
        self.log(f"Registros con Pedido: {len(df_with_po)}")

        for _, row in df_with_po.iterrows():
            try:
                pedido_id = int(row.get('Pedido', 0))
                if not pedido_id:
                    continue

                solped_id = int(row.get('solped', 0))
                solped_posicion = int(row.get('posicion solped', 0))
                posicion = int(row.get('posicion pedido', 0)) if pd.notna(row.get('posicion pedido')) else 0

                # Calcular hash
                new_hash = self.calculate_hash(row, hash_fields)

                # Verificar si existe
                existing = conn.execute("""
                    SELECT import_hash FROM sap_purchase_orders
                    WHERE pedido_id = ? AND COALESCE(posicion, 0) = ?
                      AND solped_id = ? AND COALESCE(solped_posicion, 0) = ?
                """, (pedido_id, posicion, solped_id, solped_posicion)).fetchone()

                if existing:
                    if existing['import_hash'] == new_hash:
                        self.stats['po_skipped'] += 1
                        continue
                    self._update_purchase_order(conn, row, new_hash)
                    self.stats['po_updated'] += 1
                else:
                    self._insert_purchase_order(conn, row, new_hash)
                    self.stats['po_inserted'] += 1

            except Exception as e:
                self.log(f"Error en fila PO: {e}", 'warning')
                self.stats['errors'] += 1

    def _insert_purchase_order(self, conn: sqlite3.Connection, row: pd.Series, hash_val: str):
        """Inserta un registro de Purchase Order"""
        conn.execute("""
            INSERT INTO sap_purchase_orders (
                pedido_id, posicion, clase_pedido, solped_id, solped_posicion,
                material_codigo, cantidad_pedida, cantidad_recepcionada,
                unidad_medida, unidad_medida_recepcion, valor_pedido, valor_recibido,
                valor_facturado, moneda_pedido, moneda_factura, fecha_pedido,
                fecha_entrega_prevista, fecha_recepcion, estrategia_liberacion,
                fecha_liberacion, proveedor_cuit, proveedor_nombre, contrato_marco,
                contrato_marco_posicion, import_hash, import_batch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            int(row.get('Pedido', 0)),
            int(row.get('posicion pedido', 0)) if pd.notna(row.get('posicion pedido')) else None,
            self.clean_value(row.get('clase pedido')),
            int(row.get('solped', 0)),
            int(row.get('posicion solped', 0)),
            str(int(row.get('Material', 0))) if pd.notna(row.get('Material')) else None,
            self.clean_value(row.get('Cantidad pedido')),
            self.clean_value(row.get('Cantidad Recepcionada')),
            self.clean_value(row.get('UM')),
            self.clean_value(row.get('UM.1')),
            self.clean_value(row.get('Valor Pedido')),
            self.clean_value(row.get('Valor Recibido')),
            self.clean_value(row.get('Valor Facturado por proveedor')),
            self.clean_value(row.get('moneda pedido')),
            self.clean_value(row.get('moneda factura proveedor')),
            self.parse_date(row.get('Fecha Pedido')),
            self.parse_date(row.get('Fecha Entrega Pedido')),
            self.parse_date(row.get('fecha recepcion')),
            self.clean_value(row.get('estrategia liberacion pedido')),
            self.parse_date(row.get('fecha liberacion pedido')),
            str(int(row.get('Proveedor cuit', 0))) if pd.notna(row.get('Proveedor cuit')) else None,
            self.clean_value(row.get('nombre proveedor')),
            str(int(row.get('contrato marco proveedor', 0))) if pd.notna(row.get('contrato marco proveedor')) else None,
            str(int(row.get('posicion contrato marco proveedor', 0))) if pd.notna(row.get('posicion contrato marco proveedor')) else None,
            hash_val,
            self.import_batch
        ))

    def _update_purchase_order(self, conn: sqlite3.Connection, row: pd.Series, hash_val: str):
        """Actualiza un registro de Purchase Order existente"""
        conn.execute("""
            UPDATE sap_purchase_orders SET
                clase_pedido = ?, cantidad_pedida = ?, cantidad_recepcionada = ?,
                unidad_medida = ?, unidad_medida_recepcion = ?, valor_pedido = ?,
                valor_recibido = ?, valor_facturado = ?, moneda_pedido = ?,
                moneda_factura = ?, fecha_entrega_prevista = ?, fecha_recepcion = ?,
                estrategia_liberacion = ?, fecha_liberacion = ?, proveedor_cuit = ?,
                proveedor_nombre = ?, contrato_marco = ?, contrato_marco_posicion = ?,
                import_hash = ?, updated_at = datetime('now')
            WHERE pedido_id = ? AND COALESCE(posicion, 0) = ?
              AND solped_id = ? AND COALESCE(solped_posicion, 0) = ?
        """, (
            self.clean_value(row.get('clase pedido')),
            self.clean_value(row.get('Cantidad pedido')),
            self.clean_value(row.get('Cantidad Recepcionada')),
            self.clean_value(row.get('UM')),
            self.clean_value(row.get('UM.1')),
            self.clean_value(row.get('Valor Pedido')),
            self.clean_value(row.get('Valor Recibido')),
            self.clean_value(row.get('Valor Facturado por proveedor')),
            self.clean_value(row.get('moneda pedido')),
            self.clean_value(row.get('moneda factura proveedor')),
            self.parse_date(row.get('Fecha Entrega Pedido')),
            self.parse_date(row.get('fecha recepcion')),
            self.clean_value(row.get('estrategia liberacion pedido')),
            self.parse_date(row.get('fecha liberacion pedido')),
            str(int(row.get('Proveedor cuit', 0))) if pd.notna(row.get('Proveedor cuit')) else None,
            self.clean_value(row.get('nombre proveedor')),
            str(int(row.get('contrato marco proveedor', 0))) if pd.notna(row.get('contrato marco proveedor')) else None,
            str(int(row.get('posicion contrato marco proveedor', 0))) if pd.notna(row.get('posicion contrato marco proveedor')) else None,
            hash_val,
            int(row.get('Pedido', 0)),
            int(row.get('posicion pedido', 0)) if pd.notna(row.get('posicion pedido')) else 0,
            int(row.get('solped', 0)),
            int(row.get('posicion solped', 0))
        ))

    def _update_supplier_prices(self, conn: sqlite3.Connection):
        """Actualiza tabla de precios negociados con datos de las POs"""
        # Agregar columnas si no existen
        try:
            conn.execute("ALTER TABLE proveedor_precios_negociados ADD COLUMN moneda_original TEXT")
        except sqlite3.OperationalError:
            pass  # Columna ya existe

        try:
            conn.execute("ALTER TABLE proveedor_precios_negociados ADD COLUMN fuente TEXT")
        except sqlite3.OperationalError:
            pass

        # Insertar precios unicos proveedor-material
        conn.execute("""
            INSERT OR IGNORE INTO proveedor_precios_negociados
                (cuit_proveedor, codigo_material, precio_usd, moneda, fecha_vigencia_desde,
                 cantidad_minima, moneda_original, fuente, activo)
            SELECT DISTINCT
                p.proveedor_cuit,
                s.material_codigo,
                CASE
                    WHEN s.moneda = 'USD' THEN s.precio_unitario
                    WHEN s.moneda = 'ARP' THEN s.precio_unitario / 1050.0
                    WHEN s.moneda = 'EUR' THEN s.precio_unitario * 1.08
                    ELSE s.precio_unitario / 1050.0
                END,
                'USD',
                MIN(s.fecha_creacion),
                1,
                s.moneda,
                'ZM65_IMPORT',
                1
            FROM sap_solpeds s
            INNER JOIN sap_purchase_orders p
                ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
            WHERE p.proveedor_cuit IS NOT NULL
              AND s.precio_unitario IS NOT NULL
              AND s.precio_unitario > 0
            GROUP BY p.proveedor_cuit, s.material_codigo, s.moneda
        """)

        prices_added = conn.execute(
            "SELECT changes() as count"
        ).fetchone()['count']

        self.log(f"Precios de proveedores actualizados: {prices_added}")


def main():
    parser = argparse.ArgumentParser(description='Importar archivo ZM65 (Requisiciones SAP)')
    parser.add_argument('file', help='Ruta al archivo Excel ZM65.xlsx')
    parser.add_argument('--db', default='data/spm.db', help='Ruta a la base de datos')
    parser.add_argument('--verbose', '-v', action='store_true', help='Mostrar logs detallados')
    parser.add_argument('--user', default='system', help='ID del usuario que ejecuta')

    args = parser.parse_args()

    importer = ZM65Importer(db_path=args.db, verbose=args.verbose)

    try:
        stats = importer.import_file(args.file, user_id=args.user)

        print("\n" + "=" * 50)
        print("RESULTADO DE IMPORTACION")
        print("=" * 50)
        print(f"SOLPEDs insertados:  {stats['solpeds_inserted']}")
        print(f"SOLPEDs actualizados: {stats['solpeds_updated']}")
        print(f"SOLPEDs sin cambios:  {stats['solpeds_skipped']}")
        print(f"POs insertadas:       {stats['po_inserted']}")
        print(f"POs actualizadas:     {stats['po_updated']}")
        print(f"POs sin cambios:      {stats['po_skipped']}")
        print(f"Errores:              {stats['errors']}")
        print("=" * 50)

    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error durante importacion: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
