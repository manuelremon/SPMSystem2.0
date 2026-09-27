"""Stock inmovilizado: definicion unica (sin consumo en 12 meses al corte, por material+centro+almacen)."""

import importlib.util
from contextlib import contextmanager
from datetime import date
from pathlib import Path

import pytest
from flask import Flask

from backend.core import db as db_module
from backend.services import inmovilizado_service as svc

CORTE = "2025-07-19"

# material, centro, almacen, stock, precio, valorizado, marca SAP, lote
STOCK = [
    # A: consumio dentro de los 12 meses previos al corte -> NO inmovilizado (aunque SAP diga INMOVILIZADO)
    ("A", "C1", "W1", 10, 1.0, 10.0, "INMOVILIZADO", "L1"),
    # A en otra fila de la misma clave con marca distinta -> una sola clave
    ("A", "C1", "W1", 5, 1.0, 5.0, "NO INMOVILIZADO", "L2"),
    # B: ultimo consumo hace mas de 12 meses -> inmovilizado (aunque SAP diga NO)
    ("B", "C1", "W1", 3, 10.0, 30.0, "NO INMOVILIZADO", "L1"),
    # C: nunca consumio -> inmovilizado, dias null
    ("C", "C1", "W2", 2, 50.0, 100.0, "NO INMOVILIZADO", "L1"),
    # D: solo consumo POSTERIOR al corte -> no cuenta -> inmovilizado
    ("D", "C2", "W1", 1, 7.0, 7.0, "NO INMOVILIZADO", "L1"),
    # E: consumo en el mismo material+centro pero OTRO almacen -> inmovilizado
    ("E", "C1", "W1", 4, 2.0, 8.0, "NO INMOVILIZADO", "L1"),
]
CONSUMO = [
    # fecha, centro, almacen, cantidad, material
    ("2025-01-10", "C1", "W1", 1, "A"),
    ("2024-07-19", "C1", "W1", 1, "B"),  # exactamente corte - 365: fuera de la ventana
    ("2025-07-20", "C2", "W1", 1, "D"),  # posterior al corte
    ("2025-05-01", "C1", "W9", 1, "E"),
]


def _crear_db(path):
    conn = db_module._connect_sqlite(path)
    conn.execute(
        "CREATE TABLE stock (dia TEXT, material TEXT, material_descripcion TEXT, centro TEXT,"
        " centro_descripcion TEXT, almacen TEXT, stock REAL, um TEXT, precio REAL,"
        " stock_valorizado REAL, inmovilizado TEXT, lote TEXT)"
    )
    conn.execute(
        "CREATE TABLE consumo_historico (fecha TEXT, centro TEXT, almacen TEXT, cantidad REAL,"
        " material TEXT, descripcion TEXT)"
    )
    conn.execute(
        "CREATE TABLE materiales_bbdd (codigo_material TEXT, centro TEXT, almacen TEXT,"
        " punto_de_pedido INTEGER, stock_de_seguridad INTEGER)"
    )
    conn.executemany(
        "INSERT INTO stock VALUES (?, ?, ?, ?, ?, ?, ?, 'UN', ?, ?, ?, ?)",
        [(CORTE, m, f"DESC {m}", c, f"Centro {c}", a, s, p, v, marca, lote) for m, c, a, s, p, v, marca, lote in STOCK],
    )
    conn.executemany(
        "INSERT INTO consumo_historico VALUES (?, ?, ?, ?, ?, 'x')", CONSUMO
    )
    conn.execute("INSERT INTO materiales_bbdd VALUES ('B', 'C1', 'W1', 5, 0)")
    conn.commit()
    conn.close()


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = str(tmp_path / "sap.db")
    _crear_db(path)

    @contextmanager
    def _conn(db_name="spm"):
        c = db_module._connect_sqlite(path)
        try:
            yield c
        finally:
            c.close()

    import backend.routes.kpis as kpis
    import backend.routes.stock as stock

    for mod in (svc, stock, kpis):
        if hasattr(mod, "get_db_connection"):
            monkeypatch.setattr(mod, "get_db_connection", _conn)
    monkeypatch.setattr(stock, "is_using_postgresql", lambda: False)
    return path


@pytest.fixture
def cur(db_path):
    conn = db_module._connect_sqlite(db_path)
    yield conn.cursor()
    conn.close()


