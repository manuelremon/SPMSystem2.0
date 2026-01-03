#!/usr/bin/env python3
"""
Script para buscar la imagen asociada a un material del catalogo.

Uso:
    python buscar_imagen_material.py "1000002460"
    python buscar_imagen_material.py "JUNT.ESP"
    python buscar_imagen_material.py --stats
"""

import json
import os
import sys
import sqlite3
from pathlib import Path

# Rutas
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "imagenes_materiales"
INDEX_FILE = IMAGES_DIR / "index.json"
CATALOG_DB = DATA_DIR / "catalogo_materiales.db"


def load_index():
    """Carga el indice de imagenes."""
    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_material_info(codigo):
    """Obtiene informacion del material desde la base de datos."""
    conn = sqlite3.connect(CATALOG_DB)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT codigo, descripcion FROM materiales WHERE codigo = ?",
        (codigo,)
    )
    result = cursor.fetchone()
    conn.close()
    return result


def find_image_for_material(codigo_o_descripcion):
    """
    Encuentra la imagen para un material dado su codigo o descripcion.

    Algoritmo:
    1. Si es un codigo, buscar en la base de datos
    2. Buscar palabras clave en la descripcion
    3. Buscar por prefijo de categoria
    4. Usar imagen default
    """
    index = load_index()
    descripcion = codigo_o_descripcion

    # Si parece un codigo, buscar en la BD
    if codigo_o_descripcion.isdigit() or codigo_o_descripcion.startswith('1'):
        material = get_material_info(codigo_o_descripcion)
        if material:
            descripcion = material[1]
            print(f"Material encontrado: {material[0]}")
            print(f"Descripcion: {descripcion}")

    descripcion_lower = descripcion.lower()

    # 1. Buscar por palabras clave
    for keyword, imagen in index.get('palabras_clave', {}).items():
        if keyword.lower() in descripcion_lower:
            imagen_path = IMAGES_DIR / imagen.replace('defaults/', 'defaults/')
            if imagen_path.exists():
                print(f"Encontrado por palabra clave '{keyword}'")
                return str(IMAGES_DIR / imagen)

    # 2. Buscar por prefijo de categoria
    for prefijo, data in index.get('categorias', {}).items():
        if descripcion.upper().startswith(prefijo):
            imagen = data.get('imagen', '')

            # Verificar variantes
            variantes = data.get('variantes', {})
            for var_key, var_imagen in variantes.items():
                if var_key.lower() in descripcion_lower:
                    print(f"Encontrado por variante '{var_key}' en categoria {prefijo}")
                    return str(IMAGES_DIR / var_imagen)

            print(f"Encontrado por categoria '{prefijo}' ({data.get('nombre', '')})")
            return str(IMAGES_DIR / imagen)

    # 3. Usar imagen default
    print("Usando imagen default")
    return str(IMAGES_DIR / index.get('imagen_default', 'defaults/elemento.svg'))


def show_stats():
    """Muestra estadisticas del sistema de imagenes."""
    index = load_index()

    print("=" * 60)
    print("ESTADISTICAS DEL SISTEMA DE IMAGENES DE MATERIALES")
    print("=" * 60)

    stats = index.get('stats', {})
    print(f"\nTotal de imagenes: {stats.get('total_imagenes', 0)}")
    print(f"  - Imagenes reales (JPG/PNG): {stats.get('imagenes_reales', 0)}")
    print(f"  - Iconos SVG generados: {stats.get('iconos_svg', 0)}")

    print(f"\nCategorias mapeadas: {len(index.get('categorias', {}))}")
    print(f"Palabras clave: {len(index.get('palabras_clave', {}))}")

    print("\nCategarias principales:")
    for prefijo, data in sorted(
        index.get('categorias', {}).items(),
        key=lambda x: x[1].get('cantidad', 0),
        reverse=True
    )[:10]:
        print(f"  {prefijo:12} {data.get('nombre', ''):15} ({data.get('cantidad', 0):,} materiales)")

    # Verificar archivos
    defaults_dir = IMAGES_DIR / "defaults"
    if defaults_dir.exists():
        files = list(defaults_dir.glob('*'))
        jpg_count = len([f for f in files if f.suffix.lower() in ['.jpg', '.jpeg']])
        png_count = len([f for f in files if f.suffix.lower() == '.png'])
        svg_count = len([f for f in files if f.suffix.lower() == '.svg'])

        print(f"\nArchivos en defaults/:")
        print(f"  - JPG: {jpg_count}")
        print(f"  - PNG: {png_count}")
        print(f"  - SVG: {svg_count}")
        print(f"  - Total: {len(files)}")

    print("\nFuentes de imagenes:")
    for fuente, descripcion in index.get('fuentes', {}).items():
        print(f"  - {fuente}: {descripcion}")


def main():
    if len(sys.argv) < 2:
        print("Uso: python buscar_imagen_material.py <codigo_o_descripcion>")
        print("     python buscar_imagen_material.py --stats")
        sys.exit(1)

    arg = sys.argv[1]

    if arg == '--stats':
        show_stats()
    else:
        imagen = find_image_for_material(arg)
        print(f"\nImagen: {imagen}")
        if os.path.exists(imagen):
            print(f"Archivo existe: SI ({os.path.getsize(imagen):,} bytes)")
        else:
            print("Archivo existe: NO")


if __name__ == '__main__':
    main()
