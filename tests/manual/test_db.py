import sqlite3
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, ".")

from src.backend.core.config import Settings

print(f"DB Path: {Settings.DB_PATH}")
print(f"DB Exists: {Path(Settings.DB_PATH).exists()}")
print(f"DB Size: {Path(Settings.DB_PATH).stat().st_size} bytes")

try:
    con = sqlite3.connect(Settings.DB_PATH)
    cursor = con.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"\nTablas ({len(tables)}):")
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
        count = cursor.fetchone()[0]
        print(f"  - {table[0]}: {count} registros")
    con.close()
except Exception as e:
    print(f"ERROR: {e}")
