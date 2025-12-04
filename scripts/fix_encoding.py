#!/usr/bin/env python3
"""
Corregir caracteres mal codificados en Materials.jsx
"""

# Leer el archivo con codificación correcta
with open("../frontend/src/pages/Materials.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Diccionario de reemplazos
replacements = {
    "Ã­tem": "ítem",
    "Ã³": "ó",
    "Ã¡": "á",
    "Ã©": "é",
    "Ã º": "ú",
    "Â¿": "¿",
    "SÃ­": "Sí",
    "mÃ¡ximo": "máximo",
    "ï¿½": "¡",
    "AlmacÃ©n": "Almacén",
    "CÃ³digo": "Código",
    "DescripciÃ³n": "Descripción",
    "AcciÃ³n": "Acción",
    "ReposiciÃ³n": "Reposición",
    "automÃ¡tica": "automática",
    "histÃ³rico": "histórico",
    "borrarÃ¡n": "borrarán",
    "aprobaciÃ³n": "aprobación",
    "cÃ³digo": "código",
    "breve": "breve",
}

# Aplicar reemplazos
count = 0
for old, new in replacements.items():
    if old in content:
        count += content.count(old)
        content = content.replace(old, new)

# Escribir el archivo corregido
with open("../frontend/src/pages/Materials.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("✓ Archivo Materials.jsx corregido exitosamente")
print(f"✓ Total reemplazos aplicados: {count} instancias")
