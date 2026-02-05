# Guía de Uso - Diagrama de Arquitectura SPMv3.0

## 🎯 Propósito

Este diagrama proporciona una **representación visual completa** de la arquitectura del sistema SPMv3.0, facilitando:

- **Comprensión rápida** de la estructura del sistema
- **Comunicación** con stakeholders y nuevos desarrolladores
- **Identificación de dependencias** entre componentes
- **Planificación de features** considerando capas arquitectónicas
- **Documentación** de integraciones externas

---

## 📖 Cómo Leer el Diagrama

### Estructura Jerárquica

El diagrama está organizado de **arriba a abajo**:

```
┌─────────────────────────────────────┐
│  1. FRONTEND LAYER (React + Vite)   │  ← UI, Páginas, Componentes
├─────────────────────────────────────┤
│  2. BACKEND LAYER (Flask API)       │  ← Lógica de negocio, Servicios
├─────────────────────────────────────┤
│  3. DATABASE LAYER (SQLite + PG)    │  ← Persistencia, Cache
├─────────────────────────────────────┤
│  4. EXTERNAL SERVICES LAYER         │  ← Integraciones terceros
└─────────────────────────────────────┘
```

### Componentes del Backend (Detalle)

El backend está dividido en **4 sublayers**:

```
┌─────────────────────────────────────┐
│ 2.1 Routes (29 Blueprints)          │  ← Entry points HTTP
│     - Auth, Business, MRP, Budget   │
├─────────────────────────────────────┤
│ 2.2 Services (14)                   │  ← Lógica de negocio
│     - AI, MRP, Budget, Approval     │
├─────────────────────────────────────┤
│ 2.3 Core (28 módulos)               │  ← Infraestructura
│     - Auth, DB, Cache, WebSocket    │
├─────────────────────────────────────┤
│ 2.4 Agent/ML (45+ archivos)         │  ← Modelos, Pipelines
│     - Forecast, RAG, Clustering     │
└─────────────────────────────────────┘
```

---

## 🔍 Cómo Usar el Diagrama para Diferentes Tareas

### Tarea 1: Agregar una Nueva Feature
**Objetivo:** Entender dónde implementar una nueva funcionalidad

**Pasos:**
1. **Identifica el dominio** (solicitudes, materiales, presupuestos, etc.)
2. **Localiza el Route relacionado** en Backend Layer
3. **Identifica el Service** que usará
4. **Localiza el Core module** necesario (DB, Auth, Cache, etc.)
5. **Determina la llamada API** desde Frontend
6. **Si incluye IA:** Considera Agent/ML pipeline

**Ejemplo: Agregar predicción de demanda**
- Route: `/api/ai/forecast/*` (ya existe)
- Service: `ai_service.py`
- Pipeline: `agent/pipelines/forecast/`
- Frontend: `ForecastIndividual.jsx`

---

### Tarea 2: Debuggear un Problema
**Objetivo:** Rastrear un error a través de las capas

**Pasos:**
1. **¿Dónde se reportó el error?** (Frontend, Backend, Database)
2. **Traceback el flujo de datos** usando los conectores en el diagrama
3. **Revisa cada capa** afectada (API route → Service → Database)
4. **Verifica integraciones externas** si aplica (Vertex AI, WebSocket, etc.)

**Ejemplo: Error al crear solicitud**
- Error reportado en: Frontend (`CreateSolicitud.jsx`)
- Route: `POST /api/solicitudes` (routes/solicitudes.py)
- Service: `planner_service.py` (validación y lógica)
- Database: `spm.db` (persistencia)
- Core: `fsm.py` (validación de estado)

---

### Tarea 3: Optimizar Rendimiento
**Objetivo:** Identificar cuellos de botella

**Checklist de capas:**

| Capa | Optimizaciones Posibles |
|------|-------------------------|
| **Frontend** | Cache (Zustand), Code splitting, Lazy loading |
| **Backend Routes** | Rate limiting, Caching (Core/cache.py) |
| **Services** | Batch processing, Async jobs (background_jobs.py) |
| **Database** | Índices, Partitioning, Query optimization |
| **External Services** | Caching responses, Async calls, Timeouts |

---

### Tarea 4: Implementar Seguridad
**Objetivo:** Identificar puntos de seguridad críticos

**Checklist:**

| Componente | Checklist |
|-----------|-----------|
| **Frontend** | CSRF token (csrf.js), Validación inputs, XSS prevention |
| **Routes** | Autenticación (auth_middleware.py), Autorización (roles.py) |
| **Services** | Validación de ownership, Rate limiting |
| **Database** | Parametrized queries (SQL injection), Encryption |
| **External** | API key management, HTTPS, VAPID validation |

**Módulos de seguridad disponibles:**
- `core/auth_middleware.py` - JWT validation
- `core/roles.py` - Role-based access control
- `core/csrf.py` - CSRF protection
- `core/request_validation.py` - Input sanitization
- `core/rate_limit.py` - Rate limiting decorator

---

### Tarea 5: Escalar el Sistema
**Objetivo:** Preparar para crecimiento

