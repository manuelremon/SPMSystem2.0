"""
Script para normalizar los roles de usuarios en la base de datos.
Convierte roles inconsistentes al formato estándar del sistema.

Roles oficiales:
- Solicitante
- Aprobador Solicitudes
- Aprobador de Presupuesto
- Planificador
- Administrador
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "spm.db"

# Mapeo de roles inconsistentes a formato normalizado (minusculas con underscore)
ROL_MAPPING = {
    "admin": "administrador",
    "Admin": "administrador",
    "Administrador": "administrador",
    "ADMINISTRADOR": "administrador",
    "Solicitante": "solicitante",
    "SOLICITANTE": "solicitante",
    "Planificador": "planificador",
    "PLANIFICADOR": "planificador",
    "Aprobador_solicitudes": "aprobador_solicitudes",
    "Aprobador Solicitudes": "aprobador_solicitudes",
    "aprobador solicitudes": "aprobador_solicitudes",
    "Aprobador_presupuestos": "aprobador_presupuestos",
    "Aprobador de Presupuesto": "aprobador_presupuestos",
    "aprobador de presupuesto": "aprobador_presupuestos",
    "aprobador_Solicitudes": "aprobador_solicitudes",
    "aprobador_Presupuestos": "aprobador_presupuestos",
    "jefe": "aprobador_solicitudes",
    "Jefe": "aprobador_solicitudes",
    "JEFE": "aprobador_solicitudes",
    "Gerente": "aprobador_presupuestos",
    "gerente": "aprobador_presupuestos",
    "GERENTE": "aprobador_presupuestos",
}

VALID_ROLES = [
    "solicitante",
    "planificador",
    "administrador",
    "aprobador_solicitudes",
    "aprobador_presupuestos",
]


def normalize_role(role_str):
    """Normaliza un string de roles a formato JSON array."""
    if not role_str:
        return json.dumps(["solicitante"])

    # Separar por coma
    roles = [r.strip() for r in role_str.split(",")]
    normalized = set()

    for rol in roles:
        # Buscar en mapping
        if rol in ROL_MAPPING:
            normalized.add(ROL_MAPPING[rol])
        elif rol.lower() in VALID_ROLES:
            normalized.add(rol.lower())
        else:
            # Intentar normalizar
            rol_lower = rol.lower().replace(" ", "_")
            if rol_lower in VALID_ROLES:
                normalized.add(rol_lower)
            else:
                print(f'    [WARN] Rol desconocido: "{rol}" -> asignando solicitante')
                normalized.add("solicitante")

    return json.dumps(sorted(list(normalized)))


def main():
    # Usar timeout de 30 segundos y modo WAL para mejor concurrencia
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 30000")  # 30 segundos
    cur = conn.cursor()

    print("=== USUARIOS CON ROLES ANTES DE NORMALIZAR ===")
    cur.execute("SELECT id_spm, nombre, apellido, rol, posicion FROM usuarios ORDER BY id_spm")
    usuarios = cur.fetchall()
    for u in usuarios:
        print(f'  {u[0]}: {u[1]} {u[2]} | rol="{u[3]}" | posicion={u[4]}')

    print()
    print("=== NORMALIZANDO ROLES ===")

    changes = 0
    for u in usuarios:
        id_spm = u[0]
        old_rol = u[3]
        new_rol = normalize_role(old_rol)

        if old_rol != new_rol:
            print(f'  {id_spm}: "{old_rol}" -> {new_rol}')
            cur.execute("UPDATE usuarios SET rol = ? WHERE id_spm = ?", (new_rol, id_spm))
            changes += 1

    # No necesita commit con isolation_level=None (autocommit)

    print()
    print(f"=== {changes} USUARIOS ACTUALIZADOS ===")
    print()
    print("=== USUARIOS DESPUES DE NORMALIZAR ===")
    cur.execute("SELECT id_spm, nombre, apellido, rol, posicion FROM usuarios ORDER BY id_spm")
    for u in cur.fetchall():
        print(f"  {u[0]}: {u[1]} {u[2]} | rol={u[3]}")

    conn.close()
    print()
    print("Normalizacion completada!")


if __name__ == "__main__":
    main()
