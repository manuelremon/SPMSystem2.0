"""
Schemas/DTOs para el sistema de dashboards editables.

Define estructuras de datos para:
- Dashboards y hojas de calculo
- Fuentes de datos y formulas SPM
- Comparticion y permisos
- Operaciones y resultados
"""

import json
import uuid as uuid_lib
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

# ============================================================================
# Enums
# ============================================================================


class TipoDashboard(str, Enum):
    """Tipos de dashboard"""
    SPREADSHEET = "spreadsheet"
    CHART = "chart"
    MIXED = "mixed"


class TipoDataSource(str, Enum):
    """Tipos de fuente de datos"""
    STOCK = "stock"
    BUDGET = "budget"
    SOLICITUDES = "solicitudes"
    FORECAST = "forecast"
    MRP = "mrp"
    CUSTOM = "custom"


class PermisoNivel(str, Enum):
    """Niveles de permiso"""
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"


class FormulaCategoria(str, Enum):
    """Categorias de formulas SPM"""
    STOCK = "stock"
    BUDGET = "budget"
    SOLICITUDES = "solicitudes"
    FORECAST = "forecast"
    MRP = "mrp"


# ============================================================================
# Dataclasses para Dashboard
# ============================================================================


@dataclass
class DashboardGrupo:
    """Grupo/carpeta para organizar dashboards"""
    id: int
    nombre: str
    descripcion: Optional[str] = None
    icono: str = "folder"
    color: str = "#6366f1"
    orden: int = 0
    owner_id: str = ""
    es_publico: bool = False
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "icono": self.icono,
            "color": self.color,
            "orden": self.orden,
            "owner_id": self.owner_id,
            "es_publico": self.es_publico,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "DashboardGrupo":
        return cls(
            id=row.get("id", 0),
            nombre=row.get("nombre", ""),
            descripcion=row.get("descripcion"),
            icono=row.get("icono", "folder"),
            color=row.get("color", "#6366f1"),
            orden=row.get("orden", 0),
            owner_id=row.get("owner_id", ""),
            es_publico=bool(row.get("es_publico", 0)),
            created_at=row.get("created_at", ""),
            updated_at=row.get("updated_at", ""),
        )


