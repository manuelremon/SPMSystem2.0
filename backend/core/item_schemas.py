"""
Schemas de validacion para items de solicitudes.

Sprint 3.2 - Validacion robusta con clases Python (sin Pydantic externo).

Valida:
- Estructura de items (campos requeridos, tipos)
- Reglas de negocio (cantidad > 0, precio >= 0)
- Existencia del material en catalogo
- Sanitizacion de datos
"""

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# =============================================================================
# Excepciones
# =============================================================================


class ItemValidationError(Exception):
    """Error de validacion en un item."""

    def __init__(self, message: str, field: Optional[str] = None):
        self.message = message
        self.field = field
        super().__init__(message)


class SolicitudValidationError(Exception):
    """Error de validacion en una solicitud."""

    def __init__(self, message: str, field: Optional[str] = None):
        self.message = message
        self.field = field
        super().__init__(message)


# =============================================================================
# Constantes
# =============================================================================


CRITICIDADES_VALIDAS = {"Baja", "Normal", "Alta", "Critica", "Urgente"}

# Tope de cantidad por item (evita totales desbordados a infinito)
CANTIDAD_MAXIMA = 1_000_000

# Cache codigo normalizado -> precio de catalogo (evita consultas repetidas).
# Vive lo que el proceso (se vacia al reiniciar el backend o con
# limpiar_cache_materiales()). Solo guarda materiales CON precio: los que no
# tienen precio se consultan siempre, asi un precio cargado despues se ve al
# instante. Un cambio de precio de un material ya cacheado (p. ej. migracion
# 104, que corre en otro proceso) requiere reiniciar el backend; el deploy lo hace.
_materiales_validados_cache: Dict[str, float] = {}

# Resultado de _precio_catalogo cuando la BD no responde
_PRECIO_NO_VERIFICABLE = object()

# Resultado de _precio_catalogo cuando el material existe pero no tiene precio
# de referencia (precio_usd NULL): no se puede solicitar hasta que se cargue
_SIN_PRECIO = object()


