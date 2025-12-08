"""
Tests for catalogos routes - Catalog services
Tests all endpoints in backend/routes/catalogos.py
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from backend.app import create_app
from backend.core.config import settings


def _db_path() -> Path:
    """Get test database path"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _seed_catalog_data():
    """Seed test catalog data"""
    conn = sqlite3.connect(_db_path())
    cur = conn.cursor()

    # Centros
    cur.execute("DELETE FROM catalog_centros")
    centros_data = [
        ("1001", "Centro Principal", 1),
        ("1002", "Centro Norte", 1),
        ("1003", "Centro Sur", 1),
        ("1004", "Centro Inactivo", 0),  # Inactive
    ]
    cur.executemany(
        "INSERT INTO catalog_centros (codigo, nombre, activo) VALUES (?, ?, ?)",
        centros_data,
    )

    # Sectores
    cur.execute("DELETE FROM catalog_sectores")
    sectores_data = [
        ("Mantenimiento", 1),
        ("Compras", 1),
        ("IT", 1),
        ("Finanzas", 1),
        ("Sector Inactivo", 0),  # Inactive
    ]
    cur.executemany(
        "INSERT INTO catalog_sectores (nombre, activo) VALUES (?, ?)",
        sectores_data,
    )

    # Almacenes
    cur.execute("DELETE FROM catalog_almacenes")
    almacenes_data = [
        ("ALM001", "Almacen Central", 1),
        ("ALM002", "Almacen Norte", 1),
        ("ALM003", "Almacen Sur", 1),
        ("ALM999", "Almacen Inactivo", 0),  # Inactive
    ]
    cur.executemany(
        "INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES (?, ?, ?)",
        almacenes_data,
    )

    # Usuarios
    cur.execute("DELETE FROM usuarios")
    usuarios_data = [
        ("user001", "Juan", "Perez", "juan@test.com", "Activo"),
        ("user002", "Maria", "Garcia", "maria@test.com", "Activo"),
        ("user003", "Pedro", "Lopez", "pedro@test.com", "Activo"),
        ("user004", "Ana", "Martinez", "ana@test.com", "Inactivo"),  # Inactive
    ]
    # Insert minimal user data
    for user_id, nombre, apellido, mail, estado in usuarios_data:
        cur.execute(
            """INSERT INTO usuarios
               (id_spm, nombre, apellido, mail, estado_registro, contrasena, rol, posicion, sector)
               VALUES (?, ?, ?, ?, ?, 'hash', 'Solicitante', 'Test', 'IT')""",
            (user_id, nombre, apellido, mail, estado),
        )

    conn.commit()
    conn.close()


@pytest.fixture
def app():
    """Create Flask app with test configuration"""
    app = create_app(config_override={"TESTING": True})

    with app.app_context():
        _seed_catalog_data()

    yield app


@pytest.fixture
def client(app):
    """Create test client"""
    with app.test_client() as testing_client:
        yield testing_client


# ==================== GET /catalogos ====================


def test_get_catalogos_combined(client):
    """Test getting all catalogs combined"""
    response = client.get("/api/catalogos")

    assert response.status_code == 200
    data = response.get_json()

    # Verify all catalogs are present
    assert "centros" in data
    assert "sectores" in data
    assert "almacenes" in data
    assert "usuarios" in data

    # Verify lists are not empty
    assert len(data["centros"]) > 0
    assert len(data["sectores"]) > 0
    assert len(data["almacenes"]) > 0
    assert len(data["usuarios"]) > 0


def test_get_catalogos_structure(client):
    """Test catalog data structure"""
    response = client.get("/api/catalogos")
    data = response.get_json()

    # Check centros structure
    centro = data["centros"][0]
    assert "id" in centro
    assert "nombre" in centro

    # Check sectores structure
    sector = data["sectores"][0]
    assert "id" in sector
    assert "nombre" in sector

    # Check almacenes structure
    almacen = data["almacenes"][0]
    assert "id" in almacen
    assert "nombre" in almacen

    # Check usuarios structure
    usuario = data["usuarios"][0]
    assert "id" in usuario
    assert "nombre" in usuario
    assert "mail" in usuario


def test_get_catalogos_only_active(client):
    """Test that only active items are returned"""
    response = client.get("/api/catalogos")
    data = response.get_json()

    # Verify inactive items are not included
    centro_codes = [c["id"] for c in data["centros"]]
    assert "1004" not in centro_codes  # Inactive center

    sector_names = [s["id"] for s in data["sectores"]]
    assert "Sector Inactivo" not in sector_names

    almacen_codes = [a["id"] for a in data["almacenes"]]
    assert "ALM999" not in almacen_codes

    usuario_ids = [u["id"] for u in data["usuarios"]]
    assert "user004" not in usuario_ids  # Inactive user


# ==================== GET /catalogos/centros ====================


