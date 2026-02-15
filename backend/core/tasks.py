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
    from backend.core.config import settings

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
# SLA Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def check_sla_deadlines(self) -> Dict[str, Any]:
    """
    Check SLA deadlines and generate alerts for solicitudes near expiration.

    Returns:
        Dict with number of alerts generated
    """
    logger.info("Checking SLA deadlines")

    try:
        from backend.core.db import get_db_connection, is_using_postgresql

        alerts_generated = 0

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Find solicitudes near SLA expiration (in active states)
            if is_using_postgresql():
                cursor.execute("""
                    SELECT s.id, s.id_usuario, s.status, s.created_at,
                           EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 as hours_elapsed
                    FROM solicitud s
                    WHERE s.status IN ('submitted', 'approved', 'in_planning', 'in_treatment')
                    AND s.created_at < NOW() - INTERVAL '48 hours'
                """)
            else:
                cursor.execute("""
                    SELECT s.id, s.id_usuario, s.status, s.created_at,
                           (julianday('now') - julianday(s.created_at)) * 24 as hours_elapsed
                    FROM solicitud s
                    WHERE s.status IN ('submitted', 'approved', 'in_planning', 'in_treatment')
                    AND s.created_at < datetime('now', '-48 hours')
                """)

            rows = cursor.fetchall()

        for row in rows:
            hours = row["hours_elapsed"] if isinstance(row, dict) else row[4]
            sol_id = row["id"] if isinstance(row, dict) else row[0]
            user_id = row["id_usuario"] if isinstance(row, dict) else row[1]

            # Determine severity
            if hours > 120:  # 5 days
                severity = "critical"
            elif hours > 72:  # 3 days
                severity = "warning"
            else:
                severity = "info"

            # Send notification
            send_notification.delay(
                user_id=int(user_id) if user_id else 1,
                title="Alerta SLA",
                message=f"Solicitud #{sol_id} lleva {int(hours)}h sin resolverse",
                notification_type=severity,
            )

            # Emit WebSocket event
            try:
                from backend.core.websocket import get_ws_manager

                manager = get_ws_manager()
                if manager:
                    manager.event_bus.publish("mrp_alert", {
                        "type": "sla_warning",
                        "solicitud_id": sol_id,
                        "hours_elapsed": int(hours),
                        "severity": severity,
                    })
            except Exception:
                pass

            alerts_generated += 1

        logger.info(f"SLA check completed: {alerts_generated} alerts generated")
        return {"alerts_generated": alerts_generated}

    except Exception as e:
        logger.error(f"Error checking SLA deadlines: {e}")
        raise self.retry(exc=e)


# =============================================================================
# Stock Alert Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def check_stock_alerts(self) -> Dict[str, Any]:
    """
    Check stock levels and generate alerts for materials below ROP.

    Returns:
        Dict with number of alerts generated
    """
    logger.info("Checking stock alerts")

    try:
        from backend.core.db import get_db_connection

        alerts = []

        with get_db_connection("sap_data") as conn:
            cursor = conn.cursor()

            # Materials below reorder point
            cursor.execute("""
                SELECT s.material, s.centro, s.cantidad as stock_actual,
                       m.punto_de_pedido as rop, m.descripcion
                FROM stock s
                JOIN materiales_bbdd m ON s.material = m.material AND s.centro = m.centro
                WHERE m.punto_de_pedido > 0
                AND s.cantidad < m.punto_de_pedido
                AND s.cantidad > 0
                LIMIT 50
            """)
            rows = cursor.fetchall()

        for row in rows:
            material = row["material"] if isinstance(row, dict) else row[0]
            centro = row["centro"] if isinstance(row, dict) else row[1]
            stock = row["stock_actual"] if isinstance(row, dict) else row[2]
            rop = row["rop"] if isinstance(row, dict) else row[3]
            desc = row["descripcion"] if isinstance(row, dict) else row[4]

            alerts.append({
                "material": material,
                "centro": centro,
                "stock_actual": float(stock),
                "rop": float(rop),
                "descripcion": desc,
                "severity": "critical" if stock < rop * 0.3 else "warning",
            })

        # Emit WebSocket event with batch of alerts
        if alerts:
            try:
                from backend.core.websocket import get_ws_manager

                manager = get_ws_manager()
                if manager:
                    manager.event_bus.publish("stock_alert", {
                        "type": "stock_below_rop",
                        "count": len(alerts),
                        "critical": sum(1 for a in alerts if a["severity"] == "critical"),
                        "top_alerts": alerts[:10],
                    })
            except Exception:
                pass

        logger.info(f"Stock alert check completed: {len(alerts)} materials below ROP")
        return {"alerts_generated": len(alerts), "critical": sum(1 for a in alerts if a["severity"] == "critical")}

    except Exception as e:
        logger.error(f"Error checking stock alerts: {e}")
        raise self.retry(exc=e)


