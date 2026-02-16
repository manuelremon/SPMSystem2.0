# CLAUDE.md

Guia para Claude Code cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2026-02-15 (Sprints 81-90)

## Resumen del Proyecto

| Metrica | Valor |
|---------|-------|
| **Backend** | 305+ archivos Python, ~115,000 lineas |
| **Frontend** | 159 paginas, 145 componentes, 22 hooks |
| **Endpoints API** | 560+ endpoints en 67 modulos (3 packages) |
| **Tests** | 1,330+ tests (101 archivos backend, 25 frontend) |
| **Base de Datos** | 3 SQLite + PostgreSQL (produccion), 83 migraciones |

## Comandos de Desarrollo

```bash
# Backend (Flask) - Terminal 1
python wsgi.py                    # Inicia en http://localhost:5000

# Frontend (Vite + React) - Terminal 2
cd frontend && npm run dev        # Inicia en http://localhost:5173

# Tests
python -m pytest tests/           # Backend tests (1,000+ tests)
cd frontend && npm test           # Frontend tests

# Build produccion
cd frontend && npm run build

# Scripts de inicio rapido (Windows)
scripts/INICIAR_SPM.bat           # Inicia backend + frontend
scripts/INICIAR_SPM_RAPIDO.bat    # Inicio sin verificaciones

# Seed de datos de prueba
python scripts/seed_dev_data.py          # Genera datos de desarrollo
python scripts/seed_dev_data.py --clean  # Limpia y regenera datos
```

## Arquitectura

```
Frontend (React + Vite)     Backend (Flask)           Base de Datos
http://localhost:5173       http://localhost:5000     SQLite (data/)
        |                           |                      |
        +--- API REST (/api/*) -----+--- PostgreSQL (prod)-+
```

### Estructura Principal

```
SPMv3.0/
├── backend/                    # API Flask (245+ archivos, ~85K lineas)
│   ├── routes/                 # 47 modulos (3 packages: ai/, planner/, solicitudes/)
│   ├── services/               # 49 servicios de negocio
│   ├── core/                   # 39 modulos de infraestructura
│   ├── agent/                  # 46 archivos ML/IA (forecast/, rag/, proactive/)
│   └── migrations/             # 83 migraciones de BD
├── frontend/src/
│   ├── pages/                  # 139 paginas + DashboardAdmin/ sub-componentes
│   ├── components/             # 145 componentes (incl. OfflineBanner)
│   ├── hooks/                  # 22 custom hooks
│   ├── services/               # 18 servicios API
│   ├── store/                  # 8 stores Zustand
│   └── context/                # i18n provider (500+ keys)
├── data/                       # Bases de datos SQLite
├── tests/                      # 101 archivos de test
├── scripts/                    # Scripts de utilidad
└── docs/                       # Documentacion
```

## Backend - Routes (67 modulos, 560+ endpoints)

**3 routes gigantes divididos en packages (Sprint 31):**
- `ai.py` -> `routes/ai/` (5 modulos: core, forecast, materiales, recomendaciones, plan_compras)
- `planner.py` -> `routes/planner/` (7 modulos: core, solicitudes, decisiones, proveedores, acciones, consultas, helpers)
- `solicitudes.py` -> `routes/solicitudes/` (4 modulos: crud, estados, interaccion, helpers)

