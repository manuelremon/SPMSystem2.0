"""
Procesador NLP para extraer entidades de texto libre.

Extrae equipos, componentes, tipos de falla y keywords
de descripciones de problemas en lenguaje natural.
"""

import logging
import re
from typing import Any, Dict, List

from .base import BaseTool, ToolMetadata

logger = logging.getLogger(__name__)

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
            Diccionario con entidades extraídas
        """
        if not text:
            return {
                "equipos": [],
                "componentes": [],
                "tipo_falla": [],
                "keywords": [],
            }

        entities = self.extract_entities(text)
        queries = self.generate_search_queries(entities)

        return {
            "equipos": entities["equipos"],
            "componentes": entities["componentes"],
            "tipo_falla": entities["tipo_falla"],
            "keywords": entities["keywords"],
            "search_queries": queries,
        }

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extrae entidades del texto: equipo, componente, tipo_falla.

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
        }

        # Tokenizar y limpiar (permite caracteres con acentos)
        words = re.findall(r"\b[a-záéíóúüñ]+\b", text_lower)

        found_canonical: set = set()

        # Buscar matches con sinónimos
        for word in words:
            for canonical, synonyms in self.synonyms.items():
                if word == canonical or word in synonyms:
                    if canonical not in found_canonical:
                        found_canonical.add(canonical)
                        if canonical in self.equipment_terms:
                            entities["equipos"].append(canonical)
                        else:
                            entities["componentes"].append(canonical)

            # Buscar tipos de falla
            for failure_type, patterns in self.failure_patterns.items():
                if word in patterns and failure_type not in entities["tipo_falla"]:
                    entities["tipo_falla"].append(failure_type)

        # Keywords adicionales (sustantivos no reconocidos, sin stopwords)
        keywords = []
        for w in words:
            if len(w) > 3 and w not in STOPWORDS and w not in found_canonical:
                # Evitar duplicados
                if w not in keywords:
                    keywords.append(w)

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
                    "search_queries": {"type": "array", "items": {"type": "string"}},
                },
            },
        )
