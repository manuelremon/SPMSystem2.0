"""
Migración 094: Stock Performance - Índices compuestos y vista materializada
Fecha: 2026-03-08
Descripción: Optimiza la página /materiales/stock que transfiere 46MB de JSON
             con 141K filas y 3 subqueries correlacionadas por fila.

Cambios:
- Índices compuestos en consumo_historico y materiales_bbdd para subqueries
- Vista materializada stock_vista que pre-computa inmovilizado, mrp, ultimo_consumo
"""
from backend.core.db import get_db_connection, is_using_postgresql


def up():
    if not is_using_postgresql():
        print("⚠️  Migración 094: Solo aplica a PostgreSQL, saltando")
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Índices compuestos para las subqueries correlacionadas
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_consumo_mat_centro_alm_fecha
        ON sap_consumo_historico (material, centro, almacen, fecha)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_matbbdd_cod_centro_alm
        ON sap_materiales_bbdd (codigo_material, centro, almacen)
    """)

    # Índice compuesto en stock para el GROUP BY
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_stock_material_centro_alm
        ON sap_stock (material, centro, almacen)
        WHERE stock > 0
    """)

    # 2. Vista materializada que pre-computa todo
    cursor.execute("DROP MATERIALIZED VIEW IF EXISTS stock_vista CASCADE")
    cursor.execute("""
        CREATE MATERIALIZED VIEW stock_vista AS
        SELECT
            s.material,
            s.material_descripcion AS descripcion,
            s.centro,
            s.centro_descripcion,
            s.almacen,
            SUM(s.stock) AS stock,
            s.um,
            s.precio,
            SUM(s.stock_valorizado) AS stock_valorizado,
            CASE
                WHEN s.inmovilizado = 'INMOVILIZADO' THEN true
                WHEN NOT EXISTS (
                    SELECT 1 FROM sap_consumo_historico ch
                    WHERE ch.material = s.material
                    AND ch.centro = s.centro
                    AND ch.almacen = s.almacen
                    AND ch.fecha >= (CURRENT_DATE - INTERVAL '365 days')
                ) THEN true
                ELSE false
            END AS inmovilizado,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM sap_materiales_bbdd m
                    WHERE m.codigo_material = s.material
                    AND m.centro = s.centro
                    AND m.almacen = s.almacen
                    AND (m.punto_de_pedido > 0 OR m.stock_de_seguridad > 0)
                ) THEN true
                ELSE false
            END AS mrp,
            (
                SELECT MAX(ch.fecha) FROM sap_consumo_historico ch
                WHERE ch.material = s.material
                AND ch.centro = s.centro
                AND ch.almacen = s.almacen
            ) AS ultimo_consumo
        FROM sap_stock s
        WHERE s.stock > 0
        GROUP BY s.material, s.material_descripcion, s.centro,
                 s.centro_descripcion, s.almacen, s.um, s.precio, s.inmovilizado
    """)

    # Índices en la vista materializada para filtros y ORDER BY
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_centro ON stock_vista (centro)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_almacen ON stock_vista (almacen)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_material ON stock_vista (material)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_descripcion ON stock_vista (descripcion text_pattern_ops)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_valorizado ON stock_vista (stock_valorizado DESC)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_inmovilizado ON stock_vista (inmovilizado)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sv_mrp ON stock_vista (mrp)
    """)

    conn.commit()
    conn.close()
    print("✅ Migración 094: Índices compuestos + vista materializada stock_vista creados")


def down():
    if not is_using_postgresql():
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DROP MATERIALIZED VIEW IF EXISTS stock_vista CASCADE")
    cursor.execute("DROP INDEX IF EXISTS idx_consumo_mat_centro_alm_fecha")
    cursor.execute("DROP INDEX IF EXISTS idx_matbbdd_cod_centro_alm")
    cursor.execute("DROP INDEX IF EXISTS idx_stock_material_centro_alm")

    conn.commit()
    conn.close()
    print("✅ Migración 094: Revertida exitosamente")


if __name__ == '__main__':
    up()