**Recomendaciones por capa:**

| Capa | Estrategia |
|------|-----------|
| **Frontend** | CDN para assets, Lazy loading, Service workers |
| **Backend** | Microservicios (Services son buenos candidatos), Load balancing |
| **Database** | PostgreSQL en prod, Read replicas, Caching (Redis) |
| **External** | Load balancing para Vertex AI calls, Async processing |

---

## 🔗 Conexión con Flujos de Datos

### Flujo 1: Autenticación
```
Frontend (Login UI)
    ↓ POST /api/auth/login
Routes (auth.py)
    ↓ Validate credentials
Services (auth logic)
    ↓ Check database
Database (spm.db - usuarios)
    ↓ Generate JWT
Backend → Frontend
    ↓ Store token
Zustand (authStore)
    ↓ Protected routes work
Frontend (Dashboard)
```

**Módulos involucrados:**
- **Frontend:** `services/auth.js`, `stores/authStore.js`
- **Backend:** `routes/auth.py`, `core/auth_middleware.py`, `core/roles.py`
- **Database:** `spm.db` (tabla usuarios)
- **External:** Ninguno

---

### Flujo 2: Crear Solicitud
```
Frontend (CreateSolicitud.jsx)
    ↓ Validación items (useMaterials hook)
    ↓ POST /api/solicitudes
Routes (solicitudes.py)
    ↓ Validación + sanitization
Core (request_validation.py, schemas.py)
    ↓ Lógica negocio
Services (planner_service.py)
    ↓ FSM transition
Core (fsm.py)
    ↓ Persistencia
Database (spm.db)
    ↓ Notificación
Services (notification_service.py)
    ↓ Eventos
External (WebSocket, Push notifications)
Frontend (Notificaciones)
```

**Módulos involucrados:**
- **Frontend:** `CreateSolicitud.jsx`, `hooks/useMaterials.js`
- **Backend:** `routes/solicitudes.py`, `services/planner_service.py`
- **Core:** `fsm.py`, `request_validation.py`, `schemas.py`
- **Services:** `notification_service.py`, `push_service.py`
- **Database:** `spm.db`
- **External:** WebSocket, Push API

---

### Flujo 3: Forecast (IA/ML)
```
Frontend (ForecastIndividual.jsx)
    ↓ POST /api/ai/forecast/individual/{codigo}
Routes (ai.py)
    ↓ Route al pipeline
Services (ai_service.py)
    ↓ Orquestación
Agent (react_agent.py + reasoner.py)
    ↓ Cargar datos históricos
Agent (data_loader.py)
    ↓ Query a database
Database (sap_data.db - histórico)
    ↓ Procesar con modelos ML
Agent/Forecast (ARIMA/Prophet/XGBoost/LSTM)
    ↓ Backtesting
Agent (backtesting.py, tuning.py)
    ↓ Mejor modelo
Agent (predictor.py)
    ↓ Predicciones 12 meses
Frontend (Gráficos)
```

**Módulos involucrados:**
- **Frontend:** `ForecastIndividual.jsx`, `hooks/useForecast.js`
- **Backend:** `routes/ai.py`, `services/ai_service.py`
- **Agent:** Múltiples modelos en `agent/pipelines/forecast/`
- **Database:** `sap_data.db`
- **External:** Ninguno (procesamiento local)

---

### Flujo 4: Chat Vertex AI
```
Frontend (ChatAssistant.jsx)
    ↓ POST /api/vertex/chat
Routes (vertex_ia.py)
    ↓ Cache check
Core (cache.py)
    ↓ Si no cached:
Agent (react_agent.py)
    ↓ RAG retrieval
Agent/RAG (retriever.py + embedder.py)
    ↓ Semantic search
Database (ChromaDB + spm.db)
    ↓ Context enrichment
Agent (reasoner.py)
    ↓ Construct prompt
External (Vertex AI - Gemini API)
    ↓ Response
    ↓ Cache response
Core (cache.py)
    ↓ Optional TTS
Services (tts_service.py)
    ↓ Audio generation
Frontend (Display + Audio)
```

**Módulos involucrados:**
- **Frontend:** `ChatAssistant.jsx`, `stores/chatStore.js`
- **Backend:** `routes/vertex_ia.py`
- **Services:** `tts_service.py`
- **Agent:** RAG pipeline completo
- **Database:** `ChromaDB`, `spm.db`
- **External:** Vertex AI (Gemini), Edge TTS

---

## 📋 Checklist de Validación del Diagrama

Cuando hagas cambios arquitectónicos, verifica:

- [ ] **¿Se creó un nuevo Route?** → Agregar a "Routes" en diagrama
- [ ] **¿Se agregó un nuevo Service?** → Agregar a "Services"
- [ ] **¿Se modificó Database schema?** → Actualizar "Database Layer"
- [ ] **¿Se integró un nuevo servicio externo?** → Agregar a "External Services"
- [ ] **¿Se modificó un flujo de datos?** → Actualizar flechas y descripciones
- [ ] **¿Se cambió la arquitectura?** → Revisar conexiones entre capas

