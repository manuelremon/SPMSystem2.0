# Quick Start - Diagrama de Arquitectura SPMv3.0

## ⚡ 5 Minutos para Empezar

### Paso 1: Abrir el Diagrama (1 min)

**Opción A: Online (Recomendado)**
```
1. Ve a https://app.diagrams.net
2. Arrastra SPMv3.0_Architecture.drawio aquí
```

**Opción B: Navegador**
```
1. draw.io → File → Open
2. Selecciona SPMv3.0_Architecture.drawio
```

### Paso 2: Navegar el Diagrama (2 min)

El diagrama tiene **4 capas horizontales**:

```
┌─────────────────────────────────────┐
│ 1️⃣  FRONTEND LAYER (React)          │ ← UI, Páginas, Componentes
├─────────────────────────────────────┤
│ 2️⃣  BACKEND LAYER (Flask)           │ ← Routes, Services, Core, ML
├─────────────────────────────────────┤
│ 3️⃣  DATABASE LAYER (SQLite + PG)    │ ← Persistencia, Cache
├─────────────────────────────────────┤
│ 4️⃣  EXTERNAL SERVICES LAYER         │ ← Vertex AI, Push, WebSocket
└─────────────────────────────────────┘
```

**Cómo navegar:**
- Zoom in/out: Scroll o Ctrl+Mouse
- Mover: Arrastra con mouse derecho
- Buscar: Ctrl+F (busca texto en componentes)

### Paso 3: Entender los Colores (1 min)

Cada sección tiene un color específico:

| Color | Significado | Ejemplo |
|-------|-----------|---------|
| 🔵 Azul | Frontend | Pages, Components, Services |
| 🟠 Naranja | Routes | API endpoints, HTTP |
| 🟣 Morado | Services | Lógica de negocio |
| 🟢 Verde | Core | Infraestructura, Auth, DB |
| 🟦 Turquesa | Agent/ML | Modelos, Forecast |
| 🔴 Rojo | Database | SQLite, PostgreSQL |
| 🟣 Violeta | External | Vertex AI, Push, WebSocket |

### Paso 4: Encontrar lo que Necesitas (1 min)

**¿Dónde está X módulo?**

Usa `Ctrl+F` y busca:
- `route_name.py` → Encontrará en "Routes" (naranja)
- `service_name.py` → Encontrará en "Services" (morado)
- `core_module.py` → Encontrará en "Core" (verde)
- `model_name` → Encontrará en "Agent/ML" (turquesa)

**Ejemplo: Encontrar `ai_service.py`**
1. Ctrl+F
2. Escribe: `ai_service`
3. Hace zoom a la sección "Services" (morado)
4. Ves: "ai_service.py (600+ L) - ML orchestrator"

---

## 🎯 Casos de Uso Rápidos

### Caso 1: Nuevo Feature - ¿Dónde Debo Escribir Código?

**Para agregar predicción de demanda:**

1. **Ubica el dominio:** Forecast/AI
   - Ve a Backend → Routes → Busca `ai.py`
   - Ves: `/api/ai/forecast/*`

2. **Identifica el Service:** `ai_service.py`
   - En Backend → Services (morado)

3. **Busca el Pipeline:** `forecast/`
   - En Backend → Agent/ML → "Forecast Models"

4. **Crea el flujo:**
   - Frontend: `ForecastIndividual.jsx` (POST /api/ai/forecast)
   - Service: Usa `ai_service.py`
   - Database: Lee de `sap_data.db`
   - Agent: Usa modelos ARIMA/Prophet/XGBoost

### Caso 2: Bug - ¿Dónde Está el Error?

**Error: Solicitud no se guarda en BD**

1. **Traceback:**
   - Frontend: `CreateSolicitud.jsx`
   - ↓ POST /api/solicitudes
   - Route: `routes/solicitudes.py`
   - ↓ Service: `planner_service.py`
   - ↓ Database: `spm.db`

2. **Revisa cada capa:**
   - Route: ¿Validación correcta?
   - Service: ¿Lógica correcta?
   - Database: ¿Tabla existe?
   - Core: ¿FSM state correcto?

### Caso 3: Integrar Servicio Externo

**Agregar notificación por email:**

1. **Dónde:** En "External Services" (violeta)
2. **Cómo:**
   - Crea route en `routes/notificaciones.py`
   - Usa o crea service en `services/notification_service.py`
   - Integra SMTP (Gmail)
3. **Documenta:** Añade en "External Services" al diagrama

---

