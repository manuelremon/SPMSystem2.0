#!/usr/bin/env python3
"""
PHASE 4: CSS Responsive Analysis - Valida media queries y responsive patterns
"""

import re


class CSSResponsiveAnalyzer:
    def __init__(self, css_path="d:\\GitHub\\SPMv1.0\\src\\frontend\\styles.css"):
        self.css_path = css_path
        self.content = ""
        self.results = {
            "media_queries": [],
            "flexbox_grid": 0,
            "responsive_units": 0,
            "viewport_rule": False,
            "breakpoints": {},
        }

    def load_css(self):
        """Carga el archivo CSS"""
        try:
            with open(self.css_path, "r", encoding="utf-8") as f:
                self.content = f.read()
            return True
        except Exception as e:
            print(f"❌ Error cargando CSS: {e}")
            return False

    def analyze(self):
        """Analiza el CSS"""
        if not self.load_css():
            return False

        # Media queries
        media_pattern = r"@media\s*\([^)]*\)"
        media_queries = re.findall(media_pattern, self.content)
        self.results["media_queries"] = media_queries

        # Flexbox y Grid
        self.results["flexbox_grid"] = len(re.findall(r"display:\s*(?:flex|grid)", self.content))

        # Unidades responsivas (rem, em, %, vw, vh)
        responsive_units = len(re.findall(r"(?:rem|em|%|vw|vh)\b", self.content))
        self.results["responsive_units"] = responsive_units

        # @viewport
        self.results["viewport_rule"] = "@viewport" in self.content

        # Detectar breakpoints
        breakpoint_pattern = r"@media\s*[^{]*\(max-width:\s*(\d+)px"
        breakpoints = re.findall(breakpoint_pattern, self.content)
        for bp in set(breakpoints):
            self.results["breakpoints"][f"{bp}px"] = int(bp)

        return True

    def print_report(self):
        """Imprime reporte de análisis"""
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║              PHASE 4: CSS RESPONSIVE ANALYSIS - REPORTE DETALLADO             ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        # Media queries
        print(f"📱 MEDIA QUERIES DETECTADAS: {len(self.results['media_queries'])}")
        print("─" * 80)
        if self.results["media_queries"]:
            for i, mq in enumerate(self.results["media_queries"][:10], 1):
                print(f"  {i}. {mq}")
            if len(self.results["media_queries"]) > 10:
                print(f"  ... y {len(self.results['media_queries']) - 10} más")
        else:
            print("  ⚠️  No se encontraron media queries")
        print()

        # Flexbox/Grid
        print(f"📊 FLEXBOX/GRID DECLARATIONS: {self.results['flexbox_grid']}")
        print("─" * 80)
        if self.results["flexbox_grid"] > 0:
            print(f"  ✅ Usando Flexbox/Grid: {self.results['flexbox_grid']} declaraciones")
        else:
            print("  ⚠️  No hay Flexbox/Grid encontrado")
        print()

        # Unidades responsivas
        print(f"📏 UNIDADES RESPONSIVAS (rem, em, %, vw, vh): {self.results['responsive_units']}")
        print("─" * 80)
        if self.results["responsive_units"] > 10:
            print(f"  ✅ {self.results['responsive_units']} valores con unidades responsivas")
        else:
            print(f"  ⚠️  Solo {self.results['responsive_units']} valores - considera usar más")
        print()

        # Breakpoints
        print(f"🎯 BREAKPOINTS DETECTADOS: {len(self.results['breakpoints'])}")
        print("─" * 80)
        if self.results["breakpoints"]:
            sorted_bp = sorted(self.results["breakpoints"].items(), key=lambda x: x[1])
            for bp_name, bp_value in sorted_bp:
                print(f"  📍 {bp_name}")
        else:
            print("  ⚠️  No se encontraron breakpoints específicos")
        print()

        # Resumen
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        quality_score = 0
        if len(self.results["media_queries"]) > 0:
            quality_score += 25
        if self.results["flexbox_grid"] > 0:
            quality_score += 25
        if self.results["responsive_units"] > 50:
            quality_score += 25
        if len(self.results["breakpoints"]) > 0:
            quality_score += 25

        print(f"║  📈 CSS RESPONSIVENESS SCORE: {quality_score}/100")
        print(f"║  ✅ Media Queries: {'SÍ' if len(self.results['media_queries']) > 0 else 'NO'}")
        print(f"║  ✅ Flexbox/Grid: {'SÍ' if self.results['flexbox_grid'] > 0 else 'NO'}")
        print(
            f"║  ✅ Unidades Responsivas: {'SÍ' if self.results['responsive_units'] > 50 else 'PARCIAL'}"
        )
        print(f"║  ✅ Breakpoints: {'SÍ' if len(self.results['breakpoints']) > 0 else 'NO'}")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        return quality_score


def main():
    analyzer = CSSResponsiveAnalyzer()
    if analyzer.analyze():
        score = analyzer.print_report()

        # Guardar JSON
        import json

        with open("PHASE4_CSS_ANALYSIS.json", "w", encoding="utf-8") as f:
            json.dump(analyzer.results, f, indent=2, ensure_ascii=False)

        print("✅ Análisis CSS guardado: PHASE4_CSS_ANALYSIS.json")
    else:
        print("❌ Error en análisis de CSS")


if __name__ == "__main__":
    main()
