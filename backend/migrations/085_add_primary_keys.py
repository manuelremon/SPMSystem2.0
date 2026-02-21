"""
Migración 085: Agregar PRIMARY KEYs a todas las tablas.

El schema fue importado desde pg_dump sin constraints.
Esta migración agrega PKs a las 162 tablas de producción y dev.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.core.db import get_db_connection, is_using_postgresql  # noqa: I001, E402


# Tablas con PK en columna 'id'
TABLES_ID_PK = [
    "ahorro_costo",
    "alertas_mrp",
    "aprobadores_delegados",
    "archivos_adjuntos",
    "audit_trail",
    "benchmark",
    "budget_history",
    "budget_update_requests",
    "capa",
    "cashflow_simulacion",
    "cat_equivalencias",
    "cat_materiales",
    "ciclo_conteo",
    "ciclo_conteo_item",
    "config_almacenes",
    "config_lotes_excluidos",
    "consignacion",
    "consignacion_item",
    "consignment_consumo",
    "consignment_programa",
    "consignment_reconciliacion",
    "consignment_stock",
    "contrato",
    "contrato_alerta",
    "contrato_documento",
    "contrato_historial",
    "contrato_item",
    "decision_abastecimiento",
    "decision_abastecimiento_fuentes",
    "declaracion_aduanera",
    "declaracion_aduanera_item",
    "devolucion",
    "devolucion_historial",
    "devolucion_item",
    "eco",
    "eco_aprobacion",
    "eco_historial",
    "eco_item",
    "empaque_especificacion",
    "empaque_orden",
    "empaque_orden_item",
    "executive_kpi",
    "executive_snapshot",
    "factura_item",
    "factura_proveedor",
    "financiamiento_proveedor",
    "foro_likes",
    "foro_posts",
    "foro_respuestas",
    "garantia",
    "garantia_historial",
    "garantia_reclamo",
    "inspeccion_defecto",
    "inspeccion_entrada",
    "inspeccion_item",
    "inventario_aging",
    "kanban_historial",
    "kanban_senal",
    "kanban_tablero",
    "kanban_tarjeta",
    "kit_bom",
    "kit_bom_componente",
    "kit_orden",
    "kit_orden_detalle",
    "lista_precios",
    "lote",
    "lote_movimiento",
    "matching_resultado",
    "mensajes",
    "meta_ahorro",
    "ncr",
    "ncr_accion",
    "ncr_historial",
    "notificacion_push_suscripcion",
    "notificaciones",
    "oferta_descuento",
    "onboarding_documento",
    "onboarding_proveedor",
    "ordenes_planificadas",
    "outbox_emails",
    "plan_demanda",
    "plan_demanda_consenso",
    "plan_demanda_detalle",
    "plan_produccion",
    "plan_produccion_historial",
    "plan_produccion_material",
    "planificador_asignaciones",
    "portal_proveedor_documento",
    "portal_proveedor_factura",
    "portal_proveedor_usuario",
    "precio_historial",
    "precio_item",
    "precio_lista",
    "precio_lista_item",
    "precio_negociacion",
    "presupuesto_incorporaciones",
    "presupuesto_ledger",
    "procurement_scorecard",
    "programa_descuento",
    "proveedor_ext_contactos",
    "proveedor_ext_emails",
    "proveedor_ext_telefonos",
    "proveedor_precios_negociados",
    "purchase_orders",
    "push_subscriptions",
    "recall",
    "recall_accion",
    "reclamo_garantia",
    "regla_auto_aprobacion",
    "regla_escalacion",
    "reglas_aprobacion",
    "reporte_destinatario",
    "rfq",
    "rfq_adjudicacion",
    "rfq_criterio_evaluacion",
    "rfq_evaluacion",
    "rfq_item",
    "rfq_oferta",
    "rfq_proveedor",
    "sap_consumo_historico",
    "sap_import_log",
    "sap_materiales_bbdd",
    "sap_pedidos",
    "sap_purchase_orders",
    "sap_solpeds",
    "sap_stock",
    "sla_alertas",
    "sla_configuracion",
    "slob_disposicion",
    "solicitud_items_tratamiento",
    "solicitud_tratamiento_eventos",
    "solicitud_tratamiento_log",
    "solicitudes",
    "solicitudes_historial_estados",
    "solpeds",
    "spend_presupuesto",
    "spend_registro",
    "terminos_pago_proveedor",
    "traslados",
    "trivias_scores",
    "user_material_favorito",
    "user_profile_requests",
    "vertex_conversations",
    "vertex_messages",
    "vertex_proactive_alerts",
    "vertex_user_memory",
    "webhook",
    "webhook_delivery",
]

# Tablas con PKs especiales (no 'id')
SPECIAL_PKS = {
    "usuarios": ("id_spm",),
    "proveedores": ("id_proveedor",),
    "proveedores_externos": ("cuit",),
    "proveedores_internos": ("centro", "almacen"),
    "presupuestos": ("centro", "sector"),
    "catalog_almacenes": ("codigo",),
    "catalog_centros": ("codigo",),
    "catalog_puestos": ("nombre",),
    "catalog_roles": ("nombre",),
    "catalog_sectores": ("nombre",),
    "config_equivalencia_scores": ("tipo_equiv",),
    "schema_migrations": ("version",),
    "materiales": ("codigo",),
    "material_equivalencias": ("id_equivalencia",),
}


def has_primary_key(cursor, table_name):
    """Check if table already has a primary key constraint."""
    cursor.execute("""
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = %s
          AND constraint_type = 'PRIMARY KEY'
    """, (table_name,))
    return cursor.fetchone() is not None


def table_exists(cursor, table_name):
    """Check if table exists."""
    cursor.execute("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = %s
          AND table_type = 'BASE TABLE'
    """, (table_name,))
    return cursor.fetchone() is not None


