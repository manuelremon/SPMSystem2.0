"""
Genera plantilla Excel completa para modo temporal MRP/Forecast.

Modelo de datos basado en estructura SAP real:
- 5 hojas: stock, consumo_historico, solpeds_en_curso, pedidos_en_curso, parametros_mrp
- Códigos de material numéricos (estilo SAP)
- Grupos de artículos numéricos
- Criticidad A/B/C
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

np.random.seed(42)

# ============================================================================
# CÓDIGOS DE GRUPOS DE ARTÍCULOS SAP
# ============================================================================
GRUPOS_ARTICULOS = {
    119: "REPUESTOS GENERALES",
    302: "SELLOS Y EMPAQUES",
    802: "INSTRUMENTACION",
    915: "ELECTRICO",
    1124: "RODAMIENTOS",
    1130: "SELLOS MECANIC./REP.",
    1205: "TRANSMISION",
    1310: "LUBRICANTES",
    1415: "FILTROS",
    1520: "FERRETERIA",
    1625: "HIDRAULICA",
}

# ============================================================================
# CENTROS SAP
# ============================================================================
CENTROS = {
    1008: "Planta Principal",
    1064: "Centro Secundario",
    1500: "Almacén Central",
    1059: "Taller Central",
}

# ============================================================================
# HOJA 1: STOCK - 35 materiales con códigos SAP numéricos
# ============================================================================
stock_data = [
    # Rodamientos (grupo 1124)
    {"material": 30297157, "descripcion": "RODAMIENTO SKF 6205-2RS", "centro": 1008, "almacen": "0001", "stock": 45, "um": "UNI", "precio_usd": 28.50, "grupo_articulos": 1124, "ubicacion": "A-01-01", "criticidad": "A", "sector": "MANTENIMIENTO"},
    {"material": 30297158, "descripcion": "RODAMIENTO SKF 6308-2RS", "centro": 1008, "almacen": "0001", "stock": 30, "um": "UNI", "precio_usd": 52.00, "grupo_articulos": 1124, "ubicacion": "A-01-02", "criticidad": "A", "sector": "MANTENIMIENTO"},
    {"material": 30297159, "descripcion": "RODAMIENTO FAG 22212E", "centro": 1008, "almacen": "0001", "stock": 12, "um": "UNI", "precio_usd": 185.00, "grupo_articulos": 1124, "ubicacion": "A-01-03", "criticidad": "A", "sector": "MANTENIMIENTO"},
    {"material": 30297160, "descripcion": "RODAMIENTO NTN 6310-2RS", "centro": 1064, "almacen": "0001", "stock": 18, "um": "UNI", "precio_usd": 68.00, "grupo_articulos": 1124, "ubicacion": "A-01-04", "criticidad": "B", "sector": "MANTENIMIENTO"},

    # Transmisión (grupo 1205)
    {"material": 30298001, "descripcion": "CORREA DENTADA HTD 8M-720", "centro": 1008, "almacen": "0002", "stock": 8, "um": "UNI", "precio_usd": 95.00, "grupo_articulos": 1205, "ubicacion": "A-02-01", "criticidad": "A", "sector": "MANTENIMIENTO"},
    {"material": 30298002, "descripcion": "CORREA TRAPECIAL A-68", "centro": 1008, "almacen": "0002", "stock": 25, "um": "UNI", "precio_usd": 18.50, "grupo_articulos": 1205, "ubicacion": "A-02-02", "criticidad": "C", "sector": "MANTENIMIENTO"},
    {"material": 30298003, "descripcion": "ACOPLAMIENTO FLEXIBLE L-100", "centro": 1008, "almacen": "0002", "stock": 6, "um": "UNI", "precio_usd": 145.00, "grupo_articulos": 1205, "ubicacion": "A-02-03", "criticidad": "A", "sector": "MANTENIMIENTO"},

    # Lubricantes (grupo 1310)
    {"material": 30299001, "descripcion": "ACEITE HIDRAULICO ISO 68", "centro": 1008, "almacen": "0003", "stock": 400, "um": "L", "precio_usd": 4.50, "grupo_articulos": 1310, "ubicacion": "B-01-01", "criticidad": "A", "sector": "LUBRICACION"},
    {"material": 30299002, "descripcion": "ACEITE ENGRANAJES ISO 220", "centro": 1008, "almacen": "0003", "stock": 200, "um": "L", "precio_usd": 6.20, "grupo_articulos": 1310, "ubicacion": "B-01-02", "criticidad": "B", "sector": "LUBRICACION"},
    {"material": 30299003, "descripcion": "GRASA EP2 MULTIPROPOSITO", "centro": 1008, "almacen": "0003", "stock": 80, "um": "KG", "precio_usd": 8.50, "grupo_articulos": 1310, "ubicacion": "B-01-03", "criticidad": "C", "sector": "LUBRICACION"},
    {"material": 30299004, "descripcion": "GRASA ALTA TEMPERATURA", "centro": 1008, "almacen": "0003", "stock": 25, "um": "KG", "precio_usd": 22.00, "grupo_articulos": 1310, "ubicacion": "B-01-04", "criticidad": "A", "sector": "LUBRICACION"},

    # Filtros (grupo 1415)
    {"material": 30300001, "descripcion": "FILTRO ACEITE HIDRAULICO 10 MICRAS", "centro": 1064, "almacen": "0001", "stock": 35, "um": "UNI", "precio_usd": 45.00, "grupo_articulos": 1415, "ubicacion": "C-01-01", "criticidad": "A", "sector": "MANTENIMIENTO"},
    {"material": 30300002, "descripcion": "FILTRO AIRE COMPRESOR ATLAS", "centro": 1064, "almacen": "0001", "stock": 18, "um": "UNI", "precio_usd": 85.00, "grupo_articulos": 1415, "ubicacion": "C-01-02", "criticidad": "A", "sector": "COMPRESORES"},
    {"material": 30300003, "descripcion": "ELEMENTO SEPARADOR AIRE/ACEITE", "centro": 1064, "almacen": "0001", "stock": 8, "um": "UNI", "precio_usd": 320.00, "grupo_articulos": 1415, "ubicacion": "C-01-03", "criticidad": "A", "sector": "COMPRESORES"},
    {"material": 30300004, "descripcion": "FILTRO COMBUSTIBLE DIESEL", "centro": 1064, "almacen": "0001", "stock": 40, "um": "UNI", "precio_usd": 28.00, "grupo_articulos": 1415, "ubicacion": "C-01-04", "criticidad": "C", "sector": "VEHICULOS"},

    # Ferretería (grupo 1520)
    {"material": 30301001, "descripcion": "TORNILLO HEX M10X40 GR8.8", "centro": 1008, "almacen": "0004", "stock": 500, "um": "UNI", "precio_usd": 0.45, "grupo_articulos": 1520, "ubicacion": "D-01-01", "criticidad": "C", "sector": "MANTENIMIENTO"},
    {"material": 30301002, "descripcion": "TORNILLO HEX M12X50 GR8.8", "centro": 1008, "almacen": "0004", "stock": 350, "um": "UNI", "precio_usd": 0.65, "grupo_articulos": 1520, "ubicacion": "D-01-02", "criticidad": "C", "sector": "MANTENIMIENTO"},
    {"material": 30301003, "descripcion": "TUERCA HEX M10 GR8", "centro": 1008, "almacen": "0004", "stock": 800, "um": "UNI", "precio_usd": 0.15, "grupo_articulos": 1520, "ubicacion": "D-01-03", "criticidad": "C", "sector": "MANTENIMIENTO"},
    {"material": 30301004, "descripcion": "ARANDELA PLANA M10 ZINCADA", "centro": 1008, "almacen": "0004", "stock": 1000, "um": "UNI", "precio_usd": 0.08, "grupo_articulos": 1520, "ubicacion": "D-01-04", "criticidad": "C", "sector": "MANTENIMIENTO"},
    {"material": 30301005, "descripcion": "TORNILLO ALLEN M8X30", "centro": 1008, "almacen": "0004", "stock": 400, "um": "UNI", "precio_usd": 0.35, "grupo_articulos": 1520, "ubicacion": "D-01-05", "criticidad": "C", "sector": "MANTENIMIENTO"},

    # Hidráulica (grupo 1625)
    {"material": 30302001, "descripcion": "MANGUERA HIDRAULICA 1/2 R2", "centro": 1064, "almacen": "0002", "stock": 50, "um": "M", "precio_usd": 18.00, "grupo_articulos": 1625, "ubicacion": "E-01-01", "criticidad": "A", "sector": "HIDRAULICA"},
    {"material": 30302002, "descripcion": "MANGUERA HIDRAULICA 3/4 R2", "centro": 1064, "almacen": "0002", "stock": 30, "um": "M", "precio_usd": 25.00, "grupo_articulos": 1625, "ubicacion": "E-01-02", "criticidad": "A", "sector": "HIDRAULICA"},
    {"material": 30302003, "descripcion": "VALVULA DIRECCIONAL 4/3 24V", "centro": 1064, "almacen": "0002", "stock": 4, "um": "UNI", "precio_usd": 450.00, "grupo_articulos": 1625, "ubicacion": "E-02-01", "criticidad": "A", "sector": "HIDRAULICA"},
    {"material": 30302004, "descripcion": "CILINDRO HIDRAULICO 50X300", "centro": 1064, "almacen": "0002", "stock": 2, "um": "UNI", "precio_usd": 680.00, "grupo_articulos": 1625, "ubicacion": "E-02-02", "criticidad": "A", "sector": "HIDRAULICA"},
    {"material": 30302005, "descripcion": "BOMBA HIDRAULICA 20 GPM", "centro": 1064, "almacen": "0002", "stock": 1, "um": "UNI", "precio_usd": 1250.00, "grupo_articulos": 1625, "ubicacion": "E-02-03", "criticidad": "A", "sector": "HIDRAULICA"},

    # Eléctrico (grupo 915)
    {"material": 30303001, "descripcion": "CONTACTOR 3P 40A 220V", "centro": 1500, "almacen": "0001", "stock": 15, "um": "UNI", "precio_usd": 85.00, "grupo_articulos": 915, "ubicacion": "F-01-01", "criticidad": "A", "sector": "ELECTRICO"},
    {"material": 30303002, "descripcion": "RELE TERMICO 25-40A", "centro": 1500, "almacen": "0001", "stock": 12, "um": "UNI", "precio_usd": 65.00, "grupo_articulos": 915, "ubicacion": "F-01-02", "criticidad": "A", "sector": "ELECTRICO"},
    {"material": 30303003, "descripcion": "VARIADOR FRECUENCIA 10HP", "centro": 1500, "almacen": "0001", "stock": 2, "um": "UNI", "precio_usd": 1850.00, "grupo_articulos": 915, "ubicacion": "F-02-01", "criticidad": "A", "sector": "ELECTRICO"},
    {"material": 30303004, "descripcion": "SENSOR PROXIMIDAD INDUCTIVO", "centro": 1500, "almacen": "0001", "stock": 20, "um": "UNI", "precio_usd": 45.00, "grupo_articulos": 915, "ubicacion": "F-01-03", "criticidad": "B", "sector": "INSTRUMENTACION"},
    {"material": 30303005, "descripcion": "CABLE CONTROL 4X16 AWG", "centro": 1500, "almacen": "0001", "stock": 200, "um": "M", "precio_usd": 3.50, "grupo_articulos": 915, "ubicacion": "F-03-01", "criticidad": "C", "sector": "ELECTRICO"},

    # Sellos (grupo 302/1130)
    {"material": 30304001, "descripcion": "SELLO MECANICO 35MM", "centro": 1008, "almacen": "0005", "stock": 8, "um": "UNI", "precio_usd": 185.00, "grupo_articulos": 1130, "ubicacion": "G-01-01", "criticidad": "A", "sector": "MANTENIMIENTO"},
    {"material": 30304002, "descripcion": "O-RING VITON 50X4", "centro": 1008, "almacen": "0005", "stock": 100, "um": "UNI", "precio_usd": 4.50, "grupo_articulos": 302, "ubicacion": "G-01-02", "criticidad": "B", "sector": "MANTENIMIENTO"},
    {"material": 30304003, "descripcion": "EMPAQUE GRAFITO DN80", "centro": 1008, "almacen": "0005", "stock": 25, "um": "UNI", "precio_usd": 28.00, "grupo_articulos": 302, "ubicacion": "G-01-03", "criticidad": "C", "sector": "MANTENIMIENTO"},
]

stock_df = pd.DataFrame(stock_data)

# ============================================================================
# HOJA 2: CONSUMO HISTORICO - 24 meses con patrones realísticos
# ============================================================================
consumo_records = []

end_date = datetime(2025, 12, 31)
start_date = end_date - timedelta(days=730)

# Patrones de consumo por material
consumo_patterns = {
    # Rodamientos
    30297157: {"base": 4, "var": 0.3, "seasonal": [0.8, 0.9, 1.5, 1.0, 1.0, 0.9, 0.8, 0.9, 1.5, 1.0, 1.0, 0.9]},
    30297158: {"base": 3, "var": 0.35, "seasonal": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    30297159: {"base": 1, "var": 0.4, "seasonal": [0.7, 0.8, 1.6, 1.0, 1.0, 0.8, 0.7, 0.8, 1.6, 1.0, 1.0, 0.8]},
    30297160: {"base": 2, "var": 0.35, "seasonal": [0.8, 0.9, 1.3, 1.0, 1.0, 0.9, 0.8, 0.9, 1.3, 1.0, 1.0, 0.9]},

    # Transmisión
    30298001: {"base": 1, "var": 0.3, "seasonal": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    30298002: {"base": 3, "var": 0.25, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.2, 1.0, 1.0, 1.0]},
    30298003: {"base": 0.5, "var": 0.5, "seasonal": [0.8, 0.9, 1.5, 1.0, 1.0, 0.9, 0.8, 0.9, 1.5, 1.0, 1.0, 0.9]},

    # Lubricantes
    30299001: {"base": 80, "var": 0.15, "seasonal": [1.1, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2]},
    30299002: {"base": 40, "var": 0.2, "seasonal": [1.1, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2]},
    30299003: {"base": 15, "var": 0.2, "seasonal": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},
    30299004: {"base": 5, "var": 0.3, "seasonal": [1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.2]},

    # Filtros
    30300001: {"base": 6, "var": 0.2, "seasonal": [1.0, 0.8, 1.3, 0.8, 1.0, 1.3, 1.0, 0.8, 1.3, 0.8, 1.0, 1.3]},
    30300002: {"base": 3, "var": 0.25, "seasonal": [1.0, 0.7, 1.4, 0.7, 1.0, 1.4, 1.0, 0.7, 1.4, 0.7, 1.0, 1.4]},
    30300003: {"base": 1, "var": 0.3, "seasonal": [0.8, 0.6, 1.5, 0.6, 0.8, 1.5, 0.8, 0.6, 1.5, 0.6, 0.8, 1.5]},
    30300004: {"base": 8, "var": 0.2, "seasonal": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},

    # Ferretería
    30301001: {"base": 60, "var": 0.25, "seasonal": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},
    30301002: {"base": 40, "var": 0.25, "seasonal": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},
    30301003: {"base": 80, "var": 0.2, "seasonal": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},
    30301004: {"base": 100, "var": 0.2, "seasonal": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},
    30301005: {"base": 50, "var": 0.25, "seasonal": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},

    # Hidráulica
    30302001: {"base": 8, "var": 0.3, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    30302002: {"base": 5, "var": 0.3, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    30302003: {"base": 0.3, "var": 0.5, "seasonal": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    30302004: {"base": 0.2, "var": 0.6, "seasonal": [0.7, 0.8, 1.5, 1.0, 1.0, 0.8, 0.7, 0.8, 1.5, 1.0, 1.0, 0.8]},
    30302005: {"base": 0.1, "var": 0.7, "seasonal": [0.5, 0.7, 1.8, 1.0, 1.0, 0.7, 0.5, 0.7, 1.8, 1.0, 1.0, 0.7]},

    # Eléctrico
    30303001: {"base": 2, "var": 0.35, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    30303002: {"base": 1.5, "var": 0.35, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    30303003: {"base": 0.15, "var": 0.6, "seasonal": [0.7, 0.8, 1.5, 1.0, 1.0, 0.8, 0.7, 0.8, 1.5, 1.0, 1.0, 0.8]},
    30303004: {"base": 3, "var": 0.3, "seasonal": [1.0, 1.0, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.0, 1.0, 1.0]},
    30303005: {"base": 25, "var": 0.25, "seasonal": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},

    # Sellos
    30304001: {"base": 0.8, "var": 0.4, "seasonal": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    30304002: {"base": 12, "var": 0.3, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    30304003: {"base": 3, "var": 0.3, "seasonal": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
}

# Mapeo material -> centro
material_centro = {row["material"]: row["centro"] for row in stock_data}

# Generar consumo para cada mes
current_date = start_date
while current_date <= end_date:
    month_idx = current_date.month - 1

    for mat, pattern in consumo_patterns.items():
        base = pattern["base"]
        var = pattern["var"]
        seasonal = pattern["seasonal"][month_idx]

        qty = base * seasonal * (1 + np.random.uniform(-var, var))
        qty = max(0, round(qty))

        if qty > 0:
            num_records = np.random.randint(1, 4) if qty > 3 else 1
            for _ in range(num_records):
                day_offset = np.random.randint(0, 28)
                fecha = current_date + timedelta(days=day_offset)
                qty_partial = max(1, round(qty / num_records))

                # Obtener almacen del material
                mat_info = next((s for s in stock_data if s["material"] == mat), None)
                almacen = mat_info["almacen"] if mat_info else "0001"

                consumo_records.append({
                    "material": mat,
                    "fecha": fecha.strftime("%d.%m.%Y"),  # Formato SAP
                    "cantidad": qty_partial,
                    "centro": material_centro.get(mat, 1008),
                    "almacen": almacen
                })

    if current_date.month == 12:
        current_date = datetime(current_date.year + 1, 1, 1)
    else:
        current_date = datetime(current_date.year, current_date.month + 1, 1)

consumo_df = pd.DataFrame(consumo_records)

# ============================================================================
# HOJA 3: SOLPEDS EN CURSO (Formato SAP completo - 35+ columnas)
# ============================================================================
# Proveedores de referencia
PROVEEDORES = {
    100123: "SKF CHILE S.A.",
    100456: "SHELL LUBRICANTES",
    100789: "ATLAS COPCO CHILE",
    100321: "REXROTH CHILE",
    100654: "SCHNEIDER ELECTRIC",
    100987: "FERRETERIA INDUSTRIAL",
    100111: "JOHN CRANE LATAM",
    100222: "HIDRAULICA CHILE",
}

# Contratos marco activos
CONTRATOS_MARCO = {
    30297157: {"contrato": 4600001001, "posicion": 10},  # Rodamientos SKF
    30297158: {"contrato": 4600001001, "posicion": 20},
    30299001: {"contrato": 4600001002, "posicion": 10},  # Lubricantes Shell
    30299002: {"contrato": 4600001002, "posicion": 20},
    30300002: {"contrato": 4600001003, "posicion": 10},  # Atlas Copco
    30303001: {"contrato": 4600001004, "posicion": 10},  # Schneider
}

solpeds_data = [
    # Solped 1: Sin liberar, sin pedido
    {
        # Identificación
        "centro": 1008, "grupo_compras": 144, "clase_documento": "NB",
        "solped": 1000045678, "posicion_solped": 10,
        # Material
        "material": 30297159, "descripcion_material": "RODAMIENTO FAG 22212E", "grupo_articulos": 1124,
        # Timeline Solped
        "fecha_creacion_solped": "20.12.2025", "fecha_entrega_solped": "15.02.2026",
        "liberacion_solped": "S/ EST.LIB", "fecha_liberacion_solped": None,
        # Financiero Solped
        "cantidad_solped": 6, "um": "UNI",
        "precio_unitario_solped": 185.00, "importe_total_solped": 1110.00, "moneda_solped": "USD",
        "centro_costos": "CC-MANT-001", "imputacion": "K",
        # Datos Pedido (no hay)
        "pedido": None, "posicion_pedido": None, "clase_pedido": None,
        "fecha_pedido": None, "fecha_liberacion_pedido": None,
        "estrategia_liberacion_pedido": None, "fecha_entrega_pedido": None,
        # Cantidades y Recepción
        "cantidad_pedida": None, "cantidad_recepcionada": None, "fecha_recepcion": None,
        # Valores Pedido
        "valor_pedido": None, "valor_recibido": None, "moneda_pedido": None,
        "valor_facturado": None, "moneda_facturada": None,
        # Proveedor y Contrato
        "proveedor": None, "nombre_proveedor": None,
        "contrato_marco": None, "posicion_contrato_marco": None,
        # Usuarios
        "creado_por": "JPEREZ", "solicitante": "JPEREZ", "num_necesidad": "NEC-2025-001", "concluida": "N"
    },
    # Solped 2: Liberada, con pedido parcialmente recepcionado, con contrato marco
    {
        "centro": 1008, "grupo_compras": 144, "clase_documento": "NB",
        "solped": 1000045679, "posicion_solped": 10,
        "material": 30297157, "descripcion_material": "RODAMIENTO SKF 6205-2RS", "grupo_articulos": 1124,
        "fecha_creacion_solped": "01.11.2025", "fecha_entrega_solped": "15.12.2025",
        "liberacion_solped": "LIBERADA", "fecha_liberacion_solped": "03.11.2025",
        "cantidad_solped": 20, "um": "UNI",
        "precio_unitario_solped": 28.50, "importe_total_solped": 570.00, "moneda_solped": "USD",
        "centro_costos": "CC-MANT-001", "imputacion": "K",
        "pedido": 4500001234, "posicion_pedido": 10, "clase_pedido": "NB",
        "fecha_pedido": "05.11.2025", "fecha_liberacion_pedido": "06.11.2025",
        "estrategia_liberacion_pedido": "Z1", "fecha_entrega_pedido": "20.12.2025",
        "cantidad_pedida": 20, "cantidad_recepcionada": 10, "fecha_recepcion": "15.12.2025",
        "valor_pedido": 570.00, "valor_recibido": 285.00, "moneda_pedido": "USD",
        "valor_facturado": 285.00, "moneda_facturada": "USD",
        "proveedor": 100123, "nombre_proveedor": "SKF CHILE S.A.",
        "contrato_marco": 4600001001, "posicion_contrato_marco": 10,
        "creado_por": "MRODRIGUEZ", "solicitante": "MRODRIGUEZ", "num_necesidad": "NEC-2025-002", "concluida": "N"
    },
    # Solped 3: Liberada, con pedido completamente recepcionado
    {
        "centro": 1008, "grupo_compras": 145, "clase_documento": "NB",
        "solped": 1000045680, "posicion_solped": 10,
        "material": 30299001, "descripcion_material": "ACEITE HIDRAULICO ISO 68", "grupo_articulos": 1310,
        "fecha_creacion_solped": "15.10.2025", "fecha_entrega_solped": "15.11.2025",
        "liberacion_solped": "LIBERADA", "fecha_liberacion_solped": "16.10.2025",
        "cantidad_solped": 200, "um": "L",
        "precio_unitario_solped": 4.50, "importe_total_solped": 900.00, "moneda_solped": "USD",
        "centro_costos": "CC-LUBR-001", "imputacion": "K",
        "pedido": 4500001240, "posicion_pedido": 10, "clase_pedido": "NB",
        "fecha_pedido": "18.10.2025", "fecha_liberacion_pedido": "19.10.2025",
        "estrategia_liberacion_pedido": "Z1", "fecha_entrega_pedido": "20.11.2025",
        "cantidad_pedida": 200, "cantidad_recepcionada": 200, "fecha_recepcion": "18.11.2025",
        "valor_pedido": 900.00, "valor_recibido": 900.00, "moneda_pedido": "USD",
        "valor_facturado": 900.00, "moneda_facturada": "USD",
        "proveedor": 100456, "nombre_proveedor": "SHELL LUBRICANTES",
        "contrato_marco": 4600001002, "posicion_contrato_marco": 10,
        "creado_por": "LGOMEZ", "solicitante": "LGOMEZ", "num_necesidad": "NEC-2025-003", "concluida": "S"
    },
    # Solped 4: Sin liberar, urgente
    {
        "centro": 1064, "grupo_compras": 146, "clase_documento": "NB",
        "solped": 1000045682, "posicion_solped": 10,
        "material": 30300003, "descripcion_material": "ELEMENTO SEPARADOR AIRE/ACEITE", "grupo_articulos": 1415,
        "fecha_creacion_solped": "22.12.2025", "fecha_entrega_solped": "05.01.2026",
        "liberacion_solped": "S/ EST.LIB", "fecha_liberacion_solped": None,
        "cantidad_solped": 4, "um": "UNI",
        "precio_unitario_solped": 320.00, "importe_total_solped": 1280.00, "moneda_solped": "USD",
        "centro_costos": "CC-COMP-001", "imputacion": "K",
        "pedido": None, "posicion_pedido": None, "clase_pedido": None,
        "fecha_pedido": None, "fecha_liberacion_pedido": None,
        "estrategia_liberacion_pedido": None, "fecha_entrega_pedido": None,
        "cantidad_pedida": None, "cantidad_recepcionada": None, "fecha_recepcion": None,
        "valor_pedido": None, "valor_recibido": None, "moneda_pedido": None,
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": None, "nombre_proveedor": None,
        "contrato_marco": None, "posicion_contrato_marco": None,
        "creado_por": "ALOPEZ", "solicitante": "ALOPEZ", "num_necesidad": "NEC-2025-004", "concluida": "N"
    },
    # Solped 5: Liberada, con pedido pendiente de recepción, con contrato marco
    {
        "centro": 1064, "grupo_compras": 147, "clase_documento": "NB",
        "solped": 1000045685, "posicion_solped": 10,
        "material": 30300002, "descripcion_material": "FILTRO AIRE COMPRESOR ATLAS", "grupo_articulos": 1415,
        "fecha_creacion_solped": "10.11.2025", "fecha_entrega_solped": "10.12.2025",
        "liberacion_solped": "LIBERADA", "fecha_liberacion_solped": "12.11.2025",
        "cantidad_solped": 10, "um": "UNI",
        "precio_unitario_solped": 85.00, "importe_total_solped": 850.00, "moneda_solped": "USD",
        "centro_costos": "CC-COMP-001", "imputacion": "K",
        "pedido": 4500001242, "posicion_pedido": 10, "clase_pedido": "NB",
        "fecha_pedido": "15.11.2025", "fecha_liberacion_pedido": "16.11.2025",
        "estrategia_liberacion_pedido": "Z1", "fecha_entrega_pedido": "15.12.2025",
        "cantidad_pedida": 10, "cantidad_recepcionada": 5, "fecha_recepcion": "10.12.2025",
        "valor_pedido": 850.00, "valor_recibido": 425.00, "moneda_pedido": "USD",
        "valor_facturado": 425.00, "moneda_facturada": "USD",
        "proveedor": 100789, "nombre_proveedor": "ATLAS COPCO CHILE",
        "contrato_marco": 4600001003, "posicion_contrato_marco": 10,
        "creado_por": "CDIAZ", "solicitante": "CDIAZ", "num_necesidad": "NEC-2025-005", "concluida": "N"
    },
    # Solped 6: Sin liberar, alto valor
    {
        "centro": 1500, "grupo_compras": 148, "clase_documento": "NB",
        "solped": 1000045687, "posicion_solped": 10,
        "material": 30303003, "descripcion_material": "VARIADOR FRECUENCIA 10HP", "grupo_articulos": 915,
        "fecha_creacion_solped": "15.12.2025", "fecha_entrega_solped": "01.02.2026",
        "liberacion_solped": "S/ EST.LIB", "fecha_liberacion_solped": None,
        "cantidad_solped": 1, "um": "UNI",
        "precio_unitario_solped": 1850.00, "importe_total_solped": 1850.00, "moneda_solped": "USD",
        "centro_costos": "CC-ELEC-001", "imputacion": "A",
        "pedido": None, "posicion_pedido": None, "clase_pedido": None,
        "fecha_pedido": None, "fecha_liberacion_pedido": None,
        "estrategia_liberacion_pedido": None, "fecha_entrega_pedido": None,
        "cantidad_pedida": None, "cantidad_recepcionada": None, "fecha_recepcion": None,
        "valor_pedido": None, "valor_recibido": None, "moneda_pedido": None,
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": None, "nombre_proveedor": None,
        "contrato_marco": None, "posicion_contrato_marco": None,
        "creado_por": "FMARTINEZ", "solicitante": "FMARTINEZ", "num_necesidad": "NEC-2025-006", "concluida": "N"
    },
    # Solped 7: Liberada, pedido retrasado
    {
        "centro": 1064, "grupo_compras": 147, "clase_documento": "NB",
        "solped": 1000045690, "posicion_solped": 10,
        "material": 30302003, "descripcion_material": "VALVULA DIRECCIONAL 4/3 24V", "grupo_articulos": 1625,
        "fecha_creacion_solped": "01.10.2025", "fecha_entrega_solped": "01.11.2025",
        "liberacion_solped": "LIBERADA", "fecha_liberacion_solped": "03.10.2025",
        "cantidad_solped": 2, "um": "UNI",
        "precio_unitario_solped": 450.00, "importe_total_solped": 900.00, "moneda_solped": "USD",
        "centro_costos": "CC-HIDR-001", "imputacion": "K",
        "pedido": 4500001245, "posicion_pedido": 10, "clase_pedido": "NB",
        "fecha_pedido": "05.10.2025", "fecha_liberacion_pedido": "06.10.2025",
        "estrategia_liberacion_pedido": "Z2", "fecha_entrega_pedido": "05.11.2025",
        "cantidad_pedida": 2, "cantidad_recepcionada": 2, "fecha_recepcion": "20.11.2025",  # Retrasado 15 días
        "valor_pedido": 900.00, "valor_recibido": 900.00, "moneda_pedido": "USD",
        "valor_facturado": 900.00, "moneda_facturada": "USD",
        "proveedor": 100321, "nombre_proveedor": "REXROTH CHILE",
        "contrato_marco": None, "posicion_contrato_marco": None,
        "creado_por": "RGARCIA", "solicitante": "RGARCIA", "num_necesidad": "NEC-2025-007", "concluida": "S"
    },
    # Solped 8: Liberada, pedido por vencer próximamente
    {
        "centro": 1008, "grupo_compras": 144, "clase_documento": "NB",
        "solped": 1000045691, "posicion_solped": 10,
        "material": 30304001, "descripcion_material": "SELLO MECANICO 35MM", "grupo_articulos": 1130,
        "fecha_creacion_solped": "20.11.2025", "fecha_entrega_solped": "20.12.2025",
        "liberacion_solped": "LIBERADA", "fecha_liberacion_solped": "22.11.2025",
        "cantidad_solped": 4, "um": "UNI",
        "precio_unitario_solped": 185.00, "importe_total_solped": 740.00, "moneda_solped": "USD",
        "centro_costos": "CC-MANT-001", "imputacion": "K",
        "pedido": 4500001252, "posicion_pedido": 10, "clase_pedido": "NB",
        "fecha_pedido": "25.11.2025", "fecha_liberacion_pedido": "26.11.2025",
        "estrategia_liberacion_pedido": "Z1", "fecha_entrega_pedido": "15.01.2026",  # Próximo a vencer
        "cantidad_pedida": 4, "cantidad_recepcionada": 0, "fecha_recepcion": None,
        "valor_pedido": 740.00, "valor_recibido": 0.00, "moneda_pedido": "USD",
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": 100111, "nombre_proveedor": "JOHN CRANE LATAM",
        "contrato_marco": None, "posicion_contrato_marco": None,
        "creado_por": "JPEREZ", "solicitante": "JPEREZ", "num_necesidad": "NEC-2025-008", "concluida": "N"
    },
    # Solped 9: Sin liberar, moneda ARP
    {
        "centro": 1064, "grupo_compras": 146, "clase_documento": "NB",
        "solped": 1000045692, "posicion_solped": 10,
        "material": 30297160, "descripcion_material": "RODAMIENTO NTN 6310-2RS", "grupo_articulos": 1124,
        "fecha_creacion_solped": "26.12.2025", "fecha_entrega_solped": "28.01.2026",
        "liberacion_solped": "S/ EST.LIB", "fecha_liberacion_solped": None,
        "cantidad_solped": 10, "um": "UNI",
        "precio_unitario_solped": 68000.00, "importe_total_solped": 680000.00, "moneda_solped": "ARP",
        "centro_costos": "CC-MANT-002", "imputacion": "K",
        "pedido": None, "posicion_pedido": None, "clase_pedido": None,
        "fecha_pedido": None, "fecha_liberacion_pedido": None,
        "estrategia_liberacion_pedido": None, "fecha_entrega_pedido": None,
        "cantidad_pedida": None, "cantidad_recepcionada": None, "fecha_recepcion": None,
        "valor_pedido": None, "valor_recibido": None, "moneda_pedido": None,
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": None, "nombre_proveedor": None,
        "contrato_marco": None, "posicion_contrato_marco": None,
        "creado_por": "MRODRIGUEZ", "solicitante": "MRODRIGUEZ", "num_necesidad": "NEC-2025-009", "concluida": "N"
    },
    # Solped 10: Liberada con contrato, pedido completo
    {
        "centro": 1500, "grupo_compras": 148, "clase_documento": "NB",
        "solped": 1000045693, "posicion_solped": 10,
        "material": 30303001, "descripcion_material": "CONTACTOR 3P 40A 220V", "grupo_articulos": 915,
        "fecha_creacion_solped": "01.11.2025", "fecha_entrega_solped": "01.12.2025",
        "liberacion_solped": "LIBERADA", "fecha_liberacion_solped": "02.11.2025",
        "cantidad_solped": 8, "um": "UNI",
        "precio_unitario_solped": 85.00, "importe_total_solped": 680.00, "moneda_solped": "USD",
        "centro_costos": "CC-ELEC-001", "imputacion": "K",
        "pedido": 4500001248, "posicion_pedido": 10, "clase_pedido": "NB",
        "fecha_pedido": "05.11.2025", "fecha_liberacion_pedido": "06.11.2025",
        "estrategia_liberacion_pedido": "Z1", "fecha_entrega_pedido": "05.12.2025",
        "cantidad_pedida": 8, "cantidad_recepcionada": 8, "fecha_recepcion": "03.12.2025",
        "valor_pedido": 680.00, "valor_recibido": 680.00, "moneda_pedido": "USD",
        "valor_facturado": 680.00, "moneda_facturada": "USD",
        "proveedor": 100654, "nombre_proveedor": "SCHNEIDER ELECTRIC",
        "contrato_marco": 4600001004, "posicion_contrato_marco": 10,
        "creado_por": "ALOPEZ", "solicitante": "ALOPEZ", "num_necesidad": "NEC-2025-010", "concluida": "S"
    },
]

solpeds_df = pd.DataFrame(solpeds_data)

# ============================================================================
# HOJA 4: PEDIDOS EN CURSO (Formato SAP completo)
# ============================================================================
pedidos_data = [
    # Pedido 1: Parcialmente recepcionado, con contrato marco
    {
        # Identificación
        "centro": 1008, "grupo_compras": 144, "pedido": 4500001234, "posicion_pedido": 10, "clase_pedido": "NB",
        # Material
        "material": 30297157, "descripcion_material": "RODAMIENTO SKF 6205-2RS", "grupo_articulos": 1124, "um": "UNI",
        # Timeline
        "fecha_pedido": "05.11.2025", "fecha_liberacion_pedido": "06.11.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "20.12.2025", "fecha_recepcion": "15.12.2025",
        # Cantidades
        "cantidad_pedida": 20, "cantidad_recepcionada": 10,
        # Valores
        "valor_pedido": 570.00, "valor_recibido": 285.00, "moneda_pedido": "USD",
        "valor_facturado": 285.00, "moneda_facturada": "USD",
        # Proveedor y Contrato
        "proveedor": 100123, "nombre_proveedor": "SKF CHILE S.A.",
        "contrato_marco": 4600001001, "posicion_contrato_marco": 10,
        # Solped origen
        "solped_origen": 1000045679, "posicion_solped": 10
    },
    # Pedido 2: Sin recepción, con contrato marco
    {
        "centro": 1008, "grupo_compras": 144, "pedido": 4500001235, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30297158, "descripcion_material": "RODAMIENTO SKF 6308-2RS", "grupo_articulos": 1124, "um": "UNI",
        "fecha_pedido": "20.11.2025", "fecha_liberacion_pedido": "21.11.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "25.01.2026", "fecha_recepcion": None,
        "cantidad_pedida": 15, "cantidad_recepcionada": 0,
        "valor_pedido": 780.00, "valor_recibido": 0.00, "moneda_pedido": "USD",
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": 100123, "nombre_proveedor": "SKF CHILE S.A.",
        "contrato_marco": 4600001001, "posicion_contrato_marco": 20,
        "solped_origen": None, "posicion_solped": None
    },
    # Pedido 3: Completamente recepcionado, con contrato marco
    {
        "centro": 1008, "grupo_compras": 145, "pedido": 4500001240, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30299001, "descripcion_material": "ACEITE HIDRAULICO ISO 68", "grupo_articulos": 1310, "um": "L",
        "fecha_pedido": "18.10.2025", "fecha_liberacion_pedido": "19.10.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "20.11.2025", "fecha_recepcion": "18.11.2025",
        "cantidad_pedida": 200, "cantidad_recepcionada": 200,
        "valor_pedido": 900.00, "valor_recibido": 900.00, "moneda_pedido": "USD",
        "valor_facturado": 900.00, "moneda_facturada": "USD",
        "proveedor": 100456, "nombre_proveedor": "SHELL LUBRICANTES",
        "contrato_marco": 4600001002, "posicion_contrato_marco": 10,
        "solped_origen": 1000045680, "posicion_solped": 10
    },
    # Pedido 4: Parcialmente recepcionado, con contrato marco
    {
        "centro": 1064, "grupo_compras": 147, "pedido": 4500001242, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30300002, "descripcion_material": "FILTRO AIRE COMPRESOR ATLAS", "grupo_articulos": 1415, "um": "UNI",
        "fecha_pedido": "15.11.2025", "fecha_liberacion_pedido": "16.11.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "15.12.2025", "fecha_recepcion": "10.12.2025",
        "cantidad_pedida": 10, "cantidad_recepcionada": 5,
        "valor_pedido": 850.00, "valor_recibido": 425.00, "moneda_pedido": "USD",
        "valor_facturado": 425.00, "moneda_facturada": "USD",
        "proveedor": 100789, "nombre_proveedor": "ATLAS COPCO CHILE",
        "contrato_marco": 4600001003, "posicion_contrato_marco": 10,
        "solped_origen": 1000045685, "posicion_solped": 10
    },
    # Pedido 5: Recepcionado con retraso, sin contrato
    {
        "centro": 1064, "grupo_compras": 147, "pedido": 4500001245, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30302003, "descripcion_material": "VALVULA DIRECCIONAL 4/3 24V", "grupo_articulos": 1625, "um": "UNI",
        "fecha_pedido": "05.10.2025", "fecha_liberacion_pedido": "06.10.2025",
        "estrategia_liberacion": "Z2", "fecha_entrega_pedido": "05.11.2025", "fecha_recepcion": "20.11.2025",  # 15 días tarde
        "cantidad_pedida": 2, "cantidad_recepcionada": 2,
        "valor_pedido": 900.00, "valor_recibido": 900.00, "moneda_pedido": "USD",
        "valor_facturado": 900.00, "moneda_facturada": "USD",
        "proveedor": 100321, "nombre_proveedor": "REXROTH CHILE",
        "contrato_marco": None, "posicion_contrato_marco": None,
        "solped_origen": 1000045690, "posicion_solped": 10
    },
    # Pedido 6: Completamente recepcionado, con contrato marco
    {
        "centro": 1500, "grupo_compras": 148, "pedido": 4500001248, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30303001, "descripcion_material": "CONTACTOR 3P 40A 220V", "grupo_articulos": 915, "um": "UNI",
        "fecha_pedido": "05.11.2025", "fecha_liberacion_pedido": "06.11.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "05.12.2025", "fecha_recepcion": "03.12.2025",  # 2 días antes
        "cantidad_pedida": 8, "cantidad_recepcionada": 8,
        "valor_pedido": 680.00, "valor_recibido": 680.00, "moneda_pedido": "USD",
        "valor_facturado": 680.00, "moneda_facturada": "USD",
        "proveedor": 100654, "nombre_proveedor": "SCHNEIDER ELECTRIC",
        "contrato_marco": 4600001004, "posicion_contrato_marco": 10,
        "solped_origen": 1000045693, "posicion_solped": 10
    },
    # Pedido 7: Completamente recepcionado, sin contrato
    {
        "centro": 1008, "grupo_compras": 149, "pedido": 4500001250, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30301001, "descripcion_material": "TORNILLO HEX M10X40 GR8.8", "grupo_articulos": 1520, "um": "UNI",
        "fecha_pedido": "15.12.2025", "fecha_liberacion_pedido": "15.12.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "05.01.2026", "fecha_recepcion": "03.01.2026",
        "cantidad_pedida": 500, "cantidad_recepcionada": 500,
        "valor_pedido": 225.00, "valor_recibido": 225.00, "moneda_pedido": "USD",
        "valor_facturado": 225.00, "moneda_facturada": "USD",
        "proveedor": 100987, "nombre_proveedor": "FERRETERIA INDUSTRIAL",
        "contrato_marco": None, "posicion_contrato_marco": None,
        "solped_origen": None, "posicion_solped": None
    },
    # Pedido 8: Pendiente de recepción, por vencer
    {
        "centro": 1008, "grupo_compras": 144, "pedido": 4500001252, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30304001, "descripcion_material": "SELLO MECANICO 35MM", "grupo_articulos": 1130, "um": "UNI",
        "fecha_pedido": "25.11.2025", "fecha_liberacion_pedido": "26.11.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "15.01.2026", "fecha_recepcion": None,  # Por vencer
        "cantidad_pedida": 4, "cantidad_recepcionada": 0,
        "valor_pedido": 740.00, "valor_recibido": 0.00, "moneda_pedido": "USD",
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": 100111, "nombre_proveedor": "JOHN CRANE LATAM",
        "contrato_marco": None, "posicion_contrato_marco": None,
        "solped_origen": 1000045691, "posicion_solped": 10
    },
    # Pedido 9: Parcialmente recepcionado, sin contrato
    {
        "centro": 1064, "grupo_compras": 147, "pedido": 4500001255, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30302001, "descripcion_material": "MANGUERA HIDRAULICA 1/2 R2", "grupo_articulos": 1625, "um": "M",
        "fecha_pedido": "20.12.2025", "fecha_liberacion_pedido": "21.12.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "15.01.2026", "fecha_recepcion": "10.01.2026",
        "cantidad_pedida": 30, "cantidad_recepcionada": 15,
        "valor_pedido": 540.00, "valor_recibido": 270.00, "moneda_pedido": "USD",
        "valor_facturado": 270.00, "moneda_facturada": "USD",
        "proveedor": 100222, "nombre_proveedor": "HIDRAULICA CHILE",
        "contrato_marco": None, "posicion_contrato_marco": None,
        "solped_origen": None, "posicion_solped": None
    },
    # Pedido 10: Sin recepción, con contrato marco
    {
        "centro": 1008, "grupo_compras": 145, "pedido": 4500001258, "posicion_pedido": 10, "clase_pedido": "NB",
        "material": 30299002, "descripcion_material": "ACEITE ENGRANAJES ISO 220", "grupo_articulos": 1310, "um": "L",
        "fecha_pedido": "28.12.2025", "fecha_liberacion_pedido": "29.12.2025",
        "estrategia_liberacion": "Z1", "fecha_entrega_pedido": "25.01.2026", "fecha_recepcion": None,
        "cantidad_pedida": 100, "cantidad_recepcionada": 0,
        "valor_pedido": 620.00, "valor_recibido": 0.00, "moneda_pedido": "USD",
        "valor_facturado": None, "moneda_facturada": None,
        "proveedor": 100456, "nombre_proveedor": "SHELL LUBRICANTES",
        "contrato_marco": 4600001002, "posicion_contrato_marco": 20,
        "solped_origen": None, "posicion_solped": None
    },
]

pedidos_df = pd.DataFrame(pedidos_data)

# ============================================================================
# HOJA 5: PARAMETROS MRP (incluye demanda_estimada_anual)
# ============================================================================
parametros_data = []

# Consumo anual estimado
consumo_anual = {
    30297157: 48, 30297158: 36, 30297159: 12, 30297160: 24,
    30298001: 12, 30298002: 36, 30298003: 6,
    30299001: 960, 30299002: 480, 30299003: 180, 30299004: 60,
    30300001: 72, 30300002: 36, 30300003: 12, 30300004: 96,
    30301001: 720, 30301002: 480, 30301003: 960, 30301004: 1200, 30301005: 600,
    30302001: 96, 30302002: 60, 30302003: 4, 30302004: 2, 30302005: 1,
    30303001: 24, 30303002: 18, 30303003: 2, 30303004: 36, 30303005: 300,
    30304001: 10, 30304002: 144, 30304003: 36,
}

for row in stock_data:
    mat = row["material"]
    if row["criticidad"] in ["A", "B"]:  # Solo materiales críticos
        pattern = consumo_patterns.get(mat, {"base": 1})
        consumo_mensual = pattern["base"]

        # Lead time según tipo de material
        lead_time = 15
        if mat in [30303003, 30302005]:  # Equipos especiales
            lead_time = 30
        elif row["grupo_articulos"] in [1124, 1625, 915]:  # Rodamientos, hidráulica, eléctrico
            lead_time = 21

        parametros_data.append({
            "material": mat,
            "demanda_estimada_anual": consumo_anual.get(mat, consumo_mensual * 12),
            "stock_seguridad": round(consumo_mensual * 1.5),
            "punto_pedido": round(consumo_mensual * 2.5),
            "stock_maximo": round(consumo_mensual * 6),
            "lead_time_dias": lead_time
        })

parametros_df = pd.DataFrame(parametros_data)

# ============================================================================
# GUARDAR EXCEL
# ============================================================================
os.makedirs("frontend/public/templates", exist_ok=True)
filepath = "frontend/public/templates/plantilla_mrp_forecast_v2.xlsx"

with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
    stock_df.to_excel(writer, sheet_name="stock", index=False)
    consumo_df.to_excel(writer, sheet_name="consumo_historico", index=False)
    solpeds_df.to_excel(writer, sheet_name="solpeds_en_curso", index=False)
    pedidos_df.to_excel(writer, sheet_name="pedidos_en_curso", index=False)
    parametros_df.to_excel(writer, sheet_name="parametros_mrp", index=False)

print(f"Excel creado: {filepath}")
print(f"\n{'='*70}")
print(f"RESUMEN DE PLANTILLA MRP/FORECAST (Modelo SAP Completo)")
print(f"{'='*70}")

print(f"\n1. STOCK: {len(stock_df)} materiales")
print(f"   - Centros: {stock_df['centro'].nunique()} ({', '.join(map(str, stock_df['centro'].unique()))})")
print(f"   - Almacenes: {stock_df['almacen'].nunique()}")
print(f"   - Grupos artículos: {stock_df['grupo_articulos'].nunique()}")
print(f"   - Criticidad A: {(stock_df['criticidad'] == 'A').sum()}")
print(f"   - Criticidad B: {(stock_df['criticidad'] == 'B').sum()}")
print(f"   - Criticidad C: {(stock_df['criticidad'] == 'C').sum()}")
print(f"   - Valor total stock: ${(stock_df['stock'] * stock_df['precio_usd']).sum():,.2f} USD")

print(f"\n2. CONSUMO HISTORICO: {len(consumo_df)} registros")
print(f"   - Rango: {consumo_df['fecha'].min()} a {consumo_df['fecha'].max()}")
print(f"   - Formato fecha: DD.MM.YYYY (SAP)")
print(f"   - Columnas: material, fecha, cantidad, centro, almacen")

print(f"\n3. SOLPEDS EN CURSO: {len(solpeds_df)} requisiciones ({len(solpeds_df.columns)} columnas)")
print(f"   - S/ EST.LIB: {(solpeds_df['liberacion_solped'] == 'S/ EST.LIB').sum()}")
print(f"   - LIBERADA: {(solpeds_df['liberacion_solped'] == 'LIBERADA').sum()}")
print(f"   - Con pedido: {solpeds_df['pedido'].notna().sum()}")
print(f"   - Con contrato marco: {solpeds_df['contrato_marco'].notna().sum()}")
print(f"   - Concluidas: {(solpeds_df['concluida'] == 'S').sum()}")
print(f"   - Valor total solpeds: ${solpeds_df['importe_total_solped'].sum():,.2f}")

print(f"\n4. PEDIDOS EN CURSO: {len(pedidos_df)} órdenes ({len(pedidos_df.columns)} columnas)")
print(f"   - Pendientes recepción: {(pedidos_df['cantidad_pedida'] > pedidos_df['cantidad_recepcionada']).sum()}")
print(f"   - Completos: {(pedidos_df['cantidad_pedida'] == pedidos_df['cantidad_recepcionada']).sum()}")
print(f"   - Con contrato marco: {pedidos_df['contrato_marco'].notna().sum()}")
print(f"   - Con solped origen: {pedidos_df['solped_origen'].notna().sum()}")
print(f"   - Valor total pedidos: ${pedidos_df['valor_pedido'].sum():,.2f} USD")

print(f"\n5. PARAMETROS MRP: {len(parametros_df)} materiales críticos")
print(f"   - Con demanda estimada anual, stock seguridad, punto pedido, stock máximo")

print(f"\n{'='*70}")
print(f"DATOS PARA KPIs:")
print(f"{'='*70}")
print(f"- Tiempos de ciclo: fecha_creacion_solped -> fecha_liberacion_solped -> fecha_pedido -> fecha_recepcion")
print(f"- Cumplimiento entregas: fecha_recepcion vs fecha_entrega_pedido")
print(f"- Uso contratos marco: {pedidos_df['contrato_marco'].notna().sum()}/{len(pedidos_df)} pedidos ({100*pedidos_df['contrato_marco'].notna().sum()/len(pedidos_df):.0f}%)")
print(f"- Tasa conversión solped->pedido: {solpeds_df['pedido'].notna().sum()}/{len(solpeds_df)} ({100*solpeds_df['pedido'].notna().sum()/len(solpeds_df):.0f}%)")
print(f"\n{'='*70}")
