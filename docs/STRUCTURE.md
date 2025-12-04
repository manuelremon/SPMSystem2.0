# 🗂️ Estructura del Proyecto SPM

## 📊 Visión General

SPM está organizado en una estructura clara y modular que facilita el mantenimiento, escalabilidad y colaboración.

```
SPMv1.0/
├── 📁 src/                  # Código fuente principal
├── 📁 config/               # Configuraciones
├── 📁 database/             # Gestión de BD
├── 📁 docs/                 # Documentación
├── 📁 infrastructure/       # IaC y despliegue
├── 📁 scripts/              # Utilidades y scripts
├── 📁 tests/                # Suite de pruebas
├── 📁 .github/              # Configuración de GitHub
├── 🐳 Docker files
├── 📦 Archivos de configuración
└── 📚 Documentación
```

---

## 📦 Código Fuente (`src/`)

### Backend

```
src/backend/
├── app.py                   # 🚀 Punto de entrada principal de Flask
├── auth.py                  # 🔐 Autenticación y autorización
├── wsgi.py                  # 🌐 WSGI entry point (Gunicorn)
│
├── api/                     # 🔌 Endpoints de API
│   ├── __init__.py
│   └── v1/                  # Versionamiento de API
│
├── routes/                  # 🛣️ Rutas organizadas
│   ├── __init__.py
│   ├── solicitudes.py       # CRUD de solicitudes
│   ├── usuarios.py          # Gestión de usuarios
│   ├── materiales.py        # Gestión de materiales
│   ├── almacenes.py         # Gestión de almacenes
│   ├── reportes.py          # Endpoints de reportes
│   └── dashboard.py         # Datos del dashboard
│
├── models/                  # 📊 Modelos SQLAlchemy
│   ├── __init__.py
│   ├── usuario.py           # Modelo Usuario
│   ├── solicitud.py         # Modelo Solicitud
│   ├── material.py          # Modelo Material
│   ├── almacen.py           # Modelo Almacen
│   ├── estado.py            # Estados y enumeraciones
│   └── auditoria.py         # Logs de auditoría
│
├── services/                # 💼 Lógica de negocio
│   ├── __init__.py
│   ├── solicitud_service.py # Servicios de solicitudes
│   ├── usuario_service.py   # Servicios de usuarios
│   ├── material_service.py  # Servicios de materiales
│   ├── reportes_service.py  # Lógica de reportes
│   └── notificaciones.py    # Notificaciones
│
├── middleware/              # 🚀 Middleware personalizado
│   ├── __init__.py
│   ├── auth_middleware.py   # Verificación JWT
│   ├── logger_middleware.py # Logging
│   └── cors_middleware.py   # CORS configuration
│
├── core/                    # 🔌 Utilidades core
│   ├── __init__.py
│   ├── config.py            # Configuración centralizada
│   ├── database.py          # Inicialización de BD
│   ├── exceptions.py        # Excepciones personalizadas
│   ├── decorators.py        # Decoradores útiles
│   └── utils.py             # Funciones de utilidad
│
├── data/                    # 📥 Datos iniciales
│   ├── usuarios.csv
│   ├── materiales.csv
│   ├── almacenes.csv
│   └── init_db.py           # Script de inicialización
│
├── logs/                    # 📝 Logs de la aplicación
│   ├── app.log
│   ├── errors.log
│   └── access.log
│
├── uploads/                 # 📎 Archivos adjuntos
└── static/                  # 🎨 Archivos estáticos (CSS, JS minificado)
```

### Frontend

```
src/frontend/
├── index.html               # 🏠 Punto de entrada HTML
├── app.js                   # 🚀 Punto de entrada JavaScript
├── boot.js                  # 🔧 Inicialización de la app
├── styles.css               # 🎨 Estilos globales
│
├── components/              # 🧩 Componentes reutilizables
│   ├── header.js            # Header/Navbar
│   ├── sidebar.js           # Navegación lateral
│   ├── modal.js             # Modales genéricos
│   ├── toast.js             # Notificaciones
│   ├── table.js             # Tabla genérica
│   ├── form.js              # Validación de formularios
│   └── pagination.js        # Paginación
│
├── pages/                   # 📄 Páginas principales
│   ├── login.html
│   ├── home.html
│   ├── dashboard.html
│   ├── solicitudes/
│   │   ├── crear-solicitud.html
│   │   ├── mis-solicitudes.html
│   │   ├── equipo-solicitudes.html
│   │   └── admin-solicitudes.html
│   ├── materiales/
│   │   └── agregar-materiales.html
│   ├── usuarios/
│   │   └── admin-usuarios.html
│   ├── reportes/
│   │   ├── reportes.html
│   │   └── presupuesto.html
│   └── configuracion/
│       ├── admin-configuracion.html
│       └── preferencias.html
│
├── ui/                      # 🎭 Componentes UI
│   ├── buttons.css
│   ├── forms.css
│   ├── tables.css
│   ├── cards.css
│   └── utilities.css
│
├── utils/                   # 🛠️ Funciones de utilidad
│   ├── api.js               # Cliente HTTP
│   ├── storage.js           # LocalStorage helpers
│   ├── validators.js        # Validadores
│   ├── formatters.js        # Formateadores de datos
│   ├── dates.js             # Funciones de fechas
│   └── helpers.js           # Helpers generales
│
├── assets/                  # 🎨 Assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│
└── __tests__/               # ✅ Tests del frontend
    ├── unit/
    └── integration/
```