@dataclass
class Dashboard:
    """Dashboard principal"""
    id: int
    uuid: str
    nombre: str
    owner_id: str
    descripcion: Optional[str] = None
    grupo_id: Optional[int] = None
    tipo: str = "spreadsheet"
    es_publico: bool = False
    es_favorito: bool = False
    icono: str = "table"
    color: str = "#3b82f6"
    thumbnail: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    version: int = 1
    created_at: str = ""
    updated_at: str = ""
    # Campos relacionados (opcionales, poblados en queries)
    sheets: List["DashboardSheet"] = field(default_factory=list)
    datasources: List["DashboardDataSource"] = field(default_factory=list)
    grupo: Optional[DashboardGrupo] = None
    permisos: List["DashboardPermiso"] = field(default_factory=list)

    def to_dict(self, include_sheets: bool = False, include_datasources: bool = False) -> Dict[str, Any]:
        result = {
            "id": self.id,
            "uuid": self.uuid,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "owner_id": self.owner_id,
            "grupo_id": self.grupo_id,
            "tipo": self.tipo,
            "es_publico": self.es_publico,
            "es_favorito": self.es_favorito,
            "icono": self.icono,
            "color": self.color,
            "thumbnail": self.thumbnail,
            "config": self.config,
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if include_sheets:
            result["sheets"] = [s.to_dict() for s in self.sheets]
        if include_datasources:
            result["datasources"] = [d.to_dict() for d in self.datasources]
        if self.grupo:
            result["grupo"] = self.grupo.to_dict()
        return result

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "Dashboard":
        config = row.get("config")
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except (json.JSONDecodeError, TypeError):
                config = None

        return cls(
            id=row.get("id", 0),
            uuid=row.get("uuid", ""),
            nombre=row.get("nombre", ""),
            descripcion=row.get("descripcion"),
            owner_id=row.get("owner_id", ""),
            grupo_id=row.get("grupo_id"),
            tipo=row.get("tipo", "spreadsheet"),
            es_publico=bool(row.get("es_publico", 0)),
            es_favorito=bool(row.get("es_favorito", 0)),
            icono=row.get("icono", "table"),
            color=row.get("color", "#3b82f6"),
            thumbnail=row.get("thumbnail"),
            config=config,
            version=row.get("version", 1),
            created_at=row.get("created_at", ""),
            updated_at=row.get("updated_at", ""),
        )


@dataclass
class DashboardSheet:
    """Hoja de calculo dentro de un dashboard"""
    id: int
    dashboard_id: int
    sheet_index: int = 0
    nombre: str = "Hoja 1"
    data: Dict[str, Any] = field(default_factory=dict)
    config: Optional[Dict[str, Any]] = None
    es_visible: bool = True
    es_protegida: bool = False
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "sheet_index": self.sheet_index,
            "nombre": self.nombre,
            "data": self.data,
            "config": self.config,
            "es_visible": self.es_visible,
            "es_protegida": self.es_protegida,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "DashboardSheet":
        data = row.get("data", "{}")
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                data = {}

        config = row.get("config")
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except (json.JSONDecodeError, TypeError):
                config = None

        return cls(
            id=row.get("id", 0),
            dashboard_id=row.get("dashboard_id", 0),
            sheet_index=row.get("sheet_index", 0),
            nombre=row.get("nombre", "Hoja 1"),
            data=data,
            config=config,
            es_visible=bool(row.get("es_visible", 1)),
            es_protegida=bool(row.get("es_protegida", 0)),
            created_at=row.get("created_at", ""),
            updated_at=row.get("updated_at", ""),
        )


@dataclass
class DashboardDataSource:
    """Fuente de datos conectada a un dashboard"""
    id: int
    dashboard_id: int
    nombre: str
    tipo: str
    query: Optional[str] = None
    filtros: Optional[Dict[str, Any]] = None
    cache_ttl: int = 300
    ultimo_refresh: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "nombre": self.nombre,
            "tipo": self.tipo,
            "query": self.query,
            "filtros": self.filtros,
            "cache_ttl": self.cache_ttl,
            "ultimo_refresh": self.ultimo_refresh,
            "config": self.config,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "DashboardDataSource":
        filtros = row.get("filtros")
        if isinstance(filtros, str):
            try:
                filtros = json.loads(filtros)
            except (json.JSONDecodeError, TypeError):
                filtros = None

        config = row.get("config")
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except (json.JSONDecodeError, TypeError):
                config = None

        return cls(
            id=row.get("id", 0),
            dashboard_id=row.get("dashboard_id", 0),
            nombre=row.get("nombre", ""),
            tipo=row.get("tipo", "custom"),
            query=row.get("query"),
            filtros=filtros,
            cache_ttl=row.get("cache_ttl", 300),
            ultimo_refresh=row.get("ultimo_refresh"),
            config=config,
            created_at=row.get("created_at", ""),
            updated_at=row.get("updated_at", ""),
        )


@dataclass
class DashboardShare:
    """Token de comparticion para acceso publico"""
    id: int
    dashboard_id: int
    token: str
    permiso: str = "view"
    password_hash: Optional[str] = None
    max_accesos: Optional[int] = None
    accesos_actuales: int = 0
    expira_en: Optional[str] = None
    creado_por: str = ""
    nota: Optional[str] = None
    esta_activo: bool = True
    created_at: str = ""

    @property
    def esta_expirado(self) -> bool:
        if not self.expira_en:
            return False
        try:
            expiry = datetime.fromisoformat(self.expira_en.replace("Z", "+00:00"))
            return datetime.utcnow() > expiry.replace(tzinfo=None)
        except (ValueError, AttributeError):
            return False

    @property
    def tiene_accesos_disponibles(self) -> bool:
        if self.max_accesos is None:
            return True
        return self.accesos_actuales < self.max_accesos

    @property
    def es_valido(self) -> bool:
        return self.esta_activo and not self.esta_expirado and self.tiene_accesos_disponibles

    def to_dict(self, include_token: bool = True) -> Dict[str, Any]:
        result = {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "permiso": self.permiso,
            "tiene_password": self.password_hash is not None,
            "max_accesos": self.max_accesos,
            "accesos_actuales": self.accesos_actuales,
            "expira_en": self.expira_en,
            "creado_por": self.creado_por,
            "nota": self.nota,
            "esta_activo": self.esta_activo,
            "esta_expirado": self.esta_expirado,
            "es_valido": self.es_valido,
            "created_at": self.created_at,
        }
        if include_token:
            result["token"] = self.token
        return result

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "DashboardShare":
        return cls(
            id=row.get("id", 0),
            dashboard_id=row.get("dashboard_id", 0),
            token=row.get("token", ""),
            permiso=row.get("permiso", "view"),
            password_hash=row.get("password_hash"),
            max_accesos=row.get("max_accesos"),
            accesos_actuales=row.get("accesos_actuales", 0),
            expira_en=row.get("expira_en"),
            creado_por=row.get("creado_por", ""),
            nota=row.get("nota"),
            esta_activo=bool(row.get("esta_activo", 1)),
            created_at=row.get("created_at", ""),
        )


@dataclass
class DashboardPermiso:
    """Permiso de acceso para un usuario especifico"""
    id: int
    dashboard_id: int
    usuario_id: str
    permiso: str = "view"
    otorgado_por: str = ""
    created_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "usuario_id": self.usuario_id,
            "permiso": self.permiso,
            "otorgado_por": self.otorgado_por,
            "created_at": self.created_at,
        }

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "DashboardPermiso":
        return cls(
            id=row.get("id", 0),
            dashboard_id=row.get("dashboard_id", 0),
            usuario_id=row.get("usuario_id", ""),
            permiso=row.get("permiso", "view"),
            otorgado_por=row.get("otorgado_por", ""),
            created_at=row.get("created_at", ""),
        )


