# SPM v3.0 - Documento de Contexto para NotebookLM

> Sistema de Planificacion de Materiales - Guia Completa
> Ultima actualizacion: 2026-02-05

---

## 1. Resumen Ejecutivo

### Que es SPM v3.0

SPM (Sistema de Planificacion de Materiales) es una plataforma empresarial full-stack para la gestion integral del ciclo de vida de solicitudes de materiales. Combina funcionalidades de ERP con capacidades avanzadas de Machine Learning para optimizar la cadena de suministro.

### Proposito del Sistema

El sistema permite a las organizaciones:

- **Gestionar solicitudes de materiales** desde su creacion hasta la entrega final
- **Automatizar aprobaciones** mediante una matriz configurable por monto y jerarquia
- **Optimizar inventarios** con algoritmos MRP (Material Requirements Planning)
- **Predecir demanda** usando modelos de Machine Learning (ARIMA, Prophet, XGBoost, LSTM)
- **Monitorear KPIs** de rendimiento, SLA y presupuesto en tiempo real

### Estadisticas Clave del Proyecto

| Metrica | Valor |
|---------|-------|
| Archivos Python (Backend) | 168 |
| Lineas de codigo Backend | ~65,000 |
| Paginas React (Frontend) | 58 principales + 14 admin = 72 |
| Componentes reutilizables | 90+ |
| Endpoints API | 200+ |
| Tests automatizados | 1,210+ |
| Modelos de ML | 6 (ARIMA, Prophet, XGBoost, LSTM, Sklearn, STL) |

---

## 2. Arquitectura del Sistema

### Stack Tecnologico

```
+------------------+     +------------------+     +------------------+
|    FRONTEND      |     |     BACKEND      |     |   BASE DE DATOS  |
+------------------+     +------------------+     +------------------+
| React 18         |     | Flask 3.x        |     | SQLite (dev)     |
| Vite 5           |     | Python 3.11+     |     | PostgreSQL (prod)|
| TailwindCSS      |     | SQLAlchemy       |     |                  |
| Zustand (state)  |     | Pydantic         |     | 4 bases:         |
| TanStack Table   |     | scikit-learn     |     | - spm.db         |
| Chart.js         |     | XGBoost          |     | - equivalentes.db|
| MUI X Components |     | Prophet          |     | - sap_data.db    |
|                  |     | PyTorch (LSTM)   |     | - catalogo.db    |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        +------------------------+------------------------+
                                 |
                          API REST /api/*
                          WebSocket (tiempo real)
                          Push Notifications (VAPID)
```

### Puertos de Desarrollo

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:5000 (Flask)

### Estructura de Carpetas Principal

```
SPMv3.0/
├── backend/                    # API Flask (~65K lineas)
│   ├── routes/                 # 29 modulos de endpoints
│   │   ├── admin.py           # CRUD usuarios, roles, materiales (31 endpoints)
│   │   ├── solicitudes.py     # Gestion de solicitudes (11 endpoints)
│   │   ├── planner.py         # Wizard de planificacion (21 endpoints)
│   │   ├── ai.py              # Recomendaciones IA (14 endpoints)
│   │   ├── mrp.py             # Alertas MRP (8 endpoints)
│   │   ├── budget.py          # Presupuestos (8 endpoints)
│   │   └── ...                # 22 modulos adicionales
│   ├── services/               # 11 servicios de negocio
│   │   ├── ai_service.py      # Orquestador ML (600+ lineas)
│   │   ├── mrp_service.py     # Motor MRP (700+ lineas)
│   │   ├── approval_service.py # Matriz de aprobacion
│   │   └── ...
│   ├── core/                   # 28 modulos de infraestructura
│   │   ├── fsm.py             # Maquina de estados
│   │   ├── roles.py           # Gestion de roles
│   │   ├── db.py              # Conexion BD
│   │   └── ...
│   └── agent/                  # Sistema de IA/ML
│       ├── pipelines/          # Pipelines de ML
│       │   ├── clustering.py   # Agrupacion de materiales
│       │   ├── scoring.py      # Priorizacion
│       │   ├── demand_forecast.py
│       │   └── forecast/       # 11 modelos de pronostico
│       │       ├── arima_model.py
│       │       ├── prophet_model.py
│       │       ├── xgboost_model.py
│       │       ├── lstm_model.py
│       │       ├── sklearn_models.py
│       │       └── stl_decomposition.py
│       ├── rag/                # Retrieval Augmented Generation
│       │   ├── embeddings.py
│       │   └── retriever.py
│       └── core/
│           └── react_agent.py  # Agente ReAct
│
├── frontend/src/
│   ├── pages/                  # 58 paginas principales
│   │   ├── Dashboard.jsx       # Dashboard por rol
│   │   ├── CreateSolicitud.jsx # Crear solicitudes
│   │   ├── Aprobaciones.jsx    # Aprobar/rechazar
│   │   ├── Planner.jsx         # Wizard 4 pasos
│   │   ├── ForecastIndividual.jsx
│   │   └── admin/              # 14 paginas de administracion
│   ├── components/             # 90+ componentes
│   │   ├── ui/                 # 35 primitivos (Button, Modal, Card...)
│   │   ├── Planner/            # 7 componentes del wizard
│   │   ├── forecast/           # 11 componentes de pronostico
│   │   └── dashboard/          # KPIs y graficos
│   ├── hooks/                  # 12 custom hooks
│   ├── services/               # 11 servicios API
│   ├── store/                  # 3 stores Zustand
│   └── context/                # i18n (200+ claves)
│
├── data/                       # Bases de datos SQLite
├── tests/                      # 1,210+ tests
└── docs/                       # Documentacion
```

