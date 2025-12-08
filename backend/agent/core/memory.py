"""
Módulo de Memoria para el Agente ReAct.

Implementa dos tipos de memoria:
- Short-term (deque): Conversación actual, últimos estados
- Long-term (persistencia): Hechos, reglas, conocimiento acumulado
"""

import json
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class MemoryEntry:
    """Entrada en la memoria del agente."""

    timestamp: str
    entry_type: str  # "observation", "thought", "action", "result", "fact"
    content: Dict[str, Any]
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario."""
        return asdict(self)


class Memory:
    """
    Sistema de memoria para el agente ReAct.

    Mantiene:
    - Contexto de corto plazo (últimas 50 acciones)
    - Hechos de largo plazo (persistentes)
    - Reglas aprendidas
    """

    def __init__(self, max_short_term: int = 50, persist_path: Optional[Path] = None):
        """
        Inicializa la memoria.

        Args:
            max_short_term: Máximo de entradas en memoria corto plazo
            persist_path: Ruta para persistencia (None = sin persistencia)
        """
        self.short_term: deque = deque(maxlen=max_short_term)
        self.facts: Dict[str, Any] = {}
        self.rules: Dict[str, str] = {}
        self.persist_path = persist_path

        # Carga datos persistentes si existen
        if persist_path and persist_path.exists():
            self._load_persistent()

    def remember_observation(self, observation: Dict[str, Any]) -> None:
        """Registra una observación."""
        entry = MemoryEntry(
            timestamp=datetime.now().isoformat(), entry_type="observation", content=observation
        )
        self.short_term.append(entry)

    def remember_thought(self, thought: str, reasoning: Optional[Dict] = None) -> None:
        """Registra un pensamiento del agente."""
        entry = MemoryEntry(
            timestamp=datetime.now().isoformat(),
            entry_type="thought",
            content={"thought": thought, "reasoning": reasoning or {}},
        )
        self.short_term.append(entry)

    def remember_action(self, tool_name: str, params: Dict[str, Any]) -> None:
        """Registra una acción (tool invocation)."""
        entry = MemoryEntry(
            timestamp=datetime.now().isoformat(),
            entry_type="action",
            content={"tool": tool_name, "parameters": params},
        )
        self.short_term.append(entry)

    def remember_result(self, result: Dict[str, Any], success: bool) -> None:
        """Registra el resultado de una herramienta."""
        entry = MemoryEntry(
            timestamp=datetime.now().isoformat(),
            entry_type="result",
            content={"result": result, "success": success},
        )
        self.short_term.append(entry)

    def add_fact(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """
        Agrega un hecho a la memoria de largo plazo.

        Args:
            key: Identificador del hecho
            value: Valor del hecho
            ttl_seconds: Tiempo de vida en segundos (None = permanente)
        """
        self.facts[key] = {
            "value": value,
            "created_at": datetime.now().isoformat(),
            "ttl": ttl_seconds,
        }
        self._save_persistent()

    def get_fact(self, key: str) -> Optional[Any]:
        """Recupera un hecho."""
        if key in self.facts:
            fact = self.facts[key]
            # Verifica TTL
            if fact.get("ttl"):
                created = datetime.fromisoformat(fact["created_at"])
                if (datetime.now() - created).total_seconds() > fact["ttl"]:
                    del self.facts[key]
                    return None
            return fact["value"]
        return None

    def add_rule(self, rule_id: str, rule: str) -> None:
        """Agrega una regla aprendida."""
        self.rules[rule_id] = rule
        self._save_persistent()

    def get_context(self, depth: int = 10) -> List[Dict[str, Any]]:
        """
        Retorna el contexto reciente para el agente.

        Args:
            depth: Número de últimas entradas a retornar
        """
        recent = list(self.short_term)[-depth:]
        return [entry.to_dict() for entry in recent]

    def clear_short_term(self) -> None:
        """Limpia la memoria de corto plazo (sin afectar hechos/reglas)."""
        self.short_term.clear()

    def _save_persistent(self) -> None:
        """Persiste hechos y reglas a disco."""
        if not self.persist_path:
            return

        self.persist_path.parent.mkdir(parents=True, exist_ok=True)
        data = {"facts": self.facts, "rules": self.rules, "saved_at": datetime.now().isoformat()}
        with open(self.persist_path, "w") as f:
            json.dump(data, f, indent=2)

    def _load_persistent(self) -> None:
        """Carga hechos y reglas del disco."""
        if not self.persist_path or not self.persist_path.exists():
            return

        try:
            with open(self.persist_path, "r") as f:
                data = json.load(f)
                self.facts = data.get("facts", {})
                self.rules = data.get("rules", {})
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: No se pudo cargar memoria persistente: {e}")

    def __repr__(self) -> str:
        return (
            f"Memory(short_term_size={len(self.short_term)}, "
            f"facts={len(self.facts)}, rules={len(self.rules)})"
        )
