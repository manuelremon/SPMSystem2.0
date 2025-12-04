#!/usr/bin/env python3
"""
PHASE 4: Responsive Device Testing - HTTP Requests per breakpoint
Simula requests desde diferentes tamaños de viewport
"""

import time
from urllib.parse import urljoin

import requests


class ResponsiveDeviceTester:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.pages = [
            "/dashboard.html",
            "/mis-solicitudes.html",
            "/crear-solicitud.html",
            "/materiales.html",
            "/admin-dashboard.html",
        ]
        self.devices = {
            "mobile": {"width": 390, "height": 844, "user_agent": "iPhone 12"},
            "tablet": {"width": 768, "height": 1024, "user_agent": "iPad"},
            "desktop": {"width": 1920, "height": 1080, "user_agent": "Desktop"},
        }
        self.results = {}

    def get_device_headers(self, device_type):
        """Genera headers para simular dispositivo"""
        headers = {
            "User-Agent": "Mozilla/5.0 ({}) AppleWebKit/537.36".format(
                self.devices[device_type]["user_agent"]
            ),
            "Viewport-Width": str(self.devices[device_type]["width"]),
            "Viewport-Height": str(self.devices[device_type]["height"]),
        }
        return headers

    def test_page_on_device(self, page, device_type):
        """Prueba una página en un dispositivo específico"""
        url = urljoin(self.base_url, page)
        headers = self.get_device_headers(device_type)

        try:
            response = requests.get(url, headers=headers, timeout=5)

            # Validaciones
            checks = {
                "status_ok": response.status_code == 200,
                "has_viewport": "viewport" in response.text,
                "has_navbar": "app-header" in response.text or "<header" in response.text,
                "has_main": "<main" in response.text,
                "lang_es": 'lang="es"' in response.text,
                "content_length": len(response.text),
            }

            return {
                "status_code": response.status_code,
                "passed": all(checks.values()),
                "checks": checks,
                "load_time": response.elapsed.total_seconds(),
            }

        except Exception as e:
            return {"status_code": 0, "passed": False, "error": str(e), "checks": {}}

    def run_tests(self):
        """Ejecuta tests en todos los dispositivos y páginas"""
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║          PHASE 4: RESPONSIVE DEVICE TESTING - SERVER VALIDATION               ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        # Test por dispositivo
        for device_type in self.devices:
            device_info = self.devices[device_type]
            print(
                f"📱 TESTING {device_type.upper()} ({device_info['width']}×{device_info['height']})"
            )
            print("─" * 80)

            device_results = {"pass": [], "fail": []}

            for page in self.pages:
                result = self.test_page_on_device(page, device_type)

                if result["passed"]:
                    device_results["pass"].append(page)
                    print(
                        f"  ✅ {page:30s} | HTTP {result['status_code']} | {result['load_time']:.3f}s"
                    )
                else:
                    device_results["fail"].append(page)
                    error = result.get("error", "Checks failed")
                    print(f"  ❌ {page:30s} | {error}")

                time.sleep(0.1)  # Para no saturar el servidor

            self.results[device_type] = device_results
            print()

        self.print_summary()

    def print_summary(self):
        """Imprime resumen"""
        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        print("║                            📊 RESUMEN GENERAL                                 ║")
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )

        total_pass = 0
        total_fail = 0

        for device_type in ["mobile", "tablet", "desktop"]:
            pass_count = len(self.results[device_type]["pass"])
            fail_count = len(self.results[device_type]["fail"])
            total_pass += pass_count
            total_fail += fail_count

            emoji = {"mobile": "📱", "tablet": "📱", "desktop": "🖥️"}[device_type]
            status = "✅ PASS" if fail_count == 0 else f"⚠️  {fail_count} FAIL"

            print(f"{emoji} {device_type.upper():10s}: {pass_count}/5 {status}")

        print()
        overall = (
            total_pass / (total_pass + total_fail) * 100 if (total_pass + total_fail) > 0 else 0
        )

        print("╔════════════════════════════════════════════════════════════════════════════════╗")
        if total_fail == 0:
            print(
                f"║  ✅ PHASE 4 STATUS: ALL TESTS PASSED ({total_pass}/15 checks)                  ║"
            )
        else:
            print(
                f"║  ⚠️  PHASE 4 STATUS: {overall:.0f}% PASSED ({total_pass}/{total_pass + total_fail})                        ║"
            )
        print(
            "╚════════════════════════════════════════════════════════════════════════════════╝\n"
        )


def main():
    print("⏳ Conectando a servidor Flask en http://localhost:5000...")
    print()

    tester = ResponsiveDeviceTester()
    tester.run_tests()


if __name__ == "__main__":
    main()