# ============================================================================
# Dataclasses para Formulas SPM
# ============================================================================


@dataclass
class FormulaResult:
    """Resultado de ejecucion de formula SPM"""
    success: bool
    value: Any = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    cached: bool = False
    execution_time_ms: float = 0

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "ok": self.success,
            "value": self.value,
            "cached": self.cached,
            "execution_time_ms": self.execution_time_ms,
        }
        if self.error_code:
            result["error_code"] = self.error_code
            result["error_message"] = self.error_message
        return result


# ============================================================================
# Dataclasses para Operaciones
# ============================================================================


@dataclass
class CreateDashboardRequest:
    """Solicitud de creacion de dashboard"""
    nombre: str
    owner_id: str
    descripcion: Optional[str] = None
    grupo_id: Optional[int] = None
    tipo: str = "spreadsheet"
    icono: str = "table"
    color: str = "#3b82f6"
    config: Optional[Dict[str, Any]] = None
    initial_data: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], owner_id: str) -> "CreateDashboardRequest":
        return cls(
            nombre=data.get("nombre", "Nuevo Dashboard"),
            owner_id=owner_id,
            descripcion=data.get("descripcion"),
            grupo_id=data.get("grupo_id"),
            tipo=data.get("tipo", "spreadsheet"),
            icono=data.get("icono", "table"),
            color=data.get("color", "#3b82f6"),
            config=data.get("config"),
            initial_data=data.get("initial_data"),
        )


@dataclass
class UpdateDashboardRequest:
    """Solicitud de actualizacion de dashboard"""
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    grupo_id: Optional[int] = None
    es_publico: Optional[bool] = None
    es_favorito: Optional[bool] = None
    icono: Optional[str] = None
    color: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UpdateDashboardRequest":
        return cls(
            nombre=data.get("nombre"),
            descripcion=data.get("descripcion"),
            grupo_id=data.get("grupo_id"),
            es_publico=data.get("es_publico"),
            es_favorito=data.get("es_favorito"),
            icono=data.get("icono"),
            color=data.get("color"),
            config=data.get("config"),
        )


@dataclass
class CreateShareRequest:
    """Solicitud de creacion de link compartido"""
    dashboard_id: int
    creado_por: str
    permiso: str = "view"
    password: Optional[str] = None
    max_accesos: Optional[int] = None
    expira_en: Optional[str] = None
    nota: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], dashboard_id: int, creado_por: str) -> "CreateShareRequest":
        return cls(
            dashboard_id=dashboard_id,
            creado_por=creado_por,
            permiso=data.get("permiso", "view"),
            password=data.get("password"),
            max_accesos=data.get("max_accesos"),
            expira_en=data.get("expira_en"),
            nota=data.get("nota"),
        )


@dataclass
class DashboardOperationResult:
    """Resultado de operacion de dashboard"""
    success: bool
    dashboard: Optional[Dashboard] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"ok": self.success}
        if self.dashboard:
            result["dashboard"] = self.dashboard.to_dict(include_sheets=True, include_datasources=True)
        if self.error_code:
            result["error_code"] = self.error_code
            result["error_message"] = self.error_message
        return result