| Modulo | EP | Proposito |
|--------|----|-----------|
| `admin.py` | 31 | CRUD usuarios, roles, materiales, proveedores |
| `admin_import.py` | 5 | Importacion masiva |
| `planner/` | 21 | Planificacion, decisiones (package) |
| `mi_cuenta.py` | 14 | Perfil, password, preferencias |
| `ai/` | 14 | Recomendaciones IA, forecast (package) |
| `vertex_ia.py` | 10 | Vertex AI chat, TTS, RAG |
| `solicitudes/` | 11 | CRUD solicitudes, estados (package) |
| `metrics.py` | 11 | Metricas + Prometheus |
| `budget.py` | 8 | Presupuestos, ledger, BUR |
| `auth.py` | 7 | Login, refresh, logout |
| `dashboards.py` | 7 | Dashboard unificado, KPIs |
| `dashboards_data.py` | 3 | Paginado, drill-down |
| `ordenes_compra.py` | 8 | Ordenes de compra |
| `stock.py` | 5 | Consulta y gestion stock |
| `health.py` | 6 | Health checks, probes |
| `export.py` | 6 | Exportar, reportes programados |
| `notificaciones.py` | 6 | CRUD notificaciones (SSE) |
| `tms.py` | 8 | Transportation Management |
| `fms.py` | 8 | Fleet Management |
| `matching.py` | 7 | 3-Way Invoice Matching |
| `spend.py` | 6 | Spend Analytics, Kraljic, TCO |
| `supplier_risk.py` | 7 | Riesgo proveedores |
| `demand_planning.py` | 8 | S&OP colaborativo |
| `returns.py` | 7 | Devoluciones RMA |
| `warehouse.py` | 8 | Recepcion, putaway |
| `compliance.py` | 8 | Compliance, rebates |
| `inventory_opt.py` | 9 | Optimizacion multi-ubicacion |
| `supplier_audit.py` | 10 | Auditorias, certificaciones |
| `freight.py` | 10 | Auditoria flete |
| `control_tower.py` | 6 | Control Tower, eventos |
| `sustainability.py` | 11 | ESG, emisiones CO2 |
| `vmi.py` | 9 | Vendor Managed Inventory |
| `lots.py` | 13 | Trazabilidad lotes, recalls |
| `cycle_count.py` | 11 | Conteo ciclico, ajustes |
| `currency.py` | 7 | Multi-moneda, tasas |
| `eco.py` | 11 | Engineering Change Orders |
| `kitting.py` | 14 | Kitting, BOMs |
| `supplier_portal.py` | 12 | Portal proveedores, ASN |
| `copilot.py` | 10 | AI Procurement Copilot |
| `supplier_onboarding.py` | 11 | Onboarding proveedores |
| `price_management.py` | 13 | Listas precios, negociaciones |
| `consignment.py` | 10 | Inventario consignacion |
| `customs.py` | 11 | Aduanas, HS codes |
| `kanban.py` | 10 | Kanban, reposicion pull |
| `production.py` | 13 | Production Planning MPS |
| `warranty.py` | 11 | Garantias, reclamos |
| `packaging.py` | 12 | Packing lists, etiquetas |
| `supplier_finance.py` | 11 | Descuento dinamico |
| `executive_analytics.py` | 10 | Dashboard ejecutivo |
| Otros | ~30 | mensajes, push, foro, catalogos, equivalencias, materiales, sla, mrp, mrp_portfolio, trivias, docs, database |

### Services (49 servicios)

Cada route tiene su service correspondiente (`routes/X.py` → `services/X_service.py`). Servicios clave:
- `ai_service.py` — Orchestrador ML (clustering, scoring, forecast)
- `mrp_service.py` — Motor MRP (EOQ, ROP, alertas)
- `dashboard_service.py` — Dashboard unificado, metricas por rol
- `reporting_service.py` — Exportacion Excel/CSV/PDF
- `copilot_service.py` — Chat IA procurement, sugerencias sourcing
- `lot_service.py` — Lotes FIFO/FEFO, genealogia, recalls
- `warehouse_service.py` — Docks, tareas putaway
- `production_planning_service.py` — Work centers, MPS, capacidad

### Core (39 modulos)

