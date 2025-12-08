# Arquitectura de Carpetas - SPMv2.0

**Fecha de reestructuración:** 2025-12-05
**Versión:** 2.0

---

## Estructura de Directorios

```
SPMv2.0/
├── backend/                    # API Flask (Python)
│   ├── core/                   # Configuración, DB, Auth, Middleware
│   │   ├── config.py           # Configuración centralizada (Pydantic)
│   │   ├── db.py               # Conexión SQLite + SQLAlchemy
│   │   ├── auth_middleware.py  # JWT + decoradores de auth
│   │   ├── csrf.py             # Protección CSRF
│   │   ├── security_headers.py # Headers de seguridad OWASP
│   │   └── schema.sql          # Esquema inicial de BD
│   │
│   ├── routes/                 # Blueprints Flask (14 módulos)
│   │   ├── auth.py             # Login, registro, refresh token
│   │   ├── solicitudes.py      # CRUD de solicitudes
│   │   ├── materiales.py       # Búsqueda de materiales SAP
│   │   ├── planner.py          # Planificación de solicitudes
│   │   ├── admin.py            # Administración de usuarios
│   │   ├── budget.py           # Gestión presupuestaria (BUR)
│   │   ├── mensajes.py         # Sistema de mensajería
│   │   ├── notificaciones.py   # Notificaciones push
│   │   ├── mi_cuenta.py        # Perfil de usuario
│   │   ├── catalogos.py        # Catálogos (centros, almacenes)
│   │   ├── foro.py             # Foro de discusión
│   │   ├── trivias.py          # Módulo de trivias
│   │   └── ...
│   │
│   ├── services/               # Lógica de negocio
│   │   ├── budget_service.py   # Cálculos presupuestarios
│   │   ├── notification_service.py
│   │   └── message_service.py
│   │
│   ├── agent/                  # Módulo ML/IA (ReAct)
│   │   ├── core/               # Agente principal
│   │   ├── tools/              # Herramientas del agente
│   │   └── pipelines/          # Pipelines ML (clustering, forecast)
│   │
│   ├── models/                 # Schemas Pydantic
│   │   └── schemas.py
│   │
│   ├── migrations/             # Migraciones SQL
│   └── app.py                  # Factory de aplicación Flask
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/              # Componentes de página (31)
│   │   ├── components/         # Componentes UI reutilizables
│   │   │   └── ui/             # Sistema de diseño (25 componentes)
│   │   ├── context/            # Providers (Auth, i18n)
│   │   ├── hooks/              # Custom hooks (4)
│   │   ├── services/           # API clients
│   │   └── utils/              # Utilidades (formatters, styleConfig)
│   │
│   ├── public/                 # Assets estáticos
│   ├── dist/                   # Build de producción
│   ├── vite.config.js          # Configuración Vite
│   ├── tailwind.config.js      # Configuración Tailwind
│   └── package.json
│
├── tests/                      # Tests (237 total)
│   ├── unit/                   # Tests unitarios Python
│   ├── integration/            # Tests de integración
│   ├── e2e/                    # Tests end-to-end
│   └── manual/                 # Scripts de prueba manual
│
├── scripts/                    # Scripts de ejecución y mantenimiento
│   ├── INICIAR_SPM.bat         # Script de inicio Windows
│   ├── init_db_production.py   # Inicializar BD producción
│   ├── verify_production_setup.py
│   └── test_production.py
│
├── data/                       # Datos persistentes
│   ├── spm.db                  # BD transaccional (usuarios, solicitudes)
│   ├── equivalentes.db         # BD de equivalencias de materiales SAP
│   ├── sap_data.db             # BD de datos SAP (stock, consumo, pedidos)
│   └── xlsx/                   # Archivos Excel originales (backup)
│
├── docs/                       # Documentación
│   ├── ai/                     # Docs del módulo IA
│   ├── functional/             # Especificaciones funcionales
│   ├── guides/                 # Guías de uso
│   ├── history/                # Historial de desarrollo
│   ├── infrastructure/         # Docs de infraestructura
│   └── planning/               # Planificación
│
├── .claude/                    # Configuración Claude Code
├── .sugar/                     # Tareas Sugar
│
├── wsgi.py                     # Punto de entrada del servidor
├── pyproject.toml              # Configuración Python
├── requirements.txt            # Dependencias Python
├── pytest.ini                  # Configuración pytest
├── README.md                   # Documentación principal
├── CLAUDE.md                   # Instrucciones para Claude
└── .gitignore                  # Archivos ignorados por Git
```

---

## Decisiones de Arquitectura

### 1. Separación Backend/Frontend
- **Backend**: Flask API en puerto 5000
- **Frontend**: React SPA en puerto 5173 (dev) / servido por Flask (prod)
- **Comunicación**: REST API con JWT + CSRF

### 2. Bases de Datos (SQLite)

| Base de Datos | Propósito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | BD transaccional (usuarios, solicitudes, auth) | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo histórico, pedidos SAP | 178,338 |

- **Motor**: SQLite (desarrollo y producción ligera)
- **ORM**: SQLAlchemy para queries complejas
- **Migraciones**: Scripts SQL en `backend/migrations/`
- **Reimportación SAP**: `python scripts/migrate_excel_to_db.py`

### 3. Autenticación
- **JWT**: Access token (1h) + Refresh token (7d)
- **CSRF**: Doble cookie (SameSite + token)
- **Roles**: admin, coordinador, usuario, planner, jefe

### 4. Sistema de Diseño
- **CSS**: Tailwind + Variables CSS (Linear Dark SAAS)
- **Componentes**: Sistema UI en `components/ui/`
- **i18n**: 524 traducciones (ES/EN)

---

## Flujo de Datos

```
Usuario → Frontend (React) → API REST → Backend (Flask) → SQLite
                ↑                              ↓
                └──────── JSON Response ───────┘
```

### Estados de Solicitud
```
draft → submitted → approved/rejected → processing → dispatched → closed
```

---

## Comandos de Desarrollo

```bash
# Backend
python wsgi.py                    # Iniciar servidor (puerto 5000)

# Frontend
cd frontend && npm run dev        # Servidor desarrollo (puerto 5173)
cd frontend && npm run build      # Build producción

# Tests
python -m pytest tests/           # Tests Python
cd frontend && npm test           # Tests React
```

---

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `wsgi.py` | Punto de entrada principal |
| `backend/app.py` | Factory de Flask |
| `backend/core/config.py` | Configuración centralizada |
| `backend/core/db.py` | Conexión a BD |
| `frontend/src/context/i18n.jsx` | Sistema de traducciones |
| `frontend/src/index.css` | Variables CSS |

---

## Notas de Reestructuración (2025-12-05)

### Cambios Realizados
1. `backend_v2/` → `backend/` (nombre estándar)
2. `spm.db` → `data/spm.db` (separar datos de código)
3. Scripts de producción → `scripts/`
4. Configuración duplicada eliminada de raíz
5. Archivos basura eliminados (nul, estructura.txt)

### Imports Actualizados
- Todos los imports `from backend_v2` → `from backend`
- 100+ archivos actualizados automáticamente
- Verificado con pytest: 218/237 tests pasando

### Migración Excel → SQLite (2025-12-05)
- Archivos Excel de datos SAP movidos de `docs/` a `data/xlsx/`
- Convertidos a SQLite para mejor rendimiento y consultas
- **equivalentes.db**: 34,865 equivalencias de materiales
- **sap_data.db**: 178,338 registros (stock, consumo, pedidos)
- Script de reimportación: `scripts/migrate_excel_to_db.py`
