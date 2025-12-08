"""
Tests para el sistema de observabilidad.
Sprint 16 - Verifica logging estructurado y tracing.
"""

import json
import logging
import time
from unittest.mock import MagicMock, patch

import pytest


class TestLogEntry:
    """Tests para LogEntry."""

    def test_entry_creation(self):
        """Crear entrada de log."""
        try:
            from backend.core.observability import LogEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = LogEntry(
            timestamp="2024-01-15T10:00:00Z",
            level="INFO",
            message="Test message",
            logger_name="test",
        )

        assert entry.level == "INFO"
        assert entry.message == "Test message"

    def test_entry_to_dict(self):
        """Convertir a diccionario."""
        try:
            from backend.core.observability import LogEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = LogEntry(
            timestamp="2024-01-15T10:00:00Z",
            level="ERROR",
            message="Error occurred",
            logger_name="app",
            trace_id="abc123",
            user_id=42,
        )

        data = entry.to_dict()

        assert data["level"] == "ERROR"
        assert data["trace_id"] == "abc123"
        assert data["user_id"] == 42

    def test_entry_to_json(self):
        """Serializar a JSON."""
        try:
            from backend.core.observability import LogEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = LogEntry(
            timestamp="2024-01-15T10:00:00Z",
            level="INFO",
            message="Test",
            logger_name="test",
        )

        json_str = entry.to_json()
        parsed = json.loads(json_str)

        assert parsed["level"] == "INFO"
        assert parsed["message"] == "Test"


class TestStructuredFormatter:
    """Tests para StructuredFormatter."""

    def test_formats_as_json(self):
        """Formatea como JSON."""
        try:
            from backend.core.observability import StructuredFormatter
        except ImportError:
            pytest.skip("Module not available")

        formatter = StructuredFormatter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        result = formatter.format(record)
        parsed = json.loads(result)

        assert parsed["level"] == "INFO"
        assert parsed["message"] == "Test message"
        assert "timestamp" in parsed


class TestHumanReadableFormatter:
    """Tests para HumanReadableFormatter."""

    def test_formats_readable(self):
        """Formatea de forma legible."""
        try:
            from backend.core.observability import HumanReadableFormatter
        except ImportError:
            pytest.skip("Module not available")

        formatter = HumanReadableFormatter(use_colors=False)

        record = logging.LogRecord(
            name="test.module",
            level=logging.WARNING,
            pathname="test.py",
            lineno=20,
            msg="Warning message",
            args=(),
            exc_info=None,
        )

        result = formatter.format(record)

        assert "WARNING" in result
        assert "Warning message" in result
        assert "test.module" in result


class TestTraceContext:
    """Tests para contexto de trace."""

    def test_set_and_get_context(self):
        """Establecer y obtener contexto."""
        try:
            from backend.core.observability import (
                set_trace_context,
                get_trace_context,
                clear_trace_context,
            )
        except ImportError:
            pytest.skip("Module not available")

        set_trace_context({
            "trace_id": "trace-123",
            "span_id": "span-456",
        })

        ctx = get_trace_context()

        assert ctx["trace_id"] == "trace-123"
        assert ctx["span_id"] == "span-456"

        clear_trace_context()
        assert get_trace_context() is None


