"""
Buscador conversacional de materiales (pagina Equivalencias).

Sin LLM: reglas de intencion + busqueda SQL con raices y abreviaturas + ranking en Python.
Ver docs/superpowers/specs/2026-09-27-buscador-materiales-equivalencias-design.md
"""

import re

from backend.core.db import get_db_connection
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


DB_MATERIALES = "master_materiales"
LIMITE_CANDIDATOS = 200
TOP_CON_EQUIVALENCIAS = 20


def _where_grupos(grupos: list[list[str]], todos: bool) -> tuple[str, list[str]]:
    clausulas, params = [], []
    for grupo in grupos:
        alternativas = []
        for alt in grupo:
            alternativas.append("UPPER(descripcion) LIKE %s")
            alternativas.append("UPPER(COALESCE(descripcion_larga, '')) LIKE %s")
            params.extend([f"%{alt}%", f"%{alt}%"])
        clausulas.append("(" + " OR ".join(alternativas) + ")")
    return (" AND " if todos else " OR ").join(clausulas), params


def _candidatos(grupos: list[list[str]]) -> list[dict]:
    with get_db_connection(DB_MATERIALES) as conn:
        cur = conn.cursor()
        for todos in (True, False):
            where, params = _where_grupos(grupos, todos)
            cur.execute(
                "SELECT codigo, descripcion, descripcion_larga, unidad_medida, precio_usd "
                f"FROM catalogo_materiales WHERE {where} LIMIT {LIMITE_CANDIDATOS}",
                params,
            )
            filas = cur.fetchall()
            if filas:
                return [
                    {
                        "codigo": f["codigo"],
                        "descripcion": f["descripcion"] or "",
                        "descripcion_larga": f["descripcion_larga"] or "",
                        "unidad": f["unidad_medida"] or "UNI",
                        "precio_usd": float(f["precio_usd"]) if f["precio_usd"] is not None else None,
                    }
                    for f in filas
                ]
    return []


def _puntaje(material: dict, grupos: list[list[str]]) -> int:
    desc = normalizar(material["descripcion"])
    larga = normalizar(material["descripcion_larga"])
    puntos = 0
    for grupo in grupos:
        if any(alt in desc for alt in grupo):
            puntos += 10
        elif any(alt in larga for alt in grupo):
            puntos += 4
    palabras = desc.split()
    if palabras and grupos and any(palabras[0].startswith(alt) for alt in grupos[0]):
        puntos += 3
    return puntos


def contar_equivalencias(codigos: list[str]) -> dict[str, int]:
    """Cantidad de equivalencias por codigo (como base o como equivalente). Omite los que tienen 0."""
    if not codigos:
        return {}
    marcas = ", ".join(["%s"] * len(codigos))
    conteo: dict[str, int] = {}
    with get_db_connection(DB_MATERIALES) as conn:
        cur = conn.cursor()
        for columna in ("material_base", "material_equivalente"):
            cur.execute(
                f"SELECT {columna} AS codigo, COUNT(*) AS n FROM materiales_equivalencias "
                f"WHERE {columna} IN ({marcas}) GROUP BY {columna}",
                list(codigos),
            )
            for f in cur.fetchall():
                conteo[f["codigo"]] = conteo.get(f["codigo"], 0) + int(f["n"])
    return conteo


def buscar_por_descripcion(texto: str, limite: int = 8) -> list[dict]:
    grupos = terminos(texto)
    if not grupos:
        return []
    candidatos = _candidatos(grupos)
    for m in candidatos:
        m["_puntaje"] = _puntaje(m, grupos)
    candidatos.sort(key=lambda m: (-m["_puntaje"], len(m["descripcion"]), m["codigo"]))

    top = candidatos[:TOP_CON_EQUIVALENCIAS]
    conteo = contar_equivalencias([m["codigo"] for m in top])
    for m in top:
        m["cant_equivalencias"] = conteo.get(m["codigo"], 0)
        if m["cant_equivalencias"]:
            m["_puntaje"] += 2
    top.sort(key=lambda m: (-m["_puntaje"], len(m["descripcion"]), m["codigo"]))

    return [
        {k: m[k] for k in ("codigo", "descripcion", "unidad", "precio_usd", "cant_equivalencias")}
        for m in top[:limite]
    ]
