"""
Seed Module 15: Communication
Mensajes internos, cola de emails salientes.

Tablas:
- mensajes
- outbox_emails
"""

import json
import random

from ._base import (
    SEED_PREFIX,
    SeedModule,
    fake,
    now_str,
    pick,
    rand_datetime,
    seed_code,
)

MENSAJE_TIPOS = ["mensaje", "comentario", "notificacion"]

ASUNTO_TEMPLATES = [
    "Consulta sobre OC pendiente",
    "Solicitud de aprobación urgente",
    "Actualización estado de entrega",
    "Revisión de presupuesto asignado",
    "Retraso en despacho de materiales",
    "Confirmación de recepción de stock",
    "Alerta de stock bajo mínimo",
    "Consulta técnica sobre especificaciones",
    "Solicitud de cotización adicional",
    "Informe de inspección recibido",
    "Cambio de proveedor aprobado",
    "Novedad en importación en curso",
    "Vencimiento de garantía próximo",
    "Seguimiento de reclamo abierto",
    "Aprobación de presupuesto requerida",
]

EMAIL_STATUS_OPTIONS = ["queued", "sent", "failed"]

EMAIL_SUBJECTS = [
    "Confirmación de orden de compra",
    "Notificación de despacho",
    "Alerta: stock crítico detectado",
    "Resumen semanal de operaciones",
    "Vencimiento próximo de contrato",
    "Solicitud de documentación adicional",
    "Aprobación de solicitud requerida",
    "Factura pendiente de pago",
    "Actualización de estado de importación",
    "Notificación automática SPM System",
    "Recordatorio: inspección programada",
    "Nuevo proveedor homologado",
    "Reporte mensual de KPIs",
    "Alerta: desvío de presupuesto",
    "Confirmación de garantía registrada",
]

METADATA_EXAMPLES = [
    {"source": "solicitud", "action": "comentario_agregado"},
    {"source": "procurement", "action": "oc_aprobada"},
    {"source": "quality", "action": "ncr_abierta"},
    {"source": "inventory", "action": "stock_bajo_minimo"},
    {"source": "contracts", "action": "vencimiento_proximo"},
]


class CommunicationSeed(SeedModule):
    name = "communication"
    description = "Mensajes, foro, trivias"
    tables = [
        "outbox_emails",
        "mensajes",
    ]

    def seed(self):
        msg_ids = self._seed_mensajes()
        self._seed_outbox_emails()

    # ------------------------------------------------------------------
    # mensajes  (~30 records)
    # ------------------------------------------------------------------
    def _seed_mensajes(self):
        msg_ids = []

        # First pass: create 20 root messages (no parent)
        root_ids = []
        for i in range(1, 21):
            remitente = self.refs.rand_user()
            # Destinatario must differ from remitente when possible
            destinatario = self.refs.rand_user()

            tipo = pick(MENSAJE_TIPOS)
            leido = random.randint(0, 1)
            solicitud_id = (
                self.refs.rand_solicitud()
                if random.random() > 0.5
                else None
            )
            metadata = (
                json.dumps(pick(METADATA_EXAMPLES))
                if random.random() > 0.6
                else None
            )

            asunto = f"{pick(ASUNTO_TEMPLATES)}"
            mensaje_body = f"{fake.paragraph(nb_sentences=random.randint(2, 5))}"

            created_ts = rand_datetime(days_back=180)
            updated_ts = rand_datetime(days_back=30)

            row = {
                "remitente_id": remitente,
                "destinatario_id": destinatario,
                "solicitud_id": solicitud_id,
                "asunto": asunto,
                "mensaje": mensaje_body,
                "parent_id": None,
                "leido": leido,
                "tipo": tipo,
                "metadata_json": metadata,
                "created_at": created_ts,
                "updated_at": updated_ts,
            }
            try:
                mid = self.insert("mensajes", row)
                if mid:
                    root_ids.append(mid)
                    msg_ids.append(mid)
            except Exception:
                pass

        self.log(f"mensajes (root): {len(root_ids)} insertados")

        # Second pass: create ~10 threaded replies referencing root messages
        reply_count = 0
        reply_pool = root_ids if root_ids else [1]

        for _ in range(10):
            parent_id = pick(reply_pool)
            remitente = self.refs.rand_user()
            destinatario = self.refs.rand_user()

            row = {
                "remitente_id": remitente,
                "destinatario_id": destinatario,
                "solicitud_id": None,
                "asunto": f"Re: {pick(ASUNTO_TEMPLATES)}",
                "mensaje": f"{fake.paragraph(nb_sentences=2)}",
                "parent_id": parent_id,
                "leido": random.randint(0, 1),
                "tipo": "comentario",
                "metadata_json": None,
                "created_at": rand_datetime(days_back=90),
                "updated_at": rand_datetime(days_back=15),
            }
            try:
                mid = self.insert("mensajes", row)
                if mid:
                    msg_ids.append(mid)
                    reply_count += 1
            except Exception:
                pass

        self.log(f"mensajes (replies): {reply_count} insertados")
        return msg_ids

    # ------------------------------------------------------------------
    # outbox_emails  (~15 records)
    # ------------------------------------------------------------------
    def _seed_outbox_emails(self):
        count = 0

        for i in range(1, 16):
            status = pick(EMAIL_STATUS_OPTIONS)

            # Sent emails have a sent_at timestamp; failed have an error message
            sent_at = None
            error = None
            if status == "sent":
                sent_at = rand_datetime(days_back=90)
            elif status == "failed":
                error = f"SMTP connection refused: {fake.ipv4()} port 587 timeout"

            # Attachments: some emails carry a JSON list of filenames
            attachments = None
            if random.random() > 0.6:
                num_att = random.randint(1, 3)
                attachments = json.dumps(
                    [f"{SEED_PREFIX}adjunto_{i}_{j:02d}.pdf" for j in range(1, num_att + 1)]
                )

            body_html = (
                f"<p>{fake.paragraph(nb_sentences=3)}</p>"
                f"<p>Este es un correo generado por SPM System 2.0.</p>"
            )

            row = {
                "to_email": fake.email(),
                "subject": f"{pick(EMAIL_SUBJECTS)}",
                "body": body_html,
                "attachments_json": attachments,
                "status": status,
                "error": error,
                "created_at": rand_datetime(days_back=120),
                "sent_at": sent_at,
            }
            try:
                self.insert_no_return("outbox_emails", row)
                count += 1
            except Exception:
                pass

        self.log(f"outbox_emails: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        for table in self.tables:
            try:
                cursor.execute(f"DELETE FROM {table}")
                if cursor.rowcount and cursor.rowcount > 0:
                    self.log(f"Cleaned {cursor.rowcount} rows from {table}")
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
