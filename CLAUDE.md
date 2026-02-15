# CLAUDE.md

Guia para Claude Code (claude.ai/code) cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2026-02-15 (Sprints 61-70: matching, spend, risk, demand planning, returns, warehouse, compliance, inventory opt, audit, freight)

## Resumen del Proyecto

| Metrica | Valor |
|---------|-------|
| **Backend** | 245+ archivos Python, ~85,000 lineas |
| **Frontend** | 119 paginas, 143 componentes, 22 hooks |
| **Endpoints API** | 350+ endpoints en 47 modulos (3 packages) |
| **Tests** | 1,330+ tests (101 archivos backend, 25 frontend) |
| **Base de Datos** | 3 SQLite + PostgreSQL (produccion) |

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
python scripts/seed_dev_data.py -v       # Modo verbose
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
│   ├── services/               # 29 servicios de negocio
│   ├── core/                   # 39 modulos de infraestructura
│   ├── agent/                  # 46 archivos ML/IA (forecast/, rag/, proactive/)
│   └── migrations/             # 63 migraciones de BD
├── frontend/src/
│   ├── pages/                  # 119 paginas + DashboardAdmin/ sub-componentes
│   ├── components/             # 143 componentes (incl. OfflineBanner)
│   ├── hooks/                  # 22 custom hooks (incl. useMaterial*, useToast)
│   ├── services/               # 18 servicios API
│   ├── store/                  # 8 stores Zustand
│   └── context/                # i18n provider (500+ keys)
├── data/                       # Bases de datos SQLite
├── tests/                      # 101 archivos de test
├── scripts/                    # Scripts de utilidad
└── docs/                       # Documentacion
```

## Backend - Inventario Completo

### Routes (47 modulos, 350+ endpoints)

**Nota:** 3 routes gigantes fueron divididos en packages modulares (Sprint 31):
- `ai.py` (1902 ln) -> `routes/ai/` (5 modulos: core, forecast, materiales, recomendaciones, plan_compras)
- `planner.py` (2049 ln) -> `routes/planner/` (7 modulos: core, solicitudes, decisiones, proveedores, acciones, consultas, helpers)
- `solicitudes.py` (2044 ln) -> `routes/solicitudes/` (4 modulos: crud, estados, interaccion, helpers)

| Modulo | Endpoints | Proposito |
|--------|-----------|-----------|
| `admin.py` | 31 | CRUD usuarios, roles, materiales, proveedores |
| `admin_import.py` | 5 | Importacion masiva de datos |
| `planner/` | 21 | Planificacion de solicitudes, decisiones (package) |
| `mi_cuenta.py` | 14 | Perfil, password, preferencias |
| `ai/` | 14 | Recomendaciones IA, analisis, forecast (package) |
| `vertex_ia.py` | 10 | Vertex AI chat, TTS, RAG, status |
| `solicitudes/` | 11 | CRUD solicitudes, estados, archivos (package) |
| `metrics.py` | 11 | Metricas de rendimiento + Prometheus |
| `budget.py` | 8 | Presupuestos, ledger, BUR |
| `mensajes.py` | 8 | Sistema de mensajeria |
| `mrp.py` | 8 | Alertas MRP, KPIs, catalogo |
| `auth.py` | 7 | Login, refresh, logout, registro |
| `sla.py` | 7 | Metricas SLA, alertas |
| `dashboards.py` | 7 | Dashboard unificado, KPIs por rol |
| `tms.py` | 8 | Transportation Management System |
| `fms.py` | 8 | Fleet Management System |
| `ordenes_compra.py` | 8 | Ordenes de compra |
| `stock.py` | 5 | Consulta y gestion de stock |
| `mrp_portfolio.py` | 5 | Analisis de portfolio MRP |
| `docs.py` | 6 | Swagger UI, OpenAPI |
| `export.py` | 6 | Exportar solicitudes, inventario, reportes programados |
| `notificaciones.py` | 6 | CRUD notificaciones (SSE non-blocking) |
| `push.py` | 6 | Push notifications |
| `health.py` | 6 | Health checks, probes, diagnostics |
| `database.py` | 5 | Admin de base de datos |
| `procurement.py` | 5 | Gestion de compras, ranking proveedores |
| `catalogos.py` | 5 | Centros, sectores, puestos (requiere auth) |
| `equivalencias.py` | 5 | Equivalencias de materiales |
| `foro.py` | 5 | Posts, replies, likes |
| `materiales.py` | 3 | Busqueda, detalle, stats |
| `trivias.py` | 3 | Rankings, scores |
| `assistant.py` | 2 | Sugerencias IA |
| `kpis.py` | 1 | Dashboard KPIs |
| `dashboards_data.py` | 3 | Dashboard data paginada, drill-down analytics |
| `materiales_detalle.py` | 0 | Helpers de detalle materiales |
| `matching.py` | 7 | 3-Way Invoice Matching (PO vs Receipt vs Invoice) |
| `spend.py` | 6 | Spend Analytics, Kraljic Matrix, TCO |
| `supplier_risk.py` | 7 | Evaluacion riesgo proveedores, fuentes unicas |
| `demand_planning.py` | 8 | Planificacion demanda colaborativa (S&OP) |
| `returns.py` | 7 | Devoluciones y logistica inversa (RMA) |
| `warehouse.py` | 8 | Recepcion warehouse, docks, putaway |
| `compliance.py` | 8 | Compliance contratos, programas rebate |
| `inventory_opt.py` | 9 | Optimizacion inventario multi-ubicacion |
| `supplier_audit.py` | 10 | Auditorias y certificaciones proveedores |
| `freight.py` | 10 | Auditoria facturas flete, tarifas |

### Services (29 servicios)

| Servicio | Proposito |
|----------|-----------|
| `ai_service.py` | Orchestrador ML (clustering, scoring, forecast) |
| `mrp_service.py` | Motor MRP (EOQ, ROP, alertas) |
| `reporting_service.py` | Exportacion Excel/CSV/PDF |
| `sla_service.py` | Tiempos limite, alertas SLA |
| `approval_service.py` | Matriz de aprobacion, delegacion |
| `audit_service.py` | Trail de auditoria |
| `budget_service.py` | Presupuestos, BUR |
| `push_service.py` | Web Push notifications |
| `notification_service.py` | Notificaciones in-app + WebSocket emit |
| `message_service.py` | Sistema de mensajes |
| `planner_service.py` | Logica de planificacion |
| `dashboard_service.py` | Dashboard unificado, metricas por rol |
| `dashboard_formulas.py` | Formulas y calculos de KPIs |
| `tms_service.py` | Gestion de transporte y envios |
| `fms_service.py` | Gestion de flota vehicular |
| `tts_service.py` | Text-to-Speech (Edge TTS, voces AR/MX) |
| `oc_service.py` | Ordenes de compra |
| `recommendation_engine.py` | Motor de recomendaciones |
| `temp_data_service.py` | Datos temporales y cache |
| `report_generator.py` | Generador de reportes (solicitudes, stock, KPIs, materiales) |
| `auto_approval_service.py` | Evaluacion de reglas auto-aprobacion |
| `matching_service.py` | 3-Way Matching (PO vs Receipt vs Invoice) |
| `spend_service.py` | Spend analytics, Kraljic, maverick, TCO |
| `supplier_risk_service.py` | Risk scoring compuesto (5 dimensiones) |
| `demand_planning_service.py` | Ciclos S&OP, baseline ML, consenso |
| `returns_service.py` | RMA con FSM, integracion NCR, creditos |
| `warehouse_service.py` | Docks recepcion, tareas putaway |
| `compliance_service.py` | Verificacion compliance OC, rebates |
| `inventory_optimization_service.py` | Desbalances, transferencias, niveles servicio |
| `supplier_audit_service.py` | Certificaciones, auditorias, hallazgos |
| `freight_audit_service.py` | Auto-audit fletes vs tarifas |

### Core (39 modulos)

| Categoria | Modulos |
|-----------|---------|
| **Auth** | `auth_middleware.py`, `roles.py`, `user_helpers.py` |
| **Database** | `db.py`, `db_optimization.py`, `repository_legacy.py`, `repository/` (11 clases modulares) |
| **Schemas** | `schemas.py`, `budget_schemas.py`, `notification_schemas.py`, `item_schemas.py`, `dashboard_schemas.py`, `tms_schemas.py` |
| **Validation** | `request_validation.py` (sanitizacion XSS/SQL), `excel_validator.py` |
| **Security** | `csrf.py`, `security_headers.py`, `rate_limit.py` |
| **CORS** | `cors.py` (manejo manual con regex/wildcards) |
| **SPA** | `spa.py` (servir frontend React) |
| **Blueprints** | `blueprints.py` (registro centralizado de 43 blueprints) |
| **Cache** | `cache.py` (L1 memory + L2 Redis), `cache_advanced.py`, `cache_loader.py` |
| **State** | `fsm.py` (maquina de estados solicitudes) |
| **Errors** | `errors.py` (excepciones custom) |
| **Monitoring** | `metrics.py`, `observability.py` |
| **Jobs** | `background_jobs.py`, `celery_app.py`, `tasks.py` |
| **WebSocket** | `websocket.py`, `redis_pubsub.py` |
| **Config** | `config.py`, `push_config.py` |
| **API Docs** | `openapi.py` |
| **Budget** | `budget_transaction.py` |
| **Helpers** | `helpers.py` (funciones consolidadas) |
| **Migrations** | `migration_runner.py` |

### Repository Modular (backend/core/repository/)

| Modulo | Proposito |
|--------|-----------|
| `base.py` | Clase base con conexion BD |
| `solicitud.py` | CRUD solicitudes |
| `material.py` | Busqueda y detalle materiales |
| `decision.py` | Decisiones de planificacion |
| `equivalencias.py` | Equivalencias SAP |
| `mrp.py` | Datos MRP |
| `presupuesto.py` | Presupuestos y ledger |
| `proveedor.py` | Proveedores |
| `tratamiento.py` | Tratamientos de solicitud |
| `config.py` | Configuracion BD |

### Agent/ML (46 archivos)

```
agent/
├── core/
│   ├── memory.py          # Memoria del agente
│   ├── react_agent.py     # Loop ReAct
│   └── reasoner.py        # Razonamiento estructurado
├── pipelines/
│   ├── clustering.py      # Agrupacion de materiales
│   ├── scoring.py         # Priorizacion de solicitudes
│   ├── demand_forecast.py # Proyeccion de demanda
│   ├── anomaly_detection.py # Deteccion de anomalias
│   ├── forecast.py        # Orchestrador de pronosticos
│   └── forecast/          # Modelos avanzados de pronostico
│       ├── arima_model.py     # Modelo ARIMA
│       ├── prophet_model.py   # Modelo Prophet
│       ├── xgboost_model.py   # Modelo XGBoost
│       ├── sklearn_models.py  # Modelos Sklearn
│       ├── stl_decomposition.py # Descomposicion STL
│       ├── backtesting.py     # Validacion temporal
│       ├── tuning.py          # Optimizacion hiperparametros
│       ├── model_registry.py  # Registro de modelos
│       ├── predictor.py       # Motor de prediccion
│       └── base.py            # Clase base modelos
├── rag/                       # Retrieval Augmented Generation
│   ├── vector_store.py    # Almacenamiento vectorial
│   ├── embedder.py        # Generacion de embeddings
│   ├── retriever.py       # Busqueda semantica
│   ├── llm_client.py      # Cliente LLM generico
│   ├── gemini_client.py   # Cliente Gemini/Vertex
│   ├── prompts.py         # Templates de prompts
│   └── vertex_prompts.py  # Prompts especificos Vertex
├── proactive/
│   └── suggester.py       # Sugerencias proactivas
└── tools/
    ├── base.py            # Abstraccion de herramientas
    ├── data_loader.py     # Carga de datos historicos (PostgreSQL)
    ├── evaluator.py       # Evaluacion de modelos
    ├── material_matcher.py # Matching de materiales
    ├── ml_trainer.py      # Entrenamiento ML
    ├── nlp_processor.py   # Procesamiento NLP
    └── predictor.py       # Predicciones
