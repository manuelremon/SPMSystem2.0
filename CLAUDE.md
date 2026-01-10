# CLAUDE.md

Guia para Claude Code (claude.ai/code) cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2026-01-10 (Sprint 22 - Agentes y PostgreSQL)

## Resumen del Proyecto

| Metrica | Valor |
|---------|-------|
| **Backend** | 131 archivos Python, ~55,000 lineas |
| **Frontend** | 68 paginas, 87 componentes, 8 hooks |
| **Endpoints API** | 200+ endpoints en 24 modulos |
| **Tests** | 1,045+ tests (153 archivos) |
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
```

## Arquitectura

```
Frontend (React + Vite)     Backend (Flask)           Base de Datos
http://localhost:5173       http://localhost:5000     SQLite (data/)
        |                           |                      |
        +--- API REST (/api/*) -----+----------------------+
```

### Estructura Principal

```
SPMv2.0/
├── backend/                    # API Flask (131 archivos, ~55K lineas)
│   ├── routes/                 # 24 modulos, 200+ endpoints
│   ├── services/               # 11 servicios de negocio
│   ├── core/                   # 28 modulos de infraestructura
│   ├── agent/                  # 30 archivos ML/IA (incluye forecast/)
│   └── migrations/             # 13 migraciones de BD
├── frontend/src/
│   ├── pages/                  # 68 paginas (incluye admin)
│   ├── components/             # 87 componentes
│   ├── hooks/                  # 8 custom hooks
│   ├── services/               # 11 servicios API
│   ├── store/                  # 3 stores Zustand
│   └── context/                # i18n provider (200+ keys)
├── data/                       # Bases de datos SQLite
├── tests/                      # 153 archivos de test
├── scripts/                    # Scripts de utilidad
└── docs/                       # Documentacion
```

## Backend - Inventario Completo

### Routes (24 modulos, 194 endpoints)

| Modulo | Endpoints | Proposito |
|--------|-----------|-----------|
| `admin.py` | 31 | CRUD usuarios, roles, materiales, proveedores |
| `planner.py` | 21 | Planificacion de solicitudes, decisiones |
| `mi_cuenta.py` | 14 | Perfil, password, preferencias |
| `ai.py` | 14 | Recomendaciones IA, analisis, forecast |
| `solicitudes.py` | 11 | CRUD solicitudes, estados, archivos |
| `metrics.py` | 11 | Metricas de rendimiento |
| `budget.py` | 8 | Presupuestos, ledger, BUR |
| `mensajes.py` | 8 | Sistema de mensajeria |
| `mrp.py` | 8 | Alertas MRP, KPIs, catalogo |
| `auth.py` | 7 | Login, refresh, logout, registro |
| `sla.py` | 7 | Metricas SLA, alertas |
| `docs.py` | 6 | Swagger UI, OpenAPI |
| `export.py` | 6 | Exportar solicitudes, inventario |
| `notificaciones.py` | 6 | CRUD notificaciones |
| `push.py` | 6 | Push notifications |
| `health.py` | 6 | Health checks, probes, diagnostics |
| `catalogos.py` | 5 | Centros, sectores, puestos |
| `equivalencias.py` | 5 | Equivalencias de materiales |
| `foro.py` | 5 | Posts, replies, likes |
| `materiales.py` | 3 | Busqueda, detalle, stats |
| `trivias.py` | 3 | Rankings, scores |
| `assistant.py` | 2 | Sugerencias IA |
| `kpis.py` | 1 | Dashboard KPIs |
| `materiales_detalle.py` | 0 | Helpers de detalle materiales |

### Services (11 servicios)

| Servicio | Lineas | Proposito |
|----------|--------|-----------|
| `ai_service.py` | 600+ | Orchestrador ML (clustering, scoring, forecast) |
| `mrp_service.py` | 700+ | Motor MRP (EOQ, ROP, alertas) |
| `reporting_service.py` | 650+ | Exportacion Excel/CSV/PDF |
| `sla_service.py` | 600+ | Tiempos limite, alertas SLA |
| `approval_service.py` | 500+ | Matriz de aprobacion, delegacion |
| `audit_service.py` | 450+ | Trail de auditoria |
| `budget_service.py` | 550+ | Presupuestos, BUR |
| `push_service.py` | 350+ | Web Push notifications |
| `notification_service.py` | 300+ | Notificaciones in-app |
| `message_service.py` | 350+ | Sistema de mensajes |
| `planner_service.py` | 400+ | Logica de planificacion |

### Core (28 modulos)

| Categoria | Modulos |
|-----------|---------|
| **Auth** | `auth_middleware.py`, `roles.py`, `user_helpers.py` |
| **Database** | `db.py`, `db_optimization.py`, `repository_legacy.py` (refactorizado), `repository/` (modular) |
| **Schemas** | `schemas.py`, `budget_schemas.py`, `notification_schemas.py`, `item_schemas.py` |
| **Validation** | `request_validation.py` (sanitizacion XSS/SQL) |
| **Security** | `csrf.py`, `security_headers.py`, `rate_limit.py` |
| **Cache** | `cache.py`, `cache_advanced.py`, `cache_loader.py` |
| **State** | `fsm.py` (maquina de estados solicitudes) |
| **Errors** | `errors.py` (excepciones custom) |
| **Monitoring** | `metrics.py`, `observability.py` |
| **Jobs** | `background_jobs.py` (cola async) |
| **WebSocket** | `websocket.py` (tiempo real) |
| **Config** | `config.py`, `push_config.py` |
| **API Docs** | `openapi.py` |
| **Budget** | `budget_transaction.py` |
| **Services** | `services/planner_service.py` (nuevo) |

### Agent/ML (30 archivos)

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
│   ├── forecast.py        # Orchestrador de pronosticos
│   └── forecast/          # Modelos avanzados de pronostico
│       ├── arima_model.py     # Modelo ARIMA
│       ├── prophet_model.py   # Modelo Prophet
│       ├── xgboost_model.py   # Modelo XGBoost
│       ├── sklearn_models.py  # Modelos Sklearn
│       ├── backtesting.py     # Validacion temporal
│       ├── tuning.py          # Optimizacion hiperparametros
│       ├── model_registry.py  # Registro de modelos
│       ├── predictor.py       # Motor de prediccion
│       └── base.py            # Clase base modelos
└── tools/
    ├── base.py            # Abstraccion de herramientas
    ├── data_loader.py     # Carga de datos historicos
    ├── evaluator.py       # Evaluacion de modelos
    ├── material_matcher.py # Matching de materiales
    ├── ml_trainer.py      # Entrenamiento ML
    ├── nlp_processor.py   # Procesamiento NLP
    └── predictor.py       # Predicciones
```

## Frontend - Inventario Completo

### Pages (68 paginas totales)

| Categoria | Paginas |
|-----------|---------|
| **Auth** | Login, CompleteRegistration |
| **Solicitudes** | CreateSolicitud, Materials, MisSolicitudes, SolicitudDetalle, TodasLasSolicitudes |
| **Aprobacion** | Aprobaciones, HistorialAprobaciones |
| **Planificacion** | Planner (con wizard 4 pasos) |
| **MRP** | MRPTableroAlertas, MRPKPIs |
| **Budget** | BudgetRequests, BudgetRequestCreate, BudgetRequestDetail |
| **Catalogos** | CatalogoMateriales, CatalogoEquivalencias |
| **Comunicacion** | Mensajes, Notificaciones, Foro, Ayuda, CentroInteraccion |
| **Usuario** | MiCuenta, Dashboard, DashboardShared |
| **Dashboards por Rol** | DashboardAdmin, DashboardAprobador, DashboardSolicitante, DashboardPlanificador |
| **Forecast** | ForecastIndividual, ForecastMasivo |
| **SLA** | SLADashboard |
| **IA/Analisis** | AIAnalytics, KPI |
| **Gamificacion** | Trivias |
| **Admin** | AdminUsuarios, AdminRoles, AdminCentros, AdminSectores, AdminMateriales, AdminProveedores, AdminPresupuestos, AdminEstado, AdminPlanificadores, AdminPuestos, AdminAlmacenes, AdminSolicitudesPerfil |

### Components (87 totales)

| Carpeta | Componentes | Proposito |
|---------|-------------|-----------|
| `ui/` | 33 | Primitivos (Button, Input, Card, Modal, Badge, PushNotificationToggle, etc.) |
| `features/DataTable/` | 1 | ModernDataTable con TanStack Table |
| `materials/` | 3 | MaterialDetailModal, MaterialsTable, SearchDropdown |
| `Planner/` | 6 | Wizard de 4 pasos + StockDetalleModal |
| `forecast/` | 9 | BacktestResults, ForecastChart, ForecastKPIs, LazyPlot, MaterialSearchInput, ModelComparison, ModelSelector, PatternCharts, PredictionsTable |
| `export/` | 1 | ExportButton |
| **Core** | 9 | Layout, Sidebar, ErrorBoundary, ProtectedRoute, Loading, AdminCrudTemplate, AssistantModal, ChatAssistant, MensajeThreadModal |

### Hooks (8 totales)

| Hook | Proposito |
|------|-----------|
| `useMaterials.js` | Estado completo de Materials.jsx (590 lineas) |
| `usePushNotifications.js` | Registro y gestion push |
| `useDebounced.js` | Debounce de valores |
| `useNotifications.js` | Notificaciones SSE |
| `useScrollReveal.js` | Animaciones scroll |
| `useForecast.js` | Estado y logica de pronosticos |
| `usePlanner.js` | Estado del wizard de planificacion |
| `useRealtime.js` | Eventos en tiempo real WebSocket |

### Services (11 totales)

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
| `metrics.js` | Metricas del sistema |
| `sla.js` | Servicios SLA |

### Stores (Zustand) - 3 totales

| Store | Estado |
|-------|--------|
| `authStore.js` | user, isAuthenticated, login/logout |
| `chatStore.js` | messages, isOpen, context |
| `realtimeStore.js` | eventos, conexion WebSocket |

## Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Usuarios, solicitudes, auth, mensajes | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |
| `data/catalogo_materiales.db` | Catalogo completo de materiales SAP | ~28,000 |

**Reimportacion de datos SAP:**
```bash
python scripts/migrate_excel_to_db.py
```

## Tests - Cobertura

### Resumen

| Categoria | Tests | Cobertura |
|-----------|-------|-----------|
| Backend Unit | 850+ | Excelente (core, pipelines) |
| Backend Integration | 160+ | Buena (14+ rutas) |
| Backend E2E | 25 | Buena (health, auth, flujos) |
| Frontend Pages | 12 | Mejorando |
| Frontend Components | 9 | Mejorando |

**Total: 1,045+ tests en 153 archivos**

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
├── pages/__tests__/
│   ├── Materials.test.jsx       # 52 tests
│   ├── MiCuenta.test.jsx        # 45 tests
│   ├── CreateSolicitud.test.jsx # 15 tests
│   └── Aprobaciones.test.jsx    # 12 tests
├── components/__tests__/
│   └── ProtectedRoute.test.jsx  # 8 tests
├── components/Planner/__tests__/
│   ├── Paso1AnalisisInicial.test.jsx
│   ├── Paso2DecisionAbastecimiento.test.jsx
│   ├── Paso3RevisionFinal.test.jsx
│   └── TratarSolicitudModal.test.jsx
├── hooks/__tests__/
│   └── useDebounced.test.js     # 12 tests
└── utils/__tests__/
    └── formatters.test.js       # 22 tests
```

## Issues Conocidos

### Resueltos (Diciembre 2025)

| Issue | Estado | Notas |
|-------|--------|-------|
| `repository.py` muy grande | **RESUELTO** | Refactorizado a `repository_legacy.py` + `repository/` modular |
| `useTheme.js` codigo muerto | **RESUELTO** | Archivo eliminado (dark mode eliminado) |
| Tokens en localStorage | **MITIGADO** | httpOnly cookies en produccion, localStorage solo en desarrollo |

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
| Imports no usados | Varios routes | Limpieza |
| `useMaterials` muy grande | 590 lineas | Podria dividirse |

## Security Review (2025-12-23)

### Resumen de Hallazgos

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| **CRITICAL** | 3 | **TODOS RESUELTOS/MITIGADOS** |
| **HIGH** | 7 | 6 Resueltos, 1 Pendiente |
| **MEDIUM** | 10 | Mayoria resueltos |

### Issues Criticos - ESTADO ACTUAL

| # | Issue | Estado | Evidencia |
|---|-------|--------|-----------|
| 1 | Privilege Escalation - Sin validacion ownership | **RESUELTO** | `solicitudes.py:273-290` valida ownership y roles |
| 2 | Tokens JWT en localStorage | **MITIGADO** | httpOnly cookies en prod, localStorage solo en dev/cross-origin |
| 3 | SQL Injection pattern (f-string tables) | **MITIGADO** | Whitelist ALLOWED_TABLES en `admin.py:818` |

### Issues de Alta Prioridad - ESTADO ACTUAL

| # | Issue | Estado | Notas |
|---|-------|--------|-------|
| 4 | Sin check autorizacion en aprobaciones | **RESUELTO** | `puede_aprobar()` implementado |
| 5 | CSRF token no es httpOnly | **VALIDO** | Por diseno, cliente debe leerlo |
| 6 | Sin rate limiting en admin endpoints | **RESUELTO** | `@rate_limit(30, 60)` implementado |
| 7 | Bare exception handlers | **PENDIENTE** | Aun existen en algunos archivos |
| 8 | CSRF bypass para Bearer tokens | **POR DISENO** | APIs con JWT no necesitan CSRF |
| 9 | Sin ownership check en DELETE solicitud | **RESUELTO** | Validacion en linea 502-515 |
| 10 | Sin validacion en campos criticos | **RESUELTO** | `@validate_json()` implementado |

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

## Convenciones de Codigo

### Python (backend)
- snake_case para variables/funciones
- Validacion con Pydantic en `core/schemas.py`
- Blueprints por dominio en `routes/`

### JavaScript/React (frontend)
- camelCase para variables, PascalCase para componentes
- Componentes UI en `components/ui/`
- Usar sistema i18n para TODOS los textos visibles

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

## Reglas de Negocio

- Solicitudes requieren minimo 1 item con cantidad > 0
- Presupuesto validado por centro/sector antes de aprobar
- Materiales identificados por codigo SAP unico
- JWT: access token 1h + refresh token 7d

## Archivos Clave

### Backend Entry Points
| Archivo | Proposito |
|---------|-----------|
| `wsgi.py` | Entry point servidor |
| `backend/app.py` | Factory Flask |
| `backend/core/config.py` | Configuracion |

### Core Modules
| Archivo | Proposito |
|---------|-----------|
| `core/db.py` | Conexion BD |
| `core/repository_legacy.py` | Data access legacy (refactorizado) |
| `core/repository/` | Data access modular (nuevo) |
| `core/fsm.py` | Maquina de estados |
| `core/auth_middleware.py` | JWT middleware |
| `core/rate_limit.py` | Rate limiting |
| `core/request_validation.py` | Sanitizacion |

### Services
| Archivo | Proposito |
|---------|-----------|
| `services/ai_service.py` | IA/ML unificado |
| `services/mrp_service.py` | Motor MRP |
| `services/sla_service.py` | Tiempos limite |
| `services/reporting_service.py` | Exportacion |

### Frontend Core
| Archivo | Proposito |
|---------|-----------|
| `context/i18n.jsx` | Traducciones |
| `index.css` | Variables CSS |
| `components/Sidebar.jsx` | Navegacion |
| `services/api.js` | Axios config |

## Modulos Principales

### MRP (Material Requirements Planning)
- **Backend:** `routes/mrp.py`, `services/mrp_service.py`
- **Frontend:** `MRPTableroAlertas.jsx`, `MRPKPIs.jsx`
- **Endpoints:** `/api/mrp/alertas`, `/api/mrp/kpis`

### Planificador (Wizard 4 Pasos)
1. Paso1AnalisisInicial - Analisis stock
2. Paso2DecisionAbastecimiento - Fuente (stock/compra)
3. Paso3RevisionFinal - Confirmacion
4. Paso4AccionesPendientes - Registro

### Push Notifications
- **Backend:** `routes/push.py`, `services/push_service.py`, `core/push_config.py`
- **Frontend:** `hooks/usePushNotifications.js`, `public/sw.js`

### Asistente IA
- **Backend:** `routes/assistant.py`, `routes/ai.py`, `services/ai_service.py`
- **Frontend:** `AssistantModal.jsx`, `ChatAssistant.jsx`

### WebSockets
- **Backend:** `core/websocket.py`
- **Features:** Event Bus, Rooms, Broadcast, Direct messages

### Observability
- **Backend:** `core/observability.py`
- **Features:** Structured logging (JSON), Request tracing (Spans)

### Forecast (Pronosticos de Demanda)
- **Backend:** `agent/pipelines/forecast/`, `routes/ai.py`
- **Frontend:** `ForecastIndividual.jsx`, `ForecastMasivo.jsx`, `components/forecast/`
- **Modelos:** ARIMA, Prophet, XGBoost, Sklearn
- **Features:** Backtesting, tuning automatico, comparacion de modelos

### SLA Dashboard
- **Backend:** `routes/sla.py`, `services/sla_service.py`
- **Frontend:** `SLADashboard.jsx`
- **Features:** Tiempos limite, alertas, metricas de cumplimiento

### AIAnalytics
- **Frontend:** `AIAnalytics.jsx`, `services/ai.js`
- **Features:** Analisis de datos con IA, visualizaciones

## Historial de Sprints (Diciembre 2025)

| Sprint | Feature | Tests |
|--------|---------|-------|
| 1 | FSM (Estados) | 25 |
| 2 | Audit Service | 30 |
| 3 | Approval Matrix | 35 |
| 4 | Item Validation | 28 |
| 5 | SLA + MRP Engine | 55 |
| 6 | AI Service | 45 |
| 7 | Reporting | 32 |
| 8 | DB Optimization | 22 |
| 9 | OpenAPI + Metrics + Health | 40 |
| 10 | Rate Limiting + Validation | 48 |
| 11 | Middleware Integration | 21 |
| 12 | CI/CD Pipeline | - |
| 13 | Background Jobs | 31 |
| 14 | Cache + E2E | 49 |
| 15 | WebSockets | 30 |
| 16 | Observability | 31 |
| 17 | Auditoria Logica Negocio | - |

**Total: 776+ tests unitarios**

### Sprint 17: Auditoria de Logica de Negocio (2025-12-23)

Revision completa de 30 bugs identificados en FSM, Aprobaciones, Presupuestos, MRP, Planificacion y Notificaciones.

**Bugs Corregidos (29 de 30):**

| Fase | Severidad | Bugs | Archivos Principales |
|------|-----------|------|---------------------|
| 1 | Critico | 12 | `fsm.py`, `solicitudes.py`, `budget_transaction.py`, `push_service.py` |
| 2 | Alto | 10 | `mrp_service.py`, `planner_service.py`, `item_schemas.py`, `approval_service.py` |
| 3 | Medio | 7 | `sla_service.py`, `budget_service.py`, `audit_service.py`, `reporting_service.py`, `notification_service.py` |

**Cambios Clave:**
- FSM: Removida transicion invalida IN_PLANNING -> REJECTED, limite de retrocesos
- Aprobaciones: Validacion de ownership, implementacion de delegacion
- Presupuesto: Optimistic locking en reversiones, normalizacion sector ID/nombre
- MRP: Correccion division por cero en ROP, alertas para materiales sin historico
- Notificaciones: Rate limiting (20/min por usuario), proteccion duplicados
- Exportacion: Inclusion de items y decisiones en reportes
- Audit: Serializacion JSON para valores complejos

## Auditoria Exhaustiva (2026-01-09)

**Estadisticas actualizadas:**
- Backend: 131 archivos Python, ~55,000 lineas, 200+ endpoints
- Frontend: 68 paginas, 87 componentes, ~40,000 lineas
- Tests: 1,045+ tests (132 backend + 21 frontend archivos)

**Deuda tecnica identificada:**
- `routes/planner.py`: 2,453 lineas (deberia dividirse en 4 modulos)
- `core/repository_legacy.py`: 1,504 lineas, 12 clases (deberia modularizarse)
- 132 imports try/except duplicados en 25 routes (DRY violation)
- 346 print() statements (deberian usar logging)
- 129 console.log en frontend (deberian removerse)

**Seguridad corregida:**
- Secretos removidos de Git (.env.staging, infra/.env.production, VAPID keys)
- .gitignore actualizado con patrones de seguridad

**Scripts eliminados (obsoletos):**
- `scripts/utilities/conversion/` - migracion PostgreSQL completada
- `scripts/validate_phase_5.py` - fase completada
- `scripts/wizard_pasos_2_3_4.py` - testing legacy
- `scripts/utilities/populate_complete_db.py` - rutas obsoletas
- `scripts/utilities/create_test_solicitud_direct.py`
- `scripts/utilities/create_planner_demo.py`

## Reorganizacion de Arquitectura (Sprint 18)

**Fecha**: 2025-12-23
**Espacio recuperado**: ~560 MB

| Fase | Cambios Realizados |
|------|-------------------|
| **Limpieza Critica** | Eliminados: claves SSH/VAPID, .tmp.driveupload (413 MB), backups BD (~140 MB), repomix-output.xml |
| **Backend** | `planner_service.py` movido a `backend/services/`, eliminado `backend/core/repository/` incompleto |
| **Tests** | Corregidos 34 imports obsoletos (`src.backend` → `backend`), scripts exploratorios a `tests/manual/` |
| **Scripts** | Consolidado `migrate_to_postgres.py`, eliminados 21 scripts PowerShell, 7 inspectores BD duplicados |
| **Raiz** | Eliminados: `/database/`, `/.sugar/`, `/implement/` (contenido movido a `/docs/`) |
| **Frontend** | Logos PNG reemplazados por SVG (~3 MB ahorrados) |

**Estructura Consolidada:**
- Servicios: `backend/services/` (11 servicios incluyendo `planner_service.py`)
- Repositorios: `backend/core/repository_legacy.py` (12 clases)
- Tests manuales: `tests/manual/` (scripts exploratorios)
- Tests UI: `frontend/src/__tests__/ui/`

## Reorganizacion de Arquitectura (Sprint 19)

**Fecha**: 2025-12-29
**Auditoria completa y limpieza profesional**

| Fase | Cambios Realizados |
|------|-------------------|
| **Fase 1: Seguridad** | Verificado .gitignore correcto (VAPID, .env, __pycache__ ya excluidos) |
| **Fase 2: Obsoletos** | Eliminados: `Icon.jsx`, `Radio.jsx`, `test/`, `docs/README.md`, `agent/models/` |
| **Fase 3: Helpers** | Creado `backend/core/helpers.py` consolidando funciones duplicadas (migracion gradual) |
| **Fase 4: Estructura** | SQLs movidos a `infra/migrations/`, `scripts/utils/` consolidado en `scripts/utilities/` |
| **Fase 5: Docs** | Actualizados README.md y CLAUDE.md con metricas actuales |

**Archivos Nuevos:**
- `backend/core/helpers.py` - Funciones helper consolidadas (row_to_dict, get_current_user, is_admin, etc.)
- `backend/routes/planner_helpers/` - Paquete modular para planner.py

**Archivos Eliminados (obsoletos):**
- `frontend/src/components/ui/Icon.jsx` (0 usos, reemplazado por iconMap.js)
- `frontend/src/components/ui/Radio.jsx` (0 usos)
- `frontend/src/test/` (directorio huerfano)
- `docs/README.md` (redundante con raiz)
- `backend/agent/models/` (directorio vacio)

## Sprint 20: Sistema de Presupuestos (2026-01-03)

**Fecha**: 2026-01-03
**Mejoras completas al sistema de Budget Update Requests (BUR)**

### Bugs Criticos Corregidos (Sprint 1-2)
| Bug | Descripcion | Archivo |
|-----|-------------|---------|
| Reversion rechazo | Rechazar solicitud aprobada no revertia presupuesto | `solicitudes.py` |
| Doble consumo | Reenvio de solicitud rechazada consumia doble | `fsm.py` |
| Cancelacion | Cancelar en estado APPROVED no revertia | `fsm.py` |
| Idempotencia | Clave basada en timestamp permitia duplicados | `budget_transaction.py` |
| _connect() bug | Funcion no definida en budget_service | `budget_service.py` |
| canApprove | Frontend no permitia aprobar estados intermedios | `BudgetRequestDetail.jsx` |

### Mejoras UX (Sprint 3)
| Feature | Descripcion | Archivo |
|---------|-------------|---------|
| Paginacion ledger | 50 entradas por pagina con controles | `BudgetRequests.jsx` |
| Sync tabs | Refrescar ambas tabs al aprobar/rechazar | `BudgetRequests.jsx` |
| Validacion motivo | Tiempo real, minimo 5 caracteres | `BudgetRequests.jsx` |
| Modal impacto | Mostrar nuevo saldo antes de aprobar | `BudgetRequests.jsx` |
| Exportacion CSV | Exportar historial y BURs a CSV | `BudgetRequests.jsx` |

### Tests Agregados (Sprint 4)
| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `BudgetRequests.test.jsx` | 36 | Paginacion, sync, validacion, modales |
| `BudgetRequestDetail.test.jsx` | 22 | Detalle, aprobacion, rechazo, estados |
| `test_budget_integration.py` | 18 | Flujo completo BUR, autorizacion, ledger |

**Total nuevos tests: 76**

### Sistema de Presupuestos
- **Backend:** `routes/budget.py`, `services/budget_service.py`, `core/budget_schemas.py`
- **Frontend:** `BudgetRequests.jsx`, `BudgetRequestDetail.jsx`, `BudgetRequestCreate.jsx`
- **Endpoints:** `/api/budget-requests`, `/api/budget/ledger`, `/api/budget/info`
- **Niveles de Aprobacion:**
  - L1: hasta $200,000 USD
  - L2: hasta $1,000,000 USD
  - ADMIN: mas de $1,000,000 USD

## Sprint 21: Fixes de Autenticacion (2026-01-09)

**Fecha**: 2026-01-03 a 2026-01-09
**Enfoque**: Mejoras de autenticacion, UX y CI/CD

### Cambios Principales

| Tipo | Descripcion | Archivos |
|------|-------------|----------|
| Auth | Validacion mejorada de variantes de rol admin | `tempData.js`, `TempDataBanner.jsx` |
| Auth | Context retrieval para admin import | `admin_import.py` |
| Auth | Retry de autenticacion en downloadTemplate | `tempData.js` |
| UX | Autocomplete en todos los inputs de formularios | Multiples paginas |
| UX | Silenciamiento de errores 401 innecesarios | `downloadTemplate`, `AnalisisPuntual` |
| CI/CD | GitHub Actions workflow para produccion | `.github/workflows/` |

### Commits (15 totales)

```
318eb52 fix(admin_import): fix user context retrieval for auth
922d2ca fix(tempData): allow auth retry for downloadTemplate
ed2b785 fix(tempData): improve role checking with multiple admin role variants
64b778e fix(tempData): add admin check before API calls in service layer
08bb9d2 fix(TempDataBanner): check admin role before fetching temp-data status
d39efd0 fix: remove console.warn from downloadTemplate
9de88a9 fix: silence 401 errors in downloadTemplate
2e5b7e7 fix: correct API URLs and handle error objects in AnalisisPuntual
25f7f25 feat: improve download template button in import modal
c209538 fix: silence 401 errors from temp-data/status endpoint
c1e1653 fix: prevent TempDataBanner API call when not authenticated
f5d67fe fix: add autocomplete attributes to all form inputs
cc7a1e1 fix: add autocomplete attributes to password inputs
2505e44 chore: trigger production deployment
28ba85f ci: add GitHub Actions workflow for production deployment
```

## Sprint 22: Mejoras al Sistema de Agentes (2026-01-10)

**Fecha**: 2026-01-09 a 2026-01-10
**Enfoque**: Sistema de agentes/chat, integracion PostgreSQL, modulo RAG

### Cambios Principales

| Tipo | Descripcion | Archivos |
|------|-------------|----------|
| Agent | Modulo RAG agregado para mejorar forecasting ML | `agent/` |
| Agent | DataLoader refactorizado para PostgreSQL en produccion | `data_loader.py` |
| Agent | Captura de errores en execution_log para chat | `react_agent.py` |
| Chat | Mejora en manejo de queries y comandos especiales | `ChatAssistant.jsx` |
| Chat | Auto-envio de sugerencias al hacer clic | `ChatAssistant.jsx` |
| AI | Compatibilidad de estructura de respuesta con frontend | `routes/ai.py` |
| SLA | Script de migracion PostgreSQL para esquema SLA | `migrations/` |
| Auth | Hash de passwords con bcrypt en rutas admin | `routes/admin.py` |
| Tests | Tests unitarios para checks de Celery y JobsQueue | `test_health.py` |

### Commits (20 principales)

```
57ef662 fix(chat): improve query handling and special commands
a713bd4 fix(agent): capture errors in execution_log and display in chat
bece1a4 fix(chat): fix response handling to match agent output structure
963e5b5 fix(agent): fix DataLoader params in Reasoner and enrich context
74dcdb8 fix(agent): refactor DataLoader to use PostgreSQL for production
cda7f57 feat(agent): add RAG module and improve ML forecasting pipeline
6e289b3 fix(ai): extract alertas array from response object
bdc3453 fix(ai): transform response structure for frontend compatibility
82ae082 feat(sla): add PostgreSQL migration script for SLA schema
4711936 test(health): add unit tests for Celery and JobsQueue checks
```

## Documentacion

- `docs/ARQUITECTURA_SPM_2_0.md` - Arquitectura completa
- `docs/DEPLOYMENT.md` - Guia de despliegue
- `docs/GUIA_RAPIDA_USAR_SERVICIOS.md` - Uso de servicios
- `docs/PLAN_ESCALADO_SPM.md` - Plan de escalado
- `docs/implementation_plan.md` - Plan de implementacion
- `docs/history/` - Documentacion historica

## Instrucciones para Claude

1. Explicar el plan antes de modificar codigo
2. Cambios pequenos y controlados
3. Usar siempre el sistema i18n para textos de UI
4. Mantener consistencia con CSS variables + Tailwind
5. No hardcodear textos en espanol/ingles
6. No modificar estructura de BD sin crear migracion
7. Verificar que el build compile sin errores
8. **Priorizar tests para frontend** (cobertura critica baja)
9. Usar `repository_legacy.py` para entidades de datos (consolidado)

### Seguridad (Obligatorio)

- **Siempre validar ownership** antes de acceder/modificar datos de usuario
- **Usar SQL parametrizado** - nunca f-strings para queries
- **Validar inputs** con `@validate_json()` o schemas Pydantic
- **No exponer errores internos** - usar mensajes genericos al cliente
- **Agregar rate limiting** a endpoints sensibles
- **Revisar permisos por rol** antes de operaciones criticas
