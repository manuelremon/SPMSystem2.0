import sqlite3

db_path = "src/backend/core/data/spm.db"
con = sqlite3.connect(db_path)
cur = con.cursor()

print("=== ESTRUCTURA DE TABLA usuarios ===\n")
info = cur.execute("PRAGMA table_info(usuarios)").fetchall()
for col in info:
    print(f"  {col}")

print("\n=== DATOS DE USUARIOS ===\n")
usuarios = cur.execute("SELECT * FROM usuarios LIMIT 3").fetchall()
for u in usuarios:
    print(u)

con.close()
