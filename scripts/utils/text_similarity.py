"""
Funciones de similitud textual para matching de materiales

Implementa algoritmos de similitud para comparar descripciones de materiales
y determinar equivalencias potenciales.
"""

import re
from difflib import SequenceMatcher
from typing import List, Tuple, Set


def normalizar_texto(texto: str) -> str:
    """
    Normaliza un texto para comparacion:
    - Convierte a mayusculas
    - Elimina caracteres especiales
    - Normaliza espacios multiples
    - Elimina acentos basicos
    """
    if not texto:
        return ""

    # Mayusculas
    texto = texto.upper()

    # Reemplazar acentos comunes
    acentos = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'Ñ': 'N', 'Ü': 'U'
    }
    for acento, reemplazo in acentos.items():
        texto = texto.replace(acento, reemplazo)

    # Eliminar caracteres especiales excepto letras, numeros y espacios
    texto = re.sub(r'[^A-Z0-9\s/\-\.]', '', texto)

    # Normalizar espacios
    texto = re.sub(r'\s+', ' ', texto).strip()

    return texto


def tokenizar(texto: str) -> List[str]:
    """
    Divide un texto en tokens (palabras/numeros significativos)
    """
    if not texto:
        return []

    # Dividir por espacios y caracteres especiales
    tokens = re.split(r'[\s/\-\.]+', texto)

    # Filtrar tokens vacios y muy cortos (menos de 2 caracteres)
    tokens = [t for t in tokens if len(t) >= 2]

    return tokens


def calcular_similitud_tokens(tokens1: List[str], tokens2: List[str]) -> float:
    """
    Calcula similitud basada en tokens comunes (Jaccard)
    """
    if not tokens1 or not tokens2:
        return 0.0

    set1 = set(tokens1)
    set2 = set(tokens2)

    interseccion = set1.intersection(set2)
    union = set1.union(set2)

    if not union:
        return 0.0

    return len(interseccion) / len(union)


def calcular_similitud_secuencia(texto1: str, texto2: str) -> float:
    """
    Calcula similitud usando SequenceMatcher (similar a diff)
    """
    if not texto1 or not texto2:
        return 0.0

    return SequenceMatcher(None, texto1, texto2).ratio()


def calcular_similitud(texto1: str, texto2: str, pesos: Tuple[float, float] = (0.6, 0.4)) -> float:
    """
    Calcula similitud combinada entre dos textos.

    Combina:
    - Similitud de tokens (Jaccard): detecta palabras comunes
    - Similitud de secuencia: detecta orden y estructura similar

    Args:
        texto1: Primer texto a comparar
        texto2: Segundo texto a comparar
        pesos: Tupla (peso_tokens, peso_secuencia), deben sumar 1.0

    Returns:
        float: Valor de similitud entre 0.0 y 1.0
    """
    # Normalizar textos
    norm1 = normalizar_texto(texto1)
    norm2 = normalizar_texto(texto2)

    if not norm1 or not norm2:
        return 0.0

    # Caso identico
    if norm1 == norm2:
        return 1.0

    # Tokenizar
    tokens1 = tokenizar(norm1)
    tokens2 = tokenizar(norm2)

    # Calcular similitudes
    sim_tokens = calcular_similitud_tokens(tokens1, tokens2)
    sim_secuencia = calcular_similitud_secuencia(norm1, norm2)

    # Combinar con pesos
    peso_tokens, peso_secuencia = pesos
    similitud = (peso_tokens * sim_tokens) + (peso_secuencia * sim_secuencia)

    return round(similitud, 4)


def encontrar_palabras_clave(texto: str) -> Set[str]:
    """
    Extrae palabras clave significativas de una descripcion de material.
    Filtra palabras comunes sin valor discriminante.
    """
    stopwords = {
        'DE', 'LA', 'EL', 'EN', 'CON', 'PARA', 'POR', 'SIN', 'SOBRE',
        'A', 'Y', 'O', 'DEL', 'AL', 'LOS', 'LAS', 'UN', 'UNA',
        'TYPE', 'TIPO', 'MODEL', 'MODELO', 'SIZE', 'MARCA'
    }

    texto_norm = normalizar_texto(texto)
    tokens = tokenizar(texto_norm)

    # Filtrar stopwords y tokens muy cortos
    palabras_clave = {t for t in tokens if t not in stopwords and len(t) >= 3}

    return palabras_clave


def son_descripciones_similares(desc1: str, desc2: str, umbral: float = 0.80) -> bool:
    """
    Determina si dos descripciones son suficientemente similares.

    Args:
        desc1: Primera descripcion
        desc2: Segunda descripcion
        umbral: Umbral minimo de similitud (default 0.80)

    Returns:
        bool: True si la similitud >= umbral
    """
    return calcular_similitud(desc1, desc2) >= umbral


def calcular_similitud_especificaciones(specs1: dict, specs2: dict) -> float:
    """
    Calcula similitud entre dos diccionarios de especificaciones tecnicas.

    Specs pueden incluir: nps, presion, material, diametro, conexion, etc.
    """
    if not specs1 or not specs2:
        return 0.0

    # Campos a comparar con sus pesos
    campos_pesos = {
        'nps': 0.25,           # Tamano nominal (critico)
        'presion': 0.20,       # Rating de presion
        'material': 0.20,      # Material (acero, inox, etc)
        'diametro': 0.15,      # Diametro
        'conexion': 0.10,      # Tipo de conexion
        'schedule': 0.10       # Schedule
    }

    similitud_total = 0.0
    peso_total = 0.0

    for campo, peso in campos_pesos.items():
        val1 = specs1.get(campo)
        val2 = specs2.get(campo)

        if val1 is not None and val2 is not None:
            # Comparar valores
            if val1 == val2:
                similitud_total += peso
            elif isinstance(val1, str) and isinstance(val2, str):
                # Comparacion parcial para strings
                if calcular_similitud(val1, val2) >= 0.90:
                    similitud_total += peso * 0.8
            peso_total += peso

    if peso_total == 0:
        return 0.0

    return round(similitud_total / peso_total, 4)
