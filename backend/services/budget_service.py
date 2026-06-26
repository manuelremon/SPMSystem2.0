"""
Servicio de Presupuestos.

Logica de negocio para:
- Validacion y consumo de presupuesto al aprobar solicitudes
- Gestion de Budget Update Requests (BUR)
- Consultas de ledger
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.budget_schemas import (
    UMBRAL_L2_CENTS,
    BudgetUpdateRequest,
    EstadoBUR,
    LedgerEntry,
    NivelAprobacion,
    PresupuestoInfo,
    TransactionContext,
    ValidacionPresupuesto,
    determinar_nivel_aprobacion,
)
from backend.core.budget_transaction import AtomicBudgetTransaction
from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.helpers import resolve_sector_name as _resolve_sector_name_helper


class _ConnectionWrapper:
    """Wrapper para conexión que permite usar como context manager o con close()"""
    def __init__(self, ctx):
        self._ctx = ctx
        self._conn = None

    def __enter__(self):
        self._conn = self._ctx.__enter__()
        return self

    def __exit__(self, *args):
        return self._ctx.__exit__(*args)

    def cursor(self):
        return self._conn.cursor()

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        try:
            self._ctx.__exit__(None, None, None)
        except Exception:
            pass


def _connect():
    """
    SPRINT 2.1: Conexion a BD usando get_db_connection.
    Soporta tanto PostgreSQL como SQLite.

    Retorna un wrapper que puede usarse como context manager o con .close()
    """
    wrapper = _ConnectionWrapper(get_db_connection())
    wrapper.__enter__()
    return wrapper


def _row_to_dict(row, cursor):
    """Convierte fila a dict para compatibilidad SQLite/PostgreSQL"""
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    # PostgreSQL tuple
    if hasattr(cursor, "description") and cursor.description:
        columns = [desc[0] for desc in cursor.description]
        return dict(zip(columns, row))
    # SQLite Row
    return dict(row)


def _execute(cursor, sql, params=None):
    """Ejecuta query convirtiendo placeholders ? a %s solo para PostgreSQL"""
    if is_using_postgresql():
        sql = sql.replace("?", "%s")
    return cursor.execute(sql, params)


def _fetchone(cursor):
    """Obtiene una fila y la convierte a dict si es necesario"""
    row = cursor.fetchone()
    if row is None:
        return None
    # PostgreSQL wrapper ya retorna dicts, SQLite retorna Row
    if isinstance(row, dict):
        return row
    return dict(row) if hasattr(row, "keys") else row


def _fetchall(cursor):
    """Obtiene todas las filas y las convierte a dicts si es necesario"""
    rows = cursor.fetchall()
    if not rows:
        return rows
    # PostgreSQL wrapper ya retorna dicts
    if isinstance(rows[0], dict):
        return rows
    # SQLite Rows
    return [dict(row) if hasattr(row, "keys") else row for row in rows]


def _resolve_sector_name(sector_value: str) -> str:
    """
    SPRINT 2.2: Wrapper que delega al helper centralizado.
    Resuelve el nombre del sector dado un ID o nombre.
    """
    return _resolve_sector_name_helper(sector_value)


# ============================================================================
# Consultas de Presupuesto
# ============================================================================


class PresupuestoService:
    """Servicio para operaciones de presupuesto"""

    @staticmethod
    def get_info(centro: str, sector: str) -> Optional[PresupuestoInfo]:
        """Obtiene informacion completa de presupuesto"""
        # Normalizar sector ID a nombre para consistencia
        sector_normalizado = _resolve_sector_name(sector)
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                """SELECT centro, sector, monto_cents, saldo_cents, version
                   FROM presupuesto WHERE centro = ? AND sector = ?""",
                (centro, sector_normalizado),
            )
            row = _fetchone(cur)
            if row:
                return PresupuestoInfo(
                    centro=row["centro"],
                    sector=row["sector"],
                    monto_cents=row["monto_cents"] or 0,
                    saldo_cents=row["saldo_cents"] or 0,
                    version=row["version"] or 1,
                )
            return None
        finally:
            conn.close()

    @staticmethod
    def validar_saldo(
        centro: str, sector: str, monto_requerido_cents: int
    ) -> ValidacionPresupuesto:
        """Valida si hay saldo suficiente"""
        info = PresupuestoService.get_info(centro, sector)
        if not info:
            return ValidacionPresupuesto(
                tiene_saldo=False,
                saldo_disponible_cents=0,
                monto_requerido_cents=monto_requerido_cents,
                deficit_cents=monto_requerido_cents,
                mensaje=f"No existe presupuesto para centro={centro}, sector={sector}",
            )

        tiene_saldo = info.saldo_cents >= monto_requerido_cents
        deficit = max(0, monto_requerido_cents - info.saldo_cents)

        return ValidacionPresupuesto(
            tiene_saldo=tiene_saldo,
            saldo_disponible_cents=info.saldo_cents,
            monto_requerido_cents=monto_requerido_cents,
            deficit_cents=deficit,
            mensaje="" if tiene_saldo else f"Saldo insuficiente. Deficit: ${deficit / 100:.2f}",
        )

    @staticmethod
    def get_ledger(
        centro: Optional[str] = None, sector: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> List[LedgerEntry]:
        """Obtiene historial de movimientos"""
        # Normalizar sector ID a nombre para consistencia
        sector_normalizado = _resolve_sector_name(sector) if sector else None
        conn = _connect()
        try:
            cur = conn.cursor()
            where = []
            params = []

            if centro:
                where.append("centro = ?")
                params.append(centro)
            if sector_normalizado:
                where.append("sector = ?")
                params.append(sector_normalizado)

            where_sql = f"WHERE {' AND '.join(where)}" if where else ""
            params.extend([limit, offset])

            _execute(
                cur,
                f"""SELECT * FROM presupuesto_ledger
                    {where_sql}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?""",
                params,
            )
            rows = cur.fetchall()
            if not rows:
                return []
            # Convertir filas a dicts si es necesario
            result = []
            for row in rows:
                if isinstance(row, dict):
                    row_dict = row
                elif hasattr(row, "_asdict"):
                    # Named tuple de psycopg2
                    row_dict = row._asdict()
                elif hasattr(row, "keys"):
                    row_dict = dict(row)
                else:
                    # Tupla simple - usar description para columnas
                    cols = [d[0] for d in cur.description] if cur.description else []
                    row_dict = dict(zip(cols, row))
                result.append(LedgerEntry.from_row(row_dict))
            return result
        finally:
            conn.close()


# ============================================================================
# Budget Update Requests
# ============================================================================


class BURService:
    """Servicio para Budget Update Requests"""

    # Roles que pueden crear BUR
    ROLES_CREAR = {"jefe", "admin", "administrador", "coordinador", "aprobador presupuestos", "aprobador_presupuestos", "aprobador de presupuesto"}

    # Roles por nivel de aprobacion
    ROLES_APROBAR = {
        "L1": {"gerente", "gerente1", "jefe", "coordinador", "admin", "administrador"},
        "L2": {"gerente", "gerente2", "director", "admin", "administrador"},
        "ADMIN": {"admin", "administrador", "superadmin"},
    }

    @staticmethod
    def puede_crear_bur(user_roles: List[str], monto_cents: int) -> tuple[bool, str]:
        """Verifica si usuario puede crear BUR para el monto dado"""
        roles_lower = {r.lower() for r in user_roles}

        # Para montos > 1M, solo admin puede crear
        if monto_cents > UMBRAL_L2_CENTS:
            if not roles_lower & {"admin", "administrador", "superadmin"}:
                return (
                    False,
                    "Montos > $1,000,000 USD solo pueden ser solicitados por administrador",
                )

        # Para otros montos, jefe o admin
        if roles_lower & BURService.ROLES_CREAR:
            return True, ""

        return False, "Solo jefe o administrador pueden solicitar ampliacion de presupuesto"

    @staticmethod
    def puede_aprobar_bur(user_roles: List[str], nivel_requerido: str) -> bool:
        """Verifica si usuario puede aprobar BUR al nivel dado"""
        roles_lower = {r.lower() for r in user_roles}
        roles_permitidos = BURService.ROLES_APROBAR.get(nivel_requerido, set())
        return bool(roles_lower & roles_permitidos)

    @staticmethod
    def crear(
        centro: str,
        sector: str,
        monto_solicitado_cents: int,
        justificacion: str,
        solicitante_id: str,
        solicitante_rol: str,
    ) -> Dict[str, Any]:
        """Crea nueva solicitud de aumento de presupuesto"""
        # Normalizar sector ID a nombre para consistencia
        sector_normalizado = _resolve_sector_name(sector)
        # Obtener saldo actual
        info = PresupuestoService.get_info(centro, sector_normalizado)
        saldo_actual_cents = info.saldo_cents if info else 0

        # Determinar nivel de aprobacion
        nivel = determinar_nivel_aprobacion(monto_solicitado_cents)

        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                """INSERT INTO budget_update_requests
                   (centro, sector, monto_solicitado_cents, saldo_actual_cents,
                    nivel_aprobacion_requerido, solicitante_id, solicitante_rol, justificacion)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   RETURNING id""",
                (
                    centro,
                    sector_normalizado,
                    monto_solicitado_cents,
                    saldo_actual_cents,
                    nivel.value,
                    solicitante_id,
                    solicitante_rol,
                    justificacion,
                ),
            )
            row = cur.fetchone()
            bur_id = row["id"] if isinstance(row, dict) else row[0]
            conn.commit()

            _execute(cur, "SELECT * FROM budget_update_requests WHERE id = ?", (bur_id,))
            row = _fetchone(cur)
            return {"ok": True, "bur": BudgetUpdateRequest.from_row(dict(row)).to_dict()}
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"BURService.crear error: {type(e).__name__}: {e}")
            import traceback
            logging.getLogger(__name__).error(f"BURService.crear traceback: {traceback.format_exc()}")
            return {"ok": False, "error": f"{type(e).__name__}: {str(e)}"}
        finally:
            conn.close()

    @staticmethod
    def get_by_id(bur_id: int) -> Optional[BudgetUpdateRequest]:
        """Obtiene BUR por ID"""
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(cur, "SELECT * FROM budget_update_requests WHERE id = ?", (bur_id,))
            row = _fetchone(cur)
            return BudgetUpdateRequest.from_row(dict(row)) if row else None
        finally:
            conn.close()

    @staticmethod
    def listar(
        estado: Optional[str] = None,
        centro: Optional[str] = None,
        sector: Optional[str] = None,
        solicitante_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[BudgetUpdateRequest]:
        """Lista BURs con filtros"""
        # Normalizar sector ID a nombre para consistencia
        sector_normalizado = _resolve_sector_name(sector) if sector else None
        conn = _connect()
        try:
            cur = conn.cursor()
            where = []
            params = []

            if estado:
                where.append("estado = ?")
                params.append(estado)
            if centro:
                where.append("centro = ?")
                params.append(centro)
            if sector_normalizado:
                where.append("sector = ?")
                params.append(sector_normalizado)
            if solicitante_id:
                where.append("solicitante_id = ?")
                params.append(solicitante_id)

            where_sql = f"WHERE {' AND '.join(where)}" if where else ""
            params.extend([limit, offset])

            _execute(
                cur,
                f"""SELECT * FROM budget_update_requests
                    {where_sql}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?""",
                params,
            )
            return [BudgetUpdateRequest.from_row(dict(row)) for row in _fetchall(cur)]
        finally:
            conn.close()

    @staticmethod
    def aprobar(
        bur_id: int, aprobador_id: str, aprobador_rol: str, comentario: Optional[str] = None
    ) -> Dict[str, Any]:
        """Procesa aprobacion de BUR"""
        bur = BURService.get_by_id(bur_id)
        if not bur:
            return {"ok": False, "error": "BUR no encontrado", "code": "not_found"}

        nivel_req = bur.nivel_aprobacion_requerido
        estado_actual = bur.estado
        now = datetime.utcnow().isoformat() + "Z"

        # Determinar nuevo estado segun nivel y estado actual
        nuevo_estado = None
        campo_aprobador = None
        campo_fecha = None
        campo_comentario = None

        if estado_actual == EstadoBUR.PENDIENTE.value:
            if nivel_req == NivelAprobacion.L1.value:
                # L1 solo requiere 1 aprobacion
                nuevo_estado = EstadoBUR.APROBADO.value
                campo_aprobador = "aprobador_l1_id"
                campo_fecha = "aprobador_l1_fecha"
                campo_comentario = "aprobador_l1_comentario"
            else:
                # L2 y ADMIN requieren aprobacion escalonada
                nuevo_estado = EstadoBUR.APROBADO_L1.value
                campo_aprobador = "aprobador_l1_id"
                campo_fecha = "aprobador_l1_fecha"
                campo_comentario = "aprobador_l1_comentario"

        elif estado_actual == EstadoBUR.APROBADO_L1.value:
            if nivel_req == NivelAprobacion.L2.value:
                nuevo_estado = EstadoBUR.APROBADO.value
                campo_aprobador = "aprobador_l2_id"
                campo_fecha = "aprobador_l2_fecha"
                campo_comentario = "aprobador_l2_comentario"
            else:  # ADMIN
                nuevo_estado = EstadoBUR.APROBADO_L2.value
                campo_aprobador = "aprobador_l2_id"
                campo_fecha = "aprobador_l2_fecha"
                campo_comentario = "aprobador_l2_comentario"

        elif estado_actual == EstadoBUR.APROBADO_L2.value:
            if nivel_req == NivelAprobacion.ADMIN.value:
                nuevo_estado = EstadoBUR.APROBADO.value
                campo_aprobador = "aprobador_final_id"
                campo_fecha = "aprobador_final_fecha"
                campo_comentario = "aprobador_final_comentario"

        if not nuevo_estado:
            return {
                "ok": False,
                "error": f"Estado invalido para aprobar: {estado_actual}",
                "code": "invalid_state",
            }

        conn = _connect()
        try:
            cur = conn.cursor()

            # Actualizar BUR
            _execute(
                cur,
                f"""UPDATE budget_update_requests
                    SET estado = ?, {campo_aprobador} = ?, {campo_fecha} = ?,
                        {campo_comentario} = ?, updated_at = ?
                    WHERE id = ?""",
                (nuevo_estado, aprobador_id, now, comentario, now, bur_id),
            )
            conn.commit()

            # Si se aprobo completamente, aplicar al presupuesto
            if nuevo_estado == EstadoBUR.APROBADO.value:
                ctx = TransactionContext(
                    trace_id=str(uuid.uuid4()), actor_id=aprobador_id, actor_rol=aprobador_rol
                )
                try:
                    with AtomicBudgetTransaction() as txn:
                        result = txn.aplicar_bur(
                            centro=bur.centro,
                            sector=bur.sector,
                            monto_cents=bur.monto_solicitado_cents,
                            bur_id=bur_id,
                            ctx=ctx,
                        )
                        if not result.success:
                            # Revertir estado del BUR ya que no se pudo aplicar al presupuesto
                            _execute(
                                cur,
                                "UPDATE budget_update_requests SET estado = ?, updated_at = ? WHERE id = ?",
                                (estado_actual, now, bur_id),
                            )
                            conn.commit()
                            return {
                                "ok": False,
                                "error": result.error_message,
                                "code": result.error_code,
                            }
                except Exception as e:
                    # Revertir estado del BUR en caso de error inesperado
                    _execute(
                        cur,
                        "UPDATE budget_update_requests SET estado = ?, updated_at = ? WHERE id = ?",
                        (estado_actual, now, bur_id),
                    )
                    conn.commit()
                    return {"ok": False, "error": f"Error al aplicar presupuesto: {e}", "code": "budget_apply_error"}

            return {
                "ok": True,
                "estado": nuevo_estado,
                "message": (
                    "BUR aprobado"
                    if nuevo_estado == EstadoBUR.APROBADO.value
                    else f"Aprobacion {estado_actual} -> {nuevo_estado}"
                ),
            }

        except Exception as e:
            return {"ok": False, "error": str(e), "code": "db_error"}
        finally:
            conn.close()

    @staticmethod
    def rechazar(bur_id: int, rechazado_por: str, motivo: str) -> Dict[str, Any]:
        """Rechaza BUR"""
        bur = BURService.get_by_id(bur_id)
        if not bur:
            return {"ok": False, "error": "BUR no encontrado", "code": "not_found"}

        if bur.estado == EstadoBUR.APROBADO.value:
            return {
                "ok": False,
                "error": "No se puede rechazar un BUR ya aprobado",
                "code": "already_approved",
            }

        if bur.estado == EstadoBUR.RECHAZADO.value:
            return {"ok": False, "error": "BUR ya esta rechazado", "code": "already_rejected"}

        now = datetime.utcnow().isoformat() + "Z"

        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                """UPDATE budget_update_requests
                   SET estado = ?, rechazado_por = ?, motivo_rechazo = ?,
                       fecha_rechazo = ?, updated_at = ?
                   WHERE id = ?""",
                (EstadoBUR.RECHAZADO.value, rechazado_por, motivo, now, now, bur_id),
            )
            conn.commit()
            return {"ok": True, "message": "BUR rechazado"}
        except Exception as e:
            return {"ok": False, "error": str(e), "code": "db_error"}
        finally:
            conn.close()

    @staticmethod
    def revertir(bur_id: int, revertido_por: str, motivo: str) -> Dict[str, Any]:
        """
        SPRINT 2.3: Revierte un BUR aprobado (solo admin).
        Resta el monto del presupuesto y marca el BUR como revertido.

        Args:
            bur_id: ID del BUR a revertir
            revertido_por: ID del usuario que revierte (debe ser admin)
            motivo: Razón de la reversión

        Returns:
            Dict con resultado de la operación
        """
        from backend.core.budget_schemas import TipoMovimiento

        bur = BURService.get_by_id(bur_id)
        if not bur:
            return {"ok": False, "error": "BUR no encontrado", "code": "not_found"}

        if bur.estado != EstadoBUR.APROBADO.value:
            return {
                "ok": False,
                "error": f"Solo se pueden revertir BURs aprobados. Estado actual: {bur.estado}",
                "code": "invalid_state",
            }

        now = datetime.utcnow().isoformat() + "Z"

        # Obtener info actual del presupuesto
        info = PresupuestoService.get_info(bur.centro, bur.sector)
        if not info:
            return {
                "ok": False,
                "error": f"No existe presupuesto para {bur.centro}/{bur.sector}",
                "code": "presupuesto_not_found",
            }

        # Verificar que hay suficiente saldo para revertir
        if info.saldo_cents < bur.monto_solicitado_cents:
            return {
                "ok": False,
                "error": f"Saldo insuficiente para revertir: disponible={info.saldo_cents/100:.2f}, "
                         f"a revertir={bur.monto_solicitado_cents/100:.2f}",
                "code": "saldo_insuficiente",
            }

        conn = _connect()
        try:
            cur = conn.cursor()

            # Restar del presupuesto
            nuevo_saldo = info.saldo_cents - bur.monto_solicitado_cents
            _execute(
                cur,
                """UPDATE presupuesto
                   SET saldo_cents = ?, saldo_usd = ?, version = version + 1, updated_by = ?
                   WHERE centro = ? AND sector = ?""",
                (nuevo_saldo, nuevo_saldo / 100, revertido_por, bur.centro, bur.sector),
            )

            # Registrar en ledger
            _execute(
                cur,
                """INSERT INTO presupuesto_ledger
                   (idempotency_key, centro, sector, tipo_movimiento, monto_cents,
                    saldo_anterior_cents, saldo_posterior_cents, referencia_tipo, referencia_id,
                    actor_id, actor_rol, motivo)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"bur_reversion_{bur_id}_{now}",
                    bur.centro,
                    bur.sector,
                    TipoMovimiento.BUR_REVERTIDO.value,
                    -bur.monto_solicitado_cents,  # Negativo porque es débito
                    info.saldo_cents,
                    nuevo_saldo,
                    "bur",
                    bur_id,
                    revertido_por,
                    "admin",
                    motivo,
                ),
            )

            # Actualizar estado del BUR
            _execute(
                cur,
                """UPDATE budget_update_requests
                   SET estado = ?, rechazado_por = ?, motivo_rechazo = ?,
                       fecha_rechazo = ?, updated_at = ?
                   WHERE id = ?""",
                ("revertido", revertido_por, f"[REVERTIDO] {motivo}", now, now, bur_id),
            )

            conn.commit()

            return {
                "ok": True,
                "message": f"BUR #{bur_id} revertido. ${bur.monto_solicitado_cents/100:.2f} restados del presupuesto.",
                "nuevo_saldo_cents": nuevo_saldo,
                "monto_revertido_cents": bur.monto_solicitado_cents,
            }

        except Exception as e:
            return {"ok": False, "error": str(e), "code": "db_error"}
        finally:
            conn.close()


