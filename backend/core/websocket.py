"""
WebSocket System - Sistema de comunicacion en tiempo real.
Sprint 15 - WebSockets para notificaciones y actualizaciones live.

Uso:
    from backend.core.websocket import get_ws_manager, broadcast, send_to_user

    # Enviar a todos
    broadcast("solicitud_created", {"id": 123, "estado": "submitted"})

    # Enviar a usuario especifico
    send_to_user(user_id=5, event="notification", data={"message": "Nueva solicitud"})

    # Enviar a sala/grupo
    send_to_room("planificadores", "alert", {"type": "stock_bajo"})
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """Tipos de mensajes WebSocket."""
    EVENT = "event"
    NOTIFICATION = "notification"
    BROADCAST = "broadcast"
    ROOM = "room"
    DIRECT = "direct"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"
    ACK = "ack"


@dataclass
class WSMessage:
    """Mensaje WebSocket."""
    type: MessageType
    event: str
    data: Any
    timestamp: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: Optional[str] = None
    room: Optional[str] = None

    def to_json(self) -> str:
        """Serializa a JSON."""
        return json.dumps({
            "type": self.type.value,
            "event": self.event,
            "data": self.data,
            "timestamp": self.timestamp,
            "id": self.id,
            "sender_id": self.sender_id,
            "room": self.room,
        })

    @classmethod
    def from_json(cls, json_str: str) -> "WSMessage":
        """Deserializa desde JSON."""
        data = json.loads(json_str)
        return cls(
            type=MessageType(data.get("type", "event")),
            event=data.get("event", ""),
            data=data.get("data"),
            timestamp=data.get("timestamp", time.time()),
            id=data.get("id", str(uuid.uuid4())),
            sender_id=data.get("sender_id"),
            room=data.get("room"),
        )


@dataclass
class WSClient:
    """Representa un cliente WebSocket conectado."""
    id: str
    user_id: Optional[int] = None
    rooms: Set[str] = field(default_factory=set)
    connected_at: float = field(default_factory=time.time)
    last_ping: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Callback para enviar mensajes (set by transport layer)
    send_callback: Optional[Callable[[str], None]] = None

    def send(self, message: WSMessage) -> bool:
        """Envia un mensaje al cliente."""
        if self.send_callback:
            try:
                self.send_callback(message.to_json())
                return True
            except Exception as e:
                logger.error(f"Error sending to client {self.id}: {e}")
                return False
        return False

    def join_room(self, room: str) -> None:
        """Une al cliente a una sala."""
        self.rooms.add(room)

    def leave_room(self, room: str) -> None:
        """Remueve al cliente de una sala."""
        self.rooms.discard(room)


class EventBus:
    """Bus de eventos para comunicacion interna."""

    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)
        self._lock = threading.RLock()

    def subscribe(self, event: str, handler: Callable) -> None:
        """Suscribe un handler a un evento."""
        with self._lock:
            self._handlers[event].append(handler)
            logger.debug(f"Handler subscribed to event: {event}")

    def unsubscribe(self, event: str, handler: Callable) -> bool:
        """Desuscribe un handler de un evento."""
        with self._lock:
            if handler in self._handlers[event]:
                self._handlers[event].remove(handler)
                return True
            return False

    def publish(self, event: str, data: Any = None) -> int:
        """Publica un evento a todos los handlers suscritos."""
        handlers_called = 0

        with self._lock:
            handlers = self._handlers.get(event, []).copy()

        for handler in handlers:
            try:
                handler(event, data)
                handlers_called += 1
            except Exception as e:
                logger.error(f"Error in event handler for {event}: {e}")

        # Tambien publicar a handlers "*" (wildcard)
        with self._lock:
            wildcard_handlers = self._handlers.get("*", []).copy()

        for handler in wildcard_handlers:
            try:
                handler(event, data)
                handlers_called += 1
            except Exception as e:
                logger.error(f"Error in wildcard handler for {event}: {e}")

        return handlers_called

    def get_handlers_count(self, event: str) -> int:
        """Retorna el numero de handlers para un evento."""
        with self._lock:
            return len(self._handlers.get(event, []))


class WebSocketManager:
    """Manager central para conexiones WebSocket."""

    def __init__(self):
        self._clients: Dict[str, WSClient] = {}
        self._user_clients: Dict[int, Set[str]] = defaultdict(set)
        self._rooms: Dict[str, Set[str]] = defaultdict(set)
        self._lock = threading.RLock()
        self._event_bus = EventBus()
        self._message_queue: List[WSMessage] = []
        self._stats = {
            "total_connections": 0,
            "total_messages_sent": 0,
            "total_messages_received": 0,
        }

    @property
    def event_bus(self) -> EventBus:
        """Acceso al bus de eventos."""
        return self._event_bus

    def register_client(
        self,
        client_id: str,
        user_id: Optional[int] = None,
        send_callback: Optional[Callable] = None,
        metadata: Optional[Dict] = None,
    ) -> WSClient:
        """Registra un nuevo cliente."""
        client = WSClient(
            id=client_id,
            user_id=user_id,
            send_callback=send_callback,
            metadata=metadata or {},
        )

        with self._lock:
            self._clients[client_id] = client

            if user_id:
                self._user_clients[user_id].add(client_id)

            self._stats["total_connections"] += 1

        logger.info(f"Client registered: {client_id} (user: {user_id})")
        self._event_bus.publish("client_connected", {"client_id": client_id, "user_id": user_id})

        return client

    def unregister_client(self, client_id: str) -> bool:
        """Desregistra un cliente."""
        with self._lock:
            client = self._clients.pop(client_id, None)

            if client:
                if client.user_id:
                    self._user_clients[client.user_id].discard(client_id)

                # Remover de todas las salas
                for room in client.rooms:
                    self._rooms[room].discard(client_id)

                logger.info(f"Client unregistered: {client_id}")
                self._event_bus.publish("client_disconnected", {"client_id": client_id})
                return True

        return False

    def get_client(self, client_id: str) -> Optional[WSClient]:
        """Obtiene un cliente por ID."""
        with self._lock:
            return self._clients.get(client_id)

    def get_user_clients(self, user_id: int) -> List[WSClient]:
        """Obtiene todos los clientes de un usuario."""
        with self._lock:
            client_ids = self._user_clients.get(user_id, set())
            return [self._clients[cid] for cid in client_ids if cid in self._clients]

    # ==================== Rooms ====================

    def join_room(self, client_id: str, room: str) -> bool:
        """Une un cliente a una sala."""
        with self._lock:
            client = self._clients.get(client_id)
            if client:
                client.join_room(room)
                self._rooms[room].add(client_id)
                logger.debug(f"Client {client_id} joined room: {room}")
                return True
        return False

    def leave_room(self, client_id: str, room: str) -> bool:
        """Remueve un cliente de una sala."""
        with self._lock:
            client = self._clients.get(client_id)
            if client:
                client.leave_room(room)
                self._rooms[room].discard(client_id)
                return True
        return False

    def get_room_clients(self, room: str) -> List[WSClient]:
        """Obtiene todos los clientes en una sala."""
        with self._lock:
            client_ids = self._rooms.get(room, set())
            return [self._clients[cid] for cid in client_ids if cid in self._clients]

    # ==================== Messaging ====================

    def send_to_client(self, client_id: str, event: str, data: Any) -> bool:
        """Envia un mensaje a un cliente especifico."""
        client = self.get_client(client_id)
        if client:
            message = WSMessage(
                type=MessageType.DIRECT,
                event=event,
                data=data,
            )
            success = client.send(message)
            if success:
                with self._lock:
                    self._stats["total_messages_sent"] += 1
            return success
        return False

    def send_to_user(self, user_id: int, event: str, data: Any) -> int:
        """Envia un mensaje a todos los clientes de un usuario."""
        clients = self.get_user_clients(user_id)
        sent = 0

        message = WSMessage(
            type=MessageType.DIRECT,
            event=event,
            data=data,
        )

        for client in clients:
            if client.send(message):
                sent += 1

        with self._lock:
            self._stats["total_messages_sent"] += sent

        return sent

    def send_to_room(self, room: str, event: str, data: Any, exclude: Optional[Set[str]] = None) -> int:
        """Envia un mensaje a todos los clientes en una sala."""
        clients = self.get_room_clients(room)
        exclude = exclude or set()
        sent = 0

        message = WSMessage(
            type=MessageType.ROOM,
            event=event,
            data=data,
            room=room,
        )

        for client in clients:
            if client.id not in exclude:
                if client.send(message):
                    sent += 1

        with self._lock:
            self._stats["total_messages_sent"] += sent

        return sent

    def broadcast(self, event: str, data: Any, exclude: Optional[Set[str]] = None) -> int:
        """Envia un mensaje a todos los clientes conectados."""
        exclude = exclude or set()
        sent = 0

        message = WSMessage(
            type=MessageType.BROADCAST,
            event=event,
            data=data,
        )

        with self._lock:
            clients = list(self._clients.values())

        for client in clients:
            if client.id not in exclude:
                if client.send(message):
                    sent += 1

        with self._lock:
            self._stats["total_messages_sent"] += sent

        logger.debug(f"Broadcast '{event}' sent to {sent} clients")
        return sent

    def handle_message(self, client_id: str, message_json: str) -> None:
        """Procesa un mensaje recibido de un cliente."""
        try:
            message = WSMessage.from_json(message_json)
            message.sender_id = client_id

            with self._lock:
                self._stats["total_messages_received"] += 1

            # Publicar al event bus
            self._event_bus.publish(f"ws:{message.event}", {
                "client_id": client_id,
                "message": message,
            })

            # Handle ping/pong
            if message.type == MessageType.PING:
                self.send_to_client(client_id, "pong", {"timestamp": time.time()})

        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON from client {client_id}: {e}")
        except Exception as e:
            logger.error(f"Error handling message from {client_id}: {e}")

    # ==================== Stats ====================

    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadisticas del manager."""
        with self._lock:
            return {
                "connected_clients": len(self._clients),
                "unique_users": len([uid for uid, cids in self._user_clients.items() if cids]),
                "active_rooms": len([r for r, cids in self._rooms.items() if cids]),
                "total_connections": self._stats["total_connections"],
                "total_messages_sent": self._stats["total_messages_sent"],
                "total_messages_received": self._stats["total_messages_received"],
            }

    def get_connected_users(self) -> List[int]:
        """Retorna lista de user IDs conectados."""
        with self._lock:
            return [uid for uid, cids in self._user_clients.items() if cids]

    def cleanup_stale_connections(self, timeout: int = 300) -> int:
        """Limpia conexiones sin actividad."""
        cutoff = time.time() - timeout
        removed = 0

        with self._lock:
            stale_ids = [
                cid for cid, client in self._clients.items()
                if client.last_ping < cutoff
            ]

        for client_id in stale_ids:
            if self.unregister_client(client_id):
                removed += 1

        if removed:
            logger.info(f"Cleaned up {removed} stale connections")

        return removed