---

## 🛠️ Cómo Actualizar el Diagrama

### Paso 1: Abrir el archivo
```bash
# Opción 1: Online
# Ve a https://app.diagrams.net y abre SPMv3.0_Architecture.drawio

# Opción 2: Desktop
# Descarga draw.io desktop y abre el archivo

# Opción 3: VS Code
# Instala extensión "Draw.io Integration" y abre el archivo
```

### Paso 2: Hacer cambios
1. Selecciona el componente a modificar
2. Edita propiedades (texto, color, tamaño)
3. Agrega nuevos componentes (arrastra desde panel)
4. Actualiza conexiones

### Paso 3: Guardar
```bash
# draw.io auto-guarda, pero:
File → Save (Ctrl+S)
```

### Paso 4: Exportar (opcional)
```bash
File → Export as → PNG/SVG/PDF
```

### Paso 5: Commit a Git
```bash
git add docs/diagrams/SPMv3.0_Architecture.drawio
git add docs/diagrams/SPMv3.0_Architecture.png (si exportaste)
git commit -m "docs(diagrams): update architecture diagram"
git push
```

---

## 📚 Referencia Rápida de Módulos

### Buscar un Módulo en el Diagrama

**¿Dónde está `ai_service.py`?**
- Ubicación: Backend → Services (2.2)
- Función: Orchestrador de ML (clustering, scoring, forecast)
- Dependencias: Agent/ML pipelines, Database
- Rutas que lo usan: `/api/ai/*`

**¿Dónde está `request_validation.py`?**
- Ubicación: Backend → Core (2.3)
- Función: Sanitización de inputs (XSS, SQL injection)
- Usado por: Todos los Routes
- Decorator: `@validate_json()`

**¿Dónde está `ChromaDB`?**
- Ubicación: Database Layer (3)
- Función: Vector store para RAG (embeddings de materiales)
- Usado por: Agent/RAG pipeline
- Relacionado con: Vertex AI Chat

---

## 🎨 Estilos y Convenciones

### Colores por Capa
- 🔵 **Frontend:** Azul (#4A90E2) - Interfaz de usuario
- 🟠 **Routes:** Naranja (#F5A623) - Entry points HTTP
- 🟣 **Services:** Morado (#BD10E0) - Lógica de negocio
- 🟢 **Core:** Verde (#7ED321) - Infraestructura
- 🟦 **Agent/ML:** Turquesa (#50E3C2) - Modelos y pipelines
- 🔴 **Database:** Rojo (#D0021B) - Persistencia
- 🟣 **External:** Violeta (#9013FE) - Servicios terceros

### Iconos Usados
- 📄 Pages
- 🧩 Components
- 🪝 Hooks
- 🔧 Services
- 📦 Stores
- 🚀 Deployment
- 🛠️ Services
- 🤖 Agent/ML
- 🗄️ Database
- ☁️ Cloud Services
- 📊 Analytics

---

## ❓ Preguntas Frecuentes

### P: ¿Dónde agrego un endpoint nuevo?
**R:**
1. Crea la ruta en el Route correspondiente (ej: `routes/solicitudes.py`)
2. Llama al Service apropiado
3. Usa módulos Core (validación, auth, cache)
4. Actualiza el diagrama en la sección "Routes"

### P: ¿Cómo conecto un nuevo servicio externo?
**R:**
1. Agrega un nuevo módulo en `routes/` o como ruta en existente
2. Crea wrapper en `services/` si es complejo
3. Agrega a "External Services Layer" en diagrama
4. Documenta las dependencias

### P: ¿Qué es ChromaDB?
**R:** Vector store para RAG (Retrieval Augmented Generation). Almacena embeddings de materiales y documentos para búsqueda semántica en el chat de Vertex AI.

### P: ¿Por qué hay 4 sublayers en Backend?
**R:** Para separación de responsabilidades:
- **Routes:** HTTP entry points
- **Services:** Lógica de negocio reutilizable
- **Core:** Infraestructura compartida
- **Agent/ML:** Modelos y pipelines especializados

### P: ¿Cómo se comunican Frontend y Backend?
**R:** A través de **HTTP REST API** (200+ endpoints). El diagrama muestra esta conexión con la flecha roja entre capas 1 y 2.

---

## 🚀 Próximas Mejoras al Diagrama

Ideas para versiones futuras:
- [ ] Diagramas de secuencia para flujos críticos
- [ ] Diagrama de dependencias entre Services
- [ ] Diagrama de datos (entidades y relaciones)
- [ ] Diagrama de deployment (desarrollo vs producción)
- [ ] Matriz de responsabilidades (RACI)

---

## 📞 Soporte

**¿Encontraste un error en el diagrama?**
1. Abre en draw.io
2. Corrígelo
3. Exporta PNG
4. Commit con descripción del cambio

**¿Tienes sugerencias?**
- Abre una issue en GitHub
- O actualiza este documento

---

**Última actualización:** 2026-02-02
**Versión:** 1.0
**Autor:** Claude Code