| Categoria | Modulos |
|-----------|---------|
| **Auth** | `auth_middleware.py`, `roles.py`, `user_helpers.py` |
| **Database** | `db.py`, `db_optimization.py`, `repository_legacy.py`, `repository/` (11 clases) |
| **Schemas** | `schemas.py`, `budget_schemas.py`, `notification_schemas.py`, `item_schemas.py`, `dashboard_schemas.py`, `tms_schemas.py` |
| **Validation** | `request_validation.py` (sanitizacion XSS/SQL), `excel_validator.py` |
| **Security** | `csrf.py`, `security_headers.py`, `rate_limit.py` |
| **CORS** | `cors.py` (manejo manual con regex/wildcards) |
| **Blueprints** | `blueprints.py` (registro centralizado de 53 blueprints) |
| **Cache** | `cache.py` (L1 memory + L2 Redis), `cache_advanced.py`, `cache_loader.py` |
| **State** | `fsm.py` (maquina de estados solicitudes) |
| **Monitoring** | `metrics.py`, `observability.py` |
| **Jobs** | `background_jobs.py`, `celery_app.py`, `tasks.py` |
| **WebSocket** | `websocket.py`, `redis_pubsub.py` |
| **Config** | `config.py`, `push_config.py` |

### Agent/ML (46 archivos)

```
agent/
├── core/           # memory.py, react_agent.py, reasoner.py
├── pipelines/      # clustering, scoring, demand_forecast, anomaly_detection
│   └── forecast/   # arima, prophet, xgboost, sklearn, stl, ensemble, backtesting, tuning
├── rag/            # vector_store, embedder, retriever, llm_client, gemini_client, prompts
├── proactive/      # suggester.py
└── tools/          # data_loader, evaluator, material_matcher, ml_trainer, nlp_processor, predictor
```

## Frontend

### Pages (139 paginas) — Categorias principales

Auth (2), Solicitudes (5), Aprobacion (2), Planificacion (1 wizard 4 pasos), MRP (3), Budget (3), Stock (2), Catalogos (2), Comunicacion (5), Usuario (2), Dashboards (2), Forecast (2), SLA (1), IA/Analisis (2), TMS (5), FMS (5), Gamificacion (1), Procurement (1), Reportes (1), Admin (13), Invoice Matching (2), Spend Analytics (1), Supplier Risk (1), Demand Planning (2), Returns (2), Warehouse (2), Compliance (2), Inventory Opt (2), Supplier Audit (2), Freight (2), Control Tower (1), Sustainability (1), VMI (2), Lot Traceability (4), Cycle Count (2), Currency (1), ECO (2), Kitting (4), Supplier Portal (2), AI Copilot (1), Supplier Onboarding (2), Price Management (2), Consignment (2), Customs (2), Kanban (2), Production (2), Warranty (2), Packaging (2), Supplier Finance (2), Executive (2)

### Components (145 totales)

| Carpeta | Cant. | Proposito |
|---------|-------|-----------|
| `ui/` | 49 | Primitivos (Button, Input, Card, Modal, Badge, OfflineBanner, etc.) |
| `features/DataTable/` | 1 | ModernDataTable con TanStack Table |
| `materials/` | 3 | MaterialDetailModal, MaterialsTable, SearchDropdown |
| `Planner/` | 7 | Wizard de 4 pasos + StockDetalleModal |
| `forecast/` | 11 | BacktestResults, ForecastChart, EnsembleChart, etc. |
| `Dashboard/` | 7 | Componentes dashboard + DrillDownModal |
| `DashboardAdmin/` | 7 | KPIRow1-3, FiltersBar, SolicitudesSection |
| `SCM/` | 7 | MatchComparisonTable, KraljicMatrix, RiskScoreBreakdown, etc. |
| **Core** | 11 | Layout, Sidebar, ErrorBoundary, ProtectedRoute, etc. |

### Hooks (22 totales)

| Hook | Proposito |
|------|-----------|
| `useMaterials.js` | Orquestador de Materials.jsx (compone 3 sub-hooks) |
| `useMaterialSearch.js` | Busqueda y filtrado |
| `useMaterialCart.js` | Carrito y seleccion |
| `useMaterialForm.js` | Estado formulario |
| `useToast.js` | API unificada de toast |
| `usePushNotifications.js` | Push notifications |
| `useNotifications.js` | WebSocket (fallback SSE/polling) |
| `useForecast.js` | Pronosticos |
| `usePlanner.js` | Wizard planificacion |
| `useRealtime.js` | Eventos WebSocket |
| `useFormValidation.js` | Validacion formularios |
| `useKeyboardShortcuts.js` | Atajos teclado |
| Otros | useDebounced, useDebouncedValue, useScrollReveal, useAdminEstado, useParallax, useSwipeGesture, useTour, useShipments, useFleet |

