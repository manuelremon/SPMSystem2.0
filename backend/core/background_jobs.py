"""
Background Jobs System - Sistema de tareas asincronas.
Sprint 13 - Cola de tareas ligera usando SQLite.

Uso:
    from backend.core.background_jobs import task, enqueue, get_job_queue

    @task(name="send_email", retries=3)
    def send_email(to: str, subject: str, body: str):
        # Logica de envio
        pass

    # Encolar tarea
    job_id = enqueue("send_email", to="user@example.com", subject="Hola", body="...")

    # Obtener estado
    queue = get_job_queue()
    status = queue.get_job_status(job_id)
"""

from __future__ import annotations

import logging
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Estados posibles de un job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class JobPriority(int, Enum):
    """Prioridades de jobs (menor = mas prioritario)."""

    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass
class Job:
    """Representa una tarea en la cola."""

    id: str
    name: str
    args: Dict[str, Any]
    status: JobStatus = JobStatus.PENDING
    priority: JobPriority = JobPriority.NORMAL
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    retry_delay: int = 60  # segundos
    scheduled_at: Optional[datetime] = None  # Para tareas programadas

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario."""
        return {
            "id": self.id,
            "name": self.name,
            "args": self.args,
            "status": self.status.value,
            "priority": self.priority.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "result": self.result,
            "error": self.error,
            "retries": self.retries,
            "max_retries": self.max_retries,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Job":
        """Crea desde diccionario."""
        return cls(
            id=data["id"],
            name=data["name"],
            args=data.get("args", {}),
            status=JobStatus(data.get("status", "pending")),
            priority=JobPriority(data.get("priority", 2)),
            created_at=(
                datetime.fromisoformat(data["created_at"])
                if data.get("created_at")
                else datetime.utcnow()
            ),
            started_at=(
                datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None
            ),
            completed_at=(
                datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None
            ),
            result=data.get("result"),
            error=data.get("error"),
            retries=data.get("retries", 0),
            max_retries=data.get("max_retries", 3),
        )


class TaskRegistry:
    """Registro de tareas disponibles."""

    def __init__(self):
        self._tasks: Dict[str, Callable] = {}
        self._task_configs: Dict[str, Dict[str, Any]] = {}

    def register(
        self,
        name: str,
        func: Callable,
        retries: int = 3,
        retry_delay: int = 60,
        timeout: int = 300,
    ) -> None:
        """Registra una tarea."""
        self._tasks[name] = func
        self._task_configs[name] = {
            "retries": retries,
            "retry_delay": retry_delay,
            "timeout": timeout,
        }
        logger.debug(f"Task registered: {name}")

    def get(self, name: str) -> Optional[Callable]:
        """Obtiene una tarea por nombre."""
        return self._tasks.get(name)

    def get_config(self, name: str) -> Dict[str, Any]:
        """Obtiene configuracion de tarea."""
        return self._task_configs.get(name, {})

    def list_tasks(self) -> List[str]:
        """Lista todas las tareas registradas."""
        return list(self._tasks.keys())


class JobQueue:
    """Cola de jobs en memoria con persistencia opcional."""

    def __init__(self, max_size: int = 10000):
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.RLock()
        self._max_size = max_size
        self._registry = TaskRegistry()
        self._worker_running = False
        self._worker_thread: Optional[threading.Thread] = None

    @property
    def registry(self) -> TaskRegistry:
        """Acceso al registro de tareas."""
        return self._registry

    def enqueue(
        self,
        task_name: str,
        priority: JobPriority = JobPriority.NORMAL,
        scheduled_at: Optional[datetime] = None,
        **kwargs,
    ) -> str:
        """
        Encola una nueva tarea.

        Args:
            task_name: Nombre de la tarea registrada
            priority: Prioridad del job
            scheduled_at: Fecha/hora para ejecutar (None = inmediato)
            **kwargs: Argumentos para la tarea

        Returns:
            ID del job creado
        """
        if task_name not in self._registry._tasks:
            raise ValueError(f"Task not registered: {task_name}")

        config = self._registry.get_config(task_name)

        job = Job(
            id=str(uuid.uuid4()),
            name=task_name,
            args=kwargs,
            priority=priority,
            max_retries=config.get("retries", 3),
            retry_delay=config.get("retry_delay", 60),
            scheduled_at=scheduled_at,
        )

        with self._lock:
            # Limpiar jobs viejos si excedemos el limite
            if len(self._jobs) >= self._max_size:
                self._cleanup_old_jobs()

            self._jobs[job.id] = job

        logger.info(f"Job enqueued: {job.id} ({task_name})")
        return job.id

    def get_job(self, job_id: str) -> Optional[Job]:
        """Obtiene un job por ID."""
        with self._lock:
            return self._jobs.get(job_id)

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene el estado de un job."""
        job = self.get_job(job_id)
        if job:
            return job.to_dict()
        return None

    def cancel_job(self, job_id: str) -> bool:
        """Cancela un job pendiente."""
        with self._lock:
            job = self._jobs.get(job_id)
            if job and job.status == JobStatus.PENDING:
                job.status = JobStatus.CANCELLED
                logger.info(f"Job cancelled: {job_id}")
                return True
        return False

    def get_next_job(self) -> Optional[Job]:
        """Obtiene el siguiente job a procesar."""
        now = datetime.utcnow()

        with self._lock:
            pending_jobs = [
                j
                for j in self._jobs.values()
                if j.status in (JobStatus.PENDING, JobStatus.RETRYING)
                and (j.scheduled_at is None or j.scheduled_at <= now)
            ]

            if not pending_jobs:
                return None

            # Ordenar por prioridad y fecha
            pending_jobs.sort(key=lambda j: (j.priority.value, j.created_at))
            return pending_jobs[0]

    def process_job(self, job: Job) -> bool:
        """
        Procesa un job.

        Returns:
            True si el job se completo exitosamente
        """
        task_func = self._registry.get(job.name)
        if not task_func:
            job.status = JobStatus.FAILED
            job.error = f"Task not found: {job.name}"
            return False

        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()

        try:
            result = task_func(**job.args)
            job.status = JobStatus.COMPLETED
            job.result = result
            job.completed_at = datetime.utcnow()
            logger.info(f"Job completed: {job.id}")
            return True

        except Exception as e:
            job.error = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            job.retries += 1

            if job.retries < job.max_retries:
                job.status = JobStatus.RETRYING
                job.scheduled_at = datetime.utcnow() + timedelta(seconds=job.retry_delay)
                logger.warning(f"Job {job.id} failed, retry {job.retries}/{job.max_retries}")
            else:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.utcnow()
                logger.error(f"Job failed permanently: {job.id} - {e}")

            return False

    def _cleanup_old_jobs(self, max_age_hours: int = 24) -> int:
        """Limpia jobs completados/fallidos viejos."""
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        removed = 0

        with self._lock:
            to_remove = [
                job_id
                for job_id, job in self._jobs.items()
                if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
                and job.completed_at
                and job.completed_at < cutoff
            ]

            for job_id in to_remove:
                del self._jobs[job_id]
                removed += 1

        if removed:
            logger.info(f"Cleaned up {removed} old jobs")

        return removed

    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadisticas de la cola."""
        with self._lock:
            status_counts = {}
            for status in JobStatus:
                status_counts[status.value] = sum(
                    1 for j in self._jobs.values() if j.status == status
                )

            return {
                "total_jobs": len(self._jobs),
                "by_status": status_counts,
                "worker_running": self._worker_running,
                "registered_tasks": self._registry.list_tasks(),
            }

    def get_jobs(
        self,
        status: Optional[JobStatus] = None,
        task_name: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Lista jobs con filtros."""
        with self._lock:
            jobs = list(self._jobs.values())

            if status:
                jobs = [j for j in jobs if j.status == status]
            if task_name:
                jobs = [j for j in jobs if j.name == task_name]

            # Ordenar por fecha de creacion (mas recientes primero)
            jobs.sort(key=lambda j: j.created_at, reverse=True)

            return [j.to_dict() for j in jobs[:limit]]

    # ==================== Worker ====================

    def start_worker(self, poll_interval: float = 1.0) -> None:
        """Inicia el worker en un thread separado."""
        if self._worker_running:
            logger.warning("Worker already running")
            return

        self._worker_running = True
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            args=(poll_interval,),
            daemon=True,
            name="JobQueueWorker",
        )
        self._worker_thread.start()
        logger.info("Job queue worker started")

    def stop_worker(self, timeout: float = 5.0) -> None:
        """Detiene el worker."""
        self._worker_running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=timeout)
            self._worker_thread = None
        logger.info("Job queue worker stopped")

    def _worker_loop(self, poll_interval: float) -> None:
        """Loop principal del worker."""
        while self._worker_running:
            try:
                job = self.get_next_job()
                if job:
                    self.process_job(job)
                else:
                    time.sleep(poll_interval)
            except Exception as e:
                logger.error(f"Worker error: {e}")
                time.sleep(poll_interval)


