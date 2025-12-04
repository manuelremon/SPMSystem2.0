# REFERENCIA RÁPIDA PARA DESARROLLADORES

## 📁 Archivos Clave

```
frontend/src/components/Planner/
├── TratarSolicitudModal.jsx ........... Coordinador (PUNTO DE ENTRADA)
├── Paso1AnalisisInicial.jsx .......... Presentación
├── Paso2DecisionAbastecimiento.jsx ... Selector
└── Paso3RevisionFinal.jsx ............ Confirmación

frontend/src/pages/
└── Planner.jsx ....................... Integración (modificado)
```

---

## 🎯 Cómo Funciona

### 1. Usuario hace clic en "Tratar (nuevo)"
```jsx
// En Planner.jsx
<Button onClick={() => setSelectedParaTratar(s)}>
  Tratar (nuevo)
</Button>
```

### 2. Se abre TratarSolicitudModal
```jsx
<TratarSolicitudModal
  solicitud={selectedParaTratar}
  isOpen={!!selectedParaTratar}
  onClose={() => setSelectedParaTratar(null)}
  onComplete={() => load()}
/>
```

### 3. Modal renderiza el paso actual
```jsx
{paso === 1 && <Paso1AnalisisInicial {...props} />}
{paso === 2 && <Paso2DecisionAbastecimiento {...props} />}
{paso === 3 && <Paso3RevisionFinal {...props} />}
```

---

## 🔧 Estado Principal

### TratarSolicitudModal State
```javascript
paso                  // 1, 2, o 3
loading              // boolean
error                // string || null
analisis             // Datos del PASO 1
decisiones           // {itemIdx: opcion}
opciones             // {itemIdx: [opciones]}
```

---

## 📡 APIs Backend Usadas

### PASO 1
```javascript
POST /api/planificador/solicitudes/{id}/analizar
// Response:
{
  data: {
    resumen: {presupuesto_total, presupuesto_disponible, total_solicitado},
    materiales_por_criticidad: {Crítico: [...], Normal: [...], Bajo: [...]},
    conflictos: [...],
    avisos: [...],
    recomendaciones: [...]
  }
}
```

### PASO 2
```javascript
GET /api/planificador/solicitudes/{id}/items/{idx}/opciones-abastecimiento
// Response:
{
  data: {
    opciones: [
      {opcion_id, nombre, tipo, plazo_dias, precio_unitario, rating, ...}
    ]
  }
}
```

### PASO 3
```javascript
POST /api/planificador/solicitudes/{id}/guardar-tratamiento
// Request:
{
  decisiones: [
    {item_idx, opcion_id, id_proveedor, codigo_material, cantidad_aprobada, ...}
  ],
  usuario_id: "..."
}
// Response:
{
  data: {
    items_guardados: number,
    resultado: "..."
  }
}
```

---

## 🎨 Estructura de Componentes

```
TratarSolicitudModal
├─ Header + Progress Indicator
├─ Content Area (renderiza paso actual)
│  ├─ PASO 1: Paso1AnalisisInicial
│  ├─ PASO 2: Paso2DecisionAbastecimiento
│  └─ PASO 3: Paso3RevisionFinal
└─ Footer + Buttons

Paso1AnalisisInicial
├─ 3 Tarjetas (Presupuesto)
├─ Materiales por criticidad
├─ Conflictos
├─ Avisos
└─ Recomendaciones

Paso2DecisionAbastecimiento
├─ Barra de progreso
├─ Info del material actual
├─ 4 Tarjetas seleccionables (opciones)
├─ Resumen de decisiones
└─ Botones navegación

Paso3RevisionFinal
├─ Tabla de decisiones
├─ 3 Tarjetas resumen
├─ Info entregas
└─ Botones Volver/Completar
```

---

## 💾 Props por Componente

### TratarSolicitudModal
```javascript
{
  solicitud,      // Objeto {id, centro, sector, items, ...}
  isOpen,         // boolean
  onClose,        // () => void
  onComplete      // (data) => void
}
```

### Paso1AnalisisInicial
```javascript
{
  analisis,       // Respuesta del PASO 1
  onNext          // () => void
}
```

### Paso2DecisionAbastecimiento
```javascript
{
  solicitud,
  analisis,
  opciones,       // {itemIdx: [opciones]}
  decisiones,     // {itemIdx: opcion}
  onCargarOpciones,     // (idx) => Promise
  onGuardarDecision,    // (idx, opcion) => void
  onNext,               // () => void
  onPrev                // () => void
}
```

### Paso3RevisionFinal
```javascript
{
  solicitud,
  decisiones,     // {itemIdx: opcion}
  onCompleta,     // () => Promise
  onPrev,         // () => void
  loading         // boolean
}
```

---

