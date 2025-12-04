import sqlite3

con = sqlite3.connect("database/spm.db")
cursor = con.cursor()

# Get all solicitudes
cursor.execute(
    "SELECT id, id_usuario, centro, sector, status, total_monto FROM solicitudes ORDER BY id DESC LIMIT 5"
)
rows = cursor.fetchall()
print("LATEST SOLICITUDES:")
for row in rows:
    print(
        f"ID: {row[0]}, Usuario: {row[1]}, Centro: {row[2]}, Sector: {row[3]}, Status: {row[4]}, Total: {row[5]}"
    )

con.close()
