import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ver datos del usuario admin
cursor.execute(
    """
    SELECT id_spm, nombre, apellido, rol, mail
    FROM usuarios
    WHERE id_spm LIKE '%admin%' OR rol LIKE '%admin%'
    LIMIT 5
"""
)

rows = cursor.fetchall()
print("Usuarios encontrados:")
for row in rows:
    print(f"  ID: {row[0]}, Nombre: {row[1]}, Apellido: {row[2]}, Rol: {row[3]}, Mail: {row[4]}")

cursor.close()
conn.close()
