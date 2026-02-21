# Arquitectura de Carpetas - SPMv2.0

**Ultima actualizacion:** 2026-01-19
**Version:** 2.1

---

## Estructura de Directorios

```
SPMv2.0/
├── backend/                    # API Flask (165 archivos, ~65K lineas)
│   ├── core/                   # Configuracion, DB, Auth, Middleware (31 modulos)
│   │   ├── config.py           # Configuracion centralizada (Pydantic)
│   │   ├── db.py               # Conexion SQLite/PostgreSQL
│   │   ├── auth_middleware.py  # JWT + decoradores de auth
│   │   ├── csrf.py             # Proteccion CSRF
│   │   ├── cors.py             # CORS con soporte regex/wildcards
│   │   ├── spa.py              # Servir frontend React SPA
│   │   ├── blueprints.py       # Registro centralizado de blueprints
│   │   ├── security_headers.py # Headers de seguridad OWASP
│   │   └── repository_legacy.py # Data access layer
│   │
│   ├── routes/                 # Blueprints Flask (28 modulos)
│   │   ├── auth.py             # Login, registro, refresh token
│   │   ├── solicitudes.py      # CRUD de solicitudes
│   │   ├── materiales.py       # Busqueda de materiales SAP
│   │   ├── planner.py          # Planificacion de solicitudes
│   │   ├── admin.py            # Administracion de usuarios
│   │   ├── admin_import.py     # Importacion masiva de datos
│   │   ├── budget.py           # Gestion presupuestaria (BUR)
│   │   ├── vertex_ia.py        # Integracion Vertex AI
│   │   ├── procurement.py      # Gestion de compras
│   │   ├── database.py         # Admin de base de datos
│   │   └── ...                 # 18 modulos adicionales
│   │
│   ├── services/               # Logica de negocio (11 servicios)
│   │   ├── ai_service.py       # Orchestrador ML
│   │   ├── mrp_service.py      # Motor MRP
│   │   ├── budget_service.py   # Calculos presupuestarios
│   │   └── ...
│   │
│   ├── agent/                  # Modulo ML/IA (35+ archivos)
│   │   ├── core/               # Agente ReAct principal
│   │   ├── tools/              # Herramientas del agente
│   │   ├── pipelines/          # Pipelines ML (clustering, forecast)
│   │   └── rag/                # Retrieval Augmented Generation
│   │
│   ├── migrations/             # Migraciones SQL
│   └── app.py                  # Factory de aplicacion Flask
│
├── frontend/                   # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/              # Componentes de pagina (75)
│   │   ├── components/         # Componentes UI (80)
│   │   │   └── ui/             # Sistema de diseno
│   │   ├── context/            # Providers (Auth, i18n)
│   │   ├── hooks/              # Custom hooks (12)
│   │   ├── services/           # API clients (11)
│   │   ├── store/              # Zustand stores (3)
│   │   └── utils/              # Utilidades
│   │
│   ├── public/                 # Assets estaticos
│   ├── dist/                   # Build de produccion
│   └── package.json
│
├── tests/                      # Tests (1,220+ en 55 archivos)
│   ├── unit/                   # Tests unitarios Python
│   ├── integration/            # Tests de integracion
│   └── e2e/                    # Tests end-to-end
│
├── scripts/                    # Scripts de utilidad
│   └── INICIAR_SPM.bat         # Script de inicio Windows
│
├── data/                       # Bases de datos SQLite
│   ├── spm.db                  # BD transaccional
│   ├── equivalentes.db         # Equivalencias de materiales
│   └── sap_data.db             # Datos SAP
│
├── docs/                       # Documentacion
│   └── guides/                 # Guias de uso
│
├── wsgi.py                     # Punto de entrada del servidor
└── AGENTS.md                   # Configuracion de agentes
```

---

## Decisiones de Arquitectura

### 1. Separación Backend/Frontend
- **Backend**: Flask API en puerto 5000
- **Frontend**: React SPA en puerto 5173 (dev) / servido por Flask (prod)
- **Comunicación**: REST API con JWT + CSRF

### 2. Bases de Datos

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | BD transaccional (usuarios, solicitudes, auth) | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos SAP | 178,338 |
| PostgreSQL (prod) | BD de produccion en Cloud Run | - |

- **Motor desarrollo**: SQLite
- **Motor produccion**: PostgreSQL
- **Migraciones**: Scripts SQL en `backend/migrations/`

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

## Historial de Cambios

- **2026-01-19**: Refactoring app.py (extraer CORS, SPA, blueprints a modulos core)
- **2026-01-19**: Limpieza de codigo muerto (dark mode, scripts obsoletos)
- **2026-01-10**: Integracion Vertex AI, modulo RAG, PostgreSQL en produccion
- **2025-12-05**: Reestructuracion inicial de carpetas