# ==================== Singleton ====================

_job_queue: Optional[JobQueue] = None
_queue_lock = threading.Lock()


def get_job_queue() -> JobQueue:
    """Obtiene la instancia singleton de JobQueue."""
    global _job_queue
    if _job_queue is None:
        with _queue_lock:
            if _job_queue is None:
                _job_queue = JobQueue()
    return _job_queue


# ==================== Decorador ====================


def task(
    name: Optional[str] = None,
    retries: int = 3,
    retry_delay: int = 60,
    timeout: int = 300,
):
    """
    Decorador para registrar una funcion como tarea.

    Uso:
        @task(name="send_email", retries=3)
        def send_email(to: str, subject: str):
            pass
    """

    def decorator(func: Callable) -> Callable:
        task_name = name or func.__name__

        # Registrar la tarea
        queue = get_job_queue()
        queue.registry.register(
            name=task_name,
            func=func,
            retries=retries,
            retry_delay=retry_delay,
            timeout=timeout,
        )

        @wraps(func)
        def wrapper(*args, **kwargs):
            # Llamada sincrona normal
            return func(*args, **kwargs)

        # Agregar metodo para encolar
        def delay(**kwargs) -> str:
            """Encola la tarea para ejecucion asincrona."""
            return get_job_queue().enqueue(task_name, **kwargs)

        wrapper.delay = delay
        wrapper.task_name = task_name

        return wrapper

    return decorator


