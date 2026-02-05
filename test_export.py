import sys
sys.path.insert(0, 'C:/Users/MANUE/Documents/GitHub/SPMV3.0')

from backend.core.db import get_db_connection
from backend.services.reporting_service import ReportingService

try:
    # Testear conexión a BD
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuario'")
        result = cursor.fetchone()
        if result:
            print("✓ Tabla 'usuario' existe")
            # Ver columnas
            cursor.execute("PRAGMA table_info(usuario)")
            cols = cursor.fetchall()
            print(f"✓ Columnas: {[col[1] for col in cols]}")
        else:
            print("✗ Tabla 'usuario' NO existe")
            print("Tablas disponibles:")
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            for table in cursor.fetchall():
                print(f"  - {table[0]}")
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