---

## 3. Logica de Negocio

### 3.1 Maquina de Estados (FSM) de Solicitudes

El sistema implementa una maquina de estados finitos robusta que controla el ciclo de vida de cada solicitud:

```
                    +----------+
                    |  DRAFT   |  <- Estado inicial
                    +----+-----+
                         |
                    [enviar]
                         v
                    +----------+
            +------>| SUBMITTED|  <- Pendiente aprobacion
            |       +----+-----+
            |            |
            |    [aprobar]    [rechazar]
            |       v              v
            |  +--------+    +----------+
            |  |APPROVED|    | REJECTED |---> [reenviar max 2x]
            |  +---+----+    +----------+         |
            |      |                              |
            |  [asignar planificador]             |
            |      v                              |
            |  +----------+                       |
            |  |IN_PLANNING|<---------------------+
            |  +----+-----+
            |       |
            |   [tratar]
            |       v
            |  +------------+
            +--|IN_TREATMENT| <-> [puede volver atras max 3x]
               +-----+------+
                     |
                [completar tratamiento]
                     v
               +---------+
               | TREATED |
               +----+----+
                    |
               [finalizar]
                    v
               +-----------+
               | COMPLETED |  <- Estado terminal
               +-----------+

   [cancelar] -> CANCELLED (desde DRAFT, SUBMITTED o APPROVED)
```

**Estados:**

| Estado | Descripcion | Siguiente Estado Posible |
|--------|-------------|--------------------------|
| `draft` | Borrador, editable | submitted, cancelled |
| `submitted` | Enviada, pendiente aprobacion | approved, rejected |
| `approved` | Aprobada, consume presupuesto | in_planning, cancelled |
| `rejected` | Rechazada por aprobador | draft (max 2 reenvios) |
| `in_planning` | Asignada a planificador | in_treatment |
| `in_treatment` | En proceso de tratamiento | treated, in_planning (max 3 retrocesos) |
| `treated` | Tratamiento completado | completed |
| `completed` | Finalizada (terminal) | - |
| `cancelled` | Cancelada (terminal) | - |

**Validaciones del FSM:**
- Maximo 2 reenvios de solicitudes rechazadas
- Maximo 3 retrocesos de in_treatment a in_planning
- Las solicitudes aprobadas no pueden ser rechazadas (presupuesto ya consumido)
- Transiciones automaticas disparan notificaciones push

### 3.2 Sistema de Roles y Permisos

El sistema maneja 5 niveles jerarquicos de roles:

```python
JERARQUIA_ROLES = {
    "usuario": 0,        # Crear solicitudes propias
    "solicitante": 0,    # Alias de usuario
    "aprobador": 1,      # Aprobar segun matriz
    "coordinador": 2,    # Supervision de area
    "jefe": 3,           # Aprobacion hasta USD 100,000
    "gerente1": 4,       # Aprobacion hasta USD 10,000,000
    "gerente2": 4,       # Aprobacion hasta USD 100,000,000
    "admin": 5,          # Acceso total
}
```