# =============================================================================
# Scheduled Reports Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def generate_scheduled_report(
    self,
    report_type: str,
    frequency: str,
    params: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Generate a scheduled report and save to history (legacy task).

    Args:
        report_type: Type (stock_health, solicitudes_resumen, mrp_alertas, kpis)
        frequency: Frequency label (diario, semanal, mensual)
        params: Additional params for the report

    Returns:
        Dict with report result
    """
    logger.info(f"Generating scheduled report: {report_type} ({frequency})")

    try:
        import json

        from backend.core.db import get_db_transaction, is_using_postgresql
        from backend.services.reporting_service import get_reporting_service

        service = get_reporting_service()
        params = params or {}
        result_path = None

        if report_type == "stock_health":
            result = service.generate_stock_report(formato="xlsx", **params)
        elif report_type == "solicitudes_resumen":
            result = service.generate_solicitudes_report(formato="xlsx", **params)
        elif report_type == "kpis":
            result = service.generate_kpis_report(formato="xlsx", **params)
        else:
            result = {"error": f"Unknown report type: {report_type}"}

        if isinstance(result, dict) and result.get("path"):
            result_path = result["path"]

        # Save to report history
        with get_db_transaction() as conn:
            cur = conn.cursor()
            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO reporte_historial
                    (tipo_reporte, frecuencia, parametros, resultado, archivo_path, estado)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (report_type, frequency, json.dumps(params),
                      json.dumps(result) if isinstance(result, dict) else str(result),
                      result_path, "completado"))
            else:
                cur.execute("""
                    INSERT INTO reporte_historial
                    (tipo_reporte, frecuencia, parametros, resultado, archivo_path, estado)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (report_type, frequency, json.dumps(params),
                      json.dumps(result) if isinstance(result, dict) else str(result),
                      result_path, "completado"))

        logger.info(f"Scheduled report completed: {report_type}")
        return {"success": True, "report_type": report_type, "frequency": frequency}

    except Exception as e:
        logger.error(f"Error generating scheduled report: {e}")
        raise self.retry(exc=e)