## 🔄 Flujo de Datos

```
Planner.jsx
  ↓ (selecciona solicitud)
TratarSolicitudModal.jsx
  ↓ (paso = 1)
Paso1AnalisisInicial.jsx (lee datos de 'analisis')
  ↓ (usuario avanza)
Paso2DecisionAbastecimiento.jsx
  ├─ carga opciones dinámicamente
  ├─ usuario selecciona opción
  └─ guarda en 'decisiones'
  ↓ (usuario avanza después de completar todos)
Paso3RevisionFinal.jsx (muestra 'decisiones')
  ↓ (usuario completa)
API POST /guardar-tratamiento
  ↓ (éxito)
Modal cierra → Planner recarga
```

---

## 🧪 Testing Manual

```javascript
// 1. Abrir DevTools (F12)
// 2. Verificar requests en Network
// 3. Ver responses en Console

// Request PASO 1
fetch('http://127.0.0.1:5000/api/planificador/solicitudes/1/analizar', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  credentials: 'include'
}).then(r => r.json()).then(console.log)

// Request PASO 2
fetch('http://127.0.0.1:5000/api/planificador/solicitudes/1/items/0/opciones-abastecimiento', {
  headers: {'Content-Type': 'application/json'},
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

---

## 🐛 Debugging

### Si algo no funciona:

1. **Ver logs del backend**
   - Terminal donde corre `python backend_v2/app.py`

2. **Ver logs del frontend**
   - Consola del navegador (F12 → Console)

3. **Ver Network requests**
   - F12 → Network → hacer acción → revisar request/response

4. **Verificar estado**
   - React DevTools si está instalado
   - Ver `paso`, `analisis`, `decisiones`, `opciones`

5. **Revisar BD**
   ```bash
   sqlite3 backend_v2/spm.db
   SELECT * FROM proveedores;
   SELECT COUNT(*) FROM material_equivalencias;
   SELECT * FROM solicitud_items_tratamiento;
   ```

---

## ⚡ Performance Tips

1. **Componentes pesados:**
   - Usar `React.memo()` si re-renders frecuentes
   - Usar `useMemo()` para cálculos costosos

2. **Carga de datos:**
   - Opciones se cargan bajo demanda (solo cuando se necesitan)
   - No cargar todas las opciones de una vez

3. **CSS:**
   - Tailwind CSS compila en build time
   - No hay CSS-in-JS overhead

---

## 🚀 Deployment

1. **Build frontend:**
   ```bash
   npm run build  # Crea dist/
   ```

2. **Deploy:**
   - Copiar `dist/` a servidor
   - Servir con nginx o similiar

3. **Backend:**
   - Usar WSGI server (gunicorn, uwsgi)
   - No usar Flask dev server en producción

4. **Verificación:**
   - Probar los 3 pasos en producción
   - Verificar APIs en logs
   - Verificar BD tiene datos

---

## 📋 Extensiones Comunes

### Agregar validación adicional en PASO 2:
```jsx
const validarOpcion = (opcion) => {
  if (!opcion.id_proveedor) return false
  if (opcion.precio_unitario < 0) return false
  return true
}
```

### Agregar estadísticas en PASO 3:
```jsx
const estadisticas = useMemo(() => ({
  totalItems: Object.keys(decisiones).length,
  costoPromedio: costoTotal / Object.keys(decisiones).length,
  plazoPromedio: plazoTotal / Object.keys(decisiones).length
}), [decisiones])
```

### Cambiar colores:
```jsx
// En Tailwind classes:
// Azul: bg-blue-600, border-blue-200, text-blue-700
// Verde: bg-green-500, border-green-200, text-green-700
// Rojo: bg-red-600, border-red-200, text-red-700
```

---

## 🔗 Enlaces Útiles

- React Hooks: https://react.dev/reference/react/hooks
- Tailwind CSS: https://tailwindcss.com/docs
- Zustand: https://github.com/pmndrs/zustand
- Axios: https://axios-http.com/docs

---

## 📝 Notas Importantes

1. **CSRF Token:** Se maneja automáticamente en `api()` wrapper
2. **Autenticación:** Requiere usuario autenticado en Zustand
3. **Responsividad:** Todos los componentes son mobile-friendly
4. **Validaciones:** Cliente-side + servidor-side
5. **Errores:** Mostrados en el modal, no en consola

---

## 🎯 Resumen Ultra-Rápido

```
TratarSolicitudModal = Coordinador
Paso1... = Mostrar análisis
Paso2... = Seleccionar opciones (4 por item)
Paso3... = Confirmar y guardar

API 1 → Análisis
API 2 → Opciones (carga bajo demanda)
API 3 → Guardar decisiones
```

---

*Referencia Rápida - Nov 2025*
