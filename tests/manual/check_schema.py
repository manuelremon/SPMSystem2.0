import sqlite3

conn = sqlite3.connect("database/spm.db")
c = conn.cursor()
c.execute("PRAGMA table_info(usuarios)")
rows = c.fetchall()
print("Estructura de tabla usuarios:")
for r in rows:
    print(f"  {r[1]:20s} {r[2]:10s}")
conn.close()
