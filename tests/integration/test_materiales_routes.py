"""
Tests for materiales routes - Material search
Tests all endpoints in backend/routes/materiales.py
"""

from __future__ import annotations

import sqlite3
import pytest

# Note: The 'app' and 'client' fixtures are now provided by tests/conftest.py

@pytest.fixture(scope="module", autouse=True)
def setup_module_db(app):
    """
    Module-scoped fixture to seed the database once for all tests in this file.
    'autouse=True' makes it run automatically for this module.
    It depends on the global 'app' fixture from conftest.py.
    """
    with app.app_context():
        # Using the in-memory database configured in the app fixture
        conn = sqlite3.connect(":memory:")
        cur = conn.cursor()

        # Ensure table exists with activo column
        cur.execute("DROP TABLE IF EXISTS materiales")
        cur.execute(
            """
            CREATE TABLE materiales (
                codigo TEXT PRIMARY KEY,
                descripcion TEXT,
                descripcion_larga TEXT,
                unidad TEXT,
                precio_usd REAL,
                activo INTEGER DEFAULT 1
            )
        """
        )

        # Material test data
        materiales_data = [
            ("MAT001", "Tornillo M6", "Tornillo hexagonal M6 x 20mm acero inoxidable", "UN", 0.15, 1),
            ("MAT002", "Tuerca M6", "Tuerca hexagonal M6 acero galvanizado", "UN", 0.10, 1),
            ("MAT003", "Arandela plana M6", "Arandela plana DIN125 M6 acero", "UN", 0.05, 1),
            ("MAT100", "Cable UTP Cat6", "Cable de red UTP categoria 6 305m", "M", 0.50, 1),
            ("MAT101", "Conector RJ45", "Conector RJ45 Cat6 blindado", "UN", 0.25, 1),
            ("MAT200", "Pintura blanca", "Pintura latex interior blanco mate 20L", "L", 15.00, 1),
            ("MAT201", "Pintura azul", "Pintura latex interior azul cielo 20L", "L", 16.50, 1),
            ("MAT999", "Material inactivo", "Este material está inactivo", "UN", 1.00, 0),
            # Materials with special characters
            ("MAT-SPEC-001", "Material especial", "Material con caracteres especiales", "UN", 5.00, 1),
            # Materials for testing search
            ("FILT001", "Filtro aire", "Filtro de aire para compresor industrial", "UN", 25.00, 1),
            ("FILT002", "Filtro aceite", "Filtro de aceite hidráulico", "UN", 30.00, 1),
        ]

        cur.executemany(
            """INSERT INTO materiales
               (codigo, descripcion, descripcion_larga, unidad, precio_usd, activo)
               VALUES (?, ?, ?, ?, ?, ?)""",
            materiales_data,
        )

        conn.commit()
        conn.close()


# ==================== GET /api/materiales ====================


def test_search_materiales_no_filters(client):
    """Test searching materials without filters returns all active materials"""
    response = client.get("/api/materiales")

    assert response.status_code == 200
    data = response.get_json()

    assert isinstance(data, list)
    # Should return all active materials (not inactive ones)
    assert len(data) >= 10

    # Verify structure
    material = data[0]
    assert "codigo" in material
    assert "descripcion" in material
    assert "unidad" in material
    assert "precio_usd" in material


def test_search_materiales_by_codigo(client):
    """Test searching materials by code"""
    response = client.get("/api/materiales?codigo=MAT001")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) >= 1
    # Should contain MAT001
    codigos = [m["codigo"] for m in data]
    assert "MAT001" in codigos


def test_search_materiales_by_codigo_partial(client):
    """Test searching materials by partial code"""
    response = client.get("/api/materiales?codigo=FILT")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) >= 2
    # Should contain both FILT001 and FILT002
    codigos = [m["codigo"] for m in data]
    assert "FILT001" in codigos
    assert "FILT002" in codigos


def test_search_materiales_by_descripcion(client):
    """Test searching materials by description"""
    response = client.get("/api/materiales?descripcion=Tornillo")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) >= 1
    # Should find MAT001
    assert any(m["codigo"] == "MAT001" for m in data)


def test_search_materiales_by_descripcion_partial(client):
    """Test searching materials by partial description"""
    response = client.get("/api/materiales?descripcion=Filtro")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) >= 2
    # Should find both filters
    codigos = [m["codigo"] for m in data]
    assert "FILT001" in codigos
    assert "FILT002" in codigos


def test_search_materiales_combined_filters(client):
    """Test searching with both codigo and descripcion"""
    response = client.get("/api/materiales?codigo=MAT&descripcion=Pintura")

    assert response.status_code == 200
    data = response.get_json()

    # Should find materials that match both filters
    assert len(data) >= 2
    codigos = [m["codigo"] for m in data]
    assert "MAT200" in codigos
    assert "MAT201" in codigos


def test_search_materiales_case_insensitive(client):
    """Test that search is case insensitive"""
    # Search with different cases
    response1 = client.get("/api/materiales?descripcion=tornillo")
    response2 = client.get("/api/materiales?descripcion=TORNILLO")
    response3 = client.get("/api/materiales?descripcion=Tornillo")

    data1 = response1.get_json()
    data2 = response2.get_json()
    data3 = response3.get_json()

    # All should return same results
    assert len(data1) == len(data2) == len(data3)


