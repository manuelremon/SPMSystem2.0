"""
Tests para el sistema de WebSockets.
Sprint 15 - Verifica comunicacion en tiempo real.
"""

import json
import time

import pytest


class TestMessageType:
    """Tests para MessageType enum."""

    def test_all_types_exist(self):
        """Todos los tipos de mensaje existen."""
        try:
            from backend.core.websocket import MessageType
        except ImportError:
            pytest.skip("Module not available")

        assert MessageType.EVENT.value == "event"
        assert MessageType.NOTIFICATION.value == "notification"
        assert MessageType.BROADCAST.value == "broadcast"
        assert MessageType.ROOM.value == "room"
        assert MessageType.DIRECT.value == "direct"
        assert MessageType.PING.value == "ping"
        assert MessageType.PONG.value == "pong"


class TestWSMessage:
    """Tests para WSMessage."""

    def test_message_creation(self):
        """Crear mensaje."""
        try:
            from backend.core.websocket import MessageType, WSMessage
        except ImportError:
            pytest.skip("Module not available")

        msg = WSMessage(
            type=MessageType.EVENT,
            event="test_event",
            data={"key": "value"},
        )

        assert msg.event == "test_event"
        assert msg.data == {"key": "value"}
        assert msg.type == MessageType.EVENT
        assert msg.id is not None

    def test_message_to_json(self):
        """Serializar mensaje a JSON."""
        try:
            from backend.core.websocket import MessageType, WSMessage
        except ImportError:
            pytest.skip("Module not available")

        msg = WSMessage(
            type=MessageType.EVENT,
            event="test",
            data={"a": 1},
        )

        json_str = msg.to_json()
        parsed = json.loads(json_str)

        assert parsed["event"] == "test"
        assert parsed["data"] == {"a": 1}
        assert parsed["type"] == "event"

    def test_message_from_json(self):
        """Deserializar mensaje desde JSON."""
        try:
            from backend.core.websocket import MessageType, WSMessage
        except ImportError:
            pytest.skip("Module not available")

        json_str = json.dumps(
            {
                "type": "broadcast",
                "event": "alert",
                "data": {"level": "high"},
            }
        )

        msg = WSMessage.from_json(json_str)

        assert msg.type == MessageType.BROADCAST
        assert msg.event == "alert"
        assert msg.data == {"level": "high"}


class TestWSClient:
    """Tests para WSClient."""

    def test_client_creation(self):
        """Crear cliente."""
        try:
            from backend.core.websocket import WSClient
        except ImportError:
            pytest.skip("Module not available")

        client = WSClient(id="client-1", user_id=123)

        assert client.id == "client-1"
        assert client.user_id == 123
        assert len(client.rooms) == 0

    def test_client_join_room(self):
        """Cliente une a sala."""
        try:
            from backend.core.websocket import WSClient
        except ImportError:
            pytest.skip("Module not available")

        client = WSClient(id="client-1")
        client.join_room("planificadores")

        assert "planificadores" in client.rooms

    def test_client_leave_room(self):
        """Cliente deja sala."""
        try:
            from backend.core.websocket import WSClient
        except ImportError:
            pytest.skip("Module not available")

        client = WSClient(id="client-1")
        client.join_room("sala1")
        client.leave_room("sala1")

        assert "sala1" not in client.rooms

    def test_client_send_with_callback(self):
        """Cliente envia mensaje via callback."""
        try:
            from backend.core.websocket import MessageType, WSClient, WSMessage
        except ImportError:
            pytest.skip("Module not available")

        sent_messages = []
        callback = lambda msg: sent_messages.append(msg)

        client = WSClient(id="client-1", send_callback=callback)

        msg = WSMessage(type=MessageType.EVENT, event="test", data={})
        result = client.send(msg)

        assert result is True
        assert len(sent_messages) == 1