**Roles especializados:**
- `aprobador_solicitudes`: Puede aprobar solicitudes de materiales
- `aprobador_presupuestos`: Puede aprobar Budget Update Requests
- `planificador`: Acceso al wizard de planificacion
- `viewer`: Solo lectura

### 3.3 Matriz de Aprobaciones por Monto

El sistema determina automaticamente quien puede aprobar basado en el monto USD:

| Rango USD | Posicion Requerida | Tiempo SLA |
|-----------|-------------------|------------|
| $0.01 - $100,000 | Jefe | 24h |
| $100,000.01 - $10,000,000 | Gerente1 | 48h |
| $10,000,000.01 - $100,000,000 | Gerente2 | 72h |
| > $100,000,000 | Admin | 96h |

**Logica de busqueda de aprobador:**
1. Buscar usuario con rol `aprobador_solicitudes` Y posicion adecuada
2. Priorizar aprobadores del mismo centro de costo
3. Soporta delegacion temporal de aprobaciones
4. Detecta y previene ciclos de delegacion

### 3.4 Sistema de Presupuestos (BUR)

**Budget Update Request (BUR):**

Solicitudes de modificacion de presupuesto con workflow propio:

```
PENDING -> APPROVED -> (fondos transferidos)
        -> REJECTED -> (sin cambios)
```

**Ledger de transacciones:**
- Cada movimiento de presupuesto se registra con:
  - Tipo: credit/debit
  - Monto
  - Concepto
  - Usuario que lo registro
  - Timestamp
  - Clave de idempotencia (evita duplicados)

**Niveles de aprobacion BUR:**
- L1: hasta $200,000 USD
- L2: hasta $1,000,000 USD
- ADMIN: mas de $1,000,000 USD

### 3.5 Motor MRP (Material Requirements Planning)

El servicio MRP calcula automaticamente:

**Requerimiento Neto:**
```
Requerimiento = Demanda - Stock_Actual - Pedidos_en_Curso + Stock_Seguridad
```

**Punto de Reorden (ROP):**
```
ROP = (Lead_Time * Consumo_Diario) + Stock_Seguridad + Factor_Variabilidad
```

**Cantidad Economica de Pedido (EOQ):**
```
EOQ = sqrt(2 * Demanda_Anual * Costo_Orden / Costo_Mantenimiento)
```

**Alertas MRP automaticas:**
- Stock bajo punto de reorden
- Exceso de inventario
- Lead time critico
- Materiales sin rotacion

### 3.6 Sistema SLA (Service Level Agreement)

Tiempos limite por estado y prioridad:

| Prioridad | submitted | approved | in_planning | in_treatment |
|-----------|-----------|----------|-------------|--------------|
| Alta | 4h | 8h | 16h | 24h |
| Media | 8h | 24h | 48h | 72h |
| Baja | 24h | 48h | 96h | 168h |

**Alertas SLA:**
- Pre-alerta al 75% del tiempo
- Alerta al 90% del tiempo
- Escalamiento automatico al vencer

---

## 4. Flujo de Solicitudes Completo

### 4.1 Creacion de Solicitud

1. Usuario navega a `/solicitudes/crear`
2. Selecciona materiales del catalogo SAP (28,000+ items)
3. Sistema sugiere materiales similares usando clustering ML
4. Valida cantidades y calcula monto total
5. Guarda como borrador o envia para aprobacion

### 4.2 Proceso de Aprobacion

1. Sistema identifica aprobador segun monto y centro
2. Notifica via push notification y email
3. Aprobador revisa en `/aprobaciones`
4. Opciones:
   - **Aprobar**: Consume presupuesto, asigna planificador
   - **Rechazar**: Requiere motivo, permite reenvio
5. Sistema actualiza SLA y envia notificaciones

### 4.3 Wizard de Planificacion (4 Pasos)

**Paso 1 - Analisis Inicial:**
- Muestra stock actual en todos los centros
- Sugiere fuente de abastecimiento (stock vs compra)
- Ejecuta prediccion de demanda ML