### Services (18) y Stores (8)

**Services:** api.js (Axios+CSRF+refresh), auth.js, csrf.js, spm.js (negocio), agent.js (IA), account.js, ai.js, export.js, forecast.js, sla.js, dashboard.js, tms.js, fms.js, vertex.js (IA+TTS), procurement.js, tempData.js, cachedApi.js, requestCache.js

**Stores Zustand:** authStore, chatStore, realtimeStore, dashboardStore, tmsStore, fmsStore, tourStore, vertexStore

## Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Usuarios, solicitudes, auth, mensajes | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |
| `data/catalogo_materiales.db` | Catalogo completo materiales SAP | ~28,000 |

**Produccion:** PostgreSQL con 83 migraciones (003-083). Tablas renombradas a espanol (migracion 025).

**Reimportacion datos SAP:** `python scripts/migrate_excel_to_db.py`

### Migraciones — Rangos

- `003-013`: Core (budget, config, planner, fsm, approval, sla, mrp, notifications, indexes)
- `020-029`: PostgreSQL, catalogos, Vertex IA, SLA, renombre tablas, dashboards, TMS, FMS
- `033-038`: Import SAP, ordenes compra, reportes, scorecard, auto-aprobacion
- `039-053`: Escalacion, webhooks, favoritos, audit log, savings, contratos, RFQ, calidad
- `054-073`: SCM avanzado (matching, spend, risk, S&OP, RMA, warehouse, compliance, inventory, freight, control tower, ESG, VMI, lots, cycle count, currency, ECO, kitting, supplier portal, copilot)
- `074-083`: Supplier onboarding, price management, consignment, customs, kanban, production, warranty, packaging, supplier finance, executive analytics

## Modulos SCM Avanzados (Sprints 61-90)

Cada modulo sigue el patron: `routes/X.py` + `services/X_service.py` + migracion + 2 paginas frontend.

