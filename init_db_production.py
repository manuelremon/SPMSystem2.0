#!/usr/bin/env python3
"""
Script para inicializar la BD en producción
Crea tablas y datos iniciales si no existen
"""

import os
import sqlite3
import sys
from pathlib import Path

# Agregar directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend_v2.app import create_app
from backend_v2.core.config import settings
from backend_v2.core.db import init_db, db

def init_production_database():
    """Inicializar BD de producción"""
    print(f"[INIT] Entorno: {settings.ENV}")
    print(f"[INIT] BD: {settings.DATABASE_URL}")
    
    # Crear app
    app = create_app()
    
    with app.app_context():
        try:
            # Inicializar BD (crea tablas)
            print("[INIT] Inicializando tablas...")
            init_db()
            print("[INIT] ✓ Tablas inicializadas")
            
            # Crear usuario admin por defecto si no existe
            conn = sqlite3.connect(str(Path(settings.DATABASE_URL.split("///", 1)[1])))
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM usuarios WHERE id_spm = ?", ("admin",))
            if cursor.fetchone()[0] == 0:
                print("[INIT] Creando usuario admin...")
                cursor.execute("""
                    INSERT INTO usuarios (id_spm, mail, contrasena, nombre, apellido, rol)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    "admin",
                    "admin@spm.local",
                    "a1",  # Password plana para producción (cambiar!)
                    "Admin",
                    "SPM",
                    "Admin"
                ))
                conn.commit()
                print("[INIT] ✓ Usuario admin creado")
            
            conn.close()
            print("[INIT] ✓ Base de datos inicializada correctamente")
            return True
            
        except Exception as e:
            print(f"[ERROR] Error inicializando BD: {e}")
            return False

if __name__ == "__main__":
    success = init_production_database()
    sys.exit(0 if success else 1)
