"""
Tests para TMS/FMS schemas (backend/core/tms_schemas.py)

Verifica:
- Enums tienen valores esperados
- FSM transiciones son validas/invalidas
- Schemas de validacion funcionan correctamente
- Helpers (schema_to_dict) funcionan correctamente
"""

import sys
from pathlib import Path

import pytest

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from core.tms_schemas import (
    SHIPMENT_TRANSITIONS,
    WO_TRANSITIONS,
    DriverCreateSchema,
    DriverEstado,
    InspectionCreateSchema,
    RouteCreateSchema,
    ShipmentAssignSchema,
    ShipmentCreateSchema,
    ShipmentEstado,
    ShipmentItemSchema,
    ShipmentTipo,
    TariffRuleSchema,
    TipoCarga,
    TrackingEventoTipo,
    TrackingEventSchema,
    TripCostSchema,
    VehicleCreateSchema,
    VehicleEstado,
    VehicleTipo,
    WOEstado,
    WOPartSchema,
    WOTipo,
    WorkOrderCreateSchema,
    schema_to_dict,
    validar_transicion_shipment,
    validar_transicion_wo,
)


# =============================================================================
# Tests para Enums
# =============================================================================


class TestEnumsTMS:
    """Tests para Enums TMS"""

    def test_shipment_estado_valores(self):
        """ShipmentEstado tiene 10 estados"""
        assert ShipmentEstado.DRAFT.value == "draft"
        assert ShipmentEstado.CONFIRMED.value == "confirmed"
        assert ShipmentEstado.ASSIGNED.value == "assigned"
        assert ShipmentEstado.IN_TRANSIT.value == "in_transit"
        assert ShipmentEstado.DELIVERED.value == "delivered"
        assert ShipmentEstado.INCIDENT.value == "incident"
        assert ShipmentEstado.RESOLVED.value == "resolved"
        assert ShipmentEstado.SETTLED.value == "settled"
        assert ShipmentEstado.CLOSED.value == "closed"
        assert ShipmentEstado.CANCELLED.value == "cancelled"
        # Verificar que existen exactamente 10 estados
        assert len(ShipmentEstado) == 10

    def test_shipment_tipo_valores(self):
        """ShipmentTipo tiene tipos esperados"""
        assert ShipmentTipo.STANDARD.value == "standard"
        assert ShipmentTipo.EXPRESS.value == "express"
        assert ShipmentTipo.LTL.value == "ltl"
        assert ShipmentTipo.FTL.value == "ftl"
        assert ShipmentTipo.CONSOLIDADO.value == "consolidado"

    def test_tipo_carga_valores(self):
        """TipoCarga tiene categorias esperadas"""
        assert TipoCarga.GENERAL.value == "general"
        assert TipoCarga.PERECEDERO.value == "perecedero"
        assert TipoCarga.FRAGIL.value == "fragil"
        assert TipoCarga.PELIGROSO.value == "peligroso"
        assert TipoCarga.VALOR_ALTO.value == "valor_alto"

    def test_tracking_evento_tipo_valores(self):
        """TrackingEventoTipo tiene eventos esperados"""
        assert TrackingEventoTipo.SALIDA.value == "salida"
        assert TrackingEventoTipo.PARADA.value == "parada"
        assert TrackingEventoTipo.CARGA_COMBUSTIBLE.value == "carga_combustible"
        assert TrackingEventoTipo.CHECKPOINT.value == "checkpoint"
        assert TrackingEventoTipo.INCIDENCIA.value == "incidencia"
        assert TrackingEventoTipo.ENTREGA_PARCIAL.value == "entrega_parcial"
        assert TrackingEventoTipo.ENTREGA.value == "entrega"
        assert TrackingEventoTipo.POSICION.value == "posicion"
        assert TrackingEventoTipo.OTRO.value == "otro"


