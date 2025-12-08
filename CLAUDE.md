# CLAUDE.md

Guia para Claude Code (claude.ai/code) cuando trabaja con este repositorio.

> **Ultima actualizacion**: 2025-12-08

## Comandos de Desarrollo

```bash
# Backend (Flask) - Terminal 1
python wsgi.py                    # Inicia en http://localhost:5000

# Frontend (Vite + React) - Terminal 2
cd frontend && npm run dev        # Inicia en http://localhost:5173

# Tests
python -m pytest tests/           # Backend tests
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
├── backend/                    # API Flask (antes backend_v2/)
│   ├── routes/                 # Endpoints (17 modulos)
│   │   ├── solicitudes.py      # CRUD solicitudes
│   │   ├── mrp.py              # Modulo MRP (alertas, KPIs)
│   │   ├── planner.py          # Planificador de solicitudes
│   │   ├── materiales.py       # Busqueda de materiales
│   │   ├── push.py             # Push notifications
│   │   ├── assistant.py        # Asistente IA
│   │   └── ...                 # auth, admin, budget, etc.
│   ├── services/               # Logica de negocio
│   │   ├── push_service.py     # Servicio de notificaciones
│   │   └── ...
│   ├── core/                   # Config, DB, Auth, CSRF, Security
│   │   ├── push_config.py      # Configuracion VAPID
│   │   └── ...
│   ├── agent/                  # Modulo IA/ML (pipelines, tools)
│   └── migrations/             # Migraciones de BD
├── frontend/src/
│   ├── pages/                  # Paginas React (35+)
│   │   ├── Dashboard*.jsx      # Dashboards por rol (5 archivos)
│   │   ├── MRP*.jsx            # Modulo MRP (alertas, KPIs)
│   │   └── ...
│   ├── components/
│   │   ├── ui/                 # Componentes base (30+)
│   │   ├── features/           # DataTable moderno
│   │   ├── materials/          # Componentes de materiales
│   │   ├── Planner/            # Componentes del planificador (4 pasos)
│   │   ├── AssistantModal.jsx  # Modal del asistente IA
│   │   └── Sidebar.jsx         # Navegacion lateral
│   ├── context/                # Auth, i18n providers
│   ├── hooks/                  # Custom hooks
│   │   ├── useMaterials.js     # Gestion de materiales
│   │   ├── usePushNotifications.js # Push notifications
│   │   └── useTheme.js         # Tema de la app
│   ├── lib/                    # Utilidades compartidas
│   │   └── utils.js            # Funcion cn() para clases
│   ├── utils/                  # Utilidades especificas
│   │   ├── logger.js           # Sistema de logging
│   │   ├── gradients.js        # Gradientes UI
│   │   └── tableAlignments.js  # Alineacion de tablas
│   └── services/               # API clients
├── data/                       # Bases de datos SQLite
│   ├── spm.db                  # BD transaccional
│   ├── equivalentes.db         # Equivalencias materiales
│   ├── sap_data.db             # Datos SAP
│   └── vapid_*.pem             # Claves para push notifications
├── scripts/                    # Scripts de utilidad
├── tests/                      # Unit, integration tests
└── docs/                       # Documentacion tecnica
    └── history/                # Documentacion historica
```

### Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Usuarios, solicitudes, auth, mensajes | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |

**Reimportacion de datos SAP:**
```bash
python scripts/migrate_excel_to_db.py
```

### Flujo de Solicitudes

Estados: `draft` -> `submitted` -> `approved/rejected` -> `processing` -> `dispatched` -> `closed`

### Roles

- **admin**: Acceso total al sistema
- **coordinador**: Aprobar/rechazar solicitudes
- **usuario**: Crear solicitudes
- **planner**: Planificar solicitudes aprobadas
- **jefe**: Supervision de equipos

## Convenciones de Codigo

