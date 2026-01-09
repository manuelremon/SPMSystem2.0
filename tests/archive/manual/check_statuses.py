import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ver qué estados existen
cursor.execute("SELECT DISTINCT status FROM solicitudes LIMIT 20")
statuses = cursor.fetchall()
print("Estados en solicitudes:")
for status in statuses:
    print(f"  {status[0]}")

print()

# Contar por estado
cursor.execute("SELECT status, COUNT(*) FROM solicitudes GROUP BY status")
status_counts = cursor.fetchall()
print("Conteo por estado:")
for status, count in status_counts:
    print(f"  {status}: {count}")

cursor.close()
conn.close()
