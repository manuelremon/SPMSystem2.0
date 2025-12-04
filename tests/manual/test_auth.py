#!/usr/bin/env python
"""Debug script para probar autenticación"""

import sys

sys.path.insert(0, ".")

from src.backend.services.auth.auth import authenticate_user

print("=== PRUEBA DE AUTENTICACIÓN ===")

try:
    user = authenticate_user("1", "admin")
    if user:
        print(f"✅ LOGIN EXITOSO para usuario {user.get('id')}")
        print(f"   Nombre: {user.get('nombre')} {user.get('apellido')}")
        print(f"   Email: {user.get('mail')}")
        print(f"   Rol: {user.get('rol')}")
    else:
        print("❌ Login FALLÓ - credenciales inválidas")
except Exception as e:
    import traceback

    print(f"❌ ERROR: {e}")
    traceback.print_exc()
