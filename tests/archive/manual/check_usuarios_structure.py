import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ver columnas de usuarios
cursor.execute("PRAGMA table_info(usuarios)")
columns = cursor.fetchall()
print("Columnas de usuarios:")
for col in columns:
    print(f"  {col[1]} - {col[2]}")

cursor.close()
conn.close()
