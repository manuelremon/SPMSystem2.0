"""
Extractor de especificaciones tecnicas de descripciones de materiales

Extrae datos estructurados como:
- NPS (Nominal Pipe Size)
- Presion/Rating (150#, 300#, 600#, etc)
- Material (Acero, Inox, SS, etc)
- Diametro
- Tipo de conexion (BW, SW, NPT, RF, etc)
- Schedule (SCH 40, SCH 80, etc)
"""

import re
from typing import Dict, Optional, List, Any


# Patrones para extraccion de especificaciones
PATRONES = {
    # NPS: 1/2", 3/4", 1", 2", 3", etc (con o sin comillas)
    'nps': [
        r'(\d+/\d+)\s*["\']?(?:\s*X\s*\d+)?',  # Fracciones: 1/2", 3/4"
        r'(\d+(?:\.\d+)?)\s*["\'](?:\s*X\s*\d+)?',  # Enteros con comillas: 2", 3"
        r'\b(\d+(?:\.\d+)?)\s*(?:PULG|INCH|IN)\b',  # Con unidad: 2 PULG
        r'NPS\s*(\d+(?:/\d+)?)',  # Formato NPS 2, NPS 1/2
        r'\bDN\s*(\d+)\b',  # DN metrico: DN50, DN100
    ],

    # Presion/Rating: 150#, 300#, CL150, CLASS 150, etc
    'presion': [
        r'(\d{3,4})\s*#',  # 150#, 300#, 600#
        r'CL\s*(\d{3,4})',  # CL150, CL300
        r'CLASS\s*(\d{3,4})',  # CLASS 150
        r'CLASE\s*(\d{3,4})',  # CLASE 150
        r'(\d{3,4})\s*LB',  # 150LB
        r'RATING\s*(\d{3,4})',  # RATING 150
        r'PN\s*(\d+)',  # PN10, PN16 (metrico)
    ],

    # Material
    'material': [
        r'\b(A[- ]?105)\b',  # ASTM A105 (acero carbono forjado)
        r'\b(A[- ]?106)\b',  # ASTM A106 (tubo sin costura)
        r'\b(A[- ]?182)\b',  # ASTM A182 (inox forjado)
        r'\b(A[- ]?312)\b',  # ASTM A312 (tubo inox)
        r'\b(A[- ]?333)\b',  # ASTM A333 (tubo baja temp)
        r'\b(A[- ]?234)\b',  # ASTM A234 (fittings)
        r'\b(A[- ]?216)\b',  # ASTM A216 (fundicion acero)
        r'\b(A[- ]?351)\b',  # ASTM A351 (fundicion inox)
        r'\b(SS|INOX|STAINLESS)\b',  # Inoxidable
        r'\b(CS|CARBON|ACERO\s*CARBONO?)\b',  # Acero carbono
        r'\b(316L?|304L?|321)\b',  # Grados inox comunes
        r'\b(WCB|WCC)\b',  # Grados fundicion
        r'\b(F316|F304|F11|F22)\b',  # Grados forjados
        r'\b(GR\s*[A-Z]|GRADE\s*[A-Z])\b',  # Grados genericos
    ],

    # Tipo de conexion
    'conexion': [
        r'\b(BW|BUTT\s*WELD)\b',  # Soldadura a tope
        r'\b(SW|SOCKET\s*WELD)\b',  # Soldadura socket
        r'\b(NPT|THREADED|ROSCADO?)\b',  # Roscado
        r'\b(RF|RAISED\s*FACE)\b',  # Brida cara realzada
        r'\b(FF|FLAT\s*FACE)\b',  # Brida cara plana
        r'\b(RTJ|RING\s*TYPE\s*JOINT)\b',  # Junta anular
        r'\b(FLANG\w*)\b',  # Bridado
        r'\b(GROOVED|RANURAD[OA])\b',  # Ranurado
        r'\b(COMPRESSION|COMPRESION)\b',  # Compresion
    ],

    # Schedule
    'schedule': [
        r'\b(?:SCH|SCHEDULE)\s*(\d+[SXX]?)\b',  # SCH 40, SCH 80, SCH 160
        r'\bS[- ]?(\d+[SXX]?)\b',  # S-40, S40
        r'\bXS\b',  # Extra Strong
        r'\bXXS\b',  # Double Extra Strong
        r'\bSTD\b',  # Standard
    ],

    # Diametro (cuando no es NPS)
    'diametro': [
        r'\bOD\s*(\d+(?:\.\d+)?)\b',  # Diametro exterior
        r'\bID\s*(\d+(?:\.\d+)?)\b',  # Diametro interior
        r'(\d+(?:\.\d+)?)\s*MM\b',  # En milimetros
        r'(\d+(?:\.\d+)?)\s*CM\b',  # En centimetros
    ],

    # Longitud
    'longitud': [
        r'(\d+(?:\.\d+)?)\s*(?:M|MTS|METROS?)\b',
        r'(\d+(?:\.\d+)?)\s*(?:FT|FEET|PIES?)\b',
        r'L[= ]?(\d+(?:\.\d+)?)',
    ],
}


