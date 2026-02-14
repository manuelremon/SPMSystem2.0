
import sys
import os
import bcrypt

# Add project root to sys.path
sys.path.append(os.getcwd())

from backend.core.db import get_db_connection

def reset_all_passwords(new_password):
    print(f"--- Resetting all passwords to: {new_password} ---")
    
    # Generate bcrypt hash
    # Note: frontend/auth logic requires $2b$ or $2a$ prefix
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    print(f"Generated hash: {hashed}")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Count users before update
            cursor.execute("SELECT COUNT(*) FROM usuario")
            row = cursor.fetchone()
            # Handle different return types (dict vs tuple) from get_db_connection wrapper
            if isinstance(row, dict):
                count = list(row.values())[0]
            else:
                count = row[0]
            
            print(f"Found {count} users.")
            
            # Update all users
            cursor.execute("UPDATE usuario SET contrasena = ?", (hashed,))
            conn.commit()
            
            print(f"Successfully updated password for {count} users.")
            
    except Exception as e:
        print(f"Error updating database: {e}")
        raise

if __name__ == "__main__":
    reset_all_passwords("8300_@")
