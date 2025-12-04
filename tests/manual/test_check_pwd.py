import sqlite3
import sys

sys.path.insert(0, ".")
from src.backend.core.config import Settings

con = sqlite3.connect(Settings.DB_PATH)
con.row_factory = sqlite3.Row
cursor = con.cursor()

print("=== USUARIOS ===")
cursor.execute("SELECT id_spm, nombre, apellido, contrasena FROM usuarios")
for row in cursor.fetchall():
    pwd_hash = row["contrasena"][:50] if row["contrasena"] else "NONE"
    print(f"  {row['id_spm']}: {row['nombre']} {row['apellido']}")
    print(f"     Password hash: {pwd_hash}...")

con.close()
