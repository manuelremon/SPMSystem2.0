"""
Celery Tasks for SPM.

Migrated from background_jobs.py for persistent execution.
Tasks are automatically retried and persist across restarts.

Usage:
    from backend.core.tasks import send_email, send_notification

    # Async execution
    send_email.delay(to="user@example.com", subject="Hello", body="World")

    # With options
    send_email.apply_async(
        kwargs={"to": "user@example.com", "subject": "Hello", "body": "World"},
        countdown=60,  # Delay 60 seconds
    )
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict

from backend.core.celery_app import celery_app

logger = logging.getLogger(__name__)


# =============================================================================
# Email Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_email(self, to: str, subject: str, body: str, html: bool = False) -> Dict[str, Any]:
    """
    Send an email via SMTP.

    Args:
        to: Recipient email
        subject: Email subject
        body: Email body (text or HTML)
        html: If True, body is HTML

    Returns:
        Dict with send status
    """
    try:
        from backend.core.config import settings
    except ImportError:
        from core.config import settings

    logger.info(f"Celery task: send_email to={to}, subject={subject}")

    if not settings.SMTP_ENABLED:
        logger.info(f"SMTP disabled - email not sent: {subject} -> {to}")
        return {"sent": False, "reason": "SMTP disabled", "to": to, "subject": subject}

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured")
        return {"sent": False, "reason": "SMTP not configured", "to": to, "subject": subject}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to

        if html:
            msg.attach(MIMEText(body, "html", "utf-8"))
        else:
            msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Email sent successfully to {to}")
        return {"sent": True, "to": to, "subject": subject}

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {e}")
        raise self.retry(exc=e)
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending email: {e}")
        raise self.retry(exc=e)
    except Exception as e:
        logger.error(f"Unexpected error sending email: {e}")
        raise self.retry(exc=e)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email(
    self,
    to: str,
    template_type: str,
    subject: str,
    **template_kwargs
) -> Dict[str, Any]:
    """
    Send a notification email using predefined templates.

    Args:
        to: Recipient email
        template_type: Template type (approval, rejection, sla_alert, password_reset)
        subject: Email subject
        **template_kwargs: Template variables

    Returns:
        Dict with send status
    """
    html_body = _get_email_template(template_type, **template_kwargs)
    return send_email(to=to, subject=subject, body=html_body, html=True)


# =============================================================================
# Notification Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_notification(
    self,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "info"
) -> Dict[str, Any]:
    """
    Send an in-app notification to a user.

    Args:
        user_id: Target user ID
        title: Notification title
        message: Notification message
        notification_type: Type (info, warning, error, success)

    Returns:
        Dict with notification result
    """
    try:
        from backend.services.notification_service import NotificationService

        service = NotificationService()
        result = service.create_notification(
            user_id=user_id,
            tipo=notification_type,
            titulo=title,
            mensaje=message,
        )
        logger.info(f"Notification sent to user {user_id}: {title}")
        return {"sent": True, "user_id": user_id, "result": result}

    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        raise self.retry(exc=e)


# =============================================================================
# Report Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def generate_report(
    self,
    report_type: str,
    params: Dict[str, Any],
    user_id: int
) -> Dict[str, Any]:
    """
    Generate a report in background.

    Args:
        report_type: Type of report (solicitudes, materiales)
        params: Report parameters
        user_id: Requesting user ID

    Returns:
        Dict with report result or file path
    """
    logger.info(f"Generating report: {report_type} for user {user_id}")

    try:
        from backend.core.reporting import ReportGenerator

        generator = ReportGenerator()

        if report_type == "solicitudes":
            result = generator.generate_solicitudes_report(**params)
        elif report_type == "materiales":
            result = generator.generate_materiales_report(**params)
        else:
            return {"error": f"Unknown report type: {report_type}"}

        # Notify user that report is ready
        send_notification.delay(
            user_id=user_id,
            title="Reporte listo",
            message=f"Tu reporte de {report_type} está listo para descargar.",
            notification_type="success",
        )

        return {"success": True, "report_type": report_type, "result": result}

    except ImportError:
        logger.warning("Reporting module not available")
        return {"error": "Reporting not available"}
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise self.retry(exc=e)


# =============================================================================
# MRP Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def process_mrp_alerts(self) -> Dict[str, Any]:
    """
    Process MRP alerts in background.

    Returns:
        Dict with number of alerts generated
    """
    logger.info("Processing MRP alerts")

    try:
        from backend.core.mrp_engine import MRPEngine

        engine = MRPEngine()
        alerts = engine.check_all_alerts()
        return {"alerts_generated": len(alerts)}

    except ImportError:
        logger.warning("MRP module not available")
        return {"error": "MRP not available"}
    except Exception as e:
        logger.error(f"Error processing MRP alerts: {e}")
        raise self.retry(exc=e)


# =============================================================================
# AI/ML Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=1, time_limit=600)
def update_ai_models(self) -> Dict[str, Any]:
    """
    Update AI models in background.

    This is a long-running task with extended timeout.

    Returns:
        Dict with update status
    """
    logger.info("Updating AI models")

    try:
        from backend.services.ai_service import AIService

        service = AIService()
        # Retrain models with recent data
        # This would be expanded based on actual AI implementation
        return {"updated": True, "timestamp": "now"}

    except ImportError:
        logger.warning("AI module not available")
        return {"error": "AI not available"}
    except Exception as e:
        logger.error(f"Error updating AI models: {e}")
        raise self.retry(exc=e)


# =============================================================================
# Metrics Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def collect_metrics_snapshot(self) -> Dict[str, Any]:
    """
    Collect system metrics and save to history.

    Should be scheduled to run every 5 minutes.

    Returns:
        Dict with collected metrics
    """
    try:
        import psutil

        from backend.core.db import get_db_transaction, is_using_postgresql
        from backend.core.metrics import get_cache_metrics, get_metrics_collector

        logger.info("Collecting metrics snapshot")

        # System metrics
        cpu = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory().percent

        # Application metrics
        collector = get_metrics_collector()
        stats = collector.get_request_stats()

        latency_p50 = stats.get("latency", {}).get("p50_ms", 0)
        total_requests = stats.get("total_requests", 0)
        total_errors = stats.get("total_errors", 0)
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

        # Cache metrics
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

        # Save to DB
        metrics_to_save = [
            ("cpu", round(cpu, 2)),
            ("memory", round(memory, 2)),
            ("latency_p50", round(latency_p50, 2)),
            ("error_rate", round(error_rate, 4)),
            ("cache_hit", round(cache_hit, 2)),
        ]

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

            # Cleanup old metrics (> 7 days)
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

        return {
            "collected": True,
            "metrics": {m[0]: m[1] for m in metrics_to_save}
        }

    except Exception as e:
        logger.error(f"Error collecting metrics: {e}")
        raise self.retry(exc=e)


# =============================================================================
# Cleanup Tasks
# =============================================================================


@celery_app.task
def cleanup_old_data() -> Dict[str, Any]:
    """
    Cleanup old data from various tables.

    Should be scheduled daily.

    Returns:
        Dict with cleanup stats
    """
    logger.info("Running daily cleanup")

    try:
        from backend.core.db import get_db_transaction, is_using_postgresql

        cleaned = {}

        with get_db_transaction() as conn:
            cur = conn.cursor()

            # Clean old notifications (> 30 days, read)
            if is_using_postgresql():
                cur.execute("""
                    DELETE FROM notificaciones
                    WHERE leida = TRUE
                    AND fecha < NOW() - INTERVAL '30 days'
                """)
            else:
                cur.execute("""
                    DELETE FROM notificaciones
                    WHERE leida = 1
                    AND fecha < datetime('now', '-30 days')
                """)
            cleaned["old_notifications"] = cur.rowcount

            # Clean old audit logs (> 90 days)
            if is_using_postgresql():
                cur.execute("""
                    DELETE FROM audit_logs
                    WHERE timestamp < NOW() - INTERVAL '90 days'
                """)
            else:
                cur.execute("""
                    DELETE FROM audit_logs
                    WHERE timestamp < datetime('now', '-90 days')
                """)
            cleaned["old_audit_logs"] = cur.rowcount

        logger.info(f"Cleanup completed: {cleaned}")
        return {"success": True, "cleaned": cleaned}

    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# Email Templates (copied from background_jobs.py)
# =============================================================================


def _get_email_template(template_type: str, **kwargs) -> str:
    """Generate HTML for notification emails."""
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
                <div class="header"><h1>Solicitud Aprobada</h1></div>
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
                    <a href="{kwargs.get('url', '#')}" class="button">Ver Solicitud</a>
                </div>
                <div class="footer"><p>SPM - Sistema de Planificacion de Materiales</p></div>
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
                <div class="header" style="background: #dc3545;"><h1>Solicitud Rechazada</h1></div>
                <div class="content">
                    <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                    <div class="error">
                        <p>Tu solicitud <strong>#{kwargs.get('solicitud_id', '')}</strong> ha sido <strong>rechazada</strong>.</p>
                    </div>
                    <p><strong>Motivo:</strong></p>
                    <p style="background: #f0f0f0; padding: 12px; border-radius: 4px;">
                        {kwargs.get('motivo', 'No especificado')}
                    </p>
                    <a href="{kwargs.get('url', '#')}" class="button" style="background: #6c757d;">Ver Solicitud</a>
                </div>
                <div class="footer"><p>SPM - Sistema de Planificacion de Materiales</p></div>
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
                <div class="header" style="background: #ffc107; color: #333;"><h1>Alerta SLA</h1></div>
                <div class="content">
                    <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                    <div class="alert">
                        <p><strong>Atencion:</strong> La solicitud <strong>#{kwargs.get('solicitud_id', '')}</strong>
                        esta proxima a vencer su SLA.</p>
                    </div>
                    <p><strong>Detalles:</strong></p>
                    <ul>
                        <li>Tiempo restante: <strong>{kwargs.get('tiempo_restante', '')}</strong></li>
                        <li>Estado actual: {kwargs.get('estado', '')}</li>
                    </ul>
                    <a href="{kwargs.get('url', '#')}" class="button" style="background: #ffc107; color: #333;">Ver Solicitud</a>
                </div>
                <div class="footer"><p>SPM - Sistema de Planificacion de Materiales</p></div>
            </div>
        </body>
        </html>
        """

    else:
        # Generic template
        return f"""
        <!DOCTYPE html>
        <html>
        <head>{base_style}</head>
        <body>
            <div class="container">
                <div class="header"><h1>{kwargs.get('titulo', 'Notificacion SPM')}</h1></div>
                <div class="content">
                    <p>Hola <strong>{kwargs.get('nombre', 'Usuario')}</strong>,</p>
                    <p>{kwargs.get('mensaje', '')}</p>
                    {f'<a href="{kwargs.get("url", "#")}" class="button">Ver Mas</a>' if kwargs.get('url') else ''}
                </div>
                <div class="footer"><p>SPM - Sistema de Planificacion de Materiales</p></div>
            </div>
        </body>
        </html>
        """
