# CLAUDE.md

Guia para Claude Code (claude.ai/code) cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2026-02-14 (Sprints 27-34: refactoring estructural, PWA, Sentry, CI strict)

## Resumen del Proyecto

| Metrica | Valor |
|---------|-------|
| **Backend** | 210+ archivos Python, ~65,000 lineas (post-split) |
| **Frontend** | 98 paginas, 126 componentes, 22 hooks |
| **Endpoints API** | 250+ endpoints en 36 modulos (3 packages) |
| **Tests** | 1,330+ tests (101 archivos) |
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
├── backend/                    # API Flask (210+ archivos, ~65K lineas)
│   ├── routes/                 # 36 modulos (3 packages: ai/, planner/, solicitudes/)
│   ├── services/               # 18 servicios de negocio
│   ├── core/                   # 39 modulos de infraestructura
│   ├── agent/                  # 46 archivos ML/IA (forecast/, rag/, proactive/)
│   └── migrations/             # 35 migraciones de BD
├── frontend/src/
│   ├── pages/                  # 98 paginas + DashboardAdmin/ sub-componentes
│   ├── components/             # 126 componentes (incl. OfflineBanner)
│   ├── hooks/                  # 22 custom hooks (incl. useMaterial*, useToast)
│   ├── services/               # 18 servicios API
│   ├── store/                  # 8 stores Zustand
│   └── context/                # i18n provider (200+ keys)
├── data/                       # Bases de datos SQLite
├── tests/                      # 101 archivos de test
├── scripts/                    # Scripts de utilidad
└── docs/                       # Documentacion
```

## Backend - Inventario Completo

### Routes (36 modulos, 250+ endpoints)

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
| `materiales_detalle.py` | 0 | Helpers de detalle materiales |

### Services (19 servicios)

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
| **Blueprints** | `blueprints.py` (registro centralizado de 33 blueprints) |
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

### Pages (98 paginas totales)

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
| **Admin** | AdminUsuarios, AdminRoles, AdminCentros, AdminSectores, AdminMateriales, AdminProveedores, AdminPresupuestos, AdminEstado, AdminPlanificadores, AdminPuestos, AdminAlmacenes, AdminSolicitudesPerfil |

### Components (126 totales)

| Carpeta | Componentes | Proposito |
|---------|-------------|-----------|
| `ui/` | 49 | Primitivos (Button, Input, Card, Modal, Badge, OfflineBanner, etc.) |
| `features/DataTable/` | 1 | ModernDataTable con TanStack Table |
| `materials/` | 3 | MaterialDetailModal, MaterialsTable, SearchDropdown |
| `Planner/` | 7 | Wizard de 4 pasos + StockDetalleModal |
| `forecast/` | 10 | BacktestResults, ForecastChart, ForecastKPIs, etc. |
| `Dashboard/` | 6 | Componentes de dashboard unificado |
| `Canvas/Charts` | 6 | Visualizaciones y graficos |
| `Tour/` | 3 | Guia interactiva de usuario |
| `Analytics/` | 2 | Componentes de analisis |
| `Admin/` | 3 | Templates CRUD admin |
| `export/` | 1 | ExportButton |
| `DashboardAdmin/` | 7 | KPIRow1-3, FiltersBar, SolicitudesSection, ExpandCardButton, ExpandedCardDialog |
| **Core** | 11 | Layout, Sidebar, ErrorBoundary, ProtectedRoute, Loading, AdminCrudTemplate, AssistantModal, ChatAssistant, MensajeThreadModal, HeaderNav |

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

**Produccion:** PostgreSQL con 35 migraciones aplicadas (tablas renombradas a espanol).

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
- Prefijos: `nav_`, `dash_`, `common_`, `materials_`, `admin_`, `planner_`

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
- **Modelos:** ARIMA, Prophet, XGBoost, Sklearn, STL
- **Features:** Backtesting, tuning automatico, comparacion de modelos
- **Data:** Queries a `sap_data.db` (consumo_historico + materiales_bbdd)

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

## Migraciones de BD (35 totales)

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
