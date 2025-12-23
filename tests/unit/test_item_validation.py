"""
Tests TDD para validacion de items de solicitudes.
Sprint 3.1 - Crear tests antes de implementacion.

Valida:
- Estructura de items (campos requeridos, tipos)
- Reglas de negocio (cantidad > 0, precio >= 0)
- Sanitizacion de datos
"""

import pytest


class TestItemSchema:
    """Tests para el schema de un item de solicitud."""

    def test_item_valido_con_campos_minimos(self):
        """Un item con campos minimos debe ser valido."""
        from backend.core.item_schemas import ItemSolicitud

        item = ItemSolicitud(material_id="MAT001", cantidad=10, unidad="UN")

        assert item.material_id == "MAT001"
        assert item.cantidad == 10
        assert item.unidad == "UN"

    def test_item_valido_con_todos_los_campos(self):
        """Un item con todos los campos debe ser valido."""
        from backend.core.item_schemas import ItemSolicitud

        item = ItemSolicitud(
            material_id="MAT001",
            descripcion="Material de prueba",
            cantidad=10,
            unidad="UN",
            precio_unitario=100.50,
            almacen="1000",
            centro="1008",
            observaciones="Urgente",
        )

        assert item.material_id == "MAT001"
        assert item.descripcion == "Material de prueba"
        assert item.cantidad == 10
        assert item.precio_unitario == 100.50

    def test_item_cantidad_cero_invalido(self):
        """Cantidad cero debe ser invalida."""
        from backend.core.item_schemas import (ItemSolicitud,
                                               ItemValidationError)

        with pytest.raises(ItemValidationError) as exc:
            ItemSolicitud(material_id="MAT001", cantidad=0, unidad="UN")

        assert "cantidad" in str(exc.value).lower()

    def test_item_cantidad_negativa_invalido(self):
        """Cantidad negativa debe ser invalida."""
        from backend.core.item_schemas import (ItemSolicitud,
                                               ItemValidationError)

        with pytest.raises(ItemValidationError):
            ItemSolicitud(material_id="MAT001", cantidad=-5, unidad="UN")

    def test_item_precio_negativo_invalido(self):
        """Precio negativo debe ser invalido."""
        from backend.core.item_schemas import (ItemSolicitud,
                                               ItemValidationError)

        with pytest.raises(ItemValidationError):
            ItemSolicitud(material_id="MAT001", cantidad=10, unidad="UN", precio_unitario=-100)

    def test_item_sin_material_id_invalido(self):
        """Item sin material_id debe ser invalido."""
        from backend.core.item_schemas import (ItemSolicitud,
                                               ItemValidationError)

        with pytest.raises(ItemValidationError):
            ItemSolicitud(material_id="", cantidad=10, unidad="UN")

    def test_item_sin_unidad_invalido(self):
        """Item sin unidad debe ser invalido."""
        from backend.core.item_schemas import (ItemSolicitud,
                                               ItemValidationError)

        with pytest.raises(ItemValidationError):
            ItemSolicitud(material_id="MAT001", cantidad=10, unidad="")

    def test_item_calcula_subtotal(self):
        """El item debe calcular el subtotal correctamente."""
        from backend.core.item_schemas import ItemSolicitud

        item = ItemSolicitud(material_id="MAT001", cantidad=5, unidad="UN", precio_unitario=100.00)

        assert item.subtotal == 500.00

    def test_item_subtotal_sin_precio_es_cero(self):
        """Sin precio unitario, el subtotal debe ser cero."""
        from backend.core.item_schemas import ItemSolicitud

        item = ItemSolicitud(material_id="MAT001", cantidad=5, unidad="UN")

        assert item.subtotal == 0

    def test_item_sanitiza_espacios(self):
        """El item debe limpiar espacios en strings."""
        from backend.core.item_schemas import ItemSolicitud

        item = ItemSolicitud(
            material_id="  MAT001  ",
            descripcion="  Descripcion con espacios  ",
            cantidad=10,
            unidad="  UN  ",
        )

        assert item.material_id == "MAT001"
        assert item.descripcion == "Descripcion con espacios"
        assert item.unidad == "UN"


