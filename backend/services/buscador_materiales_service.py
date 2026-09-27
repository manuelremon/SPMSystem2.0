"""
Buscador conversacional de materiales (pagina Equivalencias).

Sin LLM: reglas de intencion + busqueda SQL con raices y abreviaturas + ranking en Python.
Ver docs/superpowers/specs/2026-09-27-buscador-materiales-equivalencias-design.md
"""

import re

from backend.core.search_utils import strip_accents
from backend.services.buscador_materiales_diccionario import ABREVIATURAS, PALABRAS_VACIAS

LARGO_RAIZ = 5

_RE_NO_VALIDO = re.compile(r"[^A-Z0-9\- ]")
_RE_ESPACIOS = re.compile(r"\s+")
_RE_CODIGO = re.compile(r"(?<![\d-])(\d{4}-\d{7}|\d{6,})(?![\d-])")
_RE_AYUDA = re.compile(r"^(HOLA|BUENAS|BUEN DIA|BUENOS DIAS|BUENAS TARDES|BUENAS NOCHES|AYUDA|HELP)\b")
_RE_EQUIV = re.compile(
    r"\b(EQUIVALENTES?|EQUIVALENCIAS?|SUSTITUT[OA]S?|REEMPLAZOS?|ALTERNATIVAS?|INTERCAMBIABLES?)\b"
)


def normalizar(texto: str) -> str:
    """MAYUSCULAS, sin tildes, solo [A-Z0-9-] y espacios simples."""
    limpio = _RE_NO_VALIDO.sub(" ", strip_accents(texto or "").upper())
    return _RE_ESPACIOS.sub(" ", limpio).strip()


def _sin_vacias(texto: str) -> str:
    return " ".join(p for p in texto.split() if p not in PALABRAS_VACIAS)


def interpretar(mensaje: str) -> dict:
    """Clasifica el mensaje: ayuda, equivalencias, codigo o descripcion."""
    texto = normalizar(mensaje)
    if not texto or _RE_AYUDA.match(texto):
        return {"intencion": "ayuda", "codigo": None, "texto": ""}

    m_codigo = _RE_CODIGO.search(texto)
    codigo = m_codigo.group(1) if m_codigo else None
    resto = _RE_CODIGO.sub(" ", texto) if codigo else texto

    if _RE_EQUIV.search(resto):
        resto = _sin_vacias(_RE_EQUIV.sub(" ", resto))
        return {"intencion": "equivalencias", "codigo": codigo, "texto": resto}

    if codigo:
        return {"intencion": "codigo", "codigo": codigo, "texto": _sin_vacias(resto)}

    return {"intencion": "descripcion", "codigo": None, "texto": _sin_vacias(texto)}


def terminos(texto: str) -> list[list[str]]:
    """Un grupo de alternativas (raiz + abreviaturas) por cada palabra util."""
    grupos: list[list[str]] = []
    for palabra in normalizar(texto).split():
        if palabra in PALABRAS_VACIAS or len(palabra) < 2:
            continue
        alternativas = {palabra[:LARGO_RAIZ]} | set(ABREVIATURAS.get(palabra, ()))
        grupo = sorted(alternativas)
        if grupo not in grupos:
            grupos.append(grupo)
    return grupos
