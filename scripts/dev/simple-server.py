#!/usr/bin/env python3
"""
Servidor HTTP simple para servir los HTML estáticos desde src/frontend.
Útil cuando Vite no está disponible o se necesita una verificación rápida
de rutas limpias.
"""

import http.server
import os
import socketserver
from pathlib import Path
from typing import Optional

DEFAULT_PORT = 8080


def _resolve_frontend_dir() -> Path:
    """Descubre la carpeta src/frontend sin importar desde dónde se ejecute."""
    env_dir = os.getenv("SPM_FRONTEND_DIR")
    if env_dir:
        candidate = Path(env_dir).expanduser().resolve()
        if candidate.is_dir():
            return candidate
    repo_root: Path = Path(__file__).resolve().parents[2]
    candidate = repo_root / "src" / "frontend"
    if candidate.is_dir():
        return candidate
    raise SystemExit(
        f"[ERROR] No se encontró la carpeta frontend en {candidate}. "
        "Define SPM_FRONTEND_DIR si está en otra ubicación."
    )


FRONTEND_DIR = _resolve_frontend_dir()
PORT = int(os.getenv("SPM_SIMPLE_SERVER_PORT", DEFAULT_PORT))


class CleanRouteHandler(http.server.SimpleHTTPRequestHandler):
    """Sirve rutas limpias /dashboard -> dashboard.html"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def _resolve_clean_route(self) -> Optional[Path]:
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if not path.startswith("/"):
            return None
        last_segment = path.rstrip("/").split("/")[-1]
        if "." in last_segment:
            return None
        segment = "index" if path in ("/", "") else path.lstrip("/")
        html_file = FRONTEND_DIR / f"{segment}.html"
        return html_file if html_file.exists() else None

    def do_GET(self):
        html_file = self._resolve_clean_route()
        if html_file:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            with open(html_file, "rb") as file_obj:
                self.wfile.write(file_obj.read())
            return
        super().do_GET()


def _print_banner():
    print(f"\n{'=' * 60}")
    print(f"Servidor HTTP en puerto {PORT}".center(60))
    print(f"{'=' * 60}")
    print(f"\nSirviendo desde: {FRONTEND_DIR}")
    print(f"URL: http://localhost:{PORT}/")
    print("\nRutas disponibles:")
    for html_file in sorted(FRONTEND_DIR.glob("*.html")):
        print(f"  http://localhost:{PORT}/{html_file.stem}")
    print("\nPresiona Ctrl+C para detener\n")


if __name__ == "__main__":
    os.chdir(FRONTEND_DIR)
    _print_banner()
    with socketserver.TCPServer(("", PORT), CleanRouteHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServidor detenido")