| Sprint | Modulo | Tablas principales | Features clave |
|--------|--------|--------------------|----------------|
| 61 | **Invoice Matching** | factura_proveedor, matching_resultado | 3-Way match PO vs Receipt vs Invoice, resolucion discrepancias |
| 62 | **Spend Analytics** | spend_categoria, spend_snapshot | Kraljic 2x2, maverick spend, TCO, tendencia mensual |
| 63 | **Supplier Risk** | proveedor_riesgo, proveedor_riesgo_historial | Risk scoring 5 dimensiones, fuentes unicas, alertas |
| 64 | **Demand Planning** | plan_demanda, plan_demanda_consenso | Ciclos S&OP con FSM, baseline ML, consenso ponderado |
| 65 | **Returns/RMA** | devolucion, devolucion_item | RMA con FSM, NCR, tracking creditos |
| 66 | **Warehouse** | dock_recepcion, putaway_tarea | Grid visual docks, auto-generacion tareas putaway |
| 67 | **Compliance** | compliance_check, rebate_programa | Compliance OC vs contrato, rebates volume/growth/flat |
| 68 | **Inventory Opt** | transferencia_inventario, nivel_servicio_objetivo | Desbalances, transferencias, stock seguridad (Z*σ*√L) |
| 69 | **Supplier Audit** | proveedor_certificacion, auditoria_hallazgo | ISO tracking, auditorias on-site/remote, vencimientos |
| 70 | **Freight Audit** | factura_flete, freight_tarifa | Auto-audit vs tarifas, aprobacion/disputa |
| 71 | **Control Tower** | control_tower_event, control_tower_kpi_snapshot | Timeline eventos, KPIs real-time, sparkline trends |
| 72 | **Sustainability** | emision_carbono, proveedor_esg_score, meta_sostenibilidad | Emisiones scope/categoria, ESG scores, metas progreso |
| 73 | **VMI** | vmi_programa, vmi_reposicion | Programas min/max/EOQ/forecast, inventario compartido |
| 74 | **Lot Traceability** | lote, lote_movimiento, recall | FIFO/FEFO, genealogia, traceability forward/backward |
| 75 | **Cycle Count** | cycle_count_programa, ajuste_inventario | ABC/random/fisico, varianza auto, accuracy rate |
| 76 | **Multi-Currency** | tipo_cambio, conversion_log | Tasas manuales/API, exposicion cambiaria |
| 77 | **ECO** | eco, eco_cambio, eco_aprobacion | ECOs con FSM, cambios material/spec/supplier, multi-nivel |
| 78 | **Kitting** | kit_bom, kit_bom_componente, kit_orden | BOMs versionados, ordenes produccion, verificacion disponibilidad |
| 79 | **Supplier Portal** | portal_proveedor_usuario, asn, forecast_compartido | Login separado, PO acknowledge, ASN, forecasts |
| 80 | **AI Copilot** | copilot_conversacion, copilot_sugerencia | Chat IA, sugerencias sourcing, auto-draft RFQ, learning |
| 81 | **Supplier Onboarding** | supplier_onboarding, onboarding_documento | Workflow onboarding, documentos, evaluaciones por etapa |
| 82 | **Price Management** | lista_precios, precio_negociacion | Multi-version, negociaciones, comparacion multi-proveedor |
| 83 | **Consignment** | consignment_programa, consignment_reconciliacion | Stock compartido, consumo rastreado, reconciliaciones |
| 84 | **Customs** | hs_code, operacion_aduanera, acuerdo_comercial | Clasificacion HS, tributos, acuerdos comerciales |
| 85 | **Kanban** | kanban_tablero, kanban_tarjeta, kanban_senal | Tableros visual, señales reposicion auto, metricas flujo |
| 86 | **Production** | work_center, plan_produccion, produccion_capacidad | MPS, analisis capacidad, explosion materiales |
| 87 | **Warranty** | garantia, reclamo_garantia | Workflow reclamos, resolucion, documentos adjuntos |
| 88 | **Packaging** | packaging_template, packing_list, shipping_label | Templates, packing auto-generadas, etiquetas envio |
| 89 | **Supplier Finance** | programa_descuento, oferta_descuento | Descuento dinamico, early payment, simulacion cashflow |
| 90 | **Executive** | executive_kpi, benchmark, procurement_scorecard | KPIs ejecutivos, benchmarks industria, trends estrategicos |

## Modulos con Detalle Especial

### Flujo de Solicitudes (FSM)
```
draft -> submitted -> approved/rejected -> processing -> dispatched -> closed
```

### Roles
| Rol | Permisos |
|-----|----------|
| **admin** | Acceso total |
| **coordinador** | Aprobar/rechazar |
| **usuario** | Crear solicitudes |
| **planner** | Planificar aprobadas |
| **jefe** | Supervision |
| **Aprobador de Presupuesto** | Aprobar BURs |

### Dashboard Unificado
- Backend: `routes/dashboards.py`, `services/dashboard_service.py`, `dashboard_formulas.py`
- Frontend: `DashboardAdmin.jsx` (orquestador) + 7 sub-componentes en `pages/DashboardAdmin/`
- Drill-down: `dashboards_data.py` con paginacion server-side y DrillDownModal (AG-Grid)

### Vertex AI / TTS
- Backend: `routes/vertex_ia.py`, `services/tts_service.py`, `agent/rag/`
- Features: Chat con RAG, TTS (voces: tomas/elena AR, jorge/dalia MX), anti-alucinacion, cache
- Migracion 022 auto-ejecuta en startup

### Forecast (Pronosticos)
- Modelos: ARIMA, Prophet, XGBoost, Sklearn, STL, Ensemble (weighted 1/MAPE)
- Backend: `agent/pipelines/forecast/`, `routes/ai/forecast.py`
- Frontend: ForecastIndividual, ForecastMasivo + 11 componentes

### Presupuestos
- Niveles: L1 hasta $200K, L2 hasta $1M, ADMIN mas de $1M
- Auto-aprobacion: `services/auto_approval_service.py` (reglas configurables)

