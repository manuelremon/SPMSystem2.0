"""
Consolidacion de usuarios para la demo (portfolio).

Reduce el sistema a un elenco fijo de usuarios + 3 cuentas demo publicas,
FUSIONANDO los datos de los usuarios eliminados en usuarios del mismo perfil
(no se borran solicitudes ni historial). Funciona en SQLite (dev) y PostgreSQL (prod).

Pasos (todo en UNA transaccion):
  1. Crea/actualiza las cuentas demo (solicitante / aprobador / planificador).
  2. Calcula el mapa usuario_eliminado -> usuario_destino (mismo perfil, mismo centro,
     balanceando carga). IDs huerfanos (referenciados pero inexistentes) se mapean
     segun la semantica de la columna.
  3. Reasigna TODAS las columnas que referencian usuarios (descubiertas dinamicamente).
     Si una fila choca con una restriccion UNIQUE (p.ej. favoritos), se borra la fila
     del usuario eliminado.
  4. Reconstruye el organigrama (jefe/gerente1/gerente2) del elenco por centro.
  5. Normaliza estados legacy de solicitudes y recalcula el aprobador de las enviadas.
  6. Borra los usuarios eliminados.

Uso:
    python scripts/consolidar_usuarios.py            # simulacion (ROLLBACK)
    DEMO_PASSWORD=... python scripts/consolidar_usuarios.py --apply

DEMO_PASSWORD: contrasena de las cuentas demo y de todo el elenco salvo el admin
(el admin conserva la suya). Obligatoria si las cuentas demo no existen. Nunca se
escribe en el codigo.
"""

import argparse
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.db import get_db_connection, is_using_postgresql  # noqa: E402

# ---------------------------------------------------------------------------
# Elenco aprobado (2026-09-27)
# ---------------------------------------------------------------------------
ADMIN = "1"
COMPARTIDOS = "200"
ELENCO = {
    "admin": [ADMIN],
    "compartidos": [COMPARTIDOS],
    "planificador": ["81", "11", "2"],
    "gerente2": ["7"],
    "gerente1": ["39", "40"],
    "jefe": ["65", "33", "87", "93", "101", "36"],
    "solicitante": ["75", "109", "41", "74", "84", "117", "14", "16", "44", "60"],
}

# Cuentas demo publicas (sin rol admin)
DEMO = {
    "901": {
        "nombre": "Demo",
        "apellido": "Solicitante",
        "rol": "Solicitante",
        "mail": "demo.solicitante@planifica-materiales.com",
        "posicion": "Tecnico de Mantenimiento",
        "perfil": "solicitante",
    },
    "902": {
        "nombre": "Demo",
        "apellido": "Aprobador",
        "rol": "Aprobador_solicitudes, Jefe, Solicitante",
        "mail": "demo.aprobador@planifica-materiales.com",
        "posicion": "Jefe de Mantenimiento",
        "perfil": "jefe",
    },
    "903": {
        "nombre": "Demo",
        "apellido": "Planificador",
        "rol": "Planificador, Solicitante",
        "mail": "demo.planificador@planifica-materiales.com",
        "posicion": "Planificador de Materiales",
        "perfil": "planificador",
    },
}
DEMO_CENTROS = "AA101,AA102"
DEMO_SECTOR = "Mantenimiento"
DEMO_ALMACENES = "0001"

# Columnas que referencian usuarios (por nombre)
USER_COLS = re.compile(
    r"^(id_usuario|usuario_id|user_id|aprobador_id|planner_id|planificador_id|solicitante_id|"
    r"actor_id|creado_por|created_by|updated_by|approved_by|destinatario_id|remitente_id|"
    r"asignado_a|responsable_id|autor_id|delegado_id|delegante_id|aprobador_original_id|"
    r"owner_id|revisor_id|aprobado_por|rechazado_por|modificado_por|creador_id|emisor_id|"
    r"receptor_id|referente_id|solicitante|jefe|gerente1|gerente2)$"
)
# Tablas propias de SPM donde un ID inexistente es un huerfano a reasignar.
# En el resto (p.ej. sap_*) solo se reasignan IDs de usuarios reales eliminados:
# un numero desconocido puede ser un codigo externo (SAP), no un usuario.
TABLAS_HUERFANOS = re.compile(
    r"^(solicitud|solicitudes|solicitud_.+|solicitudes_.+|notificacion|notificaciones|mensaje|mensajes|"
    r"presupuesto.*|usuario_.+|user_.+|audit_trail|planificador_asignaciones)$"
)

