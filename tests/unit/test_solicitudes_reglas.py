"""
Reglas de negocio del modulo Solicitudes (revision 2026-09-27).

Cubre:
- Asignacion de aprobador por cadena jerarquica del solicitante (jefe/gerente1/gerente2)
- Permiso de aprobacion sin reglas parametrizadas
- Asignacion de planificador real con balanceo de carga
- Precio de items desde el catalogo (nunca del cliente) y validacion de tipos
- Validacion de cabecera de solicitud
- Conexion SQLite compatible con placeholders %s
"""

from contextlib import contextmanager
from datetime import date, timedelta

import pytest

from backend.core import db as db_module

USUARIOS = [
    # id, rol, estado, jefe, gerente1, gerente2, centros
    ("1", "Admin, Administrador, Aprobador_solicitudes, Planificador", "Activo", None, None, None, "AA101,AA102"),
    ("4", "Aprobador_solicitudes, Jefe, Solicitante", "Activo", "6", "6", "7", "AA101"),
    ("5", "Aprobador_solicitudes, Jefe, Solicitante", "Inactivo", "6", "6", "7", "AA101"),
    ("6", "Aprobador_solicitudes, Gerente1, Solicitante", "Activo", "7", None, "7", "AA101"),
    ("7", "Aprobador_solicitudes, Gerente2, Solicitante", "Activo", "1", None, None, "AA101"),
    ("8", "Solicitante", "Activo", "4", "6", "7", "AA101"),
    ("9", "Solicitante", "Activo", "5", "6", "7", "AA101"),  # jefe inactivo
    ("10", "Solicitante", "Activo", None, None, None, "AA101"),  # sin cadena
    ("2", "Planificador, Solicitante", "Activo", "6", "6", "7", "AA102"),
    ("3", "Planificador, Solicitante", "Activo", "6", "6", "7", "AA101"),
]


@pytest.fixture
def spm_db(tmp_path, monkeypatch):
    """SQLite temporal con usuario/solicitud; parchea get_db_connection de los modulos bajo prueba."""
    path = str(tmp_path / "reglas.db")
    conn = db_module._connect_sqlite(path)
    conn.execute(
        """CREATE TABLE usuario (id_spm TEXT PRIMARY KEY, rol TEXT, posicion TEXT, estado_registro TEXT,
           jefe TEXT, gerente1 TEXT, gerente2 TEXT, centros TEXT)"""
    )
    conn.execute(
        """CREATE TABLE solicitud (id INTEGER PRIMARY KEY, id_usuario TEXT, status TEXT,
           planner_id TEXT, aprobador_id TEXT)"""
    )
    conn.execute(
        """CREATE TABLE reglas_aprobacion (id INTEGER PRIMARY KEY, rol_solicitante TEXT, monto_minimo REAL,
           monto_maximo REAL, rol_aprobador TEXT, niveles_requeridos INTEGER, activo BOOLEAN, created_at TEXT)"""
    )
    conn.execute("CREATE TABLE planificador_asignaciones (planificador_id TEXT, centro TEXT, sector TEXT)")
    for u in USUARIOS:
        conn.execute(
            "INSERT INTO usuario (id_spm, rol, posicion, estado_registro, jefe, gerente1, gerente2, centros) "
            "VALUES (?, ?, 'Puesto libre', ?, ?, ?, ?, ?)",
            u,
        )
    conn.commit()
    conn.close()

    @contextmanager
    def _conn(db_name="spm"):
        c = db_module._connect_sqlite(path)
        try:
            yield c
        finally:
            c.close()

    import backend.core.approval_strategies as strategies
    import backend.routes.solicitudes.helpers as helpers
    import backend.services.approval_service as approval

    monkeypatch.setattr(approval, "get_db_connection", _conn)
    monkeypatch.setattr(helpers, "get_db_connection", _conn)
    monkeypatch.setattr(strategies, "get_db_connection", _conn)
    return path


# ---------------------------------------------------------------------------
# Aprobador por cadena jerarquica
# ---------------------------------------------------------------------------


