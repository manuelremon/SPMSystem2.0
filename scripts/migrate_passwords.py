#!/usr/bin/env python3
"""
Migra contraseñas de texto plano a bcrypt hash.

Este script debe ejecutarse UNA sola vez para migrar las contraseñas existentes.
Después de ejecutarlo, todas las contraseñas estarán hasheadas con bcrypt.

Uso:
    python scripts/migrate_passwords.py

IMPORTANTE: Este script modifica la base de datos. Asegúrate de tener un backup.
"""

import os
import sys

# Agregar el directorio raíz al path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt

from backend.core.db import get_db_connection


def hash_password(plain_password: str) -> str:
    """Genera hash bcrypt de una contraseña."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def is_bcrypt_hash(password: str) -> bool:
    """Verifica si una contraseña ya es un hash bcrypt."""
    if not password:
        return False
    return password.startswith("$2b$") or password.startswith("$2a$")


def get_field(row, index, name):
    """Extrae un campo de una fila (compatible con SQLite y PostgreSQL)."""
    if isinstance(row, dict):
        return row.get(name)
    return row[index]


def migrate_passwords(dry_run: bool = False) -> int:
    """
    Migra todas las contraseñas que no son bcrypt hash.

    Args:
        dry_run: Si es True, solo muestra lo que haría sin modificar la BD.

    Returns:
        Número de usuarios migrados.
    """
    migrated = 0

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Encontrar usuarios con contraseñas en texto plano
        # Usamos %% para escapar % en LIKE (funciona en SQLite y PostgreSQL)
        cur.execute("""
            SELECT id_spm, contrasena FROM usuarios
            WHERE contrasena IS NOT NULL
            AND contrasena != ''
            AND contrasena NOT LIKE '$2b$%%'
            AND contrasena NOT LIKE '$2a$%%'
        """)

        users = cur.fetchall()

        if not users:
            print("No se encontraron usuarios con contraseñas en texto plano.")
            print("Todas las contraseñas ya están hasheadas con bcrypt.")
            return 0

        print(f"Encontrados {len(users)} usuarios con contraseñas en texto plano")

        if dry_run:
            print("\n[DRY RUN] Los siguientes usuarios serían migrados:")
            for user in users:
                user_id = get_field(user, 0, "id_spm")
                print(f"  - {user_id}")
            print("\nEjecuta sin --dry-run para aplicar los cambios.")
            return len(users)

        print("\nMigrando contraseñas...")
        for user in users:
            user_id = get_field(user, 0, "id_spm")
            plain_pwd = get_field(user, 1, "contrasena")

            # Hashear con bcrypt
            hashed = hash_password(plain_pwd)

            # Actualizar en BD (usar %s para PostgreSQL, ? para SQLite)
            # get_db_connection devuelve conexión con el placeholder correcto
            try:
                # Intentar con %s (PostgreSQL)
                cur.execute(
                    "UPDATE usuarios SET contrasena = %s WHERE id_spm = %s",
                    (hashed, user_id)
                )
            except Exception:
                # Fallback a ? (SQLite)
                cur.execute(
                    "UPDATE usuarios SET contrasena = ? WHERE id_spm = ?",
                    (hashed, user_id)
                )
            migrated += 1
            print(f"  Migrado: {user_id}")

        conn.commit()
        print(f"\nTotal migrados: {migrated}")

    return migrated


def get_count(row):
    """Extrae el count de una fila (compatible con SQLite y PostgreSQL)."""
    if isinstance(row, dict):
        return row.get("count", row.get("COUNT(*)", 0))
    return row[0]


def verify_migration() -> None:
    """Verifica que todas las contraseñas estén hasheadas."""
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Contar contraseñas en texto plano restantes
        cur.execute("""
            SELECT COUNT(*) as count FROM usuarios
            WHERE contrasena IS NOT NULL
            AND contrasena != ''
            AND contrasena NOT LIKE '$2b$%%'
            AND contrasena NOT LIKE '$2a$%%'
        """)
        plain_count = get_count(cur.fetchone())

        # Contar contraseñas hasheadas
        cur.execute("""
            SELECT COUNT(*) as count FROM usuarios
            WHERE contrasena LIKE '$2b$%%'
            OR contrasena LIKE '$2a$%%'
        """)
        hashed_count = get_count(cur.fetchone())

        print("\n=== Estado de las contraseñas ===")
        print(f"Hasheadas (bcrypt): {hashed_count}")
        print(f"Texto plano: {plain_count}")

        if plain_count == 0:
            print("\nTodas las contraseñas están correctamente hasheadas.")
        else:
            print(f"\nADVERTENCIA: Aún hay {plain_count} contraseñas en texto plano.")


def main():
    """Punto de entrada principal."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Migra contraseñas de texto plano a bcrypt hash."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra lo que haría sin modificar la BD."
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verifica el estado de las contraseñas sin migrar."
    )

    args = parser.parse_args()

    if args.verify:
        verify_migration()
        return

    print("=== Migración de Contraseñas a Bcrypt ===\n")

    if args.dry_run:
        print("[MODO DRY RUN - No se harán cambios]\n")

    migrated = migrate_passwords(dry_run=args.dry_run)

    if not args.dry_run and migrated > 0:
        verify_migration()


if __name__ == "__main__":
    main()
