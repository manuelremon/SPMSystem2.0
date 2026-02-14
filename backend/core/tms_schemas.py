"""
Schemas de validacion para TMS (Transport Management) y FMS (Fleet Management).

Define dataclasses para validacion de entrada/salida de los endpoints TMS/FMS.
"""

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

# =============================================================================
# Enums TMS
# =============================================================================


class ShipmentEstado(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    ASSIGNED = "assigned"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    INCIDENT = "incident"
    RESOLVED = "resolved"
    SETTLED = "settled"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ShipmentTipo(str, Enum):
    STANDARD = "standard"
    EXPRESS = "express"
    LTL = "ltl"
    FTL = "ftl"
    CONSOLIDADO = "consolidado"


class TipoCarga(str, Enum):
    GENERAL = "general"
    PERECEDERO = "perecedero"
    FRAGIL = "fragil"
    PELIGROSO = "peligroso"
    VALOR_ALTO = "valor_alto"


class TrackingEventoTipo(str, Enum):
    SALIDA = "salida"
    PARADA = "parada"
    CARGA_COMBUSTIBLE = "carga_combustible"
    CHECKPOINT = "checkpoint"
    INCIDENCIA = "incidencia"
    ENTREGA_PARCIAL = "entrega_parcial"
    ENTREGA = "entrega"
    POSICION = "posicion"
    OTRO = "otro"


# =============================================================================
# Enums FMS
# =============================================================================


class VehicleEstado(str, Enum):
    DISPONIBLE = "disponible"
    EN_RUTA = "en_ruta"
    EN_MANTENIMIENTO = "en_mantenimiento"
    FUERA_SERVICIO = "fuera_servicio"
    BAJA = "baja"


class VehicleTipo(str, Enum):
    CAMION = "camion"
    CAMIONETA = "camioneta"
    TRAILER = "trailer"
    VAN = "van"
    RABON = "rabon"
    TORTON = "torton"
    PIPA = "pipa"
    OTRO = "otro"


class WOEstado(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    PENDING_PARTS = "pending_parts"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class WOTipo(str, Enum):
    PREVENTIVO = "preventivo"
    CORRECTIVO = "correctivo"
    EMERGENCIA = "emergencia"


class DriverEstado(str, Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    VACACIONES = "vacaciones"
    INCAPACIDAD = "incapacidad"
    BAJA = "baja"


# =============================================================================
# FSM Transiciones TMS
# =============================================================================


SHIPMENT_TRANSITIONS: Dict[str, List[str]] = {
    "draft": ["confirmed", "cancelled"],
    "confirmed": ["assigned", "cancelled"],
    "assigned": ["in_transit", "cancelled"],
    "in_transit": ["delivered", "incident", "cancelled"],
    "incident": ["resolved", "cancelled"],
    "resolved": ["in_transit"],
    "delivered": ["settled"],
    "settled": ["closed"],
    "closed": [],
    "cancelled": [],
}

WO_TRANSITIONS: Dict[str, List[str]] = {
    "draft": ["approved", "cancelled"],
    "approved": ["in_progress", "cancelled"],
    "in_progress": ["pending_parts", "completed", "cancelled"],
    "pending_parts": ["in_progress", "cancelled"],
    "completed": ["closed"],
    "closed": [],
    "cancelled": [],
}


def validar_transicion_shipment(estado_actual: str, estado_nuevo: str) -> bool:
    """Valida si una transicion de estado de envio es permitida."""
    permitidos = SHIPMENT_TRANSITIONS.get(estado_actual, [])
    return estado_nuevo in permitidos


def validar_transicion_wo(estado_actual: str, estado_nuevo: str) -> bool:
    """Valida si una transicion de estado de OT es permitida."""
    permitidos = WO_TRANSITIONS.get(estado_actual, [])
    return estado_nuevo in permitidos


# =============================================================================
# Schemas de Entrada TMS
# =============================================================================


@dataclass
class ShipmentCreateSchema:
    """Schema para crear un envio"""
    origen_centro_id: str
    destino_centro_id: str
    tipo: str = "standard"
    prioridad: int = 3
    tipo_carga: str = "general"
    requiere_cadena_frio: bool = False
    requiere_hazmat: bool = False
    fecha_programada: Optional[str] = None
    instrucciones: Optional[str] = None
    route_id: Optional[int] = None
    items: List[Dict[str, Any]] = field(default_factory=list)

    def validate(self) -> List[str]:
        errors = []
        if not self.origen_centro_id:
            errors.append("origen_centro_id es requerido")
        if not self.destino_centro_id:
            errors.append("destino_centro_id es requerido")
        if self.tipo not in [e.value for e in ShipmentTipo]:
            errors.append(f"tipo invalido: {self.tipo}")
        if not 1 <= self.prioridad <= 5:
            errors.append("prioridad debe estar entre 1 y 5")
        if self.tipo_carga not in [e.value for e in TipoCarga]:
            errors.append(f"tipo_carga invalido: {self.tipo_carga}")
        if not self.items:
            errors.append("Se requiere al menos un item")
        return errors


@dataclass
class ShipmentItemSchema:
    """Schema para un item de envio"""
    solicitud_id: Optional[int] = None
    material_id: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad: float = 0
    peso_kg: float = 0
    volumen_m3: float = 0
    valor_declarado: float = 0
    notas: Optional[str] = None


@dataclass
class ShipmentAssignSchema:
    """Schema para asignar vehiculo/conductor a envio"""
    vehicle_id: int = 0
    driver_id: int = 0
    route_id: Optional[int] = None

    def validate(self) -> List[str]:
        errors = []
        if not self.vehicle_id:
            errors.append("vehicle_id es requerido")
        if not self.driver_id:
            errors.append("driver_id es requerido")
        return errors


@dataclass
class TrackingEventSchema:
    """Schema para registrar evento de tracking"""
    evento_tipo: str
    ubicacion_lat: Optional[float] = None
    ubicacion_lng: Optional[float] = None
    ubicacion_nombre: Optional[str] = None
    temperatura: Optional[float] = None
    notas: Optional[str] = None
    evidencia_foto_url: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if self.evento_tipo not in [e.value for e in TrackingEventoTipo]:
            errors.append(f"evento_tipo invalido: {self.evento_tipo}")
        return errors


@dataclass
class TripCostSchema:
    """Schema para registrar costo de viaje"""
    concepto: str = ""
    monto: float = 0
    category_id: Optional[int] = None
    moneda: str = "MXN"
    tipo_cambio: float = 1.0
    evidencia_url: Optional[str] = None
    proveedor_id: Optional[str] = None
    fecha_gasto: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if not self.concepto:
            errors.append("concepto es requerido")
        if self.monto <= 0:
            errors.append("monto debe ser mayor a 0")
        if self.moneda not in ("USD", "MXN", "EUR"):
            errors.append("moneda debe ser USD, MXN o EUR")
        return errors


@dataclass
class RouteCreateSchema:
    """Schema para crear una ruta"""
    nombre: str = ""
    origen_centro_id: str = ""
    destino_centro_id: str = ""
    distancia_km: float = 0
    tiempo_estimado_hrs: float = 0
    costo_base: float = 0
    tipo_via: str = "carretera"
    waypoints: List[Dict[str, Any]] = field(default_factory=list)

    def validate(self) -> List[str]:
        errors = []
        if not self.nombre:
            errors.append("nombre es requerido")
        if not self.origen_centro_id:
            errors.append("origen_centro_id es requerido")
        if not self.destino_centro_id:
            errors.append("destino_centro_id es requerido")
        if self.tipo_via not in ("carretera", "autopista", "mixta", "urbana"):
            errors.append(f"tipo_via invalido: {self.tipo_via}")
        return errors


@dataclass
class TariffRuleSchema:
    """Schema para crear regla tarifaria"""
    nombre: str = ""
    tarifa_base_km: float = 0
    tarifa_peso_kg: float = 0
    tarifa_volumen_m3: float = 0
    origen_zona: Optional[int] = None
    destino_zona: Optional[int] = None
    tipo_vehiculo: Optional[str] = None
    tipo_carga: Optional[str] = None
    recargo_hazmat_pct: float = 0
    recargo_frio_pct: float = 0
    recargo_urgente_pct: float = 0
    vigencia_desde: Optional[str] = None
    vigencia_hasta: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if not self.nombre:
            errors.append("nombre es requerido")
        return errors


# =============================================================================
# Schemas de Entrada FMS
# =============================================================================


@dataclass
class VehicleCreateSchema:
    """Schema para crear vehiculo"""
    placa: str = ""
    tipo: str = "camion"
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    vin: Optional[str] = None
    numero_economico: Optional[str] = None
    capacidad_peso_kg: float = 0
    capacidad_vol_m3: float = 0
    tipo_combustible: str = "diesel"
    rendimiento_km_lt: float = 0
    cadena_frio: bool = False
    hazmat_cert: bool = False

    def validate(self) -> List[str]:
        errors = []
        if not self.placa:
            errors.append("placa es requerida")
        if self.tipo not in [e.value for e in VehicleTipo]:
            errors.append(f"tipo invalido: {self.tipo}")
        return errors


@dataclass
class DriverCreateSchema:
    """Schema para crear conductor"""
    nombre: str = ""
    apellido: Optional[str] = None
    usuario_id: Optional[str] = None
    numero_licencia: Optional[str] = None
    tipo_licencia: Optional[str] = None
    vigencia_licencia: Optional[str] = None
    vigencia_medica: Optional[str] = None
    capacitacion_hazmat: bool = False
    telefono: Optional[str] = None
    contacto_emergencia: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if not self.nombre:
            errors.append("nombre es requerido")
        if self.tipo_licencia and self.tipo_licencia not in ("A", "B", "C", "D", "E", "federal"):
            errors.append(f"tipo_licencia invalido: {self.tipo_licencia}")
        return errors


@dataclass
class WorkOrderCreateSchema:
    """Schema para crear orden de trabajo"""
    vehicle_id: int = 0
    tipo: str = "correctivo"
    prioridad: int = 3
    descripcion: str = ""
    plan_id: Optional[int] = None
    diagnostico: Optional[str] = None
    odometro_ingreso: Optional[float] = None
    fecha_prometida: Optional[str] = None
    proveedor_taller: Optional[str] = None
    tecnico_asignado: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if not self.vehicle_id:
            errors.append("vehicle_id es requerido")
        if self.tipo not in [e.value for e in WOTipo]:
            errors.append(f"tipo invalido: {self.tipo}")
        if not 1 <= self.prioridad <= 5:
            errors.append("prioridad debe estar entre 1 y 5")
        if not self.descripcion:
            errors.append("descripcion es requerida")
        return errors


@dataclass
class WOPartSchema:
    """Schema para agregar parte/repuesto a OT"""
    material_id: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad: float = 1
    costo_unitario: float = 0
    de_inventario: bool = False

    def validate(self) -> List[str]:
        errors = []
        if not self.material_id and not self.descripcion:
            errors.append("material_id o descripcion es requerido")
        if self.cantidad <= 0:
            errors.append("cantidad debe ser mayor a 0")
        return errors


@dataclass
class InspectionCreateSchema:
    """Schema para crear inspeccion"""
    vehicle_id: int = 0
    driver_id: int = 0
    tipo: str = "pre_trip"
    shipment_id: Optional[int] = None
    odometro: Optional[float] = None
    items: List[Dict[str, Any]] = field(default_factory=list)

    def validate(self) -> List[str]:
        errors = []
        if not self.vehicle_id:
            errors.append("vehicle_id es requerido")
        if not self.driver_id:
            errors.append("driver_id es requerido")
        if self.tipo not in ("pre_trip", "post_trip"):
            errors.append("tipo debe ser pre_trip o post_trip")
        return errors


# =============================================================================
# Helpers
# =============================================================================


def schema_to_dict(schema) -> dict:
    """Convierte un schema dataclass a dict filtrando None values."""
    return {k: v for k, v in asdict(schema).items() if v is not None}


# Default inspection checklist items
INSPECTION_CHECKLIST = [
    {"item": "Nivel de aceite motor", "categoria": "motor", "es_critico": True},
    {"item": "Nivel de refrigerante", "categoria": "motor", "es_critico": True},
    {"item": "Estado de llantas (presion y desgaste)", "categoria": "llantas", "es_critico": True},
    {"item": "Llanta de refaccion", "categoria": "llantas", "es_critico": False},
    {"item": "Luces delanteras", "categoria": "luces", "es_critico": True},
    {"item": "Luces traseras y de freno", "categoria": "luces", "es_critico": True},
    {"item": "Direccionales", "categoria": "luces", "es_critico": True},
    {"item": "Frenos (pedal firme)", "categoria": "frenos", "es_critico": True},
    {"item": "Freno de estacionamiento", "categoria": "frenos", "es_critico": True},
    {"item": "Espejos retrovisores", "categoria": "cabina", "es_critico": False},
    {"item": "Limpiadores parabrisas", "categoria": "cabina", "es_critico": False},
    {"item": "Cinturon de seguridad", "categoria": "cabina", "es_critico": True},
    {"item": "Extintor vigente", "categoria": "seguridad", "es_critico": True},
    {"item": "Botiquin primeros auxilios", "categoria": "seguridad", "es_critico": False},
    {"item": "Triagulos/conos de seguridad", "categoria": "seguridad", "es_critico": False},
    {"item": "Documentos del vehiculo", "categoria": "documentos", "es_critico": True},
    {"item": "Estado general de carroceria", "categoria": "carroceria", "es_critico": False},
    {"item": "Puertas de carga (sellado)", "categoria": "carga", "es_critico": False},
]
