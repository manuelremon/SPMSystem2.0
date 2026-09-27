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
        # medidas y clasificaciones que el catalogo SAP no escribe (usa 12" o 300 a secas)
        "PULGADA", "PULGADAS", "PULG", "SERIE", "CLASE", "MEDIDA", "TAMANO",
    }
)

# palabra completa -> abreviaturas habituales en las descripciones SAP.
# Pueden llevar puntos ("V.ESF"): en SQL se buscan tal cual y en el ranking se comparan normalizadas.
ABREVIATURAS = {
    "ABRAZADERA": ("ABRAZ",),
    "ACEITE": ("ACEIT",),
    "ACERO": ("AC", "ACERO"),
    "ADAPTADOR": ("ADAPT",),
    "ARANDELA": ("ARAND",),
    "BRIDA": ("BRIDA",),
    "BULON": ("BULON", "BUL", "TORN"),
    "CABLE": ("CABLE", "CABL"),
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
    "ESFERICA": ("ESFER", "ESF", "V.ESF"),
    "ESFERICO": ("ESFER", "ESF", "V.ESF"),
    "ESCLUSA": ("ESCL", "V.ESC"),
    "RETENCION": ("RETEN", "V.RET"),
    "GLOBO": ("GLOBO", "V.GL"),
    "SEGURIDAD": ("SEGUR", "V.SEG"),
    "ESPIROMETALICA": ("ESPIR", "JUNT.ESP"),
    "ESPIRALADA": ("ESPIR", "JUNT.ESP"),
    "FILTRO": ("FILTR", "FILT"),
    "ELEMENTO": ("ELEM",),
    "ANILLO": ("ANILL",),
    "JUEGO": ("JGO",),
    "CONJUNTO": ("CONJ",),
    "COJINETE": ("COJ", "COJIN"),
    "CAMISA": ("CAMIS",),
    "VASTAGO": ("VAST",),
    "MODULO": ("MODUL",),
    "DISCO": ("DISC",),
    "RUPTURA": ("RUP",),
    "COLGADOR": ("COLG",),
    "ORIFICIO": ("ORIF",),
    "HIDRAULICO": ("HIDR", "HIDRAUL"),
    "INOX": ("INOX", "SS", "316", "304", "AISI"),
    "INOXIDABLE": ("INOX", "SS", "316", "304", "AISI"),
    "JUNTA": ("JUNTA", "JUNT", "JTA"),
    "JUNTAS": ("JUNTA", "JUNT", "JTA"),
    "MANGUERA": ("MANG", "MANGUER"),
    "MANOMETRO": ("MANOM",),
    "MOTOR": ("MOTOR", "MOT"),
    "NIPLE": ("NIPLE", "NIPL", "NIP"),
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
    # En SAP la valvula casi nunca se escribe: V.ESF. (esferica), V.ESC. (esclusa), V.RET. (retencion)...
    "VALVULA": ("VALV", "V.ESF", "V.ESC", "V.RET", "V.GL", "V.CN", "V.SEG"),
    "VALVULAS": ("VALV", "V.ESF", "V.ESC", "V.RET", "V.GL", "V.CN", "V.SEG"),
}