## 📚 Próximos Pasos

### Para Entender Mejor

1. **Lee:** `README.md` (descripción completa)
2. **Aprende:** `USAGE_GUIDE.md` (guía detallada)
3. **Consulta:** `INDEX.md` (referencia rápida)

### Para Contribuir

1. **Edita en draw.io:** Abre el archivo
2. **Realiza cambios:** Agrega/edita componentes
3. **Exporta PNG:** File → Export as → PNG
4. **Commit:** `git add` y `git commit`

### Para Documentación

1. **Exporta a PNG:** Alta resolución
2. **Exporta a SVG:** Para documentación web
3. **Exporta a PDF:** Para reportes

---

## 💡 Tips Prácticos

### Acelerar Búsqueda
```
Ctrl+F → Escribe nombre del módulo
Por ejemplo: "budget_service"
```

### Zoom Rápido
```
Ctrl + Mouse wheel
O doble-click en elemento
```

### Exportar
```
Ctrl+S → Guarda cambios
File → Export as → PNG (para compartir)
```

### Buscar Flujo de Datos
```
Ejemplo: Solicitud desde inicio hasta cierre
1. Busca "solicitudes.py" (orange route)
2. Sigue flecha roja hacia arriba → Frontend
3. Sigue flecha roja hacia abajo → Database
4. Sigue flecha roja a la derecha → Services
```

---

## 📞 Preguntas Frecuentes

**P: ¿Dónde están todos los endpoints?**
R: En "Routes" (29 blueprints). Ver `INDEX.md` para lista completa.

**P: ¿Dónde están los modelos ML?**
R: En "Agent/ML" → "Forecast Models" (ARIMA, Prophet, XGBoost, LSTM)

**P: ¿Dónde está RAG?**
R: En "Agent/ML" → "RAG" (embedder, retriever, gemini_client)

**P: ¿Cómo se comunican Frontend y Backend?**
R: HTTP REST API (flechas rojas entre capas 1 y 2)

**P: ¿Dónde está la database?**
R: En "Database Layer" (capa 3) - SQLite desarrollo, PostgreSQL producción

**P: ¿Cómo actualizo el diagrama?**
R:
1. Abre en draw.io
2. Edita componentes
3. Exporta PNG
4. Commit cambios

---

## 🚀 Primer Diagrama - ¡Éxito!

Felicidades, ahora tienes:

✅ Diagrama de arquitectura completo
✅ 4 capas principales documentadas
✅ 200+ endpoints visualizados
✅ 14 servicios incluidos
✅ 45+ archivos ML/Agent
✅ 6 flujos de datos principales
✅ Documentación completa

**¿Listo para contribuir?** 🚀

1. Entender la arquitectura → Listo ✅
2. Encontrar módulo → Usa Ctrl+F ✅
3. Realizar cambio → Edita en draw.io ✅
4. Commit → `git commit -m "..."` ✅

---

## 📊 Estadísticas Rápidas

| Métrica | Valor |
|---------|-------|
| **Capas** | 4 (Frontend, Backend, Database, External) |
| **Frontend** | 68 páginas, 87 componentes, 16 hooks |
| **Rutas** | 29 blueprints, 200+ endpoints |
| **Servicios** | 14 servicios principales |
| **Base de Datos** | 3 SQLite (dev) + PostgreSQL (prod) |
| **Agent/ML** | 45+ archivos, 5 modelos forecast |
| **Flujos** | 6 flujos principales documentados |

---

## 🎓 Nivel de Detalle

Según tu necesidad:

| Nivel | Para Quién | Qué Hacer |
|-------|-----------|----------|
| **Overview** | Stakeholders | Ver 4 capas principales |
| **Intermediate** | Desarrolladores | Usar Ctrl+F para encontrar módulos |
| **Deep Dive** | Arquitectos | Leer USAGE_GUIDE.md + expandir grupos |
| **Expert** | Tech Leads | Análisis de dependencias + flujos |

---

## ✅ Validación

Antes de comenzar:

- [x] Diagrama abierto en draw.io
- [x] Puedes ver 4 capas principales
- [x] Puedes buscar módulos con Ctrl+F
- [x] Entiendes los colores
- [x] Sabes dónde está Frontend, Backend, DB, External

**¡Estás listo para empezar!** 🚀

---

**Tiempo promedio de lectura:** 5 minutos
**Tiempo para encontrar un módulo:** < 30 segundos
**Tiempo para entender un flujo:** 2-5 minutos

Última actualización: 2026-02-02
