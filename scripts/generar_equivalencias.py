#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Generador de Equivalencias de Materiales

Este script analiza el catalogo de materiales y genera equivalencias
basadas en similitud textual y especificaciones tecnicas.

Uso:
    python scripts/generar_equivalencias.py [--dry-run] [--grupo GRUPO] [--limite N]

Opciones:
    --dry-run   Simula la generacion sin insertar en la base de datos
    --grupo     Procesar solo un grupo de articulos especifico
    --limite    Limite de equivalencias a generar (default: sin limite)
    --verbose   Mostrar detalles de cada equivalencia encontrada
"""

import sqlite3
import os
import sys
import argparse
import shutil
from datetime import datetime
from typing import List, Dict, Tuple, Set, Optional
from collections import defaultdict

# Agregar path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils.text_similarity import (
    calcular_similitud,
    normalizar_texto,
    calcular_similitud_especificaciones
)
from scripts.utils.spec_extractor import (
    extraer_especificaciones,
    extraer_tipo_material,
    son_especificaciones_compatibles,
    formatear_especificaciones
)


# Configuracion
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
CATALOGO_DB = os.path.join(DATA_DIR, 'catalogo_materiales.db')
EQUIVALENTES_DB = os.path.join(DATA_DIR, 'equivalentes.db')

# Umbrales de similitud
UMBRAL_DUPLICADO = 0.98      # E0_DUPLICADO: casi identicos
UMBRAL_ESTRICTA = 0.85       # E1_ESTRICTA: mismas specs
UMBRAL_SUPLIBLE = 0.70       # E2_SUPLIBLE: compatible

# Grupos prioritarios (del analisis previo)
GRUPOS_ALTA_PRIORIDAD = [2303, 802, 206, 302]
GRUPOS_MEDIA_PRIORIDAD = [1101, 109, 1114, 1124]


class GeneradorEquivalencias:
    """
    Generador de equivalencias de materiales
    """

    def __init__(self, dry_run: bool = False, verbose: bool = False):
        self.dry_run = dry_run
        self.verbose = verbose
        self.stats = {
            'materiales_procesados': 0,
            'equivalencias_encontradas': 0,
            'duplicados': 0,
            'estrictas': 0,
            'suplibles': 0,
            'ya_existentes': 0,
            'errores': 0
        }

    def conectar_catalogo(self) -> sqlite3.Connection:
        """Conecta a la base de datos del catalogo de materiales"""
        if not os.path.exists(CATALOGO_DB):
            raise FileNotFoundError(f"No se encuentra la base de datos: {CATALOGO_DB}")
        return sqlite3.connect(CATALOGO_DB)

    def conectar_equivalentes(self) -> sqlite3.Connection:
        """Conecta a la base de datos de equivalentes"""
        if not os.path.exists(EQUIVALENTES_DB):
            raise FileNotFoundError(f"No se encuentra la base de datos: {EQUIVALENTES_DB}")
        return sqlite3.connect(EQUIVALENTES_DB)

    def cargar_materiales(self, grupo: Optional[str] = None) -> List[Dict]:
        """
        Carga materiales del catalogo.

        Args:
            grupo: Si se especifica, solo carga materiales de ese grupo

        Returns:
            Lista de diccionarios con datos de materiales
        """
        conn = self.conectar_catalogo()
        cursor = conn.cursor()

        if grupo:
            cursor.execute("""
                SELECT codigo, descripcion, descripcion_larga, grupo_articulos,
                       unidad_medida, precio_usd
                FROM materiales
                WHERE grupo_articulos = ? AND activo = 1
                ORDER BY codigo
            """, (grupo,))
        else:
            cursor.execute("""
                SELECT codigo, descripcion, descripcion_larga, grupo_articulos,
                       unidad_medida, precio_usd
                FROM materiales
                WHERE activo = 1
                ORDER BY grupo_articulos, codigo
            """)

        columnas = ['codigo', 'descripcion', 'descripcion_larga',
                   'grupo_articulos', 'unidad_medida', 'precio_usd']
        materiales = []

        for row in cursor.fetchall():
            material = dict(zip(columnas, row))
            # Extraer especificaciones
            texto_completo = f"{material['descripcion'] or ''} {material['descripcion_larga'] or ''}"
            material['specs'] = extraer_especificaciones(texto_completo)
            material['tipo'] = extraer_tipo_material(texto_completo)
            material['texto_normalizado'] = normalizar_texto(texto_completo)
            materiales.append(material)

        conn.close()
        print(f"Cargados {len(materiales)} materiales del catalogo")
        return materiales

    def cargar_equivalencias_existentes(self) -> Set[Tuple[str, str]]:
        """
        Carga las equivalencias ya existentes para evitar duplicados.

        Returns:
            Set de tuplas (codigo_material, codigo_equivalente)
        """
        conn = self.conectar_equivalentes()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT material_base, material_equivalente
            FROM equivalencias
        """)

        existentes = set()
        for row in cursor.fetchall():
            # Convertir a string para comparar con codigos de materiales
            existentes.add((str(row[0]), str(row[1])))
            existentes.add((str(row[1]), str(row[0])))  # Bidireccional

        conn.close()
        print(f"Cargadas {len(existentes)//2} equivalencias existentes")
        return existentes

    def calcular_tipo_equivalencia(self, mat1: Dict, mat2: Dict) -> Optional[str]:
        """
        Determina el tipo de equivalencia entre dos materiales.

        Returns:
            'E0_DUPLICADO', 'E1_ESTRICTA', 'E2_SUPLIBLE' o None si no son equivalentes
        """
        # Mismo codigo = no es equivalencia
        if mat1['codigo'] == mat2['codigo']:
            return None

        # Deben ser del mismo grupo
        if mat1['grupo_articulos'] != mat2['grupo_articulos']:
            return None

        # Deben ser del mismo tipo de material
        if mat1['tipo'] and mat2['tipo'] and mat1['tipo'] != mat2['tipo']:
            return None

        # Calcular similitud textual
        similitud_texto = calcular_similitud(
            mat1['texto_normalizado'],
            mat2['texto_normalizado']
        )

        # Calcular similitud de especificaciones
        similitud_specs = calcular_similitud_especificaciones(mat1['specs'], mat2['specs'])

        # Peso combinado (60% texto, 40% specs)
        similitud_total = (0.6 * similitud_texto) + (0.4 * similitud_specs)

        # Verificar compatibilidad de especificaciones criticas
        specs_compatibles = son_especificaciones_compatibles(mat1['specs'], mat2['specs'])

        # Determinar tipo de equivalencia
        if similitud_total >= UMBRAL_DUPLICADO:
            return 'E0_DUPLICADO'
        elif similitud_total >= UMBRAL_ESTRICTA and specs_compatibles:
            return 'E1_ESTRICTA'
        elif similitud_total >= UMBRAL_SUPLIBLE and specs_compatibles:
            # Verificar rango de precios para suplibles (±30%)
            precio1 = mat1.get('precio_usd') or 0
            precio2 = mat2.get('precio_usd') or 0
            if precio1 > 0 and precio2 > 0:
                ratio = max(precio1, precio2) / min(precio1, precio2)
                if ratio > 1.30:  # Diferencia mayor al 30%
                    return None
            return 'E2_SUPLIBLE'

        return None

    def encontrar_equivalencias_grupo(self, materiales: List[Dict],
                                       existentes: Set[Tuple[str, str]]) -> List[Dict]:
        """
        Encuentra equivalencias dentro de un grupo de materiales.

        Args:
            materiales: Lista de materiales del mismo grupo
            existentes: Set de equivalencias ya existentes

        Returns:
            Lista de nuevas equivalencias encontradas
        """
        equivalencias = []
        procesados = set()

        n = len(materiales)
        for i in range(n):
            mat1 = materiales[i]
            self.stats['materiales_procesados'] += 1

            for j in range(i + 1, n):
                mat2 = materiales[j]

                # Evitar duplicados
                par = (mat1['codigo'], mat2['codigo'])
                par_inv = (mat2['codigo'], mat1['codigo'])

                if par in existentes or par_inv in existentes:
                    self.stats['ya_existentes'] += 1
                    continue

                if par in procesados or par_inv in procesados:
                    continue

                # Determinar tipo de equivalencia
                tipo = self.calcular_tipo_equivalencia(mat1, mat2)

                if tipo:
                    equivalencia = {
                        'material_base': mat1['codigo'],
                        'material_equivalente': mat2['codigo'],
                        'tipo_equiv': tipo,
                        'similitud': calcular_similitud(mat1['texto_normalizado'],
                                                       mat2['texto_normalizado']),
                        'grupo': mat1['grupo_articulos'],
                        'desc_material': mat1['descripcion'],
                        'desc_equivalente': mat2['descripcion'],
                        'specs_material': formatear_especificaciones(mat1['specs']),
                        'specs_equivalente': formatear_especificaciones(mat2['specs'])
                    }
                    equivalencias.append(equivalencia)
                    procesados.add(par)

                    # Actualizar stats
                    self.stats['equivalencias_encontradas'] += 1
                    if tipo == 'E0_DUPLICADO':
                        self.stats['duplicados'] += 1
                    elif tipo == 'E1_ESTRICTA':
                        self.stats['estrictas'] += 1
                    else:
                        self.stats['suplibles'] += 1

                    if self.verbose:
                        print(f"  {tipo}: {mat1['codigo']} <-> {mat2['codigo']}")
                        print(f"    Similitud: {equivalencia['similitud']:.2%}")

        return equivalencias

    def insertar_equivalencias(self, equivalencias: List[Dict]) -> int:
        """
        Inserta nuevas equivalencias en la base de datos.

        Args:
            equivalencias: Lista de equivalencias a insertar

        Returns:
            Numero de registros insertados
        """
        if self.dry_run:
            print(f"[DRY-RUN] Se insertarian {len(equivalencias)} equivalencias")
            return 0

        if not equivalencias:
            return 0

        conn = self.conectar_equivalentes()
        cursor = conn.cursor()

        insertados = 0
        for eq in equivalencias:
            try:
                cursor.execute("""
                    INSERT INTO equivalencias
                    (material_base, texto_breve_base, material_equivalente,
                     texto_breve_equivalente, tipo_equiv, criterio, motivo_equivalencia)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    eq['material_base'],
                    eq['desc_material'],
                    eq['material_equivalente'],
                    eq['desc_equivalente'],
                    eq['tipo_equiv'],
                    'SIMILITUD',
                    f"Generado automaticamente. Similitud: {eq['similitud']:.2%}"
                ))
                insertados += 1
            except sqlite3.IntegrityError:
                # Ya existe
                pass
            except Exception as e:
                self.stats['errores'] += 1
                if self.verbose:
                    print(f"  Error insertando {eq['material_base']} <-> {eq['material_equivalente']}: {e}")

        conn.commit()
        conn.close()

        print(f"Insertadas {insertados} nuevas equivalencias")
        return insertados

    def generar(self, grupo: Optional[str] = None, limite: Optional[int] = None) -> Dict:
        """
        Ejecuta el proceso completo de generacion de equivalencias.

        Args:
            grupo: Si se especifica, solo procesa ese grupo
            limite: Limite de equivalencias a generar

        Returns:
            Diccionario con estadisticas del proceso
        """
        print("=" * 60)
        print("GENERADOR DE EQUIVALENCIAS DE MATERIALES")
        print("=" * 60)

        if self.dry_run:
            print("[MODO DRY-RUN: No se insertaran datos]")

        # Cargar datos
        print("\n1. Cargando datos...")
        materiales = self.cargar_materiales(grupo)
        existentes = self.cargar_equivalencias_existentes()

        # Agrupar por grupo_articulos
        por_grupo = defaultdict(list)
        for mat in materiales:
            por_grupo[mat['grupo_articulos']].append(mat)

        print(f"\nMateriales organizados en {len(por_grupo)} grupos")

        # Procesar grupos
        print("\n2. Buscando equivalencias...")
        todas_equivalencias = []

        grupos_orden = list(por_grupo.keys())
        # Priorizar grupos importantes
        grupos_orden.sort(key=lambda g: (
            0 if g in GRUPOS_ALTA_PRIORIDAD else
            1 if g in GRUPOS_MEDIA_PRIORIDAD else 2
        ))

        for grupo_actual in grupos_orden:
            materiales_grupo = por_grupo[grupo_actual]

            if len(materiales_grupo) < 2:
                continue

            print(f"\n  Grupo {grupo_actual}: {len(materiales_grupo)} materiales")

            equivalencias = self.encontrar_equivalencias_grupo(
                materiales_grupo,
                existentes
            )
            todas_equivalencias.extend(equivalencias)

            # Agregar a existentes para evitar duplicados entre grupos
            for eq in equivalencias:
                existentes.add((eq['material_base'], eq['material_equivalente']))

            # Verificar limite
            if limite and len(todas_equivalencias) >= limite:
                print(f"\n  Alcanzado limite de {limite} equivalencias")
                todas_equivalencias = todas_equivalencias[:limite]
                break

        # Insertar equivalencias
        print("\n3. Insertando equivalencias...")
        insertados = self.insertar_equivalencias(todas_equivalencias)

        # Mostrar estadisticas
        print("\n" + "=" * 60)
        print("ESTADISTICAS")
        print("=" * 60)
        print(f"  Materiales procesados: {self.stats['materiales_procesados']:,}")
        print(f"  Equivalencias encontradas: {self.stats['equivalencias_encontradas']:,}")
        print(f"    - Duplicados (E0): {self.stats['duplicados']:,}")
        print(f"    - Estrictas (E1): {self.stats['estrictas']:,}")
        print(f"    - Suplibles (E2): {self.stats['suplibles']:,}")
        print(f"  Ya existentes (ignoradas): {self.stats['ya_existentes']:,}")
        print(f"  Errores: {self.stats['errores']:,}")

        if not self.dry_run:
            print(f"\n  Insertadas en BD: {insertados:,}")

        return self.stats


def hacer_backup(archivo: str) -> str:
    """
    Crea un backup del archivo con timestamp.

    Returns:
        Path del archivo de backup
    """
    if not os.path.exists(archivo):
        return None

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    nombre_base = os.path.basename(archivo)
    nombre_backup = f"{nombre_base}.backup_{timestamp}"
    ruta_backup = os.path.join(os.path.dirname(archivo), nombre_backup)

    shutil.copy2(archivo, ruta_backup)
    print(f"Backup creado: {ruta_backup}")
    return ruta_backup


def main():
    """Funcion principal"""
    parser = argparse.ArgumentParser(
        description='Genera equivalencias de materiales basadas en similitud'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simula la generacion sin insertar en la base de datos'
    )
    parser.add_argument(
        '--grupo',
        type=str,
        help='Procesar solo un grupo de articulos especifico'
    )
    parser.add_argument(
        '--limite',
        type=int,
        help='Limite de equivalencias a generar'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Mostrar detalles de cada equivalencia encontrada'
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='No crear backup de la base de datos antes de insertar'
    )

    args = parser.parse_args()

    # Crear backup si no es dry-run
    if not args.dry_run and not args.no_backup:
        print("Creando backup de la base de datos...")
        hacer_backup(EQUIVALENTES_DB)

    # Ejecutar generador
    generador = GeneradorEquivalencias(
        dry_run=args.dry_run,
        verbose=args.verbose
    )

    try:
        stats = generador.generar(
            grupo=args.grupo,
            limite=args.limite
        )
        return 0
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
