"""
Script de migración: Poblar tablas de proveedores V2

Migra de la estructura antigua (proveedores) a la nueva:
- proveedores_externos (con contactos, emails, teléfonos)
- proveedores_internos (almacenes YPF)
"""

import sys
from pathlib import Path

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.db import get_db_connection


def migrate_proveedores():
    """Migra datos a las nuevas tablas de proveedores."""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # === PROVEEDORES EXTERNOS ===
        externos_data = [
            # (cuit, nombre, direccion, localidad, pais, origen, lead_time, rubro, calificacion)
            (
                "30-12345678-9",
                "Ferretería Industrial S.A.",
                "Av. Industrial 1234",
                "Neuquén",
                "Argentina",
                "local",
                7,
                "Ferretería",
                "cumplidor",
            ),
            (
                "30-23456789-0",
                "Suministros Petroleros Neuquén",
                "Ruta 22 Km 5",
                "Neuquén",
                "Argentina",
                "local",
                14,
                "Petrolero",
                "cumplidor",
            ),
            (
                "30-34567890-1",
                "Válvulas y Accesorios S.R.L.",
                "Parque Industrial 456",
                "Bahía Blanca",
                "Argentina",
                "local",
                21,
                "Válvulas",
                "incumplidor",
            ),
            (
                "30-45678901-2",
                "Metalúrgica del Sur",
                "Zona Industrial Norte",
                "Comodoro Rivadavia",
                "Argentina",
                "local",
                10,
                "Metalúrgica",
                "cumplidor",
            ),
            (
                "30-56789012-3",
                "Distribuidora Técnica Patagonia",
                "Av. Perón 789",
                "Cipolletti",
                "Argentina",
                "local",
                5,
                "Distribución",
                "cumplidor",
            ),
            (
                "US-9876543210",
                "Global Oil Parts Inc.",
                "5500 Industrial Blvd",
                "Houston TX",
                "USA",
                "exterior",
                30,
                "Importación",
                "sin_calificar",
            ),
            (
                "30-67890123-4",
                "Bombas y Compresores Ltda.",
                "Ruta 7 Km 12",
                "Mendoza",
                "Argentina",
                "local",
                15,
                "Bombas",
                "cumplidor",
            ),
        ]

        for ext in externos_data:
            cursor.execute(
                """
                INSERT OR REPLACE INTO proveedores_externos
                (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                ext,
            )

        # Contactos
        contactos = [
            ("30-12345678-9", "Carlos", "Mendez", "Gerente Comercial", 1),
            ("30-12345678-9", "Laura", "Fernández", "Ventas", 0),
            ("30-23456789-0", "Roberto", "Silva", "Director", 1),
            ("30-45678901-2", "Ana", "García", "Jefa de Ventas", 1),
            ("US-9876543210", "John", "Smith", "Sales Manager", 1),
        ]

        for c in contactos:
            cursor.execute(
                """
                INSERT INTO proveedor_ext_contactos
                (cuit_proveedor, nombre, apellido, cargo, es_principal)
                VALUES (?, ?, ?, ?, ?)
            """,
                c,
            )

        # Emails
        emails = [
            ("30-12345678-9", "ventas@ferreteria-industrial.com.ar", "comercial", 1),
            ("30-12345678-9", "facturacion@ferreteria-industrial.com.ar", "facturacion", 0),
            ("30-23456789-0", "info@suministrospetroleros.com.ar", "comercial", 1),
            ("30-34567890-1", "contacto@valvulas-accesorios.com.ar", "comercial", 1),
            ("30-45678901-2", "ventas@metalurgicasur.com.ar", "comercial", 1),
            ("30-56789012-3", "pedidos@distecpatagonia.com.ar", "comercial", 1),
            ("US-9876543210", "sales@globaloilparts.com", "comercial", 1),
            ("30-67890123-4", "ventas@bombasycompresores.com.ar", "comercial", 1),
        ]

        for e in emails:
            cursor.execute(
                """
                INSERT INTO proveedor_ext_emails
                (cuit_proveedor, email, tipo, es_principal)
                VALUES (?, ?, ?, ?)
            """,
                e,
            )

        # Teléfonos
        telefonos = [
            ("30-12345678-9", "+54 299 4421000", "fijo"),
            ("30-12345678-9", "+54 299 155001234", "celular"),
            ("30-23456789-0", "+54 299 4455000", "fijo"),
            ("30-45678901-2", "+54 297 4556000", "fijo"),
            ("US-9876543210", "+1 713 555 0123", "fijo"),
        ]

        for t in telefonos:
            cursor.execute(
                """
                INSERT INTO proveedor_ext_telefonos
                (cuit_proveedor, telefono, tipo)
                VALUES (?, ?, ?)
            """,
                t,
            )

        # === PROVEEDORES INTERNOS ===
        internos_data = [
            # (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email)
            (
                "1008",
                "0001",
                "UP Loma La Lata",
                "Mantenimiento",
                "Mantenimiento",
                "almacen-lll@ypf.com",
                "Carlos Pérez",
                "5",
                None,
                None,
            ),
            (
                "1008",
                "9002",
                "UP Loma La Lata",
                "Energía",
                "Energia",
                "energia-lll@ypf.com",
                "Juan García",
                None,
                "Pedro Sánchez",
                "psanchez@ypf.com",
            ),
            (
                "1008",
                "9003",
                "UP Loma La Lata",
                "Obras",
                "Obras",
                "obras-lll@ypf.com",
                "Luis López",
                "6",
                None,
                None,
            ),
            (
                "1008",
                "9004",
                "UP Loma La Lata",
                "Producción",
                "Produccion",
                "produccion-lll@ypf.com",
                "María Rodríguez",
                None,
                "Ana Torres",
                "atorres@ypf.com",
            ),
            (
                "1008",
                "0101",
                "UP Loma La Lata",
                "Críticos",
                "Mantenimiento",
                "criticos-lll@ypf.com",
                "Roberto Díaz",
                "5",
                None,
                None,
            ),
            (
                "1050",
                "0001",
                "UP UTE Rio Neuquén",
                "Mantenimiento",
                "Mantenimiento",
                "almacen-ute@ypf.com",
                "Fernando Ruiz",
                "3",
                None,
                None,
            ),
            (
                "1050",
                "9004",
                "UP UTE Rio Neuquén",
                "Producción",
                "Produccion",
                "produccion-ute@ypf.com",
                "Claudia Martín",
                None,
                "Jorge Paz",
                "jpaz@ypf.com",
            ),
            (
                "1064",
                "0001",
                "UP Añelo",
                "Mantenimiento",
                "Mantenimiento",
                "almacen-anelo@ypf.com",
                "Diego Romero",
                None,
                "Miguel Ángel",
                "mangel@ypf.com",
            ),
            (
                "1500",
                "0001",
                "MID Loma La Lata",
                "Mantenimiento",
                "Mantenimiento",
                "mid-lll@ypf.com",
                "Patricia Vega",
                "2",
                None,
                None,
            ),
        ]

        for i in internos_data:
            cursor.execute(
                """
                INSERT OR REPLACE INTO proveedores_internos
                (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                i,
            )

        conn.commit()

        # Verificar migración
        cursor.execute("SELECT COUNT(*) as n FROM proveedores_externos")
        print(f"✓ Proveedores externos: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_ext_contactos")
        print(f"✓ Contactos: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_ext_emails")
        print(f"✓ Emails: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_ext_telefonos")
        print(f"✓ Teléfonos: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedores_internos")
        print(f"✓ Proveedores internos: {cursor.fetchone()['n']}")

        print("\n¡Migración completada!")


if __name__ == "__main__":
    migrate_proveedores()
