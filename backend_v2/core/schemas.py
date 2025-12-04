"""
Schemas/DTOs para validación y serialización de respuestas de la API Planner.

Define la estructura de entrada/salida para los 3 pasos del flujo de tratamiento
de solicitudes, incluyendo validación automática y serialización JSON.
"""

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class DecisionTipo(str, Enum):
    """Tipos de decisión de abastecimiento"""

    STOCK = "stock"
    PROVEEDOR = "proveedor"
    EQUIVALENCIA = "equivalencia"
    MIX = "mix"


class ConflictoTipo(str, Enum):
    """Tipos de conflictos detectados"""

    STOCK_INSUFICIENTE = "stock_insuficiente"
    PRESUPUESTO_INSUFICIENTE = "presupuesto_insuficiente"
    MATERIALES_NO_IDENTIFICADOS = "materiales_no_identificados"
    PROVEEDORES_NO_DISPONIBLES = "proveedores_no_disponibles"


class CriticidadNivel(str, Enum):
    """Nivel de criticidad"""

    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"


class PrioridadRecomendacion(str, Enum):
    """Prioridad de recomendación"""

    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    MUY_ALTA = "muy_alta"


# ============================================================================
# PASO 1: Análisis Inicial
# ============================================================================


@dataclass
class Conflicto:
    """Registro de un conflicto detectado"""

    tipo: str  # stock_insuficiente, presupuesto_insuficiente, etc.
    item_idx: int
    codigo: str
    descripcion: Optional[str] = None
    cantidad: Optional[float] = None
    stock_disponible: Optional[float] = None
    costo_item: Optional[float] = None
    presupuesto_requerido: Optional[float] = None
    mensaje: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Aviso:
    """Registro de un aviso/alerta"""

    tipo: str
    item_idx: int
    codigo: str
    nivel: str = "info"  # info, warning, error
    mensaje: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MaterialPorCriticidad:
    """Agrupación de materiales por nivel de criticidad"""

    criticidad: str
    count: int
    items: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Recomendacion:
    """Recomendación de acción"""

    prioridad: str
    accion: str
    razon: str
    item_idx: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ResumenPresupuesto:
    """Resumen de presupuesto para PASO 1"""

    presupuesto_total: float
    presupuesto_disponible: float
    total_solicitado: float
    diferencia_presupuesto: float
    total_items: int
    conflictos_detectados: int
    avisos: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ResultadoPaso1:
    """Respuesta de PASO 1: Análisis Inicial"""

    solicitud_id: int
    paso: int = 1
    nombre_paso: str = "Análisis Inicial"
    resumen: Optional[ResumenPresupuesto] = None
    materiales_por_criticidad: List[MaterialPorCriticidad] = field(default_factory=list)
    conflictos: List[Conflicto] = field(default_factory=list)
    avisos: List[Aviso] = field(default_factory=list)
    recomendaciones: List[Recomendacion] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario, serializando objetos anidados"""
        return {
            "solicitud_id": self.solicitud_id,
            "paso": self.paso,
            "nombre_paso": self.nombre_paso,
            "resumen": self.resumen.to_dict() if self.resumen else None,
            "materiales_por_criticidad": [m.to_dict() for m in self.materiales_por_criticidad],
            "conflictos": [c.to_dict() for c in self.conflictos],
            "avisos": [a.to_dict() for a in self.avisos],
            "recomendaciones": [r.to_dict() for r in self.recomendaciones],
        }


# ============================================================================
# PASO 2: Opciones de Abastecimiento
# ============================================================================


@dataclass
class ItemDetalles:
    """Detalles del item siendo evaluado"""

    codigo: str
    descripcion: str = ""
    cantidad: float = 0.0
    precio_unitario_original: float = 0.0
    costo_total_original: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Opcion:
    """Una opción de abastecimiento disponible"""

    opcion_id: str  # "stock", "prov_001", "equiv_MAT123", "mix_stock_prov"
    tipo: str  # stock, proveedor, equivalencia, mix
    id_proveedor: Optional[str] = None
    codigo_material: Optional[str] = None
    cantidad_disponible: float = 0.0
    plazo_entrega_dias: Optional[int] = None
    precio_unitario: float = 0.0
    costo_total: float = 0.0
    rating: Optional[float] = None
    compatibilidad_pct: int = 100
    score: Optional[float] = None
    observaciones: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ResultadoPaso2:
    """Respuesta de PASO 2: Decisión de Abastecimiento"""

    solicitud_id: int
    item_idx: int
    paso: int = 2
    nombre_paso: str = "Decisión de Abastecimiento"
    item: Optional[ItemDetalles] = None
    opciones: List[Opcion] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario, serializando objetos anidados"""
        return {
            "solicitud_id": self.solicitud_id,
            "item_idx": self.item_idx,
            "paso": self.paso,
            "nombre_paso": self.nombre_paso,
            "item": self.item.to_dict() if self.item else None,
            "opciones": [o.to_dict() for o in self.opciones],
        }