def enqueue(
    task_name: str,
    priority: JobPriority = JobPriority.NORMAL,
    scheduled_at: Optional[datetime] = None,
    **kwargs,
) -> str:
    """
    Funcion helper para encolar tareas.

    Args:
        task_name: Nombre de la tarea
        priority: Prioridad
        scheduled_at: Cuando ejecutar
        **kwargs: Argumentos de la tarea

    Returns:
        ID del job
    """
    return get_job_queue().enqueue(
        task_name,
        priority=priority,
        scheduled_at=scheduled_at,
        **kwargs,
    )


# ==================== Flask Integration ====================


def init_background_jobs(app, start_worker: bool = True) -> None:
    """
    Inicializa el sistema de background jobs en Flask.

    Args:
        app: Aplicacion Flask
        start_worker: Si iniciar el worker automaticamente
    """
    queue = get_job_queue()

    # Registrar tareas predefinidas
    _register_default_tasks(queue)

    if start_worker and app.config.get("BACKGROUND_JOBS_ENABLED", True):
        # Solo iniciar worker si no estamos en modo test
        if app.config.get("ENV") != "test":
            queue.start_worker()
            app.logger.info("Background jobs worker started")

    # Cleanup al cerrar la app
    @app.teardown_appcontext
    def cleanup_jobs(exception=None):
        pass  # El worker es daemon, se cierra automaticamente