class TestEnumsFMS:
    """Tests para Enums FMS"""

    def test_vehicle_estado_valores(self):
        """VehicleEstado tiene estados esperados"""
        assert VehicleEstado.DISPONIBLE.value == "disponible"
        assert VehicleEstado.EN_RUTA.value == "en_ruta"
        assert VehicleEstado.EN_MANTENIMIENTO.value == "en_mantenimiento"
        assert VehicleEstado.FUERA_SERVICIO.value == "fuera_servicio"
        assert VehicleEstado.BAJA.value == "baja"

    def test_vehicle_tipo_valores(self):
        """VehicleTipo tiene tipos esperados"""
        assert VehicleTipo.CAMION.value == "camion"
        assert VehicleTipo.CAMIONETA.value == "camioneta"
        assert VehicleTipo.TRAILER.value == "trailer"
        assert VehicleTipo.VAN.value == "van"
        assert VehicleTipo.RABON.value == "rabon"
        assert VehicleTipo.TORTON.value == "torton"
        assert VehicleTipo.PIPA.value == "pipa"
        assert VehicleTipo.OTRO.value == "otro"

    def test_wo_estado_valores(self):
        """WOEstado tiene estados esperados"""
        assert WOEstado.DRAFT.value == "draft"
        assert WOEstado.APPROVED.value == "approved"
        assert WOEstado.IN_PROGRESS.value == "in_progress"
        assert WOEstado.PENDING_PARTS.value == "pending_parts"
        assert WOEstado.COMPLETED.value == "completed"
        assert WOEstado.CLOSED.value == "closed"
        assert WOEstado.CANCELLED.value == "cancelled"

    def test_wo_tipo_valores(self):
        """WOTipo tiene tipos esperados"""
        assert WOTipo.PREVENTIVO.value == "preventivo"
        assert WOTipo.CORRECTIVO.value == "correctivo"
        assert WOTipo.EMERGENCIA.value == "emergencia"

    def test_driver_estado_valores(self):
        """DriverEstado tiene estados esperados"""
        assert DriverEstado.ACTIVO.value == "activo"
        assert DriverEstado.INACTIVO.value == "inactivo"
        assert DriverEstado.VACACIONES.value == "vacaciones"
        assert DriverEstado.INCAPACIDAD.value == "incapacidad"
        assert DriverEstado.BAJA.value == "baja"


# =============================================================================
# Tests para FSM Transiciones
# =============================================================================


class TestShipmentTransitions:
    """Tests para transiciones de envio"""

    def test_transiciones_draft(self):
        """Draft puede ir a confirmed o cancelled"""
        assert SHIPMENT_TRANSITIONS["draft"] == ["confirmed", "cancelled"]

    def test_transiciones_confirmed(self):
        """Confirmed puede ir a assigned o cancelled"""
        assert SHIPMENT_TRANSITIONS["confirmed"] == ["assigned", "cancelled"]

    def test_transiciones_assigned(self):
        """Assigned puede ir a in_transit o cancelled"""
        assert SHIPMENT_TRANSITIONS["assigned"] == ["in_transit", "cancelled"]

    def test_transiciones_in_transit(self):
        """In_transit puede ir a delivered, incident o cancelled"""
        assert SHIPMENT_TRANSITIONS["in_transit"] == ["delivered", "incident", "cancelled"]

    def test_transiciones_incident(self):
        """Incident puede ir a resolved o cancelled"""
        assert SHIPMENT_TRANSITIONS["incident"] == ["resolved", "cancelled"]

    def test_transiciones_resolved(self):
        """Resolved puede volver a in_transit"""
        assert SHIPMENT_TRANSITIONS["resolved"] == ["in_transit"]

    def test_transiciones_delivered(self):
        """Delivered puede ir a settled"""
        assert SHIPMENT_TRANSITIONS["delivered"] == ["settled"]

    def test_transiciones_settled(self):
        """Settled puede ir a closed"""
        assert SHIPMENT_TRANSITIONS["settled"] == ["closed"]

    def test_estados_finales_no_tienen_transiciones(self):
        """Closed y cancelled no tienen transiciones"""
        assert SHIPMENT_TRANSITIONS["closed"] == []
        assert SHIPMENT_TRANSITIONS["cancelled"] == []

    def test_validar_transicion_valida(self):
        """Transiciones validas retornan True"""
        assert validar_transicion_shipment("draft", "confirmed") is True
        assert validar_transicion_shipment("confirmed", "assigned") is True
        assert validar_transicion_shipment("assigned", "in_transit") is True
        assert validar_transicion_shipment("in_transit", "delivered") is True
        assert validar_transicion_shipment("incident", "resolved") is True
        assert validar_transicion_shipment("resolved", "in_transit") is True

    def test_validar_transicion_invalida(self):
        """Transiciones invalidas retornan False"""
        assert validar_transicion_shipment("draft", "delivered") is False
        assert validar_transicion_shipment("closed", "draft") is False
        assert validar_transicion_shipment("cancelled", "confirmed") is False
        assert validar_transicion_shipment("delivered", "draft") is False
        assert validar_transicion_shipment("settled", "in_transit") is False

    def test_validar_transicion_estado_desconocido(self):
        """Estados desconocidos retornan False"""
        assert validar_transicion_shipment("invalid", "confirmed") is False
        assert validar_transicion_shipment("draft", "invalid") is False


