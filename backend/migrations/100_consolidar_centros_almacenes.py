"""
Migracion 100: Consolidar centros y almacenes + anonimizar datos SAP.

PROBLEMA:
  Los datos maestros validos son 6 centros (AA101-AA106, catalogo_centro) y
  6 almacenes (0001, 0012, 0101, 9002, 9003, 9004, catalogo_almacen), pero:
  - stock / consumo_historico / pedidos_sap / materiales_bbdd usan 34 codigos de
    almacen SAP y algunos centros SAP numericos (1001, 1004, 1503, 51, ...).
  - solicitud.almacen_virtual usa AV001/AV002/AV003 (inexistentes).
  - proveedor_interno usa centros con prefijo SEED_ y una matriz centro/almacen parcial.
  Ademas, stock y pedidos_sap contienen datos reales de empresa (operadoras/UTEs,
  proveedores, codigos PEP, personas, precios).

SOLUCION (mismas reglas en SQLite y PostgreSQL):
  1. Mapas FIJOS codigo_viejo -> codigo_valido (centros y almacenes). Los almacenes
     se repartieron balanceando el volumen de filas.
  2. solicitud: AV001->0001, AV002->0012, AV003->0101, vacio->0001; centro vacio ->
     primer centro del solicitante.
  3. proveedor_interno: sin prefijo SEED_ y matriz completa 6 centros x 6 almacenes.
  4. materiales_bbdd: deduplicar (material, centro, almacen) tras el mapeo.
  5. Anonimizar: operadoras/UTEs, proveedores (codigo y nombre), elemento PEP,
     solicitante SAP y precios de stock (factor fijo). Descripcion de centro desde catalogo.
  6. Verificacion: aborta si queda cualquier centro/almacen fuera de catalogo.

Irreversible (la anonimizacion no se deshace): hacer backup antes de aplicar.
Fecha: 2026-09-27
"""

import hashlib
import os
import re
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

CENTROS = ("AA101", "AA102", "AA103", "AA104", "AA105", "AA106")
ALMACENES = ("0001", "0012", "0101", "9002", "9003", "9004")

MAPA_CENTROS = {
    "1001": "AA101",
    "1004": "AA104",
    "1005": "AA105",
    "1006": "AA106",
    "1503": "AA103",
    "51": "AA105",
    "52": "AA102",
}

MAPA_ALMACENES = {
    "AA001": "0001", "AA100": "0012", "II003": "0101", "II999": "9002", "AA005": "9003",
    "7777": "9004", "II004": "9004", "AA999": "9003", "II012": "9002", "AA012": "9002",
    "II002": "9004", "II000": "9003", "II100": "9002", "AA101": "9004", "1001": "9003",
    "AA008": "9003", "AA003": "9004", "II005": "9002", "AA007": "9003", "AA004": "9004",
    "II200": "9002", "AA013": "9002", "II013": "9004", "AA006": "9002", "1000": "9003",
    "II300": "9004", "AA011": "9003", "AA010": "9002", "AA002": "9004", "II990": "9002",
    "II008": "9003", "II001": "9003", "AA103": "9004", "AA102": "9003",
    # almacenes virtuales de solicitudes
    "AV001": "0001", "AV002": "0012", "AV003": "0101",
}

TABLAS_SAP = ("stock", "consumo_historico", "pedidos_sap", "materiales_bbdd")
FACTOR_PRECIO = 0.83  # anonimiza precios manteniendo proporciones

_PREFIJOS = ("Suministros", "Servicios", "Industrias", "Tecnica", "Metalurgica", "Equipos",
             "Soluciones", "Ingenieria", "Distribuidora", "Montajes")
_SUFIJOS = ("del Sur", "Patagonica", "Andina", "del Valle", "Norte", "Integral", "Global",
            "Neuquina", "Austral", "Central")


def _nombre_proveedor(i: int) -> str:
    return f"{_PREFIJOS[i % 10]} {_SUFIJOS[(i // 10) % 10]} S.A." + ("" if i < 100 else f" {i // 100}")


def _pep(valor: str) -> str:
    return "PEP-" + hashlib.sha1(valor.encode()).hexdigest()[:8].upper()


def _filas(cur_o_resultado):
    """
    Filas como tuplas de VALORES. En PostgreSQL el cursor devuelve DictRow (un dict):
    desempaquetarlo o iterarlo da los NOMBRES de columna, no los valores.
    """
    return [tuple(r[i] for i in range(len(r))) for r in cur_o_resultado.fetchall()]