```

## Frontend - Inventario Completo

### Pages (119 paginas totales)

| Categoria | Paginas |
|-----------|---------|
| **Auth** | Login, CompleteRegistration |
| **Solicitudes** | CreateSolicitud, Materials, MisSolicitudes, SolicitudDetalle, TodasLasSolicitudes |
| **Aprobacion** | Aprobaciones, HistorialAprobaciones |
| **Planificacion** | Planner (con wizard 4 pasos) |
| **MRP** | MRPTableroAlertas, MRPKPIs, MRPPortfolio |
| **Budget** | BudgetRequests, BudgetRequestCreate, BudgetRequestDetail |
| **Stock** | Stock, StockIndividual |
| **Catalogos** | CatalogoMateriales, CatalogoEquivalencias |
| **Comunicacion** | Mensajes, Notificaciones, Foro, Ayuda, CentroInteraccion |
| **Usuario** | MiCuenta, Dashboard (unificado para todos los roles) |
| **Dashboards** | DashboardAdmin (unificado), DashboardShared |
| **Forecast** | ForecastIndividual, ForecastMasivo |
| **SLA** | SLADashboard |
| **IA/Analisis** | AIAnalytics, KPI |
| **TMS** | 5 paginas de gestion de transporte |
| **FMS** | 5 paginas de gestion de flota |
| **Gamificacion** | Trivias |
| **Procurement** | ProveedorScorecard (radar chart + ranking + tendencias) |
| **Reportes** | ReportesProgramados (CRUD con ejecucion manual) |
| **Admin** | AdminUsuarios, AdminRoles, AdminCentros, AdminSectores, AdminMateriales, AdminProveedores, AdminPresupuestos, AdminEstado, AdminPlanificadores, AdminPuestos, AdminAlmacenes, AdminSolicitudesPerfil, AdminAutoAprobacion |
| **Invoice Matching** | InvoiceList, InvoiceDetail |
| **Spend Analytics** | SpendAnalytics |
| **Supplier Risk** | SupplierRiskMap |
| **Demand Planning** | DemandPlanning, DemandPlanDetail |
| **Returns/RMA** | ReturnsList, ReturnDetail |
| **Warehouse** | WarehouseReceiving, PutawayTasks |
| **Compliance** | ContractCompliance, RebatePrograms |
| **Inventory Opt** | InventoryOptimization, ServiceLevels |
| **Supplier Audit** | SupplierCertifications, SupplierAudits |
| **Freight** | FreightAudit, FreightTariffs |

### Components (143 totales)

| Carpeta | Componentes | Proposito |
|---------|-------------|-----------|
| `ui/` | 49 | Primitivos (Button, Input, Card, Modal, Badge, OfflineBanner, etc.) |
| `features/DataTable/` | 1 | ModernDataTable con TanStack Table |
| `materials/` | 3 | MaterialDetailModal, MaterialsTable, SearchDropdown |
| `Planner/` | 7 | Wizard de 4 pasos + StockDetalleModal |
| `forecast/` | 11 | BacktestResults, ForecastChart, ForecastKPIs, EnsembleChart, etc. |
| `Dashboard/` | 7 | Componentes de dashboard unificado, DrillDownModal |
| `Canvas/Charts` | 6 | Visualizaciones y graficos |
| `Tour/` | 3 | Guia interactiva de usuario |
| `Analytics/` | 2 | Componentes de analisis |
| `Admin/` | 3 | Templates CRUD admin |
| `export/` | 1 | ExportButton |
| `DashboardAdmin/` | 7 | KPIRow1-3, FiltersBar, SolicitudesSection, ExpandCardButton, ExpandedCardDialog |
| **Core** | 11 | Layout, Sidebar, ErrorBoundary, ProtectedRoute, Loading, AdminCrudTemplate, AssistantModal, ChatAssistant, MensajeThreadModal, HeaderNav |
| `SCM/` | 7 | MatchComparisonTable, KraljicMatrix, RiskScoreBreakdown, ForecastComparisonChart, ImbalanceHeatmap, DockBoard, CertExpiryBadge |

### Hooks (22 totales)

| Hook | Proposito |
|------|-----------|
| `useMaterials.js` | Orquestador de Materials.jsx (compone 3 sub-hooks) |
| `useMaterialSearch.js` | Busqueda y filtrado de materiales |
| `useMaterialCart.js` | Carrito y seleccion de materiales |
| `useMaterialForm.js` | Estado de formulario de materiales |
| `useToast.js` | API unificada de notificaciones toast |
| `usePushNotifications.js` | Registro y gestion push |
| `useDebounced.js` | Debounce de valores |
| `useDebouncedValue.js` | Debounce alternativo |
| `useNotifications.js` | Notificaciones WebSocket (fallback SSE/polling) |
| `useScrollReveal.js` | Animaciones scroll |
| `useForecast.js` | Estado y logica de pronosticos |
| `usePlanner.js` | Estado del wizard de planificacion |
| `useRealtime.js` | Eventos en tiempo real WebSocket |
| `useAdminEstado.js` | Estado de admin |
| `useFormValidation.js` | Validacion de formularios |
| `useKeyboardShortcuts.js` | Atajos de teclado |
| `useParallax.js` | Efectos parallax |
| `useSwipeGesture.js` | Gestos tactiles |
| `useTour.js` | Tour guiado de usuario |
| `useShipments.js` | Gestion de envios (TMS) |
| `useFleet.js` | Gestion de flota (FMS) |

### Services (18 totales)

| Servicio | Proposito |
|----------|-----------|
| `api.js` | Axios con interceptors, CSRF, refresh token |
| `auth.js` | Login, tokens, logout (httpOnly cookies en prod) |
| `csrf.js` | Gestion token CSRF |
| `spm.js` | Operaciones de negocio (solicitudes, materiales, etc.) |
| `agent.js` | Asistente IA |
| `account.js` | Perfil de usuario |
| `ai.js` | Servicios de IA y analisis |
| `export.js` | Exportacion de datos |
| `forecast.js` | Pronosticos de demanda |
| `sla.js` | Servicios SLA |
| `dashboard.js` | Dashboard unificado |
| `tms.js` | Transportation Management |
| `fms.js` | Fleet Management |
| `vertex.js` | Vertex AI y TTS |
| `procurement.js` | Gestion de compras |
| `tempData.js` | Datos temporales |
| `cachedApi.js` | API con cache |
| `requestCache.js` | Cache de requests |

### Stores (Zustand) - 8 totales

| Store | Estado |
|-------|--------|
| `authStore.js` | user, isAuthenticated, login/logout |
| `chatStore.js` | messages, isOpen, context |
| `realtimeStore.js` | eventos, conexion WebSocket |
| `dashboardStore.js` | metricas, filtros, KPIs |
| `tmsStore.js` | envios, transportistas |
| `fmsStore.js` | vehiculos, mantenimiento |
| `tourStore.js` | estado del tour guiado |
| `vertexStore.js` | chat Vertex AI, estado TTS |

## Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Usuarios, solicitudes, auth, mensajes | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |
| `data/catalogo_materiales.db` | Catalogo completo de materiales SAP | ~28,000 |

**Produccion:** PostgreSQL con 63 migraciones aplicadas (tablas renombradas a espanol).

**Reimportacion de datos SAP:**
```bash
python scripts/migrate_excel_to_db.py
```

## Tests - Cobertura

### Resumen

| Categoria | Archivos | Tests | Cobertura |
|-----------|----------|-------|-----------|
| Backend Unit | 55 | 1,000+ | Excelente (core, pipelines) |
| Backend Integration | 17 | 200+ | Buena (33+ rutas) |
| Backend E2E | 2 | 30+ | Buena (health, auth, flujos) |
| Frontend | 25 | 190+ | Mejorando (4 nuevos archivos Sprint 30) |

**Total: 1,330+ tests en 101 archivos**

### Estructura

```
tests/
├── conftest.py          # Fixtures globales
├── unit/                # ~55 archivos - Tests unitarios
├── integration/         # 17 archivos - Tests de integracion
└── e2e/                 # 2 archivos - Tests end-to-end
```

### CI/CD - Tests Excluidos (backend)

Los siguientes tests se excluyen del CI (fallan pre-existente):
- `test_budget_service.py`, `test_fsm.py`, `test_mrp_parametros.py`
- `test_planner_service.py`, `test_forecast_parallel.py`, `test_stl_decomposition.py`
- `test_cors.py`, `test_lstm_model.py` (requiere TensorFlow)
- `test_openapi.py`, `test_deepseek_client.py`, `test_approval_rules.py`, `test_dashboard_formulas.py`
- `test_cache_expiracion` (flaky)

**Frontend tests**: 17 archivos pre-existentes fallan en CI (`continue-on-error: true`), 8 archivos pasan

### Backend - Tests por Modulo

| Modulo | Tests | Estado |
|--------|-------|--------|
| `test_scoring.py` | 78 | Excelente |
| `test_demand_forecast.py` | 44 | Excelente |
| `test_budget_service.py` | 40 | Excelente |
| `test_clustering.py` | 37 | Excelente |
| `test_csrf.py` | 30 | Excelente |
| `test_websocket.py` | 30 | Excelente |
| `test_observability.py` | 31 | Excelente |
| `test_background_jobs.py` | 31 | Excelente |
| `test_cache_advanced.py` | 31 | Excelente |

### Frontend - Tests Existentes

```
frontend/src/
├── pages/__tests__/          # 15 archivos
│   ├── DashboardAdmin.test.jsx  # 49 tests (Sprint 30)
│   ├── Materials.test.jsx       # 52 tests
│   ├── MiCuenta.test.jsx        # 45 tests
│   ├── CreateSolicitud.test.jsx # 15 tests
│   └── Aprobaciones.test.jsx    # 12 tests
├── components/__tests__/     # 4 archivos
│   └── ProtectedRoute.test.jsx  # 8 tests
├── components/Planner/__tests__/
│   ├── Paso1AnalisisInicial.test.jsx
│   ├── Paso2DecisionAbastecimiento.test.jsx
│   ├── Paso3RevisionFinal.test.jsx
│   └── TratarSolicitudModal.test.jsx
├── hooks/__tests__/          # 4 archivos
│   ├── useDebounced.test.js     # 12 tests
│   ├── usePlanner.test.js       # 23 tests (Sprint 30)
│   ├── useMaterials.test.js     # 20 tests (Sprint 30)
│   └── useForecast.test.js      # 20 tests (Sprint 30)
└── utils/__tests__/
    └── formatters.test.js       # 22 tests
