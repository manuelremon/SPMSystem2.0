"""
Servicio de planificación colaborativa de demanda (S&OP).

Maneja ciclos de planificación, entradas de múltiples fuentes,
generación de baseline con ML, y proceso de consenso.
"""

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

# FSM para estados de plan de demanda
ESTADOS_VALIDOS = {
    'draft': ['collecting', 'cancelled'],
    'collecting': ['review', 'cancelled'],
    'review': ['consensus', 'collecting'],
    'consensus': ['approved', 'review'],
    'approved': ['closed'],
    'closed': [],
    'cancelled': []
}


def crear_ciclo_planificacion(data: dict, user_id: int) -> int:
    """
    Crea un nuevo ciclo de planificación de demanda.

    Args:
        data: {
            'nombre': str,
            'periodo_desde': str (YYYY-MM-DD),
            'periodo_hasta': str (YYYY-MM-DD),
            'descripcion': str (optional)
        }
        user_id: ID del usuario creador

    Returns:
        ID del plan creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO plan_demanda
                (nombre, periodo_desde, periodo_hasta, descripcion, estado, creado_por, created_at)
                VALUES (%s, %s, %s, %s, 'draft', %s, NOW())
                RETURNING id
            """, (
                data['nombre'],
                data['periodo_desde'],
                data['periodo_hasta'],
                data.get('descripcion'),
                user_id
            ))
            plan_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO plan_demanda
                (nombre, periodo_desde, periodo_hasta, descripcion, estado, creado_por, created_at)
                VALUES (?, ?, ?, ?, 'draft', ?, datetime('now'))
            """, (
                data['nombre'],
                data['periodo_desde'],
                data['periodo_hasta'],
                data.get('descripcion'),
                user_id
            ))
            plan_id = cursor.lastrowid

        conn.commit()
        return plan_id


def obtener_ciclos(filtros: dict) -> dict:
    """
    Obtiene lista paginada de ciclos de planificación.

    Args:
        filtros: {
            'estado': str (optional),
            'search': str (optional),
            'page': int,
            'per_page': int
        }

    Returns:
        {items: [...], total: int, page: int, pages: int}
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 20)
    offset = (page - 1) * per_page

    where_clauses = []
    params = []

    if filtros.get('estado'):
        where_clauses.append(f"pd.estado = {placeholder}")
        params.append(filtros['estado'])

    if filtros.get('search'):
        where_clauses.append(f"pd.nombre LIKE {placeholder}")
        params.append(f"%{filtros['search']}%")

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Contar total
        cursor.execute(
            f"SELECT COUNT(*) FROM plan_demanda pd {where_sql}",
            params
        )
        total = cursor.fetchone()[0]

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                pd.id, pd.nombre, pd.periodo_desde, pd.periodo_hasta,
                pd.estado, pd.created_at, pd.creado_por,
                u.nombre as creado_por_nombre,
                COUNT(DISTINCT pde.id) as num_entradas,
                COUNT(DISTINCT pdc.id) as num_consensos
            FROM plan_demanda pd
            LEFT JOIN usuarios u ON pd.creado_por::text = u.id_spm
            LEFT JOIN plan_demanda_entrada pde ON pd.id = pde.plan_id
            LEFT JOIN plan_demanda_consenso pdc ON pd.id = pdc.plan_id
            {where_sql}
            GROUP BY pd.id, pd.nombre, pd.periodo_desde, pd.periodo_hasta,
                     pd.estado, pd.created_at, pd.creado_por, u.nombre
            ORDER BY pd.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'nombre': row[1],
                'periodo_desde': row[2],
                'periodo_hasta': row[3],
                'estado': row[4],
                'created_at': row[5],
                'creado_por': row[6],
                'creado_por_nombre': row[7],
                'num_entradas': row[8],
                'num_consensos': row[9]
            })

        pages = (total + per_page - 1) // per_page

        return {
            'items': items,
            'total': total,
            'page': page,
            'pages': pages
        }
    finally:
        cursor.close()
        conn.close()


