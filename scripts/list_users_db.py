import sqlite3

DB = "src/backend/core/data/spm.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()
print("DB:", DB)
try:
    rows = c.execute(
        "SELECT id_spm, nombre, apellido, rol, mail, contrasena FROM usuarios LIMIT 20"
    ).fetchall()
    print("Found", len(rows), "users")
    for r in rows:
        print(dict(r))
    row = c.execute(
        "SELECT id_spm, nombre FROM usuarios WHERE id_spm='2' OR id_spm='2' COLLATE NOCASE LIMIT 1"
    ).fetchone()
    if row:
        print("User 2 exists:", dict(row))
    else:
        print("User 2 not found")
except Exception as e:
    print("Error querying DB:", e)
finally:
    conn.close()