### Python (backend)
- snake_case para variables/funciones
- Validacion con Pydantic en `models/schemas.py`
- Blueprints por dominio en `routes/`

### JavaScript/React (frontend)
- camelCase para variables, PascalCase para componentes
- Componentes UI en `components/ui/`
- Usar sistema i18n para TODOS los textos visibles

### Sistema i18n (Internacionalizacion)
- Ubicacion: `frontend/src/context/i18n.jsx`
- API: `const { t } = useI18n(); t('clave', 'fallback')`
- Convencion de claves: `prefijo_nombre` (ej: `nav_solicitudes`, `materials_buscar`)
- Prefijos: `nav_`, `dash_`, `common_`, `materials_`, `admin_`, `planner_`

### Sistema de Estilos

**Tema:** Solo tema claro (light mode). Dark mode fue eliminado.

**Archivos de configuracion:**
- `frontend/src/index.css` - Variables CSS del sistema (colores, espaciado, bordes)
- `frontend/tailwind.config.js` - Configuracion de Tailwind
- `frontend/src/utils/styleConfig.js` - Helpers de estados

**Componentes UI:** `frontend/src/components/ui/`
- Todos los componentes usan CSS variables (`var(--nombre)`) para consistencia
- Tablas: `table.jsx` (primitivas) + `ModernDataTable.jsx` (TanStack Table)
- Tabs: `Tabs.jsx` con variantes default, pills, underline

**Nota:** Las decisiones de diseno visual (colores, espaciado, densidad) se definen segun indicaciones del usuario, no por reglas predefinidas.

## Reglas de Negocio

- Solicitudes requieren minimo 1 item con cantidad > 0
- Presupuesto se valida por centro/sector antes de aprobar
- Materiales identificados por codigo SAP unico
- Autenticacion JWT (access token 1h + refresh token 7d)

## Convenciones de Fechas y Moneda