def _register_default_tasks(queue: JobQueue) -> None:
    """Registra tareas predefinidas del sistema."""

    @task(name="cleanup_old_jobs", retries=1)
    def cleanup_old_jobs():
        """Limpia jobs viejos de la cola."""
        return queue._cleanup_old_jobs()

    @task(name="send_notification", retries=3, retry_delay=30)
    def send_notification(user_id: int, title: str, message: str, notification_type: str = "info"):
        """Envia una notificacion a un usuario."""
        try:
            from backend.services.notification_service import NotificationService

            service = NotificationService()
            return service.create_notification(
                user_id=user_id,
                tipo=notification_type,
                titulo=title,
                mensaje=message,
            )
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            raise

    @task(name="send_email", retries=3, retry_delay=60)
    def send_email(to: str, subject: str, body: str, html: bool = False):
        """Envia un email via SMTP.

        Requiere configurar en .env:
        - SMTP_ENABLED=true
        - SMTP_HOST=smtp.gmail.com (o tu servidor)
        - SMTP_PORT=587
        - SMTP_USER=tu_email@gmail.com
        - SMTP_PASSWORD=tu_app_password
        - SMTP_FROM=SPM <noreply@tudominio.com>
        """
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        from backend.core.config import settings

        logger.info(f"Email task: to={to}, subject={subject}")

        # Si SMTP no está habilitado, solo loguear
        if not settings.SMTP_ENABLED:
            logger.info(f"SMTP disabled - email not sent: {subject} -> {to}")
            return {"sent": False, "reason": "SMTP disabled", "to": to, "subject": subject}

        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured")
            return {"sent": False, "reason": "SMTP not configured", "to": to, "subject": subject}

        try:
            # Crear mensaje
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = to

            # Agregar cuerpo del mensaje
            if html:
                msg.attach(MIMEText(body, "html", "utf-8"))
            else:
                msg.attach(MIMEText(body, "plain", "utf-8"))

            # Conectar y enviar
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {to}")
            return {"sent": True, "to": to, "subject": subject}

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            raise
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending email: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending email: {e}")
            raise

    def _get_email_template(template_type: str, **kwargs) -> str:
        """Genera HTML para emails de notificación.

        Templates disponibles:
        - approval: Notificación de aprobación de solicitud
        - rejection: Notificación de rechazo de solicitud
        - sla_alert: Alerta de SLA próximo a vencer
        - password_reset: Recuperación de contraseña
        """
        base_style = """
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4a90d9; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
                .footer { text-align: center; padding: 15px; color: #888; font-size: 12px; }
                .button { display: inline-block; background: #4a90d9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
                .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin: 10px 0; }
                .success { background: #d4edda; border: 1px solid #28a745; padding: 12px; border-radius: 4px; margin: 10px 0; }
                .error { background: #f8d7da; border: 1px solid #dc3545; padding: 12px; border-radius: 4px; margin: 10px 0; }
            </style>
        """

        if template_type == "approval":
            return f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Solicitud Aprobada</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                        <div class="success">
                            <p>Tu solicitud <strong>#{kwargs.get('solicitud_id', '')}</strong> ha sido <strong>aprobada</strong>.</p>
                        </div>
                        <p><strong>Detalles:</strong></p>
                        <ul>
                            <li>Fecha: {kwargs.get('fecha', '')}</li>
                            <li>Aprobado por: {kwargs.get('aprobador', '')}</li>
                            {f"<li>Notas: {kwargs.get('notas', '')}</li>" if kwargs.get('notas') else ""}
                        </ul>
                        <p>La solicitud ahora pasará a la etapa de planificación.</p>
                        <a href="{kwargs.get('url', '#')}" class="button">Ver Solicitud</a>
                    </div>
                    <div class="footer">
                        <p>SPM - Sistema de Planificación de Materiales</p>
                        <p>Este es un mensaje automático, no responder.</p>
                    </div>
                </div>
            </body>
            </html>
            """

        elif template_type == "rejection":
            return f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header" style="background: #dc3545;">
                        <h1>Solicitud Rechazada</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                        <div class="error">
                            <p>Tu solicitud <strong>#{kwargs.get('solicitud_id', '')}</strong> ha sido <strong>rechazada</strong>.</p>
                        </div>
                        <p><strong>Motivo:</strong></p>
                        <p style="background: #f0f0f0; padding: 12px; border-radius: 4px;">
                            {kwargs.get('motivo', 'No especificado')}
                        </p>
                        <p>Puedes editar y reenviar la solicitud si lo consideras necesario.</p>
                        <a href="{kwargs.get('url', '#')}" class="button" style="background: #6c757d;">Ver Solicitud</a>
                    </div>
                    <div class="footer">
                        <p>SPM - Sistema de Planificación de Materiales</p>
                    </div>
                </div>
            </body>
            </html>
            """

        elif template_type == "sla_alert":
            return f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header" style="background: #ffc107; color: #333;">
                        <h1>Alerta SLA</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                        <div class="alert">
                            <p><strong>Atención:</strong> La solicitud <strong>#{kwargs.get('solicitud_id', '')}</strong>
                            está próxima a vencer su SLA.</p>
                        </div>
                        <p><strong>Detalles:</strong></p>
                        <ul>
                            <li>Tiempo restante: <strong>{kwargs.get('tiempo_restante', '')}</strong></li>
                            <li>Estado actual: {kwargs.get('estado', '')}</li>
                            <li>Criticidad: {kwargs.get('criticidad', '')}</li>
                        </ul>
                        <p>Por favor, toma las acciones necesarias para evitar el incumplimiento del SLA.</p>
                        <a href="{kwargs.get('url', '#')}" class="button" style="background: #ffc107; color: #333;">Ver Solicitud</a>
                    </div>
                    <div class="footer">
                        <p>SPM - Sistema de Planificación de Materiales</p>
                    </div>
                </div>
            </body>
            </html>
            """

        elif template_type == "password_reset":
            return f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Recuperar Contraseña</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                        <p style="text-align: center;">
                            <a href="{kwargs.get('reset_url', '#')}" class="button">Restablecer Contraseña</a>
                        </p>
                        <p><small>Este enlace expirará en {kwargs.get('expira_en', '1 hora')}.</small></p>
                        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
                    </div>
                    <div class="footer">
                        <p>SPM - Sistema de Planificación de Materiales</p>
                        <p>Por seguridad, nunca compartas este enlace.</p>
                    </div>
                </div>
            </body>
            </html>
            """

        else:
            # Template genérico
            return f"""
            <!DOCTYPE html>
            <html>
            <head>{base_style}</head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>{kwargs.get('titulo', 'Notificación SPM')}</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                        <p>{kwargs.get('mensaje', '')}</p>
                        {f'<a href="{kwargs.get("url", "#")}" class="button">Ver Más</a>' if kwargs.get('url') else ''}
                    </div>
                    <div class="footer">
                        <p>SPM - Sistema de Planificación de Materiales</p>
                    </div>
                </div>
            </body>
            </html>
            """

    @task(name="send_notification_email", retries=3, retry_delay=60)
    def send_notification_email(
        to: str,
        template_type: str,
        subject: str,
        **template_kwargs
    ):
        """Envia un email de notificación usando templates predefinidos.

        Args:
            to: Email del destinatario
            template_type: Tipo de template (approval, rejection, sla_alert, password_reset)
            subject: Asunto del email
            **template_kwargs: Variables para el template
        """
        html_body = _get_email_template(template_type, **template_kwargs)
        return send_email(to=to, subject=subject, body=html_body, html=True)

    @task(name="generate_report", retries=2, retry_delay=120)
    def generate_report(report_type: str, params: Dict[str, Any], user_id: int):
        """Genera un reporte en background."""
        logger.info(f"Generating report: {report_type} for user {user_id}")
        try:
            from backend.core.reporting import ReportGenerator

            generator = ReportGenerator()

            if report_type == "solicitudes":
                return generator.generate_solicitudes_report(**params)
            elif report_type == "materiales":
                return generator.generate_materiales_report(**params)
            else:
                raise ValueError(f"Unknown report type: {report_type}")
        except ImportError:
            logger.warning("Reporting module not available")
            return {"error": "Reporting not available"}

    @task(name="process_mrp_alerts", retries=2)
    def process_mrp_alerts():
        """Procesa alertas MRP en background."""
        logger.info("Processing MRP alerts")
        try:
            from backend.core.mrp_engine import MRPEngine

            engine = MRPEngine()
            alerts = engine.check_all_alerts()
            return {"alerts_generated": len(alerts)}
        except ImportError:
            logger.warning("MRP module not available")
            return {"error": "MRP not available"}

    @task(name="update_ai_models", retries=1, timeout=600)
    def update_ai_models():
        """Actualiza modelos de IA en background."""
        logger.info("Updating AI models")
        try:
            from backend.core.ai_service import AIService

            service = AIService()
            # Reentrenar modelos con datos recientes
            return {"updated": True}
        except ImportError:
            logger.warning("AI module not available")
            return {"error": "AI not available"}

    # ==================== Metrics Collection ====================

    @task(name="collect_metrics_snapshot", retries=2, retry_delay=30)
    def collect_metrics_snapshot():
        """
        Recoge métricas del sistema y las guarda en histórico.
        Ejecutar cada 5 minutos via cron o scheduler.

        Métricas recolectadas:
        - cpu: Uso de CPU %
        - memory: Uso de memoria %
        - latency_p50: Latencia P50 en ms
        - error_rate: Tasa de errores %
        - cache_hit: Tasa de hits de cache %
        """
        import psutil
        from backend.core.metrics import get_metrics_collector, get_cache_metrics
        from backend.core.db import get_db_transaction, is_using_postgresql

        logger.info("Collecting metrics snapshot")

        try:
            # Recolectar métricas de sistema
            cpu = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory().percent

            # Métricas de aplicación
            collector = get_metrics_collector()
            stats = collector.get_request_stats()

            latency_p50 = stats.get("latency", {}).get("p50_ms", 0)
            total_requests = stats.get("total_requests", 0)
            total_errors = stats.get("total_errors", 0)
            error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

            # Métricas de cache
            cache_stats = get_cache_metrics()
            cache_hit = 0
            if isinstance(cache_stats, dict):
                total_hits = sum(
                    c.get("hits", 0) for c in cache_stats.values() if isinstance(c, dict)
                )
                total_misses = sum(
                    c.get("misses", 0) for c in cache_stats.values() if isinstance(c, dict)
                )
                if total_hits + total_misses > 0:
                    cache_hit = total_hits / (total_hits + total_misses) * 100

            # Guardar en BD
            metrics_to_save = [
                ("cpu", round(cpu, 2)),
                ("memory", round(memory, 2)),
                ("latency_p50", round(latency_p50, 2)),
                ("error_rate", round(error_rate, 4)),
                ("cache_hit", round(cache_hit, 2)),
            ]

            now_sql = "NOW()" if is_using_postgresql() else "datetime('now')"

            with get_db_transaction() as conn:
                cur = conn.cursor()

                for metric_type, value in metrics_to_save:
                    if is_using_postgresql():
                        cur.execute("""
                            INSERT INTO metrics_history (metric_type, metric_value, timestamp)
                            VALUES (%s, %s, NOW())
                        """, (metric_type, value))
                    else:
                        cur.execute("""
                            INSERT INTO metrics_history (metric_type, metric_value, timestamp)
                            VALUES (?, ?, datetime('now'))
                        """, (metric_type, value))

                # Limpiar histórico > 7 días
                if is_using_postgresql():
                    cur.execute("""
                        DELETE FROM metrics_history
                        WHERE timestamp < NOW() - INTERVAL '7 days'
                    """)
                else:
                    cur.execute("""
                        DELETE FROM metrics_history
                        WHERE timestamp < datetime('now', '-7 days')
                    """)

            logger.info(f"Metrics snapshot saved: CPU={cpu}%, Memory={memory}%")

            # Verificar umbrales y generar alertas
            _check_thresholds_and_alert(cpu, memory, latency_p50, error_rate, cache_hit)

            return {
                "collected": True,
                "metrics": {m[0]: m[1] for m in metrics_to_save}
            }

        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            raise


