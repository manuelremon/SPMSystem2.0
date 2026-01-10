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

    # Render/Producción
    RENDER_SERVICE_URL: str = os.getenv("RENDER_SERVICE_URL", "http://localhost:5000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Flask - Clave segura (requerida en producción)
    SECRET_KEY: str = ""

    # CORS - Dinámico según entorno
    # Incluye: desarrollo local, GitHub Pages, y cualquier túnel de Cloudflare
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:4173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:4173,https://manuelremon.github.io,https://*.trycloudflare.com,https://*.loca.lt",
    )

    # JWT - Clave segura (requerida en producción)
    JWT_SECRET_KEY: str = ""
    JWT_ACCESS_TOKEN_EXPIRES: int = 3600  # 1 hora
    JWT_REFRESH_TOKEN_EXPIRES: int = 604800  # 7 días
    JWT_COOKIE_SECURE: bool = ENV != "development"
    JWT_COOKIE_HTTPONLY: bool = True
    JWT_COOKIE_SAMESITE: str = "Lax"

    # Database (unificada)
    # - Produccion: PostgreSQL via DATABASE_URL env var
    # - Desarrollo: SQLite en data/spm.db
    _PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # SPMv2.0/
    _DEFAULT_DB = _PROJECT_ROOT / "data" / "spm.db"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB}")

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/spm_backend.log"

    # Redis / Celery Configuration
    # - Producción: Redis via REDIS_URL env var
    # - Desarrollo: Sin Redis (fallback a cola en memoria)
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "") or os.getenv("REDIS_URL", "")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "") or os.getenv("REDIS_URL", "")
    CELERY_ENABLED: bool = os.getenv("CELERY_ENABLED", "false").lower() == "true"

    # SMTP Email Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "SPM Notificaciones <noreply@planifica-materiales.com>")
    SMTP_ENABLED: bool = os.getenv("SMTP_ENABLED", "false").lower() == "true"

    def get_cors_origins(self) -> List[str]:
        r"""Parse CORS_ORIGINS from comma-separated string

        Soporta wildcards para subdominios usando regex:
        - https://*.trycloudflare.com -> r"https://.*\.trycloudflare\.com"
        """
        import re

        if isinstance(self.CORS_ORIGINS, str):
            origins = []
            for origin in self.CORS_ORIGINS.split(","):
                origin = origin.strip()
                if "*" in origin:
                    # Convertir wildcard a regex pattern ANCLADO (evita bypass con sufijos)
                    # ^https://.*\.trycloudflare\.com$ solo coincide con subdominios exactos
                    pattern = "^" + origin.replace(".", r"\.").replace("*", "[^/]*") + "$"
                    origins.append(re.compile(pattern))
                else:
                    origins.append(origin)
            return origins
        return self.CORS_ORIGINS


# Crear instancia e inicializar claves seguras
settings = Settings()

# Inicializar claves secretas de forma segura
if not settings.SECRET_KEY:
    settings.SECRET_KEY = _get_secret_key("SECRET_KEY", settings.ENV)
if not settings.JWT_SECRET_KEY:
    settings.JWT_SECRET_KEY = _get_secret_key("JWT_SECRET_KEY", settings.ENV)
