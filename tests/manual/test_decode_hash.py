import sys

sys.path.insert(0, ".")
import base64
import sqlite3

from src.backend.core.config import Settings

con = sqlite3.connect(Settings.DB_PATH)
con.row_factory = sqlite3.Row
cursor = con.cursor()

cursor.execute("SELECT id_spm, nombre, contrasena FROM usuarios WHERE id_spm = '1'")
row = cursor.fetchone()
pwd_hash = row["contrasena"]

print(f"User: {row['nombre']} ({row['id_spm']})")
print(f"Hash (base64): {pwd_hash}")
print(f"Length: {len(pwd_hash)}")

try:
    decoded = base64.b64decode(pwd_hash, validate=True)
    print(f"Decoded length: {len(decoded)} bytes")
    salt_len = 16
    salt = decoded[:salt_len]
    dig = decoded[salt_len:]
    print(f"Salt: {salt.hex()}")
    print(f"Digest: {dig.hex()}")
    print(f"Digest length: {len(dig)} bytes")
except Exception as e:
    print(f"ERROR decoding: {e}")

con.close()
