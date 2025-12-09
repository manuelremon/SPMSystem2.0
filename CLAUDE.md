# CLAUDE.md

Guia para Claude Code (claude.ai/code) cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2025-12-08 (Security Review)

## Resumen del Proyecto

| Metrica | Valor |
|---------|-------|
| **Backend** | 94 archivos Python, 38,000+ lineas |
| **Frontend** | 31 paginas, 56 componentes, 6 hooks |
| **Endpoints API** | 180 endpoints en 23 modulos |
| **Tests** | 1,200+ tests (755 unit, 18 E2E, 140 integration) |
| **Base de Datos** | 3 SQLite (213,703 registros totales) |

## Comandos de Desarrollo

```bash
# Backend (Flask) - Terminal 1
python wsgi.py                    # Inicia en http://localhost:5000

# Frontend (Vite + React) - Terminal 2
cd frontend && npm run dev        # Inicia en http://localhost:5173

# Tests
python -m pytest tests/           # Backend tests (755 tests)
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
├── backend/                    # API Flask (94 archivos, 38K lineas)
│   ├── routes/                 # 23 modulos, 180 endpoints
│   ├── services/               # 10 servicios de negocio
│   ├── core/                   # 28 modulos de infraestructura
│   ├── agent/                  # 19 archivos ML/IA
│   └── migrations/             # 8 migraciones de BD
├── frontend/src/
│   ├── pages/                  # 31 paginas + 13 admin
│   ├── components/             # 56 componentes
│   ├── hooks/                  # 6 custom hooks
│   ├── services/               # 6 servicios API
│   ├── store/                  # 2 stores Zustand
│   └── context/                # i18n provider (200+ keys)
├── data/                       # Bases de datos SQLite
├── tests/                      # 92 archivos de test
├── scripts/                    # Scripts de utilidad
└── docs/                       # Documentacion
```

## Backend - Inventario Completo

### Routes (23 modulos, 180 endpoints)

| Modulo | Endpoints | Proposito |
|--------|-----------|-----------|
| `admin.py` | 26 | CRUD usuarios, roles, materiales, proveedores |
| `planner.py` | 21 | Planificacion de solicitudes, decisiones |
| `mi_cuenta.py` | 12 | Perfil, password, preferencias |
| `solicitudes.py` | 11 | CRUD solicitudes, estados, archivos |
| `metrics.py` | 10 | Metricas de rendimiento |
| `ai.py` | 9 | Recomendaciones IA, analisis |
| `budget.py` | 8 | Presupuestos, ledger, BUR |
| `mensajes.py` | 8 | Sistema de mensajeria |
| `mrp.py` | 8 | Alertas MRP, KPIs, catalogo |
| `auth.py` | 7 | Login, refresh, logout |
| `sla.py` | 7 | Metricas SLA, alertas |
| `docs.py` | 6 | Swagger UI, OpenAPI |
| `export.py` | 6 | Exportar solicitudes, inventario |
| `notificaciones.py` | 6 | CRUD notificaciones |
| `push.py` | 6 | Push notifications |
| `catalogos.py` | 5 | Centros, sectores, puestos |
| `equivalencias.py` | 5 | Equivalencias de materiales |
| `foro.py` | 5 | Posts, replies, likes |
| `health.py` | 5 | Health checks, probes |
| `materiales.py` | 3 | Busqueda, detalle, stats |
| `trivias.py` | 3 | Rankings, scores |
| `assistant.py` | 2 | Sugerencias IA |
| `kpis.py` | 1 | Dashboard KPIs |

### Services (10 servicios)

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

### Core (28 modulos)

| Categoria | Modulos |
|-----------|---------|
| **Auth** | `auth_middleware.py`, `roles.py` |
| **Database** | `db.py`, `db_optimization.py`, `repository.py` (50KB, 12 clases) |
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

### Agent/ML (19 archivos)