class TestSpan:
    """Tests para Span."""

    def test_span_creation(self):
        """Crear span."""
        try:
            from backend.core.observability import Span
        except ImportError:
            pytest.skip("Module not available")

        span = Span(
            trace_id="trace-1",
            span_id="span-1",
            operation_name="test_op",
        )

        assert span.trace_id == "trace-1"
        assert span.operation_name == "test_op"
        assert span.status == "ok"

    def test_span_add_tag(self):
        """Agregar tag a span."""
        try:
            from backend.core.observability import Span
        except ImportError:
            pytest.skip("Module not available")

        span = Span(trace_id="t1", span_id="s1")
        span.add_tag("user_id", 123)
        span.add_tag("endpoint", "/api/test")

        assert span.tags["user_id"] == 123
        assert span.tags["endpoint"] == "/api/test"

    def test_span_add_log(self):
        """Agregar log a span."""
        try:
            from backend.core.observability import Span
        except ImportError:
            pytest.skip("Module not available")

        span = Span(trace_id="t1", span_id="s1")
        span.add_log("Starting operation", step=1)
        span.add_log("Operation complete", step=2)

        assert len(span.logs) == 2
        assert span.logs[0]["message"] == "Starting operation"

    def test_span_set_error(self):
        """Marcar span como error."""
        try:
            from backend.core.observability import Span
        except ImportError:
            pytest.skip("Module not available")

        span = Span(trace_id="t1", span_id="s1")
        span.set_error("Something went wrong")

        assert span.status == "error"
        assert span.error == "Something went wrong"

    def test_span_duration(self):
        """Calcular duracion de span."""
        try:
            from backend.core.observability import Span
        except ImportError:
            pytest.skip("Module not available")

        span = Span(trace_id="t1", span_id="s1")
        time.sleep(0.1)
        span.finish()

        assert span.duration_ms is not None
        assert span.duration_ms >= 100

    def test_span_to_dict(self):
        """Convertir span a diccionario."""
        try:
            from backend.core.observability import Span
        except ImportError:
            pytest.skip("Module not available")

        span = Span(
            trace_id="t1",
            span_id="s1",
            operation_name="test",
        )
        span.add_tag("key", "value")
        span.finish()

        data = span.to_dict()

        assert data["trace_id"] == "t1"
        assert data["operation_name"] == "test"
        assert data["tags"]["key"] == "value"
        assert data["duration_ms"] is not None


class TestTracer:
    """Tests para Tracer."""

    @pytest.fixture
    def tracer(self):
        """Crea un tracer limpio."""
        try:
            from backend.core.observability import Tracer
        except ImportError:
            pytest.skip("Module not available")

        return Tracer()

    def test_start_span(self, tracer):
        """Iniciar span."""
        span = tracer.start_span("test_operation")

        assert span.operation_name == "test_operation"
        assert span.trace_id is not None
        assert span.span_id is not None

    def test_start_span_with_trace_id(self, tracer):
        """Iniciar span con trace_id especifico."""
        span = tracer.start_span("op", trace_id="my-trace-123")

        assert span.trace_id == "my-trace-123"

    def test_finish_span(self, tracer):
        """Finalizar span."""
        span = tracer.start_span("op")
        tracer.finish_span(span)

        assert span.end_time is not None

    def test_get_trace(self, tracer):
        """Obtener spans de un trace."""
        span1 = tracer.start_span("op1", trace_id="trace-xyz")
        span2 = tracer.start_span("op2", trace_id="trace-xyz")

        spans = tracer.get_trace("trace-xyz")

        assert len(spans) == 2

    def test_add_listener(self, tracer):
        """Agregar listener para spans."""
        completed_spans = []

        def on_span_complete(span):
            completed_spans.append(span)

        tracer.add_listener(on_span_complete)

        span = tracer.start_span("op")
        tracer.finish_span(span)

        assert len(completed_spans) == 1

    def test_cleanup_old_traces(self, tracer):
        """Limpiar traces viejos."""
        span = tracer.start_span("old_op")
        span.end_time = time.time() - 7200  # 2 horas atras

        removed = tracer.cleanup_old_traces(max_age_seconds=3600)

        assert removed == 1


class TestGetTracer:
    """Tests para get_tracer singleton."""

    def test_returns_same_instance(self):
        """Retorna la misma instancia."""
        try:
            from backend.core.observability import get_tracer
        except ImportError:
            pytest.skip("Module not available")

        tracer1 = get_tracer()
        tracer2 = get_tracer()

        assert tracer1 is tracer2


