"""CRUD de equivalencias sobre la tabla real (materiales_equivalencias; en PG su tabla base)."""

from contextlib import contextmanager

import pytest

from backend.core import db as db_module

CATALOGO = [
    ("0101-0000080", "BOMBA CENTRIF./REP"),
    ("0101-0000081", "BOMBA CENTRIF. 2HP"),
    ("0101-0000090", "BOMBA DOSIFICADORA"),
    ("0303-0000001", "VALV.ESFERICA 2\""),
]
EQUIVALENCIAS = [
    ("0101-0000080", "BOMBA CENTRIF./REP", "0101-0000081", "BOMBA CENTRIF. 2HP", "E2_SUPLIBLE", "Potencia", "Mayor caudal"),
]


@pytest.fixture
def db_equiv(tmp_path, monkeypatch):
    """SQLite temporal (tabla SIN id, como master_materiales.db) y conexiones de la ruta parcheadas."""
    path = str(tmp_path / "master.db")
    conn = db_module._connect_sqlite(path)
    conn.execute("CREATE TABLE catalogo_materiales (codigo TEXT PRIMARY KEY, descripcion TEXT)")
    conn.execute(
        "CREATE TABLE materiales_equivalencias (material_base TEXT, texto_breve_base TEXT, material_equivalente TEXT,"
        " texto_breve_equivalente TEXT, tipo_equiv TEXT, criterio TEXT, motivo_equivalencia TEXT)"
    )
    conn.executemany("INSERT INTO catalogo_materiales VALUES (?, ?)", CATALOGO)
    conn.executemany("INSERT INTO materiales_equivalencias VALUES (?, ?, ?, ?, ?, ?, ?)", EQUIVALENCIAS)
    conn.commit()
    conn.close()

    @contextmanager
    def _conn(db_name="spm"):
        c = db_module._connect_sqlite(path)
        try:
            yield c
        finally:
            c.close()

    import backend.routes.equivalencias as rutas

    monkeypatch.setattr(rutas, "get_db_connection", _conn)
    monkeypatch.setattr(rutas, "_PG", False)
    return path


def _filas(path):
    conn = db_module._connect_sqlite(path)
    try:
        return [dict(r) for r in conn.execute("SELECT rowid AS id, * FROM materiales_equivalencias")]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Camino PostgreSQL: conexion falsa que registra el SQL
# ---------------------------------------------------------------------------


class _CursorPGFalso:
    """Registra cada (sql, params) y devuelve filas plausibles segun el SQL."""

    def __init__(self, ejecutadas):
        self.ejecutadas = ejecutadas
        self._ultima = ""
        self._params = ()

    def execute(self, sql, params=()):
        self._ultima = " ".join(sql.split())
        self._params = tuple(params or ())
        self.ejecutadas.append((self._ultima, self._params))
        return self

    def fetchone(self):
        sql = self._ultima
        if sql.startswith("SELECT codigo AS codigo, descripcion FROM catalogo_materiales"):
            return {"codigo": self._params[0], "descripcion": f"DESC {self._params[0]}"}
        if sql.startswith("SELECT 1 FROM cat_equivalencias"):
            return None  # sin duplicado
        if sql.startswith("INSERT INTO cat_equivalencias"):
            return {"id": 42}
        if sql.startswith("SELECT id AS id FROM cat_equivalencias WHERE id ="):
            return {"id": self._params[0]}
        raise AssertionError(f"SQL inesperado: {sql}")

    def fetchall(self):
        return []


class _ConexionPGFalsa:
    def __init__(self):
        self.ejecutadas = []
        self.commits = 0

    def cursor(self):
        return _CursorPGFalso(self.ejecutadas)

    def commit(self):
        self.commits += 1


@pytest.fixture
def db_pg_falsa(monkeypatch):
    import backend.routes.equivalencias as rutas

    conexion = _ConexionPGFalsa()

    @contextmanager
    def _conn(db_name="spm"):
        yield conexion

    monkeypatch.setattr(rutas, "get_db_connection", _conn)
    monkeypatch.setattr(rutas, "_PG", True)
    # insert_returning_id decide RETURNING con el is_using_postgresql de backend.core.db
    monkeypatch.setattr(db_module, "is_using_postgresql", lambda: True)
    return conexion


