"""
Procesador NLP para extraer entidades de texto libre.

Extrae equipos, componentes, tipos de falla y keywords
de descripciones de problemas en lenguaje natural.

Incluye:
- Lemmatización básica para español (stemming de sufijos comunes)
- Manejo de acrónimos técnicos (SAP, ISO, API, ANSI)
- Normalización de plurales y conjugaciones verbales
- Extracción de dimensiones técnicas (3/4", DN50, etc.)
"""

import logging
import re
from typing import Any, Dict, List, Set, Tuple

from .base import BaseTool, ToolMetadata

logger = logging.getLogger(__name__)


# =============================================================================
# Stemmer Español Ligero (sin dependencias externas)
# =============================================================================

class SpanishStemmer:
    """
    Stemmer básico para español orientado a terminología industrial.

    Elimina sufijos comunes para normalizar variantes de palabras:
    - Plurales: -s, -es
    - Verbos: -ando, -endo, -ido, -ado, -ar, -er, -ir
    - Sustantivos: -ción, -miento, -dor, -ador
    - Adjetivos: -oso, -ivo, -ble
    """

    # Sufijos en orden de prioridad (más largo primero)
    VERB_SUFFIXES = [
        'ándose', 'iéndose', 'amente',
        'iendo', 'ando', 'aron', 'ieron',
        'aban', 'ían', 'ado', 'ido', 'ando',
        'ar', 'er', 'ir',
    ]

    NOUN_SUFFIXES = [
        'aciones', 'iciones', 'amiento', 'imiento',
        'ación', 'ición', 'miento',
        'adores', 'edores', 'idores',
        'ador', 'edor', 'idor',
        'iones', 'ción', 'sión',
        'ista', 'ismo',
    ]

    ADJ_SUFFIXES = [
        'ísimo', 'ísima', 'ísimos', 'ísimas',
        'osos', 'osas', 'oso', 'osa',
        'ivos', 'ivas', 'ivo', 'iva',
        'bles', 'ble',
        'ante', 'ente',
    ]

    PLURAL_SUFFIXES = [
        'ces',  # luz -> luces
        'es',
        's',
    ]

    # Excepciones que NO deben reducirse
    EXCEPTIONS = {
        'bomba', 'motor', 'sello', 'filtro', 'valvula', 'sensor',
        'cable', 'tubo', 'aceite', 'grasa', 'agua', 'aire',
        'rodamiento', 'acople', 'brida', 'manguera', 'correa',
        'tanque', 'bomba', 'compresor', 'reductor', 'generador',
    }

    # Mapping de irregulares (stem -> canonical)
    IRREGULARS = {
        'romp': 'rotura',
        'rot': 'rotura',
        'quebr': 'rotura',
        'fug': 'fuga',
        'perd': 'fuga',
        'gote': 'fuga',
        'desgast': 'desgaste',
        'gast': 'desgaste',
        'calienta': 'calentamiento',
        'calent': 'calentamiento',
        'vibr': 'vibracion',
        'ruid': 'ruido',
    }

    def __init__(self):
        # Precompilar sufijos ordenados por longitud (más largo primero)
        all_suffixes = (
            self.VERB_SUFFIXES +
            self.NOUN_SUFFIXES +
            self.ADJ_SUFFIXES +
            self.PLURAL_SUFFIXES
        )
        self._suffixes = sorted(set(all_suffixes), key=len, reverse=True)

    def stem(self, word: str) -> str:
        """
        Reduce una palabra a su raíz (stem).

        Args:
            word: Palabra en español (minúsculas)

        Returns:
            Raíz de la palabra
        """
        if not word or len(word) < 4:
            return word

        # No reducir excepciones conocidas
        if word in self.EXCEPTIONS:
            return word

        # Intentar reducir sufijos
        original = word
        for suffix in self._suffixes:
            if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                word = word[:-len(suffix)]
                break

        # Aplicar mapping de irregulares si existe
        if word in self.IRREGULARS:
            return self.IRREGULARS[word]

        return word if word else original

    def normalize_plural(self, word: str) -> str:
        """Normaliza solo plurales sin afectar otros sufijos."""
        if not word or len(word) < 3:
            return word

        # casos especiales: z -> ces
        if word.endswith('ces') and len(word) > 4:
            return word[:-3] + 'z'

        if word.endswith('es') and len(word) > 3:
            # motores -> motor, válvulas -> válvula
            return word[:-2]

        if word.endswith('s') and len(word) > 3:
            return word[:-1]

        return word