- **Zona horaria**: America/Argentina/Buenos_Aires (UTC-03:00)
- **Almacenamiento**: UTC, formato ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`)
- **Frontend**: Convierte UTC -> hora local para mostrar
- **Moneda**: USD con 2 decimales

## Instrucciones para Claude

1. Explicar el plan antes de modificar codigo
2. Cambios pequenos y controlados
3. Usar siempre el sistema i18n para textos de UI
4. Mantener consistencia con el sistema de diseno (CSS variables + Tailwind)
5. No hardcodear textos en espanol/ingles
6. No modificar estructura de BD sin crear migracion
7. Verificar que el build compile sin errores

## Archivos Clave

| Archivo | Proposito |
|---------|-----------|
| `wsgi.py` | Entry point del servidor |
| `backend/app.py` | Factory de Flask |
| `backend/core/config.py` | Configuracion centralizada |
| `backend/core/db.py` | Conexion a BD |
| `backend/core/auth_middleware.py` | Middleware de autenticacion JWT |
| `backend/core/security_headers.py` | Headers de seguridad HTTP |
| `backend/core/push_config.py` | Configuracion VAPID para push |
| `backend/routes/solicitudes.py` | CRUD de solicitudes |
| `backend/routes/mrp.py` | Endpoints MRP (alertas, KPIs) |
| `backend/routes/planner.py` | Endpoints del planificador |
| `backend/routes/push.py` | Endpoints push notifications |
| `frontend/src/context/i18n.jsx` | Sistema de traducciones |
| `frontend/src/index.css` | Variables CSS del sistema de diseno |
| `frontend/src/components/Sidebar.jsx` | Navegacion lateral colapsable |
| `frontend/src/utils/styleConfig.js` | Configuracion de estados/colores |
| `frontend/src/lib/utils.js` | Utilidad cn() para classNames |

## Modulos Principales

### MRP (Material Requirements Planning)
Modulo para gestion de alertas y KPIs de materiales.

**Rutas backend** (`backend/routes/mrp.py`):
- `GET /api/mrp/alertas` - Tablero de alertas de stock
- `GET /api/mrp/kpis` - Indicadores clave de rendimiento

**Paginas frontend**:
- `MRPTableroAlertas.jsx` - Dashboard de alertas con filtros
- `MRPKPIs.jsx` - Visualizacion de KPIs con graficos

### Dashboard por Rol
El Dashboard fue refactorizado en 5 componentes especializados:
- `DashboardAdmin.jsx` - Vista administrador
- `DashboardAprobador.jsx` - Vista coordinador/aprobador
- `DashboardPlanificador.jsx` - Vista planificador
- `DashboardSolicitante.jsx` - Vista usuario solicitante
- `DashboardShared.jsx` - Componentes compartidos

### Planificador (Tratar Solicitud)
Wizard de 4 pasos para procesar solicitudes aprobadas:
1. **Paso1AnalisisInicial** - Analisis del material y stock
2. **Paso2DecisionAbastecimiento** - Seleccion de fuente (stock/compra)
3. **Paso3RevisionFinal** - Confirmacion de decision
4. **Paso4AccionesPendientes** - Registro de tratamiento y acciones

**Rutas backend** (`backend/routes/planner.py`):
- `GET /api/planner/solicitudes-pendientes` - Lista solicitudes a tratar
- `POST /api/planner/tratar-solicitud/<id>/ejecutar-acciones` - Ejecutar decisiones

### Push Notifications
Sistema de notificaciones push usando VAPID/Web Push.

**Backend:**
- `backend/core/push_config.py` - Configuracion y claves VAPID
- `backend/routes/push.py` - Endpoints de suscripcion
- `backend/services/push_service.py` - Envio de notificaciones

**Frontend:**
- `frontend/public/sw.js` - Service Worker
- `frontend/src/hooks/usePushNotifications.js` - Hook de gestion
- `frontend/src/components/ui/PushNotificationToggle.jsx` - Toggle UI

### Asistente IA
Chat integrado para asistencia al usuario.

- `backend/routes/assistant.py` - Endpoints del asistente
- `frontend/src/components/AssistantModal.jsx` - Modal de chat
- `frontend/src/components/ChatAssistant.jsx` - Componente de chat

## Cambios Recientes (Diciembre 2025)

### Reorganizacion de Estructura
- `backend_v2/` renombrado a `backend/`
- Documentacion historica movida a `docs/history/`
- Scripts de utilidad consolidados en `scripts/`

### Nuevas Features
- **Modulo MRP**: Tablero de alertas y KPIs de materiales
- **Push Notifications**: Sistema completo con VAPID y Service Worker
- **Asistente IA**: Chat integrado para ayuda al usuario
- **ScrollReveal**: Animaciones de entrada en toda la app
- **Sidebar colapsable**: Componente `Sidebar.jsx` agregado
- **ModernDataTable**: Tabla con TanStack Table en `components/features/`
- **Tema unico (Light)**: Eliminado soporte dark mode

### Correcciones
- Bug fix en `planner.py`: metodo `get_fuentes_decision` -> `get_fuentes`
- Agregado logging con traceback en endpoint ejecutar-acciones

### Tests Agregados
- Tests de integracion: `test_catalogos_routes.py`, `test_materiales_routes.py`, `test_mi_cuenta_routes.py`
- Tests frontend: `useDebounced.test.js`, `Materials.test.jsx`, `MiCuenta.test.jsx`

### Migraciones
- `005_planner_data_integration.py` - Tablas para precios negociados y scores de equivalencia

## Documentacion Adicional

- `docs/ARQUITECTURA_SPM_2_0.md` - Arquitectura completa del proyecto
- `docs/DEPLOYMENT.md` - Guia de despliegue
- `docs/GUIA_RAPIDA_USAR_SERVICIOS.md` - Guia de uso de servicios
- `docs/history/` - Documentacion de fases, propuestas y sesiones anteriores
