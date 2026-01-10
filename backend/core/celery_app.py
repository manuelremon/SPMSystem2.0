"""
Celery Application Configuration.

Provides persistent task queue using Redis as broker.
Falls back gracefully when Redis is not available.

Usage:
    from backend.core.celery_app import celery_app

    @celery_app.task
    def my_task(arg):
        return result
"""

import logging
import os

from celery import Celery

logger = logging.getLogger(__name__)

# Default Redis URL (can be overridden by environment)
DEFAULT_BROKER = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL") or "redis://localhost:6379/0"
DEFAULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND") or os.getenv("REDIS_URL") or "redis://localhost:6379/0"


def make_celery(app_name: str = "spm") -> Celery:
    """
    Create and configure Celery application.

    Args:
        app_name: Name for the Celery app

    Returns:
        Configured Celery instance
    """
    celery = Celery(
        app_name,
        broker=DEFAULT_BROKER,
        backend=DEFAULT_BACKEND,
        include=["backend.core.tasks"],  # Auto-discover tasks
    )

    # Celery configuration
    celery.conf.update(
        # Serialization
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",

        # Timezone
        timezone="UTC",
        enable_utc=True,

        # Task execution
        task_acks_late=True,  # Acknowledge after task completes (safer)
        task_reject_on_worker_lost=True,  # Requeue if worker dies
        worker_prefetch_multiplier=1,  # One task at a time per worker

        # Results
        result_expires=86400,  # Results expire after 24 hours

        # Retry policy for broker connection
        broker_connection_retry_on_startup=True,
        broker_connection_max_retries=10,

        # Task routes (optional, for future scaling)
        task_routes={
            "backend.core.tasks.send_email": {"queue": "emails"},
            "backend.core.tasks.send_notification": {"queue": "notifications"},
            "backend.core.tasks.generate_report": {"queue": "reports"},
            "backend.core.tasks.update_ai_models": {"queue": "ai"},
            "backend.core.tasks.*": {"queue": "default"},
        },

        # Default queue
        task_default_queue="default",
    )

    return celery


# Global Celery instance
celery_app = make_celery()


def is_celery_available() -> bool:
    """
    Check if Celery/Redis is available and connected.

    Returns:
        True if Celery can connect to broker
    """
    try:
        # Try to ping the broker
        celery_app.control.ping(timeout=1.0)
        return True
    except Exception as e:
        logger.debug(f"Celery not available: {e}")
        return False


def get_celery_stats() -> dict:
    """
    Get Celery worker statistics.

    Returns:
        Dict with worker info and queue stats
    """
    try:
        inspect = celery_app.control.inspect()

        # Get active workers
        active = inspect.active() or {}
        reserved = inspect.reserved() or {}
        stats = inspect.stats() or {}

        worker_count = len(stats)
        active_tasks = sum(len(tasks) for tasks in active.values())
        reserved_tasks = sum(len(tasks) for tasks in reserved.values())

        return {
            "available": True,
            "workers": worker_count,
            "active_tasks": active_tasks,
            "reserved_tasks": reserved_tasks,
            "broker": DEFAULT_BROKER.split("@")[-1] if "@" in DEFAULT_BROKER else DEFAULT_BROKER,
        }
    except Exception as e:
        return {
            "available": False,
            "error": str(e),
            "broker": DEFAULT_BROKER.split("@")[-1] if "@" in DEFAULT_BROKER else DEFAULT_BROKER,
        }
