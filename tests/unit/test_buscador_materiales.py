"""Buscador conversacional de materiales (Equivalencias)."""

from contextlib import contextmanager

import pytest

from backend.core import db as db_module
from backend.services import buscador_materiales_service as svc

CATALOGO = [
    # codigo, descripcion, descripcion_larga, unidad, precio
    ("0101-0000080", "BOMBA CENTRIF./REP", "BOMBA CENTRIFUGA HORIZONTAL REPUESTO", "UNI", 80.87),
    ("0101-0000081", "BOMBA CENTRIF. 2HP", "", "UNI", 150.0),
    ("0101-0000090", "BOMBA DOSIFICADORA", "", "UNI", 300.0),
    ("0202-0000001", "ROD.RIGIDO BOLAS 6205 2RS", "RODAMIENTO SELLADO", "UNI", 12.5),
    ("0202-0000002", "ROD.RIGIDO BOLAS 6206", "", "UNI", 14.0),
    ("0303-0000001", "VALV.ESFERICA 2\"", "", "UNI", 45.0),
]
EQUIVALENCIAS = [
    # base, texto_base, equivalente, texto_equiv, tipo, criterio, motivo
    ("0101-0000080", "BOMBA CENTRIF./REP", "0101-0000081", "BOMBA CENTRIF. 2HP", "E2_SUPLIBLE", "Potencia", "Mayor caudal"),
    ("0101-0000080", "BOMBA CENTRIF./REP", "0101-0000090", "BOMBA DOSIFICADORA", "E1_ESTRICTA", "Norma", "Misma norma"),
    ("0202-0000001", "ROD.RIGIDO BOLAS 6205 2RS", "0202-0000002", "ROD.RIGIDO BOLAS 6206", "E0_DUPLICADO", "", "Duplicado"),
]


@pytest.fixture
def db_materiales(tmp_path, monkeypatch):
    """SQLite temporal con catalogo y equivalencias; parchea las conexiones del servicio y del repositorio."""
    path = str(tmp_path / "master.db")
    conn = db_module._connect_sqlite(path)
    conn.execute(
        "CREATE TABLE catalogo_materiales (codigo TEXT PRIMARY KEY, descripcion TEXT, descripcion_larga TEXT,"
        " unidad_medida TEXT, precio_usd REAL)"
    )
    conn.execute(
        "CREATE TABLE materiales_equivalencias (material_base TEXT, texto_breve_base TEXT, material_equivalente TEXT,"
        " texto_breve_equivalente TEXT, tipo_equiv TEXT, criterio TEXT, motivo_equivalencia TEXT)"
    )
    conn.executemany("INSERT INTO catalogo_materiales VALUES (?, ?, ?, ?, ?)", CATALOGO)
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

    import backend.core.repository.equivalencias as repo

    monkeypatch.setattr(svc, "get_db_connection", _conn)
    monkeypatch.setattr(repo, "_connect_equivalentes", lambda: db_module._connect_sqlite(path))
    monkeypatch.setattr(
        repo.EquivalenciasRepository,
        "_get_scores_config",
        staticmethod(lambda: {"E0_DUPLICADO": 100, "E1_ESTRICTA": 95, "E2_SUPLIBLE": 85}),
    )
    return path


class TestNormalizarEInterpretar:
    def test_normalizar_quita_tildes_y_signos(self):
        assert svc.normalizar("  Bomba centrífuga, 3/4\"!  ") == "BOMBA CENTRIFUGA 3 4"

    @pytest.mark.parametrize("msg", ["", "   ", "hola", "Buenas tardes", "ayuda", "?"])
    def test_ayuda(self, msg):
        assert svc.interpretar(msg)["intencion"] == "ayuda"

    def test_codigo_sap(self):
        r = svc.interpretar("0101-0000080")
        assert r == {"intencion": "codigo", "codigo": "0101-0000080", "texto": ""}

    def test_codigo_numerico_largo(self):
        assert svc.interpretar("material 100012345")["codigo"] == "100012345"

    def test_equivalentes_con_codigo(self):
        r = svc.interpretar("equivalentes de 0101-0000080")
        assert r["intencion"] == "equivalencias"
        assert r["codigo"] == "0101-0000080"

    def test_equivalentes_sin_codigo(self):
        r = svc.interpretar("¿Qué sustitutos hay para la bomba centrífuga?")
        assert r["intencion"] == "equivalencias"
        assert r["codigo"] is None
        assert r["texto"] == "BOMBA CENTRIFUGA"

    def test_descripcion(self):
        r = svc.interpretar("rodamiento 6205 sellado")
        assert r == {"intencion": "descripcion", "codigo": None, "texto": "RODAMIENTO 6205 SELLADO"}

    def test_terminos_quitan_vacias_y_usan_raiz_y_abreviaturas(self):
        grupos = svc.terminos("BOMBA PARA CENTRIFUGA DE 6205")
        assert grupos[0] == ["BOMBA"]
        assert "CENTR" in grupos[1] and "CENTRIF" in grupos[1]
        assert grupos[2] == ["6205"]
        assert len(grupos) == 3

    def test_terminos_vacio(self):
        assert svc.terminos("DE LA Y") == []


