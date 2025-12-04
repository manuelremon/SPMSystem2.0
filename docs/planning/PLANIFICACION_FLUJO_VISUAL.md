# 🗂️ PLANIFICACIÓN - FLUJO DE INTEGRACIÓN COMPLETADO

## 1️⃣ CLICK EN MENÚ "PLANIFICACIÓN"
```
┌─────────────────────────────────────────┐
│   MENÚ LATERAL                          │
├─────────────────────────────────────────┤
│  Dashboard                              │
│  Mi Cuenta                              │
│  Nueva Solicitud                        │
│  → 🗂️ Planificación ← [CLICK]           │
│  Notificaciones                         │
└─────────────────────────────────────────┘
              ↓
        navigateTo('planner')
```

## 2️⃣ NAVEGACIÓN INTERNA SPA
```javascript
// home.html línea 3662
if (pageName === 'planner') {
  initPlannerPage();  // ← Se ejecuta automáticamente
}
```

```
┌─────────────────────────────────────────┐
│ Todas las .page-content se OCULTAN      │
├─────────────────────────────────────────┤
│ #page-planner → MOSTRAR (display: block)│
│ #page-dashboard → OCULTAR               │
│ #page-requests → OCULTAR                │
│ #page-new-request → OCULTAR             │
│ ... etc                                 │
└─────────────────────────────────────────┘
```

## 3️⃣ INICIALIZACIÓN DEL MÓDULO
```javascript
async function initPlannerPage() {
  1. checkPlannerAccess()     // ✅ Verifica JWT + rol
  2. loadPlannerSolicitudes() // ✅ Obtiene datos de API
  3. updatePlannerStats()     // ✅ Obtiene estadísticas
  4. Configura event listeners // ✅ Wirea botones
}
```

## 4️⃣ AUTENTICACIÓN
```
┌────────────────────────────────────────────────────┐
│ checkPlannerAccess()                               │
├────────────────────────────────────────────────────┤
│                                                    │
│  1. Espera window.AuthAPI.me()                    │
│                                                    │
│  2. Verifica rol:                                 │
│     - "Planificador" ✅                           │
│     - "Administrador" ✅                          │
│     - Otros roles ❌                              │
│                                                    │
│  3. Si falló: → Redirige a /home.html             │
│                                                    │
└────────────────────────────────────────────────────┘
          ↓ (si OK)
    Continúa cargando datos
```

## 5️⃣ CARGA DE DATOS
```
loadPlannerSolicitudes()
        ↓
GET /api/planner/solicitudes?page=1&per_page=10
        ↓
```

### Respuesta API:
```json
{
  "solicitudes": [
    {
      "id": 123,
      "centro": "Centro A",
      "sector": "TI",
      "criticidad": "Alta",
      "items_count": 5,
      "total": 15000,
      "estado": "Pendiente"
    },
    {
      "id": 124,
      "centro": "Centro B",
      "sector": "Operaciones",
      "criticidad": "Normal",
      "items_count": 3,
      "total": 8500,
      "estado": "En Proceso"
    }
  ],
  "count": 42,
  "page": 1,
  "per_page": 10
}
```

## 6️⃣ RENDERIZADO DE TABLA
```javascript
renderPlannerSolicitudes()
        ↓
        └─→ Llena tbody con filas de datos
        └─→ Agrega event listeners a botones "Ver"
        └─→ Agrega event listeners a filas para expandir detalles
```

### Resultado en página:
```
┌──────────────────────────────────────────────────────────────┐
│  📋 Solicitudes por Procesar                                 │
├──────────────────────────────────────────────────────────────┤
│ ID  │ Centro   │ Sector      │ Criticidad │ Items │ Acciones │
├─────┼──────────┼─────────────┼────────────┼───────┼──────────┤
│ 123 │ Centro A │ TI          │ Alta       │   5   │  Ver     │
├─────┼──────────┼─────────────┼────────────┼───────┼──────────┤
│ 124 │ Centro B │ Operaciones │ Normal     │   3   │  Ver     │
└─────┴──────────┴─────────────┴────────────┴───────┴──────────┘
        ↓
   [◀ Anterior] [Página 1] [Siguiente ▶]
```

## 7️⃣ ESTADÍSTICAS EN TIEMPO REAL
```javascript
updatePlannerStats()
        ↓
GET /api/planner/dashboard
        ↓
```

### Respuesta:
```json
{
  "pending": 12,
  "in_process": 5,
  "optimized": 8,
  "completed": 42
}
```

### Mostrado como:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ ⏳ Pendientes│ ⚙️ En Proceso│ ✨ Optimizadas│ ✅ Completadas│
├─────────────┼─────────────┼─────────────┼─────────────┤
│     12      │      5      │      8      │     42      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

## 8️⃣ INTERACCIÓN: HACER CLICK EN "VER" O EN FILA
```
Usuario hace click en botón "Ver" en fila ID=123
        ↓
showPlannerDetail(123)
        ↓
GET /api/planner/solicitudes/123
        ↓
```

### Respuesta detallada:
```json
{
  "id": 123,
  "centro": "Centro A",
  "sector": "TI",
  "criticidad": "Alta",
  "estado": "Pendiente",
  "total": 15000,
  "materiales": [
    {
      "nombre": "Laptop HP",
      "cantidad": 5,
      "unidad": "UN",
      "precio_unitario": 2000
    }
  ]
}
```

