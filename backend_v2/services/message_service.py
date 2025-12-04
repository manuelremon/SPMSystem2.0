"""
Servicio de Mensajería Bidireccional

Gestiona:
- Envío de mensajes entre usuarios
- Threads de conversación (replies)
- Bandeja de entrada (inbox)
- Bandeja de salida (outbox)
- Marcado de lectura
- Asociación con solicitudes
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Importar configuración de BD
try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings


class MessageService:
    """Servicio para gestión de mensajes bidireccionales"""

    @staticmethod
    def _get_db_path() -> Path:
        """Obtener ruta de la base de datos"""
        if hasattr(settings, "DATABASE_URL") and settings.DATABASE_URL:
            if settings.DATABASE_URL.startswith("sqlite:///"):
                return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
        return Path("backend_v2/spm.db")

    @staticmethod
    def _connect():
        """Crear conexión a BD"""
        db_path = MessageService._get_db_path()
        return sqlite3.connect(db_path)

    @staticmethod
    def send_message(
        remitente_id: str,
        destinatario_id: str,
        asunto: str,
        mensaje: str,
        solicitud_id: Optional[int] = None,
        parent_id: Optional[int] = None,
        tipo: str = "mensaje",
        metadata: Optional[dict] = None,
    ) -> Optional[int]:
        """
        Enviar un mensaje

        Args:
            remitente_id: ID del usuario que envía
            destinatario_id: ID del usuario que recibe
            asunto: Asunto del mensaje
            mensaje: Contenido del mensaje
            solicitud_id: ID de solicitud relacionada (opcional)
            parent_id: ID del mensaje padre si es respuesta (opcional)
            tipo: Tipo de mensaje (mensaje, solicitud_info, etc.)
            metadata: Datos adicionales en formato dict

        Returns:
            ID del mensaje creado o None si falla
        """
        conn = MessageService._connect()
        cursor = conn.cursor()

        try:
            import json

            metadata_json = json.dumps(metadata) if metadata else None

            cursor.execute(
                """
                INSERT INTO mensajes (
                    remitente_id, destinatario_id, solicitud_id,
                    asunto, mensaje, parent_id, tipo, metadata_json,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    remitente_id,
                    destinatario_id,
                    solicitud_id,
                    asunto,
                    mensaje,
                    parent_id,
                    tipo,
                    metadata_json,
                    datetime.utcnow().isoformat(),
                    datetime.utcnow().isoformat(),
                ),
            )

            message_id = cursor.lastrowid
            conn.commit()
            return message_id

        except Exception as e:
            print(f"Error al enviar mensaje: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()

    @staticmethod
    def get_inbox(
        user_id: str, unread_only: bool = False, limit: int = 50, offset: int = 0
    ) -> List[Dict]:
        """
        Obtener mensajes recibidos (inbox)

        Args:
            user_id: ID del usuario
            unread_only: Solo mensajes no leídos
            limit: Cantidad máxima de mensajes
            offset: Offset para paginación

        Returns:
            Lista de mensajes con información del remitente
        """
        conn = MessageService._connect()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            where_clause = "WHERE m.destinatario_id = ?"
            params = [user_id]

            if unread_only:
                where_clause += " AND m.leido = 0"

            query = f"""
                SELECT
                    m.*,
                    u.nombre AS remitente_nombre,
                    u.apellido AS remitente_apellido,
                    u.rol AS remitente_rol,
                    s.justificacion AS solicitud_justificacion
                FROM mensajes m
                LEFT JOIN usuarios u ON m.remitente_id = u.id_spm
                LEFT JOIN solicitudes s ON m.solicitud_id = s.id
                {where_clause}
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            """

            cursor.execute(query, params + [limit, offset])
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                # Parse metadata JSON if exists
                if msg.get("metadata_json"):
                    import json

                    try:
                        msg["metadata"] = json.loads(msg["metadata_json"])
                    except:
                        msg["metadata"] = {}
                messages.append(msg)

            return messages

        except Exception as e:
            print(f"Error al obtener inbox: {e}")
            return []
        finally:
            conn.close()

    @staticmethod
    def get_outbox(user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """
        Obtener mensajes enviados (outbox)

        Args:
            user_id: ID del usuario
            limit: Cantidad máxima de mensajes
            offset: Offset para paginación

        Returns:
            Lista de mensajes con información del destinatario
        """
        conn = MessageService._connect()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            query = """
                SELECT
                    m.*,
                    u.nombre AS destinatario_nombre,
                    u.apellido AS destinatario_apellido,
                    u.rol AS destinatario_rol,
                    s.justificacion AS solicitud_justificacion
                FROM mensajes m
                LEFT JOIN usuarios u ON m.destinatario_id = u.id_spm
                LEFT JOIN solicitudes s ON m.solicitud_id = s.id
                WHERE m.remitente_id = ?
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            """

            cursor.execute(query, (user_id, limit, offset))
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                msg = dict(row)
                if msg.get("metadata_json"):
                    import json

                    try:
                        msg["metadata"] = json.loads(msg["metadata_json"])
                    except:
                        msg["metadata"] = {}
                messages.append(msg)

            return messages

        except Exception as e:
            print(f"Error al obtener outbox: {e}")
            return []
        finally:
            conn.close()

    @staticmethod
    def get_thread(message_id: int, user_id: str) -> List[Dict]:
        """
        Obtener hilo de conversación (mensaje original + respuestas)

        Args:
            message_id: ID del mensaje original
            user_id: ID del usuario (para validar permisos)

        Returns:
            Lista de mensajes ordenados cronológicamente
        """
        conn = MessageService._connect()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            # Obtener mensaje original
            cursor.execute(
                """
                SELECT m.*,
                       u_rem.nombre AS remitente_nombre,
                       u_rem.apellido AS remitente_apellido,
                       u_dest.nombre AS destinatario_nombre,
                       u_dest.apellido AS destinatario_apellido
                FROM mensajes m
                LEFT JOIN usuarios u_rem ON m.remitente_id = u_rem.id_spm
                LEFT JOIN usuarios u_dest ON m.destinatario_id = u_dest.id_spm
                WHERE m.id = ? AND (m.remitente_id = ? OR m.destinatario_id = ?)
                """,
                (message_id, user_id, user_id),
            )

            original = cursor.fetchone()
            if not original:
                return []

            # Obtener respuestas
            cursor.execute(
                """
                SELECT m.*,
                       u_rem.nombre AS remitente_nombre,
                       u_rem.apellido AS remitente_apellido,
                       u_dest.nombre AS destinatario_nombre,
                       u_dest.apellido AS destinatario_apellido
                FROM mensajes m
                LEFT JOIN usuarios u_rem ON m.remitente_id = u_rem.id_spm
                LEFT JOIN usuarios u_dest ON m.destinatario_id = u_dest.id_spm
                WHERE m.parent_id = ?
                ORDER BY m.created_at ASC
                """,
                (message_id,),
            )

            replies = cursor.fetchall()

            thread = [dict(original)] + [dict(r) for r in replies]
            return thread

        except Exception as e:
            print(f"Error al obtener thread: {e}")
            return []
        finally:
            conn.close()

    @staticmethod
    def mark_as_read(message_id: int, user_id: str) -> bool:
        """
        Marcar mensaje como leído

        Args:
            message_id: ID del mensaje
            user_id: ID del usuario (debe ser el destinatario)

        Returns:
            True si se marcó exitosamente
        """
        conn = MessageService._connect()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                UPDATE mensajes
                SET leido = 1, updated_at = ?
                WHERE id = ? AND destinatario_id = ?
                """,
                (datetime.utcnow().isoformat(), message_id, user_id),
            )

            conn.commit()
            return cursor.rowcount > 0

        except Exception as e:
            print(f"Error al marcar como leído: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    @staticmethod
    def get_unread_count(user_id: str) -> int:
        """
        Obtener cantidad de mensajes no leídos

        Args:
            user_id: ID del usuario

        Returns:
            Cantidad de mensajes no leídos
        """
        conn = MessageService._connect()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "SELECT COUNT(*) FROM mensajes WHERE destinatario_id = ? AND leido = 0", (user_id,)
            )

            count = cursor.fetchone()[0]
            return count

        except Exception as e:
            print(f"Error al contar no leídos: {e}")
            return 0
        finally:
            conn.close()

    @staticmethod
    def delete_message(message_id: int, user_id: str) -> bool:
        """
        Eliminar mensaje (solo si es el remitente o destinatario)

        Args:
            message_id: ID del mensaje
            user_id: ID del usuario

        Returns:
            True si se eliminó exitosamente
        """
        conn = MessageService._connect()
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                DELETE FROM mensajes
                WHERE id = ? AND (remitente_id = ? OR destinatario_id = ?)
                """,
                (message_id, user_id, user_id),
            )

            conn.commit()
            return cursor.rowcount > 0

        except Exception as e:
            print(f"Error al eliminar mensaje: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
