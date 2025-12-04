#!/usr/bin/env python3
"""
PHASE 4: Automated Responsive Design Testing
Valida estructura HTML y responsive capabilities de todas las páginas
"""

import re
from pathlib import Path


class ResponsiveTestValidator:
    def __init__(self, base_path="d:\\GitHub\\SPMv1.0\\src\\frontend"):
        self.base_path = base_path
        self.pages = [
            "dashboard.html",
            "mis-solicitudes.html",
            "crear-solicitud.html",
            "materiales.html",
            "admin-dashboard.html",
        ]
        self.results = {
            "mobile": {"pass": [], "fail": []},
            "tablet": {"pass": [], "fail": []},
            "desktop": {"pass": [], "fail": []},
        }

    def check_viewport_meta(self, html_content):
        """Valida que existe meta viewport para responsive"""
        return 'name="viewport"' in html_content and "initial-scale" in html_content

    def check_navbar(self, html_content):
        """Valida que navbar está presente"""
        return 'class="app-header"' in html_content or "<header" in html_content

    def check_no_fixed_widths(self, html_content):
        """Valida que no hay widths fijos que rompan responsive"""
        # Busca widths fijos sospechosos
        fixed_patterns = re.findall(r"width:\s*(\d+)px", html_content)
        # Allow algunos fixed widths pequeños, pero no layouts enteros
        large_fixed = [w for w in fixed_patterns if int(w) > 1000]
        return len(large_fixed) == 0

    def check_flexbox_grid(self, html_content):
        """Valida uso de flexbox o grid para layouts responsive"""
        has_flex = "display: flex" in html_content or "display:flex" in html_content
        has_grid = "display: grid" in html_content or "display:grid" in html_content
        has_bootstrap = 'class="col-' in html_content or 'class="row' in html_content
        return has_flex or has_grid or has_bootstrap

    def check_max_width(self, html_content):
        """Valida que hay max-width para legibilidad en desktop"""
        return "max-width" in html_content

    def check_media_queries(self, html_content):
        """Valida presencia de media queries"""
        return "@media" in html_content

    def test_page_mobile(self, page_name):
        """Valida página para mobile (390×844)"""
        file_path = Path(self.base_path) / page_name

        if not file_path.exists():
            self.results["mobile"]["fail"].append(f"{page_name} - ARCHIVO NO ENCONTRADO")
            return False

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        checks = {
            "viewport_meta": self.check_viewport_meta(content),
            "navbar": self.check_navbar(content),
            "no_fixed_widths": self.check_no_fixed_widths(content),
            "flexbox_grid": self.check_flexbox_grid(content),
        }

        passed = all(checks.values())

        if passed:
            self.results["mobile"]["pass"].append(page_name)
        else:
            failed_checks = [k for k, v in checks.items() if not v]
            self.results["mobile"]["fail"].append(
                f"{page_name} - Failed: {', '.join(failed_checks)}"
            )

        return passed

    def test_page_tablet(self, page_name):
        """Valida página para tablet (768×1024)"""
        file_path = Path(self.base_path) / page_name

        if not file_path.exists():
            self.results["tablet"]["fail"].append(f"{page_name} - ARCHIVO NO ENCONTRADO")
            return False

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        checks = {
            "viewport_meta": self.check_viewport_meta(content),
            "navbar": self.check_navbar(content),
            "flexbox_grid": self.check_flexbox_grid(content),
            "media_queries": self.check_media_queries(content),
        }

        passed = all(checks.values())

        if passed:
            self.results["tablet"]["pass"].append(page_name)
        else:
            failed_checks = [k for k, v in checks.items() if not v]
            self.results["tablet"]["fail"].append(
                f"{page_name} - Failed: {', '.join(failed_checks)}"
            )

        return passed

    def test_page_desktop(self, page_name):
        """Valida página para desktop (1920×1080)"""
        file_path = Path(self.base_path) / page_name

        if not file_path.exists():
            self.results["desktop"]["fail"].append(f"{page_name} - ARCHIVO NO ENCONTRADO")
            return False

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        checks = {
            "viewport_meta": self.check_viewport_meta(content),
            "navbar": self.check_navbar(content),
            "max_width": self.check_max_width(content),
            "flexbox_grid": self.check_flexbox_grid(content),
        }

        passed = all(checks.values())

        if passed:
            self.results["desktop"]["pass"].append(page_name)
        else:
            failed_checks = [k for k, v in checks.items() if not v]
            self.results["desktop"]["fail"].append(
                f"{page_name} - Failed: {', '.join(failed_checks)}"
            )

        return passed

    def run_tests(self):
        """Ejecuta testing en los 3 breakpoints"""
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║            PHASE 4: AUTOMATED RESPONSIVE DESIGN TESTING                       ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        # Mobile testing
        print("📱 TESTING MOBILE (390×844 - iPhone 12)")
        print("─" * 80)
        for page in self.pages:
            result = self.test_page_mobile(page)
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} - {page}")
        print()

        # Tablet testing
        print("📱 TESTING TABLET (768×1024 - iPad)")
        print("─" * 80)
        for page in self.pages:
            result = self.test_page_tablet(page)
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} - {page}")
        print()

        # Desktop testing
        print("🖥️  TESTING DESKTOP (1920×1080)")
        print("─" * 80)
        for page in self.pages:
            result = self.test_page_desktop(page)
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} - {page}")
        print()

        # Summary
        self.print_summary()

    def print_summary(self):
        """Imprime resumen de resultados"""
        total_checks = len(self.pages) * 3
        total_pass = (
            len(self.results["mobile"]["pass"])
            + len(self.results["tablet"]["pass"])
            + len(self.results["desktop"]["pass"])
        )

        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║                            📊 RESUMEN DE RESULTADOS                           ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        print("📱 MOBILE RESULTS:")
        print(f"   ✅ Pass: {len(self.results['mobile']['pass'])}/5")
        for page in self.results["mobile"]["fail"]:
            print(f"   ❌ {page}")
        print()

        print("📱 TABLET RESULTS:")
        print(f"   ✅ Pass: {len(self.results['tablet']['pass'])}/5")
        for page in self.results["tablet"]["fail"]:
            print(f"   ❌ {page}")
        print()

        print("🖥️  DESKTOP RESULTS:")
        print(f"   ✅ Pass: {len(self.results['desktop']['pass'])}/5")
        for page in self.results["desktop"]["fail"]:
            print(f"   ❌ {page}")
        print()

        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        overall_pass = total_pass == total_checks
        status = "✅ PHASE 4 PASSED" if overall_pass else "⚠️  PHASE 4 NEEDS REVIEW"
        print(f"║  {status}  ({total_pass}/{total_checks} checks passed)".ljust(80) + "║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        return overall_pass


def main():
    validator = ResponsiveTestValidator()
    validator.run_tests()


if __name__ == "__main__":
    main()
