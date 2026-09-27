"""Consumo historico de materiales (Inventario): servicio + endpoint."""

from contextlib import contextmanager

import pytest

from backend.core import db as db_module
from backend.services import consumo_historico_service as svc

# fecha, centro, almacen, material, descripcion, cantidad
CONSUMO = [
    ("2024-01-15", "AA101", "0001", "M1", "MATERIAL UNO", 10),
    ("2024-01-20", "AA101", "0001", "M1", "MATERIAL UNO", 5),
    ("2024-02-10", "AA102", "0012", "M2", "MATERIAL DOS SIN PRECIO", 3),
    ("2024-02-11", "AA101", "0001", "M3", "MATERIAL TRES BOMBA CENTRIFUGA", 7),
]

# material, stock, um, stock_valorizado -> precio SAP ponderado = valorizado/stock
# M1: 250/100 = 2.5 ; M3: 80/20 = 4.0 ; M2 NO tiene stock -> sin precio SAP
STOCK = [
    ("M1", 100.0, "UNI", 250.0),
    ("M3", 20.0, "UNI", 80.0),
]

# codigo, descripcion, unidad_medida, precio_usd: dato SINTETICO de relleno (precio_usd
# aqui es un decoy que NUNCA debe usarse para valorizar, solo puede aportar `unidad_medida`
# cuando el material no tiene stock (M2)).
CATALOGO = [
    ("M1", "MATERIAL UNO", "UNI", 999.0),
    ("M3", "MATERIAL TRES BOMBA CENTRIFUGA", "UNI", 999.0),
    ("M2", "MATERIAL DOS SIN PRECIO", "CAJA", 999.0),
]


@pytest.fixture
def dbs(tmp_path):
    """Dos SQLite temporales: sap_data (consumo_historico + stock) y master_materiales (catalogo)."""
    sap_path = str(tmp_path / "sap_data.db")
    master_path = str(tmp_path / "master_materiales.db")

    conn = db_module._connect_sqlite(sap_path)
    conn.execute(
        "CREATE TABLE consumo_historico (fecha TEXT, centro TEXT, almacen TEXT,"
        " material TEXT, descripcion TEXT, cantidad REAL)"
    )
    conn.executemany("INSERT INTO consumo_historico VALUES (?, ?, ?, ?, ?, ?)", CONSUMO)
    conn.execute(
        "CREATE TABLE stock (material TEXT, stock REAL, um TEXT, stock_valorizado REAL)"
    )
    conn.executemany("INSERT INTO stock VALUES (?, ?, ?, ?)", STOCK)
    conn.commit()
    conn.close()

    conn = db_module._connect_sqlite(master_path)
    conn.execute(
        "CREATE TABLE catalogo_materiales (codigo TEXT PRIMARY KEY, descripcion TEXT,"
        " unidad_medida TEXT, precio_usd REAL)"
    )
    conn.executemany("INSERT INTO catalogo_materiales VALUES (?, ?, ?, ?)", CATALOGO)
    conn.commit()
    conn.close()

    return {"sap_data": sap_path, "master_materiales": master_path}


@contextmanager
def _conn_por_nombre(paths, db_name="spm"):
    path = paths.get(db_name, paths["sap_data"])
    c = db_module._connect_sqlite(path)
    try:
        yield c
    finally:
        c.close()


@pytest.fixture
def cur(dbs):
    """Cursor sobre sap_data (consumo_historico), listo para pasar al servicio."""
    conn = db_module._connect_sqlite(dbs["sap_data"])
    yield conn.cursor()
    conn.close()


@pytest.fixture
def conn_factory(dbs):
    """Factory get_db_connection-like que resuelve por nombre de BD, para `obtener_precios`."""
    def factory(db_name="spm"):
        return _conn_por_nombre(dbs, db_name)
    return factory


class TestParsearFecha:
    def test_none_si_vacio(self):
        assert svc.parsear_fecha(None) is None
        assert svc.parsear_fecha("") is None

    def test_parsea_formato_valido(self):
        assert svc.parsear_fecha("2024-01-15").isoformat() == "2024-01-15"

    @pytest.mark.parametrize("valor", ["15-01-2024", "2024/01/15", "no-es-fecha", "2024-13-01"])
    def test_formato_invalido_lanza(self, valor):
        with pytest.raises(svc.FiltroInvalido):
            svc.parsear_fecha(valor)


class TestRangoYCatalogos:
    def test_rango_datos_de_toda_la_tabla(self, cur):
        assert svc.rango_datos(cur) == {"min": "2024-01-15", "max": "2024-02-11"}

    def test_catalogos_validos(self, cur):
        catalogos = svc.catalogos_validos(cur)
        assert catalogos == {"centros": ["AA101", "AA102"], "almacenes": ["0001", "0012"]}