**Paso 2 - Decision de Abastecimiento:**
- Por cada item decide:
  - Surtir de stock (reserva automatica)
  - Crear orden de compra
  - Pedir transferencia entre centros
- Registra decisiones con justificacion

**Paso 3 - Revision Final:**
- Muestra resumen de decisiones
- Permite ajustes de ultima hora
- Valida completitud

**Paso 4 - Acciones Pendientes:**
- Lista tareas generadas (OC, reservas, transferencias)
- Permite marcar como completadas
- Finaliza el tratamiento

### 4.4 Seguridad y Validaciones

- **Ownership validation**: Solo el creador o admin puede modificar su solicitud
- **Rate limiting**: 30 req/min en endpoints admin, 10 intentos login/5min
- **CSRF protection**: Tokens rotativos en cada request
- **SQL injection**: Parametrizacion obligatoria + whitelist de tablas
- **XSS sanitization**: Limpieza de inputs en backend

---

## 5. Capacidades de IA/ML

### 5.1 Modelos de Forecasting Disponibles

El sistema incluye 6 modelos de pronostico de demanda:

| Modelo | Descripcion | Mejor para |
|--------|-------------|------------|
| **ARIMA** | AutoRegressive Integrated Moving Average | Series estacionarias, patrones lineales |
| **Prophet** | Facebook Prophet, detecta estacionalidad | Datos con tendencia y estacionalidad fuerte |
| **XGBoost** | Gradient Boosting con features temporales | Series con features externas, no lineales |
| **LSTM** | Red neuronal recurrente (PyTorch) | Patrones complejos, largo plazo |
| **Sklearn** | Ensemble (RF, GB, Linear) | Rapido, bueno como baseline |
| **STL** | Seasonal-Trend decomposition with LOESS | Descomposicion de componentes |

**Flujo de prediccion:**
1. Usuario selecciona material y horizonte (dias)
2. Sistema ejecuta backtesting automatico
3. Compara metricas (MAPE, RMSE, MAE)
4. Selecciona mejor modelo o permite override manual
5. Genera prediccion con intervalos de confianza

### 5.2 Pipeline de Clustering

Agrupa materiales por caracteristicas similares:

- Categoria SAP
- Patron de consumo
- Precio unitario
- Lead time
- Frecuencia de solicitud

**Uso:**
- Recomendar alternativas cuando un material no tiene stock
- Identificar materiales de comportamiento similar para forecast
- Detectar anomalias en consumo

### 5.3 Pipeline de Scoring

Prioriza solicitudes basado en:

- Urgencia declarada
- Impacto operacional
- Historial del solicitante
- Criticidad del material
- Tiempo en cola

### 5.4 Sistema RAG (Retrieval Augmented Generation)

Permite consultas en lenguaje natural:

```
Usuario: "Cual es el material mas solicitado en el ultimo mes?"
Sistema: [busca en embeddings] -> [contexto relevante] -> [respuesta]
```

Componentes:
- `embeddings.py`: Genera vectores de texto
- `retriever.py`: Busqueda semantica por similitud
- `context_builder.py`: Construye contexto para respuestas

### 5.5 Agente ReAct

Implementa el patron Reasoning + Acting:

1. **Observar**: Recibe pregunta del usuario
2. **Pensar**: Razona sobre que informacion necesita
3. **Actuar**: Ejecuta herramienta (query BD, calcular, buscar)
4. **Repetir**: Hasta tener respuesta completa

Herramientas disponibles:
- `data_loader`: Carga datos de PostgreSQL
- `material_matcher`: Encuentra materiales similares
- `predictor`: Ejecuta predicciones
- `evaluator`: Evalua modelos

### 5.6 Alertas Proactivas

El sistema genera alertas automaticas:

- **Stock critico**: Cuando stock < punto de reorden
- **SLA en riesgo**: Cuando tiempo > 75% del limite
- **Patron anomalo**: Consumo fuera de 2 desviaciones estandar
- **Presupuesto bajo**: Cuando disponible < 10% asignado

---

## 6. Frontend y Experiencia de Usuario

### 6.1 Paginas Principales (58 totales)

**Autenticacion:**
- `Login.jsx` - Inicio de sesion con JWT
- `CompleteRegistration.jsx` - Completar perfil nuevo usuario
- `NuevoUsuario.jsx` - Primer acceso

