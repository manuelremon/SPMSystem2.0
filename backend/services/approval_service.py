"""
Servicio de Reglas de Aprobacion.

Gestiona la matriz de aprobacion parametrizable:
- Determinacion del aprobador segun monto/centro/sector/criticidad
- Validacion de permisos de aprobacion
- Delegacion temporal de aprobaciones
- CRUD de reglas

Sprint 2.3 - Implementacion basada en TDD
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id
except ImportError:
    from core.db import get_db_connection, get_db_transaction, insert_returning_id


# =============================================================================
# Excepciones
# =============================================================================


class ApprovalError(Exception):
    """Excepcion base para errores de aprobacion."""

    pass


class ApprovalValidationError(ApprovalError):
    """Error de validacion en datos de aprobacion."""

    pass


class AprobadorNoEncontradoError(ApprovalError):
    """No se encontro aprobador disponible."""

    pass


# =============================================================================
# Jerarquia de Roles
# =============================================================================


JERARQUIA_ROLES: Dict[str, int] = {
    "usuario": 0,
    "solicitante": 0,
    "aprobador": 1,
    "aprobador_solicitudes": 1,
    "aprobador_presupuestos": 1,
    "coordinador": 2,
    "jefe": 3,
    "gerente": 4,
    "gerente1": 4,
    "gerente2": 4,
    "admin": 5,
    "administrador": 5,
}


def rol_tiene_nivel(rol_usuario: str, rol_requerido: str) -> bool:
    """
    Verifica si un rol tiene nivel suficiente para otro.

    Soporta roles multiples separados por coma (ej: "gerente2, aprobador_solicitudes").
    Toma el nivel mas alto entre todos los roles del usuario.

    Args:
        rol_usuario: Rol(es) del usuario (puede ser lista separada por coma)
        rol_requerido: Rol requerido para la accion

    Returns:
        True si el nivel mas alto del usuario >= rol_requerido en jerarquia
    """
    # Parsear roles multiples separados por coma
    roles_usuario = [r.strip().lower() for r in rol_usuario.split(",")]

    # Obtener el nivel mas alto entre todos los roles del usuario
    nivel_usuario = max(
        JERARQUIA_ROLES.get(rol, 0) for rol in roles_usuario
    )

    nivel_requerido = JERARQUIA_ROLES.get(rol_requerido.lower(), 0)
    return nivel_usuario >= nivel_requerido


# =============================================================================
# Validaciones
# =============================================================================


def validar_monto(monto: float) -> None:
    """
    Valida que el monto sea valido.

    Args:
        monto: Monto en USD

    Raises:
        ApprovalValidationError si monto es invalido
    """
    if monto is None or monto < 0:
        raise ApprovalValidationError("El monto debe ser un numero positivo")


def validar_regla(regla: Dict[str, Any]) -> None:
    """
    Valida que una regla tenga los campos requeridos.

    Args:
        regla: Diccionario con datos de regla

    Raises:
        ApprovalValidationError si la regla es invalida
    """
    if not regla.get("nombre"):
        raise ApprovalValidationError("El nombre de la regla es requerido")

    if not regla.get("rol_requerido"):
        raise ApprovalValidationError("El rol requerido es obligatorio")


def validar_fechas_delegacion(fecha_inicio: str, fecha_fin: str) -> None:
    """
    Valida que las fechas de delegacion sean validas.

    Args:
        fecha_inicio: Fecha de inicio (ISO format)
        fecha_fin: Fecha de fin (ISO format)

    Raises:
        ApprovalValidationError si las fechas son invalidas
    """
    try:
        inicio = datetime.fromisoformat(fecha_inicio.replace("Z", "+00:00"))
        fin = datetime.fromisoformat(fecha_fin.replace("Z", "+00:00"))

        if fin <= inicio:
            raise ApprovalValidationError("La fecha de fin debe ser posterior a la de inicio")

    except (ValueError, TypeError) as e:
        raise ApprovalValidationError(f"Fechas invalidas: {e}")


# =============================================================================
# Funciones Principales
# =============================================================================


def obtener_regla_aprobacion(
    monto_usd: float,
    centro: Optional[str] = None,
    sector: Optional[str] = None,
    criticidad: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Obtiene la regla de aprobacion aplicable segun los parametros.

    Prioridad de busqueda:
    1. Reglas especificas por centro/sector/criticidad
    2. Reglas generales por monto

    Args:
        monto_usd: Monto de la solicitud
        centro: Centro de costo (opcional)
        sector: Sector (opcional)
        criticidad: Nivel de criticidad (opcional)

    Returns:
        Diccionario con la regla aplicable o None
    """
    validar_monto(monto_usd)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Buscar regla especifica por criticidad primero
        if criticidad:
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND criticidad = ?
                    AND (monto_minimo_usd <= ? OR monto_minimo_usd IS NULL)
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                ORDER BY nivel_aprobacion DESC
                LIMIT 1
            """,
                (criticidad, monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            if row:
                return dict(row)

        # Buscar regla por centro
        if centro:
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND centro = ?
                    AND (monto_minimo_usd <= ? OR monto_minimo_usd IS NULL)
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                ORDER BY nivel_aprobacion DESC
                LIMIT 1
            """,
                (centro, monto_usd, monto_usd),
            )
            row = cursor.fetchone()
            if row:
                return dict(row)

        # Buscar regla general por monto
        # Prioriza reglas con monto_minimo_usd mas alto (mas especificas)
        # Excluye la regla Admin (que cubre todo el rango) a menos que sea la unica
        cursor.execute(
            """
            SELECT * FROM reglas_aprobacion
            WHERE activo = 1
                AND centro IS NULL
                AND sector IS NULL
                AND criticidad IS NULL
                AND monto_minimo_usd <= ?
                AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                AND LOWER(posicion_requerida) != 'admin'
            ORDER BY monto_minimo_usd DESC
            LIMIT 1
        """,
            (monto_usd, monto_usd),
        )

        row = cursor.fetchone()

        # Si no se encontro regla, buscar la regla Admin (fallback)
        if not row:
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND LOWER(posicion_requerida) = 'admin'
                    AND monto_minimo_usd <= ?
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                LIMIT 1
            """,
                (monto_usd, monto_usd),
            )
            row = cursor.fetchone()

        return dict(row) if row else None


def posicion_tiene_nivel(posicion_usuario: str, posicion_requerida: str) -> bool:
    """
    Verifica si una posicion/puesto tiene nivel suficiente para otra.

    Jerarquia de posiciones:
    - jefe (nivel 1): puede aprobar hasta USD 100,000
    - gerente1 (nivel 2): puede aprobar hasta USD 10,000,000
    - gerente2 (nivel 3): puede aprobar hasta USD 100,000,000
    - admin (nivel 4): puede aprobar cualquier monto

    Args:
        posicion_usuario: Posicion del usuario
        posicion_requerida: Posicion requerida por la regla

    Returns:
        True si posicion_usuario >= posicion_requerida en jerarquia
    """
    jerarquia_posiciones = {
        "jefe": 1,
        "gerente1": 2,
        "gerente2": 3,
        "admin": 4,
        "administrador": 4,
    }

    nivel_usuario = jerarquia_posiciones.get(posicion_usuario.lower(), 0)
    nivel_requerido = jerarquia_posiciones.get(posicion_requerida.lower(), 0)

    return nivel_usuario >= nivel_requerido


def puede_aprobar(
    usuario_id: str,
    monto_usd: float,
    centro: Optional[str] = None,
    sector: Optional[str] = None,
    criticidad: Optional[str] = None,
    verificar_delegacion: bool = False,
) -> Dict[str, Any]:
    """
    Verifica si un usuario puede aprobar una solicitud.

    La verificacion se basa en:
    1. ROL del usuario debe contener "aprobador_solicitudes"
    2. POSICION del usuario debe tener nivel suficiente segun el monto

    Args:
        usuario_id: ID del usuario
        monto_usd: Monto de la solicitud
        centro: Centro de costo
        sector: Sector
        criticidad: Criticidad
        verificar_delegacion: Si debe verificar delegaciones activas

    Returns:
        Dict con resultado de validacion:
        {
            "puede_aprobar": bool,
            "posicion_usuario": str,
            "posicion_requerida": str,
            "nivel_aprobacion": int,
            "razon": str (si no puede)
        }
    """
    validar_monto(monto_usd)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener rol y posicion del usuario
        cursor.execute("SELECT rol, posicion FROM usuarios WHERE id_spm = ?", (usuario_id,))
        user_row = cursor.fetchone()
        if not user_row:
            return {"puede_aprobar": False, "razon": "Usuario no encontrado"}

        rol_usuario = (user_row["rol"] or "").lower()
        posicion_usuario = (user_row["posicion"] or "").lower()

        # Admin siempre puede aprobar (por posicion)
        if posicion_usuario in ["admin", "administrador"]:
            return {
                "puede_aprobar": True,
                "posicion_usuario": posicion_usuario,
                "posicion_requerida": "cualquiera",
                "nivel_aprobacion": 0,
                "es_admin": True,
            }

    # Obtener regla aplicable
    regla = obtener_regla_aprobacion(monto_usd, centro, sector, criticidad)

    if not regla:
        return {
            "puede_aprobar": False,
            "posicion_usuario": posicion_usuario,
            "razon": "No hay regla de aprobacion definida para este monto",
        }

    # Usar posicion_requerida si existe
    posicion_requerida = regla.get("posicion_requerida") or regla.get("rol_requerido", "admin")

    # Verificar si el usuario tiene el ROL de aprobador
    if "aprobador_solicitudes" not in rol_usuario:
        return {
            "puede_aprobar": False,
            "posicion_usuario": posicion_usuario,
            "posicion_requerida": posicion_requerida,
            "nivel_aprobacion": regla.get("nivel_aprobacion", 0),
            "razon": "Se requiere rol 'aprobador_solicitudes'",
        }

    # Verificar jerarquia de posiciones
    if posicion_tiene_nivel(posicion_usuario, posicion_requerida):
        return {
            "puede_aprobar": True,
            "posicion_usuario": posicion_usuario,
            "posicion_requerida": posicion_requerida,
            "nivel_aprobacion": regla.get("nivel_aprobacion", 0),
        }

    # Verificar si el usuario es delegado de alguien que puede aprobar
    if verificar_delegacion:
        delegaciones = obtener_delegaciones_como_delegado(usuario_id)
        for delegacion in delegaciones:
            # Verificar si el aprobador original puede aprobar este monto
            aprobador_original_id = delegacion.get("aprobador_original_id")
            posicion_original = (delegacion.get("posicion_original") or "").lower()

            # Si el aprobador original tiene nivel suficiente
            if posicion_tiene_nivel(posicion_original, posicion_requerida):
                return {
                    "puede_aprobar": True,
                    "posicion_usuario": posicion_usuario,
                    "posicion_requerida": posicion_requerida,
                    "nivel_aprobacion": regla.get("nivel_aprobacion", 0),
                    "es_delegado": True,
                    "delegado_de": aprobador_original_id,
                    "posicion_delegante": posicion_original,
                }

    return {
        "puede_aprobar": False,
        "posicion_usuario": posicion_usuario,
        "posicion_requerida": posicion_requerida,
        "nivel_aprobacion": regla.get("nivel_aprobacion", 0),
        "razon": f"Se requiere posicion '{posicion_requerida}' o superior",
    }


def buscar_aprobador(
    monto_usd: float,
    centro: Optional[str] = None,
    sector: Optional[str] = None,
    criticidad: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Busca un aprobador disponible para el monto dado.

    Logica de busqueda:
    1. Usuarios con ROL "aprobador_solicitudes"
    2. Con PUESTO (posicion) de nivel suficiente segun el monto:
       - 0.01-100,000 USD: Jefe, Gerente1, Gerente2, Admin
       - 100,000.01-10,000,000 USD: Gerente1, Gerente2, Admin
       - 10,000,000.01-100,000,000 USD: Gerente2, Admin
       - Admin puede aprobar cualquier monto
    3. Prioriza aprobadores del mismo centro

    Args:
        monto_usd: Monto de la solicitud
        centro: Centro de costo (prioriza aprobadores del mismo centro)
        sector: Sector
        criticidad: Criticidad

    Returns:
        Diccionario con datos del aprobador o None
    """
    validar_monto(monto_usd)

    regla = obtener_regla_aprobacion(monto_usd, centro, sector, criticidad)
    if not regla:
        return None

    # Usar posicion_requerida si existe, sino rol_requerido para backward compat
    posicion_requerida = regla.get("posicion_requerida") or regla.get("rol_requerido", "admin")

    # Mapeo de POSICION requerida a puestos validos (jerarquia)
    # Si se requiere jefe: jefe, gerente1, gerente2, admin pueden aprobar
    # Si se requiere gerente1: gerente1, gerente2, admin pueden aprobar
    # Si se requiere gerente2: gerente2, admin pueden aprobar
    # Si se requiere admin: solo admin puede aprobar
    puestos_por_nivel = {
        "jefe": ["jefe", "gerente1", "gerente2", "admin", "administrador"],
        "gerente1": ["gerente1", "gerente2", "admin", "administrador"],
        "gerente2": ["gerente2", "admin", "administrador"],
        "admin": ["admin", "administrador"],
        "administrador": ["admin", "administrador"],
        # Backward compat con valores antiguos
        "aprobador": ["jefe", "gerente1", "gerente2", "admin", "administrador"],
        "gerente": ["gerente1", "gerente2", "admin", "administrador"],
    }

    puestos_validos = puestos_por_nivel.get(posicion_requerida.lower(), ["admin", "administrador"])

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Buscar aprobador con ROL "aprobador_solicitudes" y PUESTO adecuado
        # Prioriza aprobadores del mismo centro
        # Usar IN clause con placeholders dinamicos (compatible SQLite/PostgreSQL)
        placeholders = ",".join(["?"] * len(puestos_validos))

        if centro:
            query = f"""
                SELECT id_spm, nombre, apellido, rol, posicion, centros
                FROM usuarios
                WHERE LOWER(rol) LIKE '%aprobador_solicitudes%'
                    AND LOWER(posicion) IN ({placeholders})
                    AND (',' || centros || ',') LIKE ?
                    AND estado_registro = 'Activo'
                ORDER BY
                    CASE WHEN (',' || centros || ',') LIKE ? THEN 0 ELSE 1 END,
                    CASE LOWER(posicion)
                        WHEN 'jefe' THEN 1
                        WHEN 'gerente1' THEN 2
                        WHEN 'gerente2' THEN 3
                        WHEN 'admin' THEN 4
                        WHEN 'administrador' THEN 4
                        ELSE 5
                    END,
                    nombre
                LIMIT 1
            """
            params = tuple(puestos_validos) + (f"%,{centro},%", f"%,{centro},%")
            cursor.execute(query, params)
        else:
            query = f"""
                SELECT id_spm, nombre, apellido, rol, posicion, centros
                FROM usuarios
                WHERE LOWER(rol) LIKE '%aprobador_solicitudes%'
                    AND LOWER(posicion) IN ({placeholders})
                    AND estado_registro = 'Activo'
                ORDER BY
                    CASE LOWER(posicion)
                        WHEN 'jefe' THEN 1
                        WHEN 'gerente1' THEN 2
                        WHEN 'gerente2' THEN 3
                        WHEN 'admin' THEN 4
                        WHEN 'administrador' THEN 4
                        ELSE 5
                    END,
                    nombre
                LIMIT 1
            """
            cursor.execute(query, tuple(puestos_validos))

        row = cursor.fetchone()
        return dict(row) if row else None


