"""
Seed Module 14: Customs & ECO
HS codes, operaciones aduaneras, declaraciones, acuerdos comerciales,
Engineering Change Orders.

Tablas:
- hs_code
- material_clasificacion_aduanera
- operacion_aduanera
- declaracion_aduanera
- declaracion_aduanera_item
- acuerdo_comercial
- eco
- eco_item
- eco_cambio
- eco_aprobacion
- eco_historial
"""

import random

from ._base import (
    SEED_PREFIX,
    SEED_TAG,
    SeedModule,
    fake,
    now_str,
    pick,
    rand_datetime,
    rand_future_date,
    rand_money,
    rand_past_date,
    seed_code,
)

# Realistic HS codes for industrial supply materials
HS_CODE_DATA = [
    ("8481.80.19", "Válvulas para oleoductos y tuberías industriales", "84", "8481", "848180", "UN"),
    ("7304.41.00", "Tubos y perfiles huecos sin costura de acero inoxidable", "73", "7304", "730441", "MT"),
    ("8544.42.90", "Conductores eléctricos para tensión <= 1000V con conector", "85", "8544", "854442", "MT"),
    ("8414.51.19", "Ventiladores axiales industriales de caudal > 125 m3/min", "84", "8414", "841451", "UN"),
    ("9026.10.19", "Instrumentos para medir caudal de líquidos (caudalímetros)", "90", "9026", "902610", "UN"),
    ("8481.20.00", "Válvulas para transmisiones oleohidráulicas o neumáticas", "84", "8481", "848120", "UN"),
    ("3919.90.00", "Placas y láminas autoadhesivas de plástico (etiquetas)", "39", "3919", "391990", "KG"),
    ("8431.49.90", "Partes para maquinaria de excavación y perforación", "84", "8431", "843149", "UN"),
    ("7318.15.00", "Tornillos y pernos de hierro o acero (rosca métrica)", "73", "7318", "731815", "KG"),
    ("3402.20.00", "Preparaciones para lavar y limpiar superficies (solventes)", "34", "3402", "340220", "LT"),
    ("8536.50.90", "Interruptores, seccionadores y conmutadores eléctricos", "85", "8536", "853650", "UN"),
    ("9032.89.90", "Instrumentos y aparatos para regulación automática", "90", "9032", "903289", "UN"),
    ("8421.39.90", "Aparatos para filtrar gases distintos del aire", "84", "8421", "842139", "UN"),
    ("7308.90.00", "Construcciones y sus partes de hierro o acero (estructuras)", "73", "7308", "730890", "KG"),
    ("2710.19.29", "Aceites lubricantes minerales para motores de combustión", "27", "2710", "271019", "LT"),
    ("8483.40.90", "Engranajes y trenes de engranajes (reductoras)", "84", "8483", "848340", "UN"),
    ("3926.90.90", "Otras manufacturas de plástico (juntas, sellos, cubiertas)", "39", "3926", "392690", "KG"),
    ("8501.52.00", "Motores eléctricos de CA, multifásicos de potencia > 750W", "85", "8501", "850152", "UN"),
    ("9022.90.90", "Partes y accesorios de aparatos de rayos X industriales", "90", "9022", "902290", "UN"),
    ("7616.99.00", "Manufacturas de aluminio (piezas mecanizadas, perfiles)", "76", "7616", "761699", "KG"),
]

PAISES = [
    "Argentina", "Brasil", "Chile", "Uruguay", "Paraguay",
    "China", "Alemania", "Estados Unidos", "Italia", "España",
    "Japón", "Corea del Sur", "India", "México", "Colombia",
]

PAISES_IMPORTACION = [
    "China", "Alemania", "Estados Unidos", "Italia", "España",
    "Japón", "Corea del Sur", "Brasil", "India", "México",
]

PUERTOS_ENTRADA = [
    "Buenos Aires", "Rosario", "Bahía Blanca", "La Plata",
    "Campana", "San Lorenzo", "Dock Sud", "Zárate",
]

ACUERDOS_COMERCIALES = [
    ("MERCOSUR", "mercosur", ["Brasil", "Uruguay", "Paraguay"]),
    ("CAN - Comunidad Andina", "otro", ["Colombia", "Perú", "Ecuador", "Bolivia"]),
    ("ACE Chile-Argentina", "bilateral", ["Chile"]),
    ("ACE México-Argentina", "bilateral", ["México"]),
    ("ALADI - Marco General", "gsp", ["Brasil", "Chile", "México", "Colombia", "Perú"]),
]