class TestSolicitudCreate:
    """Tests para el schema de creacion de solicitud."""

    def test_solicitud_valida_con_items(self):
        """Una solicitud con items validos debe ser valida."""
        from backend.core.item_schemas import SolicitudCreate

        solicitud = SolicitudCreate(
            centro="1008",
            sector="Operaciones",
            justificacion="Reposicion de stock",
            items=[
                {"material_id": "MAT001", "cantidad": 10, "unidad": "UN"},
                {"material_id": "MAT002", "cantidad": 5, "unidad": "KG"},
            ],
        )

        assert solicitud.centro == "1008"
        assert len(solicitud.items) == 2

    def test_solicitud_sin_items_invalida(self):
        """Una solicitud sin items debe ser invalida."""
        from backend.core.item_schemas import (SolicitudCreate,
                                               SolicitudValidationError)

        with pytest.raises(SolicitudValidationError) as exc:
            SolicitudCreate(centro="1008", sector="Operaciones", justificacion="Test", items=[])

        assert "item" in str(exc.value).lower()

    def test_solicitud_sin_centro_invalida(self):
        """Una solicitud sin centro debe ser invalida."""
        from backend.core.item_schemas import (SolicitudCreate,
                                               SolicitudValidationError)

        with pytest.raises(SolicitudValidationError):
            SolicitudCreate(
                centro="",
                sector="Operaciones",
                justificacion="Test",
                items=[{"material_id": "MAT001", "cantidad": 10, "unidad": "UN"}],
            )

    def test_solicitud_sin_sector_invalida(self):
        """Una solicitud sin sector debe ser invalida."""
        from backend.core.item_schemas import (SolicitudCreate,
                                               SolicitudValidationError)

        with pytest.raises(SolicitudValidationError):
            SolicitudCreate(
                centro="1008",
                sector="",
                justificacion="Test",
                items=[{"material_id": "MAT001", "cantidad": 10, "unidad": "UN"}],
            )

    def test_solicitud_calcula_total(self):
        """La solicitud debe calcular el total correctamente."""
        from backend.core.item_schemas import SolicitudCreate

        solicitud = SolicitudCreate(
            centro="1008",
            sector="Operaciones",
            justificacion="Test",
            items=[
                {"material_id": "MAT001", "cantidad": 10, "unidad": "UN", "precio_unitario": 100},
                {"material_id": "MAT002", "cantidad": 5, "unidad": "KG", "precio_unitario": 50},
            ],
        )

        assert solicitud.total_monto == 1250.00  # (10*100) + (5*50)

    def test_solicitud_criticidad_default(self):
        """La criticidad por defecto debe ser 'Normal'."""
        from backend.core.item_schemas import SolicitudCreate

        solicitud = SolicitudCreate(
            centro="1008",
            sector="Operaciones",
            justificacion="Test",
            items=[{"material_id": "MAT001", "cantidad": 10, "unidad": "UN"}],
        )

        assert solicitud.criticidad == "Normal"

    def test_solicitud_criticidad_valores_validos(self):
        """Solo valores validos de criticidad deben aceptarse."""
        from backend.core.item_schemas import SolicitudCreate

        # Valores validos
        for criticidad in ["Baja", "Normal", "Alta", "Urgente"]:
            solicitud = SolicitudCreate(
                centro="1008",
                sector="Operaciones",
                justificacion="Test",
                criticidad=criticidad,
                items=[{"material_id": "MAT001", "cantidad": 10, "unidad": "UN"}],
            )
            assert solicitud.criticidad == criticidad

    def test_solicitud_criticidad_invalida(self):
        """Criticidad invalida debe rechazarse."""
        from backend.core.item_schemas import (SolicitudCreate,
                                               SolicitudValidationError)

        with pytest.raises(SolicitudValidationError):
            SolicitudCreate(
                centro="1008",
                sector="Operaciones",
                justificacion="Test",
                criticidad="SuperUrgente",  # No valido
                items=[{"material_id": "MAT001", "cantidad": 10, "unidad": "UN"}],
            )