def _cols(cur, tabla, is_pg):
    if is_pg:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=?",
            (tabla,),
        )
        return {r[0] for r in _filas(cur)}
    cur.execute(f'PRAGMA table_info("{tabla}")')
    return {r[1] for r in _filas(cur)}


def _base(cur, is_pg, *nombres):
    """
    Primer nombre que exista como relacion actualizable.

    PostgreSQL (prod): stock, consumo_historico, pedidos_sap, materiales_bbdd,
    catalogo_materiales... son VISTAS simples sobre sap_* / cat_* (auto-actualizables),
    asi que se aceptan tablas y vistas. SQLite: solo tablas (sus vistas no son actualizables).
    """
    for n in nombres:
        if is_pg:
            cur.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_schema='public' "
                "AND table_type IN ('BASE TABLE', 'VIEW') AND table_name=?",
                (n,),
            )
        else:
            cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (n,))
        if cur.fetchone():
            return n
    return None


def _fallback(valor: str, validos) -> str:
    """Destino deterministico para un codigo desconocido (siempre el mismo)."""
    return validos[int(hashlib.sha1(str(valor).encode()).hexdigest(), 16) % len(validos)]


def _remap_total(cur, tabla, col, mapa, validos):
    """Remapea con el mapa fijo y, para codigos desconocidos, con _fallback."""
    n = _remap(cur, tabla, col, mapa)
    ph = ",".join("?" * len(validos))
    cur.execute(
        f"SELECT DISTINCT \"{col}\" FROM \"{tabla}\" WHERE \"{col}\" IS NOT NULL AND \"{col}\" <> '' "
        f"AND \"{col}\" NOT IN ({ph})",
        validos,
    )
    for (v,) in _filas(cur):
        cur.execute(f'UPDATE "{tabla}" SET "{col}" = ? WHERE "{col}" = ?', (_fallback(v, validos), v))
        n += cur.rowcount or 0
    return n


def _remap(cur, tabla, col, mapa):
    n = 0
    for viejo, nuevo in mapa.items():
        cur.execute(f'UPDATE "{tabla}" SET "{col}" = ? WHERE "{col}" = ?', (nuevo, viejo))
        n += cur.rowcount or 0
    return n


# ---------------------------------------------------------------------------
# SAP (stock, consumo, pedidos, parametros MRP)
# ---------------------------------------------------------------------------


