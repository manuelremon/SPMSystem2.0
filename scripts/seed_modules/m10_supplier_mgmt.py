"""
Seed Module 10: Supplier Management
Onboarding, portal, certificaciones, evaluaciones, ESG, riesgo, contactos, documentos.

Tablas:
- supplier_onboarding
- onboarding_documento
- onboarding_evaluacion
- proveedor_certificacion
- portal_proveedor_usuario
- proveedor_evaluacion
- proveedor_esg_score
- proveedor_ext_contactos
- portal_proveedor_documento
- proveedor_riesgo
"""

import random

from ._base import (
    RUBROS,
    SEED_PREFIX,
    SEED_TAG,
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_future_date,
    rand_past_date,
    seed_code,
)

ONBOARDING_ESTADOS = [
    "draft",
    "submitted",
    "under_review",
    "approved",
    "active",
    "suspended",
    "rejected",
]

DOCUMENTO_TIPOS = [
    "afip",
    "iibb",
    "seguro",
    "certificado_calidad",
    "balance",
]

DOCUMENTO_ESTADOS = ["pending", "aprobado", "rechazado", "vencido"]

EVALUACION_CRITERIOS = [
    "capacidad_tecnica",
    "solidez_financiera",
    "experiencia",
    "calidad",
    "precio",
    "plazo_entrega",
]

CERTIFICACION_TIPOS = [
    "ISO_9001",
    "ISO_14001",
    "ISO_45001",
    "HACCP",
    "custom",
]

CERTIFICACION_ORGANISMOS = [
    "Bureau Veritas",
    "SGS",
    "TUV",
    "IRAM",
    "DNV",
    "Lloyd's",
]

CERTIFICACION_ESTADOS = ["active", "expired", "revoked", "pending_renewal"]

PORTAL_DOC_TIPOS = [
    "factura",
    "remito",
    "certificado",
    "constancia_afip",
    "poliza_seguro",
]

PORTAL_DOC_ESTADOS = ["pending", "approved", "rejected"]

RIESGO_TIPOS = [
    "financiero",
    "operativo",
    "logistico",
    "calidad",
    "reputacional",
    "geopolitico",
]

RIESGO_NIVELES = ["bajo", "medio", "alto", "critico"]

RIESGO_ESTADOS = ["identified", "mitigated", "accepted", "monitoring"]

ESG_NIVELES = ["A", "B", "C", "D", "E"]

CARGOS_CONTACTO = [
    "Gerente Comercial",
    "Director de Ventas",
    "Ejecutivo de Cuenta",
    "Responsable Logistica",
    "Gerente de Calidad",
    "Administracion",
]


def _fake_cuit(idx):
    """Genera un CUIT pseudo-unico con prefijo SEED."""
    base = 20000000000 + idx * 1117
    cuit_num = str(base)[:11].ljust(11, "0")
    return f"{SEED_PREFIX}{cuit_num[:2]}-{cuit_num[2:10]}-{cuit_num[10]}"


def _fake_periodo(months_back=12):
    """Genera string YYYY-MM aleatorio dentro de los ultimos N meses."""
    from datetime import datetime, timedelta

    delta = random.randint(0, months_back)
    dt = datetime.now() - timedelta(days=delta * 30)
    return dt.strftime("%Y-%m")


