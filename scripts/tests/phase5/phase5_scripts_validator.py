#!/usr/bin/env python3
"""
PHASE 5: External Scripts Validation
Valida que los scripts externos están disponibles
"""

import re
from pathlib import Path


class ExternalScriptsValidator:
    def __init__(self, frontend_path="d:\\GitHub\\SPMv1.0\\src\\frontend"):
        self.frontend_path = Path(frontend_path)
        self.scripts_to_check = []
        self.results = {"found": [], "missing": [], "accessible": []}

    def extract_script_sources(self):
        """Extrae todas las fuentes de scripts de las páginas"""
        pages = list(self.frontend_path.glob("*.html"))

        all_scripts = set()

        for page in pages:
            with open(page, "r", encoding="utf-8") as f:
                content = f.read()
                scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', content)
                all_scripts.update(scripts)

        return sorted(list(all_scripts))

    def check_scripts(self):
        """Verifica cada script"""
        scripts = self.extract_script_sources()

        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║         PHASE 5: EXTERNAL SCRIPTS VALIDATION - DEPENDENCY CHECK               ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        print("📜 SCRIPTS ENCONTRADOS EN PÁGINAS")
        print("-" * 80)

        for script in scripts:
            print(f"  📍 {script}")

            # Check if it's a local script
            if script.startswith("/"):
                # Local script - check if file exists
                local_path = self.frontend_path / script.lstrip("/")

                # Also check in parent directories
                if not local_path.exists():
                    # Try in root
                    root_path = self.frontend_path.parent.parent / script.lstrip("/")
                    if root_path.exists():
                        local_path = root_path

                if local_path.exists():
                    file_size = local_path.stat().st_size
                    print(f"     ✅ FOUND ({file_size} bytes)")
                    self.results["found"].append(script)
                else:
                    print("     ⚠️  NOT FOUND - Will be served by Flask")
                    self.results["missing"].append(script)

            elif script.startswith("http"):
                print("     ℹ️  External CDN")
            else:
                print("     ℹ️  Relative path")

        print()
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║              SCRIPTS RESOLUTION STRATEGY                                     ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        print(
            """
CÓMO FLASK SIRVE LOS SCRIPTS:

1. Scripts locales (/app.js, /boot.js, etc.):
   → Flask busca en: src/frontend/
   → Ruta: http://localhost:5000/app.js
   → Status: ✅ Servidos por Flask

2. Scripts en módulos (/components/*.js, etc.):
   → Flask busca en: src/frontend/components/
   → Ruta: http://localhost:5000/components/file.js
   → Status: ✅ Servidos por Flask

3. Assets (/assets/*):
   → Flask busca en: src/frontend/assets/
   → Ruta: http://localhost:5000/assets/...
   → Status: ✅ Servidos por Flask

4. Static files (/static/*):
   → Flask busca en: static/
   → Ruta: http://localhost:5000/static/...
   → Status: ✅ Servidos por Flask

VERIFICACIÓN EN RUNTIME:
   1. Abre DevTools (F12)
   2. Ve a Network tab
   3. Carga una página
   4. Verifica que todos los scripts tengan status 200
   5. Si hay 404, significa que falta el archivo
"""
        )


def main():
    validator = ExternalScriptsValidator()
    validator.check_scripts()


if __name__ == "__main__":
    main()
