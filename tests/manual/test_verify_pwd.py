import sys

sys.path.insert(0, ".")
import sqlite3

from src.backend.core.config import Settings
from src.backend.services.db.security import verify_password

con = sqlite3.connect(Settings.DB_PATH)
con.row_factory = sqlite3.Row
cursor = con.cursor()

# Get user 1 password hash
cursor.execute("SELECT id_spm, nombre, contrasena FROM usuarios WHERE id_spm = '1'")
row = cursor.fetchone()
pwd_hash = row["contrasena"]

print(f"User: {row['nombre']} ({row['id_spm']})")
print(f"Hash: {pwd_hash[:50]}...")

# Test different passwords
passwords = ["admin", "admin123", "123456", "password", row["nombre"].lower()]

for pwd in passwords:
    valid, needs_rehash = verify_password(pwd_hash, pwd)
    status = "✅" if valid else "❌"
    print(f"{status} Testing '{pwd}': valid={valid}, needs_rehash={needs_rehash}")

con.close()
