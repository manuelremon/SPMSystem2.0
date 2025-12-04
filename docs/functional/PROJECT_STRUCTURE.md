# 📁 SPMv1.0 - Estructura del Proyecto

**Versión:** 2.0 (Clean)
**Última actualización:** 2025-11-20
**Estado:** ✅ Producción

---

## 🗂️ Estructura Principal

```
SPMv1.0/
├── src/                          # Código fuente principal
│   ├── backend/                  # Backend Flask
│   ├── frontend/                 # Frontend Vite + JS
│   ├── planner/                  # Módulo de planificación
│   ├── agent/                    # Agentes IA
│   └── ai_assistant/             # Asistente IA
│
├── database/                     # Esquemas y migraciones DB
├── docs/                         # Documentación
├── scripts/                      # Scripts de utilidad
├── tests/                        # Tests automatizados
├── config/                       # Configuración
└── infrastructure/               # Docker, deploy, etc.
```

---

## 🔧 Backend (`src/backend/`)

```
src/backend/
├── app.py                        # ⭐ Aplicación Flask principal
├── core/                         # Núcleo del sistema
│   ├── config.py                 # ✅ Configuración (JWT_SECRET, etc.)
│   ├── db.py                     # ✅ Conexión DB
│   ├── init_db.py                # Inicialización DB
│   └── data/
│       ├── spm.db                # Base de datos SQLite
│       ├── Usuarios.csv          # Datos iniciales
│       ├── Materiales.csv
│       └── Presupuestos.csv
│
├── routes/                       # ⭐ Rutas API (16 blueprints)
│   ├── auth_routes.py            # ✅ Autenticación
│   ├── solicitudes.py            # ✅ Solicitudes (principal)
│   ├── materiales.py             # ✅ Catálogo materiales
│   ├── admin.py                  # ✅ Panel admin
│   ├── usuarios.py               # ✅ Gestión usuarios
│   ├── presupuestos.py           # ✅ Presupuestos
│   ├── notificaciones.py         # ✅ Notificaciones
│   ├── planner_routes.py         # ✅ Planificador
│   ├── form_intelligence_routes_v2.py  # ✅ IA v2
│   ├── catalogos.py              # ✅ Catálogos
│   ├── preferences.py            # ✅ Preferencias
│   ├── abastecimiento.py         # ✅ Abastecimiento
│   ├── archivos.py               # ✅ Archivos
│   ├── chatbot.py                # ✅ Chatbot
│   ├── solicitudes_archivos.py   # ✅ Adjuntos
│   └── planificador.py           # ✅ Planificador alt
│
├── services/                     # Servicios de negocio
│   ├── auth/                     # JWT, autenticación
│   ├── dashboard/                # Estadísticas
│   ├── db/                       # Operaciones DB
│   ├── form_intelligence_v2.py   # ✅ IA v2 (activa)
│   ├── ollama_llm.py             # ✅ Ollama LLM
│   ├── data_providers.py         # ✅ Proveedores Excel
│   └── ai_service.py             # Servicio IA
│
├── models/                       # Modelos de datos
│   ├── schemas.py                # ⭐ Esquemas Pydantic
│   ├── roles.py                  # Roles de usuario
│   └── catalog_schema.py         # Esquemas catálogos
│
├── middleware/                   # Middlewares
├── static/                       # Archivos estáticos
└── uploads/                      # Archivos subidos
```

---

## 🎨 Frontend (`src/frontend/`)