class TestCrudEquivalencias:
    @pytest.fixture(scope="class")
    def app(self):
        """App no recargada (ver nota en tests/unit/test_buscador_materiales.py::TestEndpointAsistente)."""
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

    def _cliente(self, app, monkeypatch, rol):
        import backend.core.auth_middleware as mw
        from tests.integration.auth_utils import mint_access_token

        monkeypatch.setattr(mw, "_get_user_by_id_cached", lambda uid: {"id_spm": uid, "user_id": uid, "rol": rol})
        client = app.test_client()
        with app.app_context():
            token = mint_access_token(app, "901")
        # Bearer exime de CSRF (backend/core/csrf.py)
        client.environ_base["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return client

    @pytest.fixture
    def admin(self, app, monkeypatch):
        return self._cliente(app, monkeypatch, "Admin")

    @pytest.fixture
    def solicitante(self, app, monkeypatch):
        return self._cliente(app, monkeypatch, "Solicitante")

    def _crear(self, client, **kw):
        body = {
            "codigo_original": "0101-0000080",
            "codigo_equivalente": "0101-0000090",
            "tipo_equivalencia": "E1_ESTRICTA",
            "criterio": "Norma",
            "motivo": "Misma norma",
        }
        body.update(kw)
        return client.post("/api/equivalencias", json=body)

    def test_crear_aparece_en_listado_y_por_material(self, admin, db_equiv):
        r = self._crear(admin)
        assert r.status_code == 201, r.get_json()
        nuevo_id = r.get_json()["id"]
        assert isinstance(nuevo_id, int)

        fila = [f for f in _filas(db_equiv) if f["id"] == nuevo_id][0]
        assert fila["texto_breve_base"] == "BOMBA CENTRIF./REP"
        assert fila["texto_breve_equivalente"] == "BOMBA DOSIFICADORA"
        assert fila["tipo_equiv"] == "E1_ESTRICTA"

        lista = admin.get("/api/equivalencias?codigo=0101-0000090").get_json()["data"]
        assert [e["id"] for e in lista] == [nuevo_id]
        assert lista[0]["codigo_original"] == "0101-0000080"
        assert lista[0]["criterio"] == "Norma" and lista[0]["motivo"] == "Misma norma"

        por_material = admin.get("/api/equivalencias/0101-0000080").get_json()["equivalencias"]
        ids = {e["id"] for e in por_material}
        assert nuevo_id in ids and len(por_material) == 2
        assert all(isinstance(e["id"], int) for e in por_material)

    @pytest.mark.parametrize(
        "kw",
        [
            {},  # mismo par, mismo tipo
            {"codigo_original": "0101-0000081", "codigo_equivalente": "0101-0000080"},  # invertido
        ],
    )
    def test_duplicado_409(self, admin, db_equiv, kw):
        body = {"codigo_original": "0101-0000080", "codigo_equivalente": "0101-0000081", "tipo_equivalencia": "E2_SUPLIBLE"}
        body.update(kw)
        r = admin.post("/api/equivalencias", json=body)
        assert r.status_code == 409
        assert len(_filas(db_equiv)) == 1

    def test_mismo_par_otro_tipo_permitido(self, admin, db_equiv):
        r = self._crear(admin, codigo_equivalente="0101-0000081", tipo_equivalencia="E0_DUPLICADO")
        assert r.status_code == 201

    def test_a_igual_b_400(self, admin, db_equiv):
        r = self._crear(admin, codigo_equivalente="0101-0000080")
        assert r.status_code == 400

    @pytest.mark.parametrize(
        "kw",
        [
            {"tipo_equivalencia": "E9_INVENTADO"},
            {"tipo_equivalencia": ""},
            {"codigo_equivalente": ""},
            {"criterio": "x" * 501},
            {"motivo": "x" * 501},
            {"criterio": 5},
        ],
    )
    def test_validacion_400(self, admin, db_equiv, kw):
        assert self._crear(admin, **kw).status_code == 400
        assert len(_filas(db_equiv)) == 1

    def test_material_inexistente_404(self, admin, db_equiv):
        assert self._crear(admin, codigo_equivalente="9999-9999999").status_code == 404

    def test_editar(self, admin, db_equiv):
        nuevo_id = self._crear(admin).get_json()["id"]
        r = admin.put(
            f"/api/equivalencias/{nuevo_id}",
            json={"tipo_equivalencia": "E2_SUPLIBLE", "criterio": "Caudal", "motivo": ""},
        )
        assert r.status_code == 200, r.get_json()
        fila = [f for f in _filas(db_equiv) if f["id"] == nuevo_id][0]
        assert fila["tipo_equiv"] == "E2_SUPLIBLE"
        assert fila["criterio"] == "Caudal"
        assert fila["motivo_equivalencia"] is None
        assert fila["material_base"] == "0101-0000080"

    def test_editar_tipo_invalido_400(self, admin, db_equiv):
        nuevo_id = self._crear(admin).get_json()["id"]
        assert admin.put(f"/api/equivalencias/{nuevo_id}", json={"tipo_equivalencia": "X"}).status_code == 400

    def test_editar_sin_campos_400(self, admin, db_equiv):
        nuevo_id = self._crear(admin).get_json()["id"]
        assert admin.put(f"/api/equivalencias/{nuevo_id}", json={"otro": 1}).status_code == 400

    def test_editar_inexistente_404(self, admin, db_equiv):
        assert admin.put("/api/equivalencias/9999", json={"criterio": "x"}).status_code == 404

    def test_borrar(self, admin, db_equiv):
        nuevo_id = self._crear(admin).get_json()["id"]
        r = admin.delete(f"/api/equivalencias/{nuevo_id}")
        assert r.status_code == 200
        assert nuevo_id not in {f["id"] for f in _filas(db_equiv)}
        assert admin.get("/api/equivalencias?codigo=0101-0000090").get_json()["data"] == []

    def test_borrar_inexistente_404(self, admin, db_equiv):
        assert admin.delete("/api/equivalencias/9999").status_code == 404

    def test_sin_permiso_403(self, solicitante, db_equiv):
        assert self._crear(solicitante).status_code == 403
        assert solicitante.put("/api/equivalencias/1", json={"criterio": "x"}).status_code == 403
        assert solicitante.delete("/api/equivalencias/1").status_code == 403
        assert len(_filas(db_equiv)) == 1

    def test_pg_escrituras_van_a_cat_equivalencias(self, admin, db_pg_falsa):
        """Camino PG: la tabla base cat_equivalencias, INSERT ... RETURNING id, filtros por id."""
        r = self._crear(admin)
        assert r.status_code == 201, r.get_json()
        assert r.get_json()["id"] == 42
        assert admin.put("/api/equivalencias/7", json={"criterio": "Caudal"}).status_code == 200
        assert admin.delete("/api/equivalencias/7").status_code == 200

        sqls = [s for s, _ in db_pg_falsa.ejecutadas]
        escrituras = [s for s in sqls if s.split()[0] in ("INSERT", "UPDATE", "DELETE")]
        assert [s.split()[0] for s in escrituras] == ["INSERT", "UPDATE", "DELETE"]

        insert, update, delete = escrituras
        assert insert.startswith("INSERT INTO cat_equivalencias")
        assert insert.endswith("RETURNING id")  # agregado por insert_returning_id
        assert update.startswith("UPDATE cat_equivalencias SET criterio = ?")
        assert update.endswith("WHERE id = ?")
        assert delete == "DELETE FROM cat_equivalencias WHERE id = ?"
        # la vista materiales_equivalencias nunca recibe escrituras
        assert not any("materiales_equivalencias" in s for s in escrituras)
        # UPDATE/DELETE filtran por el id pedido
        params = {s: p for s, p in db_pg_falsa.ejecutadas}
        assert params[update][-1] == 7 and params[delete] == (7,)
        assert db_pg_falsa.commits == 3
