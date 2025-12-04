import sqlite3

conn = sqlite3.connect(
    r"d:\GitHub\SPM version robusta no anda login 2 dias\SPM\SPM\src\backend\core\data\spm.db"
)
c = conn.cursor()
rows = c.execute("PRAGMA table_info(solicitudes)").fetchall()
for row in rows:
    print(row)
conn.close()
