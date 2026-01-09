import sqlite3

db_path = "src/backend/core/data/spm.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Obtener IDs de 3 solicitudes
cursor.execute(
    """
    SELECT id FROM solicitudes
    WHERE status = 'pendiente_de_aprobacion'
    LIMIT 3
"""
)
ids = [row[0] for row in cursor.fetchall()]

# Actualizar esas 3 solicitudes a pending_approval
if ids:
    placeholders = ",".join("?" * len(ids))
    cursor.execute(
        f"""
        UPDATE solicitudes
        SET status = 'pending_approval'
        WHERE id IN ({placeholders})
    """,
        ids,
    )
    print(f"Solicitudes actualizadas: {cursor.rowcount}")
else:
    print("No hay solicitudes para actualizar")

# Verificar
cursor.execute(
    """
    SELECT id, id_usuario, status, justificacion
    FROM solicitudes
    WHERE status = 'pending_approval'
    LIMIT 3
"""
)

rows = cursor.fetchall()
print("\nSolicitudes pending_approval:")
for row in rows:
    print(f"  ID: {row[0]}, Usuario: {row[1]}, Status: {row[2]}")
    print(f"    {row[3][:50]}...")

conn.commit()
cursor.close()
conn.close()
