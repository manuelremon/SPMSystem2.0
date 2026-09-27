"""
Buscador conversacional de materiales (pagina Equivalencias).

Sin LLM: reglas de intencion + busqueda SQL con raices y abreviaturas + ranking en Python.
Ver docs/superpowers/specs/2026-09-27-buscador-materiales-equivalencias-design.md
"""

import re

from backend.core.db import get_db_connection
from backend.core.repository.equivalencias import EquivalenciasRepository
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
        # las medidas de una cifra (2", 4") cuentan; las letras sueltas no
        if palabra in PALABRAS_VACIAS or (len(palabra) < 2 and not palabra.isdigit()):
            continue
        alternativas = {palabra[:LARGO_RAIZ]} | set(ABREVIATURAS.get(palabra, ()))
        grupo = sorted(alternativas)
        if grupo not in grupos:
            grupos.append(grupo)
    return grupos


DB_MATERIALES = "master_materiales"
LIMITE_CANDIDATOS = 200
TOP_CON_EQUIVALENCIAS = 20


def _condicion_grupo(grupo: list[str]) -> tuple[str, list[str]]:
    """(cond1 OR cond2 ...) para un grupo de alternativas, en descripcion y descripcion_larga."""
    alternativas, params = [], []
    for alt in grupo:
        alternativas.append("UPPER(descripcion) LIKE %s")
        alternativas.append("UPPER(COALESCE(descripcion_larga, '')) LIKE %s")
        params.extend([f"%{alt}%", f"%{alt}%"])
    return "(" + " OR ".join(alternativas) + ")", params


def _es_numerico(grupo: list[str]) -> bool:
    return all(alt.isdigit() for alt in grupo)


def _ancla(grupos: list[list[str]]) -> list[str] | None:
    """Primer grupo no numerico con alguna alternativa de 3+ letras: el sustantivo de la consulta."""
    for grupo in grupos:
        if not _es_numerico(grupo) and max(len(alt) for alt in grupo) >= 3:
            return grupo
    return None


def _puntos_sql(grupo: list[str]) -> tuple[str, list[str]]:
    """Relevancia de un grupo en SQL: 2 si esta en la descripcion corta, 1 si solo en la larga;
    para numeros, +2 si aparece como medida en pulgadas (12")."""
    en_desc = " OR ".join(["UPPER(descripcion) LIKE %s"] * len(grupo))
    en_larga = " OR ".join(["UPPER(COALESCE(descripcion_larga, '')) LIKE %s"] * len(grupo))
    sql = f"(CASE WHEN {en_desc} THEN 2 WHEN {en_larga} THEN 1 ELSE 0 END)"
    params = [f"%{alt}%" for alt in grupo] * 2
    if _es_numerico(grupo):
        sql += " + (CASE WHEN " + " OR ".join(["UPPER(descripcion) LIKE %s"] * len(grupo)) + " THEN 2 ELSE 0 END)"
        params += [f'% {alt}"%' for alt in grupo]
    return sql, params


def _consultar(where: str, params: list[str], grupos_orden: list[list[str]]) -> list[dict]:
    """Candidatos que cumplen `where`, ordenados en SQL por relevancia ANTES del LIMIT
    (si no, con consultas amplias el ranking solo ve 200 filas arbitrarias)."""
    puntos, params_orden = [], []
    for grupo in grupos_orden:
        sql, p = _puntos_sql(grupo)
        puntos.append(sql)
        params_orden.extend(p)
    orden = (" + ".join(puntos) + " DESC, ") if puntos else ""
    with get_db_connection(DB_MATERIALES) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT codigo, descripcion, descripcion_larga, unidad_medida, precio_usd "
            f"FROM catalogo_materiales WHERE {where} "
            f"ORDER BY {orden}LENGTH(descripcion), codigo LIMIT {LIMITE_CANDIDATOS}",
            params + params_orden,
        )
        return [
            {
                "codigo": f["codigo"],
                "descripcion": f["descripcion"] or "",
                "descripcion_larga": f["descripcion_larga"] or "",
                "unidad": f["unidad_medida"] or "UNI",
                "precio_usd": float(f["precio_usd"]) if f["precio_usd"] is not None else None,
            }
            for f in cur.fetchall()
        ]