### Celery Tasks Programadas
- Spend snapshot (1ro mes 4AM), Risk recalc (lunes 5AM), Cert expiry (diario 7AM)
- Control Tower KPIs (cada hora), Alertas (cada 15min), Kanban reposicion (cada 30min)
- Emisiones ESG (1ro mes 5AM), VMI reposiciones (diario 6:30AM), Lote vencimientos (diario 7:30AM)
- Currency import (diario 9AM), Garantias vencimiento (diario 8AM), Consignment reconciliacion (1ro mes 4:30AM)
- Executive KPIs snapshot (1ro mes 1AM)

## Tests

| Categoria | Archivos | Tests | Cobertura |
|-----------|----------|-------|-----------|
| Backend Unit | 55 | 1,000+ | Excelente |
| Backend Integration | 17 | 200+ | Buena |
| Backend E2E | 2 | 30+ | Buena |
| Frontend | 25 | 190+ | Mejorando |
| **Total** | **101** | **1,330+** | |

**CI excluidos (fallan pre-existente):** test_budget_service, test_fsm, test_mrp_parametros, test_planner_service, test_forecast_parallel, test_stl_decomposition, test_cors, test_lstm_model, test_openapi, test_deepseek_client, test_approval_rules, test_dashboard_formulas, test_cache_expiracion

**Frontend:** 17 archivos pre-existentes fallan en CI (`continue-on-error: true`), 8 pasan

## Issues Conocidos

### Bugs (no bloqueantes)

| ID | Descripcion | Severidad |
|----|-------------|-----------|
| BUR-001 | Reversion BUR falla (constraint tipo_movimiento) | Media |
| USER-001 | notification-preferences SQL syntax error | Media |
| USER-002 | admin/profile-requests columna faltante | Media |
| ADMIN-001 | presupuestos/historial error 500 | Baja |
| COMM-001 | notificaciones/test error 500 | Baja |

### Deuda Tecnica
- Imports try/except duplicados en 24 archivos routes
- `_get_user()` duplicada en 5+ routes
- Bare except handlers en mi_cuenta.py, admin.py
- 6 archivos con TODO/FIXME pendientes

## Security

| Severidad | Estado |
|-----------|--------|
| CRITICAL (3) | Todos resueltos |
| HIGH (7) | 6 resueltos, 1 pendiente |
| MEDIUM (10) | Mayoria resueltos |

**Protecciones implementadas:** bcrypt passwords, rate limiting (login 10/5min, admin 30/min), security headers, SQL parametrizado, JWT (1h access + 7d refresh), httpOnly cookies (prod), ownership validation, CSRF, XSS sanitization, Sentry tracking, CI/CD bloqueante

**Endpoints protegidos:** `/api/health` sin auth (solo status), `/api/health/routes|dependencies` requiere admin, `/api/catalogos/*` requiere auth, `/api/docs/*` requiere auth en prod

## Convenciones de Codigo

### Python (backend)
- snake_case para variables/funciones
- Validacion con Pydantic en `core/schemas.py`
- Blueprints por dominio en `routes/`
- Linting: Ruff (config en `pyproject.toml`, ignores E402/E721)

### JavaScript/React (frontend)
- camelCase variables, PascalCase componentes
- Componentes UI en `components/ui/`
- **Usar sistema i18n para TODOS los textos visibles**
- Linting: ESLint (`.eslintrc.cjs`)
- Sub-componentes grandes extraidos con React.memo()

### Sistema i18n
- Ubicacion: `frontend/src/context/i18n.jsx`
- API: `const { t } = useI18n(); t('clave', 'fallback')`
- Prefijos por modulo: `nav_`, `dash_`, `common_`, `materials_`, `admin_`, `planner_`, `matching_`, `spend_`, `risk_`, `demand_`, `returns_`, `warehouse_`, `compliance_`, `inv_opt_`, `cert_`, `freight_`, `ct_`, `sust_`, `vmi_`, `lot_`, `cc_`, `curr_`, `eco_`, `kit_`, `portal_`, `copilot_`, `onb_`, `price_`, `cons_`, `customs_`, `kanban_`, `prod_`, `warr_`, `pack_`, `sf_`, `exec_`