class TestSolicitudUpdate:
    """Tests para el schema de actualizacion de solicitud."""

    def test_update_solo_items(self):
        """Debe poder actualizar solo los items."""
        from backend.core.item_schemas import SolicitudUpdate

        update = SolicitudUpdate(items=[{"material_id": "MAT001", "cantidad": 20, "unidad": "UN"}])

        assert len(update.items) == 1
        assert update.items[0].cantidad == 20

    def test_update_solo_justificacion(self):
        """Debe poder actualizar solo la justificacion."""
        from backend.core.item_schemas import SolicitudUpdate

        update = SolicitudUpdate(justificacion="Nueva justificacion")

        assert update.justificacion == "Nueva justificacion"
        assert update.items is None

    def test_update_parcial_valido(self):
        """Actualizaciones parciales deben ser validas."""
        from backend.core.item_schemas import SolicitudUpdate

        update = SolicitudUpdate(criticidad="Alta", fecha_necesidad="2025-01-15")

        assert update.criticidad == "Alta"
        assert update.fecha_necesidad == "2025-01-15"

    def test_update_items_vacios_invalido(self):
        """Si se envian items, no pueden estar vacios."""
        from backend.core.item_schemas import (SolicitudUpdate,
                                               SolicitudValidationError)

        with pytest.raises(SolicitudValidationError):
            SolicitudUpdate(items=[])


class TestValidarItems:
    """Tests para la funcion de validacion de lista de items."""

    def test_validar_items_validos(self):
        """Lista de items validos debe pasar validacion."""
        from backend.core.item_schemas import validar_items

        items = [
            {"material_id": "MAT001", "cantidad": 10, "unidad": "UN"},
            {"material_id": "MAT002", "cantidad": 5, "unidad": "KG", "precio_unitario": 100},
        ]

        resultado = validar_items(items)

        assert resultado["ok"] is True
        assert len(resultado["items"]) == 2

    def test_validar_items_con_error(self):
        """Items con errores deben reportarse."""
        from backend.core.item_schemas import validar_items

        items = [
            {"material_id": "MAT001", "cantidad": 10, "unidad": "UN"},
            {"material_id": "MAT002", "cantidad": -5, "unidad": "KG"},  # Error
            {"material_id": "", "cantidad": 5, "unidad": "UN"},  # Error
        ]

        resultado = validar_items(items)

        assert resultado["ok"] is False
        assert len(resultado["errores"]) == 2
        assert resultado["items_validos"] == 1

    def test_validar_items_lista_vacia(self):
        """Lista vacia es permitida para borradores (items se agregan después)."""
        from backend.core.item_schemas import validar_items

        resultado = validar_items([])

        # Lista vacía es válida para borradores
        assert resultado["ok"] is True
        assert resultado["items_validos"] == 0
        assert resultado["total"] == 0

    def test_validar_items_calcula_total(self):
        """Debe calcular el total de items validos."""
        from backend.core.item_schemas import validar_items

        items = [
            {"material_id": "MAT001", "cantidad": 10, "unidad": "UN", "precio_unitario": 100},
            {"material_id": "MAT002", "cantidad": 5, "unidad": "KG", "precio_unitario": 50},
        ]

        resultado = validar_items(items)

        assert resultado["total"] == 1250.00


class TestFromDict:
    """Tests para conversion de diccionarios a schemas."""

    def test_item_from_dict(self):
        """Debe poder crear item desde diccionario."""
        from backend.core.item_schemas import ItemSolicitud

        data = {
            "material_id": "MAT001",
            "descripcion": "Test",
            "cantidad": 10,
            "unidad": "UN",
            "precio_unitario": 100,
        }

        item = ItemSolicitud.from_dict(data)

        assert item.material_id == "MAT001"
        assert item.cantidad == 10

    def test_item_to_dict(self):
        """Debe poder convertir item a diccionario."""
        from backend.core.item_schemas import ItemSolicitud

        item = ItemSolicitud(material_id="MAT001", cantidad=10, unidad="UN", precio_unitario=100)

        data = item.to_dict()

        assert data["material_id"] == "MAT001"
        assert data["cantidad"] == 10
        assert data["subtotal"] == 1000

    def test_solicitud_from_dict(self):
        """Debe poder crear solicitud desde diccionario."""
        from backend.core.item_schemas import SolicitudCreate

        data = {
            "centro": "1008",
            "sector": "Operaciones",
            "justificacion": "Test",
            "items": [{"material_id": "MAT001", "cantidad": 10, "unidad": "UN"}],
        }

        solicitud = SolicitudCreate.from_dict(data)

        assert solicitud.centro == "1008"
        assert len(solicitud.items) == 1
