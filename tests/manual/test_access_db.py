"""
Test script to verify backend is returning correct user access data
"""

import json
import sqlite3

db_path = "src/backend/core/data/spm.db"
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()

print("=== CHECKING USER ID2 ACCESS IN DATABASE ===\n")

# Check usuario_centros for user ID2
centros = cur.execute(
    "SELECT centro_id FROM usuario_centros WHERE usuario_id = ?", ("ID2",)
).fetchall()
centros_list = [c["centro_id"] for c in centros]
print(f"✅ Centros permitidos para ID2: {centros_list}")

# Check usuario_almacenes for user ID2
almacenes = cur.execute(
    "SELECT almacen_id FROM usuario_almacenes WHERE usuario_id = ?", ("ID2",)
).fetchall()
almacenes_list = [a["almacen_id"] for a in almacenes]
print(f"✅ Almacenes permitidos para ID2: {almacenes_list}")

# Simulate what the API should return
response = {"ok": True, "centros_permitidos": centros_list, "almacenes_permitidos": almacenes_list}
print(f"\n✅ API debería devolver:\n{json.dumps(response, indent=2)}")

con.close()