class TestWOTransitions:
    """Tests para transiciones de orden de trabajo"""

    def test_transiciones_draft(self):
        """Draft puede ir a approved o cancelled"""
        assert WO_TRANSITIONS["draft"] == ["approved", "cancelled"]

    def test_transiciones_approved(self):
        """Approved puede ir a in_progress o cancelled"""
        assert WO_TRANSITIONS["approved"] == ["in_progress", "cancelled"]

    def test_transiciones_in_progress(self):
        """In_progress puede ir a pending_parts, completed o cancelled"""
        assert WO_TRANSITIONS["in_progress"] == ["pending_parts", "completed", "cancelled"]

    def test_transiciones_pending_parts(self):
        """Pending_parts puede volver a in_progress o cancelled"""
        assert WO_TRANSITIONS["pending_parts"] == ["in_progress", "cancelled"]

    def test_transiciones_completed(self):
        """Completed puede ir a closed"""
        assert WO_TRANSITIONS["completed"] == ["closed"]

    def test_estados_finales_wo_no_tienen_transiciones(self):
        """Closed y cancelled no tienen transiciones"""
        assert WO_TRANSITIONS["closed"] == []
        assert WO_TRANSITIONS["cancelled"] == []

    def test_validar_transicion_wo_valida(self):
        """Transiciones validas retornan True"""
        assert validar_transicion_wo("draft", "approved") is True
        assert validar_transicion_wo("approved", "in_progress") is True
        assert validar_transicion_wo("in_progress", "pending_parts") is True
        assert validar_transicion_wo("pending_parts", "in_progress") is True
        assert validar_transicion_wo("in_progress", "completed") is True
        assert validar_transicion_wo("completed", "closed") is True

    def test_validar_transicion_wo_invalida(self):
        """Transiciones invalidas retornan False"""
        assert validar_transicion_wo("draft", "completed") is False
        assert validar_transicion_wo("closed", "draft") is False
        assert validar_transicion_wo("cancelled", "approved") is False
        assert validar_transicion_wo("completed", "draft") is False

    def test_validar_transicion_wo_estado_desconocido(self):
        """Estados desconocidos retornan False"""
        assert validar_transicion_wo("invalid", "approved") is False
        assert validar_transicion_wo("draft", "invalid") is False


# =============================================================================
# Tests para Schemas TMS
# =============================================================================


