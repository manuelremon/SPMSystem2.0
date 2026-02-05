"""
Servicio de Dashboards Editables.

Logica de negocio para:
- CRUD de dashboards y hojas de calculo
- Gestion de fuentes de datos
- Comparticion y permisos
- Exportacion a Excel
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.dashboard_schemas import (
    CreateDashboardRequest,
    CreateShareRequest,
    Dashboard,
    DashboardDataSource,
    DashboardGrupo,
    DashboardOperationResult,
    DashboardPermiso,
    DashboardShare,
    DashboardSheet,
    PermisoNivel,
    UpdateDashboardRequest,
    generate_share_token,
    generate_uuid,
    get_default_sheet_data,
)
from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.roles import is_admin


class _ConnectionWrapper:
    """Wrapper para conexion que permite usar como context manager o con close()"""

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
    """Conexion a BD usando get_db_connection"""
    wrapper = _ConnectionWrapper(get_db_connection())
    wrapper.__enter__()
    return wrapper


def _execute(cursor, sql, params=None):
    """Ejecuta query convirtiendo placeholders ? a %s para PostgreSQL"""
    if is_using_postgresql():
        sql = sql.replace("?", "%s")
    return cursor.execute(sql, params or ())


def _fetchone(cursor):
    """Obtiene una fila y la convierte a dict"""
    row = cursor.fetchone()
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(row) if hasattr(row, "keys") else row


def _fetchall(cursor):
    """Obtiene todas las filas y las convierte a dicts"""
    rows = cursor.fetchall()
    if not rows:
        return []
    if isinstance(rows[0], dict):
        return rows
    return [dict(row) if hasattr(row, "keys") else row for row in rows]


# ============================================================================
# Servicio de Grupos
# ============================================================================


class DashboardGrupoService:
    """Servicio para grupos/carpetas de dashboards"""

    @staticmethod
    def list_all(owner_id: str, include_public: bool = True) -> List[DashboardGrupo]:
        """Lista todos los grupos accesibles por el usuario"""
        conn = _connect()
        try:
            cur = conn.cursor()
            if include_public:
                _execute(
                    cur,
                    """SELECT * FROM dashboard_grupo
                       WHERE owner_id = ? OR es_publico = 1
                       ORDER BY orden, nombre""",
                    (owner_id,),
                )
            else:
                _execute(
                    cur,
                    "SELECT * FROM dashboard_grupo WHERE owner_id = ? ORDER BY orden, nombre",
                    (owner_id,),
                )
            rows = _fetchall(cur)
            return [DashboardGrupo.from_row(r) for r in rows]
        finally:
            conn.close()

    @staticmethod
    def get_by_id(grupo_id: int) -> Optional[DashboardGrupo]:
        """Obtiene un grupo por ID"""
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(cur, "SELECT * FROM dashboard_grupo WHERE id = ?", (grupo_id,))
            row = _fetchone(cur)
            return DashboardGrupo.from_row(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def create(nombre: str, owner_id: str, descripcion: str = None, icono: str = "folder", color: str = "#6366f1") -> DashboardGrupo:
        """Crea un nuevo grupo"""
        conn = _connect()
        try:
            cur = conn.cursor()
            now = datetime.utcnow().isoformat() + "Z"
            _execute(
                cur,
                """INSERT INTO dashboard_grupo (nombre, descripcion, icono, color, owner_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (nombre, descripcion, icono, color, owner_id, now, now),
            )
            conn.commit()
            grupo_id = cur.lastrowid
            return DashboardGrupoService.get_by_id(grupo_id)
        finally:
            conn.close()

    @staticmethod
    def delete(grupo_id: int, owner_id: str) -> bool:
        """Elimina un grupo (solo el propietario puede hacerlo)"""
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                "DELETE FROM dashboard_grupo WHERE id = ? AND owner_id = ?",
                (grupo_id, owner_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


# ============================================================================
# Servicio de Dashboards
# ============================================================================


class DashboardService:
    """Servicio principal para dashboards"""

    @staticmethod
    def list_all(
        owner_id: str,
        user_roles: List[str] = None,
        grupo_id: int = None,
        include_shared: bool = True,
    ) -> List[Dashboard]:
        """Lista dashboards accesibles por el usuario"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Base query - propios
            sql = """
                SELECT d.*, g.nombre as grupo_nombre
                FROM dashboard d
                LEFT JOIN dashboard_grupo g ON d.grupo_id = g.id
                WHERE d.owner_id = ?
            """
            params = [owner_id]

            # Filtrar por grupo si se especifica
            if grupo_id is not None:
                sql += " AND d.grupo_id = ?"
                params.append(grupo_id)

            # Incluir publicos y compartidos
            if include_shared:
                sql += """
                    UNION
                    SELECT d.*, g.nombre as grupo_nombre
                    FROM dashboard d
                    LEFT JOIN dashboard_grupo g ON d.grupo_id = g.id
                    WHERE d.es_publico = 1
                    UNION
                    SELECT d.*, g.nombre as grupo_nombre
                    FROM dashboard d
                    LEFT JOIN dashboard_grupo g ON d.grupo_id = g.id
                    INNER JOIN dashboard_permiso p ON d.id = p.dashboard_id
                    WHERE p.usuario_id = ?
                """
                params.append(owner_id)

            sql += " ORDER BY updated_at DESC"

            _execute(cur, sql, tuple(params))
            rows = _fetchall(cur)

            dashboards = []
            seen_ids = set()
            for row in rows:
                if row["id"] not in seen_ids:
                    seen_ids.add(row["id"])
                    dashboards.append(Dashboard.from_row(row))

            return dashboards
        finally:
            conn.close()

    @staticmethod
    def get_by_uuid(uuid: str, user_id: str = None, check_permission: bool = True) -> Optional[Dashboard]:
        """Obtiene un dashboard por UUID con todas sus hojas y datasources"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Obtener dashboard base
            _execute(cur, "SELECT * FROM dashboard WHERE uuid = ?", (uuid,))
            row = _fetchone(cur)

            if not row:
                return None

            dashboard = Dashboard.from_row(row)

            # Verificar permisos si se requiere
            if check_permission and user_id:
                if not DashboardService._has_access(dashboard, user_id):
                    return None

            # Cargar sheets
            _execute(
                cur,
                "SELECT * FROM dashboard_sheet WHERE dashboard_id = ? ORDER BY sheet_index",
                (dashboard.id,),
            )
            sheets = _fetchall(cur)
            dashboard.sheets = [DashboardSheet.from_row(s) for s in sheets]

            # Cargar datasources
            _execute(
                cur,
                "SELECT * FROM dashboard_datasource WHERE dashboard_id = ?",
                (dashboard.id,),
            )
            datasources = _fetchall(cur)
            dashboard.datasources = [DashboardDataSource.from_row(d) for d in datasources]

            # Cargar grupo si existe
            if dashboard.grupo_id:
                dashboard.grupo = DashboardGrupoService.get_by_id(dashboard.grupo_id)

            return dashboard
        finally:
            conn.close()

    @staticmethod
    def _has_access(dashboard: Dashboard, user_id: str) -> bool:
        """Verifica si el usuario tiene acceso al dashboard"""
        # Propietario siempre tiene acceso
        if dashboard.owner_id == user_id:
            return True

        # Dashboard publico
        if dashboard.es_publico:
            return True

        # Verificar permisos explicitos
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                "SELECT 1 FROM dashboard_permiso WHERE dashboard_id = ? AND usuario_id = ?",
                (dashboard.id, user_id),
            )
            return _fetchone(cur) is not None
        finally:
            conn.close()

    @staticmethod
    def get_permission_level(dashboard_id: int, user_id: str, owner_id: str) -> Optional[str]:
        """Obtiene el nivel de permiso del usuario para el dashboard"""
        # Propietario tiene admin
        if owner_id == user_id:
            return PermisoNivel.ADMIN.value

        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                "SELECT permiso FROM dashboard_permiso WHERE dashboard_id = ? AND usuario_id = ?",
                (dashboard_id, user_id),
            )
            row = _fetchone(cur)
            if row:
                return row["permiso"]

            # Verificar si es publico
            _execute(
                cur,
                "SELECT es_publico FROM dashboard WHERE id = ?",
                (dashboard_id,),
            )
            dash_row = _fetchone(cur)
            if dash_row and dash_row["es_publico"]:
                return PermisoNivel.VIEW.value

            return None
        finally:
            conn.close()

    @staticmethod
    def create(request: CreateDashboardRequest) -> DashboardOperationResult:
        """Crea un nuevo dashboard"""
        conn = _connect()
        try:
            cur = conn.cursor()
            now = datetime.utcnow().isoformat() + "Z"
            dashboard_uuid = generate_uuid()

            # Serializar config
            config_json = json.dumps(request.config) if request.config else None

            # Insertar dashboard
            _execute(
                cur,
                """INSERT INTO dashboard
                   (uuid, nombre, descripcion, owner_id, grupo_id, tipo, icono, color, config, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    dashboard_uuid,
                    request.nombre,
                    request.descripcion,
                    request.owner_id,
                    request.grupo_id,
                    request.tipo,
                    request.icono,
                    request.color,
                    config_json,
                    now,
                    now,
                ),
            )
            dashboard_id = cur.lastrowid

            # Crear hoja inicial
            sheet_data = request.initial_data or get_default_sheet_data()
            _execute(
                cur,
                """INSERT INTO dashboard_sheet
                   (dashboard_id, sheet_index, nombre, data, created_at, updated_at)
                   VALUES (?, 0, 'Hoja 1', ?, ?, ?)""",
                (dashboard_id, json.dumps(sheet_data), now, now),
            )

            conn.commit()

            # Obtener dashboard completo
            dashboard = DashboardService.get_by_uuid(dashboard_uuid, request.owner_id, False)

            return DashboardOperationResult(success=True, dashboard=dashboard)

        except Exception as e:
            conn.rollback()
            return DashboardOperationResult(
                success=False,
                error_code="CREATE_ERROR",
                error_message=str(e),
            )
        finally:
            conn.close()

    @staticmethod
    def update(uuid: str, request: UpdateDashboardRequest, user_id: str) -> DashboardOperationResult:
        """Actualiza un dashboard existente"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar existencia y permisos
            _execute(cur, "SELECT * FROM dashboard WHERE uuid = ?", (uuid,))
            row = _fetchone(cur)
            if not row:
                return DashboardOperationResult(
                    success=False,
                    error_code="NOT_FOUND",
                    error_message="Dashboard no encontrado",
                )

            dashboard = Dashboard.from_row(row)
            perm = DashboardService.get_permission_level(dashboard.id, user_id, dashboard.owner_id)
            if perm not in [PermisoNivel.EDIT.value, PermisoNivel.ADMIN.value]:
                return DashboardOperationResult(
                    success=False,
                    error_code="FORBIDDEN",
                    error_message="Sin permiso de edicion",
                )

            # Construir UPDATE dinamico
            updates = []
            params = []

            if request.nombre is not None:
                updates.append("nombre = ?")
                params.append(request.nombre)
            if request.descripcion is not None:
                updates.append("descripcion = ?")
                params.append(request.descripcion)
            if request.grupo_id is not None:
                updates.append("grupo_id = ?")
                params.append(request.grupo_id)
            if request.es_publico is not None:
                updates.append("es_publico = ?")
                params.append(1 if request.es_publico else 0)
            if request.es_favorito is not None:
                updates.append("es_favorito = ?")
                params.append(1 if request.es_favorito else 0)
            if request.icono is not None:
                updates.append("icono = ?")
                params.append(request.icono)
            if request.color is not None:
                updates.append("color = ?")
                params.append(request.color)
            if request.config is not None:
                updates.append("config = ?")
                params.append(json.dumps(request.config))

            if not updates:
                return DashboardOperationResult(
                    success=False,
                    error_code="NO_CHANGES",
                    error_message="No hay cambios para aplicar",
                )

            updates.append("updated_at = ?")
            updates.append("version = version + 1")
            params.append(datetime.utcnow().isoformat() + "Z")
            params.append(uuid)

            sql = f"UPDATE dashboard SET {', '.join(updates)} WHERE uuid = ?"
            _execute(cur, sql, tuple(params))
            conn.commit()

            # Retornar dashboard actualizado
            dashboard = DashboardService.get_by_uuid(uuid, user_id, False)
            return DashboardOperationResult(success=True, dashboard=dashboard)

        except Exception as e:
            conn.rollback()
            return DashboardOperationResult(
                success=False,
                error_code="UPDATE_ERROR",
                error_message=str(e),
            )
        finally:
            conn.close()

    @staticmethod
    def delete(uuid: str, user_id: str) -> bool:
        """Elimina un dashboard (solo propietario o admin)"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar existencia y permisos
            _execute(cur, "SELECT id, owner_id FROM dashboard WHERE uuid = ?", (uuid,))
            row = _fetchone(cur)
            if not row:
                return False

            if row["owner_id"] != user_id:
                return False

            # Eliminar (CASCADE eliminara sheets, datasources, shares, permisos)
            _execute(cur, "DELETE FROM dashboard WHERE uuid = ?", (uuid,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def toggle_favorite(uuid: str, user_id: str) -> Optional[bool]:
        """Alterna el estado de favorito"""
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                "UPDATE dashboard SET es_favorito = NOT es_favorito WHERE uuid = ? AND owner_id = ?",
                (uuid, user_id),
            )
            conn.commit()

            if cur.rowcount == 0:
                return None

            _execute(cur, "SELECT es_favorito FROM dashboard WHERE uuid = ?", (uuid,))
            row = _fetchone(cur)
            return bool(row["es_favorito"]) if row else None
        finally:
            conn.close()


# ============================================================================
# Servicio de Hojas
# ============================================================================


class DashboardSheetService:
    """Servicio para hojas de calculo"""

    @staticmethod
    def get_by_id(sheet_id: int) -> Optional[DashboardSheet]:
        """Obtiene una hoja por ID"""
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(cur, "SELECT * FROM dashboard_sheet WHERE id = ?", (sheet_id,))
            row = _fetchone(cur)
            return DashboardSheet.from_row(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def update_data(sheet_id: int, data: Dict[str, Any], user_id: str) -> bool:
        """Actualiza los datos de una hoja"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar permisos via dashboard
            _execute(
                cur,
                """SELECT d.id, d.owner_id FROM dashboard d
                   INNER JOIN dashboard_sheet s ON d.id = s.dashboard_id
                   WHERE s.id = ?""",
                (sheet_id,),
            )
            row = _fetchone(cur)
            if not row:
                return False

            perm = DashboardService.get_permission_level(row["id"], user_id, row["owner_id"])
            if perm not in [PermisoNivel.EDIT.value, PermisoNivel.ADMIN.value]:
                return False

            now = datetime.utcnow().isoformat() + "Z"
            _execute(
                cur,
                "UPDATE dashboard_sheet SET data = ?, updated_at = ? WHERE id = ?",
                (json.dumps(data), now, sheet_id),
            )

            # Actualizar version del dashboard
            _execute(
                cur,
                """UPDATE dashboard SET version = version + 1, updated_at = ?
                   WHERE id = (SELECT dashboard_id FROM dashboard_sheet WHERE id = ?)""",
                (now, sheet_id),
            )

            conn.commit()
            return True
        finally:
            conn.close()

    @staticmethod
    def add_sheet(dashboard_id: int, nombre: str, user_id: str) -> Optional[DashboardSheet]:
        """Agrega una nueva hoja al dashboard"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar permisos
            _execute(cur, "SELECT owner_id FROM dashboard WHERE id = ?", (dashboard_id,))
            row = _fetchone(cur)
            if not row:
                return None

            perm = DashboardService.get_permission_level(dashboard_id, user_id, row["owner_id"])
            if perm not in [PermisoNivel.EDIT.value, PermisoNivel.ADMIN.value]:
                return None

            # Obtener siguiente indice
            _execute(
                cur,
                "SELECT COALESCE(MAX(sheet_index), -1) + 1 as next_idx FROM dashboard_sheet WHERE dashboard_id = ?",
                (dashboard_id,),
            )
            idx_row = _fetchone(cur)
            next_idx = idx_row["next_idx"] if idx_row else 0

            now = datetime.utcnow().isoformat() + "Z"
            sheet_data = get_default_sheet_data()
            sheet_data["name"] = nombre
            sheet_data["index"] = next_idx

            _execute(
                cur,
                """INSERT INTO dashboard_sheet
                   (dashboard_id, sheet_index, nombre, data, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (dashboard_id, next_idx, nombre, json.dumps(sheet_data), now, now),
            )
            sheet_id = cur.lastrowid
            conn.commit()

            return DashboardSheetService.get_by_id(sheet_id)
        finally:
            conn.close()

    @staticmethod
    def delete_sheet(sheet_id: int, user_id: str) -> bool:
        """Elimina una hoja (debe quedar al menos una)"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar permisos y contar hojas
            _execute(
                cur,
                """SELECT d.id, d.owner_id,
                   (SELECT COUNT(*) FROM dashboard_sheet WHERE dashboard_id = d.id) as sheet_count
                   FROM dashboard d
                   INNER JOIN dashboard_sheet s ON d.id = s.dashboard_id
                   WHERE s.id = ?""",
                (sheet_id,),
            )
            row = _fetchone(cur)
            if not row or row["sheet_count"] <= 1:
                return False

            perm = DashboardService.get_permission_level(row["id"], user_id, row["owner_id"])
            if perm not in [PermisoNivel.EDIT.value, PermisoNivel.ADMIN.value]:
                return False

            _execute(cur, "DELETE FROM dashboard_sheet WHERE id = ?", (sheet_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


# ============================================================================
# Servicio de DataSources
# ============================================================================


class DashboardDataSourceService:
    """Servicio para fuentes de datos"""

    @staticmethod
    def create(
        dashboard_id: int,
        nombre: str,
        tipo: str,
        user_id: str,
        query: str = None,
        filtros: Dict[str, Any] = None,
        config: Dict[str, Any] = None,
    ) -> Optional[DashboardDataSource]:
        """Crea una nueva fuente de datos"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar permisos
            _execute(cur, "SELECT owner_id FROM dashboard WHERE id = ?", (dashboard_id,))
            row = _fetchone(cur)
            if not row:
                return None

            perm = DashboardService.get_permission_level(dashboard_id, user_id, row["owner_id"])
            if perm not in [PermisoNivel.EDIT.value, PermisoNivel.ADMIN.value]:
                return None

            now = datetime.utcnow().isoformat() + "Z"
            _execute(
                cur,
                """INSERT INTO dashboard_datasource
                   (dashboard_id, nombre, tipo, query, filtros, config, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    dashboard_id,
                    nombre,
                    tipo,
                    query,
                    json.dumps(filtros) if filtros else None,
                    json.dumps(config) if config else None,
                    now,
                    now,
                ),
            )
            ds_id = cur.lastrowid
            conn.commit()

            _execute(cur, "SELECT * FROM dashboard_datasource WHERE id = ?", (ds_id,))
            row = _fetchone(cur)
            return DashboardDataSource.from_row(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def delete(datasource_id: int, user_id: str) -> bool:
        """Elimina una fuente de datos"""
        conn = _connect()
        try:
            cur = conn.cursor()

            _execute(
                cur,
                """SELECT d.id, d.owner_id FROM dashboard d
                   INNER JOIN dashboard_datasource ds ON d.id = ds.dashboard_id
                   WHERE ds.id = ?""",
                (datasource_id,),
            )
            row = _fetchone(cur)
            if not row:
                return False

            perm = DashboardService.get_permission_level(row["id"], user_id, row["owner_id"])
            if perm not in [PermisoNivel.EDIT.value, PermisoNivel.ADMIN.value]:
                return False

            _execute(cur, "DELETE FROM dashboard_datasource WHERE id = ?", (datasource_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


# ============================================================================
# Servicio de Comparticion
# ============================================================================


class DashboardShareService:
    """Servicio para comparticion de dashboards"""

    @staticmethod
    def create_share(request: CreateShareRequest) -> Optional[DashboardShare]:
        """Crea un nuevo link de comparticion"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar permisos (solo owner o admin puede compartir)
            _execute(cur, "SELECT owner_id FROM dashboard WHERE id = ?", (request.dashboard_id,))
            row = _fetchone(cur)
            if not row:
                return None

            perm = DashboardService.get_permission_level(
                request.dashboard_id, request.creado_por, row["owner_id"]
            )
            if perm != PermisoNivel.ADMIN.value:
                return None

            token = generate_share_token()
            now = datetime.utcnow().isoformat() + "Z"

            # Hash password si se proporciona
            password_hash = None
            if request.password:
                import hashlib
                password_hash = hashlib.sha256(request.password.encode()).hexdigest()

            _execute(
                cur,
                """INSERT INTO dashboard_share
                   (dashboard_id, token, permiso, password_hash, max_accesos, expira_en, creado_por, nota, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    request.dashboard_id,
                    token,
                    request.permiso,
                    password_hash,
                    request.max_accesos,
                    request.expira_en,
                    request.creado_por,
                    request.nota,
                    now,
                ),
            )
            share_id = cur.lastrowid
            conn.commit()

            _execute(cur, "SELECT * FROM dashboard_share WHERE id = ?", (share_id,))
            row = _fetchone(cur)
            return DashboardShare.from_row(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def get_by_token(token: str, password: str = None) -> Optional[Dict[str, Any]]:
        """Obtiene un dashboard por token de comparticion"""
        conn = _connect()
        try:
            cur = conn.cursor()

            _execute(
                cur,
                """SELECT s.*, d.uuid as dashboard_uuid
                   FROM dashboard_share s
                   INNER JOIN dashboard d ON s.dashboard_id = d.id
                   WHERE s.token = ? AND s.esta_activo = 1""",
                (token,),
            )
            row = _fetchone(cur)
            if not row:
                return None

            share = DashboardShare.from_row(row)

            # Verificar validez
            if not share.es_valido:
                return {"error": "SHARE_EXPIRED", "message": "El link ha expirado o alcanzado su limite"}

            # Verificar password si es requerido
            if share.password_hash:
                if not password:
                    return {"error": "PASSWORD_REQUIRED", "message": "Se requiere password"}
                import hashlib
                if hashlib.sha256(password.encode()).hexdigest() != share.password_hash:
                    return {"error": "INVALID_PASSWORD", "message": "Password incorrecta"}

            # Incrementar contador de accesos
            _execute(
                cur,
                "UPDATE dashboard_share SET accesos_actuales = accesos_actuales + 1 WHERE id = ?",
                (share.id,),
            )
            conn.commit()

            # Obtener dashboard completo
            dashboard = DashboardService.get_by_uuid(row["dashboard_uuid"], check_permission=False)

            return {
                "dashboard": dashboard.to_dict(include_sheets=True, include_datasources=True) if dashboard else None,
                "permiso": share.permiso,
                "share_id": share.id,
            }
        finally:
            conn.close()

    @staticmethod
    def list_shares(dashboard_id: int, user_id: str) -> List[DashboardShare]:
        """Lista todos los links de comparticion de un dashboard"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar permisos
            _execute(cur, "SELECT owner_id FROM dashboard WHERE id = ?", (dashboard_id,))
            row = _fetchone(cur)
            if not row or row["owner_id"] != user_id:
                return []

            _execute(
                cur,
                "SELECT * FROM dashboard_share WHERE dashboard_id = ? ORDER BY created_at DESC",
                (dashboard_id,),
            )
            rows = _fetchall(cur)
            return [DashboardShare.from_row(r) for r in rows]
        finally:
            conn.close()

    @staticmethod
    def revoke_share(share_id: int, user_id: str) -> bool:
        """Revoca un link de comparticion"""
        conn = _connect()
        try:
            cur = conn.cursor()

            _execute(
                cur,
                """SELECT d.owner_id FROM dashboard d
                   INNER JOIN dashboard_share s ON d.id = s.dashboard_id
                   WHERE s.id = ?""",
                (share_id,),
            )
            row = _fetchone(cur)
            if not row or row["owner_id"] != user_id:
                return False

            _execute(
                cur,
                "UPDATE dashboard_share SET esta_activo = 0 WHERE id = ?",
                (share_id,),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


# ============================================================================
# Servicio de Permisos
# ============================================================================


class DashboardPermisoService:
    """Servicio para permisos de usuario"""

    @staticmethod
    def grant(dashboard_id: int, usuario_id: str, permiso: str, otorgado_por: str) -> Optional[DashboardPermiso]:
        """Otorga permiso a un usuario"""
        conn = _connect()
        try:
            cur = conn.cursor()

            # Verificar que quien otorga es admin
            _execute(cur, "SELECT owner_id FROM dashboard WHERE id = ?", (dashboard_id,))
            row = _fetchone(cur)
            if not row:
                return None

            perm = DashboardService.get_permission_level(dashboard_id, otorgado_por, row["owner_id"])
            if perm != PermisoNivel.ADMIN.value:
                return None

            now = datetime.utcnow().isoformat() + "Z"

            # Insertar o actualizar
            _execute(
                cur,
                """INSERT INTO dashboard_permiso (dashboard_id, usuario_id, permiso, otorgado_por, created_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(dashboard_id, usuario_id) DO UPDATE SET permiso = ?, otorgado_por = ?""",
                (dashboard_id, usuario_id, permiso, otorgado_por, now, permiso, otorgado_por),
            )
            conn.commit()

            _execute(
                cur,
                "SELECT * FROM dashboard_permiso WHERE dashboard_id = ? AND usuario_id = ?",
                (dashboard_id, usuario_id),
            )
            row = _fetchone(cur)
            return DashboardPermiso.from_row(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def revoke(dashboard_id: int, usuario_id: str, revocado_por: str) -> bool:
        """Revoca el permiso de un usuario"""
        conn = _connect()
        try:
            cur = conn.cursor()

            _execute(cur, "SELECT owner_id FROM dashboard WHERE id = ?", (dashboard_id,))
            row = _fetchone(cur)
            if not row:
                return False

            perm = DashboardService.get_permission_level(dashboard_id, revocado_por, row["owner_id"])
            if perm != PermisoNivel.ADMIN.value:
                return False

            _execute(
                cur,
                "DELETE FROM dashboard_permiso WHERE dashboard_id = ? AND usuario_id = ?",
                (dashboard_id, usuario_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def list_permisos(dashboard_id: int) -> List[DashboardPermiso]:
        """Lista todos los permisos de un dashboard"""
        conn = _connect()
        try:
            cur = conn.cursor()
            _execute(
                cur,
                "SELECT * FROM dashboard_permiso WHERE dashboard_id = ?",
                (dashboard_id,),
            )
            rows = _fetchall(cur)
            return [DashboardPermiso.from_row(r) for r in rows]
        finally:
            conn.close()
