import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Obtener información de la tabla solicitudes
cursor.execute("PRAGMA table_info(solicitudes)")
columns = cursor.fetchall()
print("Columnas de solicitudes:")
for col in columns:
    print(f"  {col[1]} - {col[2]}")

print()
print("Solicitudes con estado pending_approval:")
cursor.execute(
    """
    SELECT id, id_usuario, status, justificacion, created_at, aprobador_id
    FROM solicitudes
    WHERE status = 'pending_approval'
    ORDER BY id DESC
    LIMIT 5
"""
)

rows = cursor.fetchall()
print(f"Total: {len(rows)}")
for row in rows:
    print(f"  ID: {row[0]}, Usuario: {row[1]}, Status: {row[2]}, Aprobador: {row[5]}")

cursor.close()
conn.close()