def _sap(conn, is_pg, log):
    cur = conn.cursor()
    for t in TABLAS_SAP:
        if not _base(cur, is_pg, t):
            continue
        cols = _cols(cur, t, is_pg)
        if "centro" in cols:
            log.append(f"{t}.centro remapeadas: {_remap_total(cur, t, 'centro', MAPA_CENTROS, CENTROS)}")
        if "almacen" in cols:
            log.append(f"{t}.almacen remapeadas: {_remap_total(cur, t, 'almacen', MAPA_ALMACENES, ALMACENES)}")

    # materiales_bbdd: una fila por (material, centro, almacen)
    if _base(cur, is_pg, "materiales_bbdd"):
        pk = "id" if "id" in _cols(cur, "materiales_bbdd", is_pg) else "rowid"
        cur.execute(
            f"""DELETE FROM materiales_bbdd WHERE {pk} NOT IN (
                    SELECT MIN({pk}) FROM materiales_bbdd GROUP BY codigo_material, centro, almacen)"""
        )
        log.append(f"materiales_bbdd duplicados eliminados: {cur.rowcount}")

    if _base(cur, is_pg, "stock"):
        # Descripcion de centro coherente con el catalogo
        for i, c in enumerate(CENTROS, start=1):
            cur.execute('UPDATE stock SET centro_descripcion = ? WHERE centro = ?', (f"Deposito {i}", c))

        # Operadoras / UTEs
        cur.execute('SELECT "ypf/ute_desc", COUNT(*) FROM stock GROUP BY 1 ORDER BY 2 DESC')
        operadoras = [r[0] for r in _filas(cur) if r[0] and not str(r[0]).startswith(("ACME", "Operadora", "UTE Bloque"))]
        for i, v in enumerate(operadoras):
            nuevo = "ACME Energy" if i == 0 else f"UTE Bloque {i:02d}"
            cur.execute('UPDATE stock SET "ypf/ute_desc" = ? WHERE "ypf/ute_desc" = ?', (nuevo, v))
        # Convencion del catalogo (corridas previas usaban "Operadora Principal")
        cur.execute('UPDATE stock SET "ypf/ute_desc" = ? WHERE "ypf/ute_desc" = ?', ("ACME Energy", "Operadora Principal"))
        log.append(f"stock operadoras/UTEs anonimizadas: {len(operadoras)}")

        # Proveedores (acreedor): codigo y nombre ficticios, consistentes
        cur.execute(
            "SELECT acreedor_descripcion, MIN(acreedor), COUNT(*) FROM stock "
            "WHERE acreedor_descripcion IS NOT NULL AND acreedor_descripcion <> '' GROUP BY 1 ORDER BY 3 DESC, 1"
        )
        proveedores = {}
        for i, (nombre, _codigo, _n) in enumerate(_filas(cur)):
            if str(nombre).endswith("S.A.") and str(nombre).split(" ")[0] in _PREFIJOS:
                continue  # ya anonimizado
            proveedores[nombre] = (_nombre_proveedor(i), f"P{i + 1:05d}")
        for nombre, (nuevo, codigo) in proveedores.items():
            cur.execute(
                "UPDATE stock SET acreedor_descripcion = ?, acreedor = ? WHERE acreedor_descripcion = ?",
                (nuevo, codigo, nombre),
            )
        cur.execute(
            "UPDATE stock SET acreedor = NULL WHERE acreedor IS NOT NULL "
            "AND (acreedor_descripcion IS NULL OR acreedor_descripcion = '')"
        )
        log.append(f"stock proveedores anonimizados: {len(proveedores)}")

        # Elemento PEP (codigos de proyecto)
        cur.execute("SELECT DISTINCT elemento_pep FROM stock WHERE elemento_pep IS NOT NULL AND elemento_pep NOT LIKE 'PEP-%'")
        peps = [r[0] for r in _filas(cur)]
        for v in peps:
            cur.execute("UPDATE stock SET elemento_pep = ? WHERE elemento_pep = ?", (_pep(v), v))
        log.append(f"stock elementos PEP anonimizados: {len(peps)}")

        # Precios: una sola vez (marca persistente)
        cur.execute("CREATE TABLE IF NOT EXISTS anonimizacion_aplicada (paso TEXT PRIMARY KEY)")
        cur.execute("SELECT 1 FROM anonimizacion_aplicada WHERE paso = 'precios_stock'")
        if not cur.fetchone():
            cur.execute(
                "UPDATE stock SET precio = ROUND(CAST(precio * ? AS NUMERIC), 2), "
                "stock_valorizado = ROUND(CAST(stock_valorizado * ? AS NUMERIC), 2)",
                (FACTOR_PRECIO, FACTOR_PRECIO),
            )
            cur.execute("INSERT INTO anonimizacion_aplicada (paso) VALUES ('precios_stock')")
        log.append("stock precios anonimizados")

    if _base(cur, is_pg, "pedidos_sap"):
        cur.execute("SELECT DISTINCT nombre_1 FROM pedidos_sap WHERE nombre_1 IS NOT NULL AND nombre_1 <> ''")
        nombres = sorted(r[0] for r in _filas(cur))
        for i, v in enumerate(nombres):
            if str(v).endswith("S.A.") and str(v).split(" ")[0] in _PREFIJOS:
                continue
            cur.execute("UPDATE pedidos_sap SET nombre_1 = ? WHERE nombre_1 = ?", (_nombre_proveedor(150 + i), v))
        cur.execute("SELECT DISTINCT solicitante FROM pedidos_sap WHERE solicitante IS NOT NULL AND solicitante <> ''")
        sols = sorted(r[0] for r in _filas(cur) if not str(r[0]).startswith("USR"))
        for i, v in enumerate(sols):
            cur.execute("UPDATE pedidos_sap SET solicitante = ? WHERE solicitante = ?", (f"USR{i + 1:03d}", v))
        log.append(f"pedidos_sap anonimizados: {len(nombres)} proveedores, {len(sols)} solicitantes")
    conn.commit()


# ---------------------------------------------------------------------------
# Descripciones de materiales (menciones a la empresa y yacimientos reales)
# ---------------------------------------------------------------------------

_REEMPLAZOS_TEXTO = (
    # Convencion ya usada en el catalogo: la operadora se llama "ACME Energy"
    (re.compile(r"\bREPSOL\s*", re.IGNORECASE), ""),
    (re.compile(r"REPSOL", re.IGNORECASE), ""),
    (re.compile(r"\bYPF\b", re.IGNORECASE), "ACME Energy"),
    (re.compile(r"YPF", re.IGNORECASE), "ACME"),  # dentro de codigos (YPF11, RYPF-90)
    (re.compile(r"\bloma\s+la\s+lata\b", re.IGNORECASE), "yacimiento norte"),
    (re.compile(r"\bloma\s+campana\b", re.IGNORECASE), "yacimiento sur"),
)