ACUERDO_ESTADOS = ["active", "expired"]

ECO_TIPOS = ["material", "proceso", "proveedor", "especificacion"]
ECO_PRIORIDADES = ["baja", "media", "alta", "critica"]
ECO_ESTADOS = ["borrador", "pendiente", "aprobado", "implementado", "rechazado", "cancelado"]

# Forward path for ECO state machine
ECO_FULL_PATH = ["borrador", "pendiente", "aprobado", "implementado"]
ECO_REJECTED_PATH = ["borrador", "pendiente", "rechazado"]
ECO_CANCELLED_PATH = ["borrador", "cancelado"]

CAMPO_AFECTADO_OPTIONS = [
    "especificacion_tecnica",
    "norma_calidad",
    "proveedor_homologado",
    "material_sustituto",
    "proceso_fabricacion",
    "tolerancia_dimensional",
    "tratamiento_superficial",
    "empaque_y_embalaje",
    "vida_util_estimada",
    "procedimiento_inspeccion",
]

ROL_APROBADOR_OPTIONS = ["admin", "gerente", "jefe_tecnico"]
DECISION_OPTIONS = ["aprobado", "rechazado", "condicional"]


def _eco_transition_chain(estado_final):
    """Build (prev, next) state pairs leading to estado_final."""
    if estado_final == "rechazado":
        path = list(ECO_REJECTED_PATH)
    elif estado_final == "cancelado":
        path = list(ECO_CANCELLED_PATH)
    elif estado_final in ECO_FULL_PATH:
        idx = ECO_FULL_PATH.index(estado_final)
        path = ECO_FULL_PATH[: idx + 1]
    else:
        path = ["borrador"]

    return [(path[k], path[k + 1]) for k in range(len(path) - 1)]