### Agente IA

```
src/agent/
├── __init__.py
├── ai_assistant.py          # 🤖 Asistente principal
├── models.py                # Modelos de IA
├── prompts.py               # Plantillas de prompts
├── ai_assistant.db          # BD de contexto
└── README.md                # Documentación del agente
```

---

## ⚙️ Configuración (`config/`)

```
config/
├── development.json         # Configuración desarrollo
├── production.json          # Configuración producción
├── testing.json             # Configuración testing
└── defaults.json            # Valores por defecto
```

---

## 🗄️ Base de Datos (`database/`)

```
database/
├── migrations/              # 🔄 Scripts de migración
│   ├── 001_initial_schema.sql
│   ├── 002_add_audit_tables.sql
│   └── README.md
│
├── seeds/                   # 🌱 Scripts de población
│   ├── initial_data.py
│   └── test_data.py
│
├── backups/                 # 💾 Copias de seguridad
└── spm.db                   # 📊 Base de datos SQLite
```

---

## 📚 Documentación (`docs/`)

```
docs/
├── README.md                # 📖 Índice de documentación
│
├── guides/                  # 📖 Guías
│   ├── GUIA_INICIO.md       # Para usuarios finales
│   ├── README-dev.md        # Para desarrolladores
│   ├── QUICK_START.md       # Configuración rápida
│   ├── QUICK_REFERENCE_BD.md
│   ├── IMPLEMENTACION_AGREGAR_MATERIALES.md
│   └── ...
│
├── api/                     # 🔌 Documentación API
│   ├── api.md               # Endpoints
│   ├── autenticacion.md     # JWT auth
│   ├── errores.md           # Códigos de error
│   └── ejemplos.md          # Ejemplos de uso
│
├── archive/                 # 📦 Documentación histórica
│   ├── legacy/              # Documentación antigua
│   └── sesiones/            # Documentación de sesiones pasadas
│
├── CHANGELOG.md             # 📝 Historial de versiones
├── STRUCTURE.md             # Este archivo
└── API_SPEC.md              # Especificación OpenAPI
```

---

## 🏗️ Infraestructura (`infrastructure/`)

```
infrastructure/
├── terraform/               # 🔨 Terraform
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars
│
└── docker/                  # 🐳 Docker
    ├── Dockerfile           # (en raíz también)
    └── docker-compose.yml   # (en raíz también)
```

---

## 🔨 Scripts (`scripts/`)

```
scripts/
├── utilities/               # 🛠️ Scripts de utilidad
│   ├── inspect_tables.py    # Inspeccionar BD
│   ├── check_schema.py      # Validar esquema
│   ├── generate_test_data.py
│   ├── seed_db.py           # Poblar BD
│   ├── verify_*.py          # Scripts de verificación
│   └── debug_*.py           # Scripts de debug
│
└── migrations/              # 🔄 Scripts de migración
    ├── migrate_data.py
    └── rollback.py
```

---

## ✅ Pruebas (`tests/`)

```
tests/
├── unit/                    # 🔬 Pruebas unitarias
│   ├── test_models.py
│   ├── test_services.py
│   ├── test_utils.py
│   └── test_validators.py
│
├── integration/             # 🔗 Pruebas de integración
│   ├── test_api_endpoints.py
│   ├── test_database.py
│   └── test_auth_flow.py
│
├── e2e/                     # 🚀 Pruebas end-to-end
│   ├── test_user_flow.py
│   ├── test_solicitud_flow.py
│   └── test_admin_flow.py
│
├── fixtures/                # 📦 Datos de prueba
│   ├── conftest.py
│   ├── users.json
│   └── solicitudes.json
│
└── __init__.py
```

