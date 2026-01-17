"""
Memoria persistente para Vertex IA.

Almacena en PostgreSQL:
- Conversaciones con historial completo
- Hechos de largo plazo por usuario
- Contexto entre sesiones

Usa los context managers de backend/core/db.py para conexiones seguras.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

try:
    from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id
except ImportError:
    from core.db import get_db_connection, get_db_transaction, insert_returning_id

logger = logging.getLogger(__name__)


@dataclass
class Message:
    """Mensaje en una conversacion."""

    role: str  # 'user', 'assistant', 'system'
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = None

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario."""
        return {
            "role": self.role,
            "content": self.content,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class VertexMemory:
    """
    Sistema de memoria persistente para Vertex IA.

    Soporta:
    - Historial de conversaciones por sesion
    - Memoria de largo plazo por usuario
    - Contexto entre sesiones
    """

    def __init__(self, user_id: int):
        """
        Inicializa memoria para un usuario.

        Args:
            user_id: ID del usuario (id_spm en tabla usuarios)
        """
        self.user_id = user_id
        self.current_session_id: Optional[str] = None
        self.current_conversation_id: Optional[int] = None
        self._tables_checked = False
        self._tables_exist = False

    def _check_tables_exist(self) -> bool:
        """Verifica si las tablas de Vertex existen."""
        if self._tables_checked:
            return self._tables_exist

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = 'vertex_conversations'
                    )
                """)
                self._tables_exist = cursor.fetchone()[0]
                self._tables_checked = True
        except Exception as e:
            logger.warning(f"Error checking Vertex tables: {e}")
            self._tables_exist = False
            self._tables_checked = True

        return self._tables_exist

    # ==================== Conversaciones ====================

    def start_conversation(self, context: Dict[str, Any] = None) -> str:
        """
        Inicia una nueva conversacion.

        Args:
            context: Contexto inicial (pagina, solicitud_id, etc.)

        Returns:
            session_id de la nueva conversacion
        """
        import uuid

        # If tables don't exist, use in-memory session
        if not self._check_tables_exist():
            self.current_session_id = str(uuid.uuid4())
            self.current_conversation_id = None
            logger.warning("Vertex tables not found, using in-memory session")
            return self.current_session_id

        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO vertex_conversations (user_id, context)
                    VALUES (%s, %s)
                    """,
                    (self.user_id, json.dumps(context or {})),
                )

                # Obtener el ID y session_id generados
                cursor.execute(
                    """
                    SELECT id, session_id FROM vertex_conversations
                    WHERE user_id = %s ORDER BY id DESC LIMIT 1
                    """,
                    (self.user_id,),
                )
                row = cursor.fetchone()

                if row:
                    self.current_conversation_id = row["id"] if isinstance(row, dict) else row[0]
                    self.current_session_id = str(row["session_id"] if isinstance(row, dict) else row[1])
        except Exception as e:
            logger.warning(f"Error starting conversation: {e}, using in-memory session")
            self.current_session_id = str(uuid.uuid4())
            self.current_conversation_id = None

        logger.info(f"Nueva conversacion iniciada: {self.current_session_id}")
        return self.current_session_id

    def resume_conversation(self, session_id: str) -> bool:
        """
        Reanuda una conversacion existente.

        Args:
            session_id: UUID de la sesion a reanudar

        Returns:
            True si se reanudo exitosamente, False si no existe
        """
        if not self._check_tables_exist():
            return False
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id FROM vertex_conversations
                WHERE session_id = %s AND user_id = %s AND ended_at IS NULL
                """,
                (session_id, self.user_id),
            )
            row = cursor.fetchone()

            if row:
                self.current_conversation_id = row["id"] if isinstance(row, dict) else row[0]
                self.current_session_id = session_id
                logger.info(f"Conversacion reanudada: {session_id}")
                return True

        logger.warning(f"Conversacion no encontrada: {session_id}")
        return False

    def add_message(
        self,
        role: str,
        content: str,
        metadata: Dict[str, Any] = None,
    ) -> int:
        """
        Agrega un mensaje a la conversacion actual.

        Args:
            role: 'user', 'assistant', o 'system'
            content: Contenido del mensaje
            metadata: Metadatos adicionales (sugerencias, sources, etc.)

        Returns:
            ID del mensaje creado
        """
        if not self.current_conversation_id:
            self.start_conversation()

        # Si no hay tablas, no podemos guardar
        if not self._check_tables_exist():
            return 0

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO vertex_messages (conversation_id, role, content, metadata)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    self.current_conversation_id,
                    role,
                    content,
                    json.dumps(metadata or {}),
                ),
            )

            # Obtener ID del mensaje
            cursor.execute(
                """
                SELECT id FROM vertex_messages
                WHERE conversation_id = %s ORDER BY id DESC LIMIT 1
                """,
                (self.current_conversation_id,),
            )
            row = cursor.fetchone()
            message_id = row["id"] if isinstance(row, dict) else row[0] if row else 0

        return message_id

    def get_conversation_history(self, limit: int = 20) -> List[Message]:
        """
        Obtiene el historial de la conversacion actual.

        Args:
            limit: Numero maximo de mensajes a retornar

        Returns:
            Lista de mensajes ordenados cronologicamente
        """
        if not self.current_conversation_id or not self._check_tables_exist():
            return []

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT role, content, metadata, created_at
                FROM vertex_messages
                WHERE conversation_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (self.current_conversation_id, limit),
            )
            rows = cursor.fetchall()

        messages = []
        for row in reversed(rows):  # Ordenar cronologicamente
            metadata = row["metadata"] if isinstance(row, dict) else row[2]
            created_at = row["created_at"] if isinstance(row, dict) else row[3]

            if isinstance(metadata, str):
                metadata = json.loads(metadata)

            msg = Message(
                role=row["role"] if isinstance(row, dict) else row[0],
                content=row["content"] if isinstance(row, dict) else row[1],
                metadata=metadata or {},
                created_at=created_at,
            )
            messages.append(msg)

        return messages

    def get_conversation_for_llm(self, limit: int = 10) -> List[Dict[str, str]]:
        """
        Obtiene el historial en formato para LLM.

        Args:
            limit: Numero maximo de mensajes

        Returns:
            Lista de dicts [{"role": "user"|"assistant", "content": "..."}]
        """
        messages = self.get_conversation_history(limit)
        return [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")]

    def end_conversation(self, summary: str = None):
        """
        Finaliza la conversacion actual.

        Args:
            summary: Resumen de la conversacion (generado por IA)
        """
        if not self.current_conversation_id or not self._check_tables_exist():
            self.current_conversation_id = None
            self.current_session_id = None
            return

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE vertex_conversations
                SET ended_at = NOW(), summary = %s
                WHERE id = %s
                """,
                (summary, self.current_conversation_id),
            )

        logger.info(f"Conversacion finalizada: {self.current_session_id}")
        self.current_conversation_id = None
        self.current_session_id = None

    # ==================== Memoria de Largo Plazo ====================

    def remember_fact(
        self,
        key: str,
        value: Any,
        expires_in_days: int = None,
        confidence: float = 1.0,
    ):
        """
        Guarda un hecho en la memoria de largo plazo.

        Args:
            key: Clave del hecho (ej: "materiales_frecuentes", "preferencias")
            value: Valor (puede ser cualquier tipo serializable a JSON)
            expires_in_days: Dias hasta que expire (None = permanente)
            confidence: Confianza en el hecho (0-1)
        """
        expires_at = None
        if expires_in_days:
            expires_at = (datetime.now() + timedelta(days=expires_in_days)).isoformat()

        if not self._check_tables_exist():
            return

        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Intentar actualizar primero
            cursor.execute(
                """
                UPDATE vertex_user_memory
                SET fact_value = %s, learned_at = NOW(), confidence = %s, expires_at = %s
                WHERE user_id = %s AND fact_key = %s
                """,
                (json.dumps(value), confidence, expires_at, self.user_id, key),
            )

            # Si no actualizo nada, insertar
            if cursor.rowcount == 0:
                cursor.execute(
                    """
                    INSERT INTO vertex_user_memory (user_id, fact_key, fact_value, confidence, expires_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (self.user_id, key, json.dumps(value), confidence, expires_at),
                )

        logger.debug(f"Hecho recordado: {key}")

    def recall_fact(self, key: str) -> Optional[Any]:
        """
        Recupera un hecho de la memoria.

        Args:
            key: Clave del hecho

        Returns:
            Valor del hecho o None si no existe/expiro
        """
        if not self._check_tables_exist():
            return None
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT fact_value FROM vertex_user_memory
                WHERE user_id = %s AND fact_key = %s
                AND (expires_at IS NULL OR expires_at > NOW())
                """,
                (self.user_id, key),
            )
            row = cursor.fetchone()

            if row:
                value = row["fact_value"] if isinstance(row, dict) else row[0]
                if isinstance(value, str):
                    return json.loads(value)
                return value

        return None

    def get_all_facts(self) -> Dict[str, Any]:
        """
        Recupera todos los hechos activos del usuario.

        Returns:
            Diccionario {clave: valor} de todos los hechos
        """
        if not self._check_tables_exist():
            return {}
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT fact_key, fact_value FROM vertex_user_memory
                WHERE user_id = %s
                AND (expires_at IS NULL OR expires_at > NOW())
                """,
                (self.user_id,),
            )
            rows = cursor.fetchall()

        facts = {}
        for row in rows:
            key = row["fact_key"] if isinstance(row, dict) else row[0]
            value = row["fact_value"] if isinstance(row, dict) else row[1]
            if isinstance(value, str):
                value = json.loads(value)
            facts[key] = value

        return facts

    def forget_fact(self, key: str):
        """
        Elimina un hecho de la memoria.

        Args:
            key: Clave del hecho a eliminar
        """
        if not self._check_tables_exist():
            return
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM vertex_user_memory
                WHERE user_id = %s AND fact_key = %s
                """,
                (self.user_id, key),
            )

        logger.debug(f"Hecho olvidado: {key}")

    # ==================== Contexto entre Sesiones ====================

    def get_recent_topics(self, days: int = 7, limit: int = 5) -> List[str]:
        """
        Obtiene temas recientes de conversaciones pasadas.

        Args:
            days: Dias hacia atras para buscar
            limit: Numero maximo de temas

        Returns:
            Lista de resumenes de conversaciones recientes
        """
        if not self._check_tables_exist():
            return []
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT summary FROM vertex_conversations
                WHERE user_id = %s
                AND started_at > NOW() - INTERVAL '%s days'
                AND summary IS NOT NULL
                ORDER BY started_at DESC
                LIMIT %s
                """.replace("%s days", f"{days} days"),
                (self.user_id, limit),
            )
            rows = cursor.fetchall()

        return [
            row["summary"] if isinstance(row, dict) else row[0]
            for row in rows
        ]

    def get_conversation_count(self) -> int:
        """Retorna el numero total de conversaciones del usuario."""
        if not self._check_tables_exist():
            return 0
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM vertex_conversations WHERE user_id = %s",
                (self.user_id,),
            )
            row = cursor.fetchone()
            return row["count"] if isinstance(row, dict) else row[0] if row else 0

    def get_message_count(self) -> int:
        """Retorna el numero total de mensajes del usuario."""
        if not self._check_tables_exist():
            return 0
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT COUNT(*) FROM vertex_messages vm
                JOIN vertex_conversations vc ON vm.conversation_id = vc.id
                WHERE vc.user_id = %s
                """,
                (self.user_id,),
            )
            row = cursor.fetchone()
            return row["count"] if isinstance(row, dict) else row[0] if row else 0

    # ==================== Utilidades ====================

    def get_context_summary(self) -> str:
        """
        Genera un resumen del contexto del usuario para el LLM.

        Returns:
            Texto con informacion relevante del usuario
        """
        facts = self.get_all_facts()
        topics = self.get_recent_topics(days=7, limit=3)
        conv_count = self.get_conversation_count()

        parts = []

        if conv_count > 0:
            parts.append(f"Has tenido {conv_count} conversaciones conmigo.")

        if topics:
            topics_text = ", ".join(topics[:3])
            parts.append(f"Temas recientes: {topics_text}")

        if facts.get("materiales_frecuentes"):
            mats = facts["materiales_frecuentes"][:3]
            mat_names = [m.get("descripcion", m.get("codigo", "?"))[:30] for m in mats]
            parts.append(f"Materiales que pedis seguido: {', '.join(mat_names)}")

        if facts.get("centro"):
            parts.append(f"Tu centro es: {facts['centro']}")

        return " ".join(parts) if parts else ""

    def clear_expired_facts(self):
        """Elimina hechos expirados de la memoria."""
        if not self._check_tables_exist():
            return
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM vertex_user_memory
                WHERE user_id = %s AND expires_at IS NOT NULL AND expires_at < NOW()
                """,
                (self.user_id,),
            )
            deleted = cursor.rowcount

        if deleted > 0:
            logger.info(f"Eliminados {deleted} hechos expirados para usuario {self.user_id}")