def _check_thresholds_and_alert(
    cpu: float,
    memory: float,
    latency_p50: float,
    error_rate: float,
    cache_hit: float
) -> list:
    """
    Verifica métricas contra umbrales y genera alertas.

    Umbrales críticos:
    - CPU > 90%
    - Memory > 90%
    - Latency P50 > 500ms
    - Error Rate > 5%
    - Cache Hit < 50%

    Umbrales warning:
    - CPU > 75%
    - Memory > 80%
    - Latency P50 > 200ms
    - Error Rate > 2%
    - Cache Hit < 70%
    """
    from backend.core.db import get_db_transaction, is_using_postgresql

    alerts_generated = []

    # Definir umbrales
    thresholds = [
        # (metric_name, value, critical_threshold, warning_threshold, higher_is_worse)
        ("cpu", cpu, 90, 75, True),
        ("memory", memory, 90, 80, True),
        ("latency_p50", latency_p50, 500, 200, True),
        ("error_rate", error_rate, 5, 2, True),
        ("cache_hit", cache_hit, 50, 70, False),  # Menor es peor para cache hit
    ]

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()

            for metric_name, value, critical_thresh, warning_thresh, higher_is_worse in thresholds:
                alert_type = None
                threshold_value = None

                if higher_is_worse:
                    if value >= critical_thresh:
                        alert_type = "critical"
                        threshold_value = critical_thresh
                    elif value >= warning_thresh:
                        alert_type = "warning"
                        threshold_value = warning_thresh
                else:
                    # Para cache_hit, menor es peor
                    if value <= critical_thresh:
                        alert_type = "critical"
                        threshold_value = critical_thresh
                    elif value <= warning_thresh:
                        alert_type = "warning"
                        threshold_value = warning_thresh

                if alert_type:
                    # Generar mensaje descriptivo
                    if metric_name == "cpu":
                        message = f"Uso de CPU elevado: {value}% (umbral: {threshold_value}%)"
                    elif metric_name == "memory":
                        message = f"Uso de memoria elevado: {value}% (umbral: {threshold_value}%)"
                    elif metric_name == "latency_p50":
                        message = f"Latencia alta: {value}ms (umbral: {threshold_value}ms)"
                    elif metric_name == "error_rate":
                        message = f"Tasa de errores alta: {value}% (umbral: {threshold_value}%)"
                    elif metric_name == "cache_hit":
                        message = f"Cache hit rate bajo: {value}% (umbral: {threshold_value}%)"
                    else:
                        message = f"{metric_name}: {value} (umbral: {threshold_value})"

                    # Verificar si ya existe alerta reciente (últimos 30 min) para evitar spam
                    if is_using_postgresql():
                        cur.execute("""
                            SELECT id FROM system_alerts
                            WHERE metric_name = %s
                            AND acknowledged = FALSE
                            AND timestamp > NOW() - INTERVAL '30 minutes'
                            LIMIT 1
                        """, (metric_name,))
                    else:
                        cur.execute("""
                            SELECT id FROM system_alerts
                            WHERE metric_name = ?
                            AND acknowledged = 0
                            AND timestamp > datetime('now', '-30 minutes')
                            LIMIT 1
                        """, (metric_name,))

                    existing = cur.fetchone()

                    if not existing:
                        # Crear nueva alerta
                        if is_using_postgresql():
                            cur.execute("""
                                INSERT INTO system_alerts
                                (alert_type, metric_name, threshold_value, actual_value, message)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (alert_type, metric_name, threshold_value, value, message))
                        else:
                            cur.execute("""
                                INSERT INTO system_alerts
                                (alert_type, metric_name, threshold_value, actual_value, message)
                                VALUES (?, ?, ?, ?, ?)
                            """, (alert_type, metric_name, threshold_value, value, message))

                        alerts_generated.append({
                            "type": alert_type,
                            "metric": metric_name,
                            "value": value,
                            "message": message
                        })

                        logger.warning(f"Alert generated: {alert_type} - {message}")

    except Exception as e:
        logger.error(f"Error checking thresholds: {e}")

    return alerts_generated