---

## 📁 GitHub (`.github/`)

```
.github/
├── workflows/               # 🔄 CI/CD
│   ├── tests.yml            # Tests automáticos
│   ├── lint.yml             # Linting
│   └── deploy.yml           # Despliegue
│
└── copilot-instructions.md  # Instrucciones para Copilot
```

---

## 📦 Archivos de Configuración (Raíz)

| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Imagen de contenedor |
| `docker-compose.yml` | Orquestación de servicios |
| `package.json` | Dependencias Node.js |
| `requirements.txt` | Dependencias Python |
| `requirements-dev.txt` | Dependencias de desarrollo |
| `pyproject.toml` | Configuración de Python |
| `jest.config.js` | Configuración Jest |
| `vite.config.js` | Configuración Vite |
| `.env` | Variables de entorno |
| `.gitignore` | Archivos ignorados por Git |
| `.dockerignore` | Archivos ignorados por Docker |
| `README.md` | Documentación principal |

---

## 🔄 Flujo de Dependencias

```
Frontend (JS)
    ↓
    └─→ API REST (Flask)
            ↓
            ├─→ Models (SQLAlchemy)
            │   └─→ Database (SQLite)
            │
            ├─→ Services (Lógica)
            │   └─→ Models
            │
            └─→ Middleware (Seguridad)
                └─→ Auth Service
```

---

## 📊 Convenciones de Nombres

### Python
- **Archivos y carpetas:** `snake_case`
- **Clases:** `PascalCase`
- **Funciones/métodos:** `snake_case`
- **Constantes:** `UPPER_SNAKE_CASE`

### JavaScript
- **Archivos:** `kebab-case` (componentes), `camelCase` (funciones)
- **Carpetas:** `kebab-case`
- **Variables:** `camelCase`
- **Constantes:** `UPPER_SNAKE_CASE`
- **Clases:** `PascalCase`

### HTML/CSS
- **IDs:** `kebab-case` (ej: `main-container`)
- **Classes:** `kebab-case` (ej: `btn-primary`)

---

## 🔐 Seguridad

- ✅ Archivos sensibles en `.gitignore`
- ✅ Variables de entorno en `.env`
- ✅ Logs en carpeta específica
- ✅ Uploads en carpeta controlada
- ✅ Backups de BD en carpeta separada

---

## 📈 Escalabilidad

La estructura permite:
- ✅ Agregar nuevos endpoints en `src/backend/routes/`
- ✅ Agregar nuevas páginas en `src/frontend/pages/`
- ✅ Extender servicios en `src/backend/services/`
- ✅ Agregar tests sin quebrar la estructura
- ✅ Migrar a diferentes BD sin cambiar la estructura

---

## 🎯 Principios de Organización

1. **Separación de responsabilidades:** Frontend, backend, base de datos
2. **Modularidad:** Componentes y servicios independientes
3. **Escalabilidad:** Fácil agregar nuevas funcionalidades
4. **Mantenibilidad:** Código organizado y documentado
5. **Testing:** Pruebas en la misma estructura
6. **Documentación:** Docs centralizados en `/docs`

---

**Última actualización:** Octubre 2025
**Versión:** 1.0

## 📂 Directorio: `config/`
Almacena todas las configuraciones de la aplicación.

```
config/
├── render.yaml              # Configuración de Render deployment
├── .editorconfig            # Configuración del editor
└── devcontainer.json        # Configuración de Dev Container
```

---

## 📂 Directorio: `database/`
Gestión completa de la base de datos.

```
database/
├── migrations/              # Scripts SQL de migraciones
│   ├── 2025-10-05_usuarios.sql
│   ├── 2025-10-06_users.sql
│   ├── 2025-10-07_profile.sql
│   ├── 2025-10-08_uploads.sql
│   └── 2025-10-09_uploads_indexes.sql
├── schemas/                 # Esquemas SQL y definiciones
│   ├── refactored_schema.sql
│   └── schema_refactor.sql
├── fixes/                   # Parches y correcciones
│   └── migration_normalize_almacenes.sql
├── backup/                  # Backups de la base de datos
│   └── spm.db.bak
└── audit/                   # Reportes de auditoría
    ├── report.md
    ├── findings.json
    ├── fixes.sql
    └── indexes.sql
```

---

## 📂 Directorio: `scripts/`
Scripts de desarrollo, utilidad y base de datos.

