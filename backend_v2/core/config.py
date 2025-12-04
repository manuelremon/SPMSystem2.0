"""
Configuración centralizada para la aplicación Flask
"""

import os
import secrets
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


def _get_secret_key(env_var: str, env: str) -> str:
    """
    Obtiene clave secreta de forma segura:
    - En producción: REQUIERE variable de entorno (falla si no existe)
    - En desarrollo: Genera una clave aleatoria si no existe
    """
    value = os.getenv(env_var)
    if value:
        return value
    if env == "production":
        raise ValueError(
            f"SEGURIDAD: La variable de entorno {env_var} es REQUERIDA en producción. "
            f'Genera una con: python -c "import secrets; print(secrets.token_hex(32))"'
        )
    # Desarrollo: generar clave aleatoria (nueva en cada reinicio)
    return secrets.token_hex(32)


class Settings(BaseSettings):
    """Configuración de la aplicación"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # Entorno
    ENV: str = os.getenv("FLASK_ENV", "development")
    DEBUG: bool = ENV == "development"

    # Flask - Clave segura (requerida en producción)
    SECRET_KEY: str = ""

    # CORS - default value, can be overridden at init
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174"
    )

    # JWT - Clave segura (requerida en producción)
    JWT_SECRET_KEY: str = ""
    JWT_ACCESS_TOKEN_EXPIRES: int = 3600  # 1 hora
    JWT_REFRESH_TOKEN_EXPIRES: int = 604800  # 7 días
    JWT_COOKIE_SECURE: bool = ENV != "development"
    JWT_COOKIE_HTTPONLY: bool = True
    JWT_COOKIE_SAMESITE: str = "Lax"

    # Database (unificada) - resuelve siempre a backend_v2/spm.db
    _DEFAULT_DB = Path(__file__).resolve().parent.parent / "spm.db"
    DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB}"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/spm_backend.log"

    def get_cors_origins(self) -> List[str]:
        """Parse CORS_ORIGINS from comma-separated string"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS


# Crear instancia e inicializar claves seguras
settings = Settings()

# Inicializar claves secretas de forma segura
if not settings.SECRET_KEY:
    settings.SECRET_KEY = _get_secret_key("SECRET_KEY", settings.ENV)
if not settings.JWT_SECRET_KEY:
    settings.JWT_SECRET_KEY = _get_secret_key("JWT_SECRET_KEY", settings.ENV)