**Solicitudes:**
- `CreateSolicitud.jsx` - Wizard de creacion
- `Materials.jsx` - Busqueda de materiales SAP
- `MisSolicitudes.jsx` - Solicitudes propias
- `TodasLasSolicitudes.jsx` - Vista admin
- `SolicitudDetalle.jsx` - Detalle con timeline

**Aprobacion:**
- `Aprobaciones.jsx` - Cola de pendientes
- `HistorialAprobaciones.jsx` - Historico

**Planificacion:**
- `Planner.jsx` - Wizard 4 pasos

**MRP:**
- `MRPTableroAlertas.jsx` - Alertas de reposicion
- `MRPKPIs.jsx` - Metricas MRP
- `MRPParametrizar.jsx` - Configuracion
- `MRPPortfolio.jsx` - Vista portafolio

**Presupuesto:**
- `BudgetRequests.jsx` - Lista BURs
- `BudgetRequestCreate.jsx` - Crear BUR
- `BudgetRequestDetail.jsx` - Detalle BUR

**Forecast:**
- `ForecastIndividual.jsx` - Pronostico por material
- `ForecastMasivo.jsx` - Pronostico bulk

**Dashboards:**
- `Dashboard.jsx` - Router por rol
- `DashboardAdmin.jsx` - Vista administrador
- `DashboardAprobador.jsx` - Vista aprobador
- `DashboardSolicitante.jsx` - Vista solicitante
- `DashboardPlanificador.jsx` - Vista planificador
- `SLADashboard.jsx` - Metricas SLA

**Comunicacion:**
- `Mensajes.jsx` - Sistema de mensajeria
- `Notificaciones.jsx` - Centro de notificaciones
- `Foro.jsx` - Foro de discusion
- `CentroInteraccion.jsx` - Hub de comunicacion

**Catalogos:**
- `CatalogoMateriales.jsx` - Catalogo SAP
- `CatalogoEquivalencias.jsx` - Materiales equivalentes

**Analytics:**
- `AIAnalytics.jsx` - Analisis con IA
- `KPI.jsx` - Dashboard KPIs
- `ProcurementAnalytics.jsx` - Analytics compras
- `Stock.jsx` - Vista de inventario
- `StockIndividual.jsx` - Stock por material

### 6.2 Paginas de Administracion (14)

```
/admin/usuarios         - CRUD de usuarios
/admin/roles           - Gestion de roles
/admin/centros         - Centros de costo
/admin/sectores        - Sectores
/admin/almacenes       - Almacenes
/admin/puestos         - Puestos/posiciones
/admin/materiales      - Catalogo de materiales
/admin/proveedores     - Proveedores
/admin/presupuestos    - Presupuestos por centro
/admin/planificadores  - Asignacion de planificadores
/admin/bases-datos     - Estado de BDs
/admin/monitor-usuarios - Actividad de usuarios
/admin/analisis-puntual - Herramientas de diagnostico
```

### 6.3 Componentes Reutilizables (90+)

**UI Primitivos (35):**
- Button, Input, Select, Textarea, Checkbox, Switch
- Modal, Drawer, Card, Badge, Alert, Tooltip
- DataTable, Pagination, Tabs, Breadcrumb
- Loading, Skeleton, EmptyState
- FileUploader, SearchInput, DatePicker

**Especializados:**
- `ModernDataTable` - TanStack Table con filtros avanzados
- `MaterialDetailModal` - Modal de detalle de material
- `ForecastChart` - Graficos de prediccion con Plotly
- `KPICardMUI` - Tarjetas de metricas MUI
- `ExportButton` - Exportacion a Excel/CSV/PDF

**Planner (7):**
- `Paso1AnalisisInicial`
- `Paso2DecisionAbastecimiento`
- `Paso3RevisionFinal`
- `Paso4AccionesPendientes`
- `TratarSolicitudModal`
- `StockDetalleModal`
- `SolicitudDetalleModal`

**Forecast (11):**
- `ForecastChart`
- `ForecastKPIs`
- `ModelSelector`
- `ModelComparison`
- `BacktestResults`
- `PredictionsTable`
- `PatternCharts`
- `MaterialSearchInput`
- `ForecastSimulationPanel`
- `LazyPlot`
- `ForecastPlaceholder`

