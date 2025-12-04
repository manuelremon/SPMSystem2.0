# 📚 DOCUMENTATION_INDEX.md - Índice de Documentación

## 🎯 ¿Por dónde empezar?

Dependiendo de tu necesidad, aquí está la guía:

### 🏃 Quiero empezar RÁPIDO
1. Lee: `QUICK_START.txt`
2. Lee: `QUICK_DEV_REFERENCE.md` (este archivo tiene lo esencial)
3. Ejecuta: `npm run dev` + `python wsgi.py`
4. Navega a: `http://localhost:5173`

### 📖 Quiero entender la ARQUITECTURA
1. Lee: `CLAUDE.md` → Sección "Arquitectura General"
2. Lee: `ARCHITECTURE.md`
3. Diagrama mental: Backend (5000) ← API → Frontend (5173) ← BD SQLite

### 💻 Quiero DESARROLLAR una nueva funcionalidad
1. Lee: `QUICK_DEV_REFERENCE.md` → "Tareas Comunes"
2. Consulta: `CLAUDE.md` → "Backend (Flask)" o "Frontend (Vite)"
3. Busca código en el editor
4. Copia patrón similar

### 🐛 Tengo un ERROR
1. Consulta: `QUICK_DEV_REFERENCE.md` → "Errores Comunes y Soluciones"
2. Revisa: Logs en `src/backend/core/logs/app.log`
3. Revisa: DevTools del navegador (F12)
4. Consulta: `CLAUDE.md` → "Flujos Clave"

### 🗄️ Quiero entender la BASE DE DATOS
1. Lee: `CLAUDE.md` → "Base de Datos"
2. Consulta: `docs/guides/QUICK_REFERENCE_BD.md`
3. Abre: `src/backend/core/data/spm.db` con SQLite
4. Ejecuta queries útiles

### 🚀 Quiero DEPLOYAR
1. Lee: `DEPLOYMENT.md`
2. Consulta: `docs/guides/` para step-by-step
3. Sigue instrucciones en Render/Docker

### 🤖 Quiero entender el MÓDULO DE PLANIFICACIÓN
1. Lee: `CLAUDE.md` → "Módulos Especializados"
2. Revisa: `src/planner/README_MODELS.md`
3. Explora: Carpetas en `src/planner/`

### 🧠 Quiero entender CÓMO FUNCIONA EL SISTEMA COMPLETO
1. Lee: `CLAUDE.md` completamente
2. Luego: `ARCHITECTURE.md`
3. Luego: `docs/guides/IMPLEMENTACION_*.md` (específicos)

---

## 📁 Estructura de Documentación

```
docs/
├── 📘 CLAUDE.md ★★★ EMPEZAR AQUÍ
│   └── Análisis completo del codebase (40 KB)
│
├── 📗 QUICK_DEV_REFERENCE.md ★★ CONSULTAS RÁPIDAS
│   └── Respuestas rápidas a preguntas frecuentes
│
├── 📕 DOCUMENTATION_INDEX.md (este archivo)
│   └── Orientación en la documentación
│
├── 📙 README.md
│   └── Descripción general del proyecto
│
├── 📓 ARCHITECTURE.md
│   └── Arquitectura detallada
│
├── 📔 api.md
│   └── Referencia completa de API REST
│
├── 📓 DEPLOYMENT.md
│   └── Guía de deployment a producción
│
└── guides/
    ├── 📗 QUICK_REFERENCE_BD.md
    │   └── Queries SQL útiles
    │
    ├── 📘 QUICK_START.txt
    │   └── Inicio rápido (5 minutos)
    │
    ├── 📕 IMPLEMENTACION_*.md (múltiples)
    │   └── Guías de features específicos
    │
    └── [otros guides]
```

---

## 🔍 Búsqueda por Tema

### 🔐 Autenticación & Seguridad
- **Archivo:** `src/backend/services/auth/jwt_utils.py`
- **Documentación:** `CLAUDE.md` → "Backend" → "Rutas Principales" → "Autenticación"
- **Query:** "JWT", "token", "verify_token"

### 📋 Solicitudes (CRUD)
- **Archivo:** `src/backend/routes/solicitudes.py`
- **Documentación:** `CLAUDE.md` → "Backend" → "Rutas Principales" → "Solicitudes"
- **Query:** "solicitud", "crear_solicitud", "SolicitudCreate"

### 🏪 Materiales & Búsqueda
- **Archivo:** `src/backend/routes/materiales.py`
- **Documentación:** `CLAUDE.md` → "Backend" → "Rutas Principales" → "Materiales"
- **Query:** "materiales", "search_materiales", "MaterialSearchQuery"

### 📊 Dashboard & Reportes
- **Archivo:** `src/backend/routes/admin.py`, `src/backend/services/dashboard/`
- **Documentación:** `CLAUDE.md` → "Backend" → "Servicios"
- **Query:** "dashboard", "stats", "reportes"

### ⚙️ Administración
- **Archivo:** `src/backend/routes/admin.py`
- **Documentación:** `CLAUDE.md` → "Backend" → "Rutas Principales" → "Administración"
- **Query:** "admin", "usuarios", "materiales admin"