# ============================================================================
# Funcion helper para aprobar solicitud con presupuesto
# ============================================================================


def verificar_umbrales_presupuesto() -> Dict[str, Any]:
    """
    Verifica todos los presupuestos y genera alertas cuando el saldo
    está por debajo de umbrales críticos (20%, 10%, agotado).

    Se ejecuta periódicamente via ScheduledJobRunner.

    Returns:
        Dict con presupuestos revisados y alertas generadas
    """
    import logging
    logger = logging.getLogger(__name__)

    alertas_generadas = 0
    presupuestos_revisados = 0

    try:
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(cur, """
                SELECT centro, sector, monto_cents, saldo_cents
                FROM presupuesto
                WHERE monto_cents > 0
            """)
            presupuestos = _fetchall(cur)
        finally:
            conn.close()

        if not presupuestos:
            return {"presupuestos_revisados": 0, "alertas_generadas": 0}

        for p in presupuestos:
            presupuestos_revisados += 1
            centro = p["centro"]
            sector = p["sector"]
            monto = p["monto_cents"] or 0
            saldo = p["saldo_cents"] or 0

            if monto <= 0:
                continue

            porcentaje_restante = (saldo / monto) * 100

            tipo_alerta = None

            if saldo <= 0:
                tipo_alerta = "presupuesto_agotado"
                mensaje = f"Presupuesto AGOTADO para {centro}/{sector}. Saldo: $0"
            elif porcentaje_restante <= 10:
                tipo_alerta = "presupuesto_critico"
                mensaje = (
                    f"Presupuesto CRITICO para {centro}/{sector}: "
                    f"solo queda {porcentaje_restante:.1f}% (${saldo/100:,.2f})"
                )
            elif porcentaje_restante <= 20:
                tipo_alerta = "presupuesto_bajo"
                mensaje = (
                    f"Presupuesto BAJO para {centro}/{sector}: "
                    f"queda {porcentaje_restante:.1f}% (${saldo/100:,.2f})"
                )

            if tipo_alerta:
                try:
                    from backend.services.notification_service import NotificationService

                    # Notificar a admins y coordinadores
                    conn2 = _connect()
                    try:
                        cur2 = conn2.cursor()
                        # Schema real: usuarios con rol como texto (CSV/JSON) y
                        # estado_registro. No existen tablas usuario_rol/rol.
                        _execute(cur2, """
                            SELECT DISTINCT id_spm FROM usuario
                            WHERE (LOWER(rol) LIKE '%admin%' OR LOWER(rol) LIKE '%coordinador%'
                                   OR LOWER(rol) LIKE '%jefe%')
                            AND estado_registro = 'Activo'
                        """)
                        admins = _fetchall(cur2)
                    finally:
                        conn2.close()

                    for admin in admins:
                        admin_id = admin["id_spm"] if isinstance(admin, dict) else admin[0]
                        NotificationService.create_notification(
                            destinatario_id=str(admin_id),
                            mensaje=mensaje,
                            tipo="budget_alert",
                        )
                    alertas_generadas += 1
                except Exception as e:
                    logger.warning(f"Error notificando alerta presupuesto {centro}/{sector}: {e}")

        logger.info(
            f"[BUDGET] Revisión umbrales: {presupuestos_revisados} presupuestos, "
            f"{alertas_generadas} alertas"
        )
    except Exception as e:
        logger.error(f"[BUDGET] Error verificando umbrales: {e}")

    return {
        "presupuestos_revisados": presupuestos_revisados,
        "alertas_generadas": alertas_generadas,
    }