# Umbrales de aprobacion (budget_schemas: L1 <= 200K, L2 <= 1M)
UMBRAL_L1 = 200_000
UMBRAL_L2 = 1_000_000

ESTADOS_LEGACY = {"Borrador": "draft", "borrador": "draft", "processing": "in_treatment", "closed": "completed"}


def perfil(rol: str) -> str:
    roles = {x.strip().strip('"[]').lower() for x in re.split(r"[,;]", rol or "") if x.strip()}
    if roles & {"admin", "administrador"}:
        return "admin"
    if "compartidos" in roles:
        return "compartidos"
    if "planificador" in roles:
        return "planificador"
    if "gerente2" in roles:
        return "gerente2"
    if "gerente1" in roles:
        return "gerente1"
    if "jefe" in roles or "aprobador_solicitudes" in roles:
        return "jefe"
    return "solicitante"


def centros_de(u) -> set:
    return {c.strip() for c in (u.get("centros") or "").split(",") if c.strip()}


class Consolidador:
    def __init__(self, conn, apply: bool):
        self.conn = conn
        self.cur = conn.cursor()
        self.apply = apply
        self.pg = is_using_postgresql()
        self.log = []
        self.carga = Counter()
        self.conflictos = Counter()

    # -- helpers de esquema --------------------------------------------------
    def base_tables(self) -> list:
        if self.pg:
            self.cur.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_type='BASE TABLE'"
            )
        else:
            self.cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        return [r[0] for r in self.cur.fetchall()]

    def columns(self, table: str) -> list:
        if self.pg:
            self.cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=?",
                (table,),
            )
            return [r[0] for r in self.cur.fetchall()]
        self.cur.execute(f'PRAGMA table_info("{table}")')
        return [r[1] for r in self.cur.fetchall()]

    def tabla(self, *candidatos) -> str:
        tablas = set(self.base_tables())
        for c in candidatos:
            if c in tablas:
                return c
        raise RuntimeError(f"No existe ninguna de {candidatos}")

    def q(self, sql, params=()):
        self.cur.execute(sql, params)
        return self.cur

    # -- pasos ---------------------------------------------------------------
    def cargar_usuarios(self):
        self.t_usuario = self.tabla("usuarios", "usuario")
        self.t_solicitud = self.tabla("solicitudes", "solicitud")
        rows = self.q(
            f"SELECT id_spm, nombre, apellido, rol, centros, sector, jefe, gerente1, gerente2, estado_registro "
            f"FROM {self.t_usuario}"
        ).fetchall()
        self.usuarios = {
            str(r[0]): dict(zip(
                ("id_spm", "nombre", "apellido", "rol", "centros", "sector", "jefe", "gerente1", "gerente2", "estado"),
                r,
            ))
            for r in rows
        }

    def crear_demo(self, password: str):
        import bcrypt

        for uid, d in DEMO.items():
            existe = uid in self.usuarios
            if existe:
                self.q(
                    f"UPDATE {self.t_usuario} SET nombre=?, apellido=?, rol=?, mail=?, posicion=?, centros=?, "
                    f"sector=?, almacenes=?, estado_registro='Activo' WHERE id_spm=?",
                    (d["nombre"], d["apellido"], d["rol"], d["mail"], d["posicion"], DEMO_CENTROS,
                     DEMO_SECTOR, DEMO_ALMACENES, uid),
                )
                if password:
                    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
                    self.q(f"UPDATE {self.t_usuario} SET contrasena=? WHERE id_spm=?", (hashed, uid))
            else:
                if not password:
                    raise SystemExit("Falta DEMO_PASSWORD para crear las cuentas demo")
                hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
                self.q(
                    f"INSERT INTO {self.t_usuario} (id_spm, nombre, apellido, rol, contrasena, mail, posicion, "
                    f"sector, centros, estado_registro, almacenes) VALUES (?,?,?,?,?,?,?,?,?,'Activo',?)",
                    (uid, d["nombre"], d["apellido"], d["rol"], hashed, d["mail"], d["posicion"],
                     DEMO_SECTOR, DEMO_CENTROS, DEMO_ALMACENES),
                )
            self.usuarios[uid] = {
                "id_spm": uid, "nombre": d["nombre"], "apellido": d["apellido"], "rol": d["rol"],
                "centros": DEMO_CENTROS, "sector": DEMO_SECTOR, "estado": "Activo",
            }
            self.log.append(f"cuenta demo {uid} ({d['mail']}): {'actualizada' if existe else 'creada'}")

    def armar_pools(self):
        self.pools = defaultdict(list)
        for p, ids in ELENCO.items():
            for uid in ids:
                if uid not in self.usuarios:
                    raise SystemExit(f"El usuario del elenco {uid} no existe en la BD")
                self.pools[p].append(uid)
        for uid, d in DEMO.items():
            self.pools[d["perfil"]].append(uid)
        self.conservados = {uid for ids in self.pools.values() for uid in ids}

    def elegir(self, pool: str, ref=None) -> str:
        """Destino del pool con mas afinidad (centro, sector) y menor carga."""
        candidatos = self.pools[pool]
        rc, rs = (centros_de(ref), (ref.get("sector") or "")) if ref else (set(), "")

        def score(uid):
            u = self.usuarios[uid]
            return (-len(rc & centros_de(u)), 0 if rs and rs == u.get("sector") else 1, self.carga[uid], uid)

        elegido = min(candidatos, key=score)
        self.carga[elegido] += 1
        return elegido

    def armar_mapa(self):
        self.mapa = {}
        for uid, u in sorted(self.usuarios.items()):
            if uid in self.conservados:
                continue
            p = perfil(u["rol"])
            if p in ("admin", "compartidos"):
                self.mapa[uid] = ADMIN if p == "admin" else COMPARTIDOS
            elif p == "gerente2":
                self.mapa[uid] = "7"
            else:
                self.mapa[uid] = self.elegir(p, u)

    def destino_huerfano(self, col: str) -> str:
        if col in ("aprobador_id", "aprobador_original_id", "aprobado_por", "jefe", "delegante_id", "delegado_id"):
            return self.elegir("jefe")
        if col in ("gerente1",):
            return self.elegir("gerente1")
        if col in ("gerente2",):
            return "7"
        if col in ("planner_id", "planificador_id"):
            return self.elegir("planificador")
        if col in ("id_usuario", "solicitante_id", "solicitante"):
            return self.elegir("solicitante")
        return ADMIN

    def reasignar_columnas(self):
        ids_validos = set(self.usuarios)
        total = Counter()
        for tabla in sorted(self.base_tables()):
            for col in self.columns(tabla):
                if not USER_COLS.match(col):
                    continue
                if tabla == self.t_usuario and col in ("id_spm", "jefe", "gerente1", "gerente2"):
                    continue  # el organigrama se reconstruye aparte
                valores = [
                    str(r[0]).strip()
                    for r in self.q(
                        f'SELECT DISTINCT CAST("{col}" AS TEXT) FROM "{tabla}" WHERE "{col}" IS NOT NULL'
                    ).fetchall()
                ]
                for valor in valores:
                    if not valor.isdigit():
                        continue  # nombres u otros textos: no son IDs de usuario
                    if valor in self.mapa:
                        destino = self.mapa[valor]
                    elif valor not in ids_validos and TABLAS_HUERFANOS.match(tabla):
                        clave = f"huerfano:{col}:{valor}"
                        if clave not in self.mapa:
                            self.mapa[clave] = self.destino_huerfano(col)
                        destino = self.mapa[clave]
                    else:
                        continue
                    n = self._update_o_borrar(tabla, col, valor, destino)
                    total[(tabla, col)] += n
        self.reasignaciones = total

    def _update_o_borrar(self, tabla, col, viejo, nuevo) -> int:
        self.q("SAVEPOINT sp_col")
        try:
            n = self.q(
                f'UPDATE "{tabla}" SET "{col}" = ? WHERE CAST("{col}" AS TEXT) = ?', (nuevo, viejo)
            ).rowcount
            self.q("RELEASE SAVEPOINT sp_col")
            return n
        except Exception as e:  # UNIQUE u otra restriccion: borrar las filas del eliminado
            self.q("ROLLBACK TO SAVEPOINT sp_col")
            n = self.q(f'DELETE FROM "{tabla}" WHERE CAST("{col}" AS TEXT) = ?', (viejo,)).rowcount
            self.q("RELEASE SAVEPOINT sp_col")
            self.conflictos[(tabla, col, type(e).__name__)] += n
            return n

    def refrescar_desnormalizados(self):
        """Columnas que copian nombre/mail del usuario referenciado (quedarian con datos del eliminado)."""
        if "proveedor_interno" not in self.base_tables():
            return
        n = self.q(
            f"UPDATE proveedor_interno SET "
            f"referente_nombre = (SELECT TRIM(COALESCE(u.nombre,'') || ' ' || COALESCE(u.apellido,'')) "
            f"  FROM {self.t_usuario} u WHERE u.id_spm = proveedor_interno.referente_id), "
            f"referente_email = (SELECT u.mail FROM {self.t_usuario} u WHERE u.id_spm = proveedor_interno.referente_id) "
            f"WHERE referente_id IS NOT NULL"
        ).rowcount
        self.log.append(f"proveedor_interno: referente_nombre/email refrescados ({n} filas)")

    def fijar_passwords(self, password: str):
        """Misma contrasena para todo el elenco salvo el admin (que conserva la suya, privada)."""
        if not password:
            self.log.append("contrasenas: sin cambios (DEMO_PASSWORD vacia)")
            return
        import bcrypt

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        destino = sorted(self.conservados - {ADMIN})
        for uid in destino:
            self.q(f"UPDATE {self.t_usuario} SET contrasena=? WHERE id_spm=?", (hashed, uid))
        self.log.append(f"contrasenas: fijada para {len(destino)} usuarios (todos menos el admin)")

    def reconstruir_organigrama(self):
        self.carga.clear()
        g2 = "7"
        cambios = {}
        for uid in sorted(self.conservados):
            u = self.usuarios[uid]
            p = perfil(u["rol"])
            if uid in DEMO:
                p = DEMO[uid]["perfil"]
            if p in ("admin", "compartidos"):
                cambios[uid] = (None, None, None)
            elif p == "gerente2":
                cambios[uid] = (ADMIN, None, None)
            elif p == "gerente1":
                cambios[uid] = (g2, None, g2)
            elif p == "jefe":
                g1 = self.elegir("gerente1", u)
                cambios[uid] = (g1, g1, g2)
            else:  # solicitante / planificador
                jefe = "902" if uid in ("901", "903") else self.elegir("jefe", u)
                cambios[uid] = (jefe, self.elegir("gerente1", u), g2)
        for uid, (jefe, g1, gg2) in cambios.items():
            self.q(
                f"UPDATE {self.t_usuario} SET jefe=?, gerente1=?, gerente2=? WHERE id_spm=?",
                (jefe, g1, gg2, uid),
            )
            self.usuarios[uid].update({"jefe": jefe, "gerente1": g1, "gerente2": gg2})

    def normalizar_solicitudes(self):
        self.normalizados = Counter()
        for viejo, nuevo in ESTADOS_LEGACY.items():
            n = self.q(f"UPDATE {self.t_solicitud} SET status=? WHERE status=?", (nuevo, viejo)).rowcount
            if n:
                self.normalizados[f"{viejo}->{nuevo}"] += n

        # En tratamiento sin planificador: asignar uno del elenco
        rows = self.q(
            f"SELECT id FROM {self.t_solicitud} WHERE status IN ('approved','in_treatment') "
            f"AND (planner_id IS NULL OR planner_id = '')"
        ).fetchall()
        for (sid,) in rows:
            self.q(f"UPDATE {self.t_solicitud} SET planner_id=? WHERE id=?", (self.elegir("planificador"), sid))
        self.normalizados["planner asignado a aprobadas/en tratamiento"] = len(rows)

        # Enviadas: recalcular aprobador segun la cadena del solicitante (bandejas de jefes con trabajo)
        rows = self.q(f"SELECT id, id_usuario, total_monto FROM {self.t_solicitud} WHERE status='submitted'").fetchall()
        cambiados = 0
        for sid, solicitante, total in rows:
            aprobador = self.aprobador_para(str(solicitante), float(total or 0))
            self.q(f"UPDATE {self.t_solicitud} SET aprobador_id=? WHERE id=?", (aprobador, sid))
            cambiados += 1
        self.normalizados["aprobador recalculado (enviadas)"] = cambiados

    def aprobador_para(self, solicitante: str, monto: float) -> str:
        nivel = "jefe" if monto <= UMBRAL_L1 else "gerente1" if monto <= UMBRAL_L2 else "gerente2"
        cadena = ("jefe", "gerente1", "gerente2")
        u = self.usuarios.get(solicitante) or {}
        for campo in cadena[cadena.index(nivel):]:
            cand = u.get(campo)
            if cand and str(cand) != solicitante and str(cand) in self.conservados:
                return str(cand)
        return "7" if solicitante != "7" else ADMIN

    def borrar_eliminados(self):
        eliminados = [uid for uid in self.usuarios if uid not in self.conservados]
        for uid in eliminados:
            self.q(f"DELETE FROM {self.t_usuario} WHERE id_spm=?", (uid,))
        self.eliminados = eliminados

    def asignacion_demo_planner(self):
        try:
            self.q("DELETE FROM planificador_asignaciones WHERE planificador_id NOT IN "
                   f"({','.join('?' * len(self.conservados))})", tuple(self.conservados))
            ya = self.q(
                "SELECT COUNT(*) FROM planificador_asignaciones WHERE planificador_id='903'"
            ).fetchone()[0]
            if not ya:
                self.q(
                    "INSERT INTO planificador_asignaciones (planificador_id, centro, sector) VALUES ('903', 'AA101', ?)",
                    (DEMO_SECTOR,),
                )
        except Exception as e:
            self.log.append(f"planificador_asignaciones: omitido ({type(e).__name__})")

    # -- reporte ---------------------------------------------------------------
    def reporte(self):
        print("=" * 70)
        print("CONSOLIDACION DE USUARIOS -", "APLICAR (COMMIT)" if self.apply else "SIMULACION (ROLLBACK)")
        print("Motor:", "PostgreSQL" if self.pg else "SQLite", "| tablas:", self.t_usuario, self.t_solicitud)
        print("=" * 70)
        print(f"Usuarios antes: {len(self.usuarios)} | conservados: {len(self.conservados)} | "
              f"eliminados: {len(self.eliminados)}")
        destinos = Counter(v for k, v in self.mapa.items() if not k.startswith("huerfano:"))
        print("Fusion (destino: cantidad de usuarios absorbidos):",
              dict(sorted(destinos.items(), key=lambda x: -x[1])))
        huerfanos = [k for k in self.mapa if k.startswith("huerfano:")]
        print(f"IDs huerfanos reasignados: {len(huerfanos)}")
        print("\nFilas reasignadas por columna:")
        for (t, c), n in sorted(self.reasignaciones.items(), key=lambda x: -x[1]):
            if n:
                print(f"  {t}.{c}: {n}")
        print("\nSolicitudes:", dict(self.normalizados))
        print("\nElenco final:")
        for uid in sorted(self.conservados, key=lambda x: int(x)):
            u = self.usuarios[uid]
            print(f"  {uid:>4} {u['nombre']} {u.get('apellido') or ''} | {perfil(u['rol']) if uid not in DEMO else DEMO[uid]['perfil']}"
                  f" | centros={u.get('centros')} | jefe={u.get('jefe')} g1={u.get('gerente1')} g2={u.get('gerente2')}")
        if self.conflictos:
            print("\nFilas del eliminado descartadas por conflicto UNIQUE (el destino ya tenia la suya):")
            for (t, c, err), n in sorted(self.conflictos.items()):
                print(f"  {t}.{c}: {n} ({err})")
        for linea in self.log:
            print("  -", linea)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="Aplicar (COMMIT). Sin esto, simula y hace ROLLBACK")
    args = parser.parse_args()
    password = os.environ.get("DEMO_PASSWORD", "")

    with get_db_connection() as conn:
        if not is_using_postgresql():
            # SQLite dev: hay FKs legacy hacia vistas (p.ej. rfq -> usuarios) que rompen
            # cualquier escritura; se valida al final con foreign_key_check.
            conn.execute("PRAGMA foreign_keys = OFF")
        c = Consolidador(conn, args.apply)
        try:
            c.cargar_usuarios()
            c.crear_demo(password)
            c.armar_pools()
            c.armar_mapa()
            c.reasignar_columnas()
            c.refrescar_desnormalizados()
            c.fijar_passwords(password)
            c.reconstruir_organigrama()
            c.normalizar_solicitudes()
            c.asignacion_demo_planner()
            c.borrar_eliminados()
            c.reporte()
            if not c.pg:
                violaciones, legacy = Counter(), []
                for tabla in c.base_tables():
                    try:
                        for r in c.q(f'PRAGMA foreign_key_check("{tabla}")').fetchall():
                            violaciones[r[0]] += 1
                    except Exception:
                        legacy.append(tabla)  # FK legacy hacia una vista (rfq, ahorro_costo, ...)
                print("\nforeign_key_check (SQLite):", dict(violaciones) or "sin violaciones",
                      f"| tablas con FK legacy no verificables: {len(legacy)}")
        except BaseException:
            conn.rollback()
            raise
        if args.apply:
            conn.commit()
            print("\nCOMMIT realizado.")
        else:
            conn.rollback()
            print("\nSimulacion: ROLLBACK (no se modifico nada).")


if __name__ == "__main__":
    main()
