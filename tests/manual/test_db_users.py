import sqlite3

from src.backend.core.config import Settings

con = sqlite3.connect(Settings.DB_PATH)
con.row_factory = sqlite3.Row
cursor = con.cursor()

print("=== USUARIOS ===")
cursor.execute("SELECT id_spm, nombre, apellido, mail, rol FROM usuarios LIMIT 5")
for row in cursor.fetchall():
    print(f"  {row['id_spm']}: {row['nombre']} {row['apellido']} - {row['mail']} ({row['rol']})")

print("\n=== MATERIALES (primeros 3) ===")
cursor.execute("SELECT codigo, descripcion FROM materiales LIMIT 3")
for row in cursor.fetchall():
    print(f"  {row['codigo']}: {row['descripcion']}")

con.close()
print("\n✅ BD accesible y con datos")