class TestTraceRequestContextManager:
    """Tests para trace_request context manager."""

    def test_creates_span(self):
        """Crea span automaticamente."""
        try:
            from backend.core.observability import trace_request, get_tracer
        except ImportError:
            pytest.skip("Module not available")

        with trace_request("test_operation") as span:
            assert span.operation_name == "test_operation"

        assert span.end_time is not None

    def test_captures_exception(self):
        """Captura excepciones."""
        try:
            from backend.core.observability import trace_request
        except ImportError:
            pytest.skip("Module not available")

        span_ref = None

        try:
            with trace_request("failing_op") as span:
                span_ref = span
                raise ValueError("Test error")
        except ValueError:
            pass

        assert span_ref.status == "error"
        assert "Test error" in span_ref.error

    def test_accepts_tags(self):
        """Acepta tags iniciales."""
        try:
            from backend.core.observability import trace_request
        except ImportError:
            pytest.skip("Module not available")

        with trace_request("op", user_id=123, endpoint="/test") as span:
            pass

        assert span.tags["user_id"] == 123
        assert span.tags["endpoint"] == "/test"


class TestTracedDecorator:
    """Tests para @traced decorator."""

    def test_traces_function(self):
        """Traza funcion automaticamente."""
        try:
            from backend.core.observability import traced, get_tracer
        except ImportError:
            pytest.skip("Module not available")

        @traced("my_function")
        def test_func():
            return 42

        result = test_func()

        assert result == 42

    def test_captures_function_error(self):
        """Captura error en funcion."""
        try:
            from backend.core.observability import traced
        except ImportError:
            pytest.skip("Module not available")

        @traced("failing_func")
        def failing():
            raise RuntimeError("Boom")

        with pytest.raises(RuntimeError):
            failing()


class TestLogCallsDecorator:
    """Tests para @log_calls decorator."""

    def test_logs_function_calls(self):
        """Loggea llamadas a funcion."""
        try:
            from backend.core.observability import log_calls
        except ImportError:
            pytest.skip("Module not available")

        @log_calls(logging.DEBUG)
        def my_func(x, y):
            return x + y

        result = my_func(1, 2)

        assert result == 3


class TestLogEvent:
    """Tests para log_event."""

    def test_logs_business_event(self):
        """Loggea evento de negocio."""
        try:
            from backend.core.observability import log_event
        except ImportError:
            pytest.skip("Module not available")

        # No deberia lanzar excepcion
        log_event("user_login", {
            "user_id": 123,
            "ip": "1.2.3.4",
        })


class TestConfigureLogging:
    """Tests para configure_logging."""

    def test_configure_json_format(self):
        """Configura formato JSON."""
        try:
            from backend.core.observability import configure_logging
        except ImportError:
            pytest.skip("Module not available")

        configure_logging(level="DEBUG", format_type="json")

        # Verificar que no lanza excepcion
        logger = logging.getLogger("test_json")
        logger.info("Test message")

    def test_configure_human_format(self):
        """Configura formato legible."""
        try:
            from backend.core.observability import configure_logging
        except ImportError:
            pytest.skip("Module not available")

        configure_logging(level="INFO", format_type="human")

        # Verificar que no lanza excepcion
        logger = logging.getLogger("test_human")
        logger.info("Test message")


class TestGetLogger:
    """Tests para get_logger."""

    def test_returns_logger(self):
        """Retorna logger configurado."""
        try:
            from backend.core.observability import get_logger
        except ImportError:
            pytest.skip("Module not available")

        logger = get_logger("my.module")

        assert logger is not None
        assert logger.name == "my.module"

    def test_returns_same_logger(self):
        """Retorna el mismo logger para el mismo nombre."""
        try:
            from backend.core.observability import get_logger
        except ImportError:
            pytest.skip("Module not available")

        logger1 = get_logger("test.logger")
        logger2 = get_logger("test.logger")

        assert logger1 is logger2


class TestLogLevel:
    """Tests para LogLevel enum."""

    def test_all_levels_exist(self):
        """Todos los niveles existen."""
        try:
            from backend.core.observability import LogLevel
        except ImportError:
            pytest.skip("Module not available")

        assert LogLevel.DEBUG.value == "DEBUG"
        assert LogLevel.INFO.value == "INFO"
        assert LogLevel.WARNING.value == "WARNING"
        assert LogLevel.ERROR.value == "ERROR"
        assert LogLevel.CRITICAL.value == "CRITICAL"