class TestShipmentCreateSchema:
    """Tests para ShipmentCreateSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente con datos validos"""
        schema = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            tipo="standard",
            prioridad=3,
            items=[{"material_id": "M001", "cantidad": 10}],
        )
        assert schema.origen_centro_id == "C001"
        assert schema.destino_centro_id == "C002"
        assert schema.tipo == "standard"
        assert schema.prioridad == 3
        assert len(schema.items) == 1

    def test_validacion_origen_requerido(self):
        """Validacion falla si falta origen_centro_id"""
        schema = ShipmentCreateSchema(
            origen_centro_id="",
            destino_centro_id="C002",
            items=[{"material_id": "M001"}],
        )
        errors = schema.validate()
        assert "origen_centro_id es requerido" in errors

    def test_validacion_destino_requerido(self):
        """Validacion falla si falta destino_centro_id"""
        schema = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="",
            items=[{"material_id": "M001"}],
        )
        errors = schema.validate()
        assert "destino_centro_id es requerido" in errors

    def test_validacion_tipo_invalido(self):
        """Validacion falla con tipo invalido"""
        schema = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            tipo="invalid_type",
            items=[{"material_id": "M001"}],
        )
        errors = schema.validate()
        assert any("tipo invalido" in e for e in errors)

    def test_validacion_prioridad_invalida(self):
        """Validacion falla con prioridad fuera de rango"""
        schema1 = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            prioridad=0,
            items=[{"material_id": "M001"}],
        )
        errors1 = schema1.validate()
        assert "prioridad debe estar entre 1 y 5" in errors1

        schema2 = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            prioridad=6,
            items=[{"material_id": "M001"}],
        )
        errors2 = schema2.validate()
        assert "prioridad debe estar entre 1 y 5" in errors2

    def test_validacion_tipo_carga_invalido(self):
        """Validacion falla con tipo_carga invalido"""
        schema = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            tipo_carga="invalid_cargo",
            items=[{"material_id": "M001"}],
        )
        errors = schema.validate()
        assert any("tipo_carga invalido" in e for e in errors)

    def test_validacion_items_requeridos(self):
        """Validacion falla si no hay items"""
        schema = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            items=[],
        )
        errors = schema.validate()
        assert "Se requiere al menos un item" in errors


class TestShipmentAssignSchema:
    """Tests para ShipmentAssignSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = ShipmentAssignSchema(vehicle_id=1, driver_id=2, route_id=3)
        assert schema.vehicle_id == 1
        assert schema.driver_id == 2
        assert schema.route_id == 3

    def test_validacion_vehicle_requerido(self):
        """Validacion falla si falta vehicle_id"""
        schema = ShipmentAssignSchema(vehicle_id=0, driver_id=1)
        errors = schema.validate()
        assert "vehicle_id es requerido" in errors

    def test_validacion_driver_requerido(self):
        """Validacion falla si falta driver_id"""
        schema = ShipmentAssignSchema(vehicle_id=1, driver_id=0)
        errors = schema.validate()
        assert "driver_id es requerido" in errors


class TestTrackingEventSchema:
    """Tests para TrackingEventSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = TrackingEventSchema(
            evento_tipo="checkpoint",
            ubicacion_lat=19.4326,
            ubicacion_lng=-99.1332,
            ubicacion_nombre="CDMX",
        )
        assert schema.evento_tipo == "checkpoint"
        assert schema.ubicacion_lat == 19.4326

    def test_validacion_evento_tipo_invalido(self):
        """Validacion falla con evento_tipo invalido"""
        schema = TrackingEventSchema(evento_tipo="invalid_event")
        errors = schema.validate()
        assert any("evento_tipo invalido" in e for e in errors)

    def test_validacion_evento_tipo_valido(self):
        """Validacion pasa con evento_tipo valido"""
        for evento in ["salida", "parada", "entrega", "checkpoint", "otro"]:
            schema = TrackingEventSchema(evento_tipo=evento)
            errors = schema.validate()
            assert len(errors) == 0


