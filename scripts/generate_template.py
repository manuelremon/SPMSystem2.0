"""
Genera plantilla Excel completa para modo temporal MRP/Forecast.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

np.random.seed(42)

# ============================================================================
# HOJA 1: STOCK - 32 materiales en diferentes categorias
# ============================================================================
stock_data = [
    # Repuestos Mecanicos
    {"material": "RM-001", "descripcion": "Rodamiento SKF 6205-2RS", "centro": "1008", "almacen": "0001", "stock": 45, "um": "UNI", "precio_usd": 28.50, "grupo_articulos": "RODAMIENTOS", "ubicacion": "A-01-01", "critico": "SI"},
    {"material": "RM-002", "descripcion": "Rodamiento SKF 6308-2RS", "centro": "1008", "almacen": "0001", "stock": 30, "um": "UNI", "precio_usd": 52.00, "grupo_articulos": "RODAMIENTOS", "ubicacion": "A-01-02", "critico": "SI"},
    {"material": "RM-003", "descripcion": "Rodamiento FAG 22212E", "centro": "1008", "almacen": "0001", "stock": 12, "um": "UNI", "precio_usd": 185.00, "grupo_articulos": "RODAMIENTOS", "ubicacion": "A-01-03", "critico": "SI"},
    {"material": "RM-004", "descripcion": "Correa Dentada HTD 8M-720", "centro": "1008", "almacen": "0002", "stock": 8, "um": "UNI", "precio_usd": 95.00, "grupo_articulos": "TRANSMISION", "ubicacion": "A-02-01", "critico": "SI"},
    {"material": "RM-005", "descripcion": "Correa Trapecial A-68", "centro": "1008", "almacen": "0002", "stock": 25, "um": "UNI", "precio_usd": 18.50, "grupo_articulos": "TRANSMISION", "ubicacion": "A-02-02", "critico": "NO"},
    {"material": "RM-006", "descripcion": "Acoplamiento Flexible L-100", "centro": "1008", "almacen": "0002", "stock": 6, "um": "UNI", "precio_usd": 145.00, "grupo_articulos": "TRANSMISION", "ubicacion": "A-02-03", "critico": "SI"},

    # Lubricantes
    {"material": "LB-001", "descripcion": "Aceite Hidraulico ISO 68", "centro": "1008", "almacen": "0003", "stock": 400, "um": "LT", "precio_usd": 4.50, "grupo_articulos": "LUBRICANTES", "ubicacion": "B-01-01", "critico": "SI"},
    {"material": "LB-002", "descripcion": "Aceite Engranajes ISO 220", "centro": "1008", "almacen": "0003", "stock": 200, "um": "LT", "precio_usd": 6.20, "grupo_articulos": "LUBRICANTES", "ubicacion": "B-01-02", "critico": "NO"},
    {"material": "LB-003", "descripcion": "Grasa EP2 Multiproposito", "centro": "1008", "almacen": "0003", "stock": 80, "um": "KG", "precio_usd": 8.50, "grupo_articulos": "LUBRICANTES", "ubicacion": "B-01-03", "critico": "NO"},
    {"material": "LB-004", "descripcion": "Grasa Alta Temperatura", "centro": "1008", "almacen": "0003", "stock": 25, "um": "KG", "precio_usd": 22.00, "grupo_articulos": "LUBRICANTES", "ubicacion": "B-01-04", "critico": "SI"},

    # Filtros
    {"material": "FT-001", "descripcion": "Filtro Aceite Hidraulico 10 micras", "centro": "1010", "almacen": "0001", "stock": 35, "um": "UNI", "precio_usd": 45.00, "grupo_articulos": "FILTROS", "ubicacion": "C-01-01", "critico": "SI"},
    {"material": "FT-002", "descripcion": "Filtro Aire Compresor Atlas", "centro": "1010", "almacen": "0001", "stock": 18, "um": "UNI", "precio_usd": 85.00, "grupo_articulos": "FILTROS", "ubicacion": "C-01-02", "critico": "SI"},
    {"material": "FT-003", "descripcion": "Elemento Separador Aire/Aceite", "centro": "1010", "almacen": "0001", "stock": 8, "um": "UNI", "precio_usd": 320.00, "grupo_articulos": "FILTROS", "ubicacion": "C-01-03", "critico": "SI"},
    {"material": "FT-004", "descripcion": "Filtro Combustible Diesel", "centro": "1010", "almacen": "0001", "stock": 40, "um": "UNI", "precio_usd": 28.00, "grupo_articulos": "FILTROS", "ubicacion": "C-01-04", "critico": "NO"},

    # Ferreteria Industrial
    {"material": "FE-001", "descripcion": "Tornillo Hex M10x40 Gr8.8", "centro": "1008", "almacen": "0004", "stock": 500, "um": "UNI", "precio_usd": 0.45, "grupo_articulos": "FERRETERIA", "ubicacion": "D-01-01", "critico": "NO"},
    {"material": "FE-002", "descripcion": "Tornillo Hex M12x50 Gr8.8", "centro": "1008", "almacen": "0004", "stock": 350, "um": "UNI", "precio_usd": 0.65, "grupo_articulos": "FERRETERIA", "ubicacion": "D-01-02", "critico": "NO"},
    {"material": "FE-003", "descripcion": "Tuerca Hex M10 Gr8", "centro": "1008", "almacen": "0004", "stock": 800, "um": "UNI", "precio_usd": 0.15, "grupo_articulos": "FERRETERIA", "ubicacion": "D-01-03", "critico": "NO"},
    {"material": "FE-004", "descripcion": "Arandela Plana M10 Zincada", "centro": "1008", "almacen": "0004", "stock": 1000, "um": "UNI", "precio_usd": 0.08, "grupo_articulos": "FERRETERIA", "ubicacion": "D-01-04", "critico": "NO"},
    {"material": "FE-005", "descripcion": "Tornillo Allen M8x30", "centro": "1008", "almacen": "0004", "stock": 400, "um": "UNI", "precio_usd": 0.35, "grupo_articulos": "FERRETERIA", "ubicacion": "D-01-05", "critico": "NO"},

    # Componentes Hidraulicos
    {"material": "HI-001", "descripcion": "Manguera Hidraulica 1/2 R2", "centro": "1010", "almacen": "0002", "stock": 50, "um": "MT", "precio_usd": 18.00, "grupo_articulos": "HIDRAULICA", "ubicacion": "E-01-01", "critico": "SI"},
    {"material": "HI-002", "descripcion": "Manguera Hidraulica 3/4 R2", "centro": "1010", "almacen": "0002", "stock": 30, "um": "MT", "precio_usd": 25.00, "grupo_articulos": "HIDRAULICA", "ubicacion": "E-01-02", "critico": "SI"},
    {"material": "HI-003", "descripcion": "Valvula Direccional 4/3 24V", "centro": "1010", "almacen": "0002", "stock": 4, "um": "UNI", "precio_usd": 450.00, "grupo_articulos": "HIDRAULICA", "ubicacion": "E-02-01", "critico": "SI"},
    {"material": "HI-004", "descripcion": "Cilindro Hidraulico 50x300", "centro": "1010", "almacen": "0002", "stock": 2, "um": "UNI", "precio_usd": 680.00, "grupo_articulos": "HIDRAULICA", "ubicacion": "E-02-02", "critico": "SI"},
    {"material": "HI-005", "descripcion": "Bomba Hidraulica 20 GPM", "centro": "1010", "almacen": "0002", "stock": 1, "um": "UNI", "precio_usd": 1250.00, "grupo_articulos": "HIDRAULICA", "ubicacion": "E-02-03", "critico": "SI"},

    # Componentes Electricos
    {"material": "EL-001", "descripcion": "Contactor 3P 40A 220V", "centro": "1012", "almacen": "0001", "stock": 15, "um": "UNI", "precio_usd": 85.00, "grupo_articulos": "ELECTRICO", "ubicacion": "F-01-01", "critico": "SI"},
    {"material": "EL-002", "descripcion": "Rele Termico 25-40A", "centro": "1012", "almacen": "0001", "stock": 12, "um": "UNI", "precio_usd": 65.00, "grupo_articulos": "ELECTRICO", "ubicacion": "F-01-02", "critico": "SI"},
    {"material": "EL-003", "descripcion": "Variador Frecuencia 10HP", "centro": "1012", "almacen": "0001", "stock": 2, "um": "UNI", "precio_usd": 1850.00, "grupo_articulos": "ELECTRICO", "ubicacion": "F-02-01", "critico": "SI"},
    {"material": "EL-004", "descripcion": "Sensor Proximidad Inductivo", "centro": "1012", "almacen": "0001", "stock": 20, "um": "UNI", "precio_usd": 45.00, "grupo_articulos": "ELECTRICO", "ubicacion": "F-01-03", "critico": "NO"},
    {"material": "EL-005", "descripcion": "Cable Control 4x16 AWG", "centro": "1012", "almacen": "0001", "stock": 200, "um": "MT", "precio_usd": 3.50, "grupo_articulos": "ELECTRICO", "ubicacion": "F-03-01", "critico": "NO"},

    # Sellos y Empaques
    {"material": "SE-001", "descripcion": "Sello Mecanico 35mm", "centro": "1008", "almacen": "0005", "stock": 8, "um": "UNI", "precio_usd": 185.00, "grupo_articulos": "SELLOS", "ubicacion": "G-01-01", "critico": "SI"},
    {"material": "SE-002", "descripcion": "O-Ring Viton 50x4", "centro": "1008", "almacen": "0005", "stock": 100, "um": "UNI", "precio_usd": 4.50, "grupo_articulos": "SELLOS", "ubicacion": "G-01-02", "critico": "NO"},
    {"material": "SE-003", "descripcion": "Empaque Grafito DN80", "centro": "1008", "almacen": "0005", "stock": 25, "um": "UNI", "precio_usd": 28.00, "grupo_articulos": "SELLOS", "ubicacion": "G-01-03", "critico": "NO"},
]

# Agregar demanda_estimada_anual basada en patrones de consumo
consumo_anual_estimado = {
    "RM-001": 48, "RM-002": 36, "RM-003": 12, "RM-004": 12, "RM-005": 36, "RM-006": 6,
    "LB-001": 960, "LB-002": 480, "LB-003": 180, "LB-004": 60,
    "FT-001": 72, "FT-002": 36, "FT-003": 12, "FT-004": 96,
    "FE-001": 720, "FE-002": 480, "FE-003": 960, "FE-004": 1200, "FE-005": 600,
    "HI-001": 96, "HI-002": 60, "HI-003": 4, "HI-004": 2, "HI-005": 1,
    "EL-001": 24, "EL-002": 18, "EL-003": 2, "EL-004": 36, "EL-005": 300,
    "SE-001": 10, "SE-002": 144, "SE-003": 36,
}

for item in stock_data:
    item["demanda_estimada_anual"] = consumo_anual_estimado.get(item["material"], 0)

stock_df = pd.DataFrame(stock_data)

# ============================================================================
# HOJA 4: PEDIDOS EN CURSO (POs pendientes de recibir)
# ============================================================================
pedidos_data = [
    {"numero_pedido": "4500001234", "material": "RM-001", "descripcion": "Rodamiento SKF 6205-2RS", "cantidad": 20, "um": "UNI", "fecha_pedido": "2024-11-15", "fecha_entrega": "2025-01-20", "proveedor": "SKF CHILE", "centro": "1008", "almacen": "0001", "precio_unitario": 28.50, "moneda": "USD", "estado": "En transito"},
    {"numero_pedido": "4500001235", "material": "RM-002", "descripcion": "Rodamiento SKF 6308-2RS", "cantidad": 15, "um": "UNI", "fecha_pedido": "2024-11-20", "fecha_entrega": "2025-01-25", "proveedor": "SKF CHILE", "centro": "1008", "almacen": "0001", "precio_unitario": 52.00, "moneda": "USD", "estado": "En transito"},
    {"numero_pedido": "4500001240", "material": "LB-001", "descripcion": "Aceite Hidraulico ISO 68", "cantidad": 200, "um": "LT", "fecha_pedido": "2024-12-01", "fecha_entrega": "2025-01-10", "proveedor": "SHELL LUBRICANTES", "centro": "1008", "almacen": "0003", "precio_unitario": 4.50, "moneda": "USD", "estado": "Confirmado"},
    {"numero_pedido": "4500001242", "material": "FT-002", "descripcion": "Filtro Aire Compresor Atlas", "cantidad": 10, "um": "UNI", "fecha_pedido": "2024-12-05", "fecha_entrega": "2025-01-15", "proveedor": "ATLAS COPCO", "centro": "1010", "almacen": "0001", "precio_unitario": 85.00, "moneda": "USD", "estado": "Confirmado"},
    {"numero_pedido": "4500001245", "material": "HI-003", "descripcion": "Valvula Direccional 4/3 24V", "cantidad": 2, "um": "UNI", "fecha_pedido": "2024-11-10", "fecha_entrega": "2025-02-01", "proveedor": "REXROTH CHILE", "centro": "1010", "almacen": "0002", "precio_unitario": 450.00, "moneda": "USD", "estado": "En produccion"},
    {"numero_pedido": "4500001248", "material": "EL-001", "descripcion": "Contactor 3P 40A 220V", "cantidad": 8, "um": "UNI", "fecha_pedido": "2024-12-10", "fecha_entrega": "2025-01-08", "proveedor": "SCHNEIDER ELECTRIC", "centro": "1012", "almacen": "0001", "precio_unitario": 85.00, "moneda": "USD", "estado": "En transito"},
    {"numero_pedido": "4500001250", "material": "FE-001", "descripcion": "Tornillo Hex M10x40 Gr8.8", "cantidad": 500, "um": "UNI", "fecha_pedido": "2024-12-15", "fecha_entrega": "2025-01-05", "proveedor": "FERRETERIA INDUSTRIAL", "centro": "1008", "almacen": "0004", "precio_unitario": 0.45, "moneda": "USD", "estado": "En transito"},
    {"numero_pedido": "4500001252", "material": "SE-001", "descripcion": "Sello Mecanico 35mm", "cantidad": 4, "um": "UNI", "fecha_pedido": "2024-11-25", "fecha_entrega": "2025-02-10", "proveedor": "JOHN CRANE", "centro": "1008", "almacen": "0005", "precio_unitario": 185.00, "moneda": "USD", "estado": "En produccion"},
]

pedidos_df = pd.DataFrame(pedidos_data)

# ============================================================================
# HOJA 5: SOLPEDS EN CURSO (Requisiciones pendientes)
# ============================================================================
solpeds_data = [
    {"numero_solped": "1000045678", "material": "RM-003", "descripcion": "Rodamiento FAG 22212E", "cantidad": 6, "um": "UNI", "fecha_creacion": "2024-12-20", "fecha_requerida": "2025-02-15", "solicitante": "MANT-MECANICO", "centro": "1008", "almacen": "0001", "precio_estimado": 185.00, "moneda": "USD", "estado": "Pendiente aprobacion", "prioridad": "Alta"},
    {"numero_solped": "1000045679", "material": "RM-006", "descripcion": "Acoplamiento Flexible L-100", "cantidad": 3, "um": "UNI", "fecha_creacion": "2024-12-21", "fecha_requerida": "2025-02-01", "solicitante": "MANT-MECANICO", "centro": "1008", "almacen": "0002", "precio_estimado": 145.00, "moneda": "USD", "estado": "Aprobada", "prioridad": "Media"},
    {"numero_solped": "1000045680", "material": "LB-004", "descripcion": "Grasa Alta Temperatura", "cantidad": 15, "um": "KG", "fecha_creacion": "2024-12-18", "fecha_requerida": "2025-01-20", "solicitante": "MANT-PREDICTIVO", "centro": "1008", "almacen": "0003", "precio_estimado": 22.00, "moneda": "USD", "estado": "En cotizacion", "prioridad": "Media"},
    {"numero_solped": "1000045682", "material": "FT-003", "descripcion": "Elemento Separador Aire/Aceite", "cantidad": 4, "um": "UNI", "fecha_creacion": "2024-12-22", "fecha_requerida": "2025-03-01", "solicitante": "MANT-COMPRESORES", "centro": "1010", "almacen": "0001", "precio_estimado": 320.00, "moneda": "USD", "estado": "Pendiente aprobacion", "prioridad": "Alta"},
    {"numero_solped": "1000045685", "material": "HI-004", "descripcion": "Cilindro Hidraulico 50x300", "cantidad": 1, "um": "UNI", "fecha_creacion": "2024-12-19", "fecha_requerida": "2025-03-15", "solicitante": "MANT-HIDRAULICO", "centro": "1010", "almacen": "0002", "precio_estimado": 680.00, "moneda": "USD", "estado": "Aprobada", "prioridad": "Baja"},
    {"numero_solped": "1000045687", "material": "EL-003", "descripcion": "Variador Frecuencia 10HP", "cantidad": 1, "um": "UNI", "fecha_creacion": "2024-12-15", "fecha_requerida": "2025-04-01", "solicitante": "MANT-ELECTRICO", "centro": "1012", "almacen": "0001", "precio_estimado": 1850.00, "moneda": "USD", "estado": "En cotizacion", "prioridad": "Alta"},
    {"numero_solped": "1000045690", "material": "HI-005", "descripcion": "Bomba Hidraulica 20 GPM", "cantidad": 1, "um": "UNI", "fecha_creacion": "2024-12-10", "fecha_requerida": "2025-05-01", "solicitante": "PROYECTOS", "centro": "1010", "almacen": "0002", "precio_estimado": 1250.00, "moneda": "USD", "estado": "Pendiente aprobacion", "prioridad": "Media"},
]

solpeds_df = pd.DataFrame(solpeds_data)

# ============================================================================
# HOJA 2: CONSUMO HISTORICO - 24 meses con patrones realisticos
# ============================================================================
consumo_records = []

# Fecha inicio: 24 meses atras
end_date = datetime(2024, 12, 31)
start_date = end_date - timedelta(days=730)  # ~24 meses

# Patrones de consumo base por material (mensual promedio)
consumo_patterns = {
    # Rodamientos - consumo moderado, picos en paradas programadas (mar, sep)
    "RM-001": {"base": 4, "variacion": 0.3, "estacional": [0.8, 0.9, 1.5, 1.0, 1.0, 0.9, 0.8, 0.9, 1.5, 1.0, 1.0, 0.9]},
    "RM-002": {"base": 3, "variacion": 0.35, "estacional": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    "RM-003": {"base": 1, "variacion": 0.4, "estacional": [0.7, 0.8, 1.6, 1.0, 1.0, 0.8, 0.7, 0.8, 1.6, 1.0, 1.0, 0.8]},
    "RM-004": {"base": 1, "variacion": 0.3, "estacional": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    "RM-005": {"base": 3, "variacion": 0.25, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.2, 1.0, 1.0, 1.0]},
    "RM-006": {"base": 0.5, "variacion": 0.5, "estacional": [0.8, 0.9, 1.5, 1.0, 1.0, 0.9, 0.8, 0.9, 1.5, 1.0, 1.0, 0.9]},

    # Lubricantes - consumo constante con pico en invierno
    "LB-001": {"base": 80, "variacion": 0.15, "estacional": [1.1, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2]},
    "LB-002": {"base": 40, "variacion": 0.2, "estacional": [1.1, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2]},
    "LB-003": {"base": 15, "variacion": 0.2, "estacional": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},
    "LB-004": {"base": 5, "variacion": 0.3, "estacional": [1.2, 1.1, 1.0, 0.9, 0.8, 0.8, 0.8, 0.9, 1.0, 1.1, 1.2, 1.2]},

    # Filtros - cambios programados cada 3-6 meses
    "FT-001": {"base": 6, "variacion": 0.2, "estacional": [1.0, 0.8, 1.3, 0.8, 1.0, 1.3, 1.0, 0.8, 1.3, 0.8, 1.0, 1.3]},
    "FT-002": {"base": 3, "variacion": 0.25, "estacional": [1.0, 0.7, 1.4, 0.7, 1.0, 1.4, 1.0, 0.7, 1.4, 0.7, 1.0, 1.4]},
    "FT-003": {"base": 1, "variacion": 0.3, "estacional": [0.8, 0.6, 1.5, 0.6, 0.8, 1.5, 0.8, 0.6, 1.5, 0.6, 0.8, 1.5]},
    "FT-004": {"base": 8, "variacion": 0.2, "estacional": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},

    # Ferreteria - consumo alto y constante
    "FE-001": {"base": 60, "variacion": 0.25, "estacional": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},
    "FE-002": {"base": 40, "variacion": 0.25, "estacional": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},
    "FE-003": {"base": 80, "variacion": 0.2, "estacional": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},
    "FE-004": {"base": 100, "variacion": 0.2, "estacional": [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]},
    "FE-005": {"base": 50, "variacion": 0.25, "estacional": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},

    # Hidraulica - consumo bajo pero critico
    "HI-001": {"base": 8, "variacion": 0.3, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    "HI-002": {"base": 5, "variacion": 0.3, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    "HI-003": {"base": 0.3, "variacion": 0.5, "estacional": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    "HI-004": {"base": 0.2, "variacion": 0.6, "estacional": [0.7, 0.8, 1.5, 1.0, 1.0, 0.8, 0.7, 0.8, 1.5, 1.0, 1.0, 0.8]},
    "HI-005": {"base": 0.1, "variacion": 0.7, "estacional": [0.5, 0.7, 1.8, 1.0, 1.0, 0.7, 0.5, 0.7, 1.8, 1.0, 1.0, 0.7]},

    # Electrico
    "EL-001": {"base": 2, "variacion": 0.35, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    "EL-002": {"base": 1.5, "variacion": 0.35, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    "EL-003": {"base": 0.15, "variacion": 0.6, "estacional": [0.7, 0.8, 1.5, 1.0, 1.0, 0.8, 0.7, 0.8, 1.5, 1.0, 1.0, 0.8]},
    "EL-004": {"base": 3, "variacion": 0.3, "estacional": [1.0, 1.0, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.0, 1.0, 1.0]},
    "EL-005": {"base": 25, "variacion": 0.25, "estacional": [1.0, 1.0, 1.1, 1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 0.9]},

    # Sellos
    "SE-001": {"base": 0.8, "variacion": 0.4, "estacional": [0.8, 0.9, 1.4, 1.0, 1.0, 0.9, 0.8, 0.9, 1.4, 1.0, 1.0, 0.9]},
    "SE-002": {"base": 12, "variacion": 0.3, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
    "SE-003": {"base": 3, "variacion": 0.3, "estacional": [1.0, 1.0, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.2, 1.0, 1.0, 0.9]},
}

# Mapeo material -> centro
material_centro = {row["material"]: row["centro"] for row in stock_data}

# Generar consumo para cada mes de los ultimos 24 meses
current_date = start_date
while current_date <= end_date:
    month_idx = current_date.month - 1  # 0-11

    for mat, pattern in consumo_patterns.items():
        base = pattern["base"]
        var = pattern["variacion"]
        seasonal = pattern["estacional"][month_idx]

        # Calcular cantidad con variacion y estacionalidad
        qty = base * seasonal * (1 + np.random.uniform(-var, var))
        qty = max(0, round(qty))

        if qty > 0:
            # Distribuir en 2-4 registros por mes para simular multiples consumos
            num_records = np.random.randint(1, 4) if qty > 3 else 1
            for _ in range(num_records):
                day_offset = np.random.randint(0, 28)
                fecha = current_date + timedelta(days=day_offset)
                qty_partial = max(1, round(qty / num_records))

                consumo_records.append({
                    "material": mat,
                    "fecha": fecha.strftime("%Y-%m-%d"),
                    "cantidad": qty_partial,
                    "centro": material_centro.get(mat, "1008")
                })

    # Siguiente mes
    if current_date.month == 12:
        current_date = datetime(current_date.year + 1, 1, 1)
    else:
        current_date = datetime(current_date.year, current_date.month + 1, 1)

consumo_df = pd.DataFrame(consumo_records)

# ============================================================================
# HOJA 3: PARAMETROS MRP - Para todos los materiales criticos
# ============================================================================
parametros_data = []

for row in stock_data:
    mat = row["material"]
    if row["critico"] == "SI":
        pattern = consumo_patterns.get(mat, {"base": 1})
        consumo_mensual = pattern["base"]

        # Calcular parametros basados en consumo
        lead_time = 14 if "RM-" in mat or "HI-" in mat or "EL-" in mat else 7
        if "EL-003" in mat or "HI-005" in mat:
            lead_time = 30  # Equipos especiales

        parametros_data.append({
            "material": mat,
            "stock_seguridad": round(consumo_mensual * 1.5),  # 1.5 meses
            "punto_pedido": round(consumo_mensual * 2.5),     # 2.5 meses
            "stock_maximo": round(consumo_mensual * 6),       # 6 meses
            "lead_time_dias": lead_time
        })

parametros_df = pd.DataFrame(parametros_data)

# ============================================================================
# GUARDAR EXCEL
# ============================================================================
os.makedirs("frontend/public/templates", exist_ok=True)
filepath = "frontend/public/templates/plantilla_mrp_forecast.xlsx"

with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
    stock_df.to_excel(writer, sheet_name="stock", index=False)
    consumo_df.to_excel(writer, sheet_name="consumo_historico", index=False)
    pedidos_df.to_excel(writer, sheet_name="pedidos_en_curso", index=False)
    solpeds_df.to_excel(writer, sheet_name="solpeds_en_curso", index=False)
    parametros_df.to_excel(writer, sheet_name="parametros_mrp", index=False)

print(f"Excel creado: {filepath}")
print(f"\n{'='*60}")
print(f"RESUMEN DE PLANTILLA MRP/FORECAST")
print(f"{'='*60}")
print(f"\n1. STOCK: {len(stock_df)} materiales")
print(f"   - Centros: {stock_df['centro'].nunique()} ({', '.join(stock_df['centro'].unique())})")
print(f"   - Almacenes: {stock_df['almacen'].nunique()}")
print(f"   - Grupos: {stock_df['grupo_articulos'].nunique()}")
print(f"   - Criticos: {(stock_df['critico'] == 'SI').sum()}")
print(f"   - Valor total stock: ${(stock_df['stock'] * stock_df['precio_usd']).sum():,.2f} USD")
print(f"\n2. CONSUMO HISTORICO: {len(consumo_df)} registros")
print(f"   - Rango: {consumo_df['fecha'].min()} a {consumo_df['fecha'].max()}")
print(f"   - Meses: ~24")
print(f"   - Promedio registros/material: {len(consumo_df) / len(consumo_patterns):.0f}")
print(f"\n3. PEDIDOS EN CURSO: {len(pedidos_df)} ordenes de compra")
print(f"   - Valor total: ${(pedidos_df['cantidad'] * pedidos_df['precio_unitario']).sum():,.2f} USD")
print(f"   - Estados: {', '.join(pedidos_df['estado'].unique())}")
print(f"\n4. SOLPEDS EN CURSO: {len(solpeds_df)} requisiciones")
print(f"   - Valor estimado: ${(solpeds_df['cantidad'] * solpeds_df['precio_estimado']).sum():,.2f} USD")
print(f"   - Estados: {', '.join(solpeds_df['estado'].unique())}")
print(f"\n5. PARAMETROS MRP: {len(parametros_df)} materiales criticos")
print(f"\n{'='*60}")