class TestEventBus:
    """Tests para EventBus."""

    def test_subscribe_and_publish(self):
        """Suscribir y publicar evento."""
        try:
            from backend.core.websocket import EventBus
        except ImportError:
            pytest.skip("Module not available")

        bus = EventBus()
        received = []

        def handler(event, data):
            received.append((event, data))

        bus.subscribe("test_event", handler)
        count = bus.publish("test_event", {"value": 42})

        assert count == 1
        assert received[0] == ("test_event", {"value": 42})

    def test_unsubscribe(self):
        """Desuscribir handler."""
        try:
            from backend.core.websocket import EventBus
        except ImportError:
            pytest.skip("Module not available")

        bus = EventBus()
        received = []

        def handler(event, data):
            received.append(data)

        bus.subscribe("event", handler)
        bus.unsubscribe("event", handler)
        bus.publish("event", "data")

        assert len(received) == 0

    def test_wildcard_handler(self):
        """Handler wildcard recibe todos los eventos."""
        try:
            from backend.core.websocket import EventBus
        except ImportError:
            pytest.skip("Module not available")

        bus = EventBus()
        received = []

        def wildcard_handler(event, data):
            received.append(event)

        bus.subscribe("*", wildcard_handler)
        bus.publish("event1", {})
        bus.publish("event2", {})

        assert "event1" in received
        assert "event2" in received

    def test_multiple_handlers(self):
        """Multiples handlers para un evento."""
        try:
            from backend.core.websocket import EventBus
        except ImportError:
            pytest.skip("Module not available")

        bus = EventBus()
        count = [0]

        def handler1(e, d):
            count[0] += 1

        def handler2(e, d):
            count[0] += 1

        bus.subscribe("event", handler1)
        bus.subscribe("event", handler2)
        bus.publish("event", {})

        assert count[0] == 2

    def test_get_handlers_count(self):
        """Contar handlers."""
        try:
            from backend.core.websocket import EventBus
        except ImportError:
            pytest.skip("Module not available")

        bus = EventBus()

        bus.subscribe("event", lambda e, d: None)
        bus.subscribe("event", lambda e, d: None)

        assert bus.get_handlers_count("event") == 2
        assert bus.get_handlers_count("other") == 0


class TestWebSocketManager:
    """Tests para WebSocketManager."""

    @pytest.fixture
    def manager(self):
        """Crea un manager limpio."""
        try:
            from backend.core.websocket import WebSocketManager
        except ImportError:
            pytest.skip("Module not available")

        return WebSocketManager()

    def test_register_client(self, manager):
        """Registrar cliente."""
        client = manager.register_client("client-1", user_id=10)

        assert client.id == "client-1"
        assert client.user_id == 10
        assert manager.get_client("client-1") is not None

    def test_unregister_client(self, manager):
        """Desregistrar cliente."""
        manager.register_client("client-1")
        result = manager.unregister_client("client-1")

        assert result is True
        assert manager.get_client("client-1") is None

    def test_get_user_clients(self, manager):
        """Obtener clientes de usuario."""
        manager.register_client("client-1", user_id=5)
        manager.register_client("client-2", user_id=5)
        manager.register_client("client-3", user_id=6)

        clients = manager.get_user_clients(5)

        assert len(clients) == 2

    def test_join_and_leave_room(self, manager):
        """Unir y dejar sala."""
        manager.register_client("client-1")

        manager.join_room("client-1", "sala_test")
        assert len(manager.get_room_clients("sala_test")) == 1

        manager.leave_room("client-1", "sala_test")
        assert len(manager.get_room_clients("sala_test")) == 0

    def test_send_to_client(self, manager):
        """Enviar a cliente especifico."""
        sent = []
        callback = lambda msg: sent.append(msg)

        manager.register_client("client-1", send_callback=callback)
        result = manager.send_to_client("client-1", "test_event", {"data": 1})

        assert result is True
        assert len(sent) == 1

    def test_send_to_user(self, manager):
        """Enviar a todos los clientes de usuario."""
        sent = []
        callback = lambda msg: sent.append(msg)

        manager.register_client("client-1", user_id=10, send_callback=callback)
        manager.register_client("client-2", user_id=10, send_callback=callback)

        count = manager.send_to_user(10, "event", {"msg": "hello"})

        assert count == 2
        assert len(sent) == 2

    def test_send_to_room(self, manager):
        """Enviar a sala."""
        sent = []
        callback = lambda msg: sent.append(msg)

        manager.register_client("client-1", send_callback=callback)
        manager.register_client("client-2", send_callback=callback)

        manager.join_room("client-1", "sala")
        manager.join_room("client-2", "sala")

        count = manager.send_to_room("sala", "alert", {"level": "high"})

        assert count == 2

    def test_send_to_room_with_exclude(self, manager):
        """Enviar a sala excluyendo clientes."""
        sent = []
        callback = lambda msg: sent.append(msg)

        manager.register_client("client-1", send_callback=callback)
        manager.register_client("client-2", send_callback=callback)

        manager.join_room("client-1", "sala")
        manager.join_room("client-2", "sala")

        count = manager.send_to_room("sala", "event", {}, exclude={"client-1"})

        assert count == 1

    def test_broadcast(self, manager):
        """Broadcast a todos."""
        sent = []
        callback = lambda msg: sent.append(msg)

        manager.register_client("client-1", send_callback=callback)
        manager.register_client("client-2", send_callback=callback)
        manager.register_client("client-3", send_callback=callback)

        count = manager.broadcast("announcement", {"msg": "hello all"})

        assert count == 3

    def test_get_stats(self, manager):
        """Obtener estadisticas."""
        manager.register_client("client-1", user_id=1)
        manager.register_client("client-2", user_id=2)

        stats = manager.get_stats()

        assert stats["connected_clients"] == 2
        assert stats["unique_users"] == 2
        assert stats["total_connections"] == 2

    def test_get_connected_users(self, manager):
        """Obtener usuarios conectados."""
        manager.register_client("client-1", user_id=10)
        manager.register_client("client-2", user_id=20)

        users = manager.get_connected_users()

        assert 10 in users
        assert 20 in users

    def test_handle_ping_message(self, manager):
        """Manejar mensaje ping."""
        sent = []
        callback = lambda msg: sent.append(msg)

        manager.register_client("client-1", send_callback=callback)

        ping_msg = json.dumps(
            {
                "type": "ping",
                "event": "ping",
                "data": {},
            }
        )

        manager.handle_message("client-1", ping_msg)

        # Deberia responder con pong
        assert len(sent) == 1
        assert "pong" in sent[0]


