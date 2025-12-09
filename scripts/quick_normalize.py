"""
Normalizacion de roles y puestos en la BD.
Ejecutar con: python scripts/quick_normalize.py

Roles oficiales: Solicitante, Aprobador Solicitudes, Aprobador de Presupuesto, Planificador, Administrador
Puestos oficiales: Planificador, Jefe, Gerente1, Gerente2, Director, Supervisor, Analista, Coordinador
"""

import json
import sqlite3
import sys
import time

DB_PATH = "C:/Users/MANUE/SPMv2.0/data/spm.db"

# === MAPEO DE ROLES ===
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
    "Aprobador_presupuestos": "aprobador_presupuestos",
    "Aprobador de Presupuesto": "aprobador_presupuestos",
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

# === MAPEO DE PUESTOS ===
# catalog_puestos: Planificador, Jefe, Gerente1, Gerente2, Director, Supervisor, Analista, Coordinador
PUESTO_MAPPING = {
    # Variantes de Planificador
    "planificador": "Planificador",
    "Planificador Senior": "Planificador",
    "planificador senior": "Planificador",
    # Variantes de Jefe
    "jefe": "Jefe",
    "JEFE": "Jefe",
    # Variantes de Gerente
    "Gerente Nivel 1": "Gerente1",
    "gerente nivel 1": "Gerente1",
    "Gerente de Area": "Gerente1",
    "gerente de area": "Gerente1",
    "Gerente Finanzas": "Gerente1",
    "gerente finanzas": "Gerente1",
    "Gerente Nivel 2": "Gerente2",
    "gerente nivel 2": "Gerente2",
    "Gerente": "Gerente1",
    "gerente": "Gerente1",
    # Variantes de Director
    "director": "Director",
    "DIRECTOR": "Director",
    # Variantes de Empleado -> Analista
    "Empleado": "Analista",
    "empleado": "Analista",
    "Ingeniero": "Analista",
    "ingeniero": "Analista",
    # Admin
    "Administrador General": "Director",
    "administrador general": "Director",
}

VALID_PUESTOS = [
    "Planificador",
    "Jefe",
    "Gerente1",
    "Gerente2",
    "Director",
    "Supervisor",
    "Analista",
    "Coordinador",
]


def normalize_role(role_str):
    if not role_str:
        return json.dumps(["solicitante"])
    roles = [r.strip() for r in role_str.split(",")]
    normalized = set()
    for rol in roles:
        if rol in ROL_MAPPING:
            normalized.add(ROL_MAPPING[rol])
        elif rol.lower() in VALID_ROLES:
            normalized.add(rol.lower())
        else:
            normalized.add("solicitante")
    return json.dumps(sorted(list(normalized)))


def normalize_puesto(puesto_str):
    if not puesto_str:
        return "Analista"

    # Buscar en mapeo
    if puesto_str in PUESTO_MAPPING:
        return PUESTO_MAPPING[puesto_str]

    # Buscar en mapeo con lowercase
    if puesto_str.lower() in PUESTO_MAPPING:
        return PUESTO_MAPPING[puesto_str.lower()]

    # Verificar si ya es valido
    if puesto_str in VALID_PUESTOS:
        return puesto_str

    # Default
    return "Analista"


def main():
    max_retries = 5
    for attempt in range(max_retries):
        try:
            conn = sqlite3.connect(DB_PATH, timeout=5)
            cur = conn.cursor()

            print("=== NORMALIZANDO DATOS DE USUARIOS ===\n")

            cur.execute("SELECT id_spm, nombre, apellido, rol, posicion FROM usuarios")
            usuarios = cur.fetchall()

            print("--- ROLES ---")
            for id_spm, nombre, apellido, old_rol, _ in usuarios:
                new_rol = normalize_role(old_rol)
                if old_rol != new_rol:
                    print(f'  {id_spm} ({nombre}): "{old_rol}" -> {new_rol}')
                    cur.execute("UPDATE usuarios SET rol = ? WHERE id_spm = ?", (new_rol, id_spm))

            print("\n--- PUESTOS ---")
            for id_spm, nombre, apellido, _, old_puesto in usuarios:
                new_puesto = normalize_puesto(old_puesto)
                if old_puesto != new_puesto:
                    print(f'  {id_spm} ({nombre}): "{old_puesto}" -> {new_puesto}')
                    cur.execute(
                        "UPDATE usuarios SET posicion = ? WHERE id_spm = ?", (new_puesto, id_spm)
                    )

            conn.commit()
            conn.close()

            print("\n=== NORMALIZACION COMPLETADA ===")
            return 0

        except sqlite3.OperationalError as e:
            print(f"Intento {attempt + 1}/{max_retries}: {e}")
            time.sleep(2)

    print("ERROR: No se pudo acceder a la BD despues de varios intentos")
    print("Asegurate de cerrar cualquier aplicacion que este usando la base de datos.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
