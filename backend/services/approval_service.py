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
    from backend.core.db import get_db_connection, get_db_transaction
except ImportError:
    from core.db import get_db_connection, get_db_transaction


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
    'usuario': 0,
    'aprobador': 1,
    'coordinador': 2,
    'jefe': 3,
    'gerente': 4,
    'admin': 5,
}


def rol_tiene_nivel(rol_usuario: str, rol_requerido: str) -> bool:
    """
    Verifica si un rol tiene nivel suficiente para otro.

    Args:
        rol_usuario: Rol del usuario
        rol_requerido: Rol requerido para la accion

    Returns:
        True si rol_usuario >= rol_requerido en jerarquia
    """
    nivel_usuario = JERARQUIA_ROLES.get(rol_usuario.lower(), 0)
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
    if not regla.get('nombre'):
        raise ApprovalValidationError("El nombre de la regla es requerido")

    if not regla.get('rol_requerido'):
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
        inicio = datetime.fromisoformat(fecha_inicio.replace('Z', '+00:00'))
        fin = datetime.fromisoformat(fecha_fin.replace('Z', '+00:00'))

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
    criticidad: Optional[str] = None
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
            cursor.execute("""
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND criticidad = ?
                    AND (monto_minimo_usd <= ? OR monto_minimo_usd IS NULL)
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                ORDER BY nivel_aprobacion DESC
                LIMIT 1
            """, (criticidad, monto_usd, monto_usd))
            row = cursor.fetchone()
            if row:
                return dict(row)

        # Buscar regla por centro
        if centro:
            cursor.execute("""
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                    AND centro = ?
                    AND (monto_minimo_usd <= ? OR monto_minimo_usd IS NULL)
                    AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
                ORDER BY nivel_aprobacion DESC
                LIMIT 1
            """, (centro, monto_usd, monto_usd))
            row = cursor.fetchone()
            if row:
                return dict(row)

        # Buscar regla general por monto
        cursor.execute("""
            SELECT * FROM reglas_aprobacion
            WHERE activo = 1
                AND centro IS NULL
                AND sector IS NULL
                AND criticidad IS NULL
                AND monto_minimo_usd <= ?
                AND (monto_maximo_usd >= ? OR monto_maximo_usd IS NULL)
            ORDER BY monto_minimo_usd DESC
            LIMIT 1
        """, (monto_usd, monto_usd))

        row = cursor.fetchone()
        return dict(row) if row else None


def puede_aprobar(
    usuario_id: str,
    monto_usd: float,
    centro: Optional[str] = None,
    sector: Optional[str] = None,
    criticidad: Optional[str] = None,
    verificar_delegacion: bool = False
) -> Dict[str, Any]:
    """
    Verifica si un usuario puede aprobar una solicitud.

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
            "rol_usuario": str,
            "rol_requerido": str,
            "nivel_aprobacion": int,
            "razon": str (si no puede)
        }
    """
    validar_monto(monto_usd)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener rol del usuario
        cursor.execute(
            "SELECT rol FROM usuarios WHERE id_spm = ?",
            (usuario_id,)
        )
        user_row = cursor.fetchone()
        if not user_row:
            return {
                "puede_aprobar": False,
                "razon": "Usuario no encontrado"
            }

        rol_usuario = (user_row['rol'] or '').lower()

        # Admin siempre puede aprobar
        if 'admin' in rol_usuario:
            return {
                "puede_aprobar": True,
                "rol_usuario": rol_usuario,
                "rol_requerido": "cualquiera",
                "nivel_aprobacion": 0,
                "es_admin": True
            }

    # Obtener regla aplicable
    regla = obtener_regla_aprobacion(monto_usd, centro, sector, criticidad)

    if not regla:
        return {
            "puede_aprobar": False,
            "rol_usuario": rol_usuario,
            "razon": "No hay regla de aprobacion definida para este monto"
        }

    rol_requerido = regla['rol_requerido']

    # Verificar jerarquia de roles
    if rol_tiene_nivel(rol_usuario, rol_requerido):
        return {
            "puede_aprobar": True,
            "rol_usuario": rol_usuario,
            "rol_requerido": rol_requerido,
            "nivel_aprobacion": regla['nivel_aprobacion']
        }

    # Verificar delegacion activa si se solicito
    if verificar_delegacion:
        delegacion = obtener_delegacion_activa(usuario_id)
        if delegacion:
            # TODO: Implementar logica de delegacion
            pass

    return {
        "puede_aprobar": False,
        "rol_usuario": rol_usuario,
        "rol_requerido": rol_requerido,
        "nivel_aprobacion": regla['nivel_aprobacion'],
        "razon": f"Se requiere rol '{rol_requerido}' o superior"
    }


