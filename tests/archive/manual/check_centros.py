import json
import sqlite3

db_path = "src/backend/core/data/spm.db"
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row

print("=== CHECKING catalog_centros STRUCTURE ===\n")

# Check the structure
info = con.execute("PRAGMA table_info(catalog_centros)").fetchall()
print("Columns:")
for col in info:
    print(f"  {col[1]}: {col[2]}")

print("\n=== SAMPLE DATA FROM catalog_centros ===\n")
centros = con.execute("SELECT * FROM catalog_centros WHERE id IN (1008, 1050) LIMIT 2").fetchall()
for c in centros:
    print(json.dumps(dict(c), indent=2, default=str))

con.close()