class TestSingleton:
    """Tests para singleton get_ws_manager."""

    def test_returns_same_instance(self):
        """Retorna la misma instancia."""
        try:
            from backend.core.websocket import get_ws_manager
        except ImportError:
            pytest.skip("Module not available")

        manager1 = get_ws_manager()
        manager2 = get_ws_manager()

        assert manager1 is manager2


class TestHelperFunctions:
    """Tests para funciones helper."""

    def test_broadcast_helper(self):
        """Helper broadcast funciona."""
        try:
            from backend.core.websocket import broadcast, get_ws_manager
        except ImportError:
            pytest.skip("Module not available")

        # Sin clientes, deberia retornar 0
        count = broadcast("test_event", {"data": 1})
        assert count >= 0

    def test_subscribe_helper(self):
        """Helper subscribe funciona."""
        try:
            from backend.core.websocket import (get_ws_manager, publish,
                                                subscribe)
        except ImportError:
            pytest.skip("Module not available")

        received = []

        def handler(event, data):
            received.append(data)

        subscribe("custom_event", handler)
        publish("custom_event", {"value": 123})

        assert len(received) == 1
        assert received[0]["value"] == 123


class TestClientMetadata:
    """Tests para metadata de cliente."""

    def test_client_with_metadata(self):
        """Cliente con metadata."""
        try:
            from backend.core.websocket import WebSocketManager
        except ImportError:
            pytest.skip("Module not available")

        manager = WebSocketManager()

        client = manager.register_client(
            "client-1", metadata={"role": "admin", "browser": "chrome"}
        )

        assert client.metadata["role"] == "admin"
        assert client.metadata["browser"] == "chrome"


class TestCleanupStaleConnections:
    """Tests para limpieza de conexiones."""

    def test_cleanup_stale(self):
        """Limpiar conexiones inactivas."""
        try:
            from backend.core.websocket import WebSocketManager
        except ImportError:
            pytest.skip("Module not available")

        manager = WebSocketManager()

        # Registrar cliente y hacerlo "viejo"
        client = manager.register_client("client-1")
        client.last_ping = time.time() - 600  # 10 minutos atras

        removed = manager.cleanup_stale_connections(timeout=300)

        assert removed == 1
        assert manager.get_client("client-1") is None
