"""
Diccionario del buscador de materiales.

Las descripciones del catalogo son abreviaturas estilo SAP (BOMBA CENTRIF./REP).
Claves y valores en MAYUSCULAS y sin tildes (ver buscador_materiales_service.normalizar).
"""

PALABRAS_VACIAS = frozenset(
    {
        "A", "AL", "CON", "DE", "DEL", "EL", "EN", "LA", "LAS", "LO", "LOS", "O", "PARA",
        "POR", "QUE", "SE", "SIN", "SU", "UN", "UNA", "UNOS", "UNAS", "Y", "HAY", "TIENE",
        "BUSCO", "NECESITO", "QUIERO", "MATERIAL", "MATERIALES", "CODIGO",
    }
)

# palabra completa -> abreviaturas habituales en las descripciones SAP
ABREVIATURAS = {
    "ABRAZADERA": ("ABRAZ",),
    "ACEITE": ("ACEIT",),
    "ACERO": ("AC", "ACERO"),
    "ADAPTADOR": ("ADAPT",),
    "ARANDELA": ("ARAND",),
    "BRIDA": ("BRIDA",),
    "BULON": ("BULON", "TORN"),
    "CABLE": ("CABLE",),
    "CADENA": ("CADEN",),
    "CAÑERIA": ("CAÑER", "CANER"),
    "CANERIA": ("CANER", "CAÑER"),
    "CENTRIFUGA": ("CENTRIF",),
    "CENTRIFUGO": ("CENTRIF",),
    "CILINDRO": ("CIL", "CILIN"),
    "CODO": ("CODO",),
    "CONECTOR": ("CONECT", "CONEC"),
    "CORREA": ("CORRE",),
    "ELECTRICO": ("ELECT", "ELEC"),
    "EMPAQUETADURA": ("EMPAQ",),
    "ENGRANAJE": ("ENGRAN",),
    "ESFERICA": ("ESFER", "ESF"),
    "ESFERICO": ("ESFER", "ESF"),
    "FILTRO": ("FILTR", "FILT"),
    "HIDRAULICO": ("HIDR", "HIDRAUL"),
    "JUNTA": ("JUNTA", "JTA"),
    "MANGUERA": ("MANG", "MANGUER"),
    "MANOMETRO": ("MANOM",),
    "MOTOR": ("MOTOR", "MOT"),
    "NIPLE": ("NIPLE", "NIP"),
    "REDUCCION": ("RED", "REDUC"),
    "REPUESTO": ("REP", "REPUE"),
    "RETEN": ("RETEN",),
    "RODAMIENTO": ("ROD", "RODAM"),
    "SELLO": ("SELLO", "SELL"),
    "SELLADO": ("SELL", "2RS"),
    "SOPORTE": ("SOP", "SOPOR"),
    "TORNILLO": ("TORN", "BULON"),
    "TUBERIA": ("TUB", "TUBER"),
    "TUBO": ("TUBO", "TUB"),
    "TUERCA": ("TUERC",),
    "VALVULA": ("VALV",),
}