class TestFiltros:
    def test_filtro_por_fecha(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, desde=svc.parsear_fecha("2024-02-01"), conn_factory=conn_factory)
        materiales = {f["material"] for f in r["data"]}
        assert materiales == {"M2", "M3"}

    def test_filtro_por_centro(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, centro="AA102", conn_factory=conn_factory)
        assert {f["material"] for f in r["data"]} == {"M2"}

    def test_filtro_por_almacen(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, almacen="0012", conn_factory=conn_factory)
        assert {f["material"] for f in r["data"]} == {"M2"}

    def test_filtro_por_material_codigo(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, material="M1", conn_factory=conn_factory)
        assert {f["material"] for f in r["data"]} == {"M1"}

    def test_filtro_por_material_descripcion(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, material="bomba centrifuga", conn_factory=conn_factory)
        assert {f["material"] for f in r["data"]} == {"M3"}


class TestAgrupadoPorMaterial:
    def test_agrupar_material_orden_y_campos(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, agrupar="material", conn_factory=conn_factory)
        assert r["truncado"] is False
        codigos = [f["material"] for f in r["data"]]
        # Precio SAP ponderado del stock: M1 = 15*2.5 = 37.5 > M3 = 7*4.0 = 28.0
        assert codigos[0] == "M1"
        assert codigos[-1] == "M2"  # sin stock SAP: sin precio, al final

        m1 = next(f for f in r["data"] if f["material"] == "M1")
        assert m1 == {
            "material": "M1",
            "descripcion": "MATERIAL UNO",
            "unidad": "UNI",
            "movimientos": 2,
            "cantidad_total": 15.0,
            "primer_consumo": "2024-01-15",
            "ultimo_consumo": "2024-01-20",
            "precio_usd": 2.5,
            "valor_usd": 37.5,
        }

        m2 = next(f for f in r["data"] if f["material"] == "M2")
        assert m2["precio_usd"] is None and m2["valor_usd"] is None
        # Sin stock SAP -> unidad se completa desde catalogo (nunca su precio, que es 999 = decoy)
        assert m2["unidad"] == "CAJA"

    def test_material_con_solo_precio_de_catalogo_no_se_usa(self, cur, conn_factory):
        """El catalogo trae precio_usd=999 (dato sintetico) para M1/M2/M3: nunca debe
        aparecer en el resultado; M1/M3 usan el precio SAP del stock y M2 (sin stock)
        queda sin precio."""
        r = svc.obtener_consumo(cur, agrupar="material", conn_factory=conn_factory)
        precios = {f["material"]: f["precio_usd"] for f in r["data"]}
        assert precios == {"M1": 2.5, "M3": 4.0, "M2": None}
        assert 999.0 not in precios.values()


class TestMensualYResumen:
    def test_mensual_de_todo_el_filtro(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, conn_factory=conn_factory)
        mensual = {m["mes"]: m for m in r["mensual"]}
        assert set(mensual) == {"2024-01", "2024-02"}
        # Enero: solo M1 (15 unidades * 2.5 = 37.5)
        assert mensual["2024-01"]["movimientos"] == 2
        assert mensual["2024-01"]["cantidad"] == 15.0
        assert mensual["2024-01"]["valor_usd"] == 37.5
        # Febrero: M2 (sin precio, no suma valor) + M3 (7 * 4 = 28)
        assert mensual["2024-02"]["movimientos"] == 2
        assert mensual["2024-02"]["cantidad"] == 10.0
        assert mensual["2024-02"]["valor_usd"] == 28.0

    def test_resumen(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, conn_factory=conn_factory)
        assert r["resumen"] == {
            "movimientos": 4,
            "cantidad_total": 25.0,
            "materiales": 3,
            "materiales_sin_precio": 1,
            "valor_usd": 65.5,
            "desde": None,
            "hasta": None,
        }

    def test_resumen_incluye_fechas_del_filtro(self, cur, conn_factory):
        desde = svc.parsear_fecha("2024-02-01")
        hasta = svc.parsear_fecha("2024-02-28")
        r = svc.obtener_consumo(cur, desde=desde, hasta=hasta, conn_factory=conn_factory)
        assert r["resumen"]["desde"] == "2024-02-01"
        assert r["resumen"]["hasta"] == "2024-02-28"

    def test_rango_datos_no_se_afecta_por_el_filtro(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, centro="AA102", conn_factory=conn_factory)
        assert r["rango_datos"] == {"min": "2024-01-15", "max": "2024-02-11"}


class TestDetalle:
    def test_detalle_ordenado_por_fecha_desc_y_valorizado(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, conn_factory=conn_factory)
        fechas = [f["fecha"] for f in r["data"]]
        assert fechas == sorted(fechas, reverse=True)
        primero = r["data"][0]
        assert primero["material"] == "M3"
        assert primero["precio_usd"] == 4.0
        assert primero["valor_usd"] == 28.0

    def test_truncado_false_bajo_el_limite(self, cur, conn_factory):
        r = svc.obtener_consumo(cur, conn_factory=conn_factory)
        assert r["truncado"] is False

    def test_truncado_true_sobre_el_limite(self, cur, conn_factory, monkeypatch):
        monkeypatch.setattr(svc, "LIMITE_DETALLE", 2)
        r = svc.obtener_consumo(cur, conn_factory=conn_factory)
        assert r["truncado"] is True
        assert len(r["data"]) == 2


