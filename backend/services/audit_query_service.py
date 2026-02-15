"""
Audit Query Service - Query and export audit log entries.

Provides:
- buscar_auditoria(filtros) - Paginated search with filters
- exportar_auditoria_excel(filtros) - Excel export
- obtener_timeline_entidad(entidad, entidad_id) - Entity change timeline
- obtener_stats_auditoria() - Summary stats
"""

import logging

from backend.core.db import get_db_connection

logger = logging.getLogger(__name__)


def buscar_auditoria(filtros):
    """Search audit log with pagination and filters.

    Args:
        filtros: dict with keys: page, per_page, actor_id, accion, entidad,
                 entidad_id, fecha_desde, fecha_hasta, search
    Returns:
        dict with items, total, page, per_page, pages
    """
    page = filtros.get("page", 1)
    per_page = min(filtros.get("per_page", 50), 200)
    offset = (page - 1) * per_page

    conditions = []
    params = []

    if filtros.get("actor_id"):
        conditions.append("a.actor_id = ?")
        params.append(filtros["actor_id"])
    if filtros.get("accion"):
        conditions.append("a.accion = ?")
        params.append(filtros["accion"])
    if filtros.get("entidad"):
        conditions.append("a.entidad = ?")
        params.append(filtros["entidad"])
    if filtros.get("entidad_id"):
        conditions.append("a.entidad_id = ?")
        params.append(str(filtros["entidad_id"]))
    if filtros.get("fecha_desde"):
        conditions.append("a.created_at >= ?")
        params.append(filtros["fecha_desde"])
    if filtros.get("fecha_hasta"):
        conditions.append("a.created_at <= ?")
        params.append(filtros["fecha_hasta"] + " 23:59:59")
    if filtros.get("search"):
        conditions.append("(a.entidad LIKE ? OR a.entidad_id LIKE ? OR a.accion LIKE ?)")
        s = f"%{filtros['search']}%"
        params.extend([s, s, s])

    where = " AND ".join(conditions) if conditions else "1=1"

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT COUNT(*) as cnt FROM audit_log a WHERE {where}", params)
            total = cur.fetchone()["cnt"]

            cur.execute(f"""
                SELECT a.*, u.nombre as actor_nombre
                FROM audit_log a
                LEFT JOIN usuarios u ON a.actor_id = u.id
                WHERE {where}
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?
            """, params + [per_page, offset])
            rows = cur.fetchall()

        items = [dict(r) for r in rows]
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page if total > 0 else 0,
        }
    except Exception as e:
        logger.error("Error buscando auditoria: %s", e)
        return {"items": [], "total": 0, "page": 1, "per_page": per_page, "pages": 0}


def obtener_timeline_entidad(entidad, entidad_id):
    """Get chronological timeline of changes for an entity.

    Args:
        entidad: Entity type (e.g. 'solicitud', 'contrato')
        entidad_id: Entity ID
    Returns:
        list of audit entries ordered by date
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT a.*, u.nombre as actor_nombre
                FROM audit_log a
                LEFT JOIN usuarios u ON a.actor_id = u.id
                WHERE a.entidad = ? AND a.entidad_id = ?
                ORDER BY a.created_at ASC
            """, (entidad, str(entidad_id)))
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("Error obteniendo timeline: %s", e)
        return []


def obtener_stats_auditoria():
    """Get audit log summary statistics.

    Returns:
        dict with action counts, top users, entity counts
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Count by action
            cur.execute("""
                SELECT accion, COUNT(*) as cnt
                FROM audit_log
                GROUP BY accion
                ORDER BY cnt DESC
                LIMIT 20
            """)
            por_accion = [dict(r) for r in cur.fetchall()]

            # Top actors
            cur.execute("""
                SELECT a.actor_id, u.nombre as actor_nombre, COUNT(*) as cnt
                FROM audit_log a
                LEFT JOIN usuarios u ON a.actor_id = u.id
                WHERE a.actor_id IS NOT NULL
                GROUP BY a.actor_id, u.nombre
                ORDER BY cnt DESC
                LIMIT 10
            """)
            top_usuarios = [dict(r) for r in cur.fetchall()]

            # Count by entity
            cur.execute("""
                SELECT entidad, COUNT(*) as cnt
                FROM audit_log
                GROUP BY entidad
                ORDER BY cnt DESC
                LIMIT 20
            """)
            por_entidad = [dict(r) for r in cur.fetchall()]

            # Total
            cur.execute("SELECT COUNT(*) as total FROM audit_log")
            total = cur.fetchone()["total"]

        return {
            "total": total,
            "por_accion": por_accion,
            "top_usuarios": top_usuarios,
            "por_entidad": por_entidad,
        }
    except Exception as e:
        logger.error("Error obteniendo stats auditoria: %s", e)
        return {"total": 0, "por_accion": [], "top_usuarios": [], "por_entidad": []}


def exportar_auditoria_excel(filtros):
    """Export audit log entries to Excel bytes.

    Args:
        filtros: same as buscar_auditoria
    Returns:
        bytes of xlsx file or None on error
    """
    try:
        import io

        import openpyxl

        # Get all matching entries (no pagination)
        filtros_all = {**filtros, "page": 1, "per_page": 10000}
        result = buscar_auditoria(filtros_all)
        items = result["items"]

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Audit Log"

        headers = ["ID", "Fecha", "Actor", "Accion", "Entidad", "ID Entidad", "Datos Anteriores", "Datos Nuevos"]
        ws.append(headers)

        for item in items:
            ws.append([
                item.get("id"),
                item.get("created_at"),
                item.get("actor_nombre", item.get("actor_id")),
                item.get("accion"),
                item.get("entidad"),
                item.get("entidad_id"),
                str(item.get("datos_anteriores", ""))[:500],
                str(item.get("datos_nuevos", ""))[:500],
            ])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
    except Exception as e:
        logger.error("Error exportando auditoria: %s", e)
        return None