class SupplierMgmtSeed(SeedModule):
    name = "supplier_mgmt"
    description = "Onboarding, portal, certificaciones, evaluaciones, ESG, riesgo"
    tables = [
        "proveedor_riesgo",
        "portal_proveedor_documento",
        "proveedor_ext_contactos",
        "proveedor_esg_score",
        "proveedor_evaluacion",
        "portal_proveedor_usuario",
        "proveedor_certificacion",
        "onboarding_evaluacion",
        "onboarding_documento",
        "supplier_onboarding",
    ]

    def seed(self):
        onboarding_ids = self._seed_supplier_onboarding()
        self._seed_onboarding_documentos(onboarding_ids)
        self._seed_onboarding_evaluaciones(onboarding_ids)
        self._seed_proveedor_certificacion()
        self._seed_portal_proveedor_usuario()
        self._seed_proveedor_evaluacion()
        self._seed_proveedor_esg_score()
        self._seed_proveedor_ext_contactos()
        self._seed_portal_proveedor_documento()
        self._seed_proveedor_riesgo()

    # ------------------------------------------------------------------
    # supplier_onboarding  (~10 records)
    # ------------------------------------------------------------------
    def _seed_supplier_onboarding(self):
        onboarding_ids = []

        for i in range(1, 11):
            estado = pick(ONBOARDING_ESTADOS)
            score = None
            evaluado_por = None
            notas_rechazo = None

            if estado in ("approved", "rejected", "under_review", "active"):
                score = round(random.uniform(1, 100), 2)
                evaluado_por = self.refs.rand_admin()

            if estado == "rejected":
                notas_rechazo = f"{SEED_TAG} {fake.sentence(nb_words=10)}"

            row = {
                "razon_social": f"{SEED_TAG} {fake.company()}",
                "cuit": _fake_cuit(i),
                "rubro": pick(RUBROS),
                "contacto_nombre": fake.name(),
                "contacto_email": fake.email(),
                "contacto_telefono": fake.phone_number(),
                "direccion": fake.street_address(),
                "ciudad": fake.city(),
                "provincia": fake.province(),
                "pais": "Argentina",
                "sitio_web": fake.url() if random.random() > 0.5 else None,
                "estado": estado,
                "score_calificacion": score,
                "evaluado_por": evaluado_por,
                "notas_rechazo": notas_rechazo,
                "created_at": rand_datetime(days_back=300),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                oid = self.insert("supplier_onboarding", row)
                if oid:
                    onboarding_ids.append(oid)
            except Exception:
                pass

        self.log(f"supplier_onboarding: {len(onboarding_ids)} insertados")
        return onboarding_ids

    # ------------------------------------------------------------------
    # onboarding_documento  (~20 records, 2 per onboarding)
    # ------------------------------------------------------------------
    def _seed_onboarding_documentos(self, onboarding_ids):
        count = 0

        for idx, oid in enumerate(onboarding_ids):
            tipos = random.sample(DOCUMENTO_TIPOS, 2)

            for doc_num, tipo in enumerate(tipos):
                n = idx * 2 + doc_num + 1
                estado_doc = pick(DOCUMENTO_ESTADOS)
                verificado_por = None
                fecha_verificacion = None
                notas = None

                if estado_doc in ("aprobado", "rechazado", "vencido"):
                    verificado_por = self.refs.rand_admin()
                    fecha_verificacion = rand_past_date(1, 60)

                row = {
                    "onboarding_id": oid,
                    "tipo": tipo,
                    "nombre_archivo": f"{SEED_PREFIX}doc_{tipo}_{n:04d}.pdf",
                    "ruta_archivo": f"/uploads/onboarding/{SEED_PREFIX}doc_{tipo}_{n:04d}.pdf",
                    "estado": estado_doc,
                    "verificado_por": verificado_por,
                    "fecha_verificacion": fecha_verificacion,
                    "created_at": rand_datetime(days_back=200),
                }
                try:
                    self.insert_no_return("onboarding_documento", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"onboarding_documento: {count} insertados")

    # ------------------------------------------------------------------
    # onboarding_evaluacion  (~30 records, 3 criteria per onboarding)
    # ------------------------------------------------------------------
    def _seed_onboarding_evaluaciones(self, onboarding_ids):
        count = 0

        for oid in onboarding_ids:
            criterios = random.sample(EVALUACION_CRITERIOS, 3)
            pesos = [round(random.uniform(0.5, 3.0), 2) for _ in criterios]

            for criterio, peso in zip(criterios, pesos):
                row = {
                    "onboarding_id": oid,
                    "criterio": criterio,
                    "puntaje": round(random.uniform(0, 100), 2),
                    "peso": peso,
                    "comentarios": f"{SEED_TAG} {fake.sentence(nb_words=8)}",
                    "evaluador_id": self.refs.rand_admin(),
                    "created_at": rand_datetime(days_back=180),
                }
                try:
                    self.insert_no_return("onboarding_evaluacion", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"onboarding_evaluacion: {count} insertados")

    # ------------------------------------------------------------------
    # proveedor_certificacion  (~15 records)
    # ------------------------------------------------------------------
    def _seed_proveedor_certificacion(self):
        count = 0

        for i in range(15):
            cuit = self.refs.rand_proveedor()
            tipo = pick(CERTIFICACION_TIPOS)
            estado = pick(CERTIFICACION_ESTADOS)

            fecha_emision = rand_past_date(30, 730)
            fecha_vencimiento = (
                rand_future_date(30, 365)
                if estado != "expired"
                else rand_past_date(1, 90)
            )

            row = {
                "proveedor_cuit": cuit,
                "tipo": tipo,
                "nombre": f"{SEED_TAG} {tipo} - {fake.company_suffix()}",
                "organismo_certificador": pick(CERTIFICACION_ORGANISMOS),
                "numero_certificado": seed_code("CERT", i + 1),
                "fecha_emision": rand_datetime(days_back=730),
                "fecha_vencimiento": rand_datetime(days_back=0, days_forward=365) if estado != "expired" else rand_datetime(days_back=90),
                "estado": estado,
                "documento_path": f"/uploads/certs/{SEED_PREFIX}cert_{i+1:04d}.pdf",
                "created_at": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("proveedor_certificacion", row)
                count += 1
            except Exception:
                pass

        self.log(f"proveedor_certificacion: {count} insertados")

    # ------------------------------------------------------------------
    # portal_proveedor_usuario  (~10 records)
    # ------------------------------------------------------------------
    def _seed_portal_proveedor_usuario(self):
        count = 0
        used_emails = set()

        for i in range(10):
            cuit = self.refs.rand_proveedor()
            email = fake.email()
            attempts = 0
            while email in used_emails and attempts < 10:
                email = fake.email()
                attempts += 1
            used_emails.add(email)

            estado = pick(["pending", "active", "suspended"])
            ultimo_login = rand_datetime(days_back=30) if estado == "active" else None

            row = {
                "proveedor_cuit": cuit,
                "email": email,
                "nombre": f"{SEED_TAG} {fake.name()}",
                "password_hash": "$2b$12$seedhashplaceholder000000000000000000000000000000",
                "estado": estado,
                "ultimo_login": ultimo_login,
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("portal_proveedor_usuario", row)
                count += 1
            except Exception:
                pass

        self.log(f"portal_proveedor_usuario: {count} insertados")

    # ------------------------------------------------------------------
    # proveedor_evaluacion  (~20 records)
    # ------------------------------------------------------------------
    def _seed_proveedor_evaluacion(self):
        count = 0
        used = set()

        for _ in range(20):
            cuit = self.refs.rand_proveedor()
            periodo = _fake_periodo(months_back=12)
            key = (cuit, periodo)
            attempts = 0
            while key in used and attempts < 10:
                periodo = _fake_periodo(months_back=12)
                key = (cuit, periodo)
                attempts += 1
            used.add(key)

            s_entrega = round(random.uniform(1, 10), 2)
            s_calidad = round(random.uniform(1, 10), 2)
            s_precio = round(random.uniform(1, 10), 2)
            s_servicio = round(random.uniform(1, 10), 2)
            s_global = round(
                (s_entrega + s_calidad + s_precio + s_servicio) / 4, 2
            )

            row = {
                "proveedor_id": cuit,
                "proveedor_nombre": fake.company(),
                "periodo": periodo,
                "entrega_score": s_entrega,
                "calidad_score": s_calidad,
                "precio_score": s_precio,
                "servicio_score": s_servicio,
                "score_global": s_global,
                "evaluado_por": self.refs.rand_admin(),
                "notas": f"{SEED_TAG} {fake.sentence(nb_words=10)}",
                "created_at": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("proveedor_evaluacion", row)
                count += 1
            except Exception:
                pass

        self.log(f"proveedor_evaluacion: {count} insertados")

    # ------------------------------------------------------------------
    # proveedor_esg_score  (~10 records)
    # ------------------------------------------------------------------
    def _seed_proveedor_esg_score(self):
        count = 0
        used = set()

        for _ in range(10):
            cuit = self.refs.rand_proveedor()
            # Avoid duplicate proveedor_cuit
            attempts = 0
            while cuit in used and attempts < 10:
                cuit = self.refs.rand_proveedor()
                attempts += 1
            used.add(cuit)

            s_env = round(random.uniform(20, 100), 2)
            s_social = round(random.uniform(20, 100), 2)
            s_gov = round(random.uniform(20, 100), 2)
            s_overall = round(
                s_env * 0.4 + s_social * 0.35 + s_gov * 0.25, 2
            )

            from datetime import datetime

            year = datetime.now().year
            periodo = f"{year}-Q{random.randint(1, 4)}"

            row = {
                "proveedor_cuit": cuit,
                "periodo": periodo,
                "environmental_score": s_env,
                "social_score": s_social,
                "governance_score": s_gov,
                "overall_score": s_overall,
                "certificaciones_activas": random.randint(0, 5),
                "incidentes_ambientales": random.randint(0, 3),
                "incidentes_sociales": random.randint(0, 2),
                "evaluado_por": self.refs.rand_admin(),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("proveedor_esg_score", row)
                count += 1
            except Exception:
                pass

        self.log(f"proveedor_esg_score: {count} insertados")

    # ------------------------------------------------------------------
    # proveedor_ext_contactos  (~20 records)
    # ------------------------------------------------------------------
    def _seed_proveedor_ext_contactos(self):
        count = 0

        for i in range(20):
            cuit = self.refs.rand_proveedor()
            es_principal = i < 5  # First 5 are principal contacts

            row = {
                "cuit_proveedor": cuit,
                "nombre": f"{SEED_TAG} {fake.first_name()}",
                "apellido": fake.last_name(),
                "cargo": pick(CARGOS_CONTACTO),
                "es_principal": es_principal,
                "created_at": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("proveedor_ext_contactos", row)
                count += 1
            except Exception:
                pass

        self.log(f"proveedor_ext_contactos: {count} insertados")

    # ------------------------------------------------------------------
    # portal_proveedor_documento  (~15 records)
    # ------------------------------------------------------------------
    def _seed_portal_proveedor_documento(self):
        count = 0
        acciones = ["login", "upload", "download", "view", "update", "delete"]
        entidad_tipos = ["documento", "factura", "certificado", "remito", "orden_compra"]

        for i in range(15):
            row = {
                "usuario_id": int(self.refs.rand_user()),
                "accion": pick(acciones),
                "entidad_tipo": pick(entidad_tipos),
                "entidad_id": str(random.randint(1, 500)),
                "ip_address": f"{random.randint(10,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
                "user_agent": f"{SEED_TAG} Mozilla/5.0 Chrome/{random.randint(110,125)}",
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("portal_proveedor_documento", row)
                count += 1
            except Exception:
                pass

        self.log(f"portal_proveedor_documento: {count} insertados")

    # ------------------------------------------------------------------
    # proveedor_riesgo  (~10 records)
    # ------------------------------------------------------------------
    def _seed_proveedor_riesgo(self):
        count = 0

        for i in range(10):
            cuit = self.refs.rand_proveedor()
            r_financiero = round(random.uniform(0, 100), 2)
            r_entrega = round(random.uniform(0, 100), 2)
            r_calidad = round(random.uniform(0, 100), 2)
            r_dependencia = round(random.uniform(0, 100), 2)
            r_geografico = round(random.uniform(0, 100), 2)
            score_riesgo = round(
                (r_financiero + r_entrega + r_calidad + r_dependencia + r_geografico) / 5, 2
            )

            if score_riesgo >= 75:
                nivel = "critical"
            elif score_riesgo >= 50:
                nivel = "high"
            elif score_riesgo >= 25:
                nivel = "medium"
            else:
                nivel = "low"

            row = {
                "proveedor_cuit": cuit,
                "score_riesgo": score_riesgo,
                "nivel": nivel,
                "riesgo_financiero": r_financiero,
                "riesgo_entrega": r_entrega,
                "riesgo_calidad": r_calidad,
                "riesgo_dependencia": r_dependencia,
                "riesgo_geografico": r_geografico,
                "es_fuente_unica": 1 if random.random() > 0.7 else 0,
                "materiales_exclusivos": random.randint(0, 10) if random.random() > 0.5 else None,
                "pais": "Argentina",
                "provincia": fake.province(),
                "evaluado_por": self.refs.rand_admin(),
                "fecha_evaluacion": rand_datetime(days_back=180),
                "created_at": rand_datetime(days_back=365),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("proveedor_riesgo", row)
                count += 1
            except Exception:
                pass

        self.log(f"proveedor_riesgo: {count} insertados")

    # ------------------------------------------------------------------
    # clean
    # ------------------------------------------------------------------
    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "proveedor_riesgo": "provincia",
            "portal_proveedor_documento": "user_agent",
            "proveedor_ext_contactos": "nombre",
            "proveedor_esg_score": None,
            "proveedor_evaluacion": "notas",
            "portal_proveedor_usuario": "nombre",
            "proveedor_certificacion": "nombre",
            "onboarding_evaluacion": "comentarios",
            "onboarding_documento": "nombre_archivo",
            "supplier_onboarding": "razon_social",
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