# ============================================================================
# PASO 3: Guardar Tratamiento
# ============================================================================


@dataclass
class DecisionItem:
    """Una decisión de tratamiento para un item"""

    item_idx: int
    decision_tipo: str  # stock, proveedor, equivalencia, mix
    cantidad_aprobada: float
    codigo_material: Optional[str] = None
    id_proveedor: Optional[str] = None
    precio_unitario_final: Optional[float] = None
    observacion: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DecisionItem":
        """Construye desde diccionario (validación básica)"""
        required = {"item_idx", "decision_tipo", "cantidad_aprobada"}
        if not required.issubset(set(data.keys())):
            raise ValueError(f"Faltan campos requeridos: {required - set(data.keys())}")

        return cls(
            item_idx=int(data["item_idx"]),
            decision_tipo=str(data["decision_tipo"]).lower(),
            cantidad_aprobada=float(data["cantidad_aprobada"]),
            codigo_material=data.get("codigo_material"),
            id_proveedor=data.get("id_proveedor"),
            precio_unitario_final=data.get("precio_unitario_final"),
            observacion=data.get("observacion", ""),
        )


@dataclass
class DecisionGuardada:
    """Confirmación de una decisión guardada"""

    item_idx: int
    decision_tipo: str
    cantidad_aprobada: float
    codigo_material: Optional[str] = None
    id_proveedor: Optional[str] = None
    timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ResultadoPaso3:
    """Respuesta de PASO 3: Guardar Tratamiento"""

    solicitud_id: int
    paso: int = 3
    nombre_paso: str = "Guardar Tratamiento"
    status_actualizado: str = "tratamiento_guardado"
    cantidad_decisiones: int = 0
    decisiones: List[DecisionGuardada] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario, serializando objetos anidados"""
        return {
            "solicitud_id": self.solicitud_id,
            "paso": self.paso,
            "nombre_paso": self.nombre_paso,
            "status_actualizado": self.status_actualizado,
            "cantidad_decisiones": self.cantidad_decisiones,
            "decisiones": [d.to_dict() for d in self.decisiones],
        }


# ============================================================================
# Envoltura genérica de respuesta
# ============================================================================


@dataclass
class ApiResponse:
    """Envoltura estándar para todas las respuestas API"""

    ok: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    trace_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"ok": self.ok}
        if self.data is not None:
            result["data"] = self.data
        if self.error is not None:
            result["error"] = self.error
        if self.trace_id is not None:
            result["trace_id"] = self.trace_id
        return result


# ============================================================================
# Helpers para construcción
# ============================================================================


def success_response(data: Dict[str, Any], trace_id: Optional[str] = None) -> Dict[str, Any]:
    """Construye respuesta exitosa"""
    response = ApiResponse(ok=True, data=data, trace_id=trace_id)
    return response.to_dict()


def error_response(error_code: str, message: str, trace_id: Optional[str] = None) -> Dict[str, Any]:
    """Construye respuesta de error"""
    response = ApiResponse(
        ok=False, error={"code": error_code, "message": message}, trace_id=trace_id
    )
    return response.to_dict()
