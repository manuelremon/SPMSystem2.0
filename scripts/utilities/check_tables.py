import os
import sqlite3

db_path = "SPM/src/backend/spm.db"
if os.path.exists(db_path):
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    print("TABLAS EN LA BASE DE DATOS:")
    for t in tables:
        print(f"  - {t}")
    con.close()
else:
    print(f"Base de datos no encontrada en {db_path}")
