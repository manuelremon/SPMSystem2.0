import sqlite3

db_path = "src/backend/core/data/spm.db"
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()

# Check if table exists
print("=== CHECKING TABLE STRUCTURE ===")
tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print(f"Tables: {[t['name'] for t in tables]}")

# Check usuario_centros data
print("\n=== usuario_centros DATA ===")
try:
    rows = cur.execute("SELECT * FROM usuario_centros").fetchall()
    print(f"Total rows: {len(rows)}")
    for row in rows[:10]:
        print(dict(row))
except Exception as e:
    print(f"ERROR: {e}")

# Check usuario_almacenes data
print("\n=== usuario_almacenes DATA ===")
try:
    rows = cur.execute("SELECT * FROM usuario_almacenes").fetchall()
    print(f"Total rows: {len(rows)}")
    for row in rows[:10]:
        print(dict(row))
except Exception as e:
    print(f"ERROR: {e}")

# Check USER 2 specifically
print("\n=== USER ID2 DATA ===")
try:
    usuario_rows = cur.execute("SELECT * FROM usuarios WHERE id_spm = 'ID2'").fetchall()
    for row in usuario_rows:
        print(f"Usuario: {dict(row)}")
except Exception as e:
    print(f"ERROR: {e}")

# Check catalog_centros
print("\n=== catalog_centros (first 5) ===")
try:
    centros = cur.execute("SELECT * FROM catalog_centros LIMIT 5").fetchall()
    for row in centros:
        print(dict(row))
except Exception as e:
    print(f"ERROR: {e}")

con.close()
