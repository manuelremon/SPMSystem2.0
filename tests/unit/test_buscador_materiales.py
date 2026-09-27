"""Buscador conversacional de materiales (Equivalencias)."""

import pytest

from backend.services import buscador_materiales_service as svc


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
