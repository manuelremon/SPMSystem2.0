# Diagrama de Arquitectura SPMv3.0

## 📋 Descripción General

Este directorio contiene el diagrama completo de arquitectura del sistema **SPMv3.0** en formato nativo de draw.io (.drawio). El diagrama visualiza todas las capas, componentes principales y flujos de datos del sistema.

## 📁 Archivos

- **SPMv3.0_Architecture.drawio** - Diagrama XML nativo de draw.io (36 KB)
  - Formato comprimido (.drawio)
  - Compatible con draw.io online
  - Editable y exportable a PNG/SVG/PDF

## 🏗️ Estructura del Diagrama

El diagrama está organizado en **4 capas horizontales**:

### 1. 🎨 FRONTEND LAYER (React 18 + Vite 5)
**Componentes:**
- **📄 Pages (68)** - Solicitudes, Planner, MRP, Budget, Admin, Forecast, SLA, etc.
- **🧩 Components (87)** - UI primitivos, DataTable, Modales, Charts
- **🪝 Hooks (16)** - useMaterials, usePlanner, useForecast, usePushNotifications, etc.
- **🔧 Services (15)** - api.js, auth.js, spm.js, forecast.js, vertex.js, etc.
- **📦 Stores Zustand (5)** - authStore, chatStore, vertexStore, realtimeStore, tourStore
- **⚙️ Frameworks** - Material UI v7, Tailwind CSS, Recharts, Plotly.js, React Router v6

**Tecnologías:**
```
React 18 + Vite 5 + TypeScript + i18next
Material UI v7 + Tailwind CSS
Recharts + Plotly.js para gráficos
TanStack Table para DataTables
```

---

### 2. 🚀 BACKEND LAYER (Flask API - 200+ endpoints)
**Sublayers:**

#### 2a. 📍 Routes (29 Blueprints)
- **🔐 Auth (7)** - auth.py, mi_cuenta.py
- **💼 Core Business (11)** - solicitudes.py, materiales.py, equivalencias.py
- **📊 MRP/Forecast** - mrp.py, ai.py, forecast.py
- **💰 Budget (8)** - budget.py, budget_requests.py
- **💬 Communication** - mensajes.py, notificaciones.py, push.py, foro.py
- **⚙️ Admin (36)** - admin.py, admin_import.py, database.py, catalogos.py
- **📈 Analytics** - metrics.py, sla.py, kpis.py
- **🔗 Other (13)** - vertex_ia.py, procurement.py, export.py, docs.py, health.py

#### 2b. 🛠️ Services (14)
**Servicios principales:**
- `ai_service.py` (600+ lineas) - Orchestrador ML (clustering, scoring, forecast)
- `mrp_service.py` (700+ lineas) - Motor MRP (EOQ, ROP, alertas)
- `budget_service.py` (550+ lineas) - Gestión de presupuestos
- `approval_service.py` (500+ lineas) - Matriz de aprobaciones
- `reporting_service.py` (650+ lineas) - Exportación Excel/CSV/PDF
- `sla_service.py` (600+ lineas) - Tiempos límite y alertas
- `notification_service.py` - Notificaciones in-app
- `message_service.py` - Sistema de mensajería
- `push_service.py` - Web Push notifications
- `planner_service.py` - Lógica de planificación
- `audit_service.py` - Trail de auditoría
- `tts_service.py` - Text-to-Speech
- `temp_data_service.py` - Datos temporales
- `recommendation_engine.py` - Recomendaciones IA

#### 2c. 🔧 Core Infrastructure (28 módulos)
**Organizados por categoría:**

| Categoría | Módulos |
|-----------|---------|
| **🔐 Auth/Security** | auth_middleware.py, roles.py, csrf.py, security_headers.py, rate_limit.py |
| **🗄️ Database** | db.py, repository_legacy.py, db_optimization.py, repository/ (modular) |
| **⚙️ Config** | config.py, blueprints.py, cors.py, spa.py, openapi.py |
| **🚀 Infrastructure** | cache.py, websocket.py, observability.py, metrics.py, background_jobs.py, fsm.py |
| **📋 Schemas** | schemas.py, item_schemas.py, budget_schemas.py, notification_schemas.py, request_validation.py |

