"""
Script de migración: Poblar tablas de proveedores V2

Migra de la estructura antigua (proveedores) a la nueva:
- proveedores_externos (con contactos, emails, teléfonos)
- proveedores_internos (almacenes YPF)
- proveedor_precios_negociados (precios especiales por material)

Compatible con SQLite (desarrollo) y PostgreSQL (producción).
"""

import sys
import random
import sqlite3
from pathlib import Path
from datetime import date, timedelta

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.core.db import get_db_connection, is_using_postgresql


def upsert_externo(cursor, data):
    """Inserta o actualiza proveedor externo."""
    if is_using_postgresql():
        cursor.execute(
            """
            INSERT INTO proveedores_externos
            (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (cuit) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                direccion = EXCLUDED.direccion,
                localidad = EXCLUDED.localidad,
                pais = EXCLUDED.pais,
                origen = EXCLUDED.origen,
                lead_time_dias = EXCLUDED.lead_time_dias,
                rubro = EXCLUDED.rubro,
                calificacion = EXCLUDED.calificacion
        """,
            data,
        )
    else:
        cursor.execute(
            """
            INSERT OR REPLACE INTO proveedores_externos
            (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            data,
        )


def upsert_interno(cursor, data):
    """Inserta o actualiza proveedor interno."""
    if is_using_postgresql():
        cursor.execute(
            """
            INSERT INTO proveedores_internos
            (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (centro, almacen) DO UPDATE SET
                centro_nombre = EXCLUDED.centro_nombre,
                almacen_nombre = EXCLUDED.almacen_nombre,
                sector = EXCLUDED.sector,
                contacto_centro = EXCLUDED.contacto_centro,
                responsable_centro = EXCLUDED.responsable_centro,
                referente_id = EXCLUDED.referente_id,
                referente_nombre = EXCLUDED.referente_nombre,
                referente_email = EXCLUDED.referente_email
        """,
            data,
        )
    else:
        cursor.execute(
            """
            INSERT OR REPLACE INTO proveedores_internos
            (centro, almacen, centro_nombre, almacen_nombre, sector, contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            data,
        )


def insert_ignore_precio(cursor, data):
    """Inserta precio negociado si no existe."""
    if is_using_postgresql():
        # PostgreSQL UNIQUE is on (cuit_proveedor, codigo_material, fecha_vigencia_desde)
        cursor.execute(
            """
            INSERT INTO proveedor_precios_negociados
            (cuit_proveedor, codigo_material, precio_usd, moneda,
             fecha_vigencia_desde, fecha_vigencia_hasta, condicion_pago,
             cantidad_minima, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (cuit_proveedor, codigo_material, fecha_vigencia_desde) DO NOTHING
        """,
            data,
        )
    else:
        cursor.execute(
            """
            INSERT OR IGNORE INTO proveedor_precios_negociados
            (cuit_proveedor, codigo_material, precio_usd, moneda,
             fecha_vigencia_desde, fecha_vigencia_hasta, condicion_pago,
             cantidad_minima, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            data,
        )


def migrate_proveedores():
    """Migra datos a las nuevas tablas de proveedores."""

    db_type = "PostgreSQL" if is_using_postgresql() else "SQLite"
    print(f"Conectando a {db_type}...")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Limpiar tablas para evitar duplicados en re-ejecución
        cursor.execute("DELETE FROM proveedor_precios_negociados")
        cursor.execute("DELETE FROM proveedor_ext_telefonos")
        cursor.execute("DELETE FROM proveedor_ext_emails")
        cursor.execute("DELETE FROM proveedor_ext_contactos")
        cursor.execute("DELETE FROM proveedores_externos")
        cursor.execute("DELETE FROM proveedores_internos")

        # === PROVEEDORES EXTERNOS ===
        # Formato: (cuit, nombre, direccion, localidad, pais, origen, lead_time, rubro, calificacion)
        externos_data = [
            # --- Originales (7) ---
            ("30-12345678-9", "Ferretería Industrial S.A.", "Av. Industrial 1234", "Neuquén", "Argentina", "local", 7, "Ferretería", "cumplidor"),
            ("30-23456789-0", "Suministros Petroleros Neuquén", "Ruta 22 Km 5", "Neuquén", "Argentina", "local", 14, "Petrolero", "cumplidor"),
            ("30-34567890-1", "Válvulas y Accesorios S.R.L.", "Parque Industrial 456", "Bahía Blanca", "Argentina", "local", 21, "Válvulas", "incumplidor"),
            ("30-45678901-2", "Metalúrgica del Sur", "Zona Industrial Norte", "Comodoro Rivadavia", "Argentina", "local", 10, "Metalúrgica", "cumplidor"),
            ("30-56789012-3", "Distribuidora Técnica Patagonia", "Av. Perón 789", "Cipolletti", "Argentina", "local", 5, "Distribución", "cumplidor"),
            ("US-9876543210", "Global Oil Parts Inc.", "5500 Industrial Blvd", "Houston TX", "USA", "exterior", 30, "Importación", "sin_calificar"),
            ("30-67890123-4", "Bombas y Compresores Ltda.", "Ruta 7 Km 12", "Mendoza", "Argentina", "local", 15, "Bombas", "cumplidor"),

            # --- Instrumentación (3) ---
            ("30-11111111-1", "Instrumentación Industrial SRL", "Av. Tecnológica 100", "Neuquén", "Argentina", "local", 12, "Instrumentación", "cumplidor"),
            ("30-11111111-2", "Mediciones Patagonia SA", "Ruta 7 Km 8", "Neuquén", "Argentina", "local", 10, "Medición", "cumplidor"),
            ("30-11111111-3", "Control & Automatización SRL", "Parque Industrial 200", "Cipolletti", "Argentina", "local", 15, "Automatización", "sin_calificar"),

            # --- Eléctrico (3) ---
            ("30-22222222-1", "Electrotecnia del Sur", "Parque Industrial S/N", "Bahía Blanca", "Argentina", "local", 8, "Eléctrico", "cumplidor"),
            ("30-22222222-2", "Tableros Industriales SA", "Av. del Trabajo 500", "Neuquén", "Argentina", "local", 14, "Tableros", "cumplidor"),
            ("30-22222222-3", "Motores Eléctricos Patagonia", "Ruta 22 Km 10", "Centenario", "Argentina", "local", 10, "Motores", "cumplidor"),

            # --- Seguridad/EPP (3) ---
            ("30-33333333-1", "Seguridad Industrial Neuquén", "Av. Argentina 500", "Neuquén", "Argentina", "local", 5, "Seguridad", "cumplidor"),
            ("30-33333333-2", "Protección Personal SA", "Calle San Martín 100", "Cipolletti", "Argentina", "local", 7, "EPP", "cumplidor"),
            ("30-33333333-3", "EPP Patagonia SRL", "Zona Industrial Este", "General Roca", "Argentina", "local", 6, "Seguridad", "sin_calificar"),

            # --- Químicos (3) ---
            ("30-44444444-1", "Químicos Patagonia SA", "Zona Industrial Norte", "Plaza Huincul", "Argentina", "local", 18, "Químicos", "cumplidor"),
            ("30-44444444-2", "Solventes del Sur SRL", "Parque Petroquímico", "Bahía Blanca", "Argentina", "local", 12, "Solventes", "cumplidor"),
            ("30-44444444-3", "Lubricantes Industriales SA", "Ruta 151 Km 5", "Neuquén", "Argentina", "local", 5, "Lubricantes", "cumplidor"),

            # --- Sellos/Empaquetaduras (2) ---
            ("30-55555555-1", "Sellos y Retenes SRL", "Av. Industrial 800", "Neuquén", "Argentina", "local", 10, "Sellos", "cumplidor"),
            ("30-55555555-2", "Empaquetaduras Industriales", "Parque Industrial 300", "Mendoza", "Argentina", "local", 12, "Empaquetaduras", "cumplidor"),

            # --- Filtros (2) ---
            ("30-66666666-1", "Filtros Industriales SA", "Ruta 7 Km 15", "Neuquén", "Argentina", "local", 8, "Filtros", "cumplidor"),
            ("30-66666666-2", "Purificación Patagonia SRL", "Av. del Petróleo 200", "Plaza Huincul", "Argentina", "local", 10, "Filtración", "sin_calificar"),

            # --- Cañerías/Accesorios (2) ---
            ("30-77777777-1", "Cañerías del Sur SA", "Parque Industrial Oeste", "Bahía Blanca", "Argentina", "local", 15, "Cañerías", "cumplidor"),
            ("30-77777777-2", "Accesorios Industriales SRL", "Zona Franca 100", "Neuquén", "Argentina", "local", 7, "Accesorios", "cumplidor"),

            # --- Rodamientos (2) ---
            ("30-88888888-1", "Rodamientos SKF Distribuidor", "Av. Las Industrias 400", "Neuquén", "Argentina", "local", 10, "Rodamientos", "cumplidor"),
            ("30-88888888-2", "Rodamientos y Correas SA", "Calle Comercial 200", "Cipolletti", "Argentina", "local", 8, "Transmisión", "cumplidor"),

            # --- Herramientas (2) ---
            ("30-99999999-1", "Herramientas Industriales SA", "Av. del Trabajo 100", "Neuquén", "Argentina", "local", 5, "Herramientas", "cumplidor"),
            ("30-99999999-2", "Tools & Equipment SRL", "Parque Comercial 50", "Cipolletti", "Argentina", "local", 7, "Herramientas", "sin_calificar"),

            # --- Importadores (3) ---
            ("DE-123456789", "Siemens AG", "Werner-von-Siemens-Str. 1", "Munich", "Alemania", "exterior", 45, "Automatización", "cumplidor"),
            ("BR-98765432100", "Petrobras Distribuidora", "Av. República do Chile 65", "Rio de Janeiro", "Brasil", "exterior", 25, "Petrolero", "cumplidor"),
            ("CL-76543210-9", "Minera Chilena SpA", "Av. Apoquindo 3000", "Santiago", "Chile", "exterior", 20, "Minería", "cumplidor"),
        ]

        for ext in externos_data:
            upsert_externo(cursor, ext)

        conn.commit()
        print(f"  Insertados {len(externos_data)} proveedores externos")

        # Obtener el mapeo cuit -> id para PostgreSQL (necesario para FK en telefonos)
        cuit_to_id = {}
        cursor.execute("SELECT id, cuit FROM proveedores_externos")
        for row in cursor.fetchall():
            cuit_to_id[row["cuit"]] = row["id"]

        # Contactos - estructura PostgreSQL: (cuit_proveedor, nombre, cargo, telefono, email, principal)
        # SQLite tiene: (cuit_proveedor, nombre, apellido, cargo, es_principal)
        contactos_data = [
            # (cuit, nombre_completo, cargo, telefono, email, principal)
            ("30-12345678-9", "Carlos Mendez", "Gerente Comercial", "+54 299 4410001", "cmendez@ferreteria.com.ar", 1),
            ("30-12345678-9", "Laura Fernández", "Ventas", "+54 299 4410002", "lfernandez@ferreteria.com.ar", 0),
            ("30-23456789-0", "Roberto Silva", "Director Comercial", "+54 299 4420001", "rsilva@suministros.com.ar", 1),
            ("30-34567890-1", "María González", "Ventas", "+54 291 4430001", "mgonzalez@valvulas.com.ar", 1),
            ("30-45678901-2", "Ana García", "Jefa de Ventas", "+54 297 4440001", "agarcia@metalurgica.com.ar", 1),
            ("30-56789012-3", "Pedro Martínez", "Gerente", "+54 299 4450001", "pmartinez@distribuidora.com.ar", 1),
            ("US-9876543210", "John Smith", "Sales Manager", "+1 713 555 1001", "jsmith@globaloilparts.com", 1),
            ("30-67890123-4", "Luis Rodríguez", "Director", "+54 261 4460001", "lrodriguez@bombas.com.ar", 1),
            ("30-11111111-1", "Martín López", "Gerente Técnico", "+54 299 4470001", "mlopez@instrumentacion.com.ar", 1),
            ("30-11111111-2", "Claudia Ruiz", "Ventas", "+54 299 4480001", "cruiz@mediciones.com.ar", 1),
            ("30-11111111-3", "Diego Fernández", "Director", "+54 299 4490001", "dfernandez@control.com.ar", 1),
            ("30-22222222-1", "Patricia Vega", "Gerente Comercial", "+54 291 4500001", "pvega@electrotecnia.com.ar", 1),
            ("30-22222222-2", "Ricardo Sosa", "Ventas", "+54 299 4510001", "rsosa@tableros.com.ar", 1),
            ("30-22222222-3", "Fernando Díaz", "Director Técnico", "+54 299 4520001", "fdiaz@motores.com.ar", 1),
            ("30-33333333-1", "Gabriela Castro", "Gerente", "+54 299 4530001", "gcastro@seguridad.com.ar", 1),
            ("30-33333333-2", "Hernán Paz", "Ventas", "+54 299 4540001", "hpaz@proteccion.com.ar", 1),
            ("30-33333333-3", "Luciana Romero", "Comercial", "+54 298 4550001", "lromero@epp.com.ar", 1),
            ("30-44444444-1", "Oscar Molina", "Gerente Técnico", "+54 299 4560001", "omolina@quimicos.com.ar", 1),
            ("30-44444444-2", "Valeria Sánchez", "Ventas", "+54 291 4570001", "vsanchez@solventes.com.ar", 1),
            ("30-44444444-3", "Nicolás Álvarez", "Director", "+54 299 4580001", "nalvarez@lubricantes.com.ar", 1),
            ("30-55555555-1", "Carolina Torres", "Gerente Comercial", "+54 299 4590001", "ctorres@sellos.com.ar", 1),
            ("30-55555555-2", "Sebastián Navarro", "Ventas", "+54 261 4600001", "snavarro@empaquetaduras.com.ar", 1),
            ("30-66666666-1", "Andrea Giménez", "Directora", "+54 299 4610001", "agimenez@filtros.com.ar", 1),
            ("30-66666666-2", "Marcelo Acosta", "Gerente", "+54 299 4620001", "macosta@purificacion.com.ar", 1),
            ("30-77777777-1", "Romina Herrera", "Ventas", "+54 291 4630001", "rherrera@canerias.com.ar", 1),
            ("30-77777777-2", "Eduardo Méndez", "Director", "+54 299 4640001", "emendez@accesorios.com.ar", 1),
            ("30-88888888-1", "Florencia Ríos", "Gerente Comercial", "+54 299 4650001", "frios@skf.com.ar", 1),
            ("30-88888888-2", "Jorge Leiva", "Ventas", "+54 299 4660001", "jleiva@rodamientos.com.ar", 1),
            ("30-99999999-1", "Cecilia Vargas", "Directora", "+54 299 4670001", "cvargas@herramientas.com.ar", 1),
            ("30-99999999-2", "Ariel Peralta", "Gerente", "+54 299 4680001", "aperalta@tools.com.ar", 1),
            ("DE-123456789", "Hans Mueller", "Regional Manager LATAM", "+49 89 555 1001", "hmueller@siemens.com", 1),
            ("BR-98765432100", "Carlos Silva", "Director Regional", "+55 21 555 1001", "csilva@petrobras.com.br", 1),
            ("CL-76543210-9", "Alejandro Vargas", "Gerente Comercial", "+56 2 555 1001", "avargas@minerachilena.cl", 1),
        ]

        if is_using_postgresql():
            # PostgreSQL: columnas (cuit_proveedor, nombre, cargo, telefono, email, principal)
            for c in contactos_data:
                cursor.execute(
                    """
                    INSERT INTO proveedor_ext_contactos
                    (cuit_proveedor, nombre, cargo, telefono, email, principal)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                    c,
                )
        else:
            # SQLite: columnas (cuit_proveedor, nombre, apellido, cargo, es_principal)
            for c in contactos_data:
                nombre_parts = c[1].split(" ", 1)
                nombre = nombre_parts[0]
                apellido = nombre_parts[1] if len(nombre_parts) > 1 else ""
                cursor.execute(
                    """
                    INSERT INTO proveedor_ext_contactos
                    (cuit_proveedor, nombre, apellido, cargo, es_principal)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (c[0], nombre, apellido, c[2], c[5]),
                )

        print(f"  Insertados {len(contactos_data)} contactos")

        # Emails - uno por proveedor (principal)
        emails = []
        for ext in externos_data:
            cuit = ext[0]
            nombre = ext[1].lower().replace(" ", "").replace(".", "").replace(",", "")[:15]
            if "US-" in cuit or "DE-" in cuit or "BR-" in cuit or "CL-" in cuit:
                domain = "com"
            else:
                domain = "com.ar"
            emails.append((cuit, f"ventas@{nombre}.{domain}", "comercial", 1))

        for e in emails:
            cursor.execute(
                """
                INSERT INTO proveedor_ext_emails
                (cuit_proveedor, email, tipo, es_principal)
                VALUES (?, ?, ?, ?)
            """,
                e,
            )
        print(f"  Insertados {len(emails)} emails")

        # Teléfonos - uno por proveedor
        # PostgreSQL: necesita proveedor_id; SQLite: usa cuit_proveedor
        telefonos = []
        for i, ext in enumerate(externos_data):
            cuit = ext[0]
            if "US-" in cuit:
                tel = f"+1 713 555 {1000 + i:04d}"
            elif "DE-" in cuit:
                tel = f"+49 89 555 {1000 + i:04d}"
            elif "BR-" in cuit:
                tel = f"+55 21 555 {1000 + i:04d}"
            elif "CL-" in cuit:
                tel = f"+56 2 555 {1000 + i:04d}"
            else:
                tel = f"+54 299 44{10000 + i * 100:05d}"
            telefonos.append((cuit, tel, "fijo"))

        if is_using_postgresql():
            # PostgreSQL: usa proveedor_id como FK
            for t in telefonos:
                cuit = t[0]
                proveedor_id = cuit_to_id.get(cuit)
                if proveedor_id:
                    cursor.execute(
                        """
                        INSERT INTO proveedor_ext_telefonos
                        (proveedor_id, telefono, tipo)
                        VALUES (?, ?, ?)
                    """,
                        (proveedor_id, t[1], t[2]),
                    )
        else:
            # SQLite: usa cuit_proveedor
            for t in telefonos:
                cursor.execute(
                    """
                    INSERT INTO proveedor_ext_telefonos
                    (cuit_proveedor, telefono, tipo)
                    VALUES (?, ?, ?)
                """,
                    t,
                )
        print(f"  Insertados {len(telefonos)} teléfonos")

        # === PROVEEDORES INTERNOS ===
        internos_data = [
            ("1008", "0001", "UP Loma La Lata", "Mantenimiento", "Mantenimiento", "almacen-lll@ypf.com", "Carlos Pérez", "5", None, None),
            ("1008", "9002", "UP Loma La Lata", "Energía", "Energia", "energia-lll@ypf.com", "Juan García", None, "Pedro Sánchez", "psanchez@ypf.com"),
            ("1008", "9003", "UP Loma La Lata", "Obras", "Obras", "obras-lll@ypf.com", "Luis López", "6", None, None),
            ("1008", "9004", "UP Loma La Lata", "Producción", "Produccion", "produccion-lll@ypf.com", "María Rodríguez", None, "Ana Torres", "atorres@ypf.com"),
            ("1008", "0101", "UP Loma La Lata", "Críticos", "Mantenimiento", "criticos-lll@ypf.com", "Roberto Díaz", "5", None, None),
            ("1050", "0001", "UP UTE Rio Neuquén", "Mantenimiento", "Mantenimiento", "almacen-ute@ypf.com", "Fernando Ruiz", "3", None, None),
            ("1050", "9004", "UP UTE Rio Neuquén", "Producción", "Produccion", "produccion-ute@ypf.com", "Claudia Martín", None, "Jorge Paz", "jpaz@ypf.com"),
            ("1064", "0001", "UP Añelo", "Mantenimiento", "Mantenimiento", "almacen-anelo@ypf.com", "Diego Romero", None, "Miguel Ángel", "mangel@ypf.com"),
            ("1500", "0001", "MID Loma La Lata", "Mantenimiento", "Mantenimiento", "mid-lll@ypf.com", "Patricia Vega", "2", None, None),
        ]

        for i in internos_data:
            upsert_interno(cursor, i)

        conn.commit()

        # Verificar migración básica
        cursor.execute("SELECT COUNT(*) as n FROM proveedores_externos")
        n_externos = cursor.fetchone()["n"]
        print(f"\n✓ Proveedores externos: {n_externos}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_ext_contactos")
        print(f"✓ Contactos: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_ext_emails")
        print(f"✓ Emails: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_ext_telefonos")
        print(f"✓ Teléfonos: {cursor.fetchone()['n']}")

        cursor.execute("SELECT COUNT(*) as n FROM proveedores_internos")
        print(f"✓ Proveedores internos: {cursor.fetchone()['n']}")

    print("\n¡Migración de proveedores completada!")
    return n_externos


def poblar_precios_negociados():
    """Pobla precios negociados vinculados a materiales reales del catálogo."""

    # En producción PostgreSQL, los materiales están en la misma BD
    # En desarrollo SQLite, están en sap_data.db

    # Mapeo de rubros a grupos de artículos (de la tabla stock)
    rubro_keywords = {
        "Válvulas": ["VALVULA", "VALVE"],
        "Bombas": ["BOMBA", "PUMP", "CENTRIF"],
        "Sellos": ["SELLO", "SELL", "SEAL", "EMPAQUE", "JUNTA"],
        "Instrumentación": ["SENSOR", "TRANSM", "MEDIDOR", "INDICADOR", "MANOMETRO"],
        "Automatización": ["PLC", "VARIADOR", "CONTROL", "SIEMENS"],
        "Eléctrico": ["MOTOR", "CABLE", "CONTACTOR", "RELE", "TRANSFORMADOR"],
        "Tableros": ["TABLERO", "GABINETE", "PANEL"],
        "Motores": ["MOTOR", "ROTOR", "ESTATOR"],
        "Filtros": ["FILTRO", "FILTER", "CARTUCHO"],
        "Filtración": ["FILTRO", "FILTER", "ELEMENTO"],
        "Rodamientos": ["RODAMIENTO", "BEARING", "RULEMAN"],
        "Transmisión": ["CORREA", "POLEA", "CADENA", "TRANSMISION"],
        "Ferretería": ["TORNILLO", "TUERCA", "ARANDELA", "PERNO", "CLAVO"],
        "Herramientas": ["HERRAMIENTA", "LLAVE", "DESTORNILLADOR", "PINZA"],
        "Seguridad": ["CASCO", "GUANTE", "ANTEOJOS", "PROTECTOR"],
        "EPP": ["CASCO", "GUANTE", "BOTA", "MAMELUCO"],
        "Químicos": ["QUIMICO", "ACIDO", "SOLVENTE", "ADITIVO"],
        "Solventes": ["SOLVENTE", "THINNER", "DILUYENTE"],
        "Lubricantes": ["ACEITE", "LUBRICANTE", "GRASA"],
        "Cañerías": ["CAÑO", "TUBO", "CAÑERIA", "PIPE"],
        "Accesorios": ["BRIDA", "CODO", "TEE", "REDUCCION", "UNION"],
        "Petrolero": ["PETROLEO", "WELLHEAD", "BOP", "CASING"],
        "Metalúrgica": ["PLANCHA", "CHAPA", "BARRA", "PERFIL"],
        "Distribución": ["GENERAL"],  # Distribuidor genérico
        "Importación": ["IMPORT"],  # Importador genérico
        "Medición": ["MEDIDOR", "CAUDALIMETRO", "NIVEL"],
        "Empaquetaduras": ["EMPAQUE", "JUNTA", "GASKET"],
        "Minería": ["MINERIA", "MINING", "CRUSHER"],
    }

    # Obtener proveedores y materiales
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener proveedores y sus rubros
        cursor.execute("SELECT cuit, rubro FROM proveedores_externos WHERE activo = 1")
        proveedores = cursor.fetchall()

        # Obtener materiales - PostgreSQL tiene stock en la misma BD
        if is_using_postgresql():
            # PostgreSQL: ORDER BY RANDOM() no compatible con GROUP BY, usar subquery
            cursor.execute("""
                SELECT * FROM (
                    SELECT material as codigo, material_descripcion as descripcion,
                           AVG(precio) as precio_promedio, gpo_articulos_descripcion as grupo
                    FROM stock
                    WHERE precio > 0 AND precio < 100000
                    GROUP BY material, material_descripcion, gpo_articulos_descripcion
                ) AS subq
                ORDER BY RANDOM()
                LIMIT 2000
            """)
            materiales = cursor.fetchall()
        else:
            # SQLite: materiales en sap_data.db
            sap_db_path = Path(__file__).parent.parent / "data" / "sap_data.db"
            sap_conn = sqlite3.connect(sap_db_path)
            sap_conn.row_factory = sqlite3.Row
            sap_cursor = sap_conn.cursor()
            sap_cursor.execute("""
                SELECT DISTINCT material as codigo, material_descripcion as descripcion,
                       AVG(precio) as precio_promedio, gpo_articulos_descripcion as grupo
                FROM stock
                WHERE precio > 0 AND precio < 100000
                GROUP BY material
                ORDER BY RANDOM()
                LIMIT 2000
            """)
            materiales = [dict(row) for row in sap_cursor.fetchall()]
            sap_conn.close()

    print(f"\nMateriales disponibles para vincular: {len(materiales)}")
    print(f"Proveedores activos: {len(proveedores)}")

    # Generar precios negociados
    precios_data = []
    hoy = date.today()
    vigencia_desde = hoy.isoformat()
    vigencia_hasta = (hoy + timedelta(days=365)).isoformat()
    condiciones = ["30 días", "45 días", "60 días", "Contado", "15 días"]

    for prov in proveedores:
        cuit = prov["cuit"]
        rubro = prov["rubro"]

        # Obtener keywords para este rubro
        keywords = rubro_keywords.get(rubro, [])
        if not keywords:
            # Usar keyword genérico basado en el rubro
            keywords = [rubro.upper()[:5]]

        # Buscar materiales que coincidan con las keywords
        materiales_match = []
        for mat in materiales:
            desc = (mat["descripcion"] or "").upper()
            grupo = (mat["grupo"] or "").upper()
            for kw in keywords:
                if kw in desc or kw in grupo:
                    materiales_match.append(mat)
                    break

        # Si no hay matches suficientes, tomar algunos aleatorios
        if len(materiales_match) < 10:
            random_mats = random.sample(materiales, min(15, len(materiales)))
            materiales_match.extend(random_mats)

        # Tomar hasta 40 materiales únicos
        materiales_unicos = {}
        for m in materiales_match:
            if m["codigo"] not in materiales_unicos:
                materiales_unicos[m["codigo"]] = m
            if len(materiales_unicos) >= 40:
                break

        # Generar precios con descuento
        for codigo, mat in materiales_unicos.items():
            precio_catalogo = float(mat["precio_promedio"] or 100)
            # Descuento entre 5% y 25%
            descuento = random.uniform(0.05, 0.25)
            precio_negociado = round(precio_catalogo * (1 - descuento), 2)
            condicion = random.choice(condiciones)
            cantidad_min = random.choice([1, 5, 10, 25, 50])

            precios_data.append((
                cuit,
                codigo,
                precio_negociado,
                "USD",
                vigencia_desde,
                vigencia_hasta,
                condicion,
                cantidad_min,
                f"Descuento {int(descuento*100)}% sobre catálogo",
            ))

    # Insertar precios negociados
    with get_db_connection() as conn:
        cursor = conn.cursor()
        inserted = 0
        for p in precios_data:
            try:
                insert_ignore_precio(cursor, p)
                inserted += 1
            except Exception as e:
                print(f"  Error insertando precio: {e}")

        conn.commit()

        cursor.execute("SELECT COUNT(*) as n FROM proveedor_precios_negociados")
        n_precios = cursor.fetchone()["n"]
        print(f"✓ Precios negociados: {n_precios}")

    print("\n¡Precios negociados poblados!")
    return n_precios


if __name__ == "__main__":
    print("=" * 60)
    print("MIGRACIÓN DE PROVEEDORES V2")
    print("=" * 60)

    n_proveedores = migrate_proveedores()

    print("\n" + "=" * 60)
    print("POBLANDO PRECIOS NEGOCIADOS")
    print("=" * 60)

    n_precios = poblar_precios_negociados()

    print("\n" + "=" * 60)
    print("RESUMEN FINAL")
    print("=" * 60)
    print(f"  Proveedores externos: {n_proveedores}")
    print(f"  Precios negociados: {n_precios}")
    print("=" * 60)