```
scripts/
├── dev/                     # Scripts de desarrollo
│   ├── run-dev.ps1          # Ejecutar modo desarrollo (PowerShell)
│   ├── run-dev-two-servers.ps1  # Ejecutar con Flask + Vite
│   └── init-env.ps1         # Inicializar entorno
├── db/                      # Scripts de base de datos
│   ├── check_db.py          # Verificar estado de BD
│   ├── update_db.py         # Actualizar BD
│   └── create_or_reset_user.py  # Gestión de usuarios
└── utils/                   # Utilidades generales
    ├── move_artifacts.py
    ├── update_aprobadores.py
    ├── repair_imports.py
    └── ai_query.py
```

---

## 📂 Directorio: `src/`
Código fuente de la aplicación, separado en backend, frontend y módulos IA.

### `src/backend/`
Aplicación Flask y lógica de negocio.

```
src/backend/
├── app.py                   # Punto de entrada principal
├── wsgi.py                  # WSGI para producción
├── core/                    # Configuración central
│   ├── config.py
│   ├── init_db.py
│   └── db.py
├── api/                     # Rutas y endpoints
│   ├── __init__.py
│   └── routes/              # Agrupadas por módulo
├── middleware/              # Middlewares (auth, CSRF, rate limiting)
│   ├── auth_helpers.py
│   ├── csrf.py
│   ├── ratelimit.py
│   └── decorators.py
├── models/                  # Esquemas y definiciones
│   ├── schemas.py
│   ├── catalog_schema.py
│   └── roles.py
├── services/                # Lógica de negocio
│   ├── ai_service.py
│   ├── health.py
│   ├── token_store.py
│   ├── auth/
│   │   ├── jwt_utils.py
│   │   └── token_store.py
│   ├── uploads/
│   │   ├── files.py
│   │   ├── file_utils.py
│   │   └── export_solicitudes.py
│   └── db/
│       ├── paging.py
│       └── security.py
├── data/                    # Datos de aplicación
├── logs/                    # Archivos de log
├── uploads/                 # Archivos subidos por usuarios
└── __pycache__/
```

### `src/frontend/`
Aplicación web (HTML + JavaScript + CSS).

```
src/frontend/
├── index.html               # Entrada principal
├── styles.css               # Estilos globales
├── boot.js                  # Inicialización
├── pages/                   # Páginas principales
│   ├── home.html
│   ├── login.html
│   ├── admin/               # Páginas administrativas
│   │   ├── dashboard.html
│   │   ├── usuarios.html
│   │   ├── materiales.html
│   │   ├── configuracion.html
│   │   ├── reportes.html
│   │   ├── almacenes.html
│   │   ├── centros.html
│   │   └── solicitudes.html
│   └── user/                # Páginas de usuario
│       ├── mi-cuenta.html
│       ├── mis-solicitudes.html
│       ├── planificador.html
│       ├── crear-solicitud.html
│       ├── equipo-solicitudes.html
│       ├── preferencias.html
│       ├── presupuesto.html
│       ├── reportes.html
│       ├── notificaciones.html
│       ├── ai-console.html
│       └── uploads.html
├── components/              # Componentes reutilizables
│   ├── auth/
│   │   ├── auth_guard.js
│   │   └── auth_roles.js
│   └── ui/
├── utils/                   # Utilidades
│   ├── api.js               # Cliente HTTP
│   ├── api_client.js        # Alternativo/legacy
│   └── auth.js              # Utilidades de autenticación
├── assets/                  # Imágenes, iconos, etc.
├── __tests__/               # Tests del frontend
│   └── login.ui.test.js
└── ui/                      # Componentes UI
```

### `src/agent/`
Módulo de agente IA (independiente).

```
src/agent/
├── main.py                  # Punto de entrada
├── llm.py                   # Integración LLM
├── models.py                # Modelos de datos
├── catalog.py               # Catálogo de funciones
├── rules.py                 # Reglas de negocio
└── test.http                # Tests HTTP
```

### `src/ai_assistant/`
Módulo de asistente IA (embeddings, indexación).

```
src/ai_assistant/
├── __init__.py
├── api.py                   # API del asistente
├── embeddings.py            # Generación de embeddings
├── indexer.py               # Indexación de documentos
├── prompts.py               # Plantillas de prompts
├── retriever.py             # Recuperación de información
└── store.py                 # Almacenamiento
```

---

## 📂 Directorio: `tests/`
Tests de integración organizados por categoría.