### 6.4 Sistema de Internacionalizacion

El sistema usa un provider de i18n con 200+ claves:

```javascript
// Uso en componentes
const { t } = useI18n();

return <h1>{t('nav_dashboard', 'Dashboard')}</h1>;
```

Prefijos de claves:
- `nav_` - Navegacion
- `dash_` - Dashboard
- `common_` - Textos comunes
- `materials_` - Materiales
- `admin_` - Administracion
- `planner_` - Planificador

---

## 7. Bases de Datos

### 7.1 Desarrollo (SQLite)

| Base de Datos | Proposito | Registros |
|---------------|-----------|-----------|
| `data/spm.db` | Datos operacionales (usuarios, solicitudes, auth) | ~500 |
| `data/equivalentes.db` | Equivalencias de materiales SAP | 34,865 |
| `data/sap_data.db` | Stock, consumo historico, pedidos | 178,338 |
| `data/catalogo_materiales.db` | Catalogo completo de materiales | ~28,000 |

### 7.2 Produccion (PostgreSQL)

En produccion todas las tablas se consolidan en PostgreSQL con:
- Connection pooling
- Transacciones ACID
- Indices optimizados
- Backups automaticos

### 7.3 Entidades Principales

**usuario:**
```sql
- id_spm (PK)
- nombre, apellido, mail
- rol (JSON array: ["admin", "planificador"])
- posicion (jefe, gerente1, gerente2, admin)
- sector, centros
- estado_registro (Activo/Inactivo)
- password_hash
```

**solicitud:**
```sql
- id (PK)
- id_usuario (FK)
- status (draft, submitted, approved...)
- monto_total_usd
- prioridad
- aprobador_id, planner_id
- created_at, updated_at
```

**solicitud_item:**
```sql
- id (PK)
- solicitud_id (FK)
- material_codigo
- cantidad, unidad
- precio_unitario
```

**reglas_aprobacion:**
```sql
- id (PK)
- nombre
- monto_minimo, monto_maximo
- rol_aprobador (jefe, gerente1, etc.)
- nivel (1-4)
- centro, sector, criticidad
```

**presupuesto_ledger:**
```sql
- id (PK)
- centro_id
- tipo (credit/debit)
- monto
- concepto
- idempotency_key
- created_at
```

---

## 8. Tests y Calidad

### 8.1 Resumen de Tests

| Categoria | Archivos | Tests | Cobertura |
|-----------|----------|-------|-----------|
| Backend Unit | 36 | 900+ | Excelente |
| Backend Integration | 15 | 200+ | Buena |
| Backend E2E | 2 | 30+ | Buena |
| Frontend | 21 | 80+ | Mejorando |
| **Total** | **74** | **1,210+** | |

### 8.2 Tests Backend Principales

| Modulo | Tests | Proposito |
|--------|-------|-----------|
| `test_scoring.py` | 78 | Pipeline de priorizacion |
| `test_demand_forecast.py` | 44 | Modelos de prediccion |
| `test_budget_service.py` | 40 | Logica de presupuestos |
| `test_clustering.py` | 37 | Agrupacion de materiales |
| `test_csrf.py` | 30 | Seguridad CSRF |
| `test_websocket.py` | 30 | Comunicacion tiempo real |
| `test_fsm.py` | 25 | Maquina de estados |
| `test_approval.py` | 35 | Matriz de aprobacion |

### 8.3 Comandos de Testing

```bash
# Backend
python -m pytest tests/                    # Todos los tests
python -m pytest tests/unit/              # Solo unitarios
python -m pytest tests/ -k "forecast"     # Filtrar por nombre
python -m pytest tests/ --cov=backend     # Con cobertura

# Frontend
cd frontend && npm test                    # Todos los tests
cd frontend && npm test -- --coverage      # Con cobertura
```

---

## 9. Ejemplos de Codigo

### 9.1 Cambio de Estado FSM

```python
from backend.core.fsm import cambiar_estado, TransicionInvalidaError

try:
    resultado = cambiar_estado(
        solicitud_id=123,
        nuevo_estado="approved",
        actor_id="gerente1_user",
        razon="Cumple requisitos",
        metadata={"monto_aprobado": 50000}
    )
    # resultado: {"success": True, "estado_anterior": "submitted", ...}
except TransicionInvalidaError as e:
    # Transicion no permitida
    print(f"Error: {e}")
```