def up():
    if not is_using_postgresql():
        print("  SKIP: Solo aplica a PostgreSQL")
        return

    print("=" * 60)
    print("MIGRACION 085: Agregar PRIMARY KEYs")
    print("=" * 60)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        added = 0
        skipped = 0
        missing = 0

        # 1. Tables with 'id' as PK
        print(f"\n=== Tablas con PK 'id' ({len(TABLES_ID_PK)} tablas) ===")
        for table in TABLES_ID_PK:
            if not table_exists(cursor, table):
                missing += 1
                continue

            if has_primary_key(cursor, table):
                skipped += 1
                continue

            try:
                cursor.execute(
                    f'ALTER TABLE "{table}" ADD PRIMARY KEY (id)'
                )
                added += 1
            except Exception as e:
                conn.rollback()
                print(f"  ERROR {table}: {e}")
                continue

        # 2. Tables with special PKs
        print(f"\n=== Tablas con PKs especiales ({len(SPECIAL_PKS)} tablas) ===")
        for table, pk_cols in SPECIAL_PKS.items():
            if not table_exists(cursor, table):
                missing += 1
                continue

            if has_primary_key(cursor, table):
                skipped += 1
                continue

            cols_str = ", ".join(f'"{c}"' for c in pk_cols)
            try:
                cursor.execute(
                    f'ALTER TABLE "{table}" ADD PRIMARY KEY ({cols_str})'
                )
                added += 1
            except Exception as e:
                conn.rollback()
                print(f"  ERROR {table}: {e}")
                continue

        conn.commit()

        print("\n=== Resultado ===")
        print(f"  PKs agregadas: {added}")
        print(f"  Ya tenían PK:  {skipped}")
        print(f"  No existen:    {missing}")
        print("Migracion 085 completada!")


def down():
    if not is_using_postgresql():
        return

    with get_db_connection() as conn:
        cursor = conn.cursor()

        all_tables = TABLES_ID_PK + list(SPECIAL_PKS.keys())
        for table in all_tables:
            if not table_exists(cursor, table):
                continue
            try:
                cursor.execute(
                    f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{table}_pkey"'
                )
            except Exception:
                conn.rollback()

        conn.commit()
        print("Migracion 085 revertida (PKs eliminadas)")


if __name__ == "__main__":
    up()
