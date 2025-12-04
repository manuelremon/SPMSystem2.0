"""
Servicio de Presupuestos.

Logica de negocio para:
- Validacion y consumo de presupuesto al aprobar solicitudes
- Gestion de Budget Update Requests (BUR)
- Consultas de ledger
"""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from backend_v2.core.budget_schemas import (UMBRAL_L1_CENTS,
                                                UMBRAL_L2_CENTS,
                                                BudgetOperationResult,
                                                BudgetUpdateRequest, EstadoBUR,
                                                LedgerEntry, NivelAprobacion,
                                                PresupuestoInfo,
                                                TransactionContext,
                                                ValidacionPresupuesto,
                                                determinar_nivel_aprobacion)
    from backend_v2.core.budget_transaction import AtomicBudgetTransaction
    from backend_v2.core.config import settings
    from backend_v2.core.roles import is_admin, normalize_roles
except ImportError:
    from core.budget_schemas import (UMBRAL_L2_CENTS, BudgetUpdateRequest,
                                     EstadoBUR, LedgerEntry, NivelAprobacion,
                                     PresupuestoInfo, TransactionContext,
                                     ValidacionPresupuesto,
                                     determinar_nivel_aprobacion)
    from core.budget_transaction import AtomicBudgetTransaction
    from core.config import settings


def _db_path() -> Path:
    """Obtiene ruta a base de datos"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect() -> sqlite3.Connection:
    """Crea conexion a BD"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _resolve_sector_name(sector_value: str) -> str:
    """
    Resuelve el nombre del sector dado un ID o nombre.
    Si es numerico, busca en catalog_sectores.
    Si no encuentra, devuelve el valor original.
    """
    if not sector_value:
        return sector_value

    # Si es numerico, intentar buscar por ID
    if str(sector_value).isdigit():
        conn = _connect()
        cur = conn.cursor()
        cur.execute("SELECT nombre FROM catalog_sectores WHERE id = ?", (int(sector_value),))
        row = cur.fetchone()
        conn.close()
        if row:
            return row[0]

    return sector_value


# ============================================================================
# Consultas de Presupuesto
# ============================================================================


class PresupuestoService:
    """Servicio para operaciones de presupuesto"""

    @staticmethod
    def get_info(centro: str, sector: str) -> Optional[PresupuestoInfo]:
        """Obtiene informacion completa de presupuesto"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """SELECT centro, sector, monto_cents, saldo_cents, version
                   FROM presupuestos WHERE centro = ? AND sector = ?""",
                (centro, sector),
            )
            row = cur.fetchone()
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
        conn = _connect()
        try:
            cur = conn.cursor()
            where = []
            params = []

            if centro:
                where.append("centro = ?")
                params.append(centro)
            if sector:
                where.append("sector = ?")
                params.append(sector)

            where_sql = f"WHERE {' AND '.join(where)}" if where else ""
            params.extend([limit, offset])

            cur.execute(
                f"""SELECT * FROM presupuesto_ledger
                    {where_sql}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?""",
                params,
            )
            return [LedgerEntry.from_row(dict(row)) for row in cur.fetchall()]
        finally:
            conn.close()


# ============================================================================
# Budget Update Requests
# ============================================================================


class BURService:
    """Servicio para Budget Update Requests"""

    # Roles que pueden crear BUR
    ROLES_CREAR = {"jefe", "admin", "administrador"}

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
        # Obtener saldo actual
        info = PresupuestoService.get_info(centro, sector)
        saldo_actual_cents = info.saldo_cents if info else 0

        # Determinar nivel de aprobacion
        nivel = determinar_nivel_aprobacion(monto_solicitado_cents)

        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO budget_update_requests
                   (centro, sector, monto_solicitado_cents, saldo_actual_cents,
                    nivel_aprobacion_requerido, solicitante_id, solicitante_rol, justificacion)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    centro,
                    sector,
                    monto_solicitado_cents,
                    saldo_actual_cents,
                    nivel.value,
                    solicitante_id,
                    solicitante_rol,
                    justificacion,
                ),
            )
            conn.commit()
            bur_id = cur.lastrowid

            cur.execute("SELECT * FROM budget_update_requests WHERE id = ?", (bur_id,))
            row = cur.fetchone()
            return {"ok": True, "bur": BudgetUpdateRequest.from_row(dict(row)).to_dict()}
        except Exception as e:
            return {"ok": False, "error": str(e)}
        finally:
            conn.close()

    @staticmethod
    def get_by_id(bur_id: int) -> Optional[BudgetUpdateRequest]:
        """Obtiene BUR por ID"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM budget_update_requests WHERE id = ?", (bur_id,))
            row = cur.fetchone()
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
            if sector:
                where.append("sector = ?")
                params.append(sector)
            if solicitante_id:
                where.append("solicitante_id = ?")
                params.append(solicitante_id)

            where_sql = f"WHERE {' AND '.join(where)}" if where else ""
            params.extend([limit, offset])

            cur.execute(
                f"""SELECT * FROM budget_update_requests
                    {where_sql}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?""",
                params,
            )
            return [BudgetUpdateRequest.from_row(dict(row)) for row in cur.fetchall()]
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
            cur.execute(
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
                with AtomicBudgetTransaction() as txn:
                    result = txn.aplicar_bur(
                        centro=bur.centro,
                        sector=bur.sector,
                        monto_cents=bur.monto_solicitado_cents,
                        bur_id=bur_id,
                        ctx=ctx,
                    )
                    if not result.success:
                        return {
                            "ok": False,
                            "error": result.error_message,
                            "code": result.error_code,
                        }

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
            cur.execute(
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


# ============================================================================
# Funcion helper para aprobar solicitud con presupuesto
# ============================================================================


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