### 9.2 Verificar Permiso de Aprobacion

```python
from backend.services.approval_service import puede_aprobar

resultado = puede_aprobar(
    usuario_id="user123",
    monto_usd=75000.00,
    centro="CC001"
)

if resultado["puede_aprobar"]:
    # Proceder con aprobacion
    pass
else:
    print(f"No puede aprobar: {resultado['razon']}")
    # Ej: "Se requiere posicion 'jefe' o superior"
```

### 9.3 Calcular Punto de Reorden MRP

```python
from backend.services.mrp_service import calcular_punto_reorden

rop = calcular_punto_reorden(
    consumo_diario=10.5,
    lead_time_dias=14,
    stock_seguridad=50,
    variabilidad_demanda=0.2
)

print(f"Punto de reorden: {rop['punto_reorden']} unidades")
# Resultado incluye: demanda_lead_time, factor_seguridad, etc.
```

### 9.4 Ejecutar Prediccion de Demanda

```python
from backend.services.ai_service import AIService

ai = AIService()
ai.train_pipelines(solicitudes_data, materiales_data)

prediccion = ai.forecast.predict(
    material_codigo="MAT001",
    horizonte_dias=30,
    modelo="xgboost"
)

# prediccion contiene:
# - valores predichos por dia
# - intervalos de confianza
# - metricas de backtesting
```

### 9.5 Componente React con Hook

```jsx
import { useState } from 'react';
import { useI18n } from '../context/i18n';
import { Button } from '../components/ui/Button';
import { aprobarSolicitud } from '../services/spm';

function AprobacionItem({ solicitud }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleAprobar = async () => {
    setLoading(true);
    try {
      await aprobarSolicitud(solicitud.id);
      // Actualizar UI
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3>{solicitud.descripcion}</h3>
      <p>{t('common_monto', 'Monto')}: ${solicitud.monto_total_usd}</p>
      <Button
        onClick={handleAprobar}
        disabled={loading}
        variant="success"
      >
        {t('common_aprobar', 'Aprobar')}
      </Button>
    </div>
  );
}
```

---

## 10. Glosario de Terminos

| Termino | Definicion |
|---------|------------|
| **BUR** | Budget Update Request - Solicitud de modificacion de presupuesto |
| **EOQ** | Economic Order Quantity - Cantidad economica de pedido |
| **FSM** | Finite State Machine - Maquina de estados finitos |
| **MRP** | Material Requirements Planning - Planificacion de requerimientos |
| **ROP** | Reorder Point - Punto de reorden |
| **SLA** | Service Level Agreement - Acuerdo de nivel de servicio |
| **SAP** | Codigo de material en sistema SAP origen |
| **Centro** | Centro de costo/responsabilidad |
| **Sector** | Division organizacional dentro de un centro |
| **Planificador** | Usuario que procesa solicitudes aprobadas |
| **Aprobador** | Usuario autorizado a aprobar/rechazar solicitudes |

---

## 11. Preguntas Frecuentes para NotebookLM

1. **Como se determina quien aprueba una solicitud?**
   - El sistema busca un usuario con rol `aprobador_solicitudes` cuya posicion (jefe, gerente1, etc.) tenga nivel suficiente segun el monto.

2. **Que pasa si una solicitud es rechazada?**
   - Vuelve a estado `draft`, el usuario puede modificarla y reenviar (maximo 2 veces).

3. **Como funciona el motor MRP?**
   - Calcula requerimiento neto, punto de reorden y EOQ usando formulas estandar de gestion de inventario, integrando predicciones ML.

4. **Cuantos modelos de ML tiene el sistema?**
   - 6 modelos de forecasting (ARIMA, Prophet, XGBoost, LSTM, Sklearn, STL) mas pipelines de clustering y scoring.

5. **Que validaciones de seguridad implementa?**
   - Ownership validation, rate limiting, CSRF tokens, SQL parametrizado, sanitizacion XSS, JWT con expiracion.

---

*Este documento fue generado para proporcionar contexto completo del sistema SPM v3.0 a NotebookLM.*