def obtener_detalle_ciclo(plan_id: int) -> dict:
    """
    Obtiene detalle completo de un ciclo de planificación.

    Args:
        plan_id: ID del plan

    Returns:
        Diccionario con plan, entradas y consensos
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener plan
        cursor.execute(
            f"""
            SELECT
                pd.id, pd.nombre, pd.periodo_desde, pd.periodo_hasta,
                pd.descripcion, pd.estado, pd.created_at, pd.creado_por,
                u.nombre as creado_por_nombre
            FROM plan_demanda pd
            LEFT JOIN usuarios u ON pd.creado_por::text = u.id_spm
            WHERE pd.id = {placeholder}
            """,
            (plan_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Plan {plan_id} no encontrado")

        plan = {
            'id': row[0],
            'nombre': row[1],
            'periodo_desde': row[2],
            'periodo_hasta': row[3],
            'descripcion': row[4],
            'estado': row[5],
            'created_at': row[6],
            'creado_por': row[7],
            'creado_por_nombre': row[8]
        }

        # Obtener entradas agrupadas por material
        cursor.execute(
            f"""
            SELECT
                pde.material_codigo,
                m.descripcion as material_descripcion,
                pde.fuente,
                pde.cantidad_pronosticada,
                pde.created_at,
                pde.creado_por,
                u.nombre as creado_por_nombre,
                pde.notas
            FROM plan_demanda_entrada pde
            LEFT JOIN catalogo_materiales m ON pde.material_codigo = m.codigo
            LEFT JOIN usuarios u ON pde.creado_por::text = u.id_spm
            WHERE pde.plan_id = {placeholder}
            ORDER BY pde.material_codigo, pde.created_at
            """,
            (plan_id,)
        )

        entradas_por_material = {}
        for row in cursor.fetchall():
            material_codigo = row[0]
            if material_codigo not in entradas_por_material:
                entradas_por_material[material_codigo] = {
                    'material_codigo': material_codigo,
                    'material_descripcion': row[1],
                    'entradas': []
                }

            entradas_por_material[material_codigo]['entradas'].append({
                'fuente': row[2],
                'cantidad_pronosticada': float(row[3]) if row[3] else 0,
                'created_at': row[4],
                'creado_por': row[5],
                'creado_por_nombre': row[6],
                'notas': row[7]
            })

        plan['entradas'] = list(entradas_por_material.values())

        # Obtener consensos
        cursor.execute(
            f"""
            SELECT
                pdc.material_codigo,
                m.descripcion as material_descripcion,
                pdc.cantidad_consenso,
                pdc.aprobado_por,
                u.nombre as aprobado_por_nombre,
                pdc.notas,
                pdc.created_at
            FROM plan_demanda_consenso pdc
            LEFT JOIN catalogo_materiales m ON pdc.material_codigo = m.codigo
            LEFT JOIN usuarios u ON pdc.aprobado_por::text = u.id_spm
            WHERE pdc.plan_id = {placeholder}
            ORDER BY pdc.material_codigo
            """,
            (plan_id,)
        )

        consensos = []
        for row in cursor.fetchall():
            consensos.append({
                'material_codigo': row[0],
                'material_descripcion': row[1],
                'cantidad_consenso': float(row[2]) if row[2] else 0,
                'aprobado_por': row[3],
                'aprobado_por_nombre': row[4],
                'notas': row[5],
                'created_at': row[6]
            })

        plan['consensos'] = consensos

        return plan
    finally:
        cursor.close()
        conn.close()


def cambiar_estado_ciclo(plan_id: int, nuevo_estado: str, user_id: int) -> dict:
    """
    Cambia el estado de un ciclo de planificación (FSM).

    Args:
        plan_id: ID del plan
        nuevo_estado: Nuevo estado destino
        user_id: ID del usuario realizando el cambio

    Returns:
        Plan actualizado
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Obtener estado actual
        cursor.execute(
            f"SELECT estado FROM plan_demanda WHERE id = {placeholder}",
            (plan_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Plan {plan_id} no encontrado")

        estado_actual = result[0]

        # Validar transición
        if nuevo_estado not in ESTADOS_VALIDOS.get(estado_actual, []):
            raise ValueError(
                f"Transición inválida: {estado_actual} → {nuevo_estado}. "
                f"Estados permitidos: {ESTADOS_VALIDOS.get(estado_actual, [])}"
            )

        # Actualizar estado
        cursor.execute(
            f"UPDATE plan_demanda SET estado = {placeholder} WHERE id = {placeholder}",
            (nuevo_estado, plan_id)
        )

        conn.commit()

        # Obtener plan actualizado
        cursor.execute(
            f"""
            SELECT id, nombre, estado, created_at
            FROM plan_demanda
            WHERE id = {placeholder}
            """,
            (plan_id,)
        )
        row = cursor.fetchone()

        return {
            'id': row[0],
            'nombre': row[1],
            'estado': row[2],
            'created_at': row[3]
        }


def agregar_entrada(plan_id: int, data: dict, user_id: int) -> int:
    """
    Agrega una entrada de pronóstico al plan.

    Args:
        plan_id: ID del plan
        data: {
            'material_codigo': str,
            'fuente': str ('sales', 'operations', 'finance', 'ml_baseline', 'manual'),
            'cantidad_pronosticada': float,
            'notas': str (optional)
        }
        user_id: ID del usuario

    Returns:
        ID de la entrada creada
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO plan_demanda_entrada
                (plan_id, material_codigo, fuente, cantidad_pronosticada, notas, creado_por, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                plan_id,
                data['material_codigo'],
                data['fuente'],
                data['cantidad_pronosticada'],
                data.get('notas'),
                user_id
            ))
            entrada_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO plan_demanda_entrada
                (plan_id, material_codigo, fuente, cantidad_pronosticada, notas, creado_por, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                plan_id,
                data['material_codigo'],
                data['fuente'],
                data['cantidad_pronosticada'],
                data.get('notas'),
                user_id
            ))
            entrada_id = cursor.lastrowid

        conn.commit()
        return entrada_id


def generar_baseline_ml(plan_id: int) -> dict:
    """
    Genera pronósticos baseline usando ML para todos los materiales del plan.

    Args:
        plan_id: ID del plan

    Returns:
        Resumen de materiales procesados
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    # Importar servicios ML (opcional, puede fallar si no están disponibles)
    try:
        from backend.agent.pipelines.forecast.ensemble import EnsemblePredictor
        ml_disponible = True
    except ImportError:
        ml_disponible = False

    with get_db_transaction() as (conn, cursor):
        # Obtener periodo del plan
        cursor.execute(
            f"SELECT periodo_desde, periodo_hasta FROM plan_demanda WHERE id = {placeholder}",
            (plan_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Plan {plan_id} no encontrado")

        result[0]
        result[1]

        # Obtener materiales únicos en el plan
        cursor.execute(
            f"""
            SELECT DISTINCT material_codigo
            FROM plan_demanda_entrada
            WHERE plan_id = {placeholder}
            """,
            (plan_id,)
        )

        materiales = [row[0] for row in cursor.fetchall()]
        materiales_procesados = 0

        for material_codigo in materiales:
            try:
                if ml_disponible:
                    # Usar ensemble predictor si está disponible
                    predictor = EnsemblePredictor()
                    resultado = predictor.predecir(material_codigo, horizonte=3)
                    cantidad_pronosticada = sum(resultado.get('predicciones', []))
                else:
                    # Fallback: promedio simple de consumo histórico
                    cursor.execute(
                        f"""
                        SELECT AVG(cantidad) as avg_cantidad
                        FROM consumo_historico
                        WHERE material_codigo = {placeholder}
                        """,
                        (material_codigo,)
                    )
                    avg_result = cursor.fetchone()
                    cantidad_pronosticada = float(avg_result[0]) if avg_result and avg_result[0] else 0

                # Insertar entrada ML baseline
                if using_pg:
                    cursor.execute("""
                        INSERT INTO plan_demanda_entrada
                        (plan_id, material_codigo, fuente, cantidad_pronosticada,
                         notas, creado_por, created_at)
                        VALUES (%s, %s, 'ml_baseline', %s, 'Generado automáticamente por ML', NULL, NOW())
                        ON CONFLICT (plan_id, material_codigo, fuente) DO UPDATE SET
                            cantidad_pronosticada = EXCLUDED.cantidad_pronosticada,
                            created_at = NOW()
                    """, (plan_id, material_codigo, cantidad_pronosticada))
                else:
                    # SQLite: verificar existencia y actualizar o insertar
                    cursor.execute("""
                        SELECT id FROM plan_demanda_entrada
                        WHERE plan_id = ? AND material_codigo = ? AND fuente = 'ml_baseline'
                    """, (plan_id, material_codigo))

                    existing = cursor.fetchone()
                    if existing:
                        cursor.execute("""
                            UPDATE plan_demanda_entrada
                            SET cantidad_pronosticada = ?, created_at = datetime('now')
                            WHERE id = ?
                        """, (cantidad_pronosticada, existing[0]))
                    else:
                        cursor.execute("""
                            INSERT INTO plan_demanda_entrada
                            (plan_id, material_codigo, fuente, cantidad_pronosticada,
                             notas, creado_por, created_at)
                            VALUES (?, ?, 'ml_baseline', ?, 'Generado automáticamente por ML', NULL, datetime('now'))
                        """, (plan_id, material_codigo, cantidad_pronosticada))

                materiales_procesados += 1

            except Exception as e:
                print(f"Error procesando {material_codigo}: {e}")
                continue

        conn.commit()

        return {
            'materiales_procesados': materiales_procesados,
            'total_materiales': len(materiales),
            'metodo': 'ml_ensemble' if ml_disponible else 'promedio_historico'
        }


def calcular_consenso(plan_id: int) -> dict:
    """
    Calcula el consenso para cada material usando weighted average.

    Pesos:
    - ml_baseline: 2
    - Otras fuentes: 1

    Args:
        plan_id: ID del plan

    Returns:
        Resumen de materiales procesados
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Obtener todos los materiales con entradas
        cursor.execute(
            f"""
            SELECT DISTINCT material_codigo
            FROM plan_demanda_entrada
            WHERE plan_id = {placeholder}
            """,
            (plan_id,)
        )

        materiales = [row[0] for row in cursor.fetchall()]
        materiales_procesados = 0

        for material_codigo in materiales:
            # Obtener todas las entradas del material
            cursor.execute(
                f"""
                SELECT fuente, cantidad_pronosticada
                FROM plan_demanda_entrada
                WHERE plan_id = {placeholder} AND material_codigo = {placeholder}
                """,
                (plan_id, material_codigo)
            )

            entradas = cursor.fetchall()
            suma_ponderada = 0
            suma_pesos = 0

            for fuente, cantidad in entradas:
                peso = 2 if fuente == 'ml_baseline' else 1
                suma_ponderada += float(cantidad) * peso
                suma_pesos += peso

            cantidad_consenso = suma_ponderada / suma_pesos if suma_pesos > 0 else 0

            # Upsert consenso
            if using_pg:
                cursor.execute("""
                    INSERT INTO plan_demanda_consenso
                    (plan_id, material_codigo, cantidad_consenso, created_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (plan_id, material_codigo) DO UPDATE SET
                        cantidad_consenso = EXCLUDED.cantidad_consenso,
                        created_at = NOW()
                """, (plan_id, material_codigo, cantidad_consenso))
            else:
                cursor.execute("""
                    INSERT OR REPLACE INTO plan_demanda_consenso
                    (plan_id, material_codigo, cantidad_consenso, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                """, (plan_id, material_codigo, cantidad_consenso))

            materiales_procesados += 1

        conn.commit()

        return {
            'materiales': materiales_procesados
        }


def aprobar_consenso(plan_id: int, user_id: int) -> dict:
    """
    Aprueba todos los consensos del plan y cambia estado a 'approved'.

    Args:
        plan_id: ID del plan
        user_id: ID del usuario aprobando

    Returns:
        Resumen de la operación
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Actualizar consensos con aprobado_por
        cursor.execute(
            f"UPDATE plan_demanda_consenso SET aprobado_por = {placeholder} WHERE plan_id = {placeholder}",
            (user_id, plan_id)
        )

        # Cambiar estado del plan
        cursor.execute(
            f"UPDATE plan_demanda SET estado = 'approved' WHERE id = {placeholder}",
            (plan_id,)
        )

        conn.commit()

        return {
            'plan_id': plan_id,
            'estado': 'approved',
            'aprobado_por': user_id
        }


def obtener_accuracy_kpis() -> dict:
    """
    Calcula KPIs de accuracy comparando consensos históricos vs consumo real.

    Returns:
        {
            'mape': float (Mean Absolute Percentage Error),
            'bias': float (sesgo promedio),
            'accuracy_pct': float (% dentro de ±10% tolerancia)
        }
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener consensos de planes aprobados con fecha en el pasado
        cursor.execute("""
            SELECT
                pdc.material_codigo,
                pdc.cantidad_consenso,
                pd.periodo_desde,
                pd.periodo_hasta
            FROM plan_demanda_consenso pdc
            JOIN plan_demanda pd ON pdc.plan_id = pd.id
            WHERE pd.estado = 'approved'
            AND pd.periodo_hasta::date < CURRENT_DATE
        """)

        comparaciones = []
        for row in cursor.fetchall():
            material_codigo = row[0]
            cantidad_consenso = float(row[1]) if row[1] else 0
            periodo_desde = row[2]
            periodo_hasta = row[3]

            # Obtener consumo real del periodo
            cursor.execute("""
                SELECT SUM(cantidad) as consumo_real
                FROM consumo_historico
                WHERE material = %s
                AND fecha >= %s AND fecha <= %s
            """, (material_codigo, str(periodo_desde), str(periodo_hasta)))

            result = cursor.fetchone()
            consumo_real = float(result[0]) if result and result[0] else 0

            if consumo_real > 0:
                error_abs_pct = abs(cantidad_consenso - consumo_real) / consumo_real * 100
                bias = (cantidad_consenso - consumo_real) / consumo_real * 100
                dentro_tolerancia = error_abs_pct <= 10

                comparaciones.append({
                    'error_abs_pct': error_abs_pct,
                    'bias': bias,
                    'dentro_tolerancia': dentro_tolerancia
                })

        if not comparaciones:
            return {
                'mape': 0,
                'bias': 0,
                'accuracy_pct': 0,
                'num_comparaciones': 0
            }

        # Calcular métricas
        mape = sum(c['error_abs_pct'] for c in comparaciones) / len(comparaciones)
        bias = sum(c['bias'] for c in comparaciones) / len(comparaciones)
        accuracy_pct = sum(1 for c in comparaciones if c['dentro_tolerancia']) / len(comparaciones) * 100

        return {
            'mape': round(mape, 2),
            'bias': round(bias, 2),
            'accuracy_pct': round(accuracy_pct, 2),
            'num_comparaciones': len(comparaciones)
        }
    finally:
        cursor.close()
        conn.close()