# ============================================================================
# Funciones de utilidad
# ============================================================================


def generate_uuid() -> str:
    """Genera un UUID unico para dashboard"""
    return str(uuid_lib.uuid4())


def generate_share_token() -> str:
    """Genera un token unico para comparticion"""
    return str(uuid_lib.uuid4()).replace("-", "")[:24]


def get_default_sheet_data() -> Dict[str, Any]:
    """Retorna la estructura de datos por defecto para una hoja nueva"""
    return {
        "name": "Hoja 1",
        "celldata": [],
        "row": 100,
        "column": 26,
        "config": {
            "merge": {},
            "rowlen": {},
            "columnlen": {},
            "rowhidden": {},
            "colhidden": {},
            "borderInfo": [],
        },
        "scrollLeft": 0,
        "scrollTop": 0,
        "luckysheet_selection_range": [],
        "zoomRatio": 1,
        "status": 1,
        "order": 0,
        "index": 0,
    }


# ============================================================================
# Catalogo de Formulas SPM
# ============================================================================

SPM_FORMULAS_CATALOG = {
    # Stock/Inventario
    "SPM.STOCK": {
        "categoria": FormulaCategoria.STOCK,
        "descripcion": "Obtiene valor de stock de un material",
        "sintaxis": "=SPM.STOCK(material, centro, campo)",
        "params": ["material", "centro", "campo"],
        "ejemplo": '=SPM.STOCK("MAT001", "1000", "stock_actual")',
    },
    "SPM.MRP.ALERTAS": {
        "categoria": FormulaCategoria.MRP,
        "descripcion": "Cuenta alertas MRP por centro y severidad",
        "sintaxis": "=SPM.MRP.ALERTAS(centro, severidad)",
        "params": ["centro", "severidad"],
        "ejemplo": '=SPM.MRP.ALERTAS("1000", "danger")',
    },
    # Presupuestos
    "SPM.BUDGET": {
        "categoria": FormulaCategoria.BUDGET,
        "descripcion": "Obtiene informacion de presupuesto",
        "sintaxis": "=SPM.BUDGET(centro, sector, campo)",
        "params": ["centro", "sector", "campo"],
        "ejemplo": '=SPM.BUDGET("1000", "MTTO", "saldo_usd")',
    },
    "SPM.BUDGET.LEDGER": {
        "categoria": FormulaCategoria.BUDGET,
        "descripcion": "Obtiene movimientos del ledger",
        "sintaxis": "=SPM.BUDGET.LEDGER(centro, desde, hasta)",
        "params": ["centro", "desde", "hasta"],
        "ejemplo": '=SPM.BUDGET.LEDGER("1000", "2026-01-01", "2026-12-31")',
    },
    # Solicitudes
    "SPM.SOLICITUDES.COUNT": {
        "categoria": FormulaCategoria.SOLICITUDES,
        "descripcion": "Cuenta solicitudes por criterios",
        "sintaxis": "=SPM.SOLICITUDES.COUNT(estado, centro, desde, hasta)",
        "params": ["estado", "centro", "desde", "hasta"],
        "ejemplo": '=SPM.SOLICITUDES.COUNT("approved", "1000", "2026-01-01", "2026-12-31")',
    },
    "SPM.SOLICITUDES.SUM": {
        "categoria": FormulaCategoria.SOLICITUDES,
        "descripcion": "Suma campo de solicitudes filtradas",
        "sintaxis": "=SPM.SOLICITUDES.SUM(campo, filtros)",
        "params": ["campo", "filtros"],
        "ejemplo": '=SPM.SOLICITUDES.SUM("total_monto", {"estado": "approved"})',
    },
    # Forecast
    "SPM.FORECAST": {
        "categoria": FormulaCategoria.FORECAST,
        "descripcion": "Obtiene prediccion de demanda",
        "sintaxis": "=SPM.FORECAST(material, dias, modelo)",
        "params": ["material", "dias", "modelo"],
        "ejemplo": '=SPM.FORECAST("MAT001", 30, "arima")',
    },
    "SPM.FORECAST.ACCURACY": {
        "categoria": FormulaCategoria.FORECAST,
        "descripcion": "Obtiene precision del modelo",
        "sintaxis": "=SPM.FORECAST.ACCURACY(material, modelo)",
        "params": ["material", "modelo"],
        "ejemplo": '=SPM.FORECAST.ACCURACY("MAT001", "prophet")',
    },
}