_TERMINOS = ("YPF", "REPSOL", "LOMA LA LATA", "LOMA CAMPANA")

# (base, tabla, clave_pg, [columnas])
_TEXTOS = (
    ("master_materiales", "catalogo_materiales", "codigo", ("descripcion", "descripcion_larga")),
    ("master_materiales", "materiales_equivalencias", "id", ("texto_breve_base", "texto_breve_equivalente")),
    ("sap_data", "stock", "id", ("material_descripcion",)),
    ("sap_data", "consumo_historico", "id", ("descripcion",)),
    ("sap_data", "pedidos_sap", "id", ("descripcion",)),
    ("sap_data", "materiales_bbdd", "id", ("descripcion",)),
)


def _anonimizar_texto(valor):
    if not isinstance(valor, str):
        return valor
    for patron, reemplazo in _REEMPLAZOS_TEXTO:
        valor = patron.sub(reemplazo, valor)
    return valor


def _descripciones(get_conn, is_pg, log):
    for db, tabla, clave_pg, columnas in _TEXTOS:
        with get_conn(db) as conn:
            cur = conn.cursor()
            if not _base(cur, is_pg, tabla):
                continue
            existentes = _cols(cur, tabla, is_pg)
            columnas = [c for c in columnas if c in existentes]
            clave = clave_pg if (is_pg or tabla == "catalogo_materiales") else "rowid"
            if not columnas or (is_pg and clave not in existentes):
                continue
            filtro = " OR ".join(
                f'UPPER("{c}") LIKE ?' for c in columnas for _ in _TERMINOS
            )
            params = tuple(f"%{t}%" for _c in columnas for t in _TERMINOS)
            cur.execute(f'SELECT {clave}, {", ".join(chr(34) + c + chr(34) for c in columnas)} FROM "{tabla}" WHERE {filtro}', params)
            filas = _filas(cur)
            cambiadas = 0
            for fila in filas:
                nuevos = [_anonimizar_texto(fila[i + 1]) for i in range(len(columnas))]
                if nuevos != [fila[i + 1] for i in range(len(columnas))]:
                    sets = ", ".join(f'"{c}" = ?' for c in columnas)
                    cur.execute(f'UPDATE "{tabla}" SET {sets} WHERE {clave} = ?', (*nuevos, fila[0]))
                    cambiadas += 1
            conn.commit()
            log.append(f"{tabla}: descripciones anonimizadas {cambiadas}")


# ---------------------------------------------------------------------------
# SPM (solicitudes, proveedor interno)
# ---------------------------------------------------------------------------


