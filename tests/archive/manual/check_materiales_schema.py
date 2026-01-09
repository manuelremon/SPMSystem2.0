import sqlite3

con = sqlite3.connect("./src/backend/core/data/spm.db")
schema = con.execute("PRAGMA table_info(materiales)").fetchall()
print("Columnas de la tabla materiales:")
for col in schema:
    print(f"  {col[1]}: {col[2]}")

# Contar registros
count = con.execute("SELECT COUNT(*) FROM materiales").fetchone()[0]
print(f"\nTotal de registros: {count}")

# Ver primeros 3 registros
print("\nPrimeros 3 registros:")
rows = con.execute("SELECT * FROM materiales LIMIT 3").fetchall()
for row in rows:
    print(f"  {row}")

con.close()