```
agent/
├── core/
│   ├── memory.py          # Memoria del agente
│   ├── react_agent.py     # Loop ReAct
│   └── reasoner.py        # Razonamiento estructurado
├── pipelines/
│   ├── clustering.py      # Agrupacion de materiales
│   ├── scoring.py         # Priorizacion de solicitudes
│   └── demand_forecast.py # Proyeccion de demanda
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

### Pages (31 principales + 13 admin)

| Categoria | Paginas |
|-----------|---------|
| **Auth** | Login, CompleteRegistration |
| **Solicitudes** | CreateSolicitud, Materials, MisSolicitudes, SolicitudDetalle |
| **Aprobacion** | Aprobaciones, HistorialAprobaciones |
| **Planificacion** | Planner (con wizard 4 pasos) |
| **MRP** | MRPTableroAlertas, MRPKPIs |
| **Budget** | BudgetRequests, BudgetRequestCreate, BudgetRequestDetail |
| **Catalogos** | CatalogoMateriales, CatalogoEquivalencias |
| **Comunicacion** | Mensajes, Notificaciones, Foro, Ayuda |
| **Usuario** | MiCuenta, Dashboard (5 variantes por rol) |
| **Gamificacion** | Trivias |
| **Admin** | AdminUsuarios, AdminRoles, AdminCentros, AdminSectores, AdminMateriales, AdminProveedores, AdminPresupuestos, AdminEstado, AdminMetricas, AdminPlanificadores, AdminPuestos, AdminAlmacenes, AdminSolicitudesPerfil |

### Components (56 totales)

| Carpeta | Componentes | Proposito |
|---------|-------------|-----------|
| `ui/` | 27 | Primitivos (Button, Input, Card, Modal, Badge, etc.) |
| `features/DataTable/` | 3 | Tabla avanzada con TanStack Table |
| `materials/` | 3 | MaterialDetailModal, MaterialsTable, SearchDropdown |
| `Planner/` | 6 | Wizard de 4 pasos + StockDetalleModal |
| **Core** | 7 | Layout, Sidebar, ErrorBoundary, ProtectedRoute, etc. |
| **Modals** | 4 | AdminCrudTemplate, AssistantModal, ChatAssistant, MensajeThreadModal |

### Hooks

| Hook | Proposito |
|------|-----------|
| `useMaterials.js` | Estado completo de Materials.jsx (400+ lineas) |
| `usePushNotifications.js` | Registro y gestion push |
| `useDebounced.js` | Debounce de valores |
| `useNotifications.js` | Notificaciones SSE |
| `useScrollReveal.js` | Animaciones scroll |
| `useTheme.js` | **STUB** - solo retorna light theme |

### Services

| Servicio | Proposito |
|----------|-----------|
| `api.js` | Axios con interceptors, CSRF, refresh token |
| `auth.js` | Login, tokens, logout |
| `csrf.js` | Gestion token CSRF |
| `spm.js` | Operaciones de negocio (solicitudes, materiales, etc.) |
| `agent.js` | Asistente IA |
| `account.js` | Perfil de usuario |

### Stores (Zustand)

| Store | Estado |
|-------|--------|
| `authStore.js` | user, isAuthenticated, login/logout |
| `chatStore.js` | messages, isOpen, context |

## Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Usuarios, solicitudes, auth, mensajes | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |

**Reimportacion de datos SAP:**
```bash
python scripts/migrate_excel_to_db.py
```

## Tests - Cobertura

### Resumen

| Categoria | Tests | Cobertura |
|-----------|-------|-----------|
| Backend Unit | 792 | Excelente (core, pipelines) |
| Backend Integration | 140 | Buena (14 rutas) |
| Backend E2E | 18 | Basica (health, auth, errors) |
| Frontend Pages | 4 | **Gap critico** (9%) |
| Frontend Components | 5 | **Gap critico** (13%) |

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

### Prioridad Alta

| Issue | Ubicacion | Impacto |
|-------|-----------|---------|
| `repository.py` muy grande | `core/repository.py` (50KB, 12 clases) | Mantenibilidad |
| Imports try/except duplicados | Todos los routes (23 archivos) | DRY violation |
| `useTheme` es codigo muerto | `hooks/useTheme.js` | ThemeToggle no funciona |

### Prioridad Media

| Issue | Ubicacion | Impacto |
|-------|-----------|---------|
| Funciones helper duplicadas | `_get_user()` en 5+ routes | DRY violation |
| Bare except handlers | `routes/mi_cuenta.py` | Puede ocultar errores |
| Tokens en localStorage | `services/auth.js` | Seguridad (XSS) |

### Prioridad Baja

| Issue | Ubicacion | Impacto |
|-------|-----------|---------|
| TODO/FIXME pendientes | 5 archivos | Deuda tecnica |
| Imports no usados | Varios routes | Limpieza |
| `useMaterials` muy grande | 400+ lineas | Podria dividirse |

## Security Review (2025-12-08)

### Resumen de Hallazgos

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| **CRITICAL** | 3 | Pendiente |
| **HIGH** | 7 | Pendiente |
| **MEDIUM** | 10 | Pendiente |

### Issues Criticos (Accion Inmediata)

| # | Issue | Ubicacion | Riesgo |
|---|-------|-----------|--------|
| 1 | Privilege Escalation - Sin validacion ownership | `routes/solicitudes.py:204-229` | Usuario puede ver solicitudes de otros |
| 2 | Tokens JWT en localStorage | `services/auth.js:5-13` | Vulnerable a XSS |
| 3 | SQL Injection pattern (f-string tables) | `routes/admin.py:735` | Inyeccion SQL potencial |

### Issues de Alta Prioridad

| # | Issue | Ubicacion |
|---|-------|-----------|
| 4 | Sin check autorizacion en aprobaciones | `routes/solicitudes.py:608-794` |
| 5 | CSRF token no es httpOnly | `core/csrf.py:103-110` |
| 6 | Sin rate limiting en admin endpoints | `routes/admin.py` |
| 7 | Bare exception handlers | `routes/admin.py`, `routes/mi_cuenta.py` |
| 8 | CSRF bypass para Bearer tokens | `core/csrf.py:71-94` |
| 9 | Sin ownership check en DELETE solicitud | `routes/solicitudes.py:374-441` |
| 10 | Sin validacion en campos criticos | `routes/solicitudes.py:260-272` |

### Acciones Recomendadas (Prioridad)

1. **Agregar validacion de ownership** en todos los endpoints de datos
2. **Remover tokens de localStorage** - usar solo httpOnly cookies
3. **Agregar rate limiting** a endpoints admin
4. **Habilitar CSRF para logout**
5. **Implementar validacion consistente** con decorador `@validate_json()`

### Buenas Practicas Existentes

- Password hashing con bcrypt
- Rate limiting en login (10 intentos/5min)
- Security headers configurados
- SQL parametrizado (mayoria de queries)
- JWT con expiracion (1h access, 7d refresh)

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
| `core/repository.py` | Data access (12 clases) |
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

**Total: 755+ tests unitarios**

## Documentacion

- `docs/ARQUITECTURA_SPM_2_0.md` - Arquitectura completa
- `docs/DEPLOYMENT.md` - Guia de despliegue
- `docs/GUIA_RAPIDA_USAR_SERVICIOS.md` - Uso de servicios
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
9. **Considerar refactorizar repository.py** si se agregan mas entidades

### Seguridad (Obligatorio)

- **Siempre validar ownership** antes de acceder/modificar datos de usuario
- **Usar SQL parametrizado** - nunca f-strings para queries
- **Validar inputs** con `@validate_json()` o schemas Pydantic
- **No exponer errores internos** - usar mensajes genericos al cliente
- **Agregar rate limiting** a endpoints sensibles
- **Revisar permisos por rol** antes de operaciones criticas
