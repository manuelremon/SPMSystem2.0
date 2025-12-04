from src.backend.app import app as flask_app
from src.backend.db import get_db
from src.backend.security import hash_password


def _seed_user():
    with flask_app.app_context():
        db = get_db()
        db.execute(
            """
            INSERT OR REPLACE INTO usuarios (
                id_spm, nombre, apellido, rol, contrasena, sector, centros, posicion,
                mail, telefono, id_ypf, jefe, gerente1, gerente2
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                "u",
                "Test",
                "User",
                "user",
                hash_password("p@ssw0rd!"),
                "",
                "",
                "",
                "test@example.com",
                "",
                "",
                "",
                "",
                "",
            ),
        )
        db.commit()


def test_me_requires_cookie():
    client = flask_app.test_client()
    rv = client.get("/api/auth/me")
    assert rv.status_code == 401


def test_login_me_logout_cycle():
    _seed_user()
    client = flask_app.test_client()
    rv = client.post("/api/auth/login", json={"username": "u", "password": "p@ssw0rd!"})
    assert rv.status_code == 200
    cookie = rv.headers.get("Set-Cookie")
    rv2 = client.get("/api/auth/me", headers={"Cookie": cookie})
    assert rv2.status_code == 200
    rv3 = client.post("/api/auth/logout", headers={"Cookie": cookie})
    assert rv3.status_code == 200
    rv4 = client.get("/api/auth/me", headers={"Cookie": cookie})
    assert rv4.status_code == 401
