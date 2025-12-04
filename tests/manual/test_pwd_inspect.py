import sys

sys.path.insert(0, ".")
import sqlite3

from src.backend.core.config import Settings

con = sqlite3.connect(Settings.DB_PATH)
con.row_factory = sqlite3.Row
cursor = con.cursor()

cursor.execute("SELECT id_spm, nombre, contrasena FROM usuarios LIMIT 3")
for row in cursor.fetchall():
    pwd = row["contrasena"]
    print(f"User: {row['nombre']} ({row['id_spm']})")
    print(f"  Password: {pwd}")
    print(f"  Length: {len(pwd) if pwd else 0}")
    print()

con.close()
