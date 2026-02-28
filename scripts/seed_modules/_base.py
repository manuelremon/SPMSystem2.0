"""
Base class y helpers para módulos de seed.
"""

import random
import json
from datetime import datetime, timedelta
from abc import ABC, abstractmethod

try:
    from faker import Faker
    fake = Faker('es_AR')
    Faker.seed(42)
except ImportError:
    raise ImportError("Se requiere 'faker': pip install faker")

SEED_PREFIX = "SEED-"
SEED_TAG = "[SEED]"

# Constantes reutilizables
MONEDAS = ["USD", "ARS", "EUR"]
UNIDADES = ["UN", "KG", "LT", "MT", "M2", "M3", "GL", "JG", "BL", "RO"]
CENTROS_DEFAULT = ["1000", "1100", "1200", "1300", "1400"]
ALMACENES_DEFAULT = ["0001", "0002", "0003", "1001", "1002"]

RUBROS = [
    "Materiales Industriales", "Equipos de Seguridad", "Herramientas",
    "Repuestos Mecanicos", "Electricidad", "Instrumentacion",
    "Quimicos", "Lubricantes", "Ferreteria", "Valvulas",
]


def rand_date(days_back=180, days_forward=0):
    """Genera fecha aleatoria entre -days_back y +days_forward desde hoy."""
    delta = random.randint(-days_back, days_forward)
    return (datetime.now() + timedelta(days=delta)).strftime('%Y-%m-%d')


def rand_datetime(days_back=180, days_forward=0):
    """Genera datetime aleatorio."""
    delta = random.randint(-days_back, days_forward)
    hours = random.randint(0, 23)
    mins = random.randint(0, 59)
    dt = datetime.now() + timedelta(days=delta, hours=hours - 12, minutes=mins)
    return dt.strftime('%Y-%m-%d %H:%M:%S')


def rand_future_date(days_min=1, days_max=365):
    """Genera fecha futura."""
    delta = random.randint(days_min, days_max)
    return (datetime.now() + timedelta(days=delta)).strftime('%Y-%m-%d')


def rand_past_date(days_min=1, days_max=365):
    """Genera fecha pasada."""
    delta = random.randint(days_min, days_max)
    return (datetime.now() - timedelta(days=delta)).strftime('%Y-%m-%d')


def rand_money(min_val=100, max_val=50000):
    """Genera monto con 2 decimales."""
    return round(random.uniform(min_val, max_val), 2)


def rand_pct(min_val=0, max_val=100):
    """Genera porcentaje."""
    return round(random.uniform(min_val, max_val), 2)


def seed_code(prefix, idx):
    """Genera código identificable como seed: SEED-OC-001."""
    return f"{SEED_PREFIX}{prefix}-{idx:03d}"


def pick(lst):
    """Elige un elemento aleatorio de una lista."""
    return random.choice(lst) if lst else None


def pick_n(lst, n):
    """Elige n elementos aleatorios sin repetición."""
    return random.sample(lst, min(n, len(lst)))


def now_str():
    """Timestamp actual como string."""
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


class SeedModule(ABC):
    """Base class para módulos de seed."""

    name: str = ""          # Nombre corto: "solicitudes", "tms", etc.
    description: str = ""   # Descripción para CLI
    tables: list = []       # Tablas que este módulo puebla (para --clean y --status)

    def __init__(self, conn, refs, verbose=False, debug=False):
        self.conn = conn
        self.refs = refs
        self.verbose = verbose
        self._debug = debug or (hasattr(self, '_debug') and self._debug)
        self._counts = {}

    def log(self, msg):
        if self.verbose:
            print(f"  [{self.name}] {msg}")

    def _get_raw_conn(self):
        """Obtiene la conexión psycopg2 subyacente para SAVEPOINTs."""
        c = self.conn
        # DualModeConnection wraps the real connection
        if hasattr(c, '_conn'):
            return c._conn
        if hasattr(c, 'conn'):
            return c.conn
        return c

    def insert(self, table, data):
        """Insert genérico con dict. Retorna id. Usa SAVEPOINT para aislar errores."""
        cols = list(data.keys())
        vals = list(data.values())
        placeholders = ", ".join(["?"] * len(cols))
        cols_str = ", ".join(cols)
        sql = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})"
        cursor = self.conn.cursor()
        raw = self._get_raw_conn()
        try:
            raw.execute("SAVEPOINT sp_insert")
            cursor.execute(sql + " RETURNING id", vals)
            row = cursor.fetchone()
            raw.execute("RELEASE SAVEPOINT sp_insert")
            self._track(table)
            return row[0] if row else None
        except Exception as e1:
            try:
                raw.execute("ROLLBACK TO SAVEPOINT sp_insert")
            except Exception:
                pass
            if self._debug:
                print(f"    DEBUG {table}: {str(e1).splitlines()[0]}")
            raise

    def insert_no_return(self, table, data):
        """Insert sin esperar retorno de id. Usa SAVEPOINT para aislar errores."""
        cols = list(data.keys())
        vals = list(data.values())
        placeholders = ", ".join(["?"] * len(cols))
        cols_str = ", ".join(cols)
        sql = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})"
        raw = self._get_raw_conn()
        try:
            raw.execute("SAVEPOINT sp_insert")
            self.conn.execute(sql, vals)
            raw.execute("RELEASE SAVEPOINT sp_insert")
            self._track(table)
        except Exception as e:
            try:
                raw.execute("ROLLBACK TO SAVEPOINT sp_insert")
            except Exception:
                pass
            if self._debug:
                print(f"    DEBUG {table}: {str(e).splitlines()[0]}")
            raise

    def _track(self, table):
        self._counts[table] = self._counts.get(table, 0) + 1

    def summary(self):
        """Retorna resumen de inserts."""
        return self._counts

    @abstractmethod
    def seed(self):
        """Ejecuta el seed. Debe ser implementado por cada módulo."""
        pass

    def clean(self):
        """Limpia datos de seed. Por defecto borra registros con SEED- en campos clave."""
        cursor = self.conn.cursor()
        for table in reversed(self.tables):
            try:
                # Intentar borrar por patrones comunes de seed
                for col in ['numero_oc', 'numero_rfq', 'numero_ncr', 'numero_capa',
                            'numero_contrato', 'numero_factura', 'numero_rma',
                            'numero_recall', 'numero_eco', 'numero_asn',
                            'numero_recepcion', 'numero_orden', 'numero_lote',
                            'numero_despacho', 'numero_reclamo', 'codigo',
                            'nombre', 'titulo', 'descripcion', 'notas',
                            'kit_codigo', 'numero_inspeccion', 'clave']:
                    try:
                        cursor.execute(
                            f"DELETE FROM {table} WHERE {col} LIKE ?",
                            (f'%{SEED_PREFIX}%',)
                        )
                        if cursor.rowcount and cursor.rowcount > 0:
                            self.log(f"Cleaned {cursor.rowcount} rows from {table} (col: {col})")
                            break
                    except Exception:
                        continue
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