def _candidatos(grupos: list[list[str]]) -> list[dict]:
    """Todas las palabras + las que tienen el sustantivo (el resto suma); si nada, cualquier palabra no numerica."""
    condiciones = [_condicion_grupo(g) for g in grupos]
    where = " AND ".join(c for c, _ in condiciones)
    filas = _consultar(where, [p for _, ps in condiciones for p in ps], grupos)

    # Tambien los que tienen el sustantivo aunque falte alguna palabra: exigirlas todas deja
    # afuera, por ejemplo, la brida 12" 300 de acero al carbono cuando se pidio inoxidable.
    ancla = _ancla(grupos)
    if ancla is not None and len(grupos) > 1:
        where, params = _condicion_grupo(ancla)
        vistos = {f["codigo"] for f in filas}
        filas += [f for f in _consultar(where, params, grupos) if f["codigo"] not in vistos]
    if filas:
        return filas

    textuales = [g for g in grupos if not _es_numerico(g)]
    if not textuales:
        return []
    condiciones = [_condicion_grupo(g) for g in textuales]
    where = " OR ".join(c for c, _ in condiciones)
    return _consultar(where, [p for _, ps in condiciones for p in ps], grupos)


def _coincide(alt: str, texto: str) -> bool:
    """Numeros y abreviaturas cortas o con punto ("V.ESF") cuentan solo desde el inicio de una
    palabra ("12" no coincide con "1219MM"; "AC" no coincide con "PLACA"); el resto, como raiz.
    `texto` ya viene normalizado, asi que la alternativa tambien se normaliza."""
    alt = normalizar(alt)
    if alt.isdigit():
        return re.search(rf"(?<![0-9]){alt}(?![0-9])", texto) is not None
    if len(alt) <= 3 or " " in alt:
        return re.search(rf"(?<![A-Z0-9]){re.escape(alt)}", texto) is not None
    return alt in texto


def _puntaje(material: dict, grupos: list[list[str]]) -> int:
    crudo = (material["descripcion"] or "").upper()
    desc = normalizar(material["descripcion"])
    larga = normalizar(material["descripcion_larga"])
    ancla = _ancla(grupos)
    puntos = 0
    for grupo in grupos:
        peso = 20 if grupo is ancla else 12 if _es_numerico(grupo) else 10
        if _es_numerico(grupo):
            # sobre el texto crudo: el 2 de 1/2" o de 2,5 no es la medida 2
            en_desc = any(re.search(rf"(?<![0-9/.,]){alt}(?![0-9/.,])", crudo) for alt in grupo)
        else:
            en_desc = any(_coincide(alt, desc) for alt in grupo)
        if en_desc:
            puntos += peso
            # medida en pulgadas: 12" en el catalogo
            if _es_numerico(grupo) and any(re.search(rf'(?<![0-9]){alt}"', crudo) for alt in grupo):
                puntos += 5
        elif any(_coincide(alt, larga) for alt in grupo):
            puntos += 2 if grupo is ancla else 4
    palabras = desc.split()
    if palabras and ancla and any(palabras[0].startswith(alt) for alt in ancla):
        puntos += 5
    return puntos


def contar_equivalencias(codigos: list[str]) -> dict[str, int]:
    """Cantidad de equivalencias por codigo (como base o como equivalente).

    Cuenta codigos de contraparte DISTINTOS: un par A<->B no se duplica aunque
    exista en ambos sentidos (A->B y B->A) o repetido bajo varios tipos. Omite
    los codigos que quedan en 0.
    """
    if not codigos:
        return {}
    marcas = ", ".join(["%s"] * len(codigos))
    with get_db_connection(DB_MATERIALES) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT codigo, COUNT(DISTINCT otro) AS n FROM ("
            f"SELECT material_base AS codigo, material_equivalente AS otro FROM materiales_equivalencias WHERE material_base IN ({marcas}) "
            "UNION ALL "
            f"SELECT material_equivalente AS codigo, material_base AS otro FROM materiales_equivalencias WHERE material_equivalente IN ({marcas})"
            ") t WHERE otro <> codigo GROUP BY codigo",
            list(codigos) + list(codigos),
        )
        return {f["codigo"]: int(f["n"]) for f in cur.fetchall()}


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


TIPOS_ORDEN = ("E1_ESTRICTA", "E2_SUPLIBLE", "E0_DUPLICADO")
EJEMPLOS = ["bomba centrífuga", "rodamiento 6205", "equivalentes de rodamiento 6205"]


def _orden_tipo(tipo: str) -> int:
    return TIPOS_ORDEN.index(tipo) if tipo in TIPOS_ORDEN else len(TIPOS_ORDEN)