class TestEndpointConsumoHistorico:
    @pytest.fixture(scope="class")
    def app(self):
        """Ver TestEndpointAsistente en test_buscador_materiales.py: el fixture `app`
        de tests/unit/conftest.py recarga backend.core.config en cada test, lo que
        invalida los tokens JWT firmados con el settings previo. Usamos la variante
        de tests/conftest.py (sin reload), scoped a la clase.
        """
        mp = pytest.MonkeyPatch()
        from backend.core.config import settings

        mp.setattr(settings, "DATABASE_URL", "sqlite:///:memory:")
        from backend.app import create_app

        flask_app = create_app(
            {
                "TESTING": True,
                "DATABASE_URL": settings.DATABASE_URL,
                "WTF_CSRF_ENABLED": False,
                "RATE_LIMIT_ENABLED": False,
            }
        )
        with flask_app.app_context():
            from backend.core.db import init_db

            init_db()
        yield flask_app
        mp.undo()

    @pytest.fixture
    def client(self, app):
        return app.test_client()

    @pytest.fixture
    def auth_client(self, app, client, monkeypatch):
        import backend.core.auth_middleware as mw
        from tests.integration.auth_utils import mint_access_token

        monkeypatch.setattr(
            mw, "_get_user_by_id_cached", lambda uid: {"id_spm": uid, "user_id": uid, "rol": "Solicitante"}
        )
        with app.app_context():
            token = mint_access_token(app, "901")
        client.environ_base["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return client

    @pytest.fixture
    def db_consumo(self, dbs, monkeypatch):
        """La ruta usa get_db_connection('sap_data') directo; el servicio usa
        get_db_connection('master_materiales') para los precios. Se parchean ambas
        referencias para que apunten a los archivos temporales del fixture `dbs`."""
        import backend.routes.consumo_historico as rutas

        def factory(db_name="spm"):
            return _conn_por_nombre(dbs, db_name)

        monkeypatch.setattr(rutas, "get_db_connection", factory)
        monkeypatch.setattr(svc, "get_db_connection", factory)
        return dbs

    def test_sin_sesion_401(self, client, db_consumo):
        r = client.get("/api/consumo-historico")
        assert r.status_code == 401

    def test_ok_detalle(self, auth_client, db_consumo):
        r = auth_client.get("/api/consumo-historico")
        assert r.status_code == 200
        data = r.get_json()
        assert data["ok"] is True
        assert len(data["data"]) == 4
        assert data["resumen"]["materiales"] == 3
        assert data["filtros"] == {"centros": ["AA101", "AA102"], "almacenes": ["0001", "0012"]}
        assert data["rango_datos"] == {"min": "2024-01-15", "max": "2024-02-11"}

    def test_ok_agrupar_material(self, auth_client, db_consumo):
        r = auth_client.get("/api/consumo-historico", query_string={"agrupar": "material"})
        assert r.status_code == 200
        data = r.get_json()
        assert [f["material"] for f in data["data"]] == ["M1", "M3", "M2"]

    def test_filtro_centro_aplica(self, auth_client, db_consumo):
        r = auth_client.get("/api/consumo-historico", query_string={"centro": "AA102"})
        assert r.status_code == 200
        data = r.get_json()
        assert {f["material"] for f in data["data"]} == {"M2"}

    @pytest.mark.parametrize("params", [
        {"desde": "no-es-fecha"},
        {"hasta": "2024/02/01"},
        {"desde": "2024-03-01", "hasta": "2024-01-01"},
    ])
    def test_validacion_fechas_400(self, auth_client, db_consumo, params):
        r = auth_client.get("/api/consumo-historico", query_string=params)
        assert r.status_code == 400
        assert r.get_json()["error"]["code"] == "validation_error"

    def test_centro_desconocido_400(self, auth_client, db_consumo):
        r = auth_client.get("/api/consumo-historico", query_string={"centro": "ZZ999"})
        assert r.status_code == 400

    def test_almacen_desconocido_400(self, auth_client, db_consumo):
        r = auth_client.get("/api/consumo-historico", query_string={"almacen": "9999"})
        assert r.status_code == 400

    def test_material_demasiado_largo_400(self, auth_client, db_consumo):
        r = auth_client.get("/api/consumo-historico", query_string={"material": "x" * 201})
        assert r.status_code == 400

    def test_error_interno_generico(self, auth_client, db_consumo, monkeypatch):
        import backend.routes.consumo_historico as rutas

        def _falla(*_a, **_k):
            raise RuntimeError("detalle interno")

        monkeypatch.setattr(rutas.service, "obtener_consumo", _falla)
        r = auth_client.get("/api/consumo-historico")
        assert r.status_code == 500
        assert "detalle interno" not in r.get_data(as_text=True)