class TestAprobadorPorCadena:
    def test_nivel_por_monto_usa_umbrales_de_presupuesto(self):
        from backend.services.approval_service import nivel_cadena_por_monto

        assert nivel_cadena_por_monto(1_000) == "jefe"
        assert nivel_cadena_por_monto(200_000) == "jefe"
        assert nivel_cadena_por_monto(200_000.01) == "gerente1"
        assert nivel_cadena_por_monto(1_000_000) == "gerente1"
        assert nivel_cadena_por_monto(1_000_000.01) == "gerente2"

    def test_monto_bajo_va_al_jefe_del_solicitante(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        assert resolver_aprobador_solicitud("8", 5_000) == "4"

    def test_monto_medio_va_al_gerente1(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        assert resolver_aprobador_solicitud("8", 500_000) == "6"

    def test_monto_alto_va_al_gerente2(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        assert resolver_aprobador_solicitud("8", 5_000_000) == "7"

    def test_jefe_inactivo_sube_al_siguiente_nivel(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        assert resolver_aprobador_solicitud("9", 5_000) == "6"

    def test_nunca_se_asigna_al_propio_solicitante(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        # El gerente2 (7) pide un monto alto: su cadena lleva al admin, no a si mismo
        assert resolver_aprobador_solicitud("7", 5_000_000) != "7"

    def test_sin_cadena_busca_rol_del_nivel(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        assert resolver_aprobador_solicitud("10", 5_000) == "4"

    def test_admin_solicitante_no_queda_autoasignado(self, spm_db):
        from backend.services.approval_service import resolver_aprobador_solicitud

        assert resolver_aprobador_solicitud("1", 5_000) not in ("1", "")


class TestPuedeAprobarSinReglas:
    def test_aprobador_asignado_puede_aprobar_sin_reglas(self, spm_db):
        from backend.services.approval_service import puede_aprobar

        assert puede_aprobar("4", 5_000)["puede_aprobar"] is True

    def test_sin_rol_aprobador_no_puede(self, spm_db):
        from backend.services.approval_service import puede_aprobar

        assert puede_aprobar("8", 5_000)["puede_aprobar"] is False

    def test_admin_siempre_puede(self, spm_db):
        from backend.services.approval_service import puede_aprobar

        assert puede_aprobar("1", 50_000_000)["puede_aprobar"] is True


# ---------------------------------------------------------------------------
# Planificador asignado
# ---------------------------------------------------------------------------


class TestPlanificadorAsignado:
    def test_prefiere_planificador_no_admin_del_centro(self, spm_db):
        from backend.routes.solicitudes.helpers import _planificador_para

        assert _planificador_para("AA101", "Mantenimiento") == "3"

    def test_balancea_por_carga(self, spm_db):
        from backend.routes.solicitudes.helpers import _planificador_para

        c = db_module._connect_sqlite(spm_db)
        for i in range(3):
            c.execute(
                "INSERT INTO solicitud (id, id_usuario, status, planner_id) VALUES (?, '8', 'approved', '3')",
                (100 + i,),
            )
        c.commit()
        c.close()
        # 3 esta cargado; 2 no cubre AA101 pero es el unico otro no-admin
        assert _planificador_para("AA101", "Mantenimiento") == "3"
        assert _planificador_para("AA999", "Mantenimiento") == "2"


# ---------------------------------------------------------------------------
# Items: precio de catalogo y tipos
# ---------------------------------------------------------------------------


@pytest.fixture
def catalogo(monkeypatch):
    import backend.core.item_schemas as items

    precios = {"0106-0000082": 165.28, "0101-0000001": 100.0}
    monkeypatch.setattr(items, "_precio_catalogo", lambda codigo: precios.get(codigo))
    return items


class TestItemsPrecioCatalogo:
    def test_precio_del_cliente_se_ignora(self, catalogo):
        r = catalogo.validar_items(
            [{"codigo": "0106-0000082", "cantidad": 10, "unidad": "UNI", "precio_unitario": 0.01}]
        )
        assert r["ok"] and r["total"] == pytest.approx(1652.80)
        assert r["items"][0].precio_unitario == pytest.approx(165.28)

    def test_material_inexistente(self, catalogo):
        r = catalogo.validar_items([{"codigo": "9999", "cantidad": 1, "unidad": "UNI"}])
        assert not r["ok"]

    @pytest.mark.parametrize("cantidad", [float("nan"), float("inf"), 1e308, 0, -1, "abc"])
    def test_cantidades_invalidas(self, catalogo, cantidad):
        r = catalogo.validar_items([{"codigo": "0101-0000001", "cantidad": cantidad, "unidad": "UNI"}])
        assert not r["ok"]

    @pytest.mark.parametrize("items", ["abc", {"codigo": "x"}, 123])
    def test_items_que_no_son_lista(self, catalogo, items):
        assert not catalogo.validar_items(items)["ok"]

    def test_item_que_no_es_objeto(self, catalogo):
        assert not catalogo.validar_items(["x"])["ok"]

    def test_material_id_numerico_no_rompe(self, catalogo):
        r = catalogo.validar_items([{"material_id": 123, "cantidad": 1, "unidad": "UNI"}])
        assert not r["ok"]  # no existe en catalogo, pero no lanza excepcion


class TestItemsSinPrecio:
    """Precio de catalogo = precio SAP del stock; sin precio no se puede pedir (migracion 104)."""

    @pytest.fixture
    def catalogo_bd(self, tmp_path, monkeypatch):
        import backend.core.item_schemas as items

        path = str(tmp_path / "master.db")
        conn = db_module._connect_sqlite(path)
        conn.execute("CREATE TABLE catalogo_materiales (codigo TEXT PRIMARY KEY, precio_usd REAL)")
        conn.executemany(
            "INSERT INTO catalogo_materiales VALUES (?, ?)",
            [("0503-0000103", 0.43), ("0206-0000398", None)],
        )
        conn.commit()
        conn.close()

        @contextmanager
        def _conn(db_name="spm"):
            assert db_name == "master_materiales"
            c = db_module._connect_sqlite(path)
            try:
                yield c
            finally:
                c.close()

        monkeypatch.setattr(db_module, "get_db_connection", _conn)
        items.limpiar_cache_materiales()
        yield items, path
        items.limpiar_cache_materiales()

    def test_precio_sap_se_aplica(self, catalogo_bd):
        items, _ = catalogo_bd
        r = items.validar_items([{"codigo": "0503-0000103", "cantidad": 10, "unidad": "L"}])
        assert r["ok"] and r["items"][0].precio_unitario == pytest.approx(0.43)
        assert r["total"] == pytest.approx(4.30)

    def test_sin_precio_se_rechaza(self, catalogo_bd):
        items, _ = catalogo_bd
        assert items._precio_catalogo("0206-0000398") is items._SIN_PRECIO
        r = items.validar_items([{"codigo": "0206-0000398", "cantidad": 1, "unidad": "UNI"}])
        assert not r["ok"] and r["items_validos"] == 0
        assert r["errores"][0]["mensaje"] == (
            "El material 0206-0000398 no tiene precio de referencia; no se puede solicitar hasta que se cargue"
        )

    def test_precio_cargado_despues_se_ve(self, catalogo_bd):
        items, path = catalogo_bd
        assert items._precio_catalogo("0206-0000398") is items._SIN_PRECIO
        c = db_module._connect_sqlite(path)
        c.execute("UPDATE catalogo_materiales SET precio_usd = 12.5 WHERE codigo = '0206-0000398'")
        c.commit()
        c.close()
        assert items._precio_catalogo("0206-0000398") == pytest.approx(12.5)

    def test_precio_cacheado_vence_por_ttl(self, catalogo_bd, monkeypatch):
        items, path = catalogo_bd
        assert items._precio_catalogo("0503-0000103") == pytest.approx(0.43)
        c = db_module._connect_sqlite(path)
        c.execute("UPDATE catalogo_materiales SET precio_usd = 0.99 WHERE codigo = '0503-0000103'")
        c.commit()
        c.close()
        # dentro del TTL sigue el precio cacheado
        assert items._precio_catalogo("0503-0000103") == pytest.approx(0.43)
        # vencida la entrada se vuelve a consultar la BD
        ahora = items.time.monotonic()
        monkeypatch.setattr(items.time, "monotonic", lambda: ahora + items._CACHE_TTL_SEGUNDOS + 1)
        assert items._precio_catalogo("0503-0000103") == pytest.approx(0.99)

    def test_inexistente_mensaje_de_siempre(self, catalogo_bd):
        items, _ = catalogo_bd
        r = items.validar_items([{"codigo": "9999-9999999", "cantidad": 1, "unidad": "UNI"}])
        assert not r["ok"]
        assert r["errores"][0]["mensaje"] == "Material '9999-9999999' no existe en el catálogo"


# ---------------------------------------------------------------------------
# Cabecera de solicitud
# ---------------------------------------------------------------------------


class TestValidarCabecera:
    BASE = {"centro": "AA101", "sector": "Mantenimiento", "criticidad": "Normal"}

    def _validar(self, **cambios):
        from backend.routes.solicitudes.crud import _validar_cabecera

        return _validar_cabecera({**self.BASE, **cambios})

    def test_cabecera_valida(self):
        assert self._validar() == ""

    @pytest.mark.parametrize("criticidad", ["Baja", "Normal", "Alta", "Critica"])
    def test_criticidades_de_la_ui(self, criticidad):
        assert self._validar(criticidad=criticidad) == ""

    def test_criticidad_invalida(self):
        assert self._validar(criticidad="Apocaliptica")

    def test_centro_obligatorio(self):
        assert self._validar(centro="")

    def test_centro_numerico(self):
        assert self._validar(centro=1008)

    def test_fecha_invalida(self):
        assert self._validar(fecha_necesidad="no-es-fecha")

    def test_fecha_pasada(self):
        assert self._validar(fecha_necesidad="2001-01-01")

    def test_fecha_futura(self):
        manana = (date.today() + timedelta(days=2)).isoformat()
        assert self._validar(fecha_necesidad=manana) == ""

    def test_justificacion_muy_larga(self):
        assert self._validar(justificacion="x" * 2001)


# ---------------------------------------------------------------------------
# Conexion SQLite compatible con %s
# ---------------------------------------------------------------------------


class TestSQLiteCompat:
    def test_acepta_placeholders_pg_y_sqlite(self, tmp_path):
        c = db_module._connect_sqlite(str(tmp_path / "compat.db"))
        c.execute("CREATE TABLE t (a TEXT, b TEXT)")
        c.execute("INSERT INTO t VALUES (%s, ?)", ("x", "y"))
        cur = c.cursor()
        cur.execute("SELECT b FROM t WHERE a = %s AND b LIKE '%%'", ("x",))
        assert cur.fetchone()["b"] == "y"
        c.close()

    def test_no_altera_literales_like(self, tmp_path):
        c = db_module._connect_sqlite(str(tmp_path / "compat.db"))
        c.execute("CREATE TABLE t (a TEXT)")
        c.execute("INSERT INTO t VALUES ('saldo')")
        assert c.execute("SELECT COUNT(*) FROM t WHERE a LIKE '%ald%'").fetchone()[0] == 1
        c.close()
