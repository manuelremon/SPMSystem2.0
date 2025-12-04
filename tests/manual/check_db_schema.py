#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect("database/spm.db")
c = conn.cursor()

# List all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [row[0] for row in c.fetchall()]
print("TABLAS:")
for table in tables:
    print(f"  - {table}")

# Check usuarios table structure
print("\nESTRUCTURA TABLA 'usuarios':")
c.execute("PRAGMA table_info(usuarios)")
for col in c.fetchall():
    print(f"  {col}")

# Sample usuarios row
print("\nSAMPLE USUARIOS:")
c.execute("SELECT * FROM usuarios LIMIT 1")
col_names = [desc[0] for desc in c.description]
row = c.fetchone()
if row:
    for name, val in zip(col_names, row):
        print(f"  {name}: {val}")

conn.close()
