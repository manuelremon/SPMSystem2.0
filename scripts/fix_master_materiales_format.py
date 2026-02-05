#!/usr/bin/env python
"""
Script para corregir inconsistencias de formato en master_materiales.db

El problema: Las 3 tablas tienen formatos inconsistentes de códigos de material:
- catalogo_materiales: formato antiguo "0000001" (falta el grupo)
- materiales_equivalencias: formato correcto "0101-0000001" (grupo-id)
- materiales_mrp: mixto, algunos con y sin prefijo

Este script normaliza todos los códigos al formato correcto: {grupo}-{id_material}

Modos de operación:
  --analyze:   Analiza el estado actual sin hacer cambios
  --fix:       Realiza la corrección (con backup automático)
  --verify:    Verifica que la corrección fue exitosa
  --rollback:  Restaura desde backup más reciente
"""

import sqlite3
import sys
import os
from datetime import datetime
import json
import shutil
from pathlib import Path


class MasterMaterialesFormatter:
    """Gestiona la corrección de formato en master_materiales.db"""

    DB_PATH = Path(__file__).parent.parent / "data" / "master_materiales.db"
    BACKUP_DIR = Path(__file__).parent.parent / "data" / "backups"

    def __init__(self, verbose=False):
        self.verbose = verbose
        self.stats = {
            "catalogo_antes": 0,
            "catalogo_corregidos": 0,
            "mrp_antes": 0,
            "mrp_corregidos": 0,
            "errores": [],
        }

    def log(self, msg):
        """Log condicional para verbose mode"""
        if self.verbose:
            print(f"  → {msg}")

    def ensure_backup_dir(self):
        """Crea el directorio de backups si no existe"""
        self.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    def create_backup(self):
        """Crea un backup de la BD antes de hacer cambios"""
        self.ensure_backup_dir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = (
            self.BACKUP_DIR / f"master_materiales_{timestamp}_pre_fix.db"
        )
        shutil.copy2(self.DB_PATH, backup_path)
        print(f"✓ Backup creado: {backup_path.name}")
        return backup_path

    def get_connection(self):
        """Abre conexión a la BD"""
        if not self.DB_PATH.exists():
            raise FileNotFoundError(f"BD no encontrada: {self.DB_PATH}")
        conn = sqlite3.connect(str(self.DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    # ==================== MODO ANÁLISIS ====================

    def analyze(self):
        """Analiza el estado actual sin hacer cambios"""
        print("\n" + "=" * 70)
        print("ANÁLISIS: Estado actual de master_materiales.db")
        print("=" * 70)

        conn = self.get_connection()
        try:
            self._analyze_catalogo(conn)
            self._analyze_mrp(conn)
            self._analyze_equivalencias(conn)
            self._analyze_references(conn)
        finally:
            conn.close()

    def _analyze_catalogo(self, conn):
        """Analiza tabla catalogo_materiales"""
        print("\n📦 TABLA: catalogo_materiales")
        print("-" * 70)

        cursor = conn.cursor()

        # Contar registros totales
        cursor.execute("SELECT COUNT(*) as cnt FROM catalogo_materiales")
        total = cursor.fetchone()["cnt"]
        print(f"  Total de materiales: {total:,}")

        # Verificar que existe grupo_articulo
        cursor.execute(
            "PRAGMA table_info(catalogo_materiales)"
        )
        columns = [row["name"] for row in cursor.fetchall()]
        print(f"  Columnas: {', '.join(columns[:5])}...")

        # Contar formatos correctos vs incorrectos
        cursor.execute(
            """
            SELECT
                SUM(CASE WHEN id_material GLOB '*-*' THEN 1 ELSE 0 END) as formato_correcto,
                SUM(CASE WHEN id_material NOT GLOB '*-*' THEN 1 ELSE 0 END) as formato_incorrecto,
                COUNT(DISTINCT grupo_articulo) as grupos_unicos
            FROM catalogo_materiales
            """
        )
        row = cursor.fetchone()
        correcto = row["formato_correcto"] or 0
        incorrecto = row["formato_incorrecto"] or 0
        grupos = row["grupos_unicos"] or 0

        print(f"  ✅ Formato correcto (XXXX-YYYYYYY): {correcto:,}")
        print(f"  ❌ Formato incorrecto (YYYYYYY): {incorrecto:,}")
        print(f"  Grupos de artículos únicos: {grupos}")

        # Mostrar ejemplos de ambos formatos
        if correcto > 0:
            cursor.execute(
                """
                SELECT id_material, grupo_articulo
                FROM catalogo_materiales
                WHERE id_material GLOB '*-*'
                LIMIT 3
                """
            )
            print("\n  Ejemplos formato correcto:")
            for row in cursor.fetchall():
                print(f"    • {row['id_material']}")

        if incorrecto > 0:
            cursor.execute(
                """
                SELECT id_material, grupo_articulo
                FROM catalogo_materiales
                WHERE id_material NOT GLOB '*-*'
                LIMIT 3
                """
            )
            print("\n  Ejemplos formato incorrecto:")
            for row in cursor.fetchall():
                print(f"    • {row['id_material']} (grupo: {row['grupo_articulo']})")

        # Verificar duplicados potenciales
        cursor.execute(
            """
            SELECT grupo_articulo || '-' || id_material as codigo_nuevo, COUNT(*) as cnt
            FROM (SELECT grupo_articulo, id_material FROM catalogo_materiales)
            GROUP BY codigo_nuevo
            HAVING cnt > 1
            """
        )
        duplicados = cursor.fetchall()
        if duplicados:
            print(f"\n  ⚠️  Posibles duplicados al agregar prefijo: {len(duplicados)}")
            for row in duplicados[:3]:
                print(f"    • {row['codigo_nuevo']}: {row['cnt']} registros")
        else:
            print("\n  ✓ Sin duplicados después de agregar prefijo")

    def _analyze_mrp(self, conn):
        """Analiza tabla materiales_mrp"""
        print("\n📊 TABLA: materiales_mrp")
        print("-" * 70)

        cursor = conn.cursor()

        # Contar registros totales
        cursor.execute("SELECT COUNT(*) as cnt FROM materiales_mrp")
        total = cursor.fetchone()["cnt"]
        print(f"  Total de materiales MRP: {total:,}")

        # Contar formatos
        cursor.execute(
            """
            SELECT
                SUM(CASE WHEN codigo_material GLOB '*-*' THEN 1 ELSE 0 END) as formato_correcto,
                SUM(CASE WHEN codigo_material NOT GLOB '*-*' THEN 1 ELSE 0 END) as formato_incorrecto
            FROM materiales_mrp
            """
        )
        row = cursor.fetchone()
        correcto = row["formato_correcto"] or 0
        incorrecto = row["formato_incorrecto"] or 0

        print(f"  ✅ Formato correcto: {correcto:,}")
        print(f"  ❌ Formato incorrecto: {incorrecto:,}")

        # Mostrar ejemplos
        if correcto > 0:
            cursor.execute(
                "SELECT codigo_material FROM materiales_mrp WHERE codigo_material GLOB '*-*' LIMIT 3"
            )
            print("\n  Ejemplos formato correcto:")
            for row in cursor.fetchall():
                print(f"    • {row['codigo_material']}")

        if incorrecto > 0:
            cursor.execute(
                "SELECT codigo_material FROM materiales_mrp WHERE codigo_material NOT GLOB '*-*' LIMIT 3"
            )
            print("\n  Ejemplos formato incorrecto:")
            for row in cursor.fetchall():
                print(f"    • {row['codigo_material']}")

    def _analyze_equivalencias(self, conn):
        """Analiza tabla materiales_equivalencias"""
        print("\n🔗 TABLA: materiales_equivalencias")
        print("-" * 70)

        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as cnt FROM materiales_equivalencias")
        total = cursor.fetchone()["cnt"]
        print(f"  Total de equivalencias: {total:,}")

        cursor.execute(
            """
            SELECT
                SUM(CASE WHEN material_base GLOB '*-*' THEN 1 ELSE 0 END) as base_correcto,
                SUM(CASE WHEN material_equivalente GLOB '*-*' THEN 1 ELSE 0 END) as equiv_correcto
            FROM materiales_equivalencias
            """
        )
        row = cursor.fetchone()
        print(f"  Material base con formato correcto: {row['base_correcto'] or 0:,}")
        print(f"  Material equivalente con formato correcto: {row['equiv_correcto'] or 0:,}")

    def _analyze_references(self, conn):
        """Analiza referencias cruzadas entre tablas"""
        print("\n🔍 REFERENCIAS CRUZADAS")
        print("-" * 70)

        cursor = conn.cursor()

        # Materiales del catálogo que tienen equivalencias
        cursor.execute(
            """
            SELECT COUNT(DISTINCT c.id_material) as cnt
            FROM catalogo_materiales c
            LEFT JOIN materiales_equivalencias e
              ON c.id_material = e.material_base
              OR c.id_material = e.material_equivalente
            WHERE e.id IS NOT NULL
            """
        )
        catalogo_con_equiv = cursor.fetchone()["cnt"]
        print(f"  Materiales del catálogo con equivalencias: {catalogo_con_equiv:,}")

        # Materiales MRP que están en el catálogo
        cursor.execute(
            """
            SELECT COUNT(DISTINCT m.codigo_material) as cnt
            FROM materiales_mrp m
            JOIN catalogo_materiales c
              ON m.codigo_material = c.id_material
            """
        )
        mrp_en_catalogo = cursor.fetchone()["cnt"]
        cursor.execute("SELECT COUNT(DISTINCT codigo_material) as cnt FROM materiales_mrp")
        total_mrp = cursor.fetchone()["cnt"]
        print(f"  Materiales MRP encontrados en catálogo: {mrp_en_catalogo:,} / {total_mrp:,}")

    # ==================== MODO CORRECCIÓN ====================

    def fix(self, dry_run=False):
        """Realiza la corrección de formatos"""
        if not dry_run:
            print("\n" + "=" * 70)
            print("CORRECCIÓN: Normalizando formatos")
            print("=" * 70)
            backup_path = self.create_backup()

        conn = self.get_connection()
        try:
            if not dry_run:
                print("\n📦 Corrigiendo catalogo_materiales...")
                self._fix_catalogo(conn)

            print("  ✓ catalogo_materiales corregido")

            if not dry_run:
                print("\n📊 Corrigiendo materiales_mrp...")
                self._fix_mrp(conn)

            print("  ✓ materiales_mrp corregido")

            if not dry_run:
                conn.commit()
                print("\n✅ Cambios confirmados en la BD")
                self._print_stats()

        except Exception as e:
            conn.rollback()
            print(f"\n❌ Error durante corrección: {e}")
            self.stats["errores"].append(str(e))
            raise
        finally:
            conn.close()

    def _fix_catalogo(self, conn):
        """Corrige tabla catalogo_materiales - Agregar prefijo grupo a materiales sin él"""
        cursor = conn.cursor()

        # Obtener materiales que necesitan corrección (sin guión)
        cursor.execute(
            """
            SELECT id_material, grupo_articulo
            FROM catalogo_materiales
            WHERE id_material NOT GLOB '*-*'
            """
        )
        rows = cursor.fetchall()
        self.stats["catalogo_antes"] = len(rows)

        if not rows:
            self.log("Todos los materiales ya tienen formato correcto")
            return

        # Actualizar cada material agregando el grupo
        for row in rows:
            old_id = row["id_material"]
            grupo = row["grupo_articulo"]
            new_id = f"{grupo}-{old_id}"

            cursor.execute(
                "UPDATE catalogo_materiales SET id_material = ? WHERE id_material = ?",
                (new_id, old_id),
            )
            self.stats["catalogo_corregidos"] += 1

        self.log(f"Actualizados {self.stats['catalogo_corregidos']} registros")

    def _fix_mrp(self, conn):
        """Corrige materiales MRP que no tienen formato grupo-id"""
        cursor = conn.cursor()

        # Obtener materiales únicos sin formato correcto
        cursor.execute(
            """
            SELECT DISTINCT codigo_material
            FROM materiales_mrp
            WHERE codigo_material NOT GLOB '*-*'
            ORDER BY codigo_material
            """
        )
        rows = cursor.fetchall()
        self.stats["mrp_antes"] = len(rows)

        if not rows:
            self.log("Todos los materiales MRP ya tienen formato correcto")
            return

        self.log(f"Encontrados {len(rows)} códigos sin formato")

        # Intentar corregir cada uno buscando en el catálogo
        for row in rows:
            old_code = row["codigo_material"]

            # Buscar en catálogo: el id_material podría ser el old_code o sin formato
            cursor.execute(
                """
                SELECT grupo_articulo
                FROM catalogo_materiales
                WHERE id_material = ? OR id_material LIKE ?
                LIMIT 1
                """,
                (old_code, f"%-{old_code}"),
            )
            cat_row = cursor.fetchone()

            if cat_row:
                # Encontrado en catálogo, usar su grupo
                grupo = cat_row["grupo_articulo"]
                new_code = f"{grupo}-{old_code}"

                cursor.execute(
                    "UPDATE materiales_mrp SET codigo_material = ? WHERE codigo_material = ?",
                    (new_code, old_code),
                )
                self.stats["mrp_corregidos"] += 1
            else:
                self.log(f"⚠️ {old_code} no encontrado en catálogo (se mantiene sin prefijo)")

        self.log(f"Corregidos {self.stats['mrp_corregidos']} códigos MRP")

    # ==================== MODO VERIFICACIÓN ====================

    def verify(self):
        """Verifica que la corrección fue exitosa"""
        print("\n" + "=" * 70)
        print("VERIFICACIÓN: Validando formato correcto")
        print("=" * 70)

        conn = self.get_connection()
        try:
            all_ok = True

            # Verificar catalogo_materiales
            all_ok &= self._verify_catalogo(conn)

            # Verificar materiales_mrp
            all_ok &= self._verify_mrp(conn)

            # Verificar referencias cruzadas
            all_ok &= self._verify_references(conn)

            if all_ok:
                print("\n✅ VERIFICACIÓN EXITOSA: Todos los formatos son correctos")
            else:
                print("\n❌ VERIFICACIÓN FALLÓ: Aún hay inconsistencias")

        finally:
            conn.close()

    def _verify_catalogo(self, conn):
        """Verifica catalogo_materiales"""
        print("\n📦 Verificando catalogo_materiales...")
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN id_material GLOB '*-*' THEN 1 ELSE 0 END) as correctos,
                SUM(CASE WHEN id_material NOT GLOB '*-*' THEN 1 ELSE 0 END) as incorrectos
            FROM catalogo_materiales
            """
        )
        row = cursor.fetchone()
        total = row["total"]
        correctos = row["correctos"] or 0
        incorrectos = row["incorrectos"] or 0

        print(f"  Total: {total:,}")
        print(f"  ✅ Formato correcto: {correctos:,} ({100*correctos//total}%)")

        if incorrectos > 0:
            print(f"  ❌ Formato incorrecto: {incorrectos:,} ({100*incorrectos//total}%)")
            return False

        # Verificar duplicados
        cursor.execute(
            """
            SELECT id_material, COUNT(*) as cnt
            FROM catalogo_materiales
            GROUP BY id_material
            HAVING cnt > 1
            """
        )
        dups = cursor.fetchall()
        if dups:
            print(f"  ⚠️  Duplicados encontrados: {len(dups)}")
            return False

        print("  ✓ Sin duplicados")
        return True

    def _verify_mrp(self, conn):
        """Verifica materiales_mrp"""
        print("\n📊 Verificando materiales_mrp...")
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN codigo_material GLOB '*-*' THEN 1 ELSE 0 END) as correctos,
                SUM(CASE WHEN codigo_material NOT GLOB '*-*' THEN 1 ELSE 0 END) as incorrectos
            FROM materiales_mrp
            """
        )
        row = cursor.fetchone()
        total = row["total"]
        correctos = row["correctos"] or 0
        incorrectos = row["incorrectos"] or 0

        print(f"  Total: {total:,}")
        print(f"  ✅ Formato correcto: {correctos:,} ({100*correctos//total}%)")

        if incorrectos > 0:
            print(f"  ❌ Formato incorrecto: {incorrectos:,} ({100*incorrectos//total}%)")
            return False

        print("  ✓ Sin duplicados")
        return True

    def _verify_references(self, conn):
        """Verifica que las referencias cruzadas funcionan"""
        print("\n🔍 Verificando referencias cruzadas...")
        cursor = conn.cursor()

        # Materiales MRP que están en el catálogo (debería ser mucho mayor después)
        cursor.execute(
            """
            SELECT COUNT(DISTINCT m.codigo_material) as en_catalogo,
                   (SELECT COUNT(DISTINCT codigo_material) FROM materiales_mrp) as total
            FROM materiales_mrp m
            JOIN catalogo_materiales c
              ON m.codigo_material = c.id_material
            """
        )
        row = cursor.fetchone()
        en_catalogo = row["en_catalogo"] or 0
        total = row["total"] or 0

        print(f"  Materiales MRP en catálogo: {en_catalogo:,} / {total:,}")
        if en_catalogo == 0:
            print("  ⚠️  Ningún material MRP encontrado en catálogo")
            return False

        return True

    def _print_stats(self):
        """Imprime estadísticas de la corrección"""
        print("\n" + "-" * 70)
        print("ESTADÍSTICAS:")
        print(f"  catalogo_materiales: {self.stats['catalogo_corregidos']} actualizados")
        print(f"  materiales_mrp: {self.stats['mrp_corregidos']} actualizados")
        if self.stats["errores"]:
            print(f"  Errores: {len(self.stats['errores'])}")

    # ==================== MODO ROLLBACK ====================

    def rollback(self):
        """Restaura desde el backup más reciente"""
        print("\n" + "=" * 70)
        print("ROLLBACK: Restaurando desde backup")
        print("=" * 70)

        self.ensure_backup_dir()

        # Buscar backup más reciente
        backups = sorted(self.BACKUP_DIR.glob("master_materiales_*_pre_fix.db"))
        if not backups:
            print("❌ No se encontraron backups")
            return

        latest_backup = backups[-1]
        print(f"  Encontrado backup más reciente: {latest_backup.name}")
        print(f"  Confirmación manual requerida para restaurar")
        response = input("  ¿Restaurar desde este backup? (s/n): ")

        if response.lower() != "s":
            print("  Rollback cancelado")
            return

        shutil.copy2(latest_backup, self.DB_PATH)
        print(f"✅ Base de datos restaurada desde {latest_backup.name}")


def main():
    """Punto de entrada del script"""
    if len(sys.argv) < 2:
        print("Uso: python fix_master_materiales_format.py [OPCIÓN]")
        print("\nOpciones:")
        print("  --analyze    Analizar estado actual (sin cambios)")
        print("  --fix        Realizar corrección (con backup automático)")
        print("  --verify     Verificar que la corrección fue exitosa")
        print("  --rollback   Restaurar desde backup más reciente")
        print("  -v           Verbose mode (más detalles)")
        sys.exit(1)

    verbose = "-v" in sys.argv
    formatter = MasterMaterialesFormatter(verbose=verbose)

    try:
        if "--analyze" in sys.argv:
            formatter.analyze()
        elif "--fix" in sys.argv:
            formatter.fix(dry_run=False)
        elif "--verify" in sys.argv:
            formatter.verify()
        elif "--rollback" in sys.argv:
            formatter.rollback()
        else:
            print("Opción no reconocida")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
