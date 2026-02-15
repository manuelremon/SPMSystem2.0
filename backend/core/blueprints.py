"""
Blueprint registration for the Flask application.

Centralizes the registration of all API blueprints to keep create_app() clean.
"""

from __future__ import annotations

from flask import Flask


def register_blueprints(app: Flask) -> None:
    """
    Register all API blueprints with the Flask application.

    Args:
        app: Flask application instance
    """
    # Import blueprints here to avoid circular imports
    from backend.agent import agent_bp
    from backend.routes import (
        admin,
        admin_import,
        ai,
        assistant,
        auth,
        budget,
        catalogos,
        dashboards,
        database,
        docs,
        equivalencias,
        export,
        foro,
        health,
        kpis,
        materiales,
        materiales_detalle,
        mensajes,
        metrics,
        mi_cuenta,
        mrp,
        mrp_portfolio,
        notificaciones,
        procurement,
        push,
        sla,
        solicitudes,
        stock,
        trivias,
        vertex_ia,
    )
    from backend.routes import planner as planner_new

    # Health check (no prefix)
    app.register_blueprint(health.bp)

    # Authentication
    app.register_blueprint(auth.bp, url_prefix="/api/auth")

    # Core business logic
    app.register_blueprint(solicitudes.bp)
    app.register_blueprint(planner_new.bp, url_prefix="/api/planificador")
    app.register_blueprint(catalogos.bp, url_prefix="/api/catalogos")
    app.register_blueprint(mi_cuenta.bp, url_prefix="/api")
    app.register_blueprint(materiales.bp)
    app.register_blueprint(materiales_detalle.bp_detalle)
    app.register_blueprint(stock.bp)  # Stock management at /api/stock

    # Administration
    app.register_blueprint(admin.bp)
    app.register_blueprint(database.bp)  # Database administration at /api/admin/database
    app.register_blueprint(admin_import.bp)  # Temp data import for MRP/Forecast at /api/admin

    # Communication
    app.register_blueprint(notificaciones.bp)  # Notifications real-time system
    app.register_blueprint(mensajes.bp)  # Bidirectional messaging system
    app.register_blueprint(push.bp)  # Push Notifications at /api/push

    # Budget and planning
    app.register_blueprint(budget.bp)  # Budget/BUR management at /api
    app.register_blueprint(mrp.bp)  # MRP (Material Requirements Planning) at /api/mrp
    app.register_blueprint(mrp_portfolio.bp)  # MRP Portfolio at /api/mrp/portfolio
    app.register_blueprint(equivalencias.bp)  # Material equivalences at /api/equivalencias

    # AI and analytics
    app.register_blueprint(agent_bp)  # Agent routes registered at /api/agent
    app.register_blueprint(assistant.bp)  # NLP Assistant at /api/assistant
    app.register_blueprint(ai.bp)  # AI recommendations at /api/ai
    app.register_blueprint(vertex_ia.bp)  # Vertex IA chat assistant at /api/vertex

    # Metrics and monitoring
    app.register_blueprint(kpis.bp)  # KPIs and metrics at /api/kpis
    app.register_blueprint(sla.bp)  # SLA metrics and configuration at /api/sla
    app.register_blueprint(metrics.bp)  # Metrics and monitoring at /api/metrics

    # Export and documentation
    app.register_blueprint(export.bp)  # Export/reporting at /api/export
    app.register_blueprint(docs.bp)  # API Documentation at /api/docs

    # Gamification and community
    app.register_blueprint(trivias.bp, url_prefix="/api")  # Trivias: games, rankings, scores
    app.register_blueprint(foro.bp, url_prefix="/api")  # Forum: posts, replies, likes

    # External integrations
    app.register_blueprint(procurement.procurement_bp)  # SAP Procurement data at /api/procurement

    # Dashboards editables
    app.register_blueprint(dashboards.bp)  # Editable spreadsheet dashboards at /api/dashboards

    # Dashboard Data (server-side pagination & drill-down)
    from backend.routes.dashboards_data import bp as dashboards_data_bp
    app.register_blueprint(dashboards_data_bp)  # Dashboard data at /api/dashboard-data

    # Purchase Orders (Ordenes de Compra)
    from backend.routes.ordenes_compra import ordenes_compra_bp
    app.register_blueprint(ordenes_compra_bp)  # OC at /api/ordenes-compra

    # Transport and Fleet Management
    from backend.routes import fms, tms
    app.register_blueprint(tms.bp)  # TMS (Transport Management) at /api/tms
    app.register_blueprint(fms.bp)  # FMS (Fleet Management) at /api/fms

    # Webhooks (outbound events)
    from backend.routes import webhooks
    app.register_blueprint(webhooks.bp)  # Webhooks at /api/webhooks