def _fichas(codigos: list[str]) -> dict[str, dict]:
    if not codigos:
        return {}
    marcas = ", ".join(["%s"] * len(codigos))
    with get_db_connection(DB_MATERIALES) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT codigo, descripcion, unidad_medida, precio_usd FROM catalogo_materiales "
            f"WHERE codigo IN ({marcas})",
            list(codigos),
        )
        return {
            f["codigo"]: {
                "codigo": f["codigo"],
                "descripcion": f["descripcion"] or "",
                "unidad": f["unidad_medida"] or "UNI",
                "precio_usd": float(f["precio_usd"]) if f["precio_usd"] is not None else None,
            }
            for f in cur.fetchall()
        }


def ficha_material(codigo: str) -> dict | None:
    ficha = _fichas([codigo]).get(codigo)
    if ficha is None:
        return None
    return {**ficha, "cant_equivalencias": contar_equivalencias([codigo]).get(codigo, 0)}


def equivalencias_de(codigo: str, limite_por_tipo: int = 10) -> dict:
    filas = EquivalenciasRepository.get_equivalencias_con_score(codigo)
    material = ficha_material(codigo)

    # Una entrada por codigo equivalente, quedandose con el tipo mas fuerte
    mejor: dict[str, dict] = {}
    for f in filas:
        cod = f["codigo_equivalente"]
        if cod == codigo:
            continue
        previo = mejor.get(cod)
        if previo is None or _orden_tipo(f["tipo_equiv"]) < _orden_tipo(previo["tipo_equiv"]):
            mejor[cod] = f

    fichas = _fichas(list(mejor))
    grupos = []
    for tipo in TIPOS_ORDEN:
        del_tipo = sorted(
            (f for f in mejor.values() if f["tipo_equiv"] == tipo), key=lambda f: f["codigo_equivalente"]
        )
        if not del_tipo:
            continue
        items = []
        for f in del_tipo[:limite_por_tipo]:
            ficha = fichas.get(f["codigo_equivalente"], {})
            items.append(
                {
                    "codigo": f["codigo_equivalente"],
                    "descripcion": ficha.get("descripcion") or f["descripcion_equivalente"],
                    "criterio": f["criterio"],
                    "motivo": f["motivo_equivalencia"],
                    "unidad": ficha.get("unidad", "UNI"),
                    "precio_usd": ficha.get("precio_usd"),
                }
            )
        grupos.append(
            {
                "tipo": tipo,
                "compatibilidad_pct": del_tipo[0]["compatibilidad_pct"],
                "total": len(del_tipo),
                "items": items,
            }
        )
    return {"material": material, "grupos": grupos}


def _respuesta(intencion, consulta, texto, materiales=None, equivalencias=None, sugerencias=None) -> dict:
    return {
        "intencion": intencion,
        "consulta": consulta,
        "texto": texto,
        "materiales": materiales or [],
        "equivalencias": equivalencias,
        "sugerencias": sugerencias or [],
    }


def _sin_resultados(consulta: str) -> dict:
    return _respuesta(
        "sin_resultados",
        consulta,
        f"No encontré materiales para «{consulta}». Prueba con menos palabras o con el código SAP.",
        sugerencias=EJEMPLOS,
    )


def responder(mensaje: str) -> dict:
    consulta = (mensaje or "").strip()
    intencion = interpretar(consulta)

    if intencion["intencion"] == "ayuda":
        return _respuesta(
            "ayuda", consulta, "Describe el material que buscas o escribe un código SAP.", sugerencias=EJEMPLOS
        )

    if intencion["intencion"] == "descripcion":
        materiales = buscar_por_descripcion(intencion["texto"])
        if not materiales:
            return _sin_resultados(consulta)
        sugerencias = [f"equivalentes de {m['codigo']}" for m in materiales if m["cant_equivalencias"]][:2]
        return _respuesta(
            "descripcion",
            consulta,
            f"Encontré {len(materiales)} materiales para «{consulta}».",
            materiales,
            None,
            sugerencias,
        )

    codigo = intencion["codigo"]
    if codigo is None:  # "equivalentes de <descripcion>": se usa el mejor resultado
        mejores = buscar_por_descripcion(intencion["texto"], limite=1)
        if not mejores:
            return _sin_resultados(consulta)
        codigo = mejores[0]["codigo"]

    equivalencias = equivalencias_de(codigo)
    if equivalencias["material"] is None and not equivalencias["grupos"]:
        return _sin_resultados(consulta)
    materiales = [equivalencias["material"]] if equivalencias["material"] else []
    total = sum(g["total"] for g in equivalencias["grupos"])
    return _respuesta(
        intencion["intencion"], consulta, f"{codigo} tiene {total} equivalencias.", materiales, equivalencias
    )