def _por_material(filas):
    return {f["material"]: f for f in filas}


class TestFechaCorte:
    def test_corte_es_max_dia_del_stock(self, cur):
        assert svc.fecha_corte(cur) == date(2025, 7, 19)

    def test_sin_fecha_usa_hoy(self, cur):
        cur.execute("UPDATE stock SET dia = NULL")
        assert svc.fecha_corte(cur) == date.today()

    def test_dias_sin_movimiento(self):
        corte = date(2025, 7, 19)
        assert svc.dias_sin_movimiento("2025-07-09", corte) == 10
        assert svc.dias_sin_movimiento(date(2025, 7, 19), corte) == 0
        assert svc.dias_sin_movimiento(None, corte) is None


class TestListado:
    def test_una_fila_por_clave_y_definicion(self, cur):
        filas, total = svc.listar_stock(cur)
        assert total == 5
        m = _por_material(filas)
        assert m["A"]["inmovilizado"] is False  # consumo dentro de 12 meses; la marca SAP no decide
        assert m["A"]["inmovilizado_sap"] is True
        assert m["A"]["stock"] == 15
        assert m["B"]["inmovilizado"] is True  # consumo mas viejo que 12 meses
        assert m["B"]["inmovilizado_sap"] is False
        assert m["C"]["inmovilizado"] is True  # nunca consumio
        assert m["D"]["inmovilizado"] is True  # consumo posterior al corte no cuenta
        assert m["E"]["inmovilizado"] is True  # otro almacen no cuenta

    def test_dias_sin_movimiento_respecto_del_corte(self, cur):
        m = _por_material(svc.listar_stock(cur)[0])
        assert m["A"]["dias_sin_movimiento"] == (date(2025, 7, 19) - date(2025, 1, 10)).days
        assert m["B"]["dias_sin_movimiento"] == 365
        assert m["C"]["dias_sin_movimiento"] is None
        assert m["D"]["dias_sin_movimiento"] is None  # no hay consumo al corte
        assert m["C"]["ultimo_consumo"] is None

    def test_filtro_inmovilizado(self, cur):
        si, total_si = svc.listar_stock(cur, inmovilizado="true")
        no, total_no = svc.listar_stock(cur, inmovilizado="false")
        assert {f["material"] for f in si} == {"B", "C", "D", "E"} and total_si == 4
        assert {f["material"] for f in no} == {"A"} and total_no == 1

    def test_filtro_mrp_y_centro(self, cur):
        assert [f["material"] for f in svc.listar_stock(cur, mrp="true")[0]] == ["B"]
        assert {f["material"] for f in svc.listar_stock(cur, centro="C2")[0]} == {"D"}

    def test_marca_sap_no_cambia_resultado(self, cur):
        antes = {f["material"]: f["inmovilizado"] for f in svc.listar_stock(cur)[0]}
        cur.execute(
            "UPDATE stock SET inmovilizado = CASE inmovilizado WHEN 'INMOVILIZADO' THEN 'NO INMOVILIZADO'"
            " ELSE 'INMOVILIZADO' END"
        )
        despues = {f["material"]: f["inmovilizado"] for f in svc.listar_stock(cur)[0]}
        assert antes == despues

    def test_orden_por_dias_sin_movimiento(self, cur):
        filas, _ = svc.listar_stock(cur, sort="dias_sin_movimiento", order="desc")
        # nunca consumidos primero (null = maximo), luego B (365), luego A
        assert [f["material"] for f in filas][-2:] == ["B", "A"]


class TestResumen:
    def test_cifras(self, cur):
        r = svc.resumen_stock(cur)
        assert r["fecha_corte"] == CORTE
        assert r["total_items"] == 5
        assert r["inmovilizado_items"] == 4
        assert r["inmovilizado_valor"] == pytest.approx(30 + 100 + 7 + 8)
        assert r["sin_consumo_365d"] == 4
        assert r["mrp_items"] == 1
        assert r["valor_total"] == pytest.approx(160)

    def test_mismas_cifras_que_el_listado(self, cur):
        for filtros in ({}, {"centro": "C1"}, {"almacen": "W1"}):
            r = svc.resumen_stock(cur, **filtros)
            filas, total = svc.listar_stock(cur, limit=500, **filtros)
            inm = [f for f in filas if f["inmovilizado"]]
            assert r["total_items"] == total
            assert r["inmovilizado_items"] == len(inm) == svc.listar_stock(cur, inmovilizado="true", **filtros)[1]
            assert r["inmovilizado_valor"] == pytest.approx(sum(f["stock_valorizado"] for f in inm))


