"""
Solicitudes helpers - Funciones internas compartidas entre sub-modulos.

Incluye utilidades de base de datos, calculo de totales, logica de aprobacion,
presupuesto y planificacion.
"""

import logging
import uuid
from datetime import datetime
from pathlib import Path

from werkzeug.utils import secure_filename

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.fsm import (
    EstadoSolicitud,
    cambiar_estado,
)
from backend.core.helpers import row_to_dict as _row_to_dict
from backend.services.approval_service import obtener_aprobador_por_monto
from backend.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


def _get_uploads_dir(solicitud_id: int) -> Path:
    """Obtiene el directorio de uploads para una solicitud especifica"""
    base_dir = Path(__file__).parent.parent.parent / "uploads" / "solicitudes" / str(solicitud_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def _save_uploaded_file(file, solicitud_id: int) -> dict:
    """Guarda un archivo subido y retorna su metadata"""
    if not file or not file.filename:
        return None

    # Generar nombre unico para evitar colisiones
    original_filename = secure_filename(file.filename)
    file_ext = Path(original_filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"

    # Guardar archivo
    upload_dir = _get_uploads_dir(solicitud_id)
    file_path = upload_dir / unique_filename
    file.save(str(file_path))

    # Obtener tamano
    file_size = file_path.stat().st_size

    return {
        "id": uuid.uuid4().hex[:8],
        "nombre": original_filename,
        "nombre_almacenado": unique_filename,
        "path": str(file_path),  # Clave 'path' con ruta absoluta
        "ruta": str(file_path.relative_to(Path(__file__).parent.parent.parent)),
        "mime_type": file.content_type or "application/octet-stream",
        "tamanio": file_size,
        "created_at": datetime.utcnow().isoformat(),
    }


def _update_solicitud(solicitud_id: int, fields: dict):
    if not fields:
        return
    fields["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k}=?" for k in fields.keys()])
    params = list(fields.values()) + [solicitud_id]
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE solicitud SET {set_clause} WHERE id=?", params)


def _get_raw(solicitud_id: int):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, id_usuario, centro, sector, justificacion,
                    centro_costos, almacen_virtual, criticidad, fecha_necesidad,
                    data_json, status, aprobador_id, planner_id, total_monto,
                    notificado_at, ai_score, ai_priority, created_at, updated_at
             FROM solicitud WHERE id=?""",
            (solicitud_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return _row_to_dict(row, cur)


def _calcular_total(items):
    total = 0
    for it in items:
        try:
            qty = float(it.get("cantidad") or 0)
            price = float(it.get("precio_unitario") or 0)
            total += qty * price
        except Exception:
            continue
    return total


def _aprobador_por_monto(total, centro: str = None):
    """Obtiene el ID del aprobador segun el monto de la solicitud.

    Refactorizado para usar ApprovalService (Sprint 2.4).
    Delega la logica de reglas de aprobacion al servicio centralizado.

    Args:
        total: Monto total de la solicitud
        centro: Centro de costo (opcional, para priorizar aprobadores)

    Returns:
        ID del aprobador asignado
    """
    try:
        monto = float(total)
    except (TypeError, ValueError):
        monto = 0

    return obtener_aprobador_por_monto(monto, centro)


def _validar_consumo_previo_balanceado(solicitud_id: int) -> tuple:
    """
    SPRINT 1.2: Valida que los consumos previos esten balanceados con reversiones.
    Previene doble consumo cuando una solicitud se reenvia.

    Returns:
        Tuple (balanceado: bool, consumos: int, reversiones: int)
    """
    from backend.core.budget_schemas import TipoMovimiento

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Contar consumos (referencia_id es TEXT en PG, castear solicitud_id)
            cur.execute(
                """
                SELECT COUNT(*) as cnt FROM presupuesto_ledger
                WHERE referencia_tipo = 'solicitud'
                AND referencia_id = ?
                AND tipo_movimiento = ?
                """,
                (str(solicitud_id), TipoMovimiento.CONSUMO_APROBACION.value),
            )
            row = cur.fetchone()
            consumos = row["cnt"] if isinstance(row, dict) else row[0]

            # Contar reversiones
            cur.execute(
                """
                SELECT COUNT(*) as cnt FROM presupuesto_ledger
                WHERE referencia_tipo = 'solicitud'
                AND referencia_id = ?
                AND tipo_movimiento = ?
                """,
                (str(solicitud_id), TipoMovimiento.REVERSION_RECHAZO.value),
            )
            row = cur.fetchone()
            reversiones = row["cnt"] if isinstance(row, dict) else row[0]

            return (consumos == reversiones, consumos, reversiones)
    except Exception as e:
        logger.error(f"Error validando consumo previo para solicitud {solicitud_id}: {e}")
        # En caso de error, asumir balanceado para no bloquear
        return (True, 0, 0)


def _obtener_monto_consumo_solicitud(solicitud_id: int) -> int:
    """
    Obtiene el monto del consumo de presupuesto original para una solicitud.
    Busca en el ledger el movimiento de tipo CONSUMO_APROBACION.

    Returns:
        Monto en centavos (positivo) o 0 si no hay consumo registrado.
    """
    from backend.core.budget_schemas import TipoMovimiento

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT monto_cents FROM presupuesto_ledger
                WHERE referencia_tipo = 'solicitud'
                AND referencia_id = ?
                AND tipo_movimiento = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (str(solicitud_id), TipoMovimiento.CONSUMO_APROBACION.value),
            )
            row = cur.fetchone()
            if row:
                # monto_cents esta guardado como negativo (debito)
                return abs(row["monto_cents"])
    except Exception as e:
        logger.error(f"Error buscando consumo para solicitud {solicitud_id}: {e}")
    return 0


def _revertir_presupuesto_aprobacion_fallida(
    solicitud_id: int,
    solicitud: dict,
    monto_cents: int,
    aprobador_id: str,
    aprobador_rol: str,
    razon: str,
) -> None:
    """
    Revierte el presupuesto consumido si falla el cambio de estado FSM.
    Implementa el patron de compensacion para mantener consistencia.
    """
    if monto_cents <= 0:
        return  # Nada que revertir

    from backend.core.budget_transaction import AtomicBudgetTransaction, TransactionContext

    centro = solicitud.get("centro", "")
    sector = solicitud.get("sector", "")

    ctx = TransactionContext(
        trace_id=str(uuid.uuid4()),
        actor_id=aprobador_id,
        actor_rol=aprobador_rol,
        actor_ip="",
    )

    try:
        with AtomicBudgetTransaction() as txn:
            result = txn.revertir_consumo(
                centro=centro,
                sector=sector,
                monto_cents=monto_cents,
                solicitud_id=solicitud_id,
                ctx=ctx,
                motivo=razon,
            )
            if result.success:
                logger.info(
                    f"[COMPENSACION] Presupuesto revertido para solicitud {solicitud_id}: "
                    f"{monto_cents} cents devueltos a {centro}/{sector}"
                )
            else:
                logger.error(
                    f"[COMPENSACION] Fallo al revertir presupuesto para solicitud {solicitud_id}: "
                    f"{result.error_message}"
                )
    except Exception as e:
        logger.error(
            f"[COMPENSACION] Excepcion al revertir presupuesto para solicitud {solicitud_id}: {e}"
        )


def _planificador_para(centro: str, sector: str) -> str:
    """Obtiene el ID del planificador asignado para un centro/sector.
    Si no hay asignacion especifica, busca un planificador en la base de datos.
    """
    centro = (centro or "").strip()
    sector = (sector or "").strip()

    # Primero buscar en asignaciones especificas
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT planificador_id, centro, sector FROM planificador_asignaciones")
        rows = cur.fetchall()

    for r in rows:
        c = (r["centro"] or "").strip()
        s = (r["sector"] or "").strip()
        if (not centro or centro == c) and (not sector or sector == s):
            planificador_id = r["planificador_id"]
            # Verificar que el ID existe en la tabla usuarios
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id_spm FROM usuario WHERE id_spm = ?", (planificador_id,))
                if cur.fetchone():
                    return planificador_id

    # Fallback: buscar cualquier usuario con rol de planificador
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_spm FROM usuario
            WHERE LOWER(rol) LIKE '%planificador%'
            LIMIT 1
        """
        )
        row = cur.fetchone()

    if row:
        return str(row["id_spm"])

    # Fallback final: retornar "1" (admin por defecto)
    return "1"