```
src/frontend/
├── index.html                    # ⭐ Página login (ÚNICA)
├── home.html                     # Dashboard principal
├── app.js                        # ⭐ Lógica principal (3900+ líneas)
├── boot.js                       # ✅ Autenticación y login
├── styles.css                    # Estilos principales
│
├── [Páginas HTML]
├── dashboard.html                # Dashboard
├── solicitudes.html              # Listar solicitudes
├── nueva-solicitud.html          # Crear solicitud
├── materiales.html               # Catálogo materiales
├── admin-*.html                  # Paneles admin (9 archivos)
├── planificador.html             # Planificador
├── reportes.html                 # Reportes
├── ai-console.html               # Consola IA
├── preferencias.html             # Preferencias usuario
├── mi-cuenta.html                # Perfil usuario
├── notificaciones.html           # Notificaciones
├── presupuesto.html              # Presupuestos
└── ... (30+ páginas HTML)
│
├── components/                   # Componentes reutilizables
│   ├── auth/
│   │   ├── auth_guard.js         # ✅ Guardia autenticación
│   │   └── auth_roles.js         # ✅ Control de roles
│   ├── shared-scripts.js         # Scripts compartidos
│   └── navbar.html               # Barra navegación
│
├── pages/                        # Páginas complejas
├── modules/                      # Módulos JS
├── utils/                        # Utilidades
│   ├── api.js                    # ⭐ ✅ API client (window.API + AuthAPI)
│   └── api_client.js             # Cliente API alt
│
├── ui/                           # Componentes UI
├── assets/                       # Recursos (iconos, imágenes)
├── planificador.js               # ⭐ ✅ Planificador v2 (novo)
└── __tests__/                    # Tests frontend
```

---

## 🗄️ Database (`database/`)

```
database/
├── schemas/                      # Esquemas SQL
├── migrations/                   # Migraciones
├── audit/                        # Auditoría
├── backup/                       # Backups
└── fixes/                        # Fixes SQL
```

---

## 📚 Documentación (`docs/`)

```
docs/
├── 00_COMIENZA_AQUI.md          # ⭐ Punto de entrada
├── ARCHITECTURE.md               # Arquitectura
├── api.md                        # API REST docs
├── QUICK_START.txt               # Inicio rápido
├── guides/                       # Guías
│   ├── QUICK_REFERENCE_BD.md    # Queries útiles
│   └── IMPLEMENTACION_*.md      # Guías implementación
└── ... (otros documentos)
```

---

## 🔧 Scripts (`scripts/`)

```
scripts/
├── dev/                          # Scripts desarrollo
│   ├── run_backend_improved.py   # ✅ Ejecutar backend
│   ├── run_dev_server.py         # Dev server
│   ├── start_backend.py          # Iniciar backend
│   └── start_server.py           # Iniciar servidor
│
├── db/                           # Operaciones BD
│   ├── init_db.py                # Inicializar BD
│   ├── create_test_data.py       # Crear datos test
│   ├── check_db.py               # Verificar BD
│   └── db_audit.py               # Auditoría BD
│
├── utilities/                    # Utilidades
│   ├── generate_test_data_fixed.py  # ✅ Generar datos
│   ├── check_users_schema.py    # Verificar usuarios
│   ├── populate_complete_db.py   # Poblar BD
│   └── ... (30+ utilidades)
│
├── tests/                        # Scripts de testing
│   ├── run_validations.py        # Ejecutar validaciones
│   └── phase5/                   # Tests fase 5
│
├── migrations/                   # Migraciones
├── repair/                       # Scripts reparación
├── utils/                        # Utils varios
│
└── archive/                      # ⭐ Scripts archivados
    ├── README.md                 # ✅ Documentación archive
    ├── repair/                   # Fixes de imports (ya aplicados)
    ├── utilities/                # Debug utilities (ya usados)
    └── utils/                    # Repair scripts (ya aplicados)
```

---

## 🧪 Tests (`tests/`)

```
tests/
├── test_create_solicitud.py      # Test solicitudes
├── test_stats_improved.py        # ✅ Test stats (mejor versión)
├── manual/                       # Tests manuales
│   └── check_users2.py           # ✅ Verificar usuarios v2
└── ... (otros tests)
```

---

## 📦 Módulos Especializados

### Planificador (`src/planner/`)
```
src/planner/
├── algorithms/                   # Algoritmos optimización
├── models/                       # Modelos planificación
├── scoring/                      # Sistema puntuación
├── optimization/                 # Optimizaciones
├── rules/                        # Reglas negocio
└── README_MODELS.md              # Docs modelos
```