class TestTripCostSchema:
    """Tests para TripCostSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = TripCostSchema(
            concepto="Combustible", monto=500.0, moneda="MXN"
        )
        assert schema.concepto == "Combustible"
        assert schema.monto == 500.0
        assert schema.moneda == "MXN"

    def test_validacion_concepto_requerido(self):
        """Validacion falla si falta concepto"""
        schema = TripCostSchema(concepto="", monto=100.0)
        errors = schema.validate()
        assert "concepto es requerido" in errors

    def test_validacion_monto_debe_ser_positivo(self):
        """Validacion falla si monto es <= 0"""
        schema = TripCostSchema(concepto="Test", monto=0)
        errors = schema.validate()
        assert "monto debe ser mayor a 0" in errors

        schema2 = TripCostSchema(concepto="Test", monto=-100)
        errors2 = schema2.validate()
        assert "monto debe ser mayor a 0" in errors2

    def test_validacion_moneda_invalida(self):
        """Validacion falla con moneda invalida"""
        schema = TripCostSchema(concepto="Test", monto=100, moneda="JPY")
        errors = schema.validate()
        assert "moneda debe ser USD, MXN o EUR" in errors

    def test_validacion_moneda_valida(self):
        """Validacion pasa con monedas validas"""
        for moneda in ["USD", "MXN", "EUR"]:
            schema = TripCostSchema(concepto="Test", monto=100, moneda=moneda)
            errors = schema.validate()
            assert len(errors) == 0


class TestRouteCreateSchema:
    """Tests para RouteCreateSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = RouteCreateSchema(
            nombre="Ruta 1",
            origen_centro_id="C001",
            destino_centro_id="C002",
            tipo_via="carretera",
        )
        assert schema.nombre == "Ruta 1"
        assert schema.tipo_via == "carretera"

    def test_validacion_nombre_requerido(self):
        """Validacion falla si falta nombre"""
        schema = RouteCreateSchema(
            nombre="", origen_centro_id="C001", destino_centro_id="C002"
        )
        errors = schema.validate()
        assert "nombre es requerido" in errors

    def test_validacion_origen_requerido(self):
        """Validacion falla si falta origen_centro_id"""
        schema = RouteCreateSchema(
            nombre="Ruta", origen_centro_id="", destino_centro_id="C002"
        )
        errors = schema.validate()
        assert "origen_centro_id es requerido" in errors

    def test_validacion_destino_requerido(self):
        """Validacion falla si falta destino_centro_id"""
        schema = RouteCreateSchema(
            nombre="Ruta", origen_centro_id="C001", destino_centro_id=""
        )
        errors = schema.validate()
        assert "destino_centro_id es requerido" in errors

    def test_validacion_tipo_via_invalido(self):
        """Validacion falla con tipo_via invalido"""
        schema = RouteCreateSchema(
            nombre="Ruta",
            origen_centro_id="C001",
            destino_centro_id="C002",
            tipo_via="invalid",
        )
        errors = schema.validate()
        assert any("tipo_via invalido" in e for e in errors)

    def test_validacion_tipo_via_valido(self):
        """Validacion pasa con tipo_via valido"""
        for tipo_via in ["carretera", "autopista", "mixta", "urbana"]:
            schema = RouteCreateSchema(
                nombre="Ruta",
                origen_centro_id="C001",
                destino_centro_id="C002",
                tipo_via=tipo_via,
            )
            errors = schema.validate()
            assert len(errors) == 0


# =============================================================================
# Tests para Schemas FMS
# =============================================================================


class TestVehicleCreateSchema:
    """Tests para VehicleCreateSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = VehicleCreateSchema(
            placa="ABC123", tipo="camion", marca="Volvo", modelo="FH"
        )
        assert schema.placa == "ABC123"
        assert schema.tipo == "camion"
        assert schema.marca == "Volvo"

    def test_validacion_placa_requerida(self):
        """Validacion falla si falta placa"""
        schema = VehicleCreateSchema(placa="", tipo="camion")
        errors = schema.validate()
        assert "placa es requerida" in errors

    def test_validacion_tipo_invalido(self):
        """Validacion falla con tipo invalido"""
        schema = VehicleCreateSchema(placa="ABC123", tipo="invalid_type")
        errors = schema.validate()
        assert any("tipo invalido" in e for e in errors)

    def test_validacion_tipo_valido(self):
        """Validacion pasa con tipo valido"""
        for tipo in ["camion", "camioneta", "trailer", "van", "otro"]:
            schema = VehicleCreateSchema(placa="ABC123", tipo=tipo)
            errors = schema.validate()
            assert len(errors) == 0


class TestDriverCreateSchema:
    """Tests para DriverCreateSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = DriverCreateSchema(
            nombre="Juan", apellido="Perez", tipo_licencia="federal"
        )
        assert schema.nombre == "Juan"
        assert schema.apellido == "Perez"
        assert schema.tipo_licencia == "federal"

    def test_validacion_nombre_requerido(self):
        """Validacion falla si falta nombre"""
        schema = DriverCreateSchema(nombre="")
        errors = schema.validate()
        assert "nombre es requerido" in errors

    def test_validacion_tipo_licencia_invalido(self):
        """Validacion falla con tipo_licencia invalido"""
        schema = DriverCreateSchema(nombre="Juan", tipo_licencia="invalid")
        errors = schema.validate()
        assert any("tipo_licencia invalido" in e for e in errors)

    def test_validacion_tipo_licencia_valido(self):
        """Validacion pasa con tipo_licencia valido"""
        for tipo in ["A", "B", "C", "D", "E", "federal"]:
            schema = DriverCreateSchema(nombre="Juan", tipo_licencia=tipo)
            errors = schema.validate()
            assert len(errors) == 0

    def test_validacion_tipo_licencia_none(self):
        """Validacion pasa si tipo_licencia es None"""
        schema = DriverCreateSchema(nombre="Juan", tipo_licencia=None)
        errors = schema.validate()
        assert len(errors) == 0


