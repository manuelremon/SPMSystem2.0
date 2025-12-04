import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ver todas las tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
print("Tablas en BD:")
for table in tables:
    print(f"  {table[0]}")

cursor.close()
conn.close()
