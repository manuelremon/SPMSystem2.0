"""
Tests for mi_cuenta routes - User profile management
Tests all endpoints in backend_v2/routes/mi_cuenta.py
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import bcrypt
import pytest

from backend_v2.app import create_app
from backend_v2.core.config import settings
from backend_v2.routes.auth import generate_tokens


def _db_path() -> Path:
    """Get test database path"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _create_test_user(
    user_id: str, password: str = "password123", rol: str = "Solicitante", **kwargs
):
    """Create a test user in the database"""
    conn = sqlite3.connect(_db_path())
    cur = conn.cursor()

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    defaults = {
        "nombre": "Test",
        "apellido": "User",
        "mail": f"{user_id}@test.com",
        "telefono": "1234567890",
        "rol": rol,
        "posicion": "Developer",
        "sector": "IT",
        "centros": "1001",
        "almacenes": "ALM001",
        "estado_registro": "Activo",
        "jefe": None,
        "gerente1": None,
        "gerente2": None,
        "mail_respaldo": None,
    }
    defaults.update(kwargs)

    cur.execute(
        """INSERT OR REPLACE INTO usuarios
           (id_spm, contrasena, nombre, apellido, mail, telefono, rol, posicion,
            sector, centros, almacenes, estado_registro, jefe, gerente1, gerente2, mail_respaldo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            user_id,
            password_hash,
            defaults["nombre"],
            defaults["apellido"],
            defaults["mail"],
            defaults["telefono"],
            defaults["rol"],
            defaults["posicion"],
            defaults["sector"],
            defaults["centros"],
            defaults["almacenes"],
            defaults["estado_registro"],
            defaults["jefe"],
            defaults["gerente1"],
            defaults["gerente2"],
            defaults["mail_respaldo"],
        ),
    )
    conn.commit()
    conn.close()


def _get_auth_token(user_id: str) -> str:
    """Generate a valid JWT token for a user"""
    tokens = generate_tokens(user_id)
    return tokens["access_token"]


@pytest.fixture
def app():
    """Create Flask app with test configuration"""
    app = create_app(config_override={"TESTING": True})
    yield app


@pytest.fixture
def client(app):
    """Create test client"""
    with app.test_client() as testing_client:
        yield testing_client


@pytest.fixture
def auth_headers():
    """Create authenticated user and return auth headers"""
    _create_test_user("testuser1")
    token = _get_auth_token("testuser1")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers():
    """Create admin user and return auth headers"""
    _create_test_user("admin1", rol="Admin")
    token = _get_auth_token("admin1")
    return {"Authorization": f"Bearer {token}"}


# ==================== GET /mi-cuenta ====================


def test_get_mi_cuenta_success(client, auth_headers):
    """Test getting user profile successfully"""
    response = client.get("/api/mi-cuenta", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()

    assert "nombre_apellido" in data
    assert data["id_usuario_spm"] == "testuser1"
    assert data["mail"] == "testuser1@test.com"
    assert data["sector_actual"] == "IT"
    assert isinstance(data["centros_actuales"], list)
    assert isinstance(data["almacenes_actuales"], list)


def test_get_mi_cuenta_unauthorized(client):
    """Test getting profile without authentication"""
    response = client.get("/api/mi-cuenta")
    assert response.status_code == 401


def test_get_mi_cuenta_multiple_roles(client):
    """Test profile with multiple roles"""
    _create_test_user("multiuser", rol="Admin, Planificador, Solicitante")
    token = _get_auth_token("multiuser")

    response = client.get("/api/mi-cuenta", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.get_json()

    assert data["rol_spm"] == "Admin"  # First role
    assert "Admin" in data["roles"]
    assert "Planificador" in data["roles"]
    assert len(data["roles"]) == 3


# ==================== PUT /mi-cuenta/password ====================


def test_update_password_success(client, auth_headers):
    """Test password update successfully"""
    response = client.put(
        "/api/mi-cuenta/password",
        headers=auth_headers,
        json={
            "password_nueva": "newpassword123",
            "password_nueva_repetida": "newpassword123",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "actualizada" in data["message"].lower()


def test_update_password_too_short(client, auth_headers):
    """Test password update with short password"""
    response = client.put(
        "/api/mi-cuenta/password",
        headers=auth_headers,
        json={
            "password_nueva": "short",
            "password_nueva_repetida": "short",
        },
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["ok"] is False
    assert "8 caracteres" in data["error"]["message"]


def test_update_password_mismatch(client, auth_headers):
    """Test password update with mismatched passwords"""
    response = client.put(
        "/api/mi-cuenta/password",
        headers=auth_headers,
        json={
            "password_nueva": "newpassword123",
            "password_nueva_repetida": "differentpassword",
        },
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["ok"] is False
    assert "no coinciden" in data["error"]["message"]


def test_update_password_missing_fields(client, auth_headers):
    """Test password update with missing fields"""
    response = client.put(
        "/api/mi-cuenta/password",
        headers=auth_headers,
        json={"password_nueva": ""},
    )

    assert response.status_code == 400


# ==================== PUT /mi-cuenta/contacto ====================


def test_update_contacto_telefono(client, auth_headers):
    """Test updating phone number"""
    response = client.put(
        "/api/mi-cuenta/contacto",
        headers=auth_headers,
        json={"telefono": "9876543210"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "telefono" in data["updated"]


def test_update_contacto_mail_respaldo(client, auth_headers):
    """Test updating backup email"""
    response = client.put(
        "/api/mi-cuenta/contacto",
        headers=auth_headers,
        json={"mail_respaldo": "backup@test.com"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True


def test_update_contacto_both_fields(client, auth_headers):
    """Test updating both phone and backup email"""
    response = client.put(
        "/api/mi-cuenta/contacto",
        headers=auth_headers,
        json={
            "telefono": "9876543210",
            "mail_respaldo": "backup@test.com",
        },
    )

    assert response.status_code == 200


def test_update_contacto_empty_fields(client, auth_headers):
    """Test updating with no fields provided"""
    response = client.put(
        "/api/mi-cuenta/contacto",
        headers=auth_headers,
        json={},
    )

    assert response.status_code == 400


def test_update_contacto_invalid_telefono(client, auth_headers):
    """Test updating with invalid phone number"""
    response = client.put(
        "/api/mi-cuenta/contacto",
        headers=auth_headers,
        json={"telefono": "123"},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "inválido" in data["error"]["message"].lower()


# ==================== POST /mi-cuenta/solicitud-cambio-perfil ====================


def test_solicitar_cambio_perfil_success(client, auth_headers):
    """Test creating profile change request"""
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={
            "sector_nuevo": "Finanzas",
            "centros_nuevos": ["1002", "1003"],
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "id" in data
    assert "sector_nuevo" in data["campos_solicitados"]


def test_solicitar_cambio_perfil_all_fields(client, auth_headers):
    """Test profile change request with all fields"""
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={
            "sector_nuevo": "Finanzas",
            "centros_nuevos": ["1002"],
            "almacenes_nuevos": ["ALM002"],
            "jefe_nuevo": "jefe001",
            "gerente1_nuevo": "ger001",
            "gerente2_nuevo": "ger002",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert len(data["campos_solicitados"]) == 6


def test_solicitar_cambio_perfil_no_changes(client, auth_headers):
    """Test profile change request with no changes"""
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "al menos un cambio" in data["error"]["message"].lower()


# ==================== GET /mi-cuenta/solicitudes-cambio-perfil ====================


def test_listar_cambios_perfil_empty(client, auth_headers):
    """Test listing profile change requests when empty"""
    response = client.get("/api/mi-cuenta/solicitudes-cambio-perfil", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)


def test_listar_cambios_perfil_with_requests(client, auth_headers):
    """Test listing profile change requests with data"""
    # First create a request
    client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )

    # Then list
    response = client.get("/api/mi-cuenta/solicitudes-cambio-perfil", headers=auth_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert len(data) > 0
    assert "estado" in data[0]
    assert "campos" in data[0]


# ==================== POST /mi-cuenta/solicitudes-cambio-perfil/<id>/cancelar ====================


def test_cancelar_solicitud_cambio_success(client, auth_headers):
    """Test canceling a pending profile change request"""
    # Create request
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Cancel it
    response = client.post(
        f"/api/mi-cuenta/solicitudes-cambio-perfil/{request_id}/cancelar",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True


def test_cancelar_solicitud_not_found(client, auth_headers):
    """Test canceling non-existent request"""
    response = client.post(
        "/api/mi-cuenta/solicitudes-cambio-perfil/99999/cancelar",
        headers=auth_headers,
    )

    assert response.status_code == 404


# ==================== POST /mi-cuenta/solicitudes-cambio-perfil/<id>/mensaje ====================


def test_enviar_mensaje_solicitud_success(client, auth_headers, admin_headers):
    """Test sending message about profile request"""
    # Create admin first
    _create_test_user("admin1", rol="Admin")

    # Create request
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Send message
    response = client.post(
        f"/api/mi-cuenta/solicitudes-cambio-perfil/{request_id}/mensaje",
        headers=auth_headers,
        json={"mensaje": "Necesito urgente este cambio"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "mensaje_id" in data


def test_enviar_mensaje_solicitud_empty_message(client, auth_headers):
    """Test sending empty message"""
    # Create request
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Send empty message
    response = client.post(
        f"/api/mi-cuenta/solicitudes-cambio-perfil/{request_id}/mensaje",
        headers=auth_headers,
        json={"mensaje": ""},
    )

    assert response.status_code == 400


# ==================== ADMIN ENDPOINTS ====================


def test_admin_listar_profile_requests(client, admin_headers):
    """Test admin listing all profile requests"""
    response = client.get("/api/mi-cuenta/admin/profile-requests", headers=admin_headers)

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "requests" in data


def test_admin_listar_profile_requests_unauthorized(client, auth_headers):
    """Test non-admin cannot list profile requests"""
    response = client.get("/api/mi-cuenta/admin/profile-requests", headers=auth_headers)

    assert response.status_code == 403


def test_admin_listar_profile_requests_with_filter(client, admin_headers):
    """Test admin listing with status filter"""
    response = client.get(
        "/api/mi-cuenta/admin/profile-requests?estado=pendiente",
        headers=admin_headers,
    )

    assert response.status_code == 200


def test_admin_get_profile_request(client, admin_headers, auth_headers):
    """Test admin getting specific profile request"""
    # Create request as user
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Get as admin
    response = client.get(
        f"/api/mi-cuenta/admin/profile-requests/{request_id}",
        headers=admin_headers,
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "request" in data
    assert data["request"]["id"] == request_id


def test_admin_aprobar_profile_request(client, admin_headers, auth_headers):
    """Test admin approving profile request"""
    # Create request as user
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Approve as admin
    response = client.post(
        f"/api/mi-cuenta/admin/profile-requests/{request_id}/aprobar",
        headers=admin_headers,
        json={"comentario": "Aprobado"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True

    # Verify user profile was updated
    response = client.get("/api/mi-cuenta", headers=auth_headers)
    data = response.get_json()
    assert data["sector_actual"] == "Finanzas"


def test_admin_rechazar_profile_request(client, admin_headers, auth_headers):
    """Test admin rejecting profile request"""
    # Create request as user
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Reject as admin
    response = client.post(
        f"/api/mi-cuenta/admin/profile-requests/{request_id}/rechazar",
        headers=admin_headers,
        json={"motivo": "No cumple requisitos"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True


def test_admin_rechazar_without_motivo(client, admin_headers, auth_headers):
    """Test admin rejecting without reason"""
    # Create request
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Try to reject without motivo
    response = client.post(
        f"/api/mi-cuenta/admin/profile-requests/{request_id}/rechazar",
        headers=admin_headers,
        json={},
    )

    assert response.status_code == 400


def test_admin_enviar_mensaje_profile_request(client, admin_headers, auth_headers):
    """Test admin sending message to user about request"""
    # Create request as user
    response = client.post(
        "/api/mi-cuenta/solicitud-cambio-perfil",
        headers=auth_headers,
        json={"sector_nuevo": "Finanzas"},
    )
    request_id = response.get_json()["id"]

    # Send message as admin
    response = client.post(
        f"/api/mi-cuenta/admin/profile-requests/{request_id}/mensaje",
        headers=admin_headers,
        json={"mensaje": "Necesitamos más información"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