class TestWorkOrderCreateSchema:
    """Tests para WorkOrderCreateSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = WorkOrderCreateSchema(
            vehicle_id=1,
            tipo="correctivo",
            prioridad=2,
            descripcion="Cambio de aceite",
        )
        assert schema.vehicle_id == 1
        assert schema.tipo == "correctivo"
        assert schema.descripcion == "Cambio de aceite"

    def test_validacion_vehicle_id_requerido(self):
        """Validacion falla si falta vehicle_id"""
        schema = WorkOrderCreateSchema(
            vehicle_id=0, tipo="correctivo", descripcion="Test"
        )
        errors = schema.validate()
        assert "vehicle_id es requerido" in errors

    def test_validacion_tipo_invalido(self):
        """Validacion falla con tipo invalido"""
        schema = WorkOrderCreateSchema(
            vehicle_id=1, tipo="invalid", descripcion="Test"
        )
        errors = schema.validate()
        assert any("tipo invalido" in e for e in errors)

    def test_validacion_prioridad_invalida(self):
        """Validacion falla con prioridad fuera de rango"""
        schema1 = WorkOrderCreateSchema(
            vehicle_id=1, tipo="correctivo", prioridad=0, descripcion="Test"
        )
        errors1 = schema1.validate()
        assert "prioridad debe estar entre 1 y 5" in errors1

        schema2 = WorkOrderCreateSchema(
            vehicle_id=1, tipo="correctivo", prioridad=6, descripcion="Test"
        )
        errors2 = schema2.validate()
        assert "prioridad debe estar entre 1 y 5" in errors2

    def test_validacion_descripcion_requerida(self):
        """Validacion falla si falta descripcion"""
        schema = WorkOrderCreateSchema(
            vehicle_id=1, tipo="correctivo", descripcion=""
        )
        errors = schema.validate()
        assert "descripcion es requerida" in errors

    def test_validacion_tipo_valido(self):
        """Validacion pasa con tipo valido"""
        for tipo in ["preventivo", "correctivo", "emergencia"]:
            schema = WorkOrderCreateSchema(
                vehicle_id=1, tipo=tipo, descripcion="Test"
            )
            errors = schema.validate()
            assert len(errors) == 0


class TestInspectionCreateSchema:
    """Tests para InspectionCreateSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = InspectionCreateSchema(
            vehicle_id=1, driver_id=2, tipo="pre_trip"
        )
        assert schema.vehicle_id == 1
        assert schema.driver_id == 2
        assert schema.tipo == "pre_trip"

    def test_validacion_vehicle_id_requerido(self):
        """Validacion falla si falta vehicle_id"""
        schema = InspectionCreateSchema(vehicle_id=0, driver_id=1, tipo="pre_trip")
        errors = schema.validate()
        assert "vehicle_id es requerido" in errors

    def test_validacion_driver_id_requerido(self):
        """Validacion falla si falta driver_id"""
        schema = InspectionCreateSchema(vehicle_id=1, driver_id=0, tipo="pre_trip")
        errors = schema.validate()
        assert "driver_id es requerido" in errors

    def test_validacion_tipo_invalido(self):
        """Validacion falla con tipo invalido"""
        schema = InspectionCreateSchema(
            vehicle_id=1, driver_id=2, tipo="invalid"
        )
        errors = schema.validate()
        assert "tipo debe ser pre_trip o post_trip" in errors

    def test_validacion_tipo_valido(self):
        """Validacion pasa con tipo valido"""
        for tipo in ["pre_trip", "post_trip"]:
            schema = InspectionCreateSchema(
                vehicle_id=1, driver_id=2, tipo=tipo
            )
            errors = schema.validate()
            assert len(errors) == 0