def buscar_aprobador(
    monto_usd: float,
    centro: Optional[str] = None,
    sector: Optional[str] = None,
    criticidad: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Busca un aprobador disponible para el monto dado.

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

    rol_requerido = regla['rol_requerido']

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Buscar aprobador priorizando mismo centro
        if centro:
            cursor.execute("""
                SELECT id_spm, nombre, apellido, rol, centro
                FROM usuarios
                WHERE LOWER(rol) LIKE ?
                    AND centro = ?
                    AND activo = 1
                ORDER BY
                    CASE WHEN centro = ? THEN 0 ELSE 1 END,
                    nombre
                LIMIT 1
            """, (f'%{rol_requerido}%', centro, centro))
        else:
            cursor.execute("""
                SELECT id_spm, nombre, apellido, rol, centro
                FROM usuarios
                WHERE LOWER(rol) LIKE ?
                    AND activo = 1
                ORDER BY nombre
                LIMIT 1
            """, (f'%{rol_requerido}%',))

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
    created_by: Optional[str] = None
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

        cursor.execute("""
            INSERT INTO aprobadores_delegados
                (aprobador_original_id, delegado_id, fecha_inicio, fecha_fin, motivo, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            aprobador_original_id, delegado_id,
            fecha_inicio, fecha_fin,
            motivo, created_by
        ))

        return {"id": cursor.lastrowid}


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

        now = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        cursor.execute("""
            SELECT * FROM aprobadores_delegados
            WHERE aprobador_original_id = ?
                AND activo = 1
                AND fecha_inicio <= ?
                AND fecha_fin >= ?
            ORDER BY fecha_fin DESC
            LIMIT 1
        """, (aprobador_id, now, now))

        row = cursor.fetchone()
        return dict(row) if row else None


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
            cursor.execute("""
                SELECT * FROM reglas_aprobacion
                WHERE activo = 1
                ORDER BY nivel_aprobacion, monto_minimo_usd
            """)
        else:
            cursor.execute("""
                SELECT * FROM reglas_aprobacion
                ORDER BY nivel_aprobacion, monto_minimo_usd
            """)

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
    created_by: Optional[str] = None
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
    validar_regla({'nombre': nombre, 'rol_requerido': rol_requerido})

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO reglas_aprobacion (
                nombre, descripcion, monto_minimo_usd, monto_maximo_usd,
                centro, sector, criticidad, rol_requerido, nivel_aprobacion,
                requiere_justificacion, requiere_documentacion, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            nombre, descripcion, monto_minimo_usd, monto_maximo_usd,
            centro, sector, criticidad, rol_requerido, nivel_aprobacion,
            1 if requiere_justificacion else 0,
            1 if requiere_documentacion else 0,
            created_by
        ))

        return {"id": cursor.lastrowid}


def actualizar_regla(
    regla_id: int,
    **campos
) -> Dict[str, Any]:
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

    set_parts.append("updated_at = datetime('now')")
    values.append(regla_id)

    with get_db_transaction() as conn:
        cursor = conn.cursor()

        cursor.execute(f"""
            UPDATE reglas_aprobacion
            SET {', '.join(set_parts)}
            WHERE id = ?
        """, values)

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

        cursor.execute("""
            UPDATE reglas_aprobacion
            SET activo = 0, updated_at = datetime('now')
            WHERE id = ?
        """, (regla_id,))

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
        return str(aprobador['id_spm'])

    # Fallback: buscar cualquier aprobador
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id_spm FROM usuarios
            WHERE LOWER(rol) LIKE '%aprobador%'
                OR LOWER(rol) LIKE '%jefe%'
                OR LOWER(rol) LIKE '%coordinador%'
                OR LOWER(rol) LIKE '%admin%'
            LIMIT 1
        """)
        row = cursor.fetchone()

    if row:
        return str(row['id_spm'])

    # Fallback final
    return "1"