def _spm(conn, is_pg, log):
    cur = conn.cursor()
    t_sol = _base(cur, is_pg, "solicitudes", "solicitud")
    t_usr = _base(cur, is_pg, "usuarios", "usuario")

    log.append(
        f"{t_sol}.almacen_virtual remapeadas: {_remap_total(cur, t_sol, 'almacen_virtual', MAPA_ALMACENES, ALMACENES)}"
    )

    # Decisiones del planificador: origen (y destino si existe) de cada fuente
    t_dec = _base(cur, is_pg, "decision_abastecimiento_fuentes")
    if t_dec:
        cols_dec = _cols(cur, t_dec, is_pg)
        for col in ("centro_origen", "centro_destino"):
            if col in cols_dec:
                log.append(f"{t_dec}.{col}: {_remap_total(cur, t_dec, col, MAPA_CENTROS, CENTROS)}")
        for col in ("almacen_origen", "almacen_destino"):
            if col in cols_dec:
                log.append(f"{t_dec}.{col}: {_remap_total(cur, t_dec, col, MAPA_ALMACENES, ALMACENES)}")
    cur.execute(
        f"UPDATE {t_sol} SET almacen_virtual = '0001' WHERE almacen_virtual IS NULL OR almacen_virtual = ''"
    )
    log.append(f"{t_sol}.almacen_virtual vacias -> 0001: {cur.rowcount}")

    # Centro vacio o invalido: primer centro valido del solicitante
    ph = ",".join("?" * len(CENTROS))
    cur.execute(f"SELECT id, id_usuario FROM {t_sol} WHERE centro IS NULL OR centro NOT IN ({ph})", CENTROS)
    arreglar = _filas(cur)
    for sid, uid in arreglar:
        cur.execute(f"SELECT centros FROM {t_usr} WHERE id_spm = ?", (str(uid),))
        row = cur.fetchone()
        centros = [c.strip() for c in ((row[0] if row else "") or "").split(",") if c.strip() in CENTROS]
        cur.execute(f"UPDATE {t_sol} SET centro = ? WHERE id = ?", (centros[0] if centros else "AA101", sid))
    log.append(f"{t_sol}.centro corregidas: {len(arreglar)}")

    # Proveedor interno: sin prefijo SEED_ y matriz completa 6x6
    t_pi = _base(cur, is_pg, "proveedor_interno", "proveedores_internos")
    if t_pi:
        cur.execute(f"UPDATE {t_pi} SET centro = REPLACE(centro, 'SEED_', '') WHERE centro LIKE 'SEED_%'")
        log.append(f"{t_pi}.centro sin prefijo SEED_: {cur.rowcount}")
        cur.execute("SELECT codigo, nombre FROM catalogo_almacen")
        nombres_alm = {r[0]: r[1] for r in _filas(cur)}
        cur.execute("SELECT codigo, nombre FROM catalogo_centro")
        nombres_cen = {r[0]: r[1] for r in _filas(cur)}
        agregados = 0
        for centro in CENTROS:
            cur.execute(
                f"SELECT sector, contacto_centro, responsable_centro, referente_id, referente_nombre, "
                f"referente_email FROM {t_pi} WHERE centro = ? LIMIT 1",
                (centro,),
            )
            base = cur.fetchone()
            base = tuple(base[i] for i in range(len(base))) if base else ("Almacenes", None, None, None, None, None)
            for alm in ALMACENES:
                cur.execute(f"SELECT 1 FROM {t_pi} WHERE centro = ? AND almacen = ?", (centro, alm))
                if cur.fetchone():
                    continue
                cur.execute(
                    f"INSERT INTO {t_pi} (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, "
                    f"responsable_centro, referente_id, referente_nombre, referente_email, activo, notas) "
                    f"VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (centro, alm, nombres_cen.get(centro), nombres_alm.get(alm)) + base
                    + (True, f"Almacen {nombres_alm.get(alm)} del centro {nombres_cen.get(centro)}"),
                )
                agregados += 1
        log.append(f"{t_pi} combinaciones centro/almacen agregadas: {agregados}")
    conn.commit()


# ---------------------------------------------------------------------------
# Verificacion
# ---------------------------------------------------------------------------


def verificar(get_conn, is_pg):
    """Lista de (tabla, columna, valor, filas) fuera de catalogo."""
    problemas = []
    revisar = [("sap_data", (t,), c) for t in TABLAS_SAP for c in ("centro", "almacen")] + [
        ("spm", ("solicitudes", "solicitud"), "centro"),
        ("spm", ("solicitudes", "solicitud"), "almacen_virtual"),
        ("spm", ("proveedor_interno",), "centro"),
        ("spm", ("proveedor_interno",), "almacen"),
        ("spm", ("decision_abastecimiento_fuentes",), "centro_origen"),
        ("spm", ("decision_abastecimiento_fuentes",), "almacen_origen"),
    ]
    for db, nombres, col in revisar:
        validos = CENTROS if col.startswith("centro") else ALMACENES
        with get_conn(db) as conn:
            cur = conn.cursor()
            t = _base(cur, is_pg, *nombres)
            if not t or col not in _cols(cur, t, is_pg):
                continue
            ph = ",".join("?" * len(validos))
            cur.execute(
                f"SELECT \"{col}\", COUNT(*) FROM \"{t}\" WHERE \"{col}\" IS NOT NULL AND \"{col}\" <> '' "
                f"AND \"{col}\" NOT IN ({ph}) GROUP BY 1",
                validos,
            )
            problemas += [(t, col, r[0], r[1]) for r in _filas(cur)]
    return problemas


def up():
    from backend.core.db import get_db_connection, is_using_postgresql

    is_pg = is_using_postgresql()
    log = []
    with get_db_connection("sap_data") as conn:
        _sap(conn, is_pg, log)
    with get_db_connection() as conn:
        _spm(conn, is_pg, log)
    _descripciones(get_db_connection, is_pg, log)
    for linea in log:
        print("  -", linea)

    problemas = verificar(get_db_connection, is_pg)
    if problemas:
        for p in problemas:
            print("  FUERA DE CATALOGO:", p)
        raise RuntimeError(f"Migration 100: quedan {len(problemas)} valores fuera de catalogo")
    print("Migration 100: centros y almacenes consolidados; datos SAP anonimizados")


def down():
    print("Migration 100: irreversible (anonimizacion). Restaurar desde backup si es necesario.")


if __name__ == "__main__":
    up()
