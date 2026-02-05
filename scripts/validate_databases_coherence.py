#!/usr/bin/env python
"""
Script para validar coherencia entre las 4 bases de datos:
- master_materiales.db (catalogo, equivalencias, mrp)
- spm.db (usuarios, solicitudes)
- sap_data.db (stock histórico)

Verifica que los datos sean consistentes y las referencias cruzadas funcionen.
"""

import sqlite3
from pathlib import Path
from collections import defaultdict
import json


class DatabaseCoherenceValidator:
    """Valida coherencia entre las 4 bases de datos"""

    DB_DIR = Path(__file__).parent.parent / "data"
    DATABASES = {
        "master": DB_DIR / "master_materiales.db",
        "spm": DB_DIR / "spm.db",
        "sap": DB_DIR / "sap_data.db",
    }

    def __init__(self):
        self.issues = defaultdict(list)
        self.stats = {}

    def log(self, msg, level="info"):
        """Log con nivel"""
        prefix = {
            "info": "ℹ️ ",
            "warning": "⚠️ ",
            "error": "❌",
            "success": "✅",
        }
        print(f"{prefix.get(level, '')} {msg}")

    def validate_all(self):
        """Ejecuta todas las validaciones"""
        print("\n" + "=" * 70)
        print("VALIDACIÓN DE COHERENCIA ENTRE BASES DE DATOS")
        print("=" * 70)

        # Validar que las BDs existen
        print("\n📂 Verificando bases de datos...")
        for name, path in self.DATABASES.items():
            if path.exists():
                size_mb = path.stat().st_size / (1024 * 1024)
                self.log(f"{name.upper():4} → {path.name:30} ({size_mb:.1f} MB)", "success")
            else:
                self.log(f"{name.upper():4} → {path.name:30} NO ENCONTRADA", "error")

        # Validaciones específicas
        print("\n🔍 Ejecutando validaciones...")
        self._validate_master_materiales()
        self._validate_spm_references()
        self._validate_sap_data_references()
        self._validate_cross_database_references()

        # Resumen
        print("\n" + "=" * 70)
        print("RESUMEN DE VALIDACIÓN")
        print("=" * 70)
        self._print_summary()

    # ==================== MASTER_MATERIALES ====================

    def _validate_master_materiales(self):
        """Valida la coherencia interna de master_materiales.db"""
        print("\n1️⃣ VALIDANDO: master_materiales.db")
        print("-" * 70)

        conn = self._get_connection("master")
        if not conn:
            return

        cursor = conn.cursor()

        # 1.1 Verificar catalogo_materiales
        self._validate_catalogo(conn)

        # 1.2 Verificar materiales_mrp
        self._validate_mrp(conn)

        # 1.3 Verificar materiales_equivalencias
        self._validate_equivalencias(conn)

        # 1.4 Verificar referencias internas
        self._validate_internal_references(conn)

        conn.close()

    def _validate_catalogo(self, conn):
        """Valida tabla catalogo_materiales"""
        cursor = conn.cursor()

        # Contar registros
        cursor.execute("SELECT COUNT(*) as cnt FROM catalogo_materiales")
        total = cursor.fetchone()[0]
        self.stats["catalogo_total"] = total

        # Verificar formato
        cursor.execute("""
            SELECT
                SUM(CASE WHEN id_material GLOB '*-*' THEN 1 ELSE 0 END) as correcto,
                SUM(CASE WHEN id_material NOT GLOB '*-*' THEN 1 ELSE 0 END) as incorrecto
            FROM catalogo_materiales
        """)
        row = cursor.fetchone()
        correcto = row[0] or 0
        incorrecto = row[1] or 0

        self.log(f"catalogo_materiales: {total:,} materiales", "info")
        self.log(f"  • Formato correcto: {correcto:,}", "success" if incorrecto == 0 else "warning")
        self.log(f"  • Formato incorrecto: {incorrecto:,}", "error" if incorrecto > 0 else "success")

        if incorrecto > 0:
            self.issues["catalogo_formato"].append(
                f"{incorrecto} materiales sin formato grupo-id"
            )

        # Verificar NULLs
        cursor.execute("""
            SELECT COUNT(*) as cnt
            FROM catalogo_materiales
            WHERE id_material IS NULL OR grupo_articulo IS NULL OR id_material = '' OR grupo_articulo = ''
        """)
        nulls = cursor.fetchone()[0]
        if nulls > 0:
            self.issues["catalogo_nulos"].append(f"{nulls} registros con campos nulos")
            self.log(f"  • Registros con NULLs: {nulls}", "error")

        # Verificar duplicados
        cursor.execute("""
            SELECT id_material, COUNT(*) as cnt
            FROM catalogo_materiales
            GROUP BY id_material
            HAVING cnt > 1
        """)
        dups = cursor.fetchall()
        if dups:
            self.issues["catalogo_duplicados"].append(f"{len(dups)} IDs duplicados")
            self.log(f"  • IDs duplicados: {len(dups)}", "error")

    def _validate_mrp(self, conn):
        """Valida tabla materiales_mrp"""
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as cnt FROM materiales_mrp")
        total = cursor.fetchone()[0]
        self.stats["mrp_total"] = total

        # Verificar formato
        cursor.execute("""
            SELECT
                SUM(CASE WHEN codigo_material GLOB '*-*' THEN 1 ELSE 0 END) as correcto,
                SUM(CASE WHEN codigo_material NOT GLOB '*-*' THEN 1 ELSE 0 END) as incorrecto
            FROM materiales_mrp
        """)
        row = cursor.fetchone()
        correcto = row[0] or 0
        incorrecto = row[1] or 0

        self.log(f"materiales_mrp: {total:,} registros", "info")
        self.log(f"  • Formato correcto: {correcto:,}", "success" if incorrecto == 0 else "warning")
        self.log(f"  • Formato incorrecto: {incorrecto:,}", "error" if incorrecto > 0 else "success")

        if incorrecto > 0:
            self.issues["mrp_formato"].append(f"{incorrecto} códigos sin formato grupo-id")

    def _validate_equivalencias(self, conn):
        """Valida tabla materiales_equivalencias"""
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as cnt FROM materiales_equivalencias")
        total = cursor.fetchone()[0]
        self.stats["equiv_total"] = total

        # Verificar formato
        cursor.execute("""
            SELECT
                SUM(CASE WHEN material_base GLOB '*-*' THEN 1 ELSE 0 END) as base_ok,
                SUM(CASE WHEN material_equivalente GLOB '*-*' THEN 1 ELSE 0 END) as equiv_ok
            FROM materiales_equivalencias
        """)
        row = cursor.fetchone()
        base_ok = row[0] or 0
        equiv_ok = row[1] or 0

        self.log(f"materiales_equivalencias: {total:,} equivalencias", "info")
        self.log(f"  • Material base correcto: {base_ok:,}", "success" if base_ok == total else "warning")
        self.log(f"  • Material equivalente correcto: {equiv_ok:,}", "success" if equiv_ok == total else "warning")

    def _validate_internal_references(self, conn):
        """Valida referencias cruzadas dentro de master_materiales"""
        cursor = conn.cursor()

        # ¿Cuántos materiales del catálogo tienen equivalencias?
        cursor.execute("""
            SELECT COUNT(DISTINCT c.id_material) as cnt
            FROM catalogo_materiales c
            WHERE c.id_material IN (
                SELECT material_base FROM materiales_equivalencias
                UNION ALL
                SELECT material_equivalente FROM materiales_equivalencias
            )
        """)
        catalogo_con_equiv = cursor.fetchone()[0]
        self.stats["catalogo_con_equiv"] = catalogo_con_equiv

        # Porcentaje
        cursor.execute("SELECT COUNT(*) FROM catalogo_materiales")
        total_catalogo = cursor.fetchone()[0]
        pct = (catalogo_con_equiv / total_catalogo * 100) if total_catalogo else 0

        self.log(f"Cobertura equivalencias: {catalogo_con_equiv:,} / {total_catalogo:,} ({pct:.1f}%)",
                 "success" if pct > 50 else "warning" if pct > 10 else "error")

        if pct < 10:
            self.issues["equiv_cobertura"].append(
                f"Solo {pct:.1f}% de materiales del catálogo tienen equivalencias"
            )

        # ¿Cuántos materiales de MRP están en el catálogo?
        cursor.execute("""
            SELECT COUNT(DISTINCT m.codigo_material) as cnt
            FROM materiales_mrp m
            WHERE m.codigo_material IN (SELECT id_material FROM catalogo_materiales)
        """)
        mrp_en_catalogo = cursor.fetchone()[0]
        self.stats["mrp_en_catalogo"] = mrp_en_catalogo

        cursor.execute("SELECT COUNT(DISTINCT codigo_material) FROM materiales_mrp")
        total_mrp = cursor.fetchone()[0]
        pct = (mrp_en_catalogo / total_mrp * 100) if total_mrp else 0

        self.log(f"MRP en catálogo: {mrp_en_catalogo:,} / {total_mrp:,} ({pct:.1f}%)",
                 "success" if pct > 30 else "warning" if pct > 1 else "error")

        if pct < 30:
            self.issues["mrp_cobertura"].append(
                f"Solo {pct:.1f}% de materiales MRP están en el catálogo"
            )

    # ==================== SPM.DB ====================

    def _validate_spm_references(self):
        """Valida que las referencias en spm.db sean válidas"""
        print("\n2️⃣ VALIDANDO: spm.db")
        print("-" * 70)

        conn = self._get_connection("spm")
        if not conn:
            return

        cursor = conn.cursor()

        # Obtener tablas relacionadas con materiales
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND (name LIKE '%material%' OR name LIKE '%item%')
            ORDER BY name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        self.log(f"Tablas relacionadas con materiales: {', '.join(tables)}", "info")

        # Verificar columnas con material_code o similar
        for table in tables:
            cursor.execute(f"PRAGMA table_info({table})")
            cols = [row[1] for row in cursor.fetchall() if "material" in row[1].lower() or "codigo" in row[1].lower()]
            if cols:
                self.log(f"  • {table}: {', '.join(cols)}", "info")

        conn.close()

    # ==================== SAP_DATA.DB ====================

    def _validate_sap_data_references(self):
        """Valida que sap_data.db sea coherente con master_materiales"""
        print("\n3️⃣ VALIDANDO: sap_data.db")
        print("-" * 70)

        conn = self._get_connection("sap")
        if not conn:
            return

        cursor = conn.cursor()

        # Obtener tablas
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table'
            ORDER BY name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        self.log(f"Total tablas: {len(tables)}", "info")

        # Revisar estructura
        for table in tables[:5]:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            self.log(f"  • {table}: {count:,} registros", "info")

        conn.close()

    # ==================== REFERENCIAS CRUZADAS ====================

    def _validate_cross_database_references(self):
        """Valida referencias entre bases de datos"""
        print("\n4️⃣ VALIDANDO: Referencias cruzadas entre BDs")
        print("-" * 70)

        master = self._get_connection("master")
        spm = self._get_connection("spm")

        if master and spm:
            # Ejemplo: Verificar si hay solicitudes con materiales que no existen en catalogo
            cursor_spm = spm.cursor()
            cursor_master = master.cursor()

            # Obtener materiales de solicitudes en spm.db
            cursor_spm.execute("""
                SELECT DISTINCT codigo_equivalente
                FROM solicitud_items_tratamiento
                WHERE codigo_equivalente IS NOT NULL
                LIMIT 10
            """)

            solicitud_materials = [row[0] for row in cursor_spm.fetchall()]
            if solicitud_materials:
                self.log(f"Materiales en solicitudes: {len(solicitud_materials)} encontrados", "info")

                # Verificar que existan en catalogo
                for codigo in solicitud_materials[:5]:
                    cursor_master.execute(
                        "SELECT id_material FROM catalogo_materiales WHERE id_material = ?",
                        (codigo,)
                    )
                    exists = cursor_master.fetchone() is not None
                    status = "success" if exists else "error"
                    self.log(f"  • {codigo}: {'ENCONTRADO' if exists else 'NO ENCONTRADO'}", status)

            master.close()
            spm.close()

    # ==================== UTILIDADES ====================

    def _get_connection(self, db_name):
        """Abre conexión a una BD"""
        path = self.DATABASES.get(db_name)
        if not path or not path.exists():
            self.log(f"BD {db_name} no encontrada", "error")
            return None
        try:
            conn = sqlite3.connect(str(path))
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as e:
            self.log(f"Error conectando a {db_name}: {e}", "error")
            return None

    def _print_summary(self):
        """Imprime resumen de validaciones"""
        if self.stats:
            print("\n📊 ESTADÍSTICAS:")
            for key, value in self.stats.items():
                print(f"  {key:25} {value:,}" if isinstance(value, int) else f"  {key:25} {value}")

        if self.issues:
            print("\n⚠️  PROBLEMAS ENCONTRADOS:")
            for issue_type, descriptions in self.issues.items():
                print(f"\n  {issue_type.upper().replace('_', ' ')}:")
                for desc in descriptions:
                    print(f"    • {desc}")
        else:
            print("\n✅ No se encontraron problemas")


def main():
    """Punto de entrada"""
    validator = DatabaseCoherenceValidator()
    validator.validate_all()


if __name__ == "__main__":
    main()
