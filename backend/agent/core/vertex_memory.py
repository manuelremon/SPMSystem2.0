"""
Memoria persistente para Vertex IA.

Almacena en PostgreSQL/SQLite:
- Conversaciones con historial completo
- Hechos de largo plazo por usuario
- Contexto entre sesiones

Usa los context managers de backend/core/db.py para conexiones seguras.
Usa placeholders ? (convertidos automáticamente a %s en PostgreSQL por PostgresCursorWrapper).
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    is_using_postgresql,
    sql_datetime_now,
    sql_now_minus,
)

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
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else self.created_at
            ) if self.created_at else None,
        }


class VertexMemory:
    """
    Sistema de memoria persistente para Vertex IA.

    Soporta:
    - Historial de conversaciones por sesion
    - Memoria de largo plazo por usuario
    - Contexto entre sesiones
    """

    def __init__(self, user_id: str):
        """
        Inicializa memoria para un usuario.

        Args:
            user_id: ID del usuario (id_spm TEXT en tabla usuarios)
        """
        self.user_id = str(user_id)  # Ensure it's a string
        self.current_session_id: Optional[str] = None
        self.current_conversation_id: Optional[int] = None
        self._tables_checked = False
        self._tables_exist = False

    def _check_tables_exist(self) -> bool:
        """Verifica si las tablas de Vertex existen. Soporta PostgreSQL y SQLite."""
        if self._tables_checked:
            return self._tables_exist

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                if is_using_postgresql():
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables
                            WHERE table_name = 'vertex_conversations'
                        )
                    """)
                    self._tables_exist = cursor.fetchone()[0]
                else:
                    cursor.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='vertex_conversations'"
                    )
                    self._tables_exist = cursor.fetchone() is not None
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
                    VALUES (?, ?)
                    """,
                    (self.user_id, json.dumps(context or {})),
                )

                # Obtener el ID y session_id generados
                cursor.execute(
                    """
                    SELECT id, session_id FROM vertex_conversations
                    WHERE user_id = ? ORDER BY id DESC LIMIT 1
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
                WHERE session_id = ? AND user_id = ? AND ended_at IS NULL
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
                VALUES (?, ?, ?, ?)
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
                WHERE conversation_id = ? ORDER BY id DESC LIMIT 1
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
                WHERE conversation_id = ?
                ORDER BY created_at DESC
                LIMIT ?
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

        now = sql_datetime_now()
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE vertex_conversations
                SET ended_at = {now}, summary = ?
                WHERE id = ?
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

        now = sql_datetime_now()
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Intentar actualizar primero
            cursor.execute(
                f"""
                UPDATE vertex_user_memory
                SET fact_value = ?, learned_at = {now}, confidence = ?, expires_at = ?
                WHERE user_id = ? AND fact_key = ?
                """,
                (json.dumps(value), confidence, expires_at, self.user_id, key),
            )

            # Si no actualizo nada, insertar
            if cursor.rowcount == 0:
                cursor.execute(
                    """
                    INSERT INTO vertex_user_memory (user_id, fact_key, fact_value, confidence, expires_at)
                    VALUES (?, ?, ?, ?, ?)
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

        now = sql_datetime_now()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT fact_value FROM vertex_user_memory
                WHERE user_id = ? AND fact_key = ?
                AND (expires_at IS NULL OR expires_at > {now})
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

        now = sql_datetime_now()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT fact_key, fact_value FROM vertex_user_memory
                WHERE user_id = ?
                AND (expires_at IS NULL OR expires_at > {now})
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
                WHERE user_id = ? AND fact_key = ?
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

        since = sql_now_minus(f"{days} days")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT summary FROM vertex_conversations
                WHERE user_id = ?
                AND started_at > {since}
                AND summary IS NOT NULL
                ORDER BY started_at DESC
                LIMIT ?
                """,
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
                "SELECT COUNT(*) FROM vertex_conversations WHERE user_id = ?",
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
                WHERE vc.user_id = ?
                """,
                (self.user_id,),
            )
            row = cursor.fetchone()
            return row["count"] if isinstance(row, dict) else row[0] if row else 0

    # ==================== Utilidades ====================

    def get_context_summary(self) -> str:
        """
        Genera un resumen del contexto del usuario para el LLM.
        Incluye historial real de conversaciones, materiales frecuentes,
        temas de interes y datos del perfil.

        Returns:
            Texto con informacion relevante del usuario
        """
        facts = self.get_all_facts()
        topics = self.get_recent_topics(days=7, limit=3)
        conv_count = self.get_conversation_count()

        parts = []

        if conv_count > 0:
            if conv_count == 1:
                parts.append("Es tu segunda conversacion conmigo.")
            elif conv_count < 5:
                parts.append(f"Has tenido {conv_count} conversaciones conmigo.")
            else:
                parts.append(f"Usuario recurrente ({conv_count} conversaciones).")

        if topics:
            topics_text = ", ".join(t[:50] for t in topics[:3])
            parts.append(f"Temas recientes: {topics_text}")

        # Materiales que consulta frecuentemente
        if facts.get("materiales_frecuentes"):
            mats = facts["materiales_frecuentes"]
            if len(mats) > 0:
                # Mostrar los mas recientes
                recent_mats = sorted(
                    mats,
                    key=lambda m: m.get("mentioned_at", ""),
                    reverse=True,
                )[:5]
                mat_codes = [m.get("codigo", "?") for m in recent_mats]
                parts.append(f"Materiales consultados recientemente: {', '.join(mat_codes)}")

        # Temas de interes
        if facts.get("recent_topics"):
            interested = facts["recent_topics"]
            if isinstance(interested, list) and interested:
                parts.append(f"Temas de interes: {', '.join(interested[:5])}")

        # Centro del usuario
        if facts.get("centro"):
            parts.append(f"Centro: {facts['centro']}")

        return " ".join(parts) if parts else ""

    def extract_entities(self, user_msg: str, response: str) -> Dict[str, Any]:
        """
        Extrae entidades mencionadas en la conversacion.

        Args:
            user_msg: Mensaje del usuario
            response: Respuesta del asistente

        Returns:
            Dict con entidades extraidas (materiales, centros, acciones)
        """
        import re

        entities = {
            "materiales": [],
            "solicitudes": [],
            "acciones": [],
        }

        combined = user_msg + " " + response

        # Extraer codigos SAP (formato XXXX-XXXXXXX)
        sap_codes = re.findall(r'\b\d{4}-\d{7}\b', combined)
        entities["materiales"] = list(set(sap_codes))

        # Extraer IDs de solicitudes (#123 o solicitud 123)
        sol_ids = re.findall(r'#(\d+)', combined)
        sol_ids += re.findall(r'solicitud\s+(\d+)', combined, re.IGNORECASE)
        entities["solicitudes"] = list(set(sol_ids))

        # Detectar acciones mencionadas
        action_patterns = {
            "crear_solicitud": r'crear\s+(?:una\s+)?solicitud',
            "buscar_material": r'busc(?:ar|o|ando)\s+material',
            "consultar_stock": r'(?:consultar|ver|revisar)\s+stock',
            "aprobar": r'apro(?:bar|bo)',
            "presupuesto": r'(?:consultar|ver)\s+presupuesto',
        }
        for action, pattern in action_patterns.items():
            if re.search(pattern, combined, re.IGNORECASE):
                entities["acciones"].append(action)

        return entities

    def learn_from_conversation(self, user_msg: str, response: str):
        """
        Aprende de una interaccion: extrae entidades y actualiza facts.

        Args:
            user_msg: Mensaje del usuario
            response: Respuesta del asistente
        """
        entities = self.extract_entities(user_msg, response)

        # Guardar materiales mencionados
        if entities["materiales"]:
            freq_materials = self.recall_fact("materiales_frecuentes") or []
            for code in entities["materiales"]:
                if not any(m.get("codigo") == code for m in freq_materials):
                    freq_materials.append({
                        "codigo": code,
                        "mentioned_at": datetime.now().isoformat(),
                    })
            # Mantener solo los ultimos 20
            freq_materials = sorted(
                freq_materials,
                key=lambda m: m.get("mentioned_at", ""),
                reverse=True,
            )[:20]
            self.remember_fact("materiales_frecuentes", freq_materials, expires_in_days=None)

        # Guardar temas de interes
        topic_keywords = {
            "stock": ["stock", "inventario", "disponible", "cantidad"],
            "solicitud": ["solicitud", "pedido", "orden"],
            "presupuesto": ["presupuesto", "budget", "monto", "precio"],
            "sla": ["sla", "tiempo", "urgente", "demora", "vencimiento"],
            "equivalente": ["equivalente", "alternativa", "reemplazo", "similar"],
            "mrp": ["mrp", "reposicion", "punto de pedido", "alerta"],
        }
        detected_topics = []
        msg_lower = user_msg.lower()
        for topic, keywords in topic_keywords.items():
            if any(kw in msg_lower for kw in keywords):
                detected_topics.append(topic)

        if detected_topics:
            existing_topics = self.recall_fact("recent_topics") or []
            all_topics = list(set(existing_topics + detected_topics))[:10]
            self.remember_fact("recent_topics", all_topics, expires_in_days=None)

    def clear_expired_facts(self):
        """Elimina hechos expirados de la memoria."""
        if not self._check_tables_exist():
            return

        now = sql_datetime_now()
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                DELETE FROM vertex_user_memory
                WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at < {now}
                """,
                (self.user_id,),
            )
            deleted = cursor.rowcount

        if deleted > 0:
            logger.info(f"Eliminados {deleted} hechos expirados para usuario {self.user_id}")
