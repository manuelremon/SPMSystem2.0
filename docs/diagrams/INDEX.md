# Índice de Diagramas - SPMv3.0

## 📊 Diagrama de Arquitectura Completa

### Archivo Principal
- **SPMv3.0_Architecture.drawio** (36 KB)
  - Formato: XML nativo de draw.io
  - Última actualización: 2026-02-02
  - Compatible con: draw.io Online, Desktop, VS Code

### ¿Qué Contiene?

El diagrama visualiza la **arquitectura completa** del sistema SPMv3.0 en **4 capas**:

#### 1. 🎨 Frontend Layer (React 18 + Vite 5)
- 68 páginas (Solicitudes, Planner, MRP, Budget, Admin, Forecast, etc.)
- 87 componentes UI (primitivos, DataTable, Modales, Charts)
- 16 hooks (useMaterials, usePlanner, useForecast, etc.)
- 15 servicios API (api.js, auth.js, spm.js, forecast.js, vertex.js, etc.)
- 5 stores Zustand (authStore, chatStore, vertexStore, etc.)

#### 2. 🚀 Backend Layer (Flask API - 200+ endpoints)
**Sublayers:**
- **Routes** (29 Blueprints) - Auth, Business, MRP, Budget, Communication, Admin, Analytics
- **Services** (14) - ai_service, mrp_service, budget_service, approval_service, sla_service, etc.
- **Core** (28 módulos) - Auth, Database, Config, Infrastructure, Schemas
- **Agent/ML** (45+ archivos) - Forecast models (ARIMA, Prophet, XGBoost, LSTM), RAG, Clustering

#### 3. 🗄️ Database Layer (SQLite + PostgreSQL)
- **Development**: 3 SQLite databases (spm.db, master_materiales.db, sap_data.db)
- **Production**: PostgreSQL unificada
- **Vector Store**: ChromaDB (para RAG)
- **Cache**: Redis (opcional)

#### 4. ☁️ External Services Layer
- **Google Vertex AI** - Gemini 2.0 Flash chat API
- **Microsoft Edge TTS** - Text-to-Speech (GRATIS)
- **Web Push API** - Push notifications con VAPID
- **WebSocket** - Real-time events
- **Sentry + Logging** - Monitoreo y observabilidad
- **SAP Integration** - ZM65 Reports
- **Email** - Gmail SMTP
- **Celery** - Background jobs (opcional)

---

## 📚 Documentación Relacionada

### 1. README.md
- **Descripción:** Guía completa de uso del diagrama
- **Contiene:** Estructura, estadísticas, flujos de datos, checklist de validación
- **Para quién:** Todos (desarrolladores, stakeholders, nuevos miembros)

### 2. USAGE_GUIDE.md
- **Descripción:** Guía detallada de cómo usar el diagrama para diferentes tareas
- **Contiene:** Ejemplos prácticos, buscar módulos, actualizar diagrama, FAQs
- **Para quién:** Desarrolladores, arquitectos, tech leads

### 3. INDEX.md (Este archivo)
- **Descripción:** Índice y referencia rápida
- **Contiene:** Qué contiene cada archivo, cómo navegar
- **Para quién:** Todos

---

## 🔗 Flujos de Datos Visualizados

El diagrama incluye 6 flujos de datos principales:

### 1️⃣ Authentication Flow
```
Frontend → POST /api/auth/login → Validation → JWT → Response
```

### 2️⃣ Solicitudes Workflow (FSM)
```
Create → Submit → Approve → Budget Consume → Planner → Dispatched
```

### 3️⃣ Planner Wizard (4 Pasos)
```
Análisis Stock → Decisión Abastecimiento → Revisión → Acciones
```

### 4️⃣ Demand Forecast
```
User Request → Data Loader → ML Models → Validation → Prediction
```

### 5️⃣ Vertex AI Chat (RAG)
```
Query → Cache → RAG Search → Gemini API → Response → TTS (optional)
```

