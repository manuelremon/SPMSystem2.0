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

    # Audit Log (Sprint 51)
    from backend.routes.audit import bp as audit_bp
    app.register_blueprint(audit_bp)  # Audit at /api/audit

    # Cost Savings (Sprint 52)
    from backend.routes.savings import bp as savings_bp
    app.register_blueprint(savings_bp)  # Savings at /api/savings

    # Inventory Aging & SLOB (Sprint 53)
    from backend.routes.slob import slob_bp
    app.register_blueprint(slob_bp)  # SLOB at /api/slob

    # Contract Management (Sprints 54-56)
    from backend.routes.contracts import bp as contracts_bp
    app.register_blueprint(contracts_bp)  # Contracts at /api/contracts

    # RFQ (Sprints 57-58)
    from backend.routes.rfq import rfq_bp
    app.register_blueprint(rfq_bp)  # RFQ at /api/rfq

    # Quality Management (Sprints 59-60)
    from backend.routes.quality import quality_bp
    app.register_blueprint(quality_bp)  # Quality at /api/quality

    # 3-Way Matching (Sprint 61)
    from backend.routes.matching import matching_bp
    app.register_blueprint(matching_bp)  # Matching at /api/matching

    # Spend Analytics (Sprint 62)
    from backend.routes.spend import spend_bp
    app.register_blueprint(spend_bp)  # Spend at /api/spend

    # Supplier Risk (Sprint 63)
    from backend.routes.supplier_risk import supplier_risk_bp
    app.register_blueprint(supplier_risk_bp)  # Supplier Risk at /api/supplier-risk

    # Demand Planning S&OP (Sprint 64)
    from backend.routes.demand_planning import demand_bp
    app.register_blueprint(demand_bp)  # Demand Planning at /api/demand-planning

    # Returns & RMA (Sprint 65)
    from backend.routes.returns import returns_bp
    app.register_blueprint(returns_bp)  # Returns at /api/returns

    # Warehouse Operations (Sprint 66)
    from backend.routes.warehouse import warehouse_bp
    app.register_blueprint(warehouse_bp)  # Warehouse at /api/warehouse

    # Contract Compliance & Rebates (Sprint 67)
    from backend.routes.compliance import compliance_bp
    app.register_blueprint(compliance_bp)  # Compliance at /api/compliance

    # Inventory Optimization (Sprint 68)
    from backend.routes.inventory_opt import inv_opt_bp
    app.register_blueprint(inv_opt_bp)  # Inventory Opt at /api/inventory-optimization

    # Supplier Audit & Certifications (Sprint 69)
    from backend.routes.supplier_audit import supplier_audit_bp
    app.register_blueprint(supplier_audit_bp)  # Supplier Audit at /api/supplier-audit

    # Freight Audit & Payment (Sprint 70)
    from backend.routes.freight import freight_bp
    app.register_blueprint(freight_bp)  # Freight at /api/freight

    # Supply Chain Control Tower (Sprint 71)
    from backend.routes.control_tower import control_tower_bp
    app.register_blueprint(control_tower_bp)  # Control Tower at /api/control-tower

    # Sustainability & ESG (Sprint 72)
    from backend.routes.sustainability import sustainability_bp
    app.register_blueprint(sustainability_bp)  # Sustainability at /api/sustainability

    # VMI - Vendor Managed Inventory (Sprint 73)
    from backend.routes.vmi import vmi_bp
    app.register_blueprint(vmi_bp)  # VMI at /api/vmi

    # Lot Traceability & Recalls (Sprint 74)
    from backend.routes.lots import lots_bp
    app.register_blueprint(lots_bp)  # Lots at /api/lots

    # Cycle Counting (Sprint 75)
    from backend.routes.cycle_count import cycle_count_bp
    app.register_blueprint(cycle_count_bp)  # Cycle Count at /api/cycle-count

    # Multi-Currency (Sprint 76)
    from backend.routes.currency import currency_bp
    app.register_blueprint(currency_bp)  # Currency at /api/currency

    # Engineering Change Orders (Sprint 77)
    from backend.routes.eco import eco_bp
    app.register_blueprint(eco_bp)  # ECO at /api/eco

    # Kitting & Light Assembly (Sprint 78)
    from backend.routes.kitting import kitting_bp
    app.register_blueprint(kitting_bp)  # Kitting at /api/kitting

    # Supplier Collaboration Portal (Sprint 79)
    from backend.routes.supplier_portal import supplier_portal_bp
    app.register_blueprint(supplier_portal_bp)  # Supplier Portal at /api/supplier-portal

    # AI Procurement Copilot (Sprint 80)
    from backend.routes.copilot import copilot_bp
    app.register_blueprint(copilot_bp)  # Copilot at /api/copilot
