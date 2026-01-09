"""
Configuracion global de pytest para SPM System.

Este archivo define fixtures centrales (app, client) para ser usados
en toda la suite de tests, promoviendo la reutilizacion y consistencia.
"""

import os
import sys
import pytest

# Configurar path al inicio de los tests
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from backend.app import create_app
from backend.core.config import settings

@pytest.fixture(scope='session')
def app():
    """
    Fixture que crea y configura una instancia de la aplicacion Flask para tests.
    - Se ejecuta una vez por sesion de tests.
    - Usa monkeypatch para forzar una base de datos en memoria.
    """
    # Usar una instancia manual de MonkeyPatch para un fixture de session.
    mp = pytest.MonkeyPatch()
    mp.setattr(settings, 'DATABASE_URL', 'sqlite:///:memory:')

    config_override = {
        "TESTING": True,
        "DATABASE_URL": settings.DATABASE_URL,
        "WTF_CSRF_ENABLED": False,
        "RATE_LIMIT_ENABLED": False,
    }
    app = create_app(config_override)

    with app.app_context():
        # Ahora que la app usa la BD en memoria, podemos inicializar el schema
        from backend.core.db import init_db
        init_db()

    yield app

    # Deshacer el parche al final de la sesion
    mp.undo()


@pytest.fixture()
def client(app):
    """
    Fixture que provee un cliente de test de Flask.
    - Se ejecuta para cada test que lo necesite.
    - Permite hacer requests a la app sin correr un servidor real.
    """
    return app.test_client()


@pytest.fixture()
def runner(app):
    """
    Fixture que provee un CLI runner de test de Flask.
    - Permite invocar comandos CLI registrados en la app.
    """
    return app.test_cli_runner()
