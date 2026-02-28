"""
Seed Module 16: Admin Config
Configuración de sistema, webhooks, SLA, reportes programados.

Tablas reales en PG:
- sla_configuracion
- sla_alertas
- webhook
- webhook_delivery
- reporte_programado
- reporte_historial
- reporte_destinatario
- regla_auto_aprobacion
- audit_trail
"""

import json
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
    rand_past_date,
    seed_code,
)


class AdminConfigSeed(SeedModule):
    name = "admin_config"
    description = "Dashboards, reportes, SLA, webhooks, config"
    tables = [
        "reporte_destinatario",
        "reporte_historial",
        "reporte_programado",
        "webhook_delivery",
        "webhook",
        "sla_alertas",
        "sla_configuracion",
        "regla_auto_aprobacion",
        "audit_trail",
    ]

    def seed(self):
        self._seed_sla_configuracion()
        self._seed_sla_alertas()
        self._seed_webhooks()
        self._seed_webhook_deliveries()
        self._seed_reportes()
        self._seed_reglas_auto_aprobacion()
        self._seed_audit_trail()

    # ------------------------------------------------------------------
    # sla_configuracion  (~8 records)
    # Columns: id, tipo_solicitud, criticidad, tiempo_limite_horas, activo, created_at
    # ------------------------------------------------------------------
    def _seed_sla_configuracion(self):
        count = 0
        tipos_solicitud = [
            "solicitud_material",
            "solicitud_servicio",
            "solicitud_emergencia",
            "solicitud_proyecto",
        ]
        criticidades = ["alta", "baja"]
        horas_map = {
            ("solicitud_material", "alta"): 24,
            ("solicitud_material", "baja"): 72,
            ("solicitud_servicio", "alta"): 12,
            ("solicitud_servicio", "baja"): 48,
            ("solicitud_emergencia", "alta"): 4,
            ("solicitud_emergencia", "baja"): 24,
            ("solicitud_proyecto", "alta"): 48,
            ("solicitud_proyecto", "baja"): 168,
        }
        for tipo in tipos_solicitud:
            for crit in criticidades:
                row = {
                    "tipo_solicitud": f"{SEED_PREFIX}{tipo}",
                    "criticidad": crit,
                    "tiempo_limite_horas": horas_map[(tipo, crit)],
                    "activo": True,
                    "created_at": rand_datetime(days_back=365),
                }
                try:
                    self.insert_no_return("sla_configuracion", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"sla_configuracion: {count} insertados")

    # ------------------------------------------------------------------
    # sla_alertas  (~15 records)
    # Columns: id, solicitud_id, tipo_alerta, mensaje, resuelta, created_at
    # ------------------------------------------------------------------
    def _seed_sla_alertas(self):
        count = 0
        tipos_alerta = [
            "vencimiento_proximo",
            "sla_excedido",
            "escalamiento",
            "recordatorio",
        ]
        for i in range(1, 16):
            solicitud_id = self.refs.rand_solicitud()
            if not solicitud_id:
                continue
            row = {
                "solicitud_id": solicitud_id,
                "tipo_alerta": pick(tipos_alerta),
                "mensaje": f"{SEED_TAG} SLA alerta #{i}: {fake.sentence(nb_words=8)}",
                "resuelta": pick([True, False, False]),
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("sla_alertas", row)
                count += 1
            except Exception:
                pass
        self.log(f"sla_alertas: {count} insertados")

    # ------------------------------------------------------------------
    # webhook  (~5 records)
    # Columns: id, url, secret, eventos, activo, created_by, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_webhooks(self):
        count = 0
        eventos_list = [
            "solicitud.created",
            "solicitud.approved",
            "oc.created",
            "shipment.delivered",
            "ncr.created",
        ]
        for i, evento in enumerate(eventos_list, 1):
            admin_id = self.refs.rand_admin()
            row = {
                "url": f"https://example.com/webhook/{SEED_PREFIX}{i}",
                "secret": f"{SEED_PREFIX}secret_{i}",
                "eventos": evento,
                "activo": 1,
                "created_by": str(admin_id),
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("webhook", row)
                count += 1
            except Exception:
                pass
        self.log(f"webhook: {count} insertados")

    # ------------------------------------------------------------------
    # webhook_delivery  (~15 records)
    # Columns: id, webhook_id, evento, status_code, success, response_body, created_at
    # ------------------------------------------------------------------
    def _seed_webhook_deliveries(self):
        count = 0
        eventos = [
            "solicitud.created",
            "solicitud.approved",
            "oc.created",
            "shipment.delivered",
            "ncr.created",
        ]
        for i in range(1, 16):
            status_code = pick([200, 200, 200, 201, 500, 502, 0])
            success = 1 if status_code and status_code < 300 else 0
            row = {
                "webhook_id": random.randint(1, 5),
                "evento": pick(eventos),
                "status_code": status_code,
                "success": success,
                "response_body": f"{SEED_TAG} {'OK' if success else 'Error'}: delivery {i}",
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("webhook_delivery", row)
                count += 1
            except Exception:
                pass
        self.log(f"webhook_delivery: {count} insertados")

    # ------------------------------------------------------------------
    # reporte_programado + reporte_historial + reporte_destinatario
    #
    # reporte_programado columns: id, nombre, tipo, frecuencia, filtros_json,
    #   destinatarios_json, formato, activo, creado_por, ultimo_envio,
    #   proximo_envio, created_at, updated_at
    #
    # reporte_historial columns: id, tipo_reporte, frecuencia, parametros,
    #   resultado, archivo_path, estado, created_at
    #
    # reporte_destinatario columns: id, reporte_id, email, nombre, created_at
    # ------------------------------------------------------------------
    def _seed_reportes(self):
        count_rep = 0
        count_hist = 0
        count_dest = 0

        reportes = [
            ("Stock Semanal", "stock", "semanal"),
            ("Solicitudes Pendientes", "solicitudes", "diario"),
            ("KPIs Mensuales", "kpis", "mensual"),
            ("Presupuesto por Centro", "presupuesto", "mensual"),
            ("Materiales Críticos", "materiales", "semanal"),
        ]
        report_ids = []
        for nombre, tipo, frecuencia in reportes:
            filtros = json.dumps({"centro": self.refs.rand_centro(), "seed": True})
            destinatarios = json.dumps([fake.email(), fake.email()])
            row = {
                "nombre": f"{SEED_TAG} {nombre}",
                "tipo": tipo,
                "frecuencia": frecuencia,
                "filtros_json": filtros,
                "destinatarios_json": destinatarios,
                "formato": pick(["xlsx", "pdf", "csv"]),
                "activo": 1,
                "creado_por": int(self.refs.rand_admin()),
                "ultimo_envio": rand_past_date(days_min=1, days_max=30),
                "proximo_envio": rand_future_date(days_min=1, days_max=30),
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                rid = self.insert("reporte_programado", row)
                if rid:
                    report_ids.append(rid)
                count_rep += 1
            except Exception:
                pass

        # reporte_historial: standalone table, ~10 records
        tipos_reporte = ["stock", "solicitudes", "kpi", "spend", "ordenes_compra"]
        estados_reporte = ["completado", "error", "pendiente"]
        for i in range(1, 11):
            row = {
                "tipo_reporte": pick(tipos_reporte),
                "frecuencia": pick(["diario", "semanal", "mensual", "manual"]),
                "parametros": json.dumps({"centro": self.refs.rand_centro(), "seed": True}),
                "resultado": f"{SEED_TAG} Resultado reporte #{i}",
                "archivo_path": f"/reports/seed_report_{i}.xlsx" if random.random() > 0.3 else None,
                "estado": pick(estados_reporte),
                "created_at": rand_datetime(days_back=60),
            }
            try:
                self.insert_no_return("reporte_historial", row)
                count_hist += 1
            except Exception:
                pass

        # reporte_destinatario: 2 per report
        for rid in report_ids:
            for _ in range(2):
                row = {
                    "reporte_id": rid,
                    "email": fake.email(),
                    "nombre": f"{SEED_TAG} {fake.name()}",
                    "created_at": rand_datetime(days_back=180),
                }
                try:
                    self.insert_no_return("reporte_destinatario", row)
                    count_dest += 1
                except Exception:
                    pass

        self.log(f"reporte_programado: {count_rep}, historial: {count_hist}, destinatarios: {count_dest}")

    # ------------------------------------------------------------------
    # regla_auto_aprobacion  (~5 records)
    # Columns: id, nombre, descripcion, condiciones_json, activo,
    #   centro_id, prioridad, creado_por, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_reglas_auto_aprobacion(self):
        count = 0
        for i in range(1, 6):
            condiciones = json.dumps({
                "monto_maximo": random.randint(5000, 100000),
                "tipo_solicitud": pick(["material", "servicio", "emergencia"]),
                "seed": True,
            }, ensure_ascii=False)
            centro = self.refs.rand_centro()
            row = {
                "nombre": f"{SEED_TAG} Regla auto-aprobacion {i}",
                "descripcion": f"{SEED_TAG} {fake.sentence(nb_words=6)}",
                "condiciones_json": condiciones,
                "activo": 1,
                "centro_id": centro if centro else "1000",
                "prioridad": (i * 10),
                "creado_por": int(self.refs.rand_admin()),
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("regla_auto_aprobacion", row)
                count += 1
            except Exception:
                pass
        self.log(f"regla_auto_aprobacion: {count} insertados")

    # ------------------------------------------------------------------
    # audit_trail  (~20 records)
    # Columns: id, entidad, entidad_id, accion, actor_id, campo_modificado,
    #   valor_anterior, valor_nuevo, actor_rol, ip_address, user_agent, created_at
    # ------------------------------------------------------------------
    def _seed_audit_trail(self):
        count = 0
        acciones = ["login", "create", "update", "delete", "approve", "reject"]
        entidades = ["solicitud", "orden_compra", "usuario", "presupuesto"]
        campos = ["estado", "cantidad", "precio", "prioridad", "asignado_a", None]
        roles = ["admin", "coordinador", "usuario", "planner", "jefe"]
        user_agents = [
            f"{SEED_TAG} Mozilla/5.0 Chrome/120",
            f"{SEED_TAG} Mozilla/5.0 Firefox/119",
            f"{SEED_TAG} Mozilla/5.0 Safari/17",
        ]
        for i in range(1, 21):
            accion = pick(acciones)
            campo = pick(campos)
            row = {
                "entidad": pick(entidades),
                "entidad_id": str(random.randint(1, 500)),
                "accion": accion,
                "actor_id": str(self.refs.rand_user()),
                "campo_modificado": campo,
                "valor_anterior": f"{SEED_TAG} {fake.word()}" if campo and accion == "update" else None,
                "valor_nuevo": f"{SEED_TAG} {fake.word()}" if campo and accion == "update" else None,
                "actor_rol": pick(roles),
                "ip_address": f"{random.randint(10,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
                "user_agent": pick(user_agents),
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("audit_trail", row)
                count += 1
            except Exception:
                pass
        self.log(f"audit_trail: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "reporte_destinatario": "nombre",
            "reporte_historial": "resultado",
            "reporte_programado": "nombre",
            "webhook_delivery": "response_body",
            "webhook": "url",
            "sla_alertas": "mensaje",
            "sla_configuracion": "tipo_solicitud",
            "regla_auto_aprobacion": "nombre",
            "audit_trail": "user_agent",
        }
        for table, col in clean_map.items():
            try:
                cursor.execute(
                    f"DELETE FROM {table} WHERE {col} LIKE ?",
                    (f"%{SEED_PREFIX}%",),
                )
                if cursor.rowcount and cursor.rowcount > 0:
                    self.log(f"Cleaned {cursor.rowcount} rows from {table}")
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