class TestBuscarPorDescripcion:
    def test_abreviatura_encuentra_centrif(self, db_materiales):
        codigos = [m["codigo"] for m in svc.buscar_por_descripcion("bomba centrífuga")]
        assert codigos[:2] == ["0101-0000080", "0101-0000081"]
        assert "0101-0000090" not in codigos  # AND: dosificadora no es centrifuga

    def test_or_si_and_no_encuentra(self, db_materiales):
        codigos = [m["codigo"] for m in svc.buscar_por_descripcion("bomba inexistente")]
        assert set(codigos) == {"0101-0000080", "0101-0000081", "0101-0000090"}

    def test_ranking_y_equivalencias(self, db_materiales):
        r = svc.buscar_por_descripcion("rodamiento 6205 sellado")
        assert r[0]["codigo"] == "0202-0000001"
        assert r[0] == {
            "codigo": "0202-0000001",
            "descripcion": "ROD.RIGIDO BOLAS 6205 2RS",
            "unidad": "UNI",
            "precio_usd": 12.5,
            "cant_equivalencias": 1,
        }

    def test_limite(self, db_materiales):
        assert len(svc.buscar_por_descripcion("bomba", limite=2)) == 2

    def test_sin_terminos(self, db_materiales):
        assert svc.buscar_por_descripcion("de la") == []

    def test_contar_equivalencias_en_ambos_sentidos(self, db_materiales):
        assert svc.contar_equivalencias(["0101-0000080", "0101-0000090", "0303-0000001"]) == {
            "0101-0000080": 2,
            "0101-0000090": 1,
        }


class TestEquivalenciasYResponder:
    def test_equivalencias_agrupadas_en_orden(self, db_materiales):
        r = svc.equivalencias_de("0101-0000080")
        assert r["material"]["codigo"] == "0101-0000080"
        assert [g["tipo"] for g in r["grupos"]] == ["E1_ESTRICTA", "E2_SUPLIBLE"]
        e1 = r["grupos"][0]
        assert e1["compatibilidad_pct"] == 95 and e1["total"] == 1
        assert e1["items"][0] == {
            "codigo": "0101-0000090",
            "descripcion": "BOMBA DOSIFICADORA",
            "criterio": "Norma",
            "motivo": "Misma norma",
            "unidad": "UNI",
            "precio_usd": 300.0,
        }

    def test_equivalencias_en_sentido_inverso(self, db_materiales):
        r = svc.equivalencias_de("0101-0000090")
        assert r["grupos"][0]["items"][0]["codigo"] == "0101-0000080"

    def test_equivalencias_codigo_inexistente(self, db_materiales):
        assert svc.equivalencias_de("9999-9999999") == {"material": None, "grupos": []}

    def test_responder_ayuda(self, db_materiales):
        r = svc.responder("hola")
        assert r["intencion"] == "ayuda" and r["materiales"] == [] and len(r["sugerencias"]) == 3

    def test_responder_descripcion_con_sugerencias(self, db_materiales):
        r = svc.responder("bomba centrifuga")
        assert r["intencion"] == "descripcion"
        assert r["materiales"][0]["codigo"] == "0101-0000080"
        assert r["sugerencias"][0] == "equivalentes de 0101-0000080"
        assert r["equivalencias"] is None

    def test_responder_codigo(self, db_materiales):
        r = svc.responder("0101-0000080")
        assert r["intencion"] == "codigo"
        assert r["materiales"][0]["codigo"] == "0101-0000080"
        assert len(r["equivalencias"]["grupos"]) == 2

    def test_responder_equivalencias_por_descripcion(self, db_materiales):
        r = svc.responder("sustitutos del rodamiento 6205")
        assert r["intencion"] == "equivalencias"
        assert r["equivalencias"]["material"]["codigo"] == "0202-0000001"
        assert r["equivalencias"]["grupos"][0]["tipo"] == "E0_DUPLICADO"

    def test_responder_sin_resultados(self, db_materiales):
        r = svc.responder("zzzz qqqq")
        assert r["intencion"] == "sin_resultados" and r["materiales"] == []