### 📅 Planificación
- **Archivo:** `src/backend/routes/planner_routes.py`, `src/planner/`
- **Documentación:** `CLAUDE.md` → "Módulos Especializados" → "Planificador"
- **Query:** "planner", "optimize", "planificacion"

### 🤖 IA & Agentes
- **Archivo:** `src/agent/`, `src/ai_assistant/`
- **Documentación:** `CLAUDE.md` → "Módulos Especializados"
- **Query:** "agent", "llm", "ai", "claude"

### 💾 Base de Datos
- **Archivo:** `src/backend/core/init_db.py`, `src/backend/core/db.py`
- **Documentación:** `CLAUDE.md` → "Base de Datos"
- **Query:** "sqlite", "usuarios", "solicitudes", "materiales"

### 🎨 Frontend & UI
- **Archivo:** `src/frontend/app.js`, `src/frontend/*.html`, `src/frontend/styles.css`
- **Documentación:** `CLAUDE.md` → "Frontend (Vite + JavaScript)"
- **Query:** "app.js", "html", "styles", "frontend"

### ⚡ Vite & Build
- **Archivo:** `vite.config.js`, `package.json`
- **Documentación:** `CLAUDE.md` → "Frontend" → "Configuración"
- **Query:** "vite", "build", "npm"

### 🔧 Configuración
- **Archivo:** `src/backend/core/config.py`, `.env`
- **Documentación:** `CLAUDE.md` → "Configuración y Entorno"
- **Query:** "config", "environment", ".env"

---

## 📚 Por Tipo de Desarrollador

### Backend Developer (Python/Flask)
**Lee en este orden:**
1. `QUICK_DEV_REFERENCE.md` (referencia rápida)
2. `CLAUDE.md` → "Backend (Flask)"
3. `src/backend/models/schemas.py` (esquemas)
4. `src/backend/routes/solicitudes.py` (ejemplo de ruta compleja)
5. `ARCHITECTURE.md` (flujos completos)

### Frontend Developer (JavaScript/HTML/CSS)
**Lee en este orden:**
1. `QUICK_DEV_REFERENCE.md` (referencia rápida)
2. `CLAUDE.md` → "Frontend (Vite + JavaScript)"
3. `src/frontend/app.js` (lógica principal)
4. `src/frontend/styles.css` (estilos)
5. `src/frontend/nueva-solicitud.html` (ejemplo de página compleja)

### Full Stack Developer
**Lee en este orden:**
1. `QUICK_START.txt` (5 minutos)
2. `CLAUDE.md` completamente
3. `ARCHITECTURE.md` (ver flujos end-to-end)
4. `QUICK_DEV_REFERENCE.md` (guardar para consultas)

### DevOps / Infrastructure
**Lee en este orden:**
1. `DEPLOYMENT.md` (principal)
2. `docker-compose.yml` y `Dockerfile`
3. `config/` (configuración)
4. `requirements.txt` y `package.json`

### Data Analyst
**Lee en este orden:**
1. `CLAUDE.md` → "Base de Datos"
2. `docs/guides/QUICK_REFERENCE_BD.md` (queries útiles)
3. Acceso directo a `spm.db`
4. `src/backend/routes/admin.py` (reportes)

---

## 🆘 Ayuda Rápida

### "¿Dónde está X?"
→ Usa `QUICK_DEV_REFERENCE.md` → "Encontrar Cosas"

### "¿Cómo hago Y?"
→ Usa `QUICK_DEV_REFERENCE.md` → "Tareas Comunes"

### "¿Por qué da error Z?"
→ Usa `QUICK_DEV_REFERENCE.md` → "Errores Comunes"

### "Necesito ejemplos de código"
→ Ve a `src/backend/routes/` o `src/frontend/*.html`

### "Necesito ver la arquitectura"
→ Lee `ARCHITECTURE.md` + `CLAUDE.md` → "Arquitectura General"

### "Quiero contribuir"
→ Lee `CONTRIBUTING.md`

---

## 📊 Estadísticas del Proyecto

```
Codebase SPM v1.0

Backend (Python/Flask):
  - 19 rutas/blueprints
  - 30+ endpoints API
  - 9 tablas de BD
  - 2,000+ líneas de código Python

Frontend (Vite + JavaScript):
  - 30+ páginas HTML
  - 1 archivo app.js (3,900+ líneas)
  - 20+ componentes reutilizables
  - Responsive design

Database:
  - SQLite (spm.db)
  - ~100,000 registros de ejemplo
  - 9 tablas principales
  - 15+ índices de performance

Módulos Especializados:
  - Planificador (optimización)
  - Agentes IA (LLM)
  - Asistente IA (chat)
```

---

## 🎯 Cómo Navegar este Archivo

**Este archivo es una brújula.**

- ¿Nuevo en el proyecto? → Lee "¿Por dónde empezar?"
- ¿Buscas un tema específico? → Ve a "Búsqueda por Tema"
- ¿Eres desarrollador backend? → Ve a "Por Tipo de Desarrollador"
- ¿Necesitas ayuda urgente? → Ve a "Ayuda Rápida"

---

**Última actualización:** 8 de noviembre de 2025
**Mantenedor:** Equipo de Desarrollo SPM