# Instancia global del stemmer
_stemmer = SpanishStemmer()

# Stopwords en español para filtrar
STOPWORDS = {
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "en",
    "por",
    "para",
    "con",
    "sin",
    "sobre",
    "que",
    "se",
    "es",
    "son",
    "esta",
    "este",
    "estos",
    "estas",
    "hay",
    "muy",
    "mas",
    "pero",
    "como",
    "cuando",
    "donde",
    "desde",
    "hasta",
    "entre",
    "durante",
    "antes",
    "despues",
    "porque",
    "aunque",
    "mientras",
    "siendo",
    "sido",
    "ser",
    "tiene",
    "tienen",
    "tengo",
    "hacer",
    "hace",
    "hizo",
    "poder",
    "puede",
    "pueden",
    "querer",
    "quiere",
    "necesita",
    "necesitan",
    "necesito",
    "linea",
    "area",
    "zona",
    "equipo",
    "sistema",
    "parte",
}


class NLPProcessor(BaseTool):
    """
    Procesa texto libre y extrae entidades relevantes para SPM.

    Extrae:
    - Equipos: bomba, motor, válvula, compresor, etc.
    - Componentes: sello, rodamiento, correa, filtro, etc.
    - Tipos de falla: fuga, rotura, desgaste, ruido, etc.
    - Keywords adicionales: palabras relevantes no clasificadas
    """

    def __init__(self):
        super().__init__(
            name="nlp_processor",
            description="Procesa texto libre y extrae entidades para búsqueda de materiales",
        )

        # Diccionario de sinónimos técnicos (canonical -> variantes)
        self.synonyms = {
            # Equipos principales
            "bomba": ["pump", "impulsor", "rodete", "bombas", "centrifuga"],
            "motor": ["engine", "motorreductor", "motores", "electrico"],
            "valvula": ["valve", "llave", "grifo", "valvulas", "compuerta", "esfera", "globo"],
            "compresor": ["compressor", "compresores", "compresor"],
            "ventilador": ["fan", "extractor", "ventiladores", "turbina"],
            "transformador": ["transformers", "trafo", "transformadores"],
            "generador": ["generator", "generadores", "alternador"],
            "reductor": ["gearbox", "reductores", "caja", "engranajes"],
            "tanque": ["tank", "deposito", "tanques", "recipiente", "cisterna"],
            "tuberia": ["pipe", "tubo", "ducto", "cañeria", "tuberias"],
            "intercambiador": ["exchanger", "intercambiadores", "calor"],
            # Componentes
            "sello": ["seal", "empaque", "junta", "oring", "sellos", "mecanico", "retenes"],
            "rodamiento": ["bearing", "ruleman", "cojinete", "rodamientos", "balero"],
            "correa": ["belt", "banda", "faja", "correas", "transmision"],
            "filtro": ["filter", "cartucho", "filtros", "elemento", "malla"],
            "acople": ["coupling", "acoplamiento", "acoples", "flexible"],
            "impulsor": ["impeller", "impulsores", "rotor", "alabes"],
            "eje": ["shaft", "ejes", "flecha", "arbol"],
            "chumacera": ["bearing", "chumaceras", "soporte", "pedestal"],
            "valvula_check": ["check", "retencion", "antirretorno"],
            "manometro": ["gauge", "manometros", "presion", "indicador"],
            "termometro": ["thermometer", "temperatura", "termometros"],
            "actuador": ["actuator", "actuadores", "neumatico", "electrico"],
            "sensor": ["sensor", "sensores", "detector", "transductor"],
            "electrovalvula": ["solenoid", "electrovalvulas", "solenoide"],
            "contactor": ["contactor", "contactores", "rele", "relay"],
            "fusible": ["fuse", "fusibles", "proteccion"],
            "cable": ["cable", "cables", "conductor", "alambre"],
            "manguera": ["hose", "mangueras", "flexible"],
            "brida": ["flange", "bridas", "conexion"],
            "tornillo": ["bolt", "screw", "tornillos", "perno"],
            "tuerca": ["nut", "tuercas"],
            "arandela": ["washer", "arandelas"],
            "lubricante": ["oil", "grease", "aceite", "grasa", "lubricacion"],
        }

        # Patrones de falla (tipo_falla -> variantes)
        self.failure_patterns = {
            "fuga": ["pierde", "gotea", "derrame", "escape", "fugando", "perdida", "filtra"],
            "rotura": ["roto", "partido", "quebrado", "dañado", "rompio", "fracturado", "fisurado"],
            "desgaste": ["gastado", "desgastado", "usado", "erosionado", "corroido", "picado"],
            "ruido": ["suena", "vibra", "golpea", "chirria", "ruidoso", "vibracion", "zumbido"],
            "calentamiento": [
                "calienta",
                "caliente",
                "sobrecalentamiento",
                "recalentamiento",
                "temperatura",
            ],
            "falla_electrica": [
                "cortocircuito",
                "corto",
                "quemado",
                "dispara",
                "salta",
                "electrico",
            ],
            "atascamiento": ["trabado", "atascado", "bloqueado", "trancado", "atorado"],
            "cavitacion": ["cavita", "cavitacion", "burbujas", "golpeteo"],
        }

        # Clasificación de términos en equipos vs componentes
        self.equipment_terms = {
            "bomba",
            "motor",
            "valvula",
            "compresor",
            "ventilador",
            "transformador",
            "generador",
            "reductor",
            "tanque",
            "tuberia",
            "intercambiador",
        }

    def execute(self, text: str = "", **kwargs) -> Dict[str, Any]:
        """
        Procesa texto y extrae entidades.

        Args:
            text: Texto libre describiendo un problema

        Returns:
            Diccionario con entidades extraídas:
            - equipos: Lista de equipos detectados
            - componentes: Lista de componentes detectados
            - tipo_falla: Lista de tipos de falla
            - keywords: Palabras clave adicionales
            - dimensiones: Dimensiones técnicas (3/4", DN50, etc.)
            - acronimos: Acrónimos detectados (SAP, ISO, etc.)
            - search_queries: Queries generados para búsqueda
        """
        if not text:
            return {
                "equipos": [],
                "componentes": [],
                "tipo_falla": [],
                "keywords": [],
                "dimensiones": [],
                "acronimos": [],
                "search_queries": [],
            }

        entities = self.extract_entities(text)
        queries = self.generate_search_queries(entities)

        return {
            "equipos": entities["equipos"],
            "componentes": entities["componentes"],
            "tipo_falla": entities["tipo_falla"],
            "keywords": entities["keywords"],
            "dimensiones": entities.get("dimensiones", []),
            "acronimos": entities.get("acronimos", []),
            "search_queries": queries,
        }

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extrae entidades del texto: equipo, componente, tipo_falla.

        Mejoras v2.0:
        - Usa stemming para normalizar variantes (bombas -> bomba)
        - Extrae acrónimos técnicos (SAP, ISO, ANSI, API)
        - Detecta dimensiones técnicas (3/4", DN50, 1/2 pulgada)

        Args:
            text: Texto en lenguaje natural

        Returns:
            Diccionario con listas de entidades encontradas
        """
        text_lower = text.lower()

        entities: Dict[str, List[str]] = {
            "equipos": [],
            "componentes": [],
            "tipo_falla": [],
            "keywords": [],
            "dimensiones": [],
            "acronimos": [],
        }

        # 1. Extraer acrónimos (mayúsculas de 2-5 caracteres)
        acronyms = re.findall(r'\b[A-Z]{2,5}\b', text)
        entities["acronimos"] = list(set(acronyms))

        # 2. Extraer dimensiones técnicas
        # Patrones: 3/4", 1/2 pulgada, DN50, 2", 25mm, M8, etc.
        dimension_patterns = [
            r'\d+/\d+"?',                    # 3/4", 1/2
            r'\d+(?:\.\d+)?\s*(?:mm|cm|m|pulg|pulgada|inch|in)"?',  # 25mm, 2 pulg
            r'DN\s*\d+',                     # DN50, DN 100
            r'M\d+(?:x\d+)?',                # M8, M10x1.5
            r'\d+(?:\.\d+)?(?:"|\')',        # 2", 1.5"
            r'#\d+',                         # #8 (tornillos)
            r'\d+\s*x\s*\d+(?:\s*x\s*\d+)?', # 10x20, 10x20x5
        ]
        for pattern in dimension_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            entities["dimensiones"].extend(matches)
        entities["dimensiones"] = list(set(entities["dimensiones"]))

        # 3. Tokenizar y limpiar (permite caracteres con acentos y números)
        words = re.findall(r"\b[a-záéíóúüñ]+\b", text_lower)

        found_canonical: Set[str] = set()

        # 4. Buscar matches con sinónimos (usando stemming)
        for word in words:
            # Normalizar con stemmer
            word_stemmed = _stemmer.stem(word)
            word_plural_norm = _stemmer.normalize_plural(word)

            # Intentar match con word original, stemmed y plural normalizado
            word_variants = {word, word_stemmed, word_plural_norm}

            for canonical, synonyms in self.synonyms.items():
                # También normalizar el canonical y sinónimos
                synonyms_expanded = set(synonyms)
                synonyms_expanded.add(canonical)
                synonyms_expanded.add(_stemmer.normalize_plural(canonical))

                # Verificar si alguna variante hace match
                if word_variants & synonyms_expanded:
                    if canonical not in found_canonical:
                        found_canonical.add(canonical)
                        if canonical in self.equipment_terms:
                            entities["equipos"].append(canonical)
                        else:
                            entities["componentes"].append(canonical)
                    break

            # 5. Buscar tipos de falla (con stemming)
            for failure_type, patterns in self.failure_patterns.items():
                patterns_expanded = set(patterns)
                # Agregar stems de los patrones
                for p in patterns:
                    patterns_expanded.add(_stemmer.stem(p))

                if word_variants & patterns_expanded:
                    if failure_type not in entities["tipo_falla"]:
                        entities["tipo_falla"].append(failure_type)
                    break

        # 6. Keywords adicionales (sustantivos no reconocidos, sin stopwords)
        keywords = []
        for w in words:
            if len(w) > 3 and w not in STOPWORDS and w not in found_canonical:
                # Normalizar keyword
                w_normalized = _stemmer.normalize_plural(w)
                # Evitar duplicados
                if w_normalized not in keywords:
                    keywords.append(w_normalized)

        entities["keywords"] = keywords[:10]  # Limitar a 10 keywords

        return entities

    def generate_search_queries(self, entities: Dict[str, List[str]]) -> List[str]:
        """
        Genera queries de búsqueda para materiales.

        Combina equipos + componentes para crear búsquedas específicas.

        Args:
            entities: Diccionario con entidades extraídas

        Returns:
            Lista de queries para buscar en BD de materiales
        """
        queries: List[str] = []

        # Prioridad 1: Combinar componentes + equipos (ej: "sello bomba")
        for comp in entities["componentes"]:
            for equipo in entities["equipos"]:
                queries.append(f"{comp} {equipo}")

        # Prioridad 2: Solo componentes
        for comp in entities["componentes"]:
            if comp not in queries:
                queries.append(comp)

        # Prioridad 3: Solo equipos (si no hay componentes)
        if not entities["componentes"]:
            for equipo in entities["equipos"]:
                if equipo not in queries:
                    queries.append(equipo)

        # Prioridad 4: Keywords relevantes (máximo 5)
        for kw in entities["keywords"][:5]:
            if kw not in queries and len(kw) > 4:
                queries.append(kw)

        # Eliminar duplicados manteniendo orden
        seen: set = set()
        unique_queries: List[str] = []
        for q in queries:
            if q not in seen:
                seen.add(q)
                unique_queries.append(q)

        return unique_queries

    def get_metadata(self) -> ToolMetadata:
        """Retorna metadatos de la herramienta."""
        return ToolMetadata(
            name=self.name,
            description=self.description,
            input_schema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Texto libre describiendo el problema",
                    },
                },
                "required": ["text"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "equipos": {"type": "array", "items": {"type": "string"}},
                    "componentes": {"type": "array", "items": {"type": "string"}},
                    "tipo_falla": {"type": "array", "items": {"type": "string"}},
                    "keywords": {"type": "array", "items": {"type": "string"}},
                    "dimensiones": {"type": "array", "items": {"type": "string"}},
                    "acronimos": {"type": "array", "items": {"type": "string"}},
                    "search_queries": {"type": "array", "items": {"type": "string"}},
                },
            },
        )


# =============================================================================
# Funciones de utilidad exportadas
# =============================================================================

def stem_spanish(word: str) -> str:
    """
    Reduce una palabra en español a su raíz.

    Args:
        word: Palabra en español

    Returns:
        Raíz (stem) de la palabra
    """
    return _stemmer.stem(word.lower())


def normalize_plural_spanish(word: str) -> str:
    """
    Normaliza un plural en español a su forma singular.

    Args:
        word: Palabra posiblemente en plural

    Returns:
        Forma singular de la palabra
    """
    return _stemmer.normalize_plural(word.lower())
