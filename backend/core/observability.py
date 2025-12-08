"""
Observability System - Logging estructurado y Request Tracing.
Sprint 16 - Mejora la visibilidad del sistema para debugging y monitoreo.

Uso:
    from backend.core.observability import get_logger, trace_request, log_event

    logger = get_logger(__name__)
    logger.info("Mensaje", extra={"user_id": 123, "action": "login"})

    with trace_request() as trace:
        # operaciones...
        trace.add_tag("result", "success")

    log_event("solicitud_created", {"id": 123, "user_id": 5})
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
import traceback
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Union

# ==================== Log Levels ====================

class LogLevel(str, Enum):
    """Niveles de log."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# ==================== Structured Log Entry ====================

@dataclass
class LogEntry:
    """Entrada de log estructurada."""
    timestamp: str
    level: str
    message: str
    logger_name: str
    module: str = ""
    function: str = ""
    line: int = 0
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    user_id: Optional[int] = None
    request_id: Optional[str] = None
    duration_ms: Optional[float] = None
    extra: Dict[str, Any] = field(default_factory=dict)
    exception: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario."""
        result = {
            "timestamp": self.timestamp,
            "level": self.level,
            "message": self.message,
            "logger": self.logger_name,
        }

        if self.module:
            result["module"] = self.module
        if self.function:
            result["function"] = self.function
        if self.line:
            result["line"] = self.line
        if self.trace_id:
            result["trace_id"] = self.trace_id
        if self.span_id:
            result["span_id"] = self.span_id
        if self.user_id:
            result["user_id"] = self.user_id
        if self.request_id:
            result["request_id"] = self.request_id
        if self.duration_ms is not None:
            result["duration_ms"] = self.duration_ms
        if self.extra:
            result["extra"] = self.extra
        if self.exception:
            result["exception"] = self.exception

        return result

    def to_json(self) -> str:
        """Serializa a JSON."""
        return json.dumps(self.to_dict(), default=str)


# ==================== JSON Formatter ====================

class StructuredFormatter(logging.Formatter):
    """Formatter que produce JSON estructurado."""

    def __init__(self, include_trace: bool = True):
        super().__init__()
        self.include_trace = include_trace

    def format(self, record: logging.LogRecord) -> str:
        """Formatea el record como JSON."""
        # Obtener contexto de trace
        trace_ctx = getattr(_trace_context, "context", None)

        entry = LogEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            level=record.levelname,
            message=record.getMessage(),
            logger_name=record.name,
            module=record.module,
            function=record.funcName,
            line=record.lineno,
            trace_id=trace_ctx.get("trace_id") if trace_ctx else None,
            span_id=trace_ctx.get("span_id") if trace_ctx else None,
            user_id=trace_ctx.get("user_id") if trace_ctx else None,
            request_id=trace_ctx.get("request_id") if trace_ctx else None,
        )

        # Agregar extra fields
        if hasattr(record, "extra") and record.extra:
            entry.extra = record.extra

        # Agregar exception si existe
        if record.exc_info:
            entry.exception = self.formatException(record.exc_info)

        return entry.to_json()


class HumanReadableFormatter(logging.Formatter):
    """Formatter legible para desarrollo."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
        "RESET": "\033[0m",
    }

    def __init__(self, use_colors: bool = True):
        super().__init__()
        self.use_colors = use_colors and sys.stdout.isatty()

    def format(self, record: logging.LogRecord) -> str:
        """Formatea el record de forma legible."""
        trace_ctx = getattr(_trace_context, "context", None)

        # Color por nivel
        if self.use_colors:
            color = self.COLORS.get(record.levelname, "")
            reset = self.COLORS["RESET"]
        else:
            color = reset = ""

        # Timestamp corto
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]

        # Trace ID corto
        trace_id = ""
        if trace_ctx and trace_ctx.get("trace_id"):
            trace_id = f" [{trace_ctx['trace_id'][:8]}]"

        # Formato base
        msg = f"{ts} {color}{record.levelname:7}{reset}{trace_id} {record.name}: {record.getMessage()}"

        # Agregar extra si existe
        if hasattr(record, "extra") and record.extra:
            extra_str = " ".join(f"{k}={v}" for k, v in record.extra.items())
            msg += f" | {extra_str}"

        # Agregar exception
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)

        return msg


# ==================== Trace Context ====================

_trace_context: threading.local = threading.local()


def _get_trace_ctx() -> Optional[Dict[str, Any]]:
    """Helper interno para obtener contexto."""
    return getattr(_trace_context, "context", None)


def get_trace_context() -> Optional[Dict[str, Any]]:
    """Obtiene el contexto de trace actual."""
    return _get_trace_ctx()


def set_trace_context(context: Dict[str, Any]) -> None:
    """Establece el contexto de trace."""
    _trace_context.context = context