def extraer_especificaciones(descripcion: str) -> Dict[str, Any]:
    """
    Extrae especificaciones tecnicas de una descripcion de material.

    Args:
        descripcion: Descripcion del material (descripcion_corta o descripcion_larga)

    Returns:
        dict: Diccionario con especificaciones encontradas
    """
    if not descripcion:
        return {}

    specs = {}
    texto = descripcion.upper()

    # Extraer cada tipo de especificacion
    for campo, patrones in PATRONES.items():
        for patron in patrones:
            match = re.search(patron, texto)
            if match:
                valor = match.group(1) if match.lastindex else match.group(0)
                specs[campo] = normalizar_valor(campo, valor)
                break

    return specs


def normalizar_valor(campo: str, valor: str) -> str:
    """
    Normaliza un valor extraido segun su campo.
    """
    if not valor:
        return valor

    valor = valor.strip().upper()

    if campo == 'nps':
        # Convertir fracciones comunes a formato estandar
        conversiones = {
            '0.5': '1/2',
            '0.75': '3/4',
            '0.25': '1/4',
            '0.375': '3/8',
            '1.5': '1-1/2',
            '2.5': '2-1/2',
        }
        for decimal, fraccion in conversiones.items():
            if valor == decimal:
                return fraccion
        return valor

    if campo == 'presion':
        # Normalizar a formato sin #
        return valor.replace('#', '').strip()

    if campo == 'material':
        # Normalizar nombres de material
        if valor in ('SS', 'INOX', 'STAINLESS'):
            return 'INOX'
        if valor in ('CS', 'CARBON'):
            return 'ACERO CARBONO'
        return valor

    if campo == 'conexion':
        # Normalizar tipos de conexion
        normalizaciones = {
            'BUTT WELD': 'BW',
            'SOCKET WELD': 'SW',
            'THREADED': 'NPT',
            'ROSCADO': 'NPT',
            'RAISED FACE': 'RF',
            'FLAT FACE': 'FF',
            'RING TYPE JOINT': 'RTJ',
        }
        return normalizaciones.get(valor, valor)

    return valor


def extraer_tipo_material(descripcion: str) -> Optional[str]:
    """
    Determina el tipo general de material basado en palabras clave.

    Returns:
        str: Tipo de material (VALVULA, FITTING, TUBO, BRIDA, JUNTA, etc)
    """
    if not descripcion:
        return None

    texto = descripcion.upper()

    tipos = {
        'VALVULA': ['VALV', 'VALVE', 'GATE', 'GLOBE', 'CHECK', 'BALL', 'BUTTERFLY'],
        'FITTING': ['CODO', 'ELBOW', 'TEE', 'REDUCCION', 'REDUCER', 'CAP', 'COUPLING',
                   'UNION', 'NIPPLE', 'WYE', 'CROSS'],
        'BRIDA': ['BRIDA', 'FLANGE', 'BLIND', 'SLIP-ON', 'WELD NECK', 'SOCKET WELD'],
        'TUBO': ['TUBO', 'PIPE', 'TUBE', 'TUBERIA', 'TUBING'],
        'JUNTA': ['JUNTA', 'GASKET', 'SPIRAL WOUND', 'RING JOINT'],
        'EMPAQUE': ['EMPAQUE', 'PACKING', 'SEAL', 'O-RING'],
        'TORNILLO': ['TORNILLO', 'BOLT', 'STUD', 'NUT', 'TUERCA', 'WASHER', 'ARANDELA'],
        'SOPORTE': ['SOPORTE', 'SUPPORT', 'HANGER', 'CLAMP', 'ABRAZADERA'],
        'INSTRUMENTO': ['MANOMETRO', 'GAUGE', 'TERMOMETRO', 'TRANSMISOR', 'SENSOR'],
    }

    for tipo, palabras_clave in tipos.items():
        for palabra in palabras_clave:
            if palabra in texto:
                return tipo

    return 'OTRO'