#### 2d. 🤖 Agent/ML (45+ archivos)
**Modelos y pipelines:**
- **Core:** react_agent.py, reasoner.py, memory.py, vertex_memory.py
- **Pipelines:** clustering.py, scoring.py, demand_forecast.py, anomaly_detection.py
- **Forecast Models:** ARIMA, Prophet, XGBoost, LSTM, backtesting.py, tuning.py
- **RAG:** embedder.py, vector_store.py, retriever.py, gemini_client.py
- **Tools:** data_loader.py, evaluator.py, material_matcher.py, ml_trainer.py, nlp_processor.py

---

### 3. 🗄️ DATABASE LAYER (SQLite + PostgreSQL)
**Desarrollo (SQLite):**
| BD | Tamaño | Proposito |
|-------|--------|-----------|
| **spm.db** | 1.1 MB | Usuarios, Solicitudes, Auth, Mensajes, Presupuestos, Roles |
| **master_materiales.db** | 57 MB | Catálogo de materiales (46K), Equivalencias (94K), MRP (6K) |
| **sap_data.db** | 41 MB | Stock, Consumo histórico, Pedidos SAP, Proveedores, Precios |
| **ChromaDB** | Variable | Vector store para RAG, Embeddings de materiales |

**Producción (PostgreSQL):**
- Base de datos unificada en Cloud Run/Render
- Connection pool: 2-20 conexiones
- Replication ready, full-text search, JSON columns, partitioning

**Cache & Session:**
- Redis (opcional) - Session store, cache layer, Celery broker

---

### 4. ☁️ EXTERNAL SERVICES LAYER
**Integraciones:**

| Servicio | Tecnología | Descripción |
|----------|-----------|-------------|
| **Google Vertex AI** | Gemini 2.0 Flash | Chat API, RAG context, Anti-alucinación, Temp: 0.1-0.3 |
| **TTS** | Microsoft Edge TTS | Text-to-Speech GRATIS (Elena, Tomás, Dalia, Jorge) |
| **Push Notifications** | Web Push API | VAPID keys, Service Worker, pywebpush library |
| **WebSocket** | Real-time Events | Event Bus, Rooms, Broadcast, Direct messages |
| **Monitoring** | Sentry + Logging | Structured JSON logs, Request tracing, Metrics |
| **SAP Integration** | ZM65 Reports | Excel imports, Procurement analytics, Stock levels |
| **Email** | Gmail SMTP | Notificaciones por email (opcional) |
| **Celery** | Redis Broker | Background jobs, Task queue (opcional) |

---

## 🔄 Flujos de Datos Principales

### 1️⃣ Authentication Flow
```
Frontend (Login)
    ↓
POST /api/auth/login
    ↓
Validation → JWT Generation
    ↓
httpOnly Cookies (Prod) or Bearer Token
    ↓
Response → Zustand authStore
    ↓
Authenticated UI
```

### 2️⃣ Solicitudes Workflow (FSM)
```
Create (draft)
    ↓
Submit → FSM: draft → submitted
    ↓
Notification Coordinator
    ↓
Approve → FSM: submitted → approved
    ↓
Budget consumption → SLA initiated
    ↓
Planner (4-step wizard)
    ↓
processing → dispatched → closed
```

### 3️⃣ Planner Wizard (4 Pasos)
```
Paso 1: Análisis Stock (datos históricos)
    ↓
Paso 2: Decisión Abastecimiento (stock vs compra)
    ↓
Paso 3: Revisión Final (confirmación)
    ↓
Paso 4: Acciones Pendientes (registro)
    ↓
MRP EOQ/ROP Calculations
    ↓
Purchase Orders Generated
```

### 4️⃣ Demand Forecast Pipeline
```
Frontend /forecast/individual/{codigo}
    ↓
Data Loader (PostgreSQL/SQLite histórico)
    ↓
Forecast Pipeline (ARIMA/Prophet/XGBoost)
    ↓
Backtesting validation
    ↓
Best model selection
    ↓
12-month prediction
    ↓
Visualization (Recharts/Plotly)
```

### 5️⃣ Vertex AI Chat (RAG)
```
User Query
    ↓
Cache check
    ↓
RAG (ChromaDB embeddings + SQLite retrieval)
    ↓
Context enrichment
    ↓
Gemini API (temp: 0.1-0.3)
    ↓
Anti-hallucination prompts
    ↓
Response + Optional TTS
    ↓
Cache storage
```

### 6️⃣ Web Push Notifications
```
Register Service Worker (sw.js)
    ↓
Push subscribe (VAPID)
    ↓
POST /api/push/subscribe
    ↓
Store endpoint in DB
    ↓
Event trigger
    ↓
push_service.send_notification
    ↓
pywebpush (VAPID signature)
    ↓
Browser push endpoint
    ↓
showNotification (desktop)
```

