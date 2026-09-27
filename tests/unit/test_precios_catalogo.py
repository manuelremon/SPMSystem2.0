"""
Migracion 104: precio del catalogo = precio SAP ponderado del stock.

- SQLite: catalogo (master_materiales) y stock (sap_data) en archivos distintos.
- PG: misma BD, tabla base cat_materiales detras de la vista catalogo_materiales;
  se prueba con un cursor que devuelve DictRow (desempaquetar da los nombres).
"""

import importlib.util
from contextlib import contextmanager
from pathlib import Path

import pytest

from backend.core import db as db_module

CATALOGO = [
    ("0503-0000103", 27391.0),  # aceite: SAP 0,43
    ("0912-0000504", 21487.0),  # rodamiento: SAP 1,53
    ("0206-0000398", 500.0),  # sin stock -> sin precio
    ("0101-0000001", 10.0),  # stock valorizado en 0 -> sin precio
    ("0101-0000002", 7.0),  # precio SAP que redondea a 0,00 -> sin precio
]

STOCK = [
    # material, stock, stock_valorizado
    ("0503-0000103", 10, 4.3),
    ("0503-0000103", 10, 4.3),
    ("0503-0000103", 0, 999.0),  # stock 0: no pondera
    ("0912-0000504", 2, 3.06),
    ("0101-0000001", 5, 0.0),
    ("0101-0000002", 1000, 1.0),
    (None, 3, 3.0),  # material nulo no rompe el NOT EXISTS
]

ESPERADO = {
    "0503-0000103": 0.43,
    "0912-0000504": 1.53,
    "0206-0000398": None,
    "0101-0000001": None,
    "0101-0000002": None,
}


