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
│   │   └── ...                 # auth, admin, budget, etc.
│   ├── services/               # Logica de negocio
│   ├── core/                   # Config, DB, Auth, CSRF, Security
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
│   │   └── Planner/            # Componentes del planificador
│   ├── context/                # Auth, i18n providers
│   ├── hooks/                  # Custom hooks
│   └── services/               # API clients
├── data/                       # Bases de datos SQLite
│   ├── spm.db                  # BD transaccional
│   ├── equivalentes.db         # Equivalencias materiales
│   └── sap_data.db             # Datos SAP
├── scripts/                    # Scripts de utilidad
├── tests/                      # Unit, integration tests
└── docs/                       # Documentacion tecnica
    └── history/                # Documentacion historica (fases, propuestas)
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
| `backend/routes/solicitudes.py` | CRUD de solicitudes |
| `backend/routes/mrp.py` | Endpoints MRP (alertas, KPIs) |
| `backend/routes/planner.py` | Endpoints del planificador |
| `frontend/src/context/i18n.jsx` | Sistema de traducciones |
| `frontend/src/index.css` | Variables CSS del sistema de diseno |
| `frontend/src/components/Sidebar.jsx` | Navegacion lateral colapsable |
| `frontend/src/utils/styleConfig.js` | Configuracion de estados/colores |

## Modulos Principales

### MRP (Material Requirements Planning)
Modulo agregado en diciembre 2025 para gestion de alertas y KPIs de materiales.

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
3. Paso 3 - Confirmacion de decision
4. Paso 4 - Registro de tratamiento

## Cambios Recientes (Diciembre 2025)

### Reorganizacion de Estructura
- `backend_v2/` renombrado a `backend/`
- Documentacion historica movida a `docs/history/`
- Scripts de utilidad consolidados en `scripts/`

### Nuevas Features
- **Modulo MRP**: Tablero de alertas y KPIs de materiales
- **ScrollReveal**: Animaciones de entrada en toda la app
- **Sidebar colapsable**: Componente `Sidebar.jsx` agregado
- **ModernDataTable**: Tabla con TanStack Table en `components/features/`
- **Tema unico (Light)**: Eliminado soporte dark mode, sistema usa solo tema claro
- **Estilos unificados**: Tablas y Tabs actualizados a usar CSS variables del sistema

### Correcciones
- Bug fix en `planner.py`: metodo `get_fuentes_decision` → `get_fuentes`
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
