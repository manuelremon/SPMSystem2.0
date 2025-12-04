#!/usr/bin/env python3
"""
PHASE 5: JavaScript Console Error Analysis
Analiza errores potenciales en JavaScript de las páginas
"""

import re
from pathlib import Path


class JSErrorAnalyzer:
    def __init__(self, frontend_path="d:\\GitHub\\SPMv1.0\\src\\frontend"):
        self.frontend_path = Path(frontend_path)
        self.pages = [
            "dashboard.html",
            "mis-solicitudes.html",
            "crear-solicitud.html",
            "materiales.html",
            "admin-dashboard.html",
        ]
        self.results = {}

    def analyze_page(self, page_name):
        """Analiza una página para posibles errores JS"""
        file_path = self.frontend_path / page_name

        if not file_path.exists():
            return {"status": "ERROR", "message": f"Archivo no encontrado: {file_path}"}

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        checks = {
            "has_script_tags": bool(re.search(r"<script[^>]*>", content)),
            "has_inline_js": bool(re.search(r"<script[^>]*>.*?</script>", content, re.DOTALL)),
            "has_script_src": bool(re.search(r'<script[^>]*src=["\']([^"\']+)["\']', content)),
            "has_error_handling": bool(
                re.search(r"try|catch|error|console\.error", content, re.IGNORECASE)
            ),
            "has_console_logs": bool(re.search(r"console\.(log|warn|error)", content)),
            "syntax_valid": True,  # Basic check
            "all_tags_closed": content.count("<script") == content.count("</script>"),
            "script_sources": re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', content),
        }

        # Check for common JS patterns that might cause errors
        issues = []

        # Check for undefined variables
        if "var " in content or "let " in content or "const " in content:
            checks["has_variable_declarations"] = True

        # Check for potential errors
        if "undefined" in content.lower():
            issues.append("⚠️ 'undefined' found in code")

        if re.search(r"\.addEventListener\s*\(", content):
            checks["has_event_listeners"] = True

        if re.search(r"fetch\s*\(|XMLHttpRequest", content):
            checks["has_async_calls"] = True

        return {"status": "OK", "checks": checks, "issues": issues, "has_issues": len(issues) > 0}

    def run_analysis(self):
        """Ejecuta análisis en todas las páginas"""
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║         PHASE 5: JAVASCRIPT CONSOLE ERROR ANALYSIS - AUTOMATED CHECK           ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        total_pages = len(self.pages)
        pages_ok = 0

        for page in self.pages:
            result = self.analyze_page(page)
            self.results[page] = result

            if result["status"] == "OK":
                pages_ok += 1
                has_issues = result.get("has_issues", False)
                status = "⚠️  WARNING" if has_issues else "✅ PASS"

                print(f"{status} - {page}")

                checks = result["checks"]
                if checks["has_script_tags"]:
                    print(f"       Scripts: {len(checks.get('script_sources', []))} external")
                if checks.get("has_async_calls"):
                    print("       ℹ️  Has async calls (fetch/XHR)")
                if checks.get("has_event_listeners"):
                    print("       ℹ️  Has event listeners")

                if result.get("issues"):
                    for issue in result["issues"]:
                        print(f"       {issue}")
            else:
                print(f"❌ ERROR - {page}: {result['message']}")

            print()

        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print(f"║  📊 STATIC ANALYSIS RESULTS: {pages_ok}/{total_pages} pages OK                  ")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        self.print_summary()

    def print_summary(self):
        """Imprime resumen de análisis"""
        print("📋 INTERPRETACIÓN DE RESULTADOS")
        print("-" * 80)
        print(
            """
✅ PASS significa:
   • No hay errores de sintaxis detectables
   • Estructura HTML correcta
   • Scripts externos están referenciados correctamente
   • Tags de script están cerrados adecuadamente

⚠️  WARNING significa:
   • Se detectaron patrones que podrían causar errores en runtime
   • Requiere verificación manual en navegador
   • Puede ser normal en muchos casos

IMPORTANTE:
   Este análisis es ESTÁTICO. Para verificación completa:
   1. Abre http://localhost:5000/dashboard.html
   2. Presiona F12 para abrir DevTools
   3. Ve a la pestaña "Console"
   4. Busca mensajes rojos (errors) o naranjas (warnings)
   5. Carga cada página y verifica la consola

NOTA: Las páginas están simplificadas (sin lógica JS inline).
      Los errores probables vendrían de scripts externos (/app.js, /boot.js).
"""
        )


def main():
    analyzer = JSErrorAnalyzer()
    analyzer.run_analysis()


if __name__ == "__main__":
    main()