### 6️⃣ Push Notifications
```
Register → Subscribe → Event → Send → Browser → Notification
```

---

## 🎯 Casos de Uso del Diagrama

### Para Nuevos Desarrolladores
1. Lee el diagrama para entender la arquitectura
2. Localiza el módulo donde trabajarás
3. Revisa USAGE_GUIDE.md para detalles

### Para Code Review
1. Verifica que los cambios siguen el patrón arquitectónico
2. Usa el diagrama para entender dependencias
3. Valida que se usan módulos Core existentes

### Para Escalabilidad
1. Identifica cuellos de botella en el diagrama
2. Considera la separación de responsabilidades
3. Planifica microservicios basado en Services

### Para Documentación
1. Exporta a PNG/SVG para la wiki
2. Crea diagramas de secuencia para flujos específicos
3. Mantén sincronizado con cambios arquitectónicos

---

## 💻 Cómo Abrir el Diagrama

### Opción 1: Online (Recomendado)
```
1. Ve a https://app.diagrams.net
2. File → Open
3. Selecciona SPMv3.0_Architecture.drawio
```

### Opción 2: Arrastrar al navegador
```
1. Abre https://app.diagrams.net
2. Arrastra SPMv3.0_Architecture.drawio al canvas
```

### Opción 3: Desktop
```
1. Descarga draw.io desktop
2. Abre el archivo con draw.io
```

### Opción 4: VS Code
```
1. Instala "Draw.io Integration"
2. Click derecho → Open with draw.io
```

---

## 📥 Exportar el Diagrama

```bash
# En draw.io:

# PNG (Alta Resolución)
File → Export as → PNG

# SVG (Vectorial)
File → Export as → SVG

# PDF (Documentación)
File → Export as → PDF
```

---

## 🔍 Referencia Rápida de Módulos

### Backend Routes (29 Blueprints)

| Grupo | Archivos | Endpoints |
|-------|----------|-----------|
| Auth | auth.py, mi_cuenta.py | 14 |
| Business | solicitudes.py, materiales.py, equivalencias.py | 17 |
| MRP/Forecast | mrp.py, ai.py, forecast.py | 21 |
| Budget | budget.py, budget_requests.py | 8 |
| Communication | mensajes.py, notificaciones.py, push.py, foro.py | 22 |
| Admin | admin.py, admin_import.py, database.py, catalogos.py | 36 |
| Analytics | metrics.py, sla.py, kpis.py | 11 |
| Other | vertex_ia.py, procurement.py, export.py, docs.py, health.py | 13 |

**Total: 29 Blueprints, 200+ Endpoints**

### Backend Services (14)

| Servicio | Líneas | Proposito |
|----------|--------|-----------|
| ai_service.py | 600+ | ML orchestrator |
| mrp_service.py | 700+ | MRP engine |
| budget_service.py | 550+ | Presupuestos |
| approval_service.py | 500+ | Aprobaciones |
| reporting_service.py | 650+ | Exportación |
| sla_service.py | 600+ | SLA tracking |
| push_service.py | 350+ | Push notifications |
| notification_service.py | 300+ | In-app notifs |
| message_service.py | 350+ | Mensajes |
| planner_service.py | 400+ | Planificación |
| audit_service.py | 450+ | Auditoría |
| tts_service.py | 200+ | Text-to-Speech |
| temp_data_service.py | 150+ | Datos temporales |
| recommendation_engine.py | 300+ | Recomendaciones |

### Backend Core (28 módulos)

| Categoría | Módulos |
|-----------|---------|
| Auth/Security | auth_middleware.py, roles.py, csrf.py, security_headers.py, rate_limit.py |
| Database | db.py, repository_legacy.py, db_optimization.py |
| Config | config.py, blueprints.py, cors.py, spa.py, openapi.py |
| Infrastructure | cache.py, websocket.py, observability.py, metrics.py, background_jobs.py, fsm.py |
| Schemas | schemas.py, item_schemas.py, budget_schemas.py, notification_schemas.py, request_validation.py |