def test_get_centros(client):
    """Test getting centros catalog"""
    response = client.get("/api/catalogos/centros")

    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) >= 3  # At least 3 active centros

    # Verify structure
    centro = data[0]
    assert "id" in centro
    assert "nombre" in centro
    assert centro["id"] in ["1001", "1002", "1003"]


def test_get_centros_caching(client):
    """Test that centros are cached properly"""
    # First request
    response1 = client.get("/api/catalogos/centros")
    data1 = response1.get_json()

    # Second request (should use cache)
    response2 = client.get("/api/catalogos/centros")
    data2 = response2.get_json()

    # Results should be identical
    assert data1 == data2


# ==================== GET /catalogos/sectores ====================


def test_get_sectores(client):
    """Test getting sectores catalog"""
    response = client.get("/api/catalogos/sectores")

    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) >= 4  # At least 4 active sectores

    # Verify structure
    sector = data[0]
    assert "id" in sector
    assert "nombre" in sector

    sector_names = [s["nombre"] for s in data]
    assert "Mantenimiento" in sector_names
    assert "Compras" in sector_names
    assert "Sector Inactivo" not in sector_names


# ==================== GET /catalogos/almacenes ====================


def test_get_almacenes(client):
    """Test getting almacenes catalog"""
    response = client.get("/api/catalogos/almacenes")

    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) >= 3  # At least 3 active almacenes

    # Verify structure
    almacen = data[0]
    assert "id" in almacen
    assert "nombre" in almacen

    almacen_codes = [a["id"] for a in data]
    assert "ALM001" in almacen_codes
    assert "ALM002" in almacen_codes
    assert "ALM999" not in almacen_codes  # Inactive


# ==================== GET /catalogos/usuarios ====================


def test_get_usuarios(client):
    """Test getting usuarios catalog"""
    response = client.get("/api/catalogos/usuarios")

    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    assert len(data) >= 3  # At least 3 active usuarios

    # Verify structure
    usuario = data[0]
    assert "id" in usuario
    assert "nombre" in usuario
    assert "mail" in usuario

    # Verify format
    assert " " in usuario["nombre"]  # Should be "Nombre Apellido"

    # Verify only active users
    user_ids = [u["id"] for u in data]
    assert "user001" in user_ids
    assert "user004" not in user_ids  # Inactive


def test_get_usuarios_full_name_format(client):
    """Test that user names are formatted as full names"""
    response = client.get("/api/catalogos/usuarios")
    data = response.get_json()

    # Find specific user
    juan = next((u for u in data if u["id"] == "user001"), None)
    assert juan is not None
    assert juan["nombre"] == "Juan Perez"
    assert juan["mail"] == "juan@test.com"


# ==================== Cache Behavior ====================


def test_catalog_cache_consistency(client):
    """Test that cached data remains consistent"""
    # Get all catalogs multiple times
    responses = [client.get("/api/catalogos") for _ in range(3)]

    # All responses should be identical
    data_sets = [r.get_json() for r in responses]
    assert data_sets[0] == data_sets[1] == data_sets[2]


# ==================== Edge Cases ====================


def test_catalogos_empty_database(client):
    """Test catalogs when database is empty"""
    # Clear all data
    conn = sqlite3.connect(_db_path())
    cur = conn.cursor()
    cur.execute("DELETE FROM catalog_centros")
    cur.execute("DELETE FROM catalog_sectores")
    cur.execute("DELETE FROM catalog_almacenes")
    cur.execute("DELETE FROM usuarios")
    conn.commit()
    conn.close()

    # Clear cache
    from backend.core.cache import catalog_cache

    catalog_cache.clear()

    response = client.get("/api/catalogos")

    assert response.status_code == 200
    data = response.get_json()

    # Should return empty lists, not fail
    assert data["centros"] == []
    assert data["sectores"] == []
    assert data["almacenes"] == []
    assert data["usuarios"] == []


def test_catalogos_individual_endpoints_consistency(client):
    """Test that individual endpoints match combined endpoint"""
    # Get combined
    combined = client.get("/api/catalogos").get_json()

    # Get individual
    centros = client.get("/api/catalogos/centros").get_json()
    sectores = client.get("/api/catalogos/sectores").get_json()
    almacenes = client.get("/api/catalogos/almacenes").get_json()
    usuarios = client.get("/api/catalogos/usuarios").get_json()

    # They should match
    assert combined["centros"] == centros
    assert combined["sectores"] == sectores
    assert combined["almacenes"] == almacenes
    assert combined["usuarios"] == usuarios


# ==================== Performance ====================


def test_catalogos_response_time(client):
    """Test that catalogs respond quickly (cache should help)"""
    import time

    start = time.time()
    response = client.get("/api/catalogos")
    elapsed = time.time() - start

    assert response.status_code == 200
    # Should be fast (under 1 second even without optimization)
    assert elapsed < 1.0

    # Second call should be even faster (cached)
    start = time.time()
    response = client.get("/api/catalogos")
    elapsed = time.time() - start

    assert response.status_code == 200
    assert elapsed < 0.5  # Should be very fast from cache
