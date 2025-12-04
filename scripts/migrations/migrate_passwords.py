#!/usr/bin/env python3
"""
Script de migración de contraseñas a bcrypt

Este script detecta contraseñas en texto plano en la base de datos
y las convierte a hashes bcrypt seguros.

Uso:
    python scripts/migrations/migrate_passwords.py [--dry-run] [--verbose]

Opciones:
    --dry-run   Muestra qué usuarios se migrarían sin hacer cambios
    --verbose   Muestra información detallada durante la migración
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

# Agregar backend_v2 al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    import bcrypt
except ImportError:
    print("ERROR: bcrypt no está instalado. Ejecuta: pip install bcrypt")
    sys.exit(1)


def get_db_path():
    """Obtiene la ruta de la base de datos"""
    # Intentar desde variable de entorno
    db_path = os.getenv("SPM_DB_PATH")
    if db_path and os.path.exists(db_path):
        return db_path

    # Ruta por defecto para backend_v2
    base_dir = Path(__file__).parent.parent.parent
    default_path = base_dir / "backend_v2" / "spm.db"
    if default_path.exists():
        return str(default_path)

    # Buscar en spm_staging.db
    staging_path = base_dir / "spm_staging.db"
    if staging_path.exists():
        return str(staging_path)

    # Buscar en instance/
    instance_path = base_dir / "instance" / "spm.db"
    if instance_path.exists():
        return str(instance_path)

    raise FileNotFoundError(
        "No se encontró la base de datos. "
        "Establece SPM_DB_PATH o verifica que existe backend_v2/spm.db"
    )


def is_bcrypt_hash(password: str) -> bool:
    """Verifica si una contraseña ya es un hash bcrypt"""
    if not password:
        return False
    return password.startswith("$2b$") or password.startswith("$2a$") or password.startswith("$2y$")


def hash_password(plain_password: str) -> str:
    """Genera un hash bcrypt de la contraseña"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def migrate_passwords(dry_run: bool = False, verbose: bool = False):
    """
    Migra contraseñas en texto plano a bcrypt

    Args:
        dry_run: Si es True, solo muestra que se haria sin hacer cambios
        verbose: Si es True, muestra informacion detallada
    """
    db_path = get_db_path()
    print(f"Base de datos: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Obtener todos los usuarios
    cursor.execute(
        """
        SELECT id_spm, mail, nombre, apellido, contrasena
        FROM usuarios
        WHERE contrasena IS NOT NULL AND contrasena != ''
    """
    )
    users = cursor.fetchall()

    total_users = len(users)
    plaintext_users = []
    bcrypt_users = []

    print(f"\nAnalizando {total_users} usuarios...")

    for user in users:
        user_id = user["id_spm"]
        mail = user["mail"] or "sin-email"
        nombre = f"{user['nombre'] or ''} {user['apellido'] or ''}".strip() or "Sin nombre"
        password = user["contrasena"]

        if is_bcrypt_hash(password):
            bcrypt_users.append(user_id)
            if verbose:
                print(f"  [OK] {mail} ({nombre}) - Ya tiene bcrypt")
        else:
            plaintext_users.append(
                {"id_spm": user_id, "mail": mail, "nombre": nombre, "password": password}
            )
            if verbose:
                print(f"  [!!] {mail} ({nombre}) - Texto plano detectado")

    print("\nResultados del analisis:")
    print(f"  - Usuarios con bcrypt: {len(bcrypt_users)}")
    print(f"  - Usuarios con texto plano: {len(plaintext_users)}")

    if not plaintext_users:
        print("\n[OK] Todas las contrasenas ya estan hasheadas con bcrypt!")
        conn.close()
        return

    print("\nUsuarios a migrar:")
    for user in plaintext_users:
        # Mostrar solo primeros 3 caracteres de la contrasena por seguridad
        pwd_preview = user["password"][:3] + "***" if len(user["password"]) > 3 else "***"
        print(f"  - {user['mail']} ({user['nombre']}) - pwd: {pwd_preview}")

    if dry_run:
        print("\n[DRY-RUN] No se realizaron cambios.")
        conn.close()
        return

    # Confirmar migracion
    print("\n" + "=" * 60)
    response = input("Deseas migrar estas contrasenas a bcrypt? (s/N): ")
    if response.lower() not in ["s", "si", "y", "yes"]:
        print("Migracion cancelada.")
        conn.close()
        return

    # Realizar migracion
    print("\nMigrando contrasenas...")
    migrated = 0
    errors = 0

    for user in plaintext_users:
        try:
            new_hash = hash_password(user["password"])
            cursor.execute(
                "UPDATE usuarios SET contrasena = ? WHERE id_spm = ?", (new_hash, user["id_spm"])
            )
            migrated += 1
            if verbose:
                print(f"  [OK] {user['mail']} migrado exitosamente")
        except Exception as e:
            errors += 1
            print(f"  [ERROR] Error migrando {user['mail']}: {e}")

    conn.commit()
    conn.close()

    print(f"\n{'=' * 60}")
    print("Migracion completada:")
    print(f"  - Usuarios migrados: {migrated}")
    print(f"  - Errores: {errors}")

    if errors == 0:
        print("\n[OK] Todas las contrasenas fueron migradas exitosamente!")
        print("   Los usuarios ahora pueden iniciar sesion con sus contrasenas originales.")
    else:
        print("\n[WARN] Algunos usuarios no pudieron ser migrados. Revisa los errores.")


def main():
    parser = argparse.ArgumentParser(description="Migra contrasenas en texto plano a bcrypt")
    parser.add_argument(
        "--dry-run", action="store_true", help="Solo muestra que se haria, sin hacer cambios"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Muestra informacion detallada"
    )
    parser.add_argument(
        "--auto", action="store_true", help="Ejecuta la migracion sin pedir confirmacion"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("  MIGRACION DE CONTRASENAS A BCRYPT")
    print("=" * 60)

    if args.auto and not args.dry_run:
        # Modificar migrate_passwords para no pedir confirmacion
        migrate_passwords_auto(args.verbose)
    else:
        migrate_passwords(dry_run=args.dry_run, verbose=args.verbose)


def migrate_passwords_auto(verbose: bool = False):
    """Version automatica sin confirmacion interactiva"""
    db_path = get_db_path()
    print(f"Base de datos: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id_spm, mail, nombre, apellido, contrasena
        FROM usuarios
        WHERE contrasena IS NOT NULL AND contrasena != ''
    """
    )
    users = cursor.fetchall()

    plaintext_users = []

    for user in users:
        password = user["contrasena"]
        if not is_bcrypt_hash(password):
            plaintext_users.append(
                {
                    "id_spm": user["id_spm"],
                    "mail": user["mail"] or "sin-email",
                    "password": password,
                }
            )

    if not plaintext_users:
        print("\n[OK] Todas las contrasenas ya estan hasheadas con bcrypt!")
        conn.close()
        return

    print(f"\nMigrando {len(plaintext_users)} contrasenas...")
    migrated = 0

    for user in plaintext_users:
        try:
            new_hash = hash_password(user["password"])
            cursor.execute(
                "UPDATE usuarios SET contrasena = ? WHERE id_spm = ?", (new_hash, user["id_spm"])
            )
            migrated += 1
            if verbose:
                print(f"  [OK] {user['mail']} migrado")
        except Exception as e:
            print(f"  [ERROR] {user['mail']}: {e}")

    conn.commit()
    conn.close()

    print(f"\n[OK] {migrated} contrasenas migradas exitosamente!")


if __name__ == "__main__":
    main()