```

## Issues Conocidos

### Prioridad Media

| Issue | Ubicacion | Impacto |
|-------|-----------|---------|
| Imports try/except duplicados | Todos los routes (24 archivos) | DRY violation |
| Funciones helper duplicadas | `_get_user()` en 5+ routes | DRY violation |
| Bare except handlers | `routes/mi_cuenta.py`, `routes/admin.py` | Puede ocultar errores |

### Prioridad Baja

| Issue | Ubicacion | Impacto |
|-------|-----------|---------|
| TODO/FIXME pendientes | 6 archivos backend | Deuda tecnica |
| Frontend tests pre-existentes fallando | 17 archivos en CI | Cobertura |

### Bugs Conocidos (no bloqueantes)

| ID | Descripcion | Severidad |
|----|-------------|-----------|
| BUR-001 | Reversion BUR falla (constraint tipo_movimiento) | Media |
| USER-001 | notification-preferences SQL syntax error | Media |
| USER-002 | admin/profile-requests columna faltante | Media |
| ADMIN-001 | presupuestos/historial error 500 | Baja |
| COMM-001 | notificaciones/test error 500 | Baja |

## Security Review

### Resumen (actualizado 2026-02-06)

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| **CRITICAL** | 3 | **TODOS RESUELTOS/MITIGADOS** |
| **HIGH** | 7 | 6 Resueltos, 1 Pendiente |
| **MEDIUM** | 10 | Mayoria resueltos |

### Hardening de Produccion (2026-02-06)

| Endpoint | Proteccion |
|----------|------------|
| `/api/health` | Sin auth, solo devuelve `{ok, status, version}` |
| `/api/health/routes` | Requiere admin |
| `/api/health/dependencies` | Requiere admin |
| `/api/catalogos/*` | Requiere auth (`@require_auth`) |
| `/api/docs/*` | Requiere auth en produccion (libre en dev) |
| `robots.txt` | `Disallow: /` |

### Buenas Practicas Implementadas

- Password hashing con bcrypt
- Rate limiting en login (10 intentos/5min)
- Rate limiting en admin endpoints (30 req/min)
- Security headers configurados
- SQL parametrizado (mayoria de queries, whitelist para tablas)
- JWT con expiracion (1h access, 7d refresh)
- httpOnly cookies para tokens en produccion
- Validacion de ownership en endpoints criticos
- Matriz de aprobacion con permisos por monto
- Endpoints sensibles protegidos con auth/admin
- CI/CD bloqueante (backend tests/lint, frontend build/lint), rollback habilitado
- Sentry error tracking en produccion (backend via `SENTRY_DSN`, frontend via `@sentry/react`)

## Convenciones de Codigo

### Python (backend)
- snake_case para variables/funciones
- Validacion con Pydantic en `core/schemas.py`
- Blueprints por dominio en `routes/` (archivos grandes divididos en packages)
- Linting: Ruff (config en `pyproject.toml`, ignores E402/E721)

### JavaScript/React (frontend)
- camelCase para variables, PascalCase para componentes
- Componentes UI en `components/ui/`
- Usar sistema i18n para TODOS los textos visibles
- Linting: ESLint (config en `frontend/.eslintrc.cjs`)
- Sub-componentes grandes extraidos con React.memo()

### Sistema i18n
- Ubicacion: `frontend/src/context/i18n.jsx`
- API: `const { t } = useI18n(); t('clave', 'fallback')`
- Prefijos: `nav_`, `dash_`, `common_`, `materials_`, `admin_`, `planner_`, `matching_`, `spend_`, `risk_`, `demand_`, `returns_`, `warehouse_`, `compliance_`, `rebate_`, `inv_opt_`, `cert_`, `supplier_audit_`, `freight_`

### Sistema de Estilos
- **Tema:** Solo light mode (dark mode eliminado)
- **CSS Variables:** `frontend/src/index.css`
- **Tailwind:** `frontend/tailwind.config.js`
- **Estados:** `frontend/src/utils/styleConfig.js`

## Flujo de Solicitudes

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
| **Aprobador de Presupuesto** | Aprobar BURs (nota: rol con espacio) |

## Reglas de Negocio

- Solicitudes requieren minimo 1 item con cantidad > 0
- Presupuesto validado por centro/sector antes de aprobar
- Materiales identificados por codigo SAP unico
- JWT: access token 1h + refresh token 7d
- Dashboard unificado para todos los roles (sin segregacion)

## Archivos Clave

### Backend Entry Points
| Archivo | Proposito |
|---------|-----------|
| `wsgi.py` | Entry point servidor |
| `backend/app.py` | Factory Flask (auto-crea tablas Vertex, Sentry, Redis cache) |
| `backend/core/config.py` | Configuracion |

### Core Modules
| Archivo | Proposito |
|---------|-----------|
| `core/db.py` | Conexion BD |
| `core/repository_legacy.py` | Data access legacy |
| `core/repository/` | Data access modular (11 clases) |
| `core/fsm.py` | Maquina de estados |
| `core/auth_middleware.py` | JWT middleware |
| `core/rate_limit.py` | Rate limiting |
| `core/request_validation.py` | Sanitizacion |
| `core/helpers.py` | Funciones helper consolidadas |

### Services
| Archivo | Proposito |
|---------|-----------|
| `services/ai_service.py` | IA/ML unificado |
| `services/mrp_service.py` | Motor MRP |
| `services/sla_service.py` | Tiempos limite |
| `services/reporting_service.py` | Exportacion |
| `services/dashboard_service.py` | Dashboard unificado |
| `services/tms_service.py` | Transporte |
| `services/fms_service.py` | Flota |
| `services/tts_service.py` | Text-to-Speech |

### Frontend Core
| Archivo | Proposito |
|---------|-----------|
| `context/i18n.jsx` | Traducciones |
| `index.css` | Variables CSS |
| `components/Sidebar.jsx` | Navegacion |
| `services/api.js` | Axios config |

## Modulos Principales

### MRP (Material Requirements Planning)
- **Backend:** `routes/mrp.py`, `routes/mrp_portfolio.py`, `services/mrp_service.py`
- **Frontend:** `MRPTableroAlertas.jsx`, `MRPKPIs.jsx`, `MRPPortfolio.jsx`
- **Endpoints:** `/api/mrp/alertas`, `/api/mrp/kpis`, `/api/mrp/portfolio`

### TMS (Transportation Management System)
- **Backend:** `routes/tms.py`, `services/tms_service.py`, `core/tms_schemas.py`
- **Frontend:** 5 paginas TMS, `hooks/useShipments.js`, `store/tmsStore.js`
- **Migracion:** `027_tms_tables.py`

### FMS (Fleet Management System)
- **Backend:** `routes/fms.py`, `services/fms_service.py`
- **Frontend:** 5 paginas FMS, `hooks/useFleet.js`, `store/fmsStore.js`
- **Migracion:** `028_fms_tables.py`

### Dashboard Unificado
- **Backend:** `routes/dashboards.py`, `services/dashboard_service.py`, `services/dashboard_formulas.py`
- **Frontend:** `Dashboard.jsx` (redirige a DashboardAdmin), `DashboardAdmin.jsx` (719 ln, orquestador)
- **Sub-componentes:** `pages/DashboardAdmin/` (KPIRow1-3, FiltersBar, SolicitudesSection, ExpandCardButton, ExpandedCardDialog)
- **Store:** `dashboardStore.js`
- **Migracion:** `026_dashboard_tables.py`

### Stock
- **Backend:** `routes/stock.py`
- **Frontend:** `Stock.jsx`, `StockIndividual.jsx`

### Vertex AI / TTS
- **Backend:** `routes/vertex_ia.py`, `services/tts_service.py`, `agent/rag/`
- **Frontend:** `services/vertex.js`, `store/vertexStore.js`
- **Features:** Chat con RAG, TTS (voz Tomas por defecto), anti-alucinacion, cache de queries
- **Voces TTS:** tomas/elena (Argentina), jorge/dalia (Mexico)
- **Migracion:** `022_vertex_ia_tables.py` (auto-ejecuta en startup)

### Planificador (Wizard 4 Pasos)
1. Paso1AnalisisInicial - Analisis stock
2. Paso2DecisionAbastecimiento - Fuente (stock/compra)
3. Paso3RevisionFinal - Confirmacion
4. Paso4AccionesPendientes - Registro

### Push Notifications & PWA
- **Backend:** `routes/push.py`, `services/push_service.py`, `core/push_config.py`
- **Frontend:** `hooks/usePushNotifications.js`, `public/push-sw.js` (push handlers)
- **PWA:** Workbox via `vite-plugin-pwa`, runtime caching (catalogos, materiales, dashboards)
- **Offline:** `OfflineBanner.jsx` muestra banner cuando no hay conexion
- **Config:** `vite.config.js` (VitePWA plugin), `manifest.json` existente

### Asistente IA
- **Backend:** `routes/assistant.py`, `routes/ai/` (package), `services/ai_service.py`
- **Frontend:** `AssistantModal.jsx`, `ChatAssistant.jsx`

### WebSockets
- **Backend:** `core/websocket.py`, `core/redis_pubsub.py`
- **Features:** Event Bus, Rooms, Broadcast, Direct messages

### Observability
- **Backend:** `core/observability.py`, `routes/metrics.py` (Prometheus endpoint)
- **Features:** Structured logging (JSON), Request tracing (Spans), Sentry (prod)
- **Sentry:** Backend (`SENTRY_DSN` env var), Frontend (`@sentry/react`)

### Forecast (Pronosticos de Demanda)
- **Backend:** `agent/pipelines/forecast/`, `routes/ai/forecast.py`
- **Frontend:** `ForecastIndividual.jsx`, `ForecastMasivo.jsx`, `components/forecast/`
- **Modelos:** ARIMA, Prophet, XGBoost, Sklearn, STL, Ensemble
- **Ensemble (Sprint 38):** `forecast/ensemble.py` - Combina N modelos con weighted averaging (1/MAPE)
- **Frontend Ensemble:** `components/forecast/EnsembleChart.jsx` - Gráfico multi-modelo con tabla de pesos
- **Endpoint:** `GET /api/ai/forecast/ensemble/<material>` - Predicción combinada
- **Features:** Backtesting, tuning automatico, comparacion de modelos
- **Data:** Queries a `sap_data.db` (consumo_historico + materiales_bbdd)

### Dashboard Data (Sprints 35-36)
- **Backend:** `routes/dashboards_data.py` (blueprint `dashboards_data`)
- **Endpoints:** `/api/dashboard-data/solicitudes` (paginado), `/api/dashboard-data/resumen`, `/api/dashboard-data/drill/<metrica>`
- **Drill-Down Métricas:** solicitudes_diarias, solicitudes_por_estado, presupuesto_por_centro, materiales_top, tiempos_promedio, stock_critico, compras_evitadas
- **Frontend:** `components/Dashboard/DrillDownModal.jsx` - Modal genérico con AG-Grid
- **Features:** Paginación server-side, filtros por centro/sector/periodo, export XLSX

### Reportes Programados (Sprint 37)
- **Backend:** `routes/export.py` (CRUD), `services/report_generator.py`, migración 036
- **Frontend:** `pages/ReportesProgramados.jsx` - CRUD con ejecución manual
- **Tipos:** solicitudes, stock, presupuesto, kpis, materiales
- **Frecuencias:** manual, diario, semanal, mensual
- **Formatos:** xlsx, csv, pdf

### Proveedor Scorecard (Sprint 39)
- **Backend:** `routes/procurement.py` (endpoints scorecard/ranking, evaluar, historial), migración 037
- **Frontend:** `pages/ProveedorScorecard.jsx` - Radar chart + ranking AG-Grid + tendencias
- **Tablas:** `proveedor_evaluacion`, `proveedor_meta`
- **Features:** Evaluación manual, ranking persistente, historial por periodo

### Auto-Aprobación (Sprint 40)
- **Backend:** `routes/admin.py` (CRUD reglas), `services/auto_approval_service.py`, migración 038
- **Frontend:** `pages/AdminAutoAprobacion.jsx` - Gestión de reglas con simulación
- **Tabla:** `regla_auto_aprobacion`
- **Condiciones:** monto_max, materiales_conocidos_only, historial_solicitante_min, criticidad_max
- **FSM Integración:** `solicitudes/helpers.py::_check_auto_approval()` evalúa reglas antes de lógica legacy

### 3-Way Invoice Matching (Sprint 61)
- **Backend:** `routes/matching.py` (7 endpoints), `services/matching_service.py`, migracion 054
- **Frontend:** `InvoiceList.jsx`, `InvoiceDetail.jsx`, `MatchComparisonTable.jsx`
- **Tablas:** `factura_proveedor`, `factura_item`, `matching_resultado`
- **Features:** Registro facturas, matching automatico PO vs Receipt vs Invoice, resolucion discrepancias, KPIs

### Spend Analytics & Kraljic (Sprint 62)
- **Backend:** `routes/spend.py` (6 endpoints), `services/spend_service.py`, migracion 055
- **Frontend:** `SpendAnalytics.jsx`, `KraljicMatrix.jsx`
- **Tablas:** `spend_categoria`, `spend_snapshot`
- **Features:** Gasto por categoria, maverick spend, matriz Kraljic 2x2, tendencia mensual, TCO
- **Celery:** `snapshot_spend_monthly` (1ro mes, 4AM)

### Supplier Risk Assessment (Sprint 63)
- **Backend:** `routes/supplier_risk.py` (7 endpoints), `services/supplier_risk_service.py`, migracion 056
- **Frontend:** `SupplierRiskMap.jsx`, `RiskScoreBreakdown.jsx`
- **Tablas:** `proveedor_riesgo`, `proveedor_riesgo_historial`
- **Features:** Risk scoring compuesto (entrega, calidad, dependencia, financiero, geografico), fuentes unicas, alertas
- **Celery:** `recalculate_supplier_risk` (lunes, 5AM)

### Demand Planning S&OP (Sprint 64)
- **Backend:** `routes/demand_planning.py` (8 endpoints), `services/demand_planning_service.py`, migracion 057
- **Frontend:** `DemandPlanning.jsx`, `DemandPlanDetail.jsx`, `ForecastComparisonChart.jsx`
- **Tablas:** `plan_demanda`, `plan_demanda_entrada`, `plan_demanda_consenso`
- **Features:** Ciclos S&OP con FSM (draft→collecting→review→consensus→approved→closed), baseline ML, consenso ponderado

### Returns & RMA (Sprint 65)
- **Backend:** `routes/returns.py` (7 endpoints), `services/returns_service.py`, migracion 058
- **Frontend:** `ReturnsList.jsx`, `ReturnDetail.jsx`
- **Tablas:** `devolucion`, `devolucion_item`, `devolucion_historial`
- **Features:** RMA con FSM, creacion desde NCR, tracking creditos, tasa recuperacion

### Warehouse Receiving & Putaway (Sprint 66)
- **Backend:** `routes/warehouse.py` (8 endpoints), `services/warehouse_service.py`, migracion 059
- **Frontend:** `WarehouseReceiving.jsx`, `PutawayTasks.jsx`, `DockBoard.jsx`
- **Tablas:** `dock_recepcion`, `recepcion_dock`, `putaway_tarea`
- **Features:** Grid visual docks, asignacion recepciones, tiempos descarga, auto-generacion tareas putaway

### Contract Compliance & Rebates (Sprint 67)
- **Backend:** `routes/compliance.py` (8 endpoints), `services/compliance_service.py`, migracion 060
- **Frontend:** `ContractCompliance.jsx`, `RebatePrograms.jsx`
- **Tablas:** `compliance_check`, `rebate_programa`, `rebate_calculo`
- **Features:** Verificacion compliance OC vs contrato, programas rebate (volume/growth/flat), workflow claims

### Inventory Optimization (Sprint 68)
- **Backend:** `routes/inventory_opt.py` (9 endpoints), `services/inventory_optimization_service.py`, migracion 061
- **Frontend:** `InventoryOptimization.jsx`, `ServiceLevels.jsx`, `ImbalanceHeatmap.jsx`
- **Tablas:** `transferencia_inventario`, `nivel_servicio_objetivo`
- **Features:** Deteccion desbalances, propuestas transferencias, calculo stock seguridad (Z*sigma*sqrt(L)), niveles servicio editables

### Supplier Audit & Certifications (Sprint 69)
- **Backend:** `routes/supplier_audit.py` (10 endpoints), `services/supplier_audit_service.py`, migracion 062
- **Frontend:** `SupplierCertifications.jsx`, `SupplierAudits.jsx`, `CertExpiryBadge.jsx`
- **Tablas:** `proveedor_certificacion`, `auditoria_proveedor`, `auditoria_hallazgo`
- **Features:** Tracking certificaciones ISO, auditorias on-site/remote, hallazgos con severidad, alertas vencimiento
- **Celery:** `check_certification_expiry` (diario, 7AM)

### Freight Audit & Payment (Sprint 70)
- **Backend:** `routes/freight.py` (10 endpoints), `services/freight_audit_service.py`, migracion 063
- **Frontend:** `FreightAudit.jsx`, `FreightTariffs.jsx`
- **Tablas:** `factura_flete`, `freight_tarifa`, `freight_audit_detalle`
- **Features:** Auto-audit facturas flete vs tarifas contratadas, aprobacion/disputa, ranking transportistas

### SLA Dashboard
- **Backend:** `routes/sla.py`, `services/sla_service.py`
- **Frontend:** `SLADashboard.jsx`
- **Features:** Tiempos limite, alertas, metricas de cumplimiento

### Sistema de Presupuestos
- **Backend:** `routes/budget.py`, `services/budget_service.py`, `core/budget_schemas.py`
- **Frontend:** `BudgetRequests.jsx`, `BudgetRequestDetail.jsx`, `BudgetRequestCreate.jsx`
- **Endpoints:** `/api/budget-requests`, `/api/budget/ledger`, `/api/budget/info`
- **Niveles de Aprobacion:**
  - L1: hasta $200,000 USD
  - L2: hasta $1,000,000 USD
  - ADMIN: mas de $1,000,000 USD

## Migraciones de BD (63 totales)

| Migracion | Proposito |
|-----------|-----------|
| `003` - `013` | Core: budget, config, planner, fsm, approval, sla, mrp, notifications, indexes, stock, profiles |
| `020` | Catalogos y datos SAP a PostgreSQL (vistas de compatibilidad) |
| `021` | Renombrar centros |
| `022` | Tablas Vertex IA (auto-ejecuta en startup) |
| `023` | Historial de presupuestos |
| `024` | Tablas SLA |
| `025` | Renombrar 21 tablas a espanol |
| `026` | Tablas Dashboard |
| `027` | Tablas TMS |
| `028` | Tablas FMS |
| `029` | Indices de rendimiento adicionales |
| `033` | Importar datos SAP SQLite→PG (script manual, ejecutar 1 vez) |
| `034` | Tablas Ordenes de Compra (5 tablas) |
| `035` | Tabla reporte_historial (reportes programados) |
| `036` | Tabla reporte_programado (CRUD reportes programados) |
| `037` | Tablas proveedor_evaluacion, proveedor_meta (scorecard persistente) |
| `038` | Tabla regla_auto_aprobacion (auto-aprobacion por reglas) |
| `039` - `043` | Escalacion, email destinatarios, webhooks, favoritos (Sprints 41-50) |
| `044` - `053` | Audit log, savings, SLOB, contratos, RFQ, calidad, CAPA (Sprints 51-60) |
| `054` | Tablas factura_proveedor, factura_item, matching_resultado (3-Way Matching) |
| `055` | Tablas spend_categoria, spend_snapshot (Spend Analytics) |
| `056` | Tablas proveedor_riesgo, proveedor_riesgo_historial (Supplier Risk) |
| `057` | Tablas plan_demanda, plan_demanda_entrada, plan_demanda_consenso (S&OP) |
| `058` | Tablas devolucion, devolucion_item, devolucion_historial (Returns/RMA) |
| `059` | Tablas dock_recepcion, recepcion_dock, putaway_tarea (Warehouse) |
| `060` | Tablas compliance_check, rebate_programa, rebate_calculo (Compliance) |
| `061` | Tablas transferencia_inventario, nivel_servicio_objetivo (Inventory Opt) |
| `062` | Tablas proveedor_certificacion, auditoria_proveedor, auditoria_hallazgo (Supplier Audit) |
| `063` | Tablas factura_flete, freight_tarifa, freight_audit_detalle (Freight Audit) |

## CI/CD

### GitHub Actions

**CI Pipeline** (`.github/workflows/ci.yml`):
- Backend tests (con exclusiones de tests pre-existentes)
- Backend lint (Ruff, 0 errores)
- Frontend build (Vite + PWA)
- Frontend lint (ESLint, `.eslintrc.cjs`, max 100 warnings)
- Frontend tests (non-blocking por 17 archivos pre-existentes que fallan)
- Security audit (pip-audit + npm audit, non-blocking)

**Deploy to Production** (`.github/workflows/deploy-production.yml`):
- Deploy via rsync al VPS
- Backup pre-deploy (pg_dump)
- Build frontend con `VITE_API_URL`
- Rollback automatico en caso de fallo
- Health check con retry
- Inicializacion automatica de tablas Vertex

## Historial de Sprints

| Sprint | Feature | Fecha |
|--------|---------|-------|
| 1-16 | Core SPM (FSM, Auth, MRP, AI, etc.) | Dic 2025 |
| 17 | Auditoria Logica de Negocio | 2025-12-23 |
| 18-19 | Reorganizacion de Arquitectura | 2025-12-23/29 |
| 20 | Sistema de Presupuestos | 2026-01-03 |
| 21 | Fixes de Autenticacion | 2026-01-09 |
| 22 | Sistema de Agentes + RAG | 2026-01-10 |
| 23-24 | Limpieza y Refactoring | 2026-01-19 |
| 25 | Deploy Produccion + TMS/FMS/Dashboards | 2026-02-01 |
| 26 | Hardening seguridad + Vertex IA prod | 2026-02-06 |
| 27 | Backend quick wins: SSE non-blocking, Redis L2 cache, SELECT * fix, Sentry | 2026-02-14 |
| 28 | Frontend: useToast, alert() eliminados, ARIA labels en 4 paginas | 2026-02-14 |
| 29 | Notificaciones WebSocket-first (fallback SSE/polling) | 2026-02-14 |
| 30 | Tests frontend: DashboardAdmin (49), hooks (63 tests) | 2026-02-14 |
| 31 | Split backend: ai.py, planner.py, solicitudes.py -> packages | 2026-02-14 |
| 32 | Split frontend: DashboardAdmin (7 sub-comp), useMaterials (3 hooks) | 2026-02-14 |
| 33 | PWA Offline: Workbox, OfflineBanner, push-sw.js | 2026-02-14 |
| 34 | Monitoring: Sentry backend/frontend, Prometheus metrics | 2026-02-14 |
| 35 | Paginacion server-side, dashboard data endpoints | 2026-02-14 |
| 36 | Drill-down analytics, KPIs clickeables con modal | 2026-02-14 |
| 37 | Reportes programados: CRUD, generador, Celery task | 2026-02-14 |
| 38 | ML Ensemble Forecast (weighted averaging, parallel) | 2026-02-14 |
| 39 | Proveedor Scorecard persistente, evaluaciones históricas | 2026-02-14 |
| 40 | Auto-aprobación por reglas configurables, simulación | 2026-02-14 |
| 41-50 | Deuda tecnica, escalacion, email reportes, ABC, webhooks, what-if, QR, favoritos, dashboard personalizable | 2026-02-15 |
| 51-60 | Audit Log UI, Cost Savings, SLOB, Contratos, RFQ, Quality/NCR, CAPA | 2026-02-15 |
| 61 | 3-Way Invoice Matching (PO vs Receipt vs Invoice) | 2026-02-15 |
| 62 | Spend Analytics & Kraljic Matrix | 2026-02-15 |
| 63 | Supplier Risk Assessment (5 dimensiones) | 2026-02-15 |
| 64 | Demand Planning colaborativo (S&OP) | 2026-02-15 |
| 65 | Returns & Reverse Logistics (RMA) | 2026-02-15 |
| 66 | Warehouse Receiving & Putaway | 2026-02-15 |
| 67 | Contract Compliance & Rebates | 2026-02-15 |
| 68 | Inventory Optimization multi-ubicacion | 2026-02-15 |
| 69 | Supplier Audit & Certification Tracking | 2026-02-15 |
| 70 | Freight Audit & Payment | 2026-02-15 |

---

## Documentacion

- `docs/ARQUITECTURA_SPM_2_0.md` - Arquitectura completa del sistema
- `docs/DEPLOYMENT.md` - Guia de despliegue a produccion
- `docs/GUIA_RAPIDA_USAR_SERVICIOS.md` - Uso de servicios backend
- `docs/PLAN_ESCALADO_SPM.md` - Plan de escalado futuro
- `docs/AUDIT.md` - Auditoria de seguridad y calidad
- `docs/guides/CODE_REVIEW_GUIDE.md` - Guia de code review
- `docs/guides/QUICK_REFERENCE_BD.md` - Referencia rapida de BD

## Instrucciones para Claude

1. Explicar el plan antes de modificar codigo
2. Cambios pequenos y controlados
3. Usar siempre el sistema i18n para textos de UI
4. Mantener consistencia con CSS variables + Tailwind
5. No hardcodear textos en espanol/ingles
6. No modificar estructura de BD sin crear migracion
7. Verificar que el build compile sin errores
8. **Priorizar tests para frontend** (cobertura critica baja)
9. Usar `repository_legacy.py` o `repository/` modular para entidades de datos

### Seguridad (Obligatorio)

- **Siempre validar ownership** antes de acceder/modificar datos de usuario
- **Usar SQL parametrizado** - nunca f-strings para queries
- **Validar inputs** con `@validate_json()` o schemas Pydantic
- **No exponer errores internos** - usar mensajes genericos al cliente
- **Agregar rate limiting** a endpoints sensibles
- **Revisar permisos por rol** antes de operaciones criticas
- **Proteger endpoints nuevos** con `@require_auth` o `@require_admin`

### Usuarios de Prueba

```
Usuario: 1 (Manu)
Password: password123
Rol: Admin, Aprobador_presupuestos, Aprobador_solicitudes, Planificador
```