def _precio_catalogo(material_id: str):
    """
    Precio unitario (USD) del material segun el catalogo.

    Returns:
        float si el material existe y tiene precio, None si no existe,
        _SIN_PRECIO si existe sin precio (precio_usd NULL),
        _PRECIO_NO_VERIFICABLE si no se pudo consultar la BD.
    """
    if not material_id:
        return None

    # Normalizar codigo (eliminar ceros y .0 finales)
    codigo_norm = material_id.strip()
    if codigo_norm.endswith(".0"):
        codigo_norm = codigo_norm[:-2]
    codigo_norm = codigo_norm.lstrip("0")

    if codigo_norm in _materiales_validados_cache:
        return _materiales_validados_cache[codigo_norm]

    try:
        # Import diferido para evitar dependencias circulares
        from backend.core.db import get_db_connection

        sufijo = material_id.split("-")[-1] if "-" in material_id else material_id
        with get_db_connection("master_materiales") as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT precio_usd FROM catalogo_materiales
                WHERE codigo = ?
                   OR REPLACE(codigo, '-', '') = ?
                   OR LTRIM(REPLACE(codigo, '-', ''), '0') = ?
                   OR codigo = ?
                LIMIT 1
                """,
                (material_id, material_id.replace("-", ""), codigo_norm, sufijo),
            )
            row = cursor.fetchone()
    except Exception as e:
        logger.warning(f"Error consultando catalogo para material {material_id}: {e}")
        return _PRECIO_NO_VERIFICABLE

    if row is None:
        return None
    if row[0] is None:
        return _SIN_PRECIO  # no se cachea: un precio cargado despues se ve enseguida
    precio = round(float(row[0]), 2)
    _materiales_validados_cache[codigo_norm] = precio
    return precio


def limpiar_cache_materiales():
    """Limpia el cache de materiales validados."""
    global _materiales_validados_cache
    _materiales_validados_cache = {}


# =============================================================================
# Item de Solicitud
# =============================================================================


@dataclass
class ItemSolicitud:
    """
    Representa un item de una solicitud de materiales.

    Attributes:
        material_id: Codigo del material (requerido)
        cantidad: Cantidad solicitada (requerido, > 0)
        unidad: Unidad de medida (requerido)
        descripcion: Descripcion del material (opcional)
        precio_unitario: Precio por unidad (opcional, >= 0)
        almacen: Almacen de origen (opcional)
        centro: Centro de costo (opcional)
        observaciones: Notas adicionales (opcional)
    """

    material_id: str
    cantidad: float
    unidad: str
    descripcion: Optional[str] = None
    precio_unitario: Optional[float] = None
    almacen: Optional[str] = None
    centro: Optional[str] = None
    observaciones: Optional[str] = None

    def __post_init__(self):
        """Valida y sanitiza los datos despues de la inicializacion."""
        # Sanitizar strings (material_id puede llegar como numero)
        if isinstance(self.material_id, (int, float)) and not isinstance(self.material_id, bool):
            self.material_id = str(self.material_id)
        for campo in ("material_id", "unidad", "descripcion", "almacen", "centro", "observaciones"):
            valor = getattr(self, campo)
            if valor is not None and not isinstance(valor, str):
                raise ItemValidationError(f"{campo} debe ser texto", campo)
        self.material_id = (self.material_id or "").strip()
        self.unidad = (self.unidad or "").strip()

        if self.descripcion:
            self.descripcion = self.descripcion.strip()
        if self.almacen:
            self.almacen = self.almacen.strip()
        if self.centro:
            self.centro = self.centro.strip()
        if self.observaciones:
            self.observaciones = self.observaciones.strip()

        # Validar campos requeridos
        if not self.material_id:
            raise ItemValidationError("material_id es requerido", "material_id")

        if not self.unidad:
            raise ItemValidationError("unidad es requerida", "unidad")

        # Validar cantidad
        try:
            self.cantidad = float(self.cantidad)
        except (TypeError, ValueError):
            raise ItemValidationError("cantidad debe ser un numero", "cantidad")

        if not math.isfinite(self.cantidad) or self.cantidad <= 0:
            raise ItemValidationError("cantidad debe ser mayor a 0", "cantidad")
        if self.cantidad > CANTIDAD_MAXIMA:
            raise ItemValidationError(f"cantidad no puede superar {CANTIDAD_MAXIMA:,.0f}", "cantidad")

        # Validar precio
        if self.precio_unitario is not None:
            try:
                self.precio_unitario = float(self.precio_unitario)
            except (TypeError, ValueError):
                raise ItemValidationError("precio_unitario debe ser un numero", "precio_unitario")

            if not math.isfinite(self.precio_unitario) or self.precio_unitario < 0:
                raise ItemValidationError(
                    "precio_unitario no puede ser negativo", "precio_unitario"
                )

    @property
    def subtotal(self) -> float:
        """Calcula el subtotal del item (cantidad * precio_unitario)."""
        if self.precio_unitario is None:
            return 0.0
        return round(self.cantidad * self.precio_unitario, 2)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte el item a diccionario."""
        return {
            "material_id": self.material_id,
            "codigo": self.material_id,  # la UI (tablas de items, carrito) usa "codigo"
            "descripcion": self.descripcion,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
            "precio_unitario": self.precio_unitario,
            "almacen": self.almacen,
            "centro": self.centro,
            "observaciones": self.observaciones,
            "subtotal": self.subtotal,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ItemSolicitud":
        """Crea un item desde un diccionario."""
        if not isinstance(data, dict):
            raise ItemValidationError("Cada item debe ser un objeto", "item")
        # Accept both 'material_id' and 'codigo' for compatibility
        material_id = data.get("material_id") or data.get("codigo", "")
        return cls(
            material_id=material_id,
            cantidad=data.get("cantidad", 0),
            unidad=data.get("unidad", ""),
            descripcion=data.get("descripcion"),
            precio_unitario=data.get("precio_unitario"),
            almacen=data.get("almacen"),
            centro=data.get("centro"),
            observaciones=data.get("observaciones"),
        )


# =============================================================================
# Solicitud Create
# =============================================================================


@dataclass
class SolicitudCreate:
    """
    Schema para crear una nueva solicitud.

    Attributes:
        centro: Centro de costo (requerido)
        sector: Sector (requerido)
        justificacion: Justificacion de la solicitud (requerido)
        items: Lista de items (requerido, minimo 1)
        criticidad: Nivel de criticidad (default: Normal)
        almacen_virtual: Almacen virtual (opcional)
        centro_costos: Centro de costos (opcional)
        fecha_necesidad: Fecha limite (opcional)
    """

    centro: str
    sector: str
    justificacion: str
    items: List[ItemSolicitud] = field(default_factory=list)
    criticidad: str = "Normal"
    almacen_virtual: Optional[str] = None
    centro_costos: Optional[str] = None
    fecha_necesidad: Optional[str] = None

    def __post_init__(self):
        """Valida y procesa los datos despues de la inicializacion."""
        # Sanitizar strings
        self.centro = (self.centro or "").strip()
        self.sector = (self.sector or "").strip()
        self.justificacion = (self.justificacion or "").strip()
        self.criticidad = (self.criticidad or "Normal").strip()

        if self.almacen_virtual:
            self.almacen_virtual = self.almacen_virtual.strip()
        if self.centro_costos:
            self.centro_costos = self.centro_costos.strip()
        if self.fecha_necesidad:
            self.fecha_necesidad = self.fecha_necesidad.strip()

        # Validar campos requeridos
        if not self.centro:
            raise SolicitudValidationError("centro es requerido", "centro")

        if not self.sector:
            raise SolicitudValidationError("sector es requerido", "sector")

        # Validar criticidad
        if self.criticidad not in CRITICIDADES_VALIDAS:
            raise SolicitudValidationError(
                f"criticidad debe ser una de: {', '.join(CRITICIDADES_VALIDAS)}", "criticidad"
            )

        # Convertir items de dict a ItemSolicitud si es necesario
        items_procesados = []
        for item in self.items:
            if isinstance(item, dict):
                items_procesados.append(ItemSolicitud.from_dict(item))
            elif isinstance(item, ItemSolicitud):
                items_procesados.append(item)
            else:
                raise SolicitudValidationError(
                    "items debe ser una lista de diccionarios o ItemSolicitud"
                )

        self.items = items_procesados

        # Validar que haya al menos un item
        if not self.items:
            raise SolicitudValidationError("Se requiere al menos un item", "items")

    @property
    def total_monto(self) -> float:
        """Calcula el monto total de la solicitud."""
        return round(sum(item.subtotal for item in self.items), 2)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte la solicitud a diccionario."""
        return {
            "centro": self.centro,
            "sector": self.sector,
            "justificacion": self.justificacion,
            "criticidad": self.criticidad,
            "almacen_virtual": self.almacen_virtual,
            "centro_costos": self.centro_costos,
            "fecha_necesidad": self.fecha_necesidad,
            "items": [item.to_dict() for item in self.items],
            "total_monto": self.total_monto,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SolicitudCreate":
        """Crea una solicitud desde un diccionario."""
        return cls(
            centro=data.get("centro", ""),
            sector=data.get("sector", ""),
            justificacion=data.get("justificacion", ""),
            items=data.get("items", []),
            criticidad=data.get("criticidad", "Normal"),
            almacen_virtual=data.get("almacen_virtual"),
            centro_costos=data.get("centro_costos"),
            fecha_necesidad=data.get("fecha_necesidad"),
        )


# =============================================================================
# Solicitud Update
# =============================================================================


@dataclass
class SolicitudUpdate:
    """
    Schema para actualizar una solicitud existente.

    Todos los campos son opcionales.
    """

    items: Optional[List[ItemSolicitud]] = None
    justificacion: Optional[str] = None
    criticidad: Optional[str] = None
    almacen_virtual: Optional[str] = None
    centro_costos: Optional[str] = None
    fecha_necesidad: Optional[str] = None

    def __post_init__(self):
        """Valida y procesa los datos despues de la inicializacion."""
        # Sanitizar strings opcionales
        if self.justificacion is not None:
            self.justificacion = self.justificacion.strip()
        if self.criticidad is not None:
            self.criticidad = self.criticidad.strip()
            if self.criticidad and self.criticidad not in CRITICIDADES_VALIDAS:
                raise SolicitudValidationError(
                    f"criticidad debe ser una de: {', '.join(CRITICIDADES_VALIDAS)}", "criticidad"
                )
        if self.almacen_virtual is not None:
            self.almacen_virtual = self.almacen_virtual.strip()
        if self.centro_costos is not None:
            self.centro_costos = self.centro_costos.strip()
        if self.fecha_necesidad is not None:
            self.fecha_necesidad = self.fecha_necesidad.strip()

        # Procesar items si se proporcionan
        if self.items is not None:
            if isinstance(self.items, list) and len(self.items) == 0:
                raise SolicitudValidationError(
                    "items no puede estar vacio si se proporciona", "items"
                )

            items_procesados = []
            for item in self.items:
                if isinstance(item, dict):
                    items_procesados.append(ItemSolicitud.from_dict(item))
                elif isinstance(item, ItemSolicitud):
                    items_procesados.append(item)
                else:
                    raise SolicitudValidationError(
                        "items debe ser una lista de diccionarios o ItemSolicitud"
                    )

            self.items = items_procesados

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario (solo campos no None)."""
        result = {}
        if self.items is not None:
            result["items"] = [item.to_dict() for item in self.items]
        if self.justificacion is not None:
            result["justificacion"] = self.justificacion
        if self.criticidad is not None:
            result["criticidad"] = self.criticidad
        if self.almacen_virtual is not None:
            result["almacen_virtual"] = self.almacen_virtual
        if self.centro_costos is not None:
            result["centro_costos"] = self.centro_costos
        if self.fecha_necesidad is not None:
            result["fecha_necesidad"] = self.fecha_necesidad
        return result


# =============================================================================
# Funciones de Validacion
# =============================================================================


def validar_items(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Valida una lista de items y retorna el resultado.

    Args:
        items: Lista de diccionarios con datos de items

    Returns:
        Dict con resultado de validacion:
        {
            "ok": bool,
            "items": List[ItemSolicitud],  # Items validos
            "errores": List[Dict],  # Errores encontrados
            "items_validos": int,
            "total": float,
            "mensaje": str  # Si hay error general
        }
    """
    # Permitir lista vacía para borradores (los items se agregan después)
    if not items:
        return {
            "ok": True,
            "items": [],
            "errores": [],
            "items_validos": 0,
            "total": 0,
            "mensaje": "",
        }

    if not isinstance(items, list):
        return {
            "ok": False,
            "items": [],
            "errores": [{"indice": None, "campo": "items", "mensaje": "items debe ser una lista"}],
            "items_validos": 0,
            "total": 0,
            "mensaje": "items debe ser una lista",
        }

    items_validos = []
    errores = []

    for idx, item_data in enumerate(items):
        try:
            item = ItemSolicitud.from_dict(item_data)

            # El precio sale del catalogo, nunca del cliente
            precio = _precio_catalogo(item.material_id)
            if precio is None:
                errores.append(
                    {
                        "indice": idx,
                        "campo": "material_id",
                        "mensaje": f"Material '{item.material_id}' no existe en el catálogo",
                        "datos": item_data,
                    }
                )
                continue
            if precio is _SIN_PRECIO:
                errores.append(
                    {
                        "indice": idx,
                        "campo": "material_id",
                        "mensaje": (
                            f"El material {item.material_id} no tiene precio de referencia; "
                            "no se puede solicitar hasta que se cargue"
                        ),
                        "datos": item_data,
                    }
                )
                continue
            if precio is not _PRECIO_NO_VERIFICABLE:
                item.precio_unitario = precio

            items_validos.append(item)
        except ItemValidationError as e:
            errores.append(
                {"indice": idx, "campo": e.field, "mensaje": e.message, "datos": item_data}
            )

    total = round(sum(item.subtotal for item in items_validos), 2)

    return {
        "ok": len(errores) == 0,
        "items": items_validos,
        "errores": errores,
        "items_validos": len(items_validos),
        "total": total,
        "mensaje": (
            None if len(errores) == 0 else f"Se encontraron {len(errores)} errores de validacion"
        ),
    }


def validar_solicitud_create(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valida datos para crear una solicitud.

    Args:
        data: Diccionario con datos de la solicitud

    Returns:
        Dict con resultado de validacion:
        {
            "ok": bool,
            "solicitud": SolicitudCreate (si ok),
            "errores": List[str]
        }
    """
    errores = []

    try:
        solicitud = SolicitudCreate.from_dict(data)
        return {"ok": True, "solicitud": solicitud, "errores": []}
    except SolicitudValidationError as e:
        errores.append(f"{e.field}: {e.message}" if e.field else e.message)
    except ItemValidationError as e:
        errores.append(
            f"Item error - {e.field}: {e.message}" if e.field else f"Item error: {e.message}"
        )
    except Exception as e:
        errores.append(f"Error inesperado: {str(e)}")

    return {"ok": False, "solicitud": None, "errores": errores}


def validar_solicitud_update(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valida datos para actualizar una solicitud.

    Args:
        data: Diccionario con datos a actualizar

    Returns:
        Dict con resultado de validacion:
        {
            "ok": bool,
            "update": SolicitudUpdate (si ok),
            "errores": List[str]
        }
    """
    errores = []

    try:
        update = SolicitudUpdate(**data)
        return {"ok": True, "update": update, "errores": []}
    except SolicitudValidationError as e:
        errores.append(f"{e.field}: {e.message}" if e.field else e.message)
    except ItemValidationError as e:
        errores.append(
            f"Item error - {e.field}: {e.message}" if e.field else f"Item error: {e.message}"
        )
    except Exception as e:
        errores.append(f"Error inesperado: {str(e)}")

    return {"ok": False, "update": None, "errores": errores}