def clear_trace_context() -> None:
    """Limpia el contexto de trace."""
    _trace_context.context = None


@dataclass
class Span:
    """Representa un span de tracing."""
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    operation_name: str = ""
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    tags: Dict[str, Any] = field(default_factory=dict)
    logs: List[Dict[str, Any]] = field(default_factory=list)
    status: str = "ok"
    error: Optional[str] = None

    @property
    def duration_ms(self) -> Optional[float]:
        """Duracion en milisegundos."""
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return None

    def add_tag(self, key: str, value: Any) -> None:
        """Agrega un tag al span."""
        self.tags[key] = value

    def add_log(self, message: str, **kwargs) -> None:
        """Agrega un log al span."""
        self.logs.append({
            "timestamp": time.time(),
            "message": message,
            **kwargs,
        })

    def set_error(self, error: str) -> None:
        """Marca el span como error."""
        self.status = "error"
        self.error = error

    def finish(self) -> None:
        """Finaliza el span."""
        self.end_time = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario."""
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "operation_name": self.operation_name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms,
            "tags": self.tags,
            "logs": self.logs,
            "status": self.status,
            "error": self.error,
        }


class Tracer:
    """Sistema de tracing distribuido."""

    def __init__(self):
        self._spans: Dict[str, List[Span]] = {}
        self._lock = threading.RLock()
        self._listeners: List[Callable[[Span], None]] = []

    def start_span(
        self,
        operation_name: str,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        tags: Optional[Dict[str, Any]] = None,
    ) -> Span:
        """Inicia un nuevo span."""
        trace_id = trace_id or str(uuid.uuid4())
        span_id = str(uuid.uuid4())

        span = Span(
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=parent_span_id,
            operation_name=operation_name,
            tags=tags or {},
        )

        # Guardar span
        with self._lock:
            if trace_id not in self._spans:
                self._spans[trace_id] = []
            self._spans[trace_id].append(span)

        # Establecer contexto
        set_trace_context({
            "trace_id": trace_id,
            "span_id": span_id,
            "parent_span_id": parent_span_id,
        })

        return span

    def finish_span(self, span: Span) -> None:
        """Finaliza un span."""
        span.finish()

        # Notificar listeners
        for listener in self._listeners:
            try:
                listener(span)
            except Exception:
                pass

    def get_trace(self, trace_id: str) -> List[Span]:
        """Obtiene todos los spans de un trace."""
        with self._lock:
            return self._spans.get(trace_id, []).copy()

    def add_listener(self, listener: Callable[[Span], None]) -> None:
        """Agrega un listener para spans completados."""
        self._listeners.append(listener)

    def cleanup_old_traces(self, max_age_seconds: int = 3600) -> int:
        """Limpia traces viejos."""
        cutoff = time.time() - max_age_seconds
        removed = 0

        with self._lock:
            old_traces = [
                tid for tid, spans in self._spans.items()
                if spans and spans[-1].end_time and spans[-1].end_time < cutoff
            ]
            for tid in old_traces:
                del self._spans[tid]
                removed += 1

        return removed


# ==================== Global Instances ====================

_tracer: Optional[Tracer] = None
_tracer_lock = threading.Lock()


def get_tracer() -> Tracer:
    """Obtiene el tracer singleton."""
    global _tracer
    if _tracer is None:
        with _tracer_lock:
            if _tracer is None:
                _tracer = Tracer()
    return _tracer


# ==================== Logger Factory ====================

_loggers: Dict[str, logging.Logger] = {}
_log_config = {
    "level": logging.INFO,
    "format": "human",  # "json" o "human"
    "handlers": [],
}


def configure_logging(
    level: Union[str, int] = logging.INFO,
    format_type: str = "human",
    log_file: Optional[str] = None,
) -> None:
    """
    Configura el sistema de logging global.

    Args:
        level: Nivel de logging
        format_type: "json" para produccion, "human" para desarrollo
        log_file: Archivo de log opcional
    """
    if isinstance(level, str):
        level = getattr(logging, level.upper())

    _log_config["level"] = level
    _log_config["format"] = format_type

    # Configurar root logger
    root = logging.getLogger()
    root.setLevel(level)

    # Limpiar handlers existentes
    root.handlers.clear()

    # Seleccionar formatter
    if format_type == "json":
        formatter = StructuredFormatter()
    else:
        formatter = HumanReadableFormatter()

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(level)
    root.addHandler(console_handler)

    # File handler opcional
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(StructuredFormatter())  # Siempre JSON en archivo
        file_handler.setLevel(level)
        root.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """
    Obtiene un logger configurado.

    Args:
        name: Nombre del logger (usualmente __name__)

    Returns:
        Logger configurado
    """
    if name not in _loggers:
        logger = logging.getLogger(name)
        logger.setLevel(_log_config["level"])
        _loggers[name] = logger

    return _loggers[name]


# ==================== Context Managers ====================

@contextmanager
def trace_request(
    operation_name: str = "request",
    trace_id: Optional[str] = None,
    **tags,
):
    """
    Context manager para trazar una operacion.

    Uso:
        with trace_request("api_call", endpoint="/users") as span:
            result = call_api()
            span.add_tag("result_count", len(result))
    """
    tracer = get_tracer()
    span = tracer.start_span(
        operation_name=operation_name,
        trace_id=trace_id,
        tags=tags,
    )

    try:
        yield span
    except Exception as e:
        span.set_error(str(e))
        raise
    finally:
        tracer.finish_span(span)
        clear_trace_context()


# ==================== Decorators ====================

def traced(operation_name: Optional[str] = None, **default_tags):
    """
    Decorador para trazar funciones automaticamente.

    Uso:
        @traced("database_query", db="users")
        def get_user(user_id: int):
            ...
    """
    def decorator(func: Callable) -> Callable:
        op_name = operation_name or f"{func.__module__}.{func.__name__}"

        @wraps(func)
        def wrapper(*args, **kwargs):
            with trace_request(op_name, **default_tags) as span:
                try:
                    result = func(*args, **kwargs)
                    span.add_tag("success", True)
                    return result
                except Exception as e:
                    span.add_tag("success", False)
                    span.set_error(str(e))
                    raise

        return wrapper

    return decorator


def log_calls(level: int = logging.DEBUG):
    """
    Decorador para loggear llamadas a funciones.

    Uso:
        @log_calls(logging.INFO)
        def process_data(data):
            ...
    """
    def decorator(func: Callable) -> Callable:
        logger = get_logger(func.__module__)

        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()

            logger.log(level, f"Calling {func.__name__}", extra={
                "function": func.__name__,
                "args_count": len(args),
                "kwargs_keys": list(kwargs.keys()),
            })

            try:
                result = func(*args, **kwargs)
                duration = (time.time() - start) * 1000

                logger.log(level, f"Completed {func.__name__}", extra={
                    "function": func.__name__,
                    "duration_ms": round(duration, 2),
                    "success": True,
                })

                return result

            except Exception as e:
                duration = (time.time() - start) * 1000

                logger.error(f"Failed {func.__name__}: {e}", extra={
                    "function": func.__name__,
                    "duration_ms": round(duration, 2),
                    "success": False,
                    "error": str(e),
                })

                raise

        return wrapper

    return decorator


# ==================== Event Logging ====================

def log_event(
    event_type: str,
    data: Dict[str, Any],
    level: int = logging.INFO,
) -> None:
    """
    Loggea un evento de negocio.

    Uso:
        log_event("user_login", {"user_id": 123, "ip": "1.2.3.4"})
        log_event("solicitud_created", {"id": 456, "items": 5})
    """
    logger = get_logger("events")
    logger.log(level, f"Event: {event_type}", extra={
        "event_type": event_type,
        "event_data": data,
    })


# ==================== Flask Integration ====================

def init_observability(app) -> None:
    """
    Inicializa el sistema de observabilidad en Flask.

    Args:
        app: Aplicacion Flask
    """
    from flask import g, request

    # Configurar logging segun entorno
    env = app.config.get("ENV", "development")
    log_level = app.config.get("LOG_LEVEL", "INFO")
    log_file = app.config.get("LOG_FILE")

    configure_logging(
        level=log_level,
        format_type="json" if env == "production" else "human",
        log_file=log_file,
    )

    @app.before_request
    def start_request_trace():
        """Inicia trace para cada request."""
        trace_id = request.headers.get("X-Trace-ID") or str(uuid.uuid4())
        request_id = str(uuid.uuid4())

        # Obtener user_id si esta autenticado
        user_id = getattr(g, "user_id", None) if hasattr(g, "user_id") else None

        set_trace_context({
            "trace_id": trace_id,
            "request_id": request_id,
            "user_id": user_id,
        })

        g.trace_start_time = time.time()
        g.trace_id = trace_id

    @app.after_request
    def log_request(response):
        """Loggea cada request completado."""
        duration = (time.time() - g.get("trace_start_time", time.time())) * 1000

        logger = get_logger("http")
        logger.info(
            f"{request.method} {request.path} {response.status_code}",
            extra={
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": round(duration, 2),
                "remote_addr": request.remote_addr,
            }
        )

        # Agregar trace ID al response
        response.headers["X-Trace-ID"] = g.get("trace_id", "")

        clear_trace_context()
        return response

    @app.teardown_request
    def cleanup_trace(exception=None):
        """Limpia contexto de trace."""
        if exception:
            logger = get_logger("http")
            logger.error(f"Request failed: {exception}", extra={
                "error": str(exception),
                "traceback": traceback.format_exc(),
            })

        clear_trace_context()

    app.logger.info("Observability system initialized")