def _cargar_migracion():
    ruta = Path(__file__).resolve().parents[2] / "backend" / "migrations" / "104_precios_catalogo_sap.py"
    spec = importlib.util.spec_from_file_location("mig_104", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _leer(path, tabla):
    c = db_module._connect_sqlite(path)
    filas = c.execute(f"SELECT codigo, precio_usd, precio_usd_relleno FROM {tabla}").fetchall()
    c.close()
    return {f[0]: (f[1], f[2]) for f in filas}


def _crear_stock(conn, tabla):
    conn.execute(f"CREATE TABLE {tabla} (material TEXT, stock REAL, stock_valorizado REAL)")
    conn.executemany(f"INSERT INTO {tabla} VALUES (?, ?, ?)", STOCK)


# ---------------------------------------------------------------------------
# SQLite: dos archivos
# ---------------------------------------------------------------------------


@pytest.fixture
def sqlite_dbs(tmp_path, monkeypatch):
    master = str(tmp_path / "master.db")
    sap = str(tmp_path / "sap.db")
    c = db_module._connect_sqlite(master)
    c.execute("CREATE TABLE catalogo_materiales (codigo TEXT PRIMARY KEY, descripcion TEXT, precio_usd REAL)")
    c.executemany("INSERT INTO catalogo_materiales (codigo, precio_usd) VALUES (?, ?)", CATALOGO)
    c.commit()
    c.close()
    c = db_module._connect_sqlite(sap)
    _crear_stock(c, "stock")
    c.commit()
    c.close()

    mig = _cargar_migracion()
    rutas = {"master_materiales": master, "sap_data": sap}

    @contextmanager
    def _conn(db_name="spm"):
        conn = db_module._connect_sqlite(rutas[db_name])
        try:
            yield conn
        finally:
            conn.close()

    monkeypatch.setattr(mig, "get_db_connection", _conn)
    monkeypatch.setattr(mig, "is_using_postgresql", lambda: False)
    return mig, master


class TestMigracion104SQLite:
    def test_aplica_precio_sap_y_anula_el_resto(self, sqlite_dbs):
        mig, master = sqlite_dbs
        stats = mig.up()
        datos = _leer(master, "catalogo_materiales")
        for codigo, precio in ESPERADO.items():
            assert datos[codigo][0] == (pytest.approx(precio) if precio is not None else None), codigo
        # el relleno queda guardado para revertir
        assert {k: v[1] for k, v in datos.items()} == dict(CATALOGO)
        assert stats["con_precio_sap"] == 2 and stats["sin_precio"] == 3
        assert stats["actualizados"] == 2 and stats["anulados"] == 3
        assert stats["mediana_antes"] == pytest.approx(500.0)
        assert stats["mediana_despues"] == pytest.approx((0.43 + 1.53) / 2)

    def test_idempotente(self, sqlite_dbs):
        mig, master = sqlite_dbs
        mig.up()
        antes = _leer(master, "catalogo_materiales")
        stats = mig.up()
        assert _leer(master, "catalogo_materiales") == antes
        assert stats["actualizados"] == 0 and stats["anulados"] == 0 and not stats["relleno_copiado"]

    def test_limpia_cache_de_precios(self, sqlite_dbs):
        import backend.core.item_schemas as items

        mig, _ = sqlite_dbs
        items._materiales_validados_cache["5030000103"] = 27391.0
        mig.up()
        assert items._materiales_validados_cache == {}


# ---------------------------------------------------------------------------
# PG: cursor con DictRow sobre una sola BD (tabla base + vista)
# ---------------------------------------------------------------------------


class _CursorDictRow:
    def __init__(self, cur):
        self._cur = cur
        self.ejecutadas = []

    def execute(self, sql, params=()):
        self.ejecutadas.append(sql)
        self._cur.execute(sql, params or ())
        return self

    def _fila(self, row):
        return None if row is None else db_module.DictRow([d[0] for d in self._cur.description], tuple(row))

    def fetchone(self):
        return self._fila(self._cur.fetchone())

    def fetchall(self):
        return [self._fila(r) for r in self._cur.fetchall()]

    @property
    def rowcount(self):
        return self._cur.rowcount


class _ConexionDictRow:
    def __init__(self, path):
        self._conn = db_module._connect_sqlite(path)
        self.cur = _CursorDictRow(self._conn.cursor())

    def cursor(self):
        return self.cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


class TestMigracion104PG:
    def test_modo_pg_con_dictrow(self, tmp_path, monkeypatch):
        path = str(tmp_path / "pg.db")
        c = db_module._connect_sqlite(path)
        c.execute("CREATE TABLE cat_materiales (id INTEGER PRIMARY KEY, codigo TEXT UNIQUE, precio_usd NUMERIC)")
        c.executemany("INSERT INTO cat_materiales (codigo, precio_usd) VALUES (?, ?)", CATALOGO)
        c.execute("CREATE VIEW catalogo_materiales AS SELECT id, codigo, precio_usd FROM cat_materiales")
        _crear_stock(c, "sap_stock")
        c.commit()
        c.close()

        mig = _cargar_migracion()
        conexion = _ConexionDictRow(path)

        @contextmanager
        def _conn(db_name="spm"):
            yield conexion

        def _columnas(cur, tabla):
            cur.execute(f"PRAGMA table_info({tabla})")
            return {f["name"] for f in cur.fetchall()}

        monkeypatch.setattr(mig, "get_db_connection", _conn)
        monkeypatch.setattr(mig, "is_using_postgresql", lambda: True)
        monkeypatch.setattr(mig, "_tabla_base_pg", lambda cur: "cat_materiales")
        monkeypatch.setattr(mig, "_columnas_pg", _columnas)

        stats = mig.up()
        datos = _leer(path, "cat_materiales")
        for codigo, precio in ESPERADO.items():
            assert datos[codigo][0] == (pytest.approx(precio) if precio is not None else None), codigo
        assert {k: v[1] for k, v in datos.items()} == dict(CATALOGO)
        assert stats["con_precio_sap"] == 2 and stats["sin_precio"] == 3
        assert stats["actualizados"] == 2 and stats["anulados"] == 3
        assert stats["mediana_antes"] == pytest.approx(500.0)
        # la columna nueva va a la tabla base, la vista no se toca
        sqls = " ".join(conexion.cur.ejecutadas)
        assert "ALTER TABLE cat_materiales ADD COLUMN precio_usd_relleno" in sqls
        assert not any("VIEW" in s.upper() for s in conexion.cur.ejecutadas)

        stats = mig.up()
        assert stats["actualizados"] == 0 and stats["anulados"] == 0 and not stats["relleno_copiado"]
        assert _leer(path, "cat_materiales") == datos