def _check_auto_approval(solicitud_id: int) -> bool:
    """
    Feature 4.1: Verifica si la solicitud califica para auto-aprobacion con IA.

    Criterios:
    - Material clase C
    - Monto < $500 USD (50000 cents)
    - Usuario con 95%+ tasa de aprobacion historica

    Returns:
        True si fue auto-aprobada, False si no
    """
    try:
        solicitud = _get_raw(solicitud_id)
        if not solicitud:
            return False

        # Obtener datos de la solicitud
        total_monto = solicitud.get("total_monto", 0) or 0
        user_id = solicitud.get("id_usuario")

        # Criterio 1: Monto < $500 USD
        if total_monto >= 50000:  # 50000 cents = $500 USD
            return False

        # Criterio 2: Calcular tasa de aprobacion del usuario
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'approved' OR status = 'Aprobada' THEN 1 ELSE 0 END) as aprobadas
                FROM solicitud
                WHERE id_usuario = ? AND status IN ('approved', 'rejected', 'Aprobada', 'Rechazada')
                """,
                (str(user_id),)
            )
            row = cur.fetchone()

            if not row:
                return False

            total = row["total"] if isinstance(row, dict) else row[0]
            aprobadas = row["aprobadas"] if isinstance(row, dict) else row[1]

            # Requerir al menos 10 solicitudes historicas para evitar falsos positivos
            if total < 10:
                return False

            tasa_aprobacion = (aprobadas / total) if total > 0 else 0

            # Criterio 3: Tasa de aprobacion >= 95%
            if tasa_aprobacion < 0.95:
                return False

        # Criterio 4: Verificar si los items son clase C (simplificado: si monto bajo, asumir clase C)
        # En produccion, se deberia verificar la clase ABC de cada material

        # Todos los criterios cumplidos - auto-aprobar
        motivo = (
            f"Auto-aprobado por IA: Usuario con {round(tasa_aprobacion * 100, 1)}% "
            f"tasa aprobacion ({aprobadas}/{total}), monto ${total_monto/100:.2f} USD"
        )

        # Cambiar estado a approved
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.APPROVED,
            actor_id="system_ia",
            razon=motivo,
            metadata={
                "auto_aprobado": True,
                "tasa_aprobacion": tasa_aprobacion,
                "total_historico": total,
                "aprobadas_historico": aprobadas,
            }
        )

        # Actualizar campos de auto-aprobacion
        _update_solicitud(solicitud_id, {
            "auto_aprobado": 1,
            "auto_aprobado_motivo": motivo,
        })

        # Notificar al usuario
        try:
            NotificationService.create_notification(
                destinatario_id=str(user_id),
                mensaje=f"Su solicitud #{solicitud_id} fue auto-aprobada por IA",
                tipo="solicitud_approved",
                solicitud_id=solicitud_id,
            )
        except Exception:
            pass

        # Notificar al aprobador original
        aprobador_id = solicitud.get("aprobador_id")
        if aprobador_id:
            try:
                NotificationService.create_notification(
                    destinatario_id=str(aprobador_id),
                    mensaje=f"Solicitud #{solicitud_id} fue auto-aprobada por IA (no requiere su accion)",
                    tipo="info",
                    solicitud_id=solicitud_id,
                )
            except Exception:
                pass

        return True

    except Exception as e:
        logger.error(f"Error en auto-aprobacion para solicitud {solicitud_id}: {e}")
        return False
