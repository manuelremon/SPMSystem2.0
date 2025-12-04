"""
Migration script to create usuario_centros and usuario_almacenes tables
and populate them with user access data
"""

import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
db_path = PROJECT_ROOT / "src/backend/core/data/spm.db"
con = sqlite3.connect(str(db_path))
cur = con.cursor()

print("=== CREATING TABLES ===")

# Create usuario_centros table
try:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS usuario_centros (
            usuario_id TEXT NOT NULL,
            centro_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (usuario_id, centro_id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id_spm),
            FOREIGN KEY (centro_id) REFERENCES catalog_centros(id)
        )
    """
    )
    print("✅ Created usuario_centros table")
except Exception as e:
    print(f"❌ Error creating usuario_centros: {e}")

# Create usuario_almacenes table
try:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS usuario_almacenes (
            usuario_id TEXT NOT NULL,
            almacen_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (usuario_id, almacen_id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id_spm),
            FOREIGN KEY (almacen_id) REFERENCES catalog_almacenes(id)
        )
    """
    )
    print("✅ Created usuario_almacenes table")
except Exception as e:
    print(f"❌ Error creating usuario_almacenes: {e}")

print("\n=== POPULATING WITH USER ACCESS DATA ===")

# For user ID2: allow centros 1008 and 1050
user_id = "ID2"
centros = [1008, 1050]

for centro_id in centros:
    try:
        cur.execute(
            "INSERT OR IGNORE INTO usuario_centros (usuario_id, centro_id) VALUES (?, ?)",
            (user_id, centro_id),
        )
        print(f"✅ Added access: {user_id} -> Centro {centro_id}")
    except Exception as e:
        print(f"❌ Error adding centro access: {e}")

# For almacenes, let's give access to common ones
# First, let's see what almacenes exist
almacenes = cur.execute("SELECT id FROM catalog_almacenes LIMIT 5").fetchall()
almacen_ids = [a[0] for a in almacenes]

print(f"\nAvailable almacenes: {almacen_ids}")
for almacen_id in almacen_ids:
    try:
        cur.execute(
            "INSERT OR IGNORE INTO usuario_almacenes (usuario_id, almacen_id) VALUES (?, ?)",
            (user_id, almacen_id),
        )
        print(f"✅ Added access: {user_id} -> Almacen {almacen_id}")
    except Exception as e:
        print(f"❌ Error adding almacen access: {e}")

con.commit()

print("\n=== VERIFICATION ===")

# Verify data
centros_access = cur.execute(
    "SELECT centro_id FROM usuario_centros WHERE usuario_id = ?", (user_id,)
).fetchall()
print(f"User {user_id} authorized centros: {[c[0] for c in centros_access]}")

almacenes_access = cur.execute(
    "SELECT almacen_id FROM usuario_almacenes WHERE usuario_id = ?", (user_id,)
).fetchall()
print(f"User {user_id} authorized almacenes: {[a[0] for a in almacenes_access]}")

con.close()
print("\n✅ Migration completed!")
