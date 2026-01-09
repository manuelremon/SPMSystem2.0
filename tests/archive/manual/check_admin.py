import json
import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ver datos del usuario admin
cursor.execute(
    """
    SELECT id, username, email, roles_data
    FROM usuarios
    WHERE username = 'admin'
    LIMIT 1
"""
)

row = cursor.fetchone()
if row:
    print("Usuario admin encontrado:")
    print(f"  ID: {row[0]}")
    print(f"  Username: {row[1]}")
    print(f"  Email: {row[2]}")
    print(f"  Roles: {row[3]}")

    # Parsear roles
    if row[3]:
        try:
            roles = json.loads(row[3])
            print(f"\n  Roles parseados: {roles}")
        except:
            print("  (No se pudo parsear)")
else:
    print("Usuario admin no encontrado")

# Ver catálogo de roles
print("\n\nRoles disponibles:")
cursor.execute("SELECT * FROM catalog_roles")
roles = cursor.fetchall()
for role in roles:
    print(f"  {role}")

cursor.close()
conn.close()