def aprobar_solicitud_con_presupuesto(
    solicitud_id: int,
    solicitud: Dict[str, Any],
    aprobador_id: str,
    aprobador_rol: str,
    actor_ip: str = "",
) -> Dict[str, Any]:
    """
    Valida y consume presupuesto al aprobar una solicitud.

    Args:
        solicitud_id: ID de la solicitud
        solicitud: Diccionario con datos de solicitud (centro, sector, total_monto)
        aprobador_id: ID del usuario aprobador
        aprobador_rol: Rol del aprobador
        actor_ip: IP del cliente (opcional)

    Returns:
        Dict con ok, error_code, error_message, o budget_result si exitoso
    """
    centro = solicitud.get("centro", "")
    sector_raw = solicitud.get("sector", "")
    # Resolver sector ID a nombre si es necesario
    sector = _resolve_sector_name(sector_raw)
    total_usd = float(solicitud.get("total_monto") or 0)
    total_cents = int(round(total_usd * 100))

    if total_cents <= 0:
        return {
            "ok": False,
            "error_code": "invalid_amount",
            "error_message": "Solicitud sin monto valido",
        }

    # Crear contexto de transaccion
    ctx = TransactionContext(
        trace_id=str(uuid.uuid4()),
        actor_id=aprobador_id,
        actor_rol=aprobador_rol,
        actor_ip=actor_ip,
    )

    # Consumir presupuesto atomicamente
    try:
        with AtomicBudgetTransaction() as txn:
            result = txn.consumir_presupuesto(
                centro=centro,
                sector=sector,
                monto_cents=total_cents,
                solicitud_id=solicitud_id,
                ctx=ctx,
                idempotency_key=f"approval_{solicitud_id}",
            )

            if not result.success:
                return {
                    "ok": False,
                    "error_code": result.error_code,
                    "error_message": result.error_message,
                    "saldo_disponible_usd": (
                        result.saldo_anterior_cents / 100 if result.saldo_anterior_cents else 0
                    ),
                    "monto_requerido_usd": total_usd,
                }

            return {"ok": True, "budget_result": result.to_dict(), "trace_id": ctx.trace_id}

    except Exception as e:
        return {"ok": False, "error_code": "transaction_failed", "error_message": str(e)}
