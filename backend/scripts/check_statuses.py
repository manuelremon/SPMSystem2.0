
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))



def check_statuses():
    # Force connection to sap_data.db
    import sqlite3
    db_path = project_root / "data" / "sap_data.db"
    print(f"Connecting to {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    with conn:
        cur = conn.cursor()

        print("Tables in DB:")
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cur.fetchall()
        for t in tables:
            print(t['name'])

        if 'sap_solpeds' in [t['name'] for t in tables]:
            print("\nChecking distinct estrategia_liberacion in sap_solpeds:")
            cur.execute("SELECT DISTINCT estrategia_liberacion FROM sap_solpeds")
            rows = cur.fetchall()
            for row in rows:
                print(dict(row))
        else:
            print("sap_solpeds table not found!")

if __name__ == "__main__":
    check_statuses()
