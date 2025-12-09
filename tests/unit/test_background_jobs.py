"""
Tests para el modulo de background jobs.
Sprint 13 - Verifica cola de tareas y workers.
"""

import time
from datetime import datetime, timedelta

import pytest


class TestJobStatus:
    """Tests para JobStatus enum."""

    def test_all_statuses_exist(self):
        """Todos los estados existen."""
        try:
            from backend.core.background_jobs import JobStatus
        except ImportError:
            pytest.skip("Module not available")

        assert JobStatus.PENDING.value == "pending"
        assert JobStatus.RUNNING.value == "running"
        assert JobStatus.COMPLETED.value == "completed"
        assert JobStatus.FAILED.value == "failed"
        assert JobStatus.RETRYING.value == "retrying"
        assert JobStatus.CANCELLED.value == "cancelled"


class TestJobPriority:
    """Tests para JobPriority enum."""

    def test_priority_order(self):
        """Prioridades tienen orden correcto."""
        try:
            from backend.core.background_jobs import JobPriority
        except ImportError:
            pytest.skip("Module not available")

        assert JobPriority.CRITICAL.value < JobPriority.HIGH.value
        assert JobPriority.HIGH.value < JobPriority.NORMAL.value
        assert JobPriority.NORMAL.value < JobPriority.LOW.value


class TestJob:
    """Tests para Job dataclass."""

    def test_job_creation(self):
        """Crear job con valores por defecto."""
        try:
            from backend.core.background_jobs import (Job, JobPriority,
                                                      JobStatus)
        except ImportError:
            pytest.skip("Module not available")

        job = Job(
            id="test-123",
            name="test_task",
            args={"key": "value"},
        )

        assert job.id == "test-123"
        assert job.name == "test_task"
        assert job.args == {"key": "value"}
        assert job.status == JobStatus.PENDING
        assert job.priority == JobPriority.NORMAL
        assert job.retries == 0

    def test_job_to_dict(self):
        """Convertir job a diccionario."""
        try:
            from backend.core.background_jobs import Job
        except ImportError:
            pytest.skip("Module not available")

        job = Job(
            id="test-456",
            name="my_task",
            args={"a": 1},
        )

        data = job.to_dict()

        assert data["id"] == "test-456"
        assert data["name"] == "my_task"
        assert data["args"] == {"a": 1}
        assert data["status"] == "pending"

    def test_job_from_dict(self):
        """Crear job desde diccionario."""
        try:
            from backend.core.background_jobs import Job, JobStatus
        except ImportError:
            pytest.skip("Module not available")

        data = {
            "id": "test-789",
            "name": "another_task",
            "args": {"x": 10},
            "status": "completed",
            "created_at": "2024-01-15T10:00:00",
        }

        job = Job.from_dict(data)

        assert job.id == "test-789"
        assert job.name == "another_task"
        assert job.status == JobStatus.COMPLETED


class TestTaskRegistry:
    """Tests para TaskRegistry."""

    def test_register_task(self):
        """Registrar una tarea."""
        try:
            from backend.core.background_jobs import TaskRegistry
        except ImportError:
            pytest.skip("Module not available")

        registry = TaskRegistry()

        def my_task(x):
            return x * 2

        registry.register("my_task", my_task, retries=5)

        assert "my_task" in registry.list_tasks()
        assert registry.get("my_task") == my_task

    def test_get_config(self):
        """Obtener configuracion de tarea."""
        try:
            from backend.core.background_jobs import TaskRegistry
        except ImportError:
            pytest.skip("Module not available")

        registry = TaskRegistry()

        def test_func():
            pass

        registry.register("test", test_func, retries=3, retry_delay=30, timeout=120)

        config = registry.get_config("test")

        assert config["retries"] == 3
        assert config["retry_delay"] == 30
        assert config["timeout"] == 120

    def test_get_nonexistent_task(self):
        """Obtener tarea inexistente retorna None."""
        try:
            from backend.core.background_jobs import TaskRegistry
        except ImportError:
            pytest.skip("Module not available")

        registry = TaskRegistry()

        assert registry.get("nonexistent") is None