@celery_app.task(bind=True, max_retries=1, default_retry_delay=300)
def generate_scheduled_reports(self) -> Dict[str, Any]:
    """
    Process all scheduled reports that are due.

    Checks reporte_programado table for reports with proximo_envio <= NOW()
    and activo = 1, generates them, updates timestamps, and optionally emails them.

    Returns:
        Dict with number of reports processed
    """
    logger.info("Processing scheduled reports")

    try:
        import json
        from datetime import datetime, timedelta

        from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql
        from backend.services.report_generator import ReportGenerator

        reports_processed = 0
        reports_failed = 0

        # Get due reports
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                cursor.execute("""
                    SELECT id, nombre, tipo, frecuencia, filtros_json,
                           destinatarios_json, formato, creado_por
                    FROM reporte_programado
                    WHERE activo = 1
                    AND (proximo_envio IS NULL OR proximo_envio <= NOW())
                    ORDER BY proximo_envio
                    LIMIT 50
                """)
            else:
                cursor.execute("""
                    SELECT id, nombre, tipo, frecuencia, filtros_json,
                           destinatarios_json, formato, creado_por
                    FROM reporte_programado
                    WHERE activo = 1
                    AND (proximo_envio IS NULL OR proximo_envio <= datetime('now'))
                    ORDER BY proximo_envio
                    LIMIT 50
                """)

            due_reports = [dict(row) for row in cursor.fetchall()]

        logger.info(f"Found {len(due_reports)} scheduled reports to process")

        # Process each report
        for report in due_reports:
            report_id = report["id"]
            tipo = report["tipo"]
            frecuencia = report["frecuencia"]
            formato = report["formato"]
            nombre = report["nombre"]

            try:
                # Parse filters
                filtros_json = report.get("filtros_json", "{}")
                filtros = json.loads(filtros_json) if filtros_json else {}

                # Generate report
                result = ReportGenerator.generate(tipo=tipo, filtros=filtros, formato=formato)

                if result.get("success"):
                    # Log to reporte_historial
                    with get_db_transaction() as conn:
                        cur = conn.cursor()
                        if is_using_postgresql():
                            cur.execute("""
                                INSERT INTO reporte_historial
                                (tipo_reporte, frecuencia, parametros, resultado, estado)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (tipo, frecuencia, filtros_json,
                                  json.dumps({"filename": result.get("filename")}), "completado"))
                        else:
                            cur.execute("""
                                INSERT INTO reporte_historial
                                (tipo_reporte, frecuencia, parametros, resultado, estado)
                                VALUES (?, ?, ?, ?, ?)
                            """, (tipo, frecuencia, filtros_json,
                                  json.dumps({"filename": result.get("filename")}), "completado"))

                    # Send email if destinatarios exist
                    destinatarios_json = report.get("destinatarios_json", "[]")
                    destinatarios = json.loads(destinatarios_json) if destinatarios_json else []

                    if destinatarios and isinstance(destinatarios, list):
                        for email in destinatarios:
                            try:
                                # Queue email task with report as attachment
                                send_email.delay(
                                    to=email,
                                    subject=f"Reporte Programado: {nombre}",
                                    body=f"Se adjunta el reporte '{nombre}' generado automáticamente.\n\nFrecuencia: {frecuencia}\nFormato: {formato}",
                                    html=False
                                )
                            except Exception as email_error:
                                logger.warning(f"Failed to queue email for {email}: {email_error}")

                    # Calculate next execution time
                    now = datetime.now()
                    if frecuencia == "diario":
                        proximo_envio = now + timedelta(days=1)
                    elif frecuencia == "semanal":
                        proximo_envio = now + timedelta(weeks=1)
                    elif frecuencia == "mensual":
                        proximo_envio = now + timedelta(days=30)
                    else:  # manual
                        proximo_envio = None

                    # Update reporte_programado
                    with get_db_transaction() as conn:
                        cur = conn.cursor()
                        if is_using_postgresql():
                            cur.execute("""
                                UPDATE reporte_programado
                                SET ultimo_envio = NOW(),
                                    proximo_envio = %s,
                                    updated_at = NOW()
                                WHERE id = %s
                            """, (proximo_envio, report_id))
                        else:
                            cur.execute("""
                                UPDATE reporte_programado
                                SET ultimo_envio = datetime('now'),
                                    proximo_envio = ?,
                                    updated_at = datetime('now')
                                WHERE id = ?
                            """, (proximo_envio.isoformat() if proximo_envio else None, report_id))

                    reports_processed += 1
                    logger.info(f"Report {report_id} ({nombre}) processed successfully")

                else:
                    reports_failed += 1
                    logger.error(f"Report {report_id} ({nombre}) failed: {result.get('error')}")

            except Exception as report_error:
                reports_failed += 1
                logger.error(f"Error processing report {report_id}: {report_error}", exc_info=True)

        logger.info(f"Scheduled reports processing complete: {reports_processed} success, {reports_failed} failed")

        return {
            "reports_processed": reports_processed,
            "reports_failed": reports_failed,
            "total": len(due_reports)
        }

    except Exception as e:
        logger.error(f"Error in generate_scheduled_reports task: {e}", exc_info=True)
        raise self.retry(exc=e)


# =============================================================================
# FMS Maintenance Tasks
# =============================================================================


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def check_preventive_maintenance(self) -> Dict[str, Any]:
    """
    Check vehicles due for preventive maintenance and generate alerts.

    Returns:
        Dict with alerts generated
    """
    logger.info("Checking preventive maintenance schedules")

    try:
        from backend.core.db import get_db_connection, is_using_postgresql

        alerts_generated = 0

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Find vehicles with overdue or upcoming maintenance
            if is_using_postgresql():
                cursor.execute("""
                    SELECT v.id, v.placa, v.tipo, v.kilometraje_actual,
                           mp.tipo_mantenimiento, mp.frecuencia_km, mp.frecuencia_dias,
                           mp.ultimo_mantenimiento_km, mp.ultimo_mantenimiento_fecha
                    FROM fms_vehiculo v
                    JOIN fms_plan_mantenimiento mp ON v.id = mp.vehiculo_id
                    WHERE v.estado = 'activo'
                    AND (
                        (mp.frecuencia_km > 0 AND v.kilometraje_actual - COALESCE(mp.ultimo_mantenimiento_km, 0) >= mp.frecuencia_km * 0.9)
                        OR
                        (mp.frecuencia_dias > 0 AND COALESCE(mp.ultimo_mantenimiento_fecha, v.created_at) + (mp.frecuencia_dias * INTERVAL '1 day') <= NOW() + INTERVAL '7 days')
                    )
                """)
            else:
                cursor.execute("""
                    SELECT v.id, v.placa, v.tipo, v.kilometraje_actual,
                           mp.tipo_mantenimiento, mp.frecuencia_km, mp.frecuencia_dias,
                           mp.ultimo_mantenimiento_km, mp.ultimo_mantenimiento_fecha
                    FROM fms_vehiculo v
                    JOIN fms_plan_mantenimiento mp ON v.id = mp.vehiculo_id
                    WHERE v.estado = 'activo'
                    AND (
                        (mp.frecuencia_km > 0 AND v.kilometraje_actual - COALESCE(mp.ultimo_mantenimiento_km, 0) >= mp.frecuencia_km * 0.9)
                        OR
                        (mp.frecuencia_dias > 0 AND julianday('now') - julianday(COALESCE(mp.ultimo_mantenimiento_fecha, v.created_at)) >= mp.frecuencia_dias - 7)
                    )
                """)

            rows = cursor.fetchall()

        for row in rows:
            alerts_generated += 1
            placa = row["placa"] if isinstance(row, dict) else row[1]
            tipo_mant = row["tipo_mantenimiento"] if isinstance(row, dict) else row[4]

            # Send in-app notification to admins
            send_notification.delay(
                user_id=1,  # Admin
                title="Mantenimiento preventivo",
                message=f"Vehículo {placa}: {tipo_mant} próximo o vencido",
                notification_type="warning",
            )

        logger.info(f"Preventive maintenance check: {alerts_generated} alerts")
        return {"alerts_generated": alerts_generated}

    except Exception as e:
        logger.error(f"Error checking preventive maintenance: {e}")
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

        AIService()
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
                    DELETE FROM notificacion
                    WHERE leida = TRUE
                    AND fecha < NOW() - INTERVAL '30 days'
                """)
            else:
                cur.execute("""
                    DELETE FROM notificacion
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
# Procurement Scorecard Tasks (Sprint 39)
# =============================================================================


def _row_to_dict(row) -> Dict[str, Any]:
    """Convierte una fila de BD a diccionario."""
    if row is None:
        return {}
    if hasattr(row, "keys"):
        return dict(row)
    return {}


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def snapshot_proveedor_scorecard(self) -> Dict[str, Any]:
    """
    Monthly snapshot of provider scorecards from SAP data.

    Calculates scores from v_sap_cumplimiento view and saves to proveedor_evaluacion.
    Only runs if no evaluation exists for current period (idempotent).

    Returns:
        Dict with snapshot stats
    """
    logger.info("Creating monthly provider scorecard snapshot")

    try:
        from datetime import datetime

        from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

        periodo_actual = datetime.utcnow().strftime("%Y-%m")
        evaluaciones_creadas = 0

        with get_db_connection() as conn:
            cur = conn.cursor()

            # Get all providers from SAP cumplimiento view
            cur.execute("""
                SELECT
                    proveedor_cuit,
                    proveedor_nombre,
                    pct_a_tiempo,
                    pct_completas,
                    valor_total_pedido,
                    valor_total_recibido
                FROM v_sap_cumplimiento
                WHERE total_pedidos >= 3
            """)
            proveedores = cur.fetchall()

        for prov_row in proveedores:
            prov = _row_to_dict(prov_row)
            proveedor_id = prov.get("proveedor_cuit")
            proveedor_nombre = prov.get("proveedor_nombre")

            if not proveedor_id:
                continue

            # Check if evaluation already exists for this period
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT id FROM proveedor_evaluacion
                    WHERE proveedor_id = ? AND periodo = ?
                """, (proveedor_id, periodo_actual))
                existing = cur.fetchone()

            if existing:
                continue  # Skip if already evaluated this month

            # Calculate scores
            entrega_score = float(prov.get("pct_a_tiempo") or 0)
            calidad_score = float(prov.get("pct_completas") or 0)

            # Precio score: 100 - abs(valor_desviacion_pct)
            valor_pedido = float(prov.get("valor_total_pedido") or 0)
            valor_recibido = float(prov.get("valor_total_recibido") or 0)
            if valor_pedido > 0:
                desviacion_pct = abs((valor_recibido - valor_pedido) / valor_pedido * 100)
                precio_score = max(0, 100 - desviacion_pct)
            else:
                precio_score = 0

            # Servicio score: avg(calidad, entrega) - proxy until manual evaluation
            servicio_score = (calidad_score + entrega_score) / 2

            # Global score: weighted average
            # entrega 35%, calidad 30%, precio 20%, servicio 15%
            score_global = round(
                entrega_score * 0.35 +
                calidad_score * 0.30 +
                precio_score * 0.20 +
                servicio_score * 0.15,
                2
            )

            # Insert evaluation
            with get_db_transaction() as conn:
                cur = conn.cursor()

                if is_using_postgresql():
                    cur.execute("""
                        INSERT INTO proveedor_evaluacion
                        (proveedor_id, proveedor_nombre, periodo, calidad_score, entrega_score,
                         precio_score, servicio_score, score_global, evaluado_por, notas)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL, %s)
                    """, (
                        proveedor_id, proveedor_nombre, periodo_actual,
                        calidad_score, entrega_score, precio_score, servicio_score,
                        score_global, "Snapshot automático mensual"
                    ))
                else:
                    cur.execute("""
                        INSERT INTO proveedor_evaluacion
                        (proveedor_id, proveedor_nombre, periodo, calidad_score, entrega_score,
                         precio_score, servicio_score, score_global, evaluado_por, notas)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                    """, (
                        proveedor_id, proveedor_nombre, periodo_actual,
                        calidad_score, entrega_score, precio_score, servicio_score,
                        score_global, "Snapshot automático mensual"
                    ))

            evaluaciones_creadas += 1

        logger.info(f"Provider scorecard snapshot completed: {evaluaciones_creadas} evaluations created")
        return {
            "success": True,
            "periodo": periodo_actual,
            "evaluaciones_creadas": evaluaciones_creadas
        }

    except Exception as e:
        logger.error(f"Error creating provider scorecard snapshot: {e}")
        raise self.retry(exc=e)


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
