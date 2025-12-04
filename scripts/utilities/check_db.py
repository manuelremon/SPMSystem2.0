import sqlite3

# Conectar a la base de datos
conn = sqlite3.connect("database/spm.db")
cursor = conn.cursor()

# Ver todas las tablas
print("=== TABLAS EN LA BD ===")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
for table in tables:
    print(f"  - {table[0]}")
    # Ver columnas de cada tabla
    cursor.execute(f"PRAGMA table_info({table[0]})")
    cols = cursor.fetchall()
    for col in cols:
        print(f"      {col[1]}: {col[2]}")

conn.close()