class CustomsEcoSeed(SeedModule):
    name = "customs"
    description = "HS codes, aduanas, declaraciones, ECO"
    tables = [
        # Child tables first (reverse dependency order for clean)
        "eco_historial",
        "eco_aprobacion",
        "eco_item",
        "eco_cambio",
        "eco",
        "declaracion_aduanera_item",
        "declaracion_aduanera",
        "acuerdo_comercial",
        "operacion_aduanera",
        "material_clasificacion_aduanera",
        "hs_code",
    ]

    def seed(self):
        hs_ids = self._seed_hs_codes()
        self._seed_material_clasificacion(hs_ids)
        self._seed_operaciones_aduaneras()
        decl_ids = self._seed_declaraciones_aduaneras()
        self._seed_declaracion_items(decl_ids)
        self._seed_acuerdos_comerciales()
        eco_ids = self._seed_ecos()
        self._seed_eco_items(eco_ids)
        self._seed_eco_cambios(eco_ids)
        self._seed_eco_aprobaciones(eco_ids)
        self._seed_eco_historial(eco_ids)

    # ------------------------------------------------------------------
    # hs_code  (~20 records)
    # Columns: id, codigo (NOT NULL), descripcion, arancel_pct (real, default 0),
    #          unidad_medida, capitulo, partida, subpartida, notas, created_at
    # ------------------------------------------------------------------
    def _seed_hs_codes(self):
        hs_ids = []

        for codigo, descripcion, capitulo, partida, subpartida, unidad in HS_CODE_DATA:
            arancel = round(random.choice([0, 2, 5, 10, 14, 20, 26, 35]), 2)
            row = {
                "codigo": codigo,
                "descripcion": descripcion,
                "arancel_pct": arancel,
                "unidad_medida": unidad,
                "capitulo": capitulo,
                "partida": partida,
                "subpartida": subpartida,
                "notas": f"{SEED_TAG} {fake.sentence(nb_words=8)}" if random.random() > 0.5 else None,
                "created_at": rand_datetime(days_back=730),
            }
            try:
                hid = self.insert("hs_code", row)
                if hid:
                    hs_ids.append(hid)
            except Exception:
                pass

        self.log(f"hs_code: {len(hs_ids)} insertados")
        return hs_ids

    # ------------------------------------------------------------------
    # material_clasificacion_aduanera  (~20 records)
    # Columns: id, material_codigo (NOT NULL), hs_code_id (int),
    #          pais_origen (default 'AR'), pais_destino,
    #          certificado_origen, created_at
    # ------------------------------------------------------------------
    def _seed_material_clasificacion(self, hs_ids):
        count = 0
        used_combinations = set()

        hs_pool = hs_ids if hs_ids else [1]

        attempts = 0
        while count < 20 and attempts < 80:
            attempts += 1
            material = self.refs.rand_material()
            pais_origen = pick(PAISES_IMPORTACION)
            pais_destino = "Argentina"

            combo = (material, pais_origen, pais_destino)
            if combo in used_combinations:
                continue
            used_combinations.add(combo)

            certificado = (
                f"{SEED_PREFIX}CERT-{random.randint(10000, 99999)}"
                if random.random() > 0.5
                else None
            )

            row = {
                "material_codigo": material,
                "hs_code_id": pick(hs_pool),
                "pais_origen": pais_origen,
                "pais_destino": pais_destino,
                "certificado_origen": certificado,
                "created_at": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("material_clasificacion_aduanera", row)
                count += 1
            except Exception:
                pass

        self.log(f"material_clasificacion_aduanera: {count} insertados")

    # ------------------------------------------------------------------
    # operacion_aduanera  (~10 records)
    # Columns: id, tipo (NOT NULL), numero_despacho, proveedor_cuit,
    #          fecha_operacion (NOT NULL), estado (default 'en_proceso'),
    #          valor_fob (real, default 0), flete (real, default 0),
    #          seguro (real, default 0), valor_cif (real, default 0),
    #          aranceles (real, default 0), impuestos_adicionales (real, default 0),
    #          total_tributos (real, default 0), moneda (default 'USD'),
    #          orden_compra_id (int), notas, created_at
    # ------------------------------------------------------------------
    def _seed_operaciones_aduaneras(self):
        count = 0

        for i in range(1, 11):
            fob = rand_money(5000, 200000)
            flete = round(fob * random.uniform(0.02, 0.08), 2)
            seguro = round(fob * random.uniform(0.005, 0.02), 2)
            valor_cif = round(fob + flete + seguro, 2)
            arancel_pct = random.choice([0, 5, 10, 14, 20])
            aranceles = round(valor_cif * arancel_pct / 100, 2)
            impuestos_adicionales = round(valor_cif * random.uniform(0.01, 0.05), 2)
            total_tributos = round(aranceles + impuestos_adicionales, 2)

            estado = pick(["en_proceso", "despachado", "liberado", "observado"])

            row = {
                "tipo": pick(["importacion", "exportacion"]),
                "numero_despacho": seed_code("DES", i),
                "proveedor_cuit": self.refs.rand_proveedor(),
                "fecha_operacion": rand_past_date(days_min=1, days_max=270),
                "estado": estado,
                "valor_fob": fob,
                "flete": flete,
                "seguro": seguro,
                "valor_cif": valor_cif,
                "aranceles": aranceles,
                "impuestos_adicionales": impuestos_adicionales,
                "total_tributos": total_tributos,
                "moneda": "USD",
                "orden_compra_id": random.randint(1, 50) if random.random() > 0.4 else None,
                "notas": f"{SEED_TAG} {fake.sentence(nb_words=9)}",
                "created_at": rand_datetime(days_back=270),
            }
            try:
                self.insert_no_return("operacion_aduanera", row)
                count += 1
            except Exception:
                pass

        self.log(f"operacion_aduanera: {count} insertados")

    # ------------------------------------------------------------------
    # declaracion_aduanera  (~8 records)
    # Columns: id, numero (NOT NULL), tipo (default 'import'),
    #          estado (default 'draft'), proveedor_cuit, pais_origen,
    #          puerto_entrada, fecha_arribo (date), valor_declarado (real, default 0),
    #          moneda (default 'USD'), arancel (real, default 0),
    #          impuestos (real, default 0), agente_aduanero, notas,
    #          created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_declaraciones_aduaneras(self):
        decl_ids = []

        for i in range(1, 9):
            valor = rand_money(10000, 500000)
            arancel_pct = random.choice([0, 5, 10, 14, 20, 26])
            arancel_val = round(valor * arancel_pct / 100, 2)
            impuestos_val = round(valor * random.uniform(0.01, 0.06), 2)

            estado = pick(["draft", "submitted", "approved", "rejected", "closed"])
            tipo = pick(["import", "export"])

            row = {
                "numero": seed_code("DECL", i),
                "tipo": tipo,
                "estado": estado,
                "proveedor_cuit": self.refs.rand_proveedor(),
                "pais_origen": pick(PAISES_IMPORTACION),
                "puerto_entrada": pick(PUERTOS_ENTRADA),
                "fecha_arribo": rand_past_date(days_min=1, days_max=180),
                "valor_declarado": valor,
                "moneda": "USD",
                "arancel": arancel_val,
                "impuestos": impuestos_val,
                "agente_aduanero": f"{SEED_TAG} {fake.company()}",
                "notas": f"{SEED_TAG} {fake.sentence(nb_words=8)}",
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                did = self.insert("declaracion_aduanera", row)
                if did:
                    decl_ids.append(did)
            except Exception:
                pass

        self.log(f"declaracion_aduanera: {len(decl_ids)} insertados")
        return decl_ids

    # ------------------------------------------------------------------
    # declaracion_aduanera_item  (~24 records, ~3 per declaracion)
    # Columns: id, declaracion_id (NOT NULL), material_codigo (NOT NULL),
    #          cantidad (real, NOT NULL), valor_unitario (real),
    #          codigo_arancelario, created_at
    # ------------------------------------------------------------------
    def _seed_declaracion_items(self, decl_ids):
        count = 0

        for decl_id in decl_ids:
            num_items = random.randint(2, 4)
            for _ in range(num_items):
                # Pick a random HS code string for codigo_arancelario
                hs_entry = pick(HS_CODE_DATA)
                row = {
                    "declaracion_id": decl_id,
                    "material_codigo": self.refs.rand_material(),
                    "cantidad": round(random.uniform(1, 500), 2),
                    "valor_unitario": rand_money(10, 5000),
                    "codigo_arancelario": hs_entry[0] if random.random() > 0.3 else None,
                    "created_at": rand_datetime(days_back=180),
                }
                try:
                    self.insert_no_return("declaracion_aduanera_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"declaracion_aduanera_item: {count} insertados")

    # ------------------------------------------------------------------
    # acuerdo_comercial  (~5 records)
    # Columns: id, nombre (NOT NULL), tipo (NOT NULL), pais_socio,
    #          preferencia_arancelaria_pct (real, default 0),
    #          fecha_vigencia_desde (date), fecha_vigencia_hasta (date),
    #          estado (default 'active'), requisitos_origen, created_at
    # ------------------------------------------------------------------
    def _seed_acuerdos_comerciales(self):
        count = 0

        for nombre, tipo, paises_socios in ACUERDOS_COMERCIALES:
            estado = pick(ACUERDO_ESTADOS)
            pais_socio = pick(paises_socios)
            preferencia = round(random.uniform(5, 100), 2)

            fecha_desde = rand_past_date(days_min=365, days_max=3650)
            if estado == "active":
                fecha_hasta = rand_future_date(days_min=180, days_max=1825)
            else:
                fecha_hasta = rand_past_date(days_min=30, days_max=365)

            row = {
                "nombre": f"{SEED_TAG} {nombre}",
                "tipo": tipo,
                "pais_socio": pais_socio,
                "preferencia_arancelaria_pct": preferencia,
                "fecha_vigencia_desde": fecha_desde,
                "fecha_vigencia_hasta": fecha_hasta,
                "estado": estado,
                "requisitos_origen": f"{SEED_TAG} {fake.paragraph(nb_sentences=2)}",
                "created_at": rand_datetime(days_back=1825),
            }
            try:
                self.insert_no_return("acuerdo_comercial", row)
                count += 1
            except Exception:
                pass

        self.log(f"acuerdo_comercial: {count} insertados")

    # ------------------------------------------------------------------
    # eco  (~8 records)
    # Columns: id, numero_eco (NOT NULL), titulo, descripcion, tipo,
    #          prioridad (default 'media'), estado (default 'draft'),
    #          material_codigo, solicitante_id (int), aprobador_id (int),
    #          fecha_efectividad (date), costo_estimado (real, default 0),
    #          impacto_inventario, impacto_proveedores, justificacion,
    #          created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_ecos(self):
        eco_ids = []

        titulos = [
            "Cambio de proveedor para válvulas de proceso",
            "Actualización especificación acero inoxidable 316L",
            "Sustitución de lubricante mineral por sintético",
            "Modificación tolerancias dimensionales bridas DN150",
            "Cambio proceso tratamiento superficial piezas mecanizadas",
            "Reemplazo conductor eléctrico tipo N por XHHW",
            "Actualización norma calidad filtros de línea",
            "Cambio proveedor instrumentación de medición",
        ]

        for i, titulo_base in enumerate(titulos, start=1):
            estado = pick(ECO_ESTADOS)
            aprobador_id = None
            if estado in ("aprobado", "implementado"):
                aprobador_id = self.refs.rand_admin()

            fecha_efectividad = (
                rand_future_date(days_min=10, days_max=180)
                if estado in ("aprobado", "pendiente")
                else rand_past_date(days_min=1, days_max=180)
            )

            row = {
                "numero_eco": seed_code("ECO", i),
                "titulo": f"{SEED_TAG} {titulo_base}",
                "descripcion": f"{SEED_TAG} {fake.paragraph(nb_sentences=3)}",
                "tipo": pick(ECO_TIPOS),
                "prioridad": pick(ECO_PRIORIDADES),
                "estado": estado,
                "material_codigo": self.refs.rand_material(),
                "solicitante_id": self.refs.rand_user(),
                "aprobador_id": aprobador_id,
                "fecha_efectividad": fecha_efectividad,
                "costo_estimado": rand_money(1000, 500000),
                "impacto_inventario": f"{SEED_TAG} {fake.sentence(nb_words=10)}",
                "impacto_proveedores": f"{SEED_TAG} {fake.sentence(nb_words=8)}",
                "justificacion": f"{SEED_TAG} {fake.paragraph(nb_sentences=2)}",
                "created_at": rand_datetime(days_back=240),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                eid = self.insert("eco", row)
                if eid:
                    eco_ids.append((eid, estado))
            except Exception:
                pass

        self.log(f"eco: {len(eco_ids)} insertados")
        return eco_ids

    # ------------------------------------------------------------------
    # eco_item  (~16 records, 2 per ECO)
    # Columns: id, eco_id (int), tipo_cambio, campo_afectado,
    #          valor_anterior, valor_nuevo,
    #          material_codigo_anterior, material_codigo_nuevo,
    #          proveedor_cuit_anterior, proveedor_cuit_nuevo, created_at
    # ------------------------------------------------------------------
    def _seed_eco_items(self, eco_ids):
        count = 0

        for eco_id, _ in eco_ids:
            for _ in range(2):
                campo = pick(CAMPO_AFECTADO_OPTIONS)
                tipo_c = pick(ECO_TIPOS)

                mat_anterior = None
                mat_nuevo = None
                prov_anterior = None
                prov_nuevo = None

                if tipo_c == "material":
                    mat_anterior = self.refs.rand_material()
                    mat_nuevo = self.refs.rand_material()
                elif tipo_c == "proveedor":
                    prov_anterior = self.refs.rand_proveedor()
                    prov_nuevo = self.refs.rand_proveedor()

                row = {
                    "eco_id": eco_id,
                    "tipo_cambio": tipo_c,
                    "campo_afectado": campo,
                    "valor_anterior": f"{SEED_TAG} {fake.word()}",
                    "valor_nuevo": f"{SEED_TAG} {fake.word()}",
                    "material_codigo_anterior": mat_anterior,
                    "material_codigo_nuevo": mat_nuevo,
                    "proveedor_cuit_anterior": prov_anterior,
                    "proveedor_cuit_nuevo": prov_nuevo,
                    "created_at": rand_datetime(days_back=200),
                }
                try:
                    self.insert_no_return("eco_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"eco_item: {count} insertados")

    # ------------------------------------------------------------------
    # eco_cambio  (~16 records, 2 per ECO)
    # Columns: id, eco_id (int), tipo_cambio, campo_afectado,
    #          valor_anterior, valor_nuevo,
    #          material_codigo_anterior, material_codigo_nuevo,
    #          proveedor_cuit_anterior, proveedor_cuit_nuevo, created_at
    # ------------------------------------------------------------------
    def _seed_eco_cambios(self, eco_ids):
        count = 0
        eco_cambio_tipos = ["replace_material", "modify_spec", "add_supplier", "remove_supplier", "change_price"]

        for eco_id, _ in eco_ids:
            for _ in range(2):
                campo = pick(CAMPO_AFECTADO_OPTIONS)
                tipo_c = pick(eco_cambio_tipos)

                mat_anterior = None
                mat_nuevo = None
                prov_anterior = None
                prov_nuevo = None

                if tipo_c == "replace_material":
                    mat_anterior = self.refs.rand_material()
                    mat_nuevo = self.refs.rand_material()
                elif tipo_c in ("add_supplier", "remove_supplier"):
                    prov_anterior = self.refs.rand_proveedor()
                    prov_nuevo = self.refs.rand_proveedor()

                row = {
                    "eco_id": eco_id,
                    "tipo_cambio": tipo_c,
                    "campo_afectado": campo,
                    "valor_anterior": f"{SEED_TAG} {fake.word()}",
                    "valor_nuevo": f"{SEED_TAG} {fake.word()}",
                    "material_codigo_anterior": mat_anterior,
                    "material_codigo_nuevo": mat_nuevo,
                    "proveedor_cuit_anterior": prov_anterior,
                    "proveedor_cuit_nuevo": prov_nuevo,
                    "created_at": rand_datetime(days_back=200),
                }
                try:
                    self.insert_no_return("eco_cambio", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"eco_cambio: {count} insertados")

    # ------------------------------------------------------------------
    # eco_aprobacion  (~8 records, 1 per ECO that passed borrador)
    # Columns: id, eco_id (int), aprobador_id (int), rol_aprobador,
    #          decision (default 'pending'), comentarios,
    #          fecha_decision (timestamp), created_at
    # ------------------------------------------------------------------
    def _seed_eco_aprobaciones(self, eco_ids):
        count = 0

        for eco_id, estado_eco in eco_ids:
            # Only ECOs that have reached pendiente or beyond get an approval record
            if estado_eco == "borrador":
                continue

            decision = "aprobado" if estado_eco in ("aprobado", "implementado") else pick(DECISION_OPTIONS)

            row = {
                "eco_id": eco_id,
                "aprobador_id": self.refs.rand_admin(),
                "rol_aprobador": pick(ROL_APROBADOR_OPTIONS),
                "decision": decision,
                "comentarios": f"{SEED_TAG} {fake.sentence(nb_words=10)}",
                "fecha_decision": rand_datetime(days_back=90),
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("eco_aprobacion", row)
                count += 1
            except Exception:
                pass

        self.log(f"eco_aprobacion: {count} insertados")

    # ------------------------------------------------------------------
    # eco_historial  (~24 records, state transitions)
    # Columns: id, eco_id (int), estado_anterior, estado_nuevo,
    #          actor_id (int), notas, created_at
    # ------------------------------------------------------------------
    def _seed_eco_historial(self, eco_ids):
        count = 0

        for eco_id, estado_final in eco_ids:
            chain = _eco_transition_chain(estado_final)
            for step, (estado_anterior, estado_nuevo) in enumerate(chain):
                row = {
                    "eco_id": eco_id,
                    "estado_anterior": estado_anterior,
                    "estado_nuevo": estado_nuevo,
                    "actor_id": self.refs.rand_user(),
                    "notas": f"{SEED_TAG} {fake.sentence(nb_words=8)}",
                    "created_at": rand_datetime(days_back=180 - step * 20),
                }
                try:
                    self.insert_no_return("eco_historial", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"eco_historial: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "eco_historial": "notas",
            "eco_aprobacion": "comentarios",
            "eco_item": "valor_anterior",
            "eco_cambio": "valor_anterior",
            "eco": "numero_eco",
            "declaracion_aduanera_item": "codigo_arancelario",
            "declaracion_aduanera": "numero",
            "acuerdo_comercial": "nombre",
            "operacion_aduanera": "numero_despacho",
            "material_clasificacion_aduanera": "certificado_origen",
            "hs_code": "codigo",
        }
        for table, col in clean_map.items():
            try:
                if col:
                    cursor.execute(
                        f"DELETE FROM {table} WHERE {col} LIKE ?",
                        (f"%{SEED_PREFIX}%",),
                    )
                    if cursor.rowcount and cursor.rowcount > 0:
                        self.log(f"Cleaned {cursor.rowcount} rows from {table}")
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