### Estilos
- Solo light mode (dark mode eliminado)
- CSS Variables: `frontend/src/index.css`
- Tailwind: `frontend/tailwind.config.js`
- Estados: `frontend/src/utils/styleConfig.js`

## Reglas de Negocio

- Solicitudes requieren minimo 1 item con cantidad > 0
- Presupuesto validado por centro/sector antes de aprobar
- Materiales identificados por codigo SAP unico
- JWT: access token 1h + refresh token 7d
- Dashboard unificado para todos los roles

## CI/CD

**CI Pipeline** (`.github/workflows/ci.yml`): Backend tests (con exclusiones) + lint (Ruff) + Frontend build (Vite+PWA) + lint (ESLint, max 100 warnings) + tests (non-blocking) + security audit (non-blocking)

**Deploy** (`.github/workflows/deploy-production.yml`): rsync VPS, backup pg_dump pre-deploy, rollback automatico, health check, init tablas Vertex

## Historial de Sprints (resumen)

- **1-16** (Dic 2025): Core SPM (FSM, Auth, MRP, AI, Budget, SLA, Push, etc.)
- **17-24** (Dic 2025 - Ene 2026): Auditoria, reorganizacion, presupuestos, auth fixes, agentes+RAG, refactoring
- **25-26** (Feb 2026): Deploy produccion, TMS/FMS/Dashboards, hardening seguridad, Vertex IA prod
- **27-34** (Feb 2026): SSE non-blocking, Redis cache, useToast, WebSocket notifs, split packages, PWA, Sentry+Prometheus
- **35-40** (Feb 2026): Paginacion server-side, drill-down, reportes programados, ensemble forecast, scorecard, auto-aprobacion
- **41-60** (Feb 2026): Deuda tecnica, escalacion, webhooks, audit log, savings, contratos, RFQ, calidad, CAPA
- **61-80** (Feb 2026): SCM avanzado (matching, spend, risk, S&OP, RMA, warehouse, compliance, inventory, freight, control tower, ESG, VMI, lots, cycle count, currency, ECO, kitting, supplier portal, copilot)
- **81-90** (Feb 2026): Supplier onboarding, price management, consignment, customs, kanban, production, warranty, packaging, supplier finance, executive analytics

## Instrucciones para Claude

1. Explicar el plan antes de modificar codigo
2. Cambios pequenos y controlados
3. Usar siempre el sistema i18n para textos de UI
4. Mantener consistencia con CSS variables + Tailwind
5. No hardcodear textos en espanol/ingles
6. No modificar estructura de BD sin crear migracion
7. Verificar que el build compile sin errores
8. **Priorizar tests para frontend** (cobertura critica baja)
9. Usar `repository_legacy.py` o `repository/` modular para datos

### Seguridad (Obligatorio)

- **Siempre validar ownership** antes de acceder/modificar datos de usuario
- **Usar SQL parametrizado** — nunca f-strings para queries
- **Validar inputs** con `@validate_json()` o schemas Pydantic
- **No exponer errores internos** — mensajes genericos al cliente
- **Agregar rate limiting** a endpoints sensibles
- **Revisar permisos por rol** antes de operaciones criticas
- **Proteger endpoints nuevos** con `@require_auth` o `@require_admin`

### Usuarios de Prueba

```
Usuario: 1 (Manu) / Password: password123
Roles: Admin, Aprobador_presupuestos, Aprobador_solicitudes, Planificador
```

## Documentacion

- `docs/ARQUITECTURA_SPM_2_0.md` — Arquitectura completa
- `docs/DEPLOYMENT.md` — Guia de despliegue
- `docs/AUDIT.md` — Auditoria seguridad y calidad
- `docs/guides/CODE_REVIEW_GUIDE.md` — Code review
- `docs/guides/QUICK_REFERENCE_BD.md` — Referencia BD