# =============================================================================
# Delegacion de Aprobaciones
# =============================================================================


def crear_delegacion(
    aprobador_original_id: str,
    delegado_id: str,
    fecha_inicio: str,
    fecha_fin: str,
    motivo: Optional[str] = None,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Crea una delegacion temporal de aprobaciones.

    Args:
        aprobador_original_id: ID del aprobador que delega
        delegado_id: ID del delegado
        fecha_inicio: Fecha de inicio
        fecha_fin: Fecha de fin
        motivo: Motivo de la delegacion
        created_by: Usuario que crea la delegacion

    Returns:
        Diccionario con ID de la delegacion creada
    """
    validar_fechas_delegacion(fecha_inicio, fecha_fin)

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        new_id = insert_returning_id(
            cursor,
            """
            INSERT INTO aprobadores_delegados
                (aprobador_original_id, delegado_id, fecha_inicio, fecha_fin, motivo, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (aprobador_original_id, delegado_id, fecha_inicio, fecha_fin, motivo, created_by),
        )

        return {"id": new_id}


def obtener_delegacion_activa(aprobador_id: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene la delegacion activa para un aprobador.

    Args:
        aprobador_id: ID del aprobador original

    Returns:
        Diccionario con datos de delegacion o None
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        cursor.execute(
            """
            SELECT * FROM aprobadores_delegados
            WHERE aprobador_original_id = ?
                AND activo = 1
                AND fecha_inicio <= ?
                AND fecha_fin >= ?
            ORDER BY fecha_fin DESC
            LIMIT 1
        """,
            (aprobador_id, now, now),
        )

        row = cursor.fetchone()
        return dict(row) if row else None


def obtener_delegaciones_como_delegado(delegado_id: str) -> List[Dict[str, Any]]:
    """
    Obtiene las delegaciones activas donde el usuario es el delegado.

    Args:
        delegado_id: ID del usuario delegado

    Returns:
        Lista de delegaciones donde este usuario es el delegado
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        cursor.execute(
            """
            SELECT d.*, u.rol as rol_original, u.posicion as posicion_original
            FROM aprobadores_delegados d
            JOIN usuarios u ON d.aprobador_original_id = u.id_spm
            WHERE d.delegado_id = ?
                AND d.activo = 1
                AND d.fecha_inicio <= ?
                AND d.fecha_fin >= ?
            ORDER BY d.fecha_fin DESC
        """,
            (delegado_id, now, now),
        )

        rows = cursor.fetchall()
        return [dict(row) for row in rows] if rows else []


# =============================================================================
# CRUD de Reglas
# =============================================================================


def listar_reglas(solo_activas: bool = True) -> List[Dict[str, Any]]:
    """
    Lista todas las reglas de aprobacion.

    Args:
        solo_activas: Si solo debe retornar reglas activas

    Returns:
        Lista de reglas
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if solo_activas:
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                ORDER BY nivel_aprobacion, monto_minimo_usd
            """
            )
        else:
            cursor.execute(
                """
                SELECT * FROM reglas_aprobacion
                ORDER BY nivel_aprobacion, monto_minimo_usd
            """
            )

        return [dict(row) for row in cursor.fetchall()]


def crear_regla(
    nombre: str,
    rol_requerido: str,
    nivel_aprobacion: int = 1,
    monto_minimo_usd: float = 0,
    monto_maximo_usd: Optional[float] = None,
    centro: Optional[str] = None,
    sector: Optional[str] = None,
    criticidad: Optional[str] = None,
    requiere_justificacion: bool = False,
    requiere_documentacion: bool = False,
    descripcion: Optional[str] = None,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Crea una nueva regla de aprobacion.

    Args:
        nombre: Nombre de la regla
        rol_requerido: Rol minimo para aprobar
        nivel_aprobacion: Nivel en la jerarquia
        monto_minimo_usd: Monto minimo aplicable
        monto_maximo_usd: Monto maximo aplicable (None = sin limite)
        centro: Centro especifico (None = todos)
        sector: Sector especifico (None = todos)
        criticidad: Criticidad especifica (None = todas)
        requiere_justificacion: Si requiere justificacion adicional
        requiere_documentacion: Si requiere documentacion adjunta
        descripcion: Descripcion de la regla
        created_by: Usuario que crea la regla

    Returns:
        Diccionario con ID de la regla creada
    """
    validar_regla({"nombre": nombre, "rol_requerido": rol_requerido})

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        new_id = insert_returning_id(
            cursor,
            """
            INSERT INTO reglas_aprobacion (
                nombre, descripcion, monto_minimo_usd, monto_maximo_usd,
                centro, sector, criticidad, rol_requerido, nivel_aprobacion,
                requiere_justificacion, requiere_documentacion, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                nombre,
                descripcion,
                monto_minimo_usd,
                monto_maximo_usd,
                centro,
                sector,
                criticidad,
                rol_requerido,
                nivel_aprobacion,
                1 if requiere_justificacion else 0,
                1 if requiere_documentacion else 0,
                created_by,
            ),
        )

        return {"id": new_id}


def actualizar_regla(regla_id: int, **campos) -> Dict[str, Any]:
    """
    Actualiza una regla existente.

    Args:
        regla_id: ID de la regla
        **campos: Campos a actualizar

    Returns:
        Diccionario con resultado
    """
    if not campos:
        return {"actualizado": False, "razon": "No hay campos para actualizar"}

    # Construir SET clause
    set_parts = []
    values = []
    for campo, valor in campos.items():
        set_parts.append(f"{campo} = ?")
        values.append(valor)

    set_parts.append("updated_at = CURRENT_TIMESTAMP")
    values.append(regla_id)

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            f"""
            UPDATE reglas_aprobacion
            SET {", ".join(set_parts)}
            WHERE id = ?
        """,
            values,
        )

        return {"actualizado": cursor.rowcount > 0}


def desactivar_regla(regla_id: int) -> Dict[str, Any]:
    """
    Desactiva una regla (soft delete).

    Args:
        regla_id: ID de la regla

    Returns:
        Diccionario con resultado
    """
    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE reglas_aprobacion
            SET activo = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """,
            (regla_id,),
        )

        return {"desactivado": cursor.rowcount > 0}


# =============================================================================
# Funcion Legacy (Backward Compatibility)
# =============================================================================


def obtener_aprobador_por_monto(monto: float, centro: Optional[str] = None) -> str:
    """
    Funcion de compatibilidad con el codigo existente.
    Replica la logica de _aprobador_por_monto() en solicitudes.py

    Args:
        monto: Monto de la solicitud
        centro: Centro de costo

    Returns:
        ID del aprobador asignado
    """
    aprobador = buscar_aprobador(monto_usd=monto, centro=centro)

    if aprobador:
        return str(aprobador["id_spm"])

    # Fallback: buscar cualquier aprobador con rol y puesto adecuado
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id_spm FROM usuarios
            WHERE LOWER(rol) LIKE '%%aprobador_solicitudes%%'
                AND LOWER(posicion) IN ('jefe', 'gerente1', 'gerente2', 'admin', 'administrador')
                AND estado_registro = 'Activo'
            LIMIT 1
        """
        )
        row = cursor.fetchone()

    if row:
        return str(row["id_spm"])

    # Fallback final
    return "1"
