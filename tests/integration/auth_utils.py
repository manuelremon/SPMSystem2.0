from __future__ import annotations

from datetime import datetime, timedelta

import jwt
from flask import Flask
from flask.testing import FlaskClient


def login_as(client: FlaskClient, username: str, password: str):
    """Perform a login request in tests and return the response."""
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    return response


def mint_access_token(app: Flask, user_id: str, roles: list = None, **extra_claims) -> str:
    """Mint a signed access token for the given user id."""
    from backend.core.config import settings

    now = datetime.utcnow()
    payload = {
        "user_id": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=settings.JWT_ACCESS_TOKEN_EXPIRES),
    }
    if roles:
        payload["roles"] = roles
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def authenticate_client(app: Flask, client: FlaskClient, user_id: str, roles: list = None, **extra_claims) -> None:
    """Attach a valid access token to the provided test client."""
    with app.app_context():
        token = mint_access_token(app, user_id, roles=roles, **extra_claims)
        client.set_cookie("access_token", token, path="/")