# ==================== Singleton ====================

_ws_manager: Optional[WebSocketManager] = None
_manager_lock = threading.Lock()


def get_ws_manager() -> WebSocketManager:
    """Obtiene la instancia singleton del WebSocket manager."""
    global _ws_manager
    if _ws_manager is None:
        with _manager_lock:
            if _ws_manager is None:
                _ws_manager = WebSocketManager()
    return _ws_manager


# ==================== Helper Functions ====================

def broadcast(event: str, data: Any) -> int:
    """Helper para broadcast."""
    return get_ws_manager().broadcast(event, data)


def send_to_user(user_id: int, event: str, data: Any) -> int:
    """Helper para enviar a usuario."""
    return get_ws_manager().send_to_user(user_id, event, data)


def send_to_room(room: str, event: str, data: Any) -> int:
    """Helper para enviar a sala."""
    return get_ws_manager().send_to_room(room, event, data)


def subscribe(event: str, handler: Callable) -> None:
    """Helper para suscribirse a eventos."""
    get_ws_manager().event_bus.subscribe(event, handler)


def publish(event: str, data: Any = None) -> int:
    """Helper para publicar eventos."""
    return get_ws_manager().event_bus.publish(event, data)


# ==================== Flask Integration ====================

def init_websocket(app) -> None:
    """
    Inicializa el sistema WebSocket en Flask.

    Args:
        app: Aplicacion Flask
    """
    manager = get_ws_manager()

    # Registrar eventos de sistema
    _register_system_events(manager)

    app.logger.info("WebSocket system initialized")


def _register_system_events(manager: WebSocketManager) -> None:
    """Registra handlers de eventos de sistema."""

    # Evento: solicitud creada
    def on_solicitud_created(event: str, data: Any):
        # Notificar a planificadores
        manager.send_to_room("planificadores", "solicitud_nueva", data)

    manager.event_bus.subscribe("solicitud_created", on_solicitud_created)

    # Evento: solicitud aprobada
    def on_solicitud_approved(event: str, data: Any):
        user_id = data.get("user_id")
        if user_id:
            manager.send_to_user(user_id, "solicitud_aprobada", data)

    manager.event_bus.subscribe("solicitud_approved", on_solicitud_approved)

    # Evento: alerta MRP
    def on_mrp_alert(event: str, data: Any):
        manager.send_to_room("planificadores", "mrp_alert", data)
        manager.send_to_room("admins", "mrp_alert", data)

    manager.event_bus.subscribe("mrp_alert", on_mrp_alert)
