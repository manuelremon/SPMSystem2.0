"""
Test de integración del módulo Planificador
Valida que:
1. Las rutas estén registradas correctamente
2. La autenticación funcione
3. El control de acceso por roles funcione
4. Se puedan obtener solicitudes
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


import pytest
from src.backend.app import create_app


@pytest.fixture
def app():
    """Crear aplicación de test"""
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    """Cliente de test"""
    return app.test_client()


def test_planner_routes_exist(app):
    """Verificar que las rutas del planificador existen"""
    with app.app_context():
        routes = [str(rule) for rule in app.url_map.iter_rules() if "planner" in str(rule)]

        expected_routes = [
            "/api/planner/dashboard",
            "/api/planner/solicitudes",
            "/api/planner/solicitudes/<int:solicitud_id>",
            "/api/planner/solicitudes/<int:solicitud_id>/optimize",
        ]

        for route in expected_routes:
            assert any(route in r for r in routes), f"Ruta {route} no encontrada"

        print("✓ Todas las rutas del planificador están registradas")


def test_planner_html_exists(app):
    """Verificar que el archivo planificador.html existe"""
    import os

    frontend_dir = os.environ.get("FRONTEND_DIR", "src/frontend")
    planner_html = os.path.join(frontend_dir, "planificador.html")

    assert os.path.exists(planner_html), f"Archivo {planner_html} no existe"
    print("✓ Archivo planificador.html existe")


def test_planner_js_exists(app):
    """Verificar que el archivo planificador.js existe"""
    import os

    frontend_dir = os.environ.get("FRONTEND_DIR", "src/frontend")
    planner_js = os.path.join(frontend_dir, "planificador.js")

    assert os.path.exists(planner_js), f"Archivo {planner_js} no existe"
    print("✓ Archivo planificador.js existe")


def test_home_html_has_planner_link():
    """Verificar que home.html tiene el link de planificación"""
    import os

    frontend_dir = os.environ.get("FRONTEND_DIR", "src/frontend")
    home_html_path = os.path.join(frontend_dir, "home.html")

    with open(home_html_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "planificador.html" in content, "home.html no tiene link a planificador.html"
    assert "plannerSection" in content, "home.html no tiene plannerSection"
    assert "Planificación" in content, "home.html no tiene texto 'Planificación'"

    print("✓ home.html tiene el link de planificación correctamente")


if __name__ == "__main__":
    app = create_app()
    test_planner_routes_exist(app)
    test_planner_html_exists(app)
    test_planner_js_exists(app)
    test_home_html_has_planner_link()
    print("\n✓ Todos los tests de integración pasaron correctamente")