class TestRutas:
    def test_resumen_legacy_expone_fecha_corte(self, db_path):
        from backend.routes import stock

        app = Flask(__name__)
        with app.test_request_context("/api/stock/resumen"):
            data = stock.get_stock_resumen.__wrapped__().get_json()
        assert data["ok"] and data["data"]["fecha_corte"] == CORTE
        assert data["data"]["inmovilizado_items"] == 4

    def test_listado_legacy_dias_null(self, db_path):
        from backend.routes import stock

        app = Flask(__name__)
        with app.test_request_context("/api/stock?limit=50"):
            data = stock.get_stock.__wrapped__().get_json()
        m = _por_material(data["data"])
        assert data["total"] == 5
        assert m["C"]["dias_sin_movimiento"] is None
        assert m["A"]["inmovilizado"] is False

    def test_kpi_stock_inmovilizado(self, db_path):
        from backend.routes import kpis

        app = Flask(__name__)
        with app.test_request_context("/api/kpis/stock-inmovilizado"):
            data = kpis.get_stock_inmovilizado.__wrapped__().get_json()
        assert data["ok"]
        assert data["fecha_corte"] == CORTE
        assert data["globalTotal"] == 4  # mismas claves que el resumen de stock
        assert data["globalValorTotal"] == pytest.approx(145)
        assert {i["codigo"] for i in data["items"]} == {"B", "C", "D", "E"}

    def test_kpi_periodo_amplia_ventana(self, db_path):
        from backend.routes import kpis

        app = Flask(__name__)
        with app.test_request_context("/api/kpis/stock-inmovilizado?periodo_anos=2"):
            data = kpis.get_stock_inmovilizado.__wrapped__().get_json()
        # con 24 meses B (consumo 2024-07-19) ya no esta inmovilizado
        assert {i["codigo"] for i in data["items"]} == {"C", "D", "E"}
        assert data["globalTotal"] == 4  # el global siempre es 12 meses


# ---------------------------------------------------------------------------
# Migracion 103
# ---------------------------------------------------------------------------

def _cargar_migracion():
    ruta = Path(__file__).resolve().parents[2] / "backend" / "migrations" / "103_curar_consumo_inmovilizado.py"
    spec = importlib.util.spec_from_file_location("mig_103", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestMigracion103:
    def test_borra_duplicados_exactos_y_es_idempotente(self, db_path, monkeypatch):
        conn = db_module._connect_sqlite(db_path)
        conn.executemany(
            "INSERT INTO consumo_historico VALUES (?, ?, ?, ?, ?, 'x')",
            [CONSUMO[0], CONSUMO[0], CONSUMO[1]],  # 3 duplicados exactos
        )
        # misma clave pero distinta cantidad: NO es duplicado exacto
        conn.execute("INSERT INTO consumo_historico VALUES ('2025-01-10', 'C1', 'W1', 99, 'A', 'x')")
        conn.commit()
        conn.close()

        mig = _cargar_migracion()

        @contextmanager
        def _conn(db_name="spm"):
            assert db_name == "sap_data"
            c = db_module._connect_sqlite(db_path)
            try:
                yield c
            finally:
                c.close()

        monkeypatch.setattr(mig, "get_db_connection", _conn)
        monkeypatch.setattr(mig, "is_using_postgresql", lambda: False)

        def _contar():
            c = db_module._connect_sqlite(db_path)
            n = c.execute("SELECT COUNT(*) FROM consumo_historico").fetchone()[0]
            c.close()
            return n

        assert _contar() == len(CONSUMO) + 4
        mig.up()
        assert _contar() == len(CONSUMO) + 1
        mig.up()
        assert _contar() == len(CONSUMO) + 1

    def test_sql_vista_usa_la_definicion_unica(self):
        mig = _cargar_migracion()
        sql = mig.sql_stock_vista()
        assert "GROUP BY s.material, s.centro, s.almacen" in sql
        assert "inmovilizado_sap" in sql and "dias_sin_movimiento" in sql and "fecha_corte" in sql
        assert "CURRENT_DATE - INTERVAL" not in sql
