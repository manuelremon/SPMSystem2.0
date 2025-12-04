import sqlite3

conn = sqlite3.connect("backend_v2/spm.db")
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [row[0] for row in cursor.fetchall()]
for t in tables:
    print(t)
conn.close()