class TestWOPartSchema:
    """Tests para WOPartSchema"""

    def test_validacion_material_o_descripcion_requerido(self):
        """Validacion falla si falta material_id y descripcion"""
        schema = WOPartSchema(cantidad=1)
        errors = schema.validate()
        assert "material_id o descripcion es requerido" in errors

    def test_validacion_cantidad_invalida(self):
        """Validacion falla si cantidad es <= 0"""
        schema = WOPartSchema(material_id="M001", cantidad=0)
        errors = schema.validate()
        assert "cantidad debe ser mayor a 0" in errors

        schema2 = WOPartSchema(material_id="M001", cantidad=-5)
        errors2 = schema2.validate()
        assert "cantidad debe ser mayor a 0" in errors2

    def test_validacion_con_material_id(self):
        """Validacion pasa con material_id"""
        schema = WOPartSchema(material_id="M001", cantidad=1)
        errors = schema.validate()
        assert len(errors) == 0

    def test_validacion_con_descripcion(self):
        """Validacion pasa con descripcion"""
        schema = WOPartSchema(descripcion="Filtro de aceite", cantidad=2)
        errors = schema.validate()
        assert len(errors) == 0


class TestTariffRuleSchema:
    """Tests para TariffRuleSchema"""

    def test_creacion_valida(self):
        """Schema se crea correctamente"""
        schema = TariffRuleSchema(
            nombre="Tarifa CDMX-GDL",
            tarifa_base_km=15.0,
            tarifa_peso_kg=0.5,
        )
        assert schema.nombre == "Tarifa CDMX-GDL"
        assert schema.tarifa_base_km == 15.0

    def test_validacion_nombre_requerido(self):
        """Validacion falla si falta nombre"""
        schema = TariffRuleSchema(nombre="")
        errors = schema.validate()
        assert "nombre es requerido" in errors


# =============================================================================
# Tests para Helpers
# =============================================================================


class TestSchemaToDict:
    """Tests para helper schema_to_dict"""

    def test_filtra_none_values(self):
        """schema_to_dict filtra valores None"""
        schema = DriverCreateSchema(
            nombre="Juan",
            apellido=None,
            tipo_licencia=None,
        )
        result = schema_to_dict(schema)
        assert "nombre" in result
        assert result["nombre"] == "Juan"
        assert "apellido" not in result
        assert "tipo_licencia" not in result

    def test_mantiene_valores_no_none(self):
        """schema_to_dict mantiene valores no-None"""
        schema = VehicleCreateSchema(
            placa="ABC123",
            tipo="camion",
            marca="Volvo",
            modelo="FH",
            anio=2020,
        )
        result = schema_to_dict(schema)
        assert result["placa"] == "ABC123"
        assert result["tipo"] == "camion"
        assert result["marca"] == "Volvo"
        assert result["modelo"] == "FH"
        assert result["anio"] == 2020

    def test_mantiene_valores_falsy_no_none(self):
        """schema_to_dict mantiene False, 0, string vacio (no son None)"""
        schema = VehicleCreateSchema(
            placa="ABC123",
            tipo="camion",
            capacidad_peso_kg=0,  # 0 no es None
            cadena_frio=False,  # False no es None
        )
        result = schema_to_dict(schema)
        assert "capacidad_peso_kg" in result
        assert result["capacidad_peso_kg"] == 0
        assert "cadena_frio" in result
        assert result["cadena_frio"] is False

    def test_con_schema_complejo(self):
        """schema_to_dict funciona con schemas complejos"""
        schema = ShipmentCreateSchema(
            origen_centro_id="C001",
            destino_centro_id="C002",
            tipo="standard",
            prioridad=3,
            fecha_programada=None,
            instrucciones="Entregar en la mañana",
            items=[{"material_id": "M001", "cantidad": 5}],
        )
        result = schema_to_dict(schema)
        assert result["origen_centro_id"] == "C001"
        assert result["instrucciones"] == "Entregar en la mañana"
        assert "fecha_programada" not in result  # None fue filtrado
        assert len(result["items"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