### Agent/ML (45+ archivos)

| Grupo | Archivos |
|-------|----------|
| Core | react_agent.py, reasoner.py, memory.py, vertex_memory.py |
| Pipelines | clustering.py, scoring.py, demand_forecast.py, anomaly_detection.py |
| Forecast | ARIMA, Prophet, XGBoost, LSTM, backtesting.py, tuning.py |
| RAG | embedder.py, vector_store.py, retriever.py, gemini_client.py |
| Tools | data_loader.py, evaluator.py, material_matcher.py, ml_trainer.py |

---

## 📊 Estadísticas

| Métrica | Valor |
|---------|-------|
| **Backend Files** | 168 Python files |
| **Backend Lines** | ~65,000 LOC |
| **Frontend Files** | ~150 (pages + components + hooks + services) |
| **Frontend Lines** | ~40,000 LOC |
| **API Endpoints** | 200+ en 29 módulos |
| **Tests** | 1,220+ en 55 archivos |
| **Services** | 14 servicios de negocio |
| **Databases** | 3 SQLite + PostgreSQL (prod) |
| **Agent/ML** | 45+ archivos |
| **Diagram Size** | 36 KB (comprimido XML) |

---

## 🎨 Paleta de Colores

Cada capa usa un color específico para fácil identificación:

```
🔵 Frontend Layer       #4A90E2 (Azul)
🟠 Routes             #F5A623 (Naranja)
🟣 Services           #BD10E0 (Morado)
🟢 Core               #7ED321 (Verde)
🟦 Agent/ML           #50E3C2 (Turquesa)
🔴 Database           #D0021B (Rojo)
🟣 External           #9013FE (Violeta)
```

---

## ✅ Validación

- [x] XML válido y bien formado
- [x] Abre correctamente en draw.io
- [x] 4 capas principales visualizadas
- [x] 200+ endpoints documentados
- [x] 14 servicios incluidos
- [x] 45+ archivos ML/Agent
- [x] 6 flujos de datos principales
- [x] Colores consistentes
- [x] Anotaciones completas
- [x] Documentación completa

---

## 🚀 Próximas Mejoras

- [ ] Diagramas de secuencia (flujos detallados)
- [ ] Diagrama de dependencias entre servicios
- [ ] Diagrama de datos (Entity-Relationship)
- [ ] Diagrama de deployment (dev vs prod)
- [ ] Matriz RACI de responsabilidades
- [ ] Visualización de latencies
- [ ] Performance bottleneck analysis

---

## 📞 Soporte

**¿Encontraste un error?**
1. Abre en draw.io
2. Corrígelo
3. Exporta PNG (opcional)
4. Commit con descripción del cambio

**¿Tienes sugerencias?**
- Abre una issue en GitHub
- O actualiza la documentación

---

## 📁 Archivos en Este Directorio

```
docs/diagrams/
├── SPMv3.0_Architecture.drawio    ← Diagrama principal (XML)
├── README.md                      ← Guía completa
├── USAGE_GUIDE.md                 ← Guía detallada de uso
└── INDEX.md                       ← Este archivo
```

---

## 🔗 Enlaces Útiles

- **draw.io Online:** https://app.diagrams.net
- **draw.io Desktop:** https://github.com/jgraph/drawio-desktop/releases
- **VS Code Extension:** "Draw.io Integration"
- **Documentación Sistema:** docs/ARQUITECTURA_SPM_2_0.md
- **Deployment:** docs/DEPLOYMENT.md
- **Guía Rápida:** docs/GUIA_RAPIDA_USAR_SERVICIOS.md

---

**Última actualización:** 2026-02-02
**Versión:** 1.0
**Formato:** draw.io XML (.drawio)
**Tamaño:** 36 KB