---

## 📊 Estadísticas del Sistema

| Métrica | Valor |
|---------|-------|
| **Backend** | 168 archivos Python, ~65,000 líneas |
| **Frontend** | 75 páginas, 87 componentes, 16 hooks |
| **API Endpoints** | 200+ endpoints en 29 módulos |
| **Tests** | 1,220+ tests en 55 archivos |
| **Servicios** | 14 servicios de negocio |
| **Bases de Datos** | 3 SQLite + PostgreSQL (producción) |
| **Agentes/ML** | 45+ archivos (clustering, forecast, RAG) |

---

## 🎨 Paleta de Colores

El diagrama utiliza colores consistentes para cada capa:

- **Frontend:** 🔵 Azul (#4A90E2)
- **Routes:** 🟠 Naranja (#F5A623)
- **Services:** 🟣 Morado (#BD10E0)
- **Core:** 🟢 Verde (#7ED321)
- **Agent/ML:** 🟦 Turquesa (#50E3C2)
- **Database:** 🔴 Rojo (#D0021B)
- **External:** 🟣 Violeta (#9013FE)
- **Data Flows:** ⚫ Gris oscuro (#4A4A4A)

---

## 💻 Cómo Abrir el Diagrama

### Opción 1: Online (Recomendado)
1. Ve a https://app.diagrams.net
2. File → Open → Selecciona `SPMv3.0_Architecture.drawio`
3. O arrastra el archivo al navegador

### Opción 2: Desktop
1. Descarga draw.io desktop desde https://github.com/jgraph/drawio-desktop/releases
2. Abre `SPMv3.0_Architecture.drawio`

### Opción 3: VS Code
1. Instala extensión "Draw.io Integration"
2. Click derecho en `.drawio` → Open with draw.io

---

## 📥 Exportar el Diagrama

### PNG (Alta Resolución)
```
En draw.io:
File → Export as → PNG
Selecciona "Selection" o "Diagram"
```

### SVG (Vectorial)
```
File → Export as → SVG
```

### PDF (Para documentación)
```
File → Export as → PDF
```

---

## 🔗 Referencias Relacionadas

- **Documentación:** `docs/ARQUITECTURA_SPM_2_0.md`
- **Guía Rápida:** `docs/GUIA_RAPIDA_USAR_SERVICIOS.md`
- **Security Review:** `docs/AUDIT.md`
- **Deployment:** `docs/DEPLOYMENT.md`
- **Quick Reference BD:** `docs/guides/QUICK_REFERENCE_BD.md`

---

## ✅ Checklist de Validación

El diagrama incluye:

- [x] **4 Capas principales** (Frontend, Backend, Database, External Services)
- [x] **Frontend:** 68 páginas, 87 componentes, 16 hooks, 15 servicios, 5 stores
- [x] **Backend:** 29 blueprints (200+ endpoints), 14 servicios, 28 módulos core, 45+ archivos ML/Agent
- [x] **Database:** SQLite (desarrollo), PostgreSQL (producción), ChromaDB (RAG)
- [x] **External Services:** Vertex AI, TTS, Push, WebSocket, Monitoring, SAP, Email
- [x] **Flujos de datos:** 6 flujos principales (Auth, Solicitudes, Planner, Forecast, Chat, Push)
- [x] **Colores consistentes** por capa arquitectónica
- [x] **Anotaciones completas** de tecnologías y módulos

---

## 📝 Actualizaciones

**Última actualización:** 2026-02-02

**Versión del Diagrama:** 1.0

**Compatible con:**
- draw.io (Online)
- draw.io Desktop
- VS Code (con extensión)

---

## 🎯 Próximos Pasos

1. **Abrir en draw.io** y revisar la estructura
2. **Expandir grupos colapsables** para ver detalles
3. **Exportar a PNG/SVG** si necesitas compartir
4. **Mantener actualizado** cuando haya cambios arquitectónicos

---

## 📧 Preguntas o Sugerencias

Si encuentras errores o tienes sugerencias para mejorar el diagrama:
1. Abre el archivo en draw.io
2. Realiza los cambios necesarios
3. Exporta y actualiza en Git

---

**Diseño:** Based on CLAUDE.md (2026-01-25)
**Formato:** draw.io XML (.drawio)
**Tamaño:** 36 KB (comprimido)
