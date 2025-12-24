"""
Push Notifications Configuration
================================
Configuracion de VAPID keys para Web Push API.

Las claves VAPID (Voluntary Application Server Identification) se usan para
identificar el servidor que envia las notificaciones push.
"""

import json
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

# Directorio donde se guardan las claves (subdirectorio 'vapid' para persistencia en Docker)
VAPID_KEYS_DIR = Path(__file__).parent.parent.parent / "data" / "vapid"
VAPID_PRIVATE_KEY_PATH = VAPID_KEYS_DIR / "vapid_private_key.pem"
VAPID_PUBLIC_KEY_PATH = VAPID_KEYS_DIR / "vapid_public_key.pem"
VAPID_CLAIMS_PATH = VAPID_KEYS_DIR / "vapid_claims.json"

# Email de contacto para VAPID (requerido por el estandar)
VAPID_CLAIMS = {"sub": "mailto:admin@spm.local"}


def _ensure_vapid_keys():
    """Genera claves VAPID si no existen."""
    VAPID_KEYS_DIR.mkdir(parents=True, exist_ok=True)

    if not VAPID_PRIVATE_KEY_PATH.exists():
        print("[PUSH] Generando nuevas claves VAPID...")

        # Generar par de claves EC usando cryptography directamente
        private_key = ec.generate_private_key(ec.SECP256R1())

        # Guardar clave privada en formato PEM
        pem_private = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        with open(VAPID_PRIVATE_KEY_PATH, "wb") as f:
            f.write(pem_private)

        # Guardar clave publica en formato PEM
        public_key = private_key.public_key()
        pem_public = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        with open(VAPID_PUBLIC_KEY_PATH, "wb") as f:
            f.write(pem_public)

        # Guardar claims
        with open(VAPID_CLAIMS_PATH, "w") as f:
            json.dump(VAPID_CLAIMS, f)

        print(f"[PUSH] Claves VAPID generadas en {VAPID_KEYS_DIR}")


def get_vapid_private_key() -> str:
    """Obtiene la clave privada VAPID en formato PEM."""
    _ensure_vapid_keys()
    with open(VAPID_PRIVATE_KEY_PATH, "r") as f:
        return f.read()


def _load_private_key():
    """Carga la clave privada desde el archivo PEM."""
    _ensure_vapid_keys()
    with open(VAPID_PRIVATE_KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def get_vapid_public_key() -> str:
    """
    Obtiene la clave publica VAPID en formato hex.
    """
    private_key = _load_private_key()
    public_key = private_key.public_key()
    # Obtener los bytes raw de la clave publica (formato uncompressed)
    raw_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962, format=serialization.PublicFormat.UncompressedPoint
    )
    return raw_bytes.hex()


def get_vapid_public_key_base64() -> str:
    """
    Obtiene la clave publica VAPID en formato base64url para el frontend.
    Este es el formato requerido por la Web Push API.
    """
    import base64

    private_key = _load_private_key()
    public_key = private_key.public_key()
    # Obtener los bytes raw de la clave publica (formato uncompressed)
    raw_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962, format=serialization.PublicFormat.UncompressedPoint
    )
    # Convertir a base64url sin padding
    return base64.urlsafe_b64encode(raw_bytes).rstrip(b"=").decode("utf-8")


def get_vapid_claims() -> dict:
    """Obtiene los claims VAPID."""
    _ensure_vapid_keys()
    if VAPID_CLAIMS_PATH.exists():
        with open(VAPID_CLAIMS_PATH, "r") as f:
            return json.load(f)
    return VAPID_CLAIMS


# Inicializar claves al importar el modulo
_ensure_vapid_keys()