def son_especificaciones_compatibles(specs1: Dict, specs2: Dict,
                                      tolerancia_nps: bool = False) -> bool:
    """
    Determina si dos conjuntos de especificaciones son compatibles.

    Args:
        specs1: Primer conjunto de especificaciones
        specs2: Segundo conjunto de especificaciones
        tolerancia_nps: Si True, permite NPS adyacentes como compatibles

    Returns:
        bool: True si son compatibles
    """
    if not specs1 or not specs2:
        return False

    # Campos criticos que deben coincidir exactamente
    campos_criticos = ['nps', 'presion']

    for campo in campos_criticos:
        val1 = specs1.get(campo)
        val2 = specs2.get(campo)

        if val1 and val2 and val1 != val2:
            # Verificar tolerancia de NPS si esta habilitada
            if campo == 'nps' and tolerancia_nps:
                if not son_nps_adyacentes(val1, val2):
                    return False
            else:
                return False

    # Campos importantes (material y conexion deben ser compatibles)
    if specs1.get('material') and specs2.get('material'):
        if not son_materiales_compatibles(specs1['material'], specs2['material']):
            return False

    if specs1.get('conexion') and specs2.get('conexion'):
        if specs1['conexion'] != specs2['conexion']:
            return False

    return True


def son_nps_adyacentes(nps1: str, nps2: str) -> bool:
    """
    Verifica si dos valores de NPS son adyacentes en la escala.
    Por ejemplo: 1/2 y 3/4, o 2 y 2-1/2
    """
    # Escala NPS comun
    escala = ['1/4', '3/8', '1/2', '3/4', '1', '1-1/4', '1-1/2', '2',
              '2-1/2', '3', '3-1/2', '4', '5', '6', '8', '10', '12',
              '14', '16', '18', '20', '24', '30', '36']

    try:
        idx1 = escala.index(nps1)
        idx2 = escala.index(nps2)
        return abs(idx1 - idx2) <= 1
    except ValueError:
        return False


def son_materiales_compatibles(mat1: str, mat2: str) -> bool:
    """
    Verifica si dos materiales son compatibles (misma familia).
    """
    # Familias de materiales
    familias = {
        'ACERO_CARBONO': ['A105', 'A106', 'A234', 'A216', 'WCB', 'WCC',
                         'CS', 'ACERO CARBONO', 'GR B', 'GRADE B'],
        'INOX_300': ['316', '316L', '304', '304L', 'A182', 'A312', 'A351',
                    'CF8M', 'CF8', 'F316', 'F304', 'INOX', 'SS', 'STAINLESS'],
        'ALEACION': ['F11', 'F22', 'A335', 'CHROME', 'CROMO', 'MONEL', 'INCONEL'],
    }

    # Encontrar familia de cada material
    familia1 = None
    familia2 = None

    for familia, miembros in familias.items():
        for miembro in miembros:
            if miembro in mat1:
                familia1 = familia
            if miembro in mat2:
                familia2 = familia

    if familia1 and familia2:
        return familia1 == familia2

    return True  # Si no se identifican familias, asumir compatible


def formatear_especificaciones(specs: Dict) -> str:
    """
    Formatea un diccionario de especificaciones como string legible.
    """
    if not specs:
        return ""

    partes = []
    orden = ['nps', 'presion', 'material', 'conexion', 'schedule']

    for campo in orden:
        if campo in specs:
            partes.append(f"{campo}={specs[campo]}")

    return " | ".join(partes)