class TestJobQueue:
    """Tests para JobQueue."""

    @pytest.fixture
    def queue(self):
        """Crea una cola de jobs limpia."""
        try:
            from backend.core.background_jobs import JobQueue
        except ImportError:
            pytest.skip("Module not available")

        q = JobQueue(max_size=100)

        # Registrar tarea de prueba
        def sample_task(value):
            return value * 2

        q.registry.register("sample_task", sample_task)

        return q

    def test_enqueue_job(self, queue):
        """Encolar un job."""
        job_id = queue.enqueue("sample_task", value=10)

        assert job_id is not None
        assert len(job_id) == 36  # UUID format

    def test_enqueue_unregistered_task_fails(self, queue):
        """Encolar tarea no registrada falla."""
        with pytest.raises(ValueError, match="Task not registered"):
            queue.enqueue("nonexistent_task")

    def test_get_job(self, queue):
        """Obtener job por ID."""
        job_id = queue.enqueue("sample_task", value=5)

        job = queue.get_job(job_id)

        assert job is not None
        assert job.id == job_id
        assert job.name == "sample_task"
        assert job.args == {"value": 5}

    def test_get_job_status(self, queue):
        """Obtener estado de job."""
        job_id = queue.enqueue("sample_task", value=3)

        status = queue.get_job_status(job_id)

        assert status is not None
        assert status["id"] == job_id
        assert status["status"] == "pending"

    def test_cancel_job(self, queue):
        """Cancelar job pendiente."""
        job_id = queue.enqueue("sample_task", value=1)

        result = queue.cancel_job(job_id)

        assert result is True
        job = queue.get_job(job_id)
        assert job.status.value == "cancelled"

    def test_cancel_running_job_fails(self, queue):
        """No se puede cancelar job en ejecucion."""
        try:
            from backend.core.background_jobs import JobStatus
        except ImportError:
            pytest.skip("Module not available")

        job_id = queue.enqueue("sample_task", value=1)
        job = queue.get_job(job_id)
        job.status = JobStatus.RUNNING

        result = queue.cancel_job(job_id)

        assert result is False

    def test_get_next_job(self, queue):
        """Obtener siguiente job a procesar."""
        job_id = queue.enqueue("sample_task", value=100)

        next_job = queue.get_next_job()

        assert next_job is not None
        assert next_job.id == job_id

    def test_get_next_job_respects_priority(self, queue):
        """Next job respeta prioridad."""
        try:
            from backend.core.background_jobs import JobPriority
        except ImportError:
            pytest.skip("Module not available")

        # Encolar en orden inverso de prioridad
        low_id = queue.enqueue("sample_task", priority=JobPriority.LOW, value=1)
        high_id = queue.enqueue("sample_task", priority=JobPriority.HIGH, value=2)
        critical_id = queue.enqueue("sample_task", priority=JobPriority.CRITICAL, value=3)

        next_job = queue.get_next_job()

        assert next_job.id == critical_id

    def test_process_job_success(self, queue):
        """Procesar job exitosamente."""
        try:
            from backend.core.background_jobs import JobStatus
        except ImportError:
            pytest.skip("Module not available")

        job_id = queue.enqueue("sample_task", value=7)
        job = queue.get_job(job_id)

        result = queue.process_job(job)

        assert result is True
        assert job.status == JobStatus.COMPLETED
        assert job.result == 14  # 7 * 2

    def test_process_job_failure_with_retry(self, queue):
        """Procesar job fallido con reintento."""
        try:
            from backend.core.background_jobs import JobStatus
        except ImportError:
            pytest.skip("Module not available")

        def failing_task():
            raise ValueError("Test error")

        queue.registry.register("failing_task", failing_task, retries=3)

        job_id = queue.enqueue("failing_task")
        job = queue.get_job(job_id)

        result = queue.process_job(job)

        assert result is False
        assert job.status == JobStatus.RETRYING
        assert job.retries == 1
        assert "Test error" in job.error

    def test_process_job_max_retries_exceeded(self, queue):
        """Job falla permanentemente despues de max retries."""
        try:
            from backend.core.background_jobs import JobStatus
        except ImportError:
            pytest.skip("Module not available")

        def always_fails():
            raise RuntimeError("Always fails")

        queue.registry.register("always_fails", always_fails, retries=2)

        job_id = queue.enqueue("always_fails")
        job = queue.get_job(job_id)
        job.retries = 2  # Ya uso todos los reintentos

        result = queue.process_job(job)

        assert result is False
        assert job.status == JobStatus.FAILED

    def test_get_stats(self, queue):
        """Obtener estadisticas de la cola."""
        queue.enqueue("sample_task", value=1)
        queue.enqueue("sample_task", value=2)

        stats = queue.get_stats()

        assert stats["total_jobs"] == 2
        assert stats["by_status"]["pending"] == 2
        assert "sample_task" in stats["registered_tasks"]

    def test_get_jobs_with_filter(self, queue):
        """Listar jobs con filtro."""
        try:
            from backend.core.background_jobs import JobStatus
        except ImportError:
            pytest.skip("Module not available")

        queue.enqueue("sample_task", value=1)
        queue.enqueue("sample_task", value=2)

        jobs = queue.get_jobs(status=JobStatus.PENDING)

        assert len(jobs) == 2
        assert all(j["status"] == "pending" for j in jobs)

    def test_scheduled_job_not_returned_early(self, queue):
        """Job programado no se retorna antes de tiempo."""
        future_time = datetime.utcnow() + timedelta(hours=1)
        job_id = queue.enqueue("sample_task", scheduled_at=future_time, value=1)

        next_job = queue.get_next_job()

        assert next_job is None  # No hay jobs listos