## 9️⃣ PANEL DE DETALLES SE EXPANDE
```
┌──────────────────────────────────────────────────────────┐
│  📄 Detalles de Solicitud #123            [✕ Cerrar]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Centro: Centro A  │  Sector: TI                        │
│  Criticidad: Alta  │  Estado: Pendiente                 │
│                                                          │
│  📊 Análisis de Optimización                            │
│  ┌────────────────┬────────────────┐                    │
│  │ 🔗 Consolidación│ 💰 Ahorro     │                    │
│  │ 3 proveedores  │ Potencial 12%  │                    │
│  │ pueden abast...│ ($1,800)       │                    │
│  └────────────────┴────────────────┘                    │
│  ┌────────────────┬────────────────┐                    │
│  │ ⏱️ Riesgo      │ 🔄 Equivalentes│                    │
│  │ Criticidad Alta│ 2 ítems con    │                    │
│  │ Plazo: 5 días │ mejor precio   │                    │
│  └────────────────┴────────────────┘                    │
│                                                          │
│  📦 Materiales                                          │
│  ┌─────────┬────────┬──────┬──────────┬─────────┐      │
│  │ Código  │ Desc   │ Cant │ Prec/Un │ Total   │      │
│  ├─────────┼────────┼──────┼──────────┼─────────┤      │
│  │ LAP-001 │ Laptop │  5   │  $2,000 │ $10,000 │      │
│  └─────────┴────────┴──────┴──────────┴─────────┘      │
│                                                          │
│                      [✨ Optimizar Solicitud]           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 🔟 OPTIMIZACIÓN (OPCIONAL)
```
Usuario hace click en "✨ Optimizar Solicitud"
        ↓
POST /api/planner/solicitudes/123/optimize
        ↓
┌─────────────────────────────────────┐
│ Backend ejecuta lógica de optimización│
│ - Análisis de proveedores           │
│ - Consolidación de ítems            │
│ - Cálculo de ahorros                │
│ - Actualiza estado                  │
└─────────────────────────────────────┘
        ↓
showMessage("Optimización completada", true)
        ↓
Tabla se recarga automáticamente
```

---

## 🔄 CICLO COMPLETO EN DIAGRAMA

```
USUARIO HACE CLICK
        │
        ↓
   VALIDAR JWT
        │
        ├─ ✅ Autorizado → Continuar
        │
        └─ ❌ No autorizado → Mostrar error, redirigir
        │
        ↓
   OBTENER SOLICITUDES
   GET /api/planner/solicitudes
        │
        ├─ ✅ 200 OK → Renderizar tabla
        │
        └─ ❌ Error → Mostrar toast de error
        │
        ↓
   OBTENER ESTADÍSTICAS
   GET /api/planner/dashboard
        │
        ├─ ✅ 200 OK → Actualizar stats
        │
        └─ ❌ Error → Mantener valores anteriores
        │
        ↓
   CONFIGURAR EVENT LISTENERS
        │
        └─ Botones listos para interacción
        │
        ↓
   PÁGINA COMPLETAMENTE CARGADA ✅
```

---

## 📱 ELEMENTOS HTML CON IDS CORRECTOS

```
home.html línea 2880+

id="page-planner"              ← Contenedor principal
├── id="statPending"           ← Tarjeta Pendientes
├── id="statInProcess"         ← Tarjeta En Proceso
├── id="statOptimized"         ← Tarjeta Optimizadas
├── id="statCompleted"         ← Tarjeta Completadas
├── id="solicitudesTable"      ← Tabla principal (thead + tbody)
├── id="btnPrevPage"           ← Botón página anterior
├── id="pageInfo"              ← Información de página
├── id="btnNextPage"           ← Botón página siguiente
└── id="detailPanel"           ← Panel expandible (hidden por defecto)
    ├── id="detailSolicitudId" ← ID de solicitud
    ├── id="detailCentro"      ← Centro
    ├── id="detailSector"      ← Sector
    ├── id="detailCriticidad"  ← Criticidad
    ├── id="detailEstado"      ← Estado
    ├── id="detailTotal"       ← Total monto
    ├── id="optimizationResults" ← Análisis de optimización
    ├── id="detailMateriales"  ← Tabla de materiales
    ├── id="btnCloseDetail"    ← Botón Cerrar
    └── id="btnOptimize"       ← Botón Optimizar
```

---

## 🧪 CHECKLIST DE VALIDACIÓN

```
✅ HTML structure válida
✅ IDs de elementos coinciden
✅ Funciones JavaScript definidas en home.html
✅ Navegación integrada en navigateTo()
✅ checkPlannerAccess() verifica JWT + rol
✅ loadPlannerSolicitudes() obtiene datos de API
✅ renderPlannerSolicitudes() llena tabla
✅ updatePlannerStats() obtiene estadísticas
✅ Event listeners en botones
✅ Panel de detalles con hidden attribute
✅ Paginación configurada
✅ Tabla de materiales con ID correcto
✅ Toast messages funcionales
✅ Análisis de optimización muestra datos
```

---

## 🚀 ESTADO ACTUAL

**✅ COMPLETADO Y FUNCIONAL**

El módulo de Planificación está completamente integrado en home.html como una página SPA interna.

Cuando el usuario hace click en "🗂️ Planificación" en el menú:
1. ✅ Navega internamente (sin dejar home.html)
2. ✅ Menú lateral permanece visible
3. ✅ Carga datos desde API
4. ✅ Muestra estadísticas en tiempo real
5. ✅ Permite expandir detalles de solicitudes
6. ✅ Permite paginar entre solicitudes
7. ✅ Permite optimizar solicitudes

**No hay cambios de página, no hay parpadeos, experiencia de usuario fluida. 🎉**