### Agentes IA (`src/agent/`)
```
src/agent/
├── catalog.py                    # Catálogo agentes
├── llm.py                        # Integración LLM
├── models.py                     # Modelos agentes
└── rules.py                      # Reglas agentes
```

---

## 📄 Archivos Raíz

```
SPMv1.0/
├── CLAUDE.md                     # ⭐ Guía completa del codebase
├── PROJECT_STRUCTURE.md          # ⭐ Este archivo
├── README.md                     # README principal
├── DEPLOYMENT.md                 # Guía deployment
├── CONTRIBUTING.md               # Guía contribución
│
├── package.json                  # Dependencias Node.js
├── requirements.txt              # ✅ Dependencias Python
├── requirements-dev.txt          # Deps desarrollo
├── pyproject.toml                # Config Python
│
├── vite.config.js                # Config Vite
├── jest.config.js                # Config Jest
├── docker-compose.yml            # Docker compose
├── Dockerfile                    # Dockerfile
│
├── wsgi.py                       # ⭐ Entry point WSGI
├── run_backend.py                # Script backend
├── cleanup_project.py            # ✅ Script limpieza
│
├── .env.example                  # Ejemplo variables entorno
├── .gitignore                    # Git ignore
└── LICENSE                       # Licencia
```

---

## 🚀 Flujo de Ejecución

### Desarrollo
```bash
# Terminal 1 - Backend
python wsgi.py                    # Puerto 5000

# Terminal 2 - Frontend
npm run dev                       # Puerto 5173
```

### Producción
```bash
# Build frontend
npm run build

# Ejecutar con gunicorn
gunicorn -c gunicorn_config.py wsgi:app
```

---

## ✅ Estado de Limpieza

### Eliminado ✅
- ❌ Archivos legacy v1 (form_intelligence.py, routes)
- ❌ Archivos backup (*.backup-*, *.backup4)
- ❌ Login duplicado (login.html → usa index.html)
- ❌ Tests v1 legacy
- ❌ __pycache__ y .pyc
- ❌ Scripts obsoletos (11 archivados)

### Archivado ✅
- 📦 Scripts de reparación de imports (ya aplicados)
- 📦 Scripts de debug one-time-use
- 📦 Scripts de fix específicos (ya ejecutados)

### Activo ✅
- ✅ form_intelligence_v2.py (IA v2)
- ✅ form_intelligence_routes_v2.py (rutas v2)
- ✅ planificador.js (v2 - antes "novo")
- ✅ 16 blueprints registrados
- ✅ window.API + window.AuthAPI (unificados)
- ✅ index.html como ÚNICA página login

---

## 📊 Estadísticas

```
Backend:
- Blueprints: 16 activos
- Rutas: ~80 endpoints
- Servicios: 20+ servicios
- Modelos: 15+ schemas Pydantic

Frontend:
- Páginas HTML: 40+
- Componentes JS: 10+
- Líneas de código: ~15,000
- Sin duplicados ✅

Database:
- Tablas: 15+
- Materiales: 10,000+
- Usuarios iniciales: 100+

Scripts:
- Activos: 45+
- Archivados: 11
- De desarrollo: 15+
```

---

## 🔍 Archivos Importantes

### Backend ⭐
1. `src/backend/app.py` - Aplicación Flask principal
2. `src/backend/core/config.py` - Configuración (JWT_SECRET)
3. `src/backend/routes/solicitudes.py` - Lógica solicitudes
4. `src/backend/services/form_intelligence_v2.py` - IA v2

### Frontend ⭐
1. `src/frontend/index.html` - Login page (ÚNICA)
2. `src/frontend/app.js` - Lógica principal (3900+ líneas)
3. `src/frontend/boot.js` - Auth check y login
4. `src/frontend/utils/api.js` - API client unificado

### Documentación ⭐
1. `CLAUDE.md` - Guía completa del codebase
2. `PROJECT_STRUCTURE.md` - Este archivo
3. `docs/00_COMIENZA_AQUI.md` - Documentación inicial

---

**Última revisión:** 2025-11-20
**Versión:** 2.0 (Clean & Perfect)
**Mantenido por:** Development Team
