"""
Seed Module 21: Compliance & Copilot
Tablas para AI Copilot y compliance checks.

Tablas:
- compliance_check (Compliance pages) - solo si <5 seed records
- copilot_conversacion (AI Copilot)
- copilot_mensaje (AI Copilot)
- copilot_sugerencia (AI Copilot)
"""

import json
import random

from ._base import (
    SEED_PREFIX,
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_money,
    rand_pct,
)


class ComplianceCopilotSeed(SeedModule):
    name = "compliance_copilot"
    description = "Compliance checks, AI Copilot conversaciones y sugerencias"
    tables = [
        # Clean in reverse dependency order
        "copilot_sugerencia",
        "copilot_mensaje",
        "copilot_conversacion",
        "compliance_check",
    ]

    def seed(self):
        self._seed_compliance_check()
        conv_ids = self._seed_copilot_conversacion()
        self._seed_copilot_mensaje(conv_ids)
        self._seed_copilot_sugerencia(conv_ids)

    # ------------------------------------------------------------------
    # compliance_check  (~25 records, solo si hay <5 con SEED marker)
    # Cols: contrato_id, orden_compra_id, material_codigo, precio_contrato,
    #       precio_real, cantidad, es_compliant, desviacion_porcentaje,
    #       razon_desviacion, created_at
    # ------------------------------------------------------------------
    def _seed_compliance_check(self):
        # Check existing seed count
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM compliance_check WHERE razon_desviacion LIKE ?",
                (f"%{SEED_PREFIX}%",),
            )
            existing = cursor.fetchone()[0]
        except Exception:
            existing = 0

        if existing >= 5:
            self.log(f"compliance_check: ya hay {existing} seed records, skip")
            return

        # Get existing contrato and OC IDs
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM contrato LIMIT 20")
            contrato_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            contrato_ids = []

        try:
            cursor.execute("SELECT id FROM orden_compra LIMIT 40")
            oc_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            oc_ids = []

        count = 0
        razones_desviacion = [
            "Precio negociado diferente al contrato marco",
            "Compra urgente fuera de contrato",
            "Ajuste por inflación no aplicado",
            "Descuento por volumen no reflejado",
            "Cambio de especificación técnica",
            "Proveedor alternativo por quiebre",
        ]

        for _ in range(25):
            precio_contrato = rand_money(100, 5000)
            # 60% compliant, 40% no
            es_compliant = random.random() < 0.6
            if es_compliant:
                desviacion = round(random.uniform(-2, 2), 2)
            else:
                desviacion = round(random.uniform(5, 25) * random.choice([-1, 1]), 2)
            precio_real = round(precio_contrato * (1 + desviacion / 100), 2)

            row = {
                "contrato_id": pick(contrato_ids) if contrato_ids and random.random() > 0.3 else None,
                "orden_compra_id": pick(oc_ids) if oc_ids else None,
                "material_codigo": self.refs.rand_material(),
                "precio_contrato": precio_contrato,
                "precio_real": precio_real,
                "cantidad": round(random.uniform(1, 500), 2),
                "es_compliant": 1 if es_compliant else 0,
                "desviacion_porcentaje": desviacion,
                "razon_desviacion": f"{pick(razones_desviacion)}" if not es_compliant else None,
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("compliance_check", row)
                count += 1
            except Exception:
                pass

        self.log(f"compliance_check: {count} insertados")

    # ------------------------------------------------------------------
    # copilot_conversacion  (~8 records)
    # Cols: usuario_id, titulo, contexto_tipo, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_copilot_conversacion(self):
        conv_ids = []
        # contexto_tipo CHECK: procurement, sourcing, spend, inventory
        conversaciones = [
            ("Análisis de stock crítico", "inventory"),
            ("Consulta proveedores alternativos", "procurement"),
            ("Revisión forecast Q2", "inventory"),
            ("Optimización costos transporte", "spend"),
            ("Análisis SLOB almacén principal", "inventory"),
            ("Recomendaciones de compra urgente", "procurement"),
            ("Evaluación riesgo proveedor", "sourcing"),
            ("Consulta sobre sourcing estratégico", "sourcing"),
        ]

        for titulo, contexto in conversaciones:
            row = {
                "usuario_id": int(self.refs.rand_user()),
                "titulo": f"{titulo}",
                "contexto_tipo": contexto,
                "created_at": rand_datetime(days_back=30),
                "updated_at": rand_datetime(days_back=7),
            }
            try:
                cid = self.insert("copilot_conversacion", row)
                if cid:
                    conv_ids.append(cid)
            except Exception:
                pass

        self.log(f"copilot_conversacion: {len(conv_ids)} insertados")
        return conv_ids

    # ------------------------------------------------------------------
    # copilot_mensaje  (~30 records, ~4 per conversación)
    # Cols: conversacion_id, rol, contenido, metadata, tokens_used, created_at
    # ------------------------------------------------------------------
    def _seed_copilot_mensaje(self, conv_ids):
        count = 0
        if not conv_ids:
            return

        # Keys match valid contexto_tipo: procurement, sourcing, spend, inventory
        dialogos = {
            "inventory": [
                ("user", "¿Cuáles son los materiales con stock más crítico?"),
                ("assistant", "Basándome en el análisis actual, hay 12 materiales bajo punto de reorden. Los más críticos son repuestos mecánicos en almacén 0001 con solo 3 días de cobertura."),
                ("user", "¿Qué acción recomiendas?"),
                ("assistant", "Recomiendo generar solicitudes urgentes para los 5 materiales con cobertura menor a 7 días. También sugiero revisar los lead times con los proveedores actuales."),
            ],
            "procurement": [
                ("user", "Necesito alternativas para el proveedor ACME que tiene delivery issues"),
                ("assistant", "Encontré 3 proveedores alternativos calificados para los materiales de ACME: ProvTech (rating 4.2), InduSupply (rating 3.8), y MetalParts (rating 4.5)."),
                ("user", "¿Cuál tiene mejor precio?"),
                ("assistant", "MetalParts ofrece precios 8% más bajos en promedio, pero su lead time es 5 días mayor. ProvTech tiene precios similares a ACME pero mejor OTIF (95% vs 82%)."),
            ],
            "sourcing": [
                ("user", "Dame un resumen del riesgo de proveedores"),
                ("assistant", "El portfolio tiene 45 proveedores activos. 3 están en riesgo alto: ACME (delivery 68%), ChemSupply (quality issues), y LogiTrans (financial concerns). Recomiendo plan de contingencia."),
                ("user", "¿Qué estrategia de sourcing recomiendas?"),
                ("assistant", "Para materiales críticos, recomiendo dual sourcing. Para commodities, consolidar en 2-3 proveedores con contratos marco. Potencial ahorro: 8-12%."),
            ],
            "spend": [
                ("user", "¿Cuál es el estado del gasto este trimestre?"),
                ("assistant", "El gasto total Q1 es $2.3M, 5% bajo presupuesto. Las categorías con mayor desviación son químicos (+12%) y repuestos mecánicos (-8%)."),
                ("user", "¿Hay compras fuera de contrato recientes?"),
                ("assistant", "En los últimos 30 días se detectaron 8 compras fuera de contrato por un total de $125,000. El 60% fueron por compras urgentes y el 40% por cambios de especificación no actualizados en contratos."),
            ],
        }

        for conv_id in conv_ids:
            # Determine context type from the conversation
            try:
                cursor = self.conn.cursor()
                cursor.execute("SELECT contexto_tipo FROM copilot_conversacion WHERE id = ?", (conv_id,))
                ctx_row = cursor.fetchone()
                ctx = ctx_row[0] if ctx_row else "inventory"
            except Exception:
                ctx = "inventory"

            mensajes = dialogos.get(ctx, dialogos["inventory"])
            for i, (rol, contenido) in enumerate(mensajes):
                tokens = random.randint(50, 800) if rol == "assistant" else random.randint(10, 100)
                row = {
                    "conversacion_id": conv_id,
                    "rol": rol,
                    "contenido": f"{contenido}",
                    "metadata": json.dumps({"model": "claude-3", "temperature": 0.3}) if rol == "assistant" else None,
                    "tokens_used": tokens,
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("copilot_mensaje", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"copilot_mensaje: {count} insertados")

    # ------------------------------------------------------------------
    # copilot_sugerencia  (~10 records)
    # Cols: conversacion_id, tipo, titulo, contenido, datos_soporte,
    #       estado, material_codigo, proveedor_cuit, feedback_usuario, created_at
    # ------------------------------------------------------------------
    def _seed_copilot_sugerencia(self, conv_ids):
        count = 0
        if not conv_ids:
            return

        # tipo CHECK: sourcing_strategy, rfq_draft, supplier_recommendation, cost_optimization, risk_alert
        # estado CHECK: pending, accepted, rejected, implemented
        sugerencias = [
            ("cost_optimization", "Reabastecer material crítico",
             "Se recomienda generar solicitud para 5 materiales bajo punto de reorden",
             "accepted"),
            ("supplier_recommendation", "Cambiar proveedor por bajo OTIF",
             "Proveedor actual tiene OTIF 68%. Alternativa disponible con OTIF 95%",
             "implemented"),
            ("sourcing_strategy", "Ajustar estrategia de sourcing Q2",
             "El modelo ML sugiere diversificar proveedores para Q2 basado en patrones históricos",
             "pending"),
            ("cost_optimization", "Oportunidad de ahorro en compras consolidadas",
             "Consolidar 3 OCs del mismo proveedor podría generar descuento del 12%",
             "accepted"),
            ("risk_alert", "Revisar calidad de lote reciente",
             "El último lote del proveedor X muestra variabilidad mayor a la normal",
             "rejected"),
            ("cost_optimization", "Reducir stock de seguridad clase C",
             "15 materiales clase C tienen stock de seguridad sobredimensionado. Reducción potencial: $45K",
             "pending"),
            ("rfq_draft", "RFQ para contrato próximo a vencer",
             "3 contratos vencen en los próximos 30 días. Se recomienda iniciar RFQ de renovación",
             "implemented"),
            ("supplier_recommendation", "Plan B para proveedor único",
             "5 materiales dependen de un único proveedor. Se recomienda calificar alternativas",
             "pending"),
            ("risk_alert", "Pico de demanda detectado",
             "Se detectó incremento inusual en demanda de lubricantes. Verificar si es estacional o puntual",
             "pending"),
            ("sourcing_strategy", "Material con rotación baja",
             "Material XYZ-123 no ha tenido movimiento en 180 días. Evaluar disposición SLOB",
             "rejected"),
        ]

        for tipo, titulo, contenido, estado in sugerencias:
            conv_id = pick(conv_ids)
            row = {
                "conversacion_id": conv_id,
                "tipo": tipo,
                "titulo": f"{titulo}",
                "contenido": f"{contenido}",
                "datos_soporte": json.dumps({
                    "fuente": "analisis_automatico",
                    "confianza": round(random.uniform(0.7, 0.95), 2),
                    "impacto_estimado": f"${random.randint(1000, 50000)}",
                }),
                "estado": estado,
                "material_codigo": self.refs.rand_material() if tipo in ("reorder", "slow_moving", "forecast_adjust") else None,
                "proveedor_cuit": self.refs.rand_proveedor() if tipo in ("supplier_change", "risk_mitigation") else None,
                "feedback_usuario": f"Implementado" if estado in ("accepted", "implemented") else None,
                "created_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("copilot_sugerencia", row)
                count += 1
            except Exception:
                pass

        self.log(f"copilot_sugerencia: {count} insertados")

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
