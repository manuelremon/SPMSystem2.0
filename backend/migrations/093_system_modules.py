"""
Migracion 093: Create system_modules table for module management
Fecha: 2026-03-07
Descripcion:
  - Creates system_modules table to track which modules are enabled/disabled
  - Seeds 8 default modules (solicitudes and admin are core/non-toggleable)
"""


def up():
    from backend.core.db import get_db_connection, is_using_postgresql

    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_modules (
                    id SERIAL PRIMARY KEY,
                    module_key VARCHAR(50) UNIQUE NOT NULL,
                    label_key VARCHAR(100),
                    label_fallback VARCHAR(100),
                    icon VARCHAR(50),
                    description TEXT,
                    enabled BOOLEAN DEFAULT TRUE,
                    is_core BOOLEAN DEFAULT FALSE,
                    display_order INTEGER,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_modules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    module_key VARCHAR(50) UNIQUE NOT NULL,
                    label_key VARCHAR(100),
                    label_fallback VARCHAR(100),
                    icon VARCHAR(50),
                    description TEXT,
                    enabled BOOLEAN DEFAULT 1,
                    is_core BOOLEAN DEFAULT 0,
                    display_order INTEGER,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        # Seed default modules
        modules = [
            ('solicitudes', 'nav_solicitudes', 'Solicitudes', 'Assignment', 'Gestion de solicitudes de materiales', True, True, 1),
            ('compras', 'nav_compras', 'Compras', 'ShoppingCart', 'Sourcing, proveedores y facturas', True, False, 2),
            ('planificacion', 'nav_planificacion', 'Planificacion', 'EventNote', 'MRP, forecast y demanda', True, False, 3),
            ('inventario', 'nav_inventario', 'Inventario', 'Inventory', 'Almacen, stock y gestion de inventario', True, False, 4),
            ('logistica', 'nav_logistica', 'Logistica', 'LocalShipping', 'Transporte, fletes y flota', True, False, 5),
            ('calidad', 'nav_quality', 'Calidad', 'VerifiedUser', 'Inspecciones, NCR y CAPA', True, False, 6),
            ('analytics', 'nav_analytics', 'Analytics', 'Analytics', 'Dashboards, reportes e IA', True, False, 7),
            ('admin', 'nav_admin', 'Admin', 'Settings', 'Administracion del sistema', True, True, 8),
        ]

        placeholder = "%s" if is_using_postgresql() else "?"
        for m in modules:
            cursor.execute(f"""
                INSERT INTO system_modules (module_key, label_key, label_fallback, icon, description, enabled, is_core, display_order)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ON CONFLICT (module_key) DO NOTHING
            """, m)

        conn.commit()
        print("Migration 093: system_modules table created and seeded")


def down():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS system_modules")
        conn.commit()
        print("Migration 093 rolled back")


if __name__ == "__main__":
    up()