```
tests/
├── api/                     # Tests de endpoints HTTP
│   ├── test_health.py
│   ├── test_uploads.py
│   ├── test_uploads_paging.py
│   ├── test_profile.py
│   ├── test_me_logout.py
│   └── test_csrf_ratelimit.py
├── auth/                    # Tests de autenticación
│   ├── test_jwt_utils.py
│   ├── test_auth_helper.py
│   └── test_roles.py
├── integration/             # Tests de integración
│   ├── conftest.py
│   ├── auth_utils.py
│   ├── test_upload_errors.py
│   └── test_ai_assistant.py
├── ui/                      # Tests del frontend
│   ├── login.ui.test.js
│   ├── setup-jest.js
│   └── test_login_smoke.js
└── [archivos de configuración]
```

---

## 📂 Directorio: `docs/`
Documentación del proyecto.

```
docs/
├── ai/                      # Integraciones de asistentes y LLMs
├── guides/                  # Guías operativas y quick starts
├── history/                 # Bitácoras y registros históricos
│   ├── audits/              # Auditorías y verificaciones
│   ├── backups/             # Respaldos puntuales
│   ├── commits/             # Resúmenes de sesiones de commit
│   ├── iterations/          # Cierres por iteración
│   ├── refactors/           # Planes y validaciones de refactor
│   └── sessions/            # Cronologías y resúmenes diarios
├── infrastructure/          # Notas de despliegue e infraestructura
├── planning/                # Planificación por fases
├── reference/               # Referencias rápidas (colors, diseños)
│   └── ui/                  # Material visual y paletas
├── reports/                 # Entregables ejecutivos y auditorías
├── system/                  # Estado del sistema y reparaciones
└── testing/                 # Manuales y reportes de pruebas
    └── reports/             # Resultados detallados de runs
```

---

## 📂 Directorio: `infrastructure/`
Recursos de infraestructura como código.

```
infrastructure/
└── terraform/               # Módulos Terraform para despliegues
    ├── deploy/
    └── nginx/
```

---

## 📂 Directorio: `docs/archive/`
Documentación histórica conservada como referencia.

```
docs/archive/
├── legacy/                  # Artefactos previos a la reestructura
├── form-intelligence-v2/    # Iteraciones de inteligencia de formularios
└── *.md / *.txt             # Resúmenes y reportes cerrados
```

---

## 📄 Archivos en la Raíz

| Archivo | Propósito |
|---------|-----------|
| `README.md` | Documentación principal |
| `README-dev.md` | Guía de desarrollo local |
| `docker-compose.yml` | Orquestación de contenedores |
| `Dockerfile` | Imagen Docker de la aplicación |
| `package.json` | Dependencias Node/frontend |
| `pyproject.toml` | Configuración Python/Poetry |
| `jest.config.js` | Configuración de Jest (testing) |
| `vite.config.js` | Configuración de Vite (bundler) |
| `wsgi.py` | Entry point WSGI para producción |
| `.env` | Variables de entorno (no subir a git) |
| `.gitignore` | Archivos ignorados por git |
| `.dockerignore` | Archivos ignorados en Docker build |

---

## 🔄 Migrando desde la estructura antigua

Si tenías archivos en la estructura anterior, aquí está el mapeo:

| Anterior | Nuevo |
|----------|-------|
| `*.ps1`, `*.bat` en raíz | `scripts/dev/` |
| `*.sql` en raíz | `database/schemas/` o `database/fixes/` |
| `migrations/` | `database/migrations/` |
| `db_audit/` | `database/audit/` |
| `db_backup/` | `database/backup/` |
| `routes/` en backend | `src/backend/api/routes/` |
| `.html` en frontend raíz | `src/frontend/pages/` |
| `.js` utilitarios | `src/frontend/utils/` |
| Tests de auth | `tests/auth/` |
| Tests de API | `tests/api/` |

---

## ✅ Ventajas de esta estructura

✓ **Claridad**: Cada archivo tiene un lugar lógico
✓ **Escalabilidad**: Fácil agregar nuevos módulos
✓ **Separación de concerns**: Frontend, backend, tests bien definidos
✓ **Mantenibilidad**: Código más organizado y fácil de navegar
✓ **CI/CD friendly**: Estructura estándar para pipelines
✓ **Documentación**: Estructura auto-documentada

---

## 📝 Notas

- La carpeta `archive/` es para archivos históricos. **No subir a production**.
- Los scripts en `scripts/` deben tener permisos de ejecución: `chmod +x scripts/dev/*.ps1`
- Actualizar imports en los archivos de código según las nuevas rutas.
- Las variables de entorno van en `.env` (no subir a git, ver `.gitignore`).

---

**Última actualización**: 26 de octubre de 2025
**Estructura versión**: 1.0