class TestTaskDecorator:
    """Tests para el decorador @task."""

    def test_task_decorator_registers(self):
        """Decorador registra la tarea."""
        try:
            from backend.core.background_jobs import get_job_queue, task
        except ImportError:
            pytest.skip("Module not available")

        @task(name="decorated_task", retries=5)
        def decorated_task(x):
            return x + 1

        queue = get_job_queue()
        assert "decorated_task" in queue.registry.list_tasks()

    def test_task_can_be_called_directly(self):
        """Tarea decorada se puede llamar directamente."""
        try:
            from backend.core.background_jobs import task
        except ImportError:
            pytest.skip("Module not available")

        @task(name="direct_call_task")
        def direct_call_task(x):
            return x * 3

        result = direct_call_task(4)

        assert result == 12

    def test_task_has_delay_method(self):
        """Tarea tiene metodo delay para encolar."""
        try:
            from backend.core.background_jobs import task
        except ImportError:
            pytest.skip("Module not available")

        @task(name="delay_task")
        def delay_task(msg):
            return msg

        assert hasattr(delay_task, "delay")
        assert callable(delay_task.delay)


class TestEnqueueHelper:
    """Tests para funcion enqueue."""

    def test_enqueue_helper(self):
        """Helper enqueue funciona."""
        try:
            from backend.core.background_jobs import (enqueue, get_job_queue,
                                                      task)
        except ImportError:
            pytest.skip("Module not available")

        @task(name="helper_test_task")
        def helper_test_task(n):
            return n

        job_id = enqueue("helper_test_task", n=42)

        assert job_id is not None
        queue = get_job_queue()
        job = queue.get_job(job_id)
        assert job.args == {"n": 42}


class TestWorker:
    """Tests para el worker."""

    def test_worker_starts_and_stops(self):
        """Worker inicia y se detiene."""
        try:
            from backend.core.background_jobs import JobQueue
        except ImportError:
            pytest.skip("Module not available")

        queue = JobQueue()

        queue.start_worker(poll_interval=0.1)
        assert queue._worker_running is True

        queue.stop_worker(timeout=1.0)
        assert queue._worker_running is False

    def test_worker_processes_jobs(self):
        """Worker procesa jobs en la cola."""
        try:
            from backend.core.background_jobs import JobQueue, JobStatus
        except ImportError:
            pytest.skip("Module not available")

        queue = JobQueue()

        results = []

        def capture_result(value):
            results.append(value)
            return value

        queue.registry.register("capture_task", capture_result)

        job_id = queue.enqueue("capture_task", value=999)

        # Iniciar worker
        queue.start_worker(poll_interval=0.05)

        # Esperar que procese
        time.sleep(0.3)

        queue.stop_worker()

        # Verificar que el job se proceso
        job = queue.get_job(job_id)
        assert job.status == JobStatus.COMPLETED
        assert 999 in results


class TestCleanup:
    """Tests para limpieza de jobs."""

    def test_cleanup_old_jobs(self):
        """Limpia jobs viejos."""
        try:
            from backend.core.background_jobs import JobQueue, JobStatus
        except ImportError:
            pytest.skip("Module not available")

        queue = JobQueue()

        def dummy():
            pass

        queue.registry.register("dummy", dummy)

        # Crear job "viejo"
        job_id = queue.enqueue("dummy")
        job = queue.get_job(job_id)
        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.utcnow() - timedelta(hours=48)

        # Limpiar
        removed = queue._cleanup_old_jobs(max_age_hours=24)

        assert removed == 1
        assert queue.get_job(job_id) is None


class TestSingleton:
    """Tests para singleton get_job_queue."""

    def test_returns_same_instance(self):
        """Retorna la misma instancia."""
        try:
            from backend.core.background_jobs import get_job_queue
        except ImportError:
            pytest.skip("Module not available")

        queue1 = get_job_queue()
        queue2 = get_job_queue()

        assert queue1 is queue2


class TestDefaultTasks:
    """Tests para tareas predefinidas."""

    def test_default_tasks_registered_after_init(self):
        """Tareas por defecto se registran en el singleton."""
        try:
            from backend.core.background_jobs import (_register_default_tasks,
                                                      get_job_queue)
        except ImportError:
            pytest.skip("Module not available")

        # Las tareas se registran en el singleton
        queue = get_job_queue()
        _register_default_tasks(queue)

        tasks = queue.registry.list_tasks()

        # Verificar que al menos algunas tareas estan registradas
        # (pueden haber sido registradas por tests anteriores)
        assert "cleanup_old_jobs" in tasks
        assert "send_notification" in tasks
        assert "send_email" in tasks