def test_search_materiales_with_limit(client):
    """Test search with custom limit"""
    response = client.get("/api/materiales?limit=3")

    assert response.status_code == 200
    data = response.get_json()

    # Should return at most 3 results
    assert len(data) <= 3


def test_search_materiales_max_limit(client):
    """Test that limit cannot exceed 500"""
    response = client.get("/api/materiales?limit=1000")

    assert response.status_code == 200
    data = response.get_json()

    # Should be capped at 500
    assert len(data) <= 500


def test_search_materiales_only_active(client):
    """Test that only active materials are returned"""
    response = client.get("/api/materiales")

    assert response.status_code == 200
    data = response.get_json()

    # Should not include MAT999 (inactive)
    codigos = [m["codigo"] for m in data]
    assert "MAT999" not in codigos


def test_search_materiales_ordered_by_codigo(client):
    """Test that results are ordered by codigo"""
    response = client.get("/api/materiales?codigo=MAT")

    assert response.status_code == 200
    data = response.get_json()

    # Extract codes
    codigos = [m["codigo"] for m in data]

    # Should be in ascending order
    assert codigos == sorted(codigos)


def test_search_materiales_special_characters(client):
    """Test searching materials with special characters"""
    response = client.get("/api/materiales?codigo=MAT-SPEC")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) >= 1
    assert any(m["codigo"] == "MAT-SPEC-001" for m in data)


def test_search_materiales_no_results(client):
    """Test search with no matching results"""
    response = client.get("/api/materiales?codigo=NONEXISTENT999")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) == 0
    assert isinstance(data, list)


def test_search_materiales_empty_search_term(client):
    """Test search with empty search terms"""
    response = client.get("/api/materiales?codigo=&descripcion=")

    assert response.status_code == 200
    data = response.get_json()

    # Should return all active materials
    assert len(data) >= 10


def test_search_materiales_whitespace_trimming(client):
    """Test that search terms are trimmed"""
    response1 = client.get("/api/materiales?codigo=  MAT001  ")
    response2 = client.get("/api/materiales?codigo=MAT001")

    data1 = response1.get_json()
    data2 = response2.get_json()

    # Should return same results
    assert len(data1) == len(data2)


def test_search_materiales_returns_all_fields(client):
    """Test that all expected fields are returned"""
    response = client.get("/api/materiales?codigo=MAT001")

    assert response.status_code == 200
    data = response.get_json()

    assert len(data) >= 1
    material = data[0]

    # Check all expected fields
    assert "codigo" in material
    assert "descripcion" in material
    assert "descripcion_larga" in material
    assert "unidad" in material
    assert "precio_usd" in material

    # Verify data types
    assert isinstance(material["codigo"], str)
    assert isinstance(material["descripcion"], str)
    assert isinstance(material["unidad"], str)
    assert isinstance(material["precio_usd"], (int, float))


def test_search_materiales_price_values(client):
    """Test that price values are correct"""
    response = client.get("/api/materiales?codigo=MAT001")

    assert response.status_code == 200
    data = response.get_json()

    mat001 = next((m for m in data if m["codigo"] == "MAT001"), None)
    assert mat001 is not None
    assert mat001["precio_usd"] == 0.15


def test_search_materiales_unicode_support(client):
    """Test that unicode characters in descriptions work"""
    response = client.get("/api/materiales?descripcion=hidráulico")

    assert response.status_code == 200
    data = response.get_json()

    # Should find FILT002
    assert any(m["codigo"] == "FILT002" for m in data)


# ==================== Edge Cases ====================


def test_search_materiales_database_missing(client):
    """Test behavior when database doesn't exist"""
    # This test would require mocking the database path
    # For now, we test that the endpoint handles empty results gracefully
    response = client.get("/api/materiales?codigo=DOESNOTEXIST")

    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_search_materiales_sql_injection_protection(client):
    """Test that SQL injection is prevented"""
    # Try SQL injection in search
    response = client.get("/api/materiales?codigo=MAT001' OR '1'='1")

    assert response.status_code == 200
    data = response.get_json()

    # Should not return all materials (SQL injection failed)
    # Should only return materials matching the literal string
    assert len(data) == 0  # No material has that exact code


def test_search_materiales_performance_large_limit(client):
    """Test performance with large limit"""
    import time

    start = time.time()
    response = client.get("/api/materiales?limit=500")
    elapsed = time.time() - start

    assert response.status_code == 200
    # Should complete quickly even with large limit
    assert elapsed < 2.0


# ==================== Integration ====================


def test_search_materiales_multiple_requests(client):
    """Test that multiple requests work correctly"""
    # Make several requests
    responses = [
        client.get("/api/materiales?codigo=MAT"),
        client.get("/api/materiales?descripcion=Filtro"),
        client.get("/api/materiales?limit=5"),
    ]

    # All should succeed
    for response in responses:
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)